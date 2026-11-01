import json
import logging
import time
import uuid
from datetime import date

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.db.models import Count, Q
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger("queuefree.views")

from .adapters import adapter_for
from .models import (
    AppointmentSlot, AuditLog, Booking, DailyTokenSequence, Department,
    Doctor, DoctorSchedule, Hospital, HospitalHoliday, NotificationLog,
    PatientProfile, Payment, QueueControl, StaffProfile
)
from .otp_service import send_otp_to_phone, verify_phone_otp
from .permissions import (
    IsDoctor, IsHospitalAdmin, IsHospitalStaff, IsPatient, IsReceptionist,
    IsSuperAdmin, get_user_tenant_hospital, role_for_user
)
from .serializers import (
    BookingCreateSerializer, BookingSerializer, CancelSerializer,
    DailyTokenSequenceSerializer, DemoPatientLoginSerializer,
    DepartmentSerializer, DoctorScheduleSerializer, DoctorSerializer,
    HospitalHolidaySerializer, HospitalSerializer, NotificationLogSerializer,
    PatientPhoneLoginSerializer, PatientProfileSerializer, PatientSendOtpSerializer,
    PatientVerifyAbhaSerializer, PatientVerifyOtpSerializer, QueueActionSerializer,
    RescheduleSerializer, StaffLoginSerializer, StaffProfileSerializer,
    SuperAdminHospitalSerializer, WalkInBookingSerializer
)
from .services import (
    Conflict, ServiceUnavailable, available_slots, cancel_booking,
    create_booking, create_walk_in_booking, generate_slots_for_doctor,
    get_patient, perform_queue_action, process_auto_no_shows, staff_for
)

User = get_user_model()


class ApiIndexView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "service": "QueueFree OPD API",
            "version": "v1",
            "status": "healthy",
            "frontend_url": "http://127.0.0.1:5173/",
            "endpoints": {
                "hospitals": "/api/v1/hospitals/",
                "doctors": "/api/v1/doctors/",
                "availability": "/api/v1/availability/",
                "bookings": "/api/v1/bookings/",
                "staff_queue": "/api/v1/staff/queue/",
                "patient_auth": "/api/v1/auth/patient/phone/",
                "staff_auth": "/api/v1/auth/staff/login/",
                "health": "/health/",
                "admin": "/admin/",
            }
        })


def tokens_for(user, role):
    refresh = RefreshToken.for_user(user)
    refresh["role"] = role
    return {"access": str(refresh.access_token), "refresh": str(refresh), "role": role}


# ==============================================================================
# Patient Authentication Views (ABHA, OTP, Registration)
# ==============================================================================

class AbhaAuthInitView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .abdm_service import abdm_service
        from .serializers import AbhaAuthInitSerializer

        serializer = AbhaAuthInitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]
        auth_mode = serializer.validated_data.get("auth_mode", "MOBILE_OTP")
        phone = serializer.validated_data.get("phone", "")

        user = request.user if request.user and request.user.is_authenticated else None
        success, result = abdm_service.initiate_auth(identifier=identifier, auth_mode=auth_mode, user=user, phone=phone)
        if not success:
            raise ValidationError(result)
        return Response(result, status=status.HTTP_200_OK)


class AbhaAuthConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        import re
        from .abdm_service import abdm_service
        from .serializers import AbhaAuthConfirmSerializer
        from .models import PatientABHAIdentity

        serializer = AbhaAuthConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        txn_id = serializer.validated_data["txn_id"]
        otp = serializer.validated_data["otp"]

        user = request.user if request.user and request.user.is_authenticated else None
        success, result = abdm_service.verify_otp(txn_id=txn_id, otp=otp, user=user)
        if not success:
            raise ValidationError(result)

        profile_data = result.get("profile", {})
        abha_number = result.get("abha_number", "")
        clean_num = re.sub(r"\D", "", abha_number)
        username = f"patient-abha-{clean_num}"

        user, _ = User.objects.get_or_create(username=username)
        patient_profile, created = PatientProfile.objects.get_or_create(
            user=user,
            defaults={
                "abha_demo_identifier": abha_number,
                "display_name": profile_data.get("name", f"Patient {abha_number[-4:]}"),
                "phone": profile_data.get("mobile", ""),
                "gender": profile_data.get("gender", "M"),
                "address": profile_data.get("address", ""),
                "abha_id": abha_number,
                "abha_address": profile_data.get("abha_address", ""),
                "is_abha_verified": True,
            },
        )
        if not created:
            patient_profile.display_name = profile_data.get("name", patient_profile.display_name)
            patient_profile.phone = profile_data.get("mobile", patient_profile.phone)
            patient_profile.gender = profile_data.get("gender", patient_profile.gender)
            patient_profile.address = profile_data.get("address", patient_profile.address)
            patient_profile.abha_id = abha_number
            patient_profile.abha_demo_identifier = abha_number
            patient_profile.abha_address = profile_data.get("abha_address", patient_profile.abha_address)
            patient_profile.is_abha_verified = True
            patient_profile.save()

        # Update or create PatientABHAIdentity
        PatientABHAIdentity.objects.update_or_create(
            patient_profile=patient_profile,
            defaults={
                "abha_number": abha_number,
                "abha_address": profile_data.get("abha_address", ""),
                "name": profile_data.get("name", ""),
                "gender": profile_data.get("gender", "M"),
                "date_of_birth": profile_data.get("date_of_birth", ""),
                "mobile": profile_data.get("mobile", ""),
                "address_line": profile_data.get("address", ""),
                "district_name": profile_data.get("district", ""),
                "state_name": profile_data.get("state", ""),
                "pincode": profile_data.get("pincode", ""),
                "is_active": True,
            },
        )

        tokens = tokens_for(user, "patient")
        tokens.update({
            "abha_verified": True,
            "abha_id": abha_number,
            "abha_address": profile_data.get("abha_address", ""),
            "display_name": patient_profile.display_name,
            "phone": patient_profile.phone,
            "email": patient_profile.email,
            "gender": patient_profile.gender,
            "date_of_birth": str(patient_profile.date_of_birth or profile_data.get("date_of_birth", "")),
            "address": patient_profile.address,
            "is_live_gateway": result.get("is_live_gateway", False),
        })
        return Response(tokens, status=status.HTTP_200_OK)


class AbhaAuthCancelView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .abdm_service import abdm_service
        txn_id = request.data.get("txn_id")
        if not txn_id:
            raise ValidationError({"txn_id": "Transaction ID is required."})
        success, result = abdm_service.cancel_transaction(txn_id)
        if not success:
            raise ValidationError(result)
        return Response(result, status=status.HTTP_200_OK)


class PatientRegistrationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .serializers import PatientRegistrationSerializer

        serializer = PatientRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        phone_digits = data["phone"]
        name = data["name"].strip()
        email = data.get("email", "").strip()
        dob = data.get("date_of_birth")
        gender = data.get("gender", "M")
        address = data.get("address", "").strip()
        abha_number = data.get("abha_number", "").strip()
        abha_address = data.get("abha_address", "").strip()

        username = f"patient-reg-{phone_digits}"
        user, _ = User.objects.get_or_create(username=username)

        temp_abha = abha_number or f"PENDING-ABHA-{phone_digits[-8:]}"
        profile, created = PatientProfile.objects.get_or_create(
            user=user,
            defaults={
                "abha_demo_identifier": temp_abha,
                "display_name": name,
                "phone": f"+91{phone_digits[-10:]}",
                "email": email,
                "date_of_birth": dob,
                "gender": gender,
                "address": address,
                "abha_id": abha_number,
                "abha_address": abha_address,
                "is_abha_verified": False,
            },
        )
        if not created:
            profile.display_name = name
            profile.phone = f"+91{phone_digits[-10:]}"
            if email:
                profile.email = email
            if dob:
                profile.date_of_birth = dob
            profile.gender = gender
            if address:
                profile.address = address
            if abha_number:
                profile.abha_id = abha_number
            if abha_address:
                profile.abha_address = abha_address
            profile.save()

        tokens = tokens_for(user, "patient")
        tokens.update({
            "abha_verified": profile.is_abha_verified,
            "abha_id": profile.abha_id,
            "abha_address": profile.abha_address,
            "display_name": profile.display_name,
            "phone": profile.phone,
            "email": profile.email,
            "gender": profile.gender,
            "date_of_birth": str(profile.date_of_birth or ""),
            "address": profile.address,
        })
        return Response(tokens, status=status.HTTP_201_CREATED)


class PatientProfileDetailView(APIView):
    permission_classes = [IsAuthenticated, IsPatient]

    def get(self, request):
        from .serializers import PatientProfileDetailSerializer
        patient = get_patient(request.user)
        serializer = PatientProfileDetailSerializer(patient)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        from .serializers import PatientProfileDetailSerializer
        patient = get_patient(request.user)
        for field in ["display_name", "email", "gender", "address", "preferred_language"]:
            if field in request.data:
                setattr(patient, field, request.data[field])
        patient.save()
        serializer = PatientProfileDetailSerializer(patient)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PatientSendOtpView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PatientSendOtpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data["phone"]
        result = send_otp_to_phone(phone)
        return Response(result, status=status.HTTP_200_OK)


class PatientVerifyOtpView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PatientVerifyOtpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data["phone"]
        otp = serializer.validated_data["otp"]
        name = (serializer.validated_data.get("name") or "").strip()
        email = (serializer.validated_data.get("email") or "").strip()

        is_valid, msg = verify_phone_otp(phone, otp)
        if not is_valid:
            raise ValidationError({"otp": msg})

        if not name and email:
            user_part = email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ")
            name = " ".join(w.capitalize() for w in user_part.split() if not w.isdigit()) or "Patient User"
        if not name:
            name = f"Patient {phone[-4:]}"

        clean_phone = "".join(ch for ch in phone if ch.isdigit())
        username = f"patient-phone-{clean_phone}"
        user, _ = User.objects.get_or_create(username=username)

        temp_abha = f"PENDING-ABHA-{clean_phone[-8:]}"
        profile, created = PatientProfile.objects.get_or_create(
            user=user,
            defaults={"abha_demo_identifier": temp_abha, "display_name": name, "phone": f"+91{clean_phone[-10:]}", "email": email},
        )
        update_fields = []
        if not created:
            if name and profile.display_name != name:
                profile.display_name = name
                update_fields.append("display_name")
            if email and profile.email != email:
                profile.email = email
                update_fields.append("email")
            if update_fields:
                profile.save(update_fields=update_fields)

        is_verified = bool(profile.abha_demo_identifier and not profile.abha_demo_identifier.startswith("PENDING-"))
        tokens = tokens_for(user, "patient")
        tokens.update({
            "abha_verified": is_verified,
            "abha_id": profile.abha_demo_identifier if is_verified else "",
            "display_name": profile.display_name,
            "phone": profile.phone,
            "email": profile.email,
        })
        return Response(tokens, status=status.HTTP_200_OK)


class PatientDemoLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = DemoPatientLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["abha_demo_identifier"]
        phone = serializer.validated_data["phone"]
        user, _ = User.objects.get_or_create(username="patient-" + identifier.lower())
        profile, _ = PatientProfile.objects.get_or_create(
            user=user,
            defaults={"abha_demo_identifier": identifier, "display_name": "QueueFree demo patient"},
        )
        if profile.abha_demo_identifier != identifier:
            raise APIException("The demo identity is already associated with another account.")
        profile.phone = phone
        profile.consent_preferences = {
            **profile.consent_preferences,
            "whatsapp_queue_notifications": True,
            "whatsapp_queue_notifications_consented_at": timezone.now().isoformat(),
        }
        profile.save(update_fields=["phone", "consent_preferences"])
        return Response(tokens_for(user, "patient"))


class PatientPhoneLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PatientPhoneLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data["phone"]
        email = (serializer.validated_data.get("email") or "").strip()
        name = (serializer.validated_data.get("name") or "").strip()

        if not name and email:
            user_part = email.split("@")[0].replace(".", " ").replace("_", " ").replace("-", " ")
            name = " ".join(w.capitalize() for w in user_part.split() if not w.isdigit()) or "Patient User"
        if not name:
            name = "Patient User"

        clean_phone = "".join(ch for ch in phone if ch.isdigit())
        username = f"patient-phone-{clean_phone}"
        user, _ = User.objects.get_or_create(username=username)
        temp_abha = f"PENDING-ABHA-{clean_phone[-8:]}"
        profile, created = PatientProfile.objects.get_or_create(
            user=user,
            defaults={"abha_demo_identifier": temp_abha, "display_name": name, "phone": phone, "email": email},
        )
        update_fields = []
        if not created:
            if name and profile.display_name != name:
                profile.display_name = name
                update_fields.append("display_name")
            if phone and profile.phone != phone:
                profile.phone = phone
                update_fields.append("phone")
            if email and profile.email != email:
                profile.email = email
                update_fields.append("email")
            if update_fields:
                profile.save(update_fields=update_fields)

        is_verified = bool(profile.abha_demo_identifier and not profile.abha_demo_identifier.startswith("PENDING-"))
        tokens = tokens_for(user, "patient")
        tokens["abha_verified"] = is_verified
        tokens["abha_id"] = profile.abha_demo_identifier if is_verified else ""
        tokens["display_name"] = profile.display_name
        tokens["phone"] = profile.phone
        tokens["email"] = profile.email or email
        return Response(tokens)


class PatientVerifyAbhaView(APIView):
    permission_classes = [IsAuthenticated, IsPatient]

    def post(self, request):
        serializer = PatientVerifyAbhaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        abha_id = serializer.validated_data["abha_identifier"]
        patient = get_patient(request.user)
        existing = PatientProfile.objects.filter(abha_demo_identifier=abha_id).exclude(pk=patient.pk).first()
        if existing:
            raise ValidationError({"abha": "This ABHA ID is already linked to another patient profile."})
        patient.abha_demo_identifier = abha_id
        patient.abha_id = abha_id
        patient.is_abha_verified = True
        patient.consent_preferences = {
            **patient.consent_preferences,
            "whatsapp_queue_notifications": serializer.validated_data.get("whatsapp_notifications_consent", True),
            "whatsapp_queue_notifications_consented_at": timezone.now().isoformat(),
        }
        patient.save(update_fields=["abha_demo_identifier", "abha_id", "is_abha_verified", "consent_preferences"])
        return Response({
            "status": "verified",
            "abha_id": abha_id,
            "message": "ABHA ID verified and linked to your patient profile successfully.",
        })


# ==============================================================================
# Staff Authentication Views (Super Admin, Hospital Admin, Doctor, Reception)
# ==============================================================================

class StaffLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = StaffLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["username"],
            password=serializer.validated_data["password"],
        )
        if not user:
            return Response(
                {"error": {"code": "invalid_credentials", "message": "Invalid staff username or password.", "details": None}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if user.is_superuser and not hasattr(user, "staff_profile"):
            StaffProfile.objects.create(
                user=user,
                hospital=None,
                role=StaffProfile.Role.SUPER_ADMIN,
            )

        if not hasattr(user, "staff_profile"):
            return Response(
                {"error": {"code": "not_authorized", "message": "Account has no staff role assigned.", "details": None}},
                status=status.HTTP_403_FORBIDDEN,
            )

        staff = user.staff_profile
        if not staff.is_active:
            return Response(
                {"error": {"code": "account_disabled", "message": "This staff account has been deactivated.", "details": None}},
                status=status.HTTP_403_FORBIDDEN,
            )

        expected_role = (serializer.validated_data.get("expected_role") or "").strip().lower()
        if expected_role == "receptionist":
            expected_role = "reception"
        if expected_role and staff.role != expected_role and not (user.is_superuser or staff.role == StaffProfile.Role.SUPER_ADMIN):
            role_labels = {
                "super_admin": "Super Admin",
                "hospital_admin": "Hospital Admin",
                "doctor": "Doctor",
                "receptionist": "Receptionist",
            }
            exp_label = role_labels.get(expected_role, expected_role.replace("_", " ").title())
            act_label = role_labels.get(staff.role, staff.role.replace("_", " ").title())
            return Response(
                {
                    "error": {
                        "code": "role_mismatch",
                        "message": f"Access denied. This account has the role '{act_label}', not '{exp_label}'. Please log in through the {act_label} Portal.",
                        "details": {"actual_role": staff.role, "expected_role": expected_role},
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        tokens = tokens_for(user, staff.role)
        tokens.update({
            "username": user.username,
            "full_name": user.get_full_name() or user.username,
            "role": staff.role,
            "hospital_id": staff.hospital_id,
            "hospital_name": staff.hospital.name if staff.hospital else "Platform Wide (Super Admin)",
            "doctor_id": staff.doctor_id,
            "doctor_name": staff.doctor.display_name if staff.doctor else None,
        })
        return Response(tokens)


class StaffMeView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalStaff]

    def get(self, request):
        staff = request.user.staff_profile
        return Response(StaffProfileSerializer(staff).data)


# ==============================================================================
# Public Catalog Views
# ==============================================================================

class HospitalListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = HospitalSerializer
    queryset = Hospital.objects.filter(is_active=True)

    def get_queryset(self):
        queryset = super().get_queryset()
        city = self.request.query_params.get("city")
        if city:
            queryset = queryset.filter(city__iexact=city)
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(city__icontains=search) |
                Q(address__icontains=search)
            )
        mode = self.request.query_params.get("mode")
        if mode:
            mode_map = {"api": "A", "redirect": "B", "native": "C"}
            if mode in mode_map:
                queryset = queryset.filter(integration_type=mode_map[mode])
        return queryset


class HospitalDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = HospitalSerializer
    queryset = Hospital.objects.filter(is_active=True)
    lookup_url_kwarg = "hospital_id"


class DepartmentListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = DepartmentSerializer

    def get_queryset(self):
        h_id = self.kwargs["hospital_id"]
        hospital = None
        if str(h_id).isdigit():
            hospital = Hospital.objects.filter(pk=int(h_id), is_active=True).first()
        if not hospital:
            hospital = Hospital.objects.filter(
                Q(external_hospital_code=str(h_id)) |
                Q(slug__iexact=str(h_id)),
                is_active=True,
            ).first()

        if not hospital:
            return Department.objects.none()

        return Department.objects.filter(
            hospital=hospital,
            is_active=True,
        ).annotate(doctors_count=Count("doctors", filter=Q(doctors__is_available=True))).order_by("name")


class DoctorListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = DoctorSerializer

    def get_queryset(self):
        queryset = Doctor.objects.filter(
            is_available=True,
            department__is_active=True,
            hospital__is_active=True,
        ).select_related("department", "hospital").prefetch_related("schedules")
        
        hospital_id = self.request.query_params.get("hospital_id")
        h_obj = None

        if hospital_id:
            if str(hospital_id).isdigit():
                h_obj = Hospital.objects.filter(pk=int(hospital_id), is_active=True).first()
            if not h_obj:
                h_obj = Hospital.objects.filter(
                    Q(external_hospital_code=hospital_id) |
                    Q(slug__iexact=hospital_id) |
                    Q(name__iexact=hospital_id),
                    is_active=True,
                ).first()
        elif self.request.user and self.request.user.is_authenticated:
            # Check staff context
            staff_prof = getattr(self.request.user, "staff_profile", None)
            if staff_prof and staff_prof.hospital:
                h_obj = staff_prof.hospital
        
        # Multi-tenant security isolation: Default to demonstration hospital if not specified
        if not h_obj:
            h_obj = Hospital.objects.filter(is_demo=True, is_active=True).first()

        if h_obj:
            queryset = queryset.filter(Q(hospital=h_obj) | Q(department__hospital=h_obj))
        else:
            return Doctor.objects.none()
            
        department_id = self.request.query_params.get("department_id")
        if department_id:
            if str(department_id).isdigit():
                queryset = queryset.filter(department_id=int(department_id))
            else:
                queryset = queryset.filter(
                    Q(department__code=department_id) |
                    Q(department__name__iexact=department_id)
                )
        return queryset


class AvailabilityView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            doctor_id = int(request.query_params["doctor_id"])
            day = date.fromisoformat(request.query_params["date"])
        except (KeyError, ValueError):
            raise ValidationError({"date": "Provide doctor_id and a valid ISO date (YYYY-MM-DD)."})
        doctor = get_object_or_404(Doctor.objects.select_related("department__hospital"), pk=doctor_id, is_available=True)
        if not doctor.department.hospital.is_active:
            raise NotFound("Hospital is inactive.")
        slots = available_slots(doctor, day)
        if not slots:
            generate_slots_for_doctor(doctor, day)
            slots = available_slots(doctor, day)
        integration = doctor.department.hospital.integration_type
        if integration == Hospital.IntegrationType.API:
            try:
                adapter = adapter_for(doctor.department.hospital)
            except NotImplementedError as exc:
                raise ServiceUnavailable("No authorized hospital availability adapter is configured.") from exc
            adapter_status = {item["slot_id"]: item["available"] for item in adapter.availability(doctor.department.hospital, slots)}
        else:
            adapter_status = {}
        results = []
        for slot in slots:
            available = slot.capacity - slot.active_bookings > 0
            if integration == Hospital.IntegrationType.API:
                available = adapter_status.get(slot.pk, False)
            if integration == Hospital.IntegrationType.API:
                slot_remaining = int(available)
            else:
                slot_remaining = max(0, slot.capacity - slot.active_bookings)
            results.append({
                "id": slot.pk,
                "time": slot.start_time.strftime("%H:%M"),
                "available": available,
                "remaining": slot_remaining,
                "capacity": slot.capacity,
            })
        return Response({"doctor_id": doctor.pk, "date": day.isoformat(), "integration_type": integration, "slots": results})


class PublicDisplayBoardView(APIView):
    """
    Public Live TV Display Board endpoint for hospital lobby screens.
    Zero PII Broadcast: Strictly exposes room, doctor, and token identifiers.
    Accessible without authentication (AllowAny).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        hospital_id = request.query_params.get("hospital_id")
        hospital = None
        if hospital_id:
            try:
                hospital = Hospital.objects.filter(pk=int(hospital_id), is_active=True).first()
            except (ValueError, TypeError):
                pass
            if not hospital and not str(hospital_id).isdigit():
                hospital = Hospital.objects.filter(
                    Q(external_hospital_code=hospital_id) |
                    Q(slug__icontains=hospital_id) |
                    Q(name__icontains=hospital_id),
                    is_active=True
                ).first()

        # If not specified or not found, default to demonstration hospital
        if not hospital:
            hospital = Hospital.objects.filter(is_demo=True, is_active=True).first()
        if not hospital:
            hospital = Hospital.objects.filter(is_active=True).first()
        if not hospital:
            return Response({"error": "No active hospital found"}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.localdate()
        date_str = request.query_params.get("date")
        if date_str:
            try:
                today = date.fromisoformat(date_str)
            except ValueError:
                pass

        # Fetch active doctors associated with this hospital's active departments
        doctors = (
            Doctor.objects.filter(
                department__hospital=hospital,
                department__is_active=True,
                is_available=True,
            )
            .select_related("department")
            .order_by("department__name", "display_name")
        )

        dept_filter = request.query_params.get("department_id") or request.query_params.get("dept")
        if dept_filter and dept_filter != "all":
            if str(dept_filter).isdigit():
                doctors = doctors.filter(department_id=int(dept_filter))
            else:
                doctors = doctors.filter(Q(department__code=dept_filter) | Q(department__name__icontains=dept_filter))

        # Query all bookings for this hospital on the target date excluding cancelled
        bookings = (
            Booking.objects.filter(hospital=hospital, appointment_date=today)
            .exclude(status=Booking.Status.CANCELLED)
            .select_related("doctor", "department", "slot")
            .order_by("slot__start_time", "token_number")
        )

        if dept_filter and dept_filter != "all":
            if str(dept_filter).isdigit():
                bookings = bookings.filter(department_id=int(dept_filter))
            else:
                bookings = bookings.filter(Q(department__code=dept_filter) | Q(department__name__icontains=dept_filter))

        # Index bookings by doctor_id
        bookings_by_doctor = {}
        for b in bookings:
            doc_id = b.doctor_id
            if doc_id not in bookings_by_doctor:
                bookings_by_doctor[doc_id] = []
            bookings_by_doctor[doc_id].append(b)

        doctor_queues = []
        total_waiting_hospital = 0
        most_recent_call = None

        for doc in doctors:
            doc_bookings = bookings_by_doctor.get(doc.id, [])

            # Serving / Calling token
            serving_booking = next((b for b in doc_bookings if b.status == Booking.Status.SERVING), None)
            calling_booking = next((b for b in doc_bookings if b.status == Booking.Status.CALLING), None)

            # Waiting / Arrived tokens
            waiting_bookings = [
                b for b in doc_bookings
                if b.status in [Booking.Status.ARRIVED, Booking.Status.WAITING, Booking.Status.CONFIRMED]
            ]
            total_waiting_hospital += len(waiting_bookings)

            now_serving = "—"
            status_code = "WAITING"
            status_display = "READY FOR PATIENTS"
            active_token = None

            if serving_booking:
                active_token = serving_booking.token_number or f"T-{serving_booking.queue_sequence:03d}"
                now_serving = active_token
                status_code = "SERVING"
                status_display = "NOW SERVING"
            elif calling_booking:
                active_token = calling_booking.token_number or f"T-{calling_booking.queue_sequence:03d}"
                now_serving = active_token
                status_code = "CALLING"
                status_display = "NOW CALLING"
            elif waiting_bookings:
                status_code = "NEXT_READY"
                status_display = "CALLING NEXT"

            next_tokens = [
                b.token_number or f"T-{b.queue_sequence:03d}"
                for b in waiting_bookings[:6]
            ]

            room_str = doc.room_number or f"Room {100 + doc.id}"

            if active_token and not most_recent_call:
                most_recent_call = {
                    "token": active_token,
                    "doctor": doc.display_name,
                    "room": room_str,
                    "status": status_code,
                }

            doctor_queues.append({
                "doctor_id": doc.id,
                "doctor_name": doc.display_name,
                "qualification": doc.qualification,
                "department": doc.department.name if doc.department else "General OPD",
                "department_code": doc.department.code if doc.department else "gen",
                "room": room_str,
                "now_serving": now_serving,
                "status": status_code,
                "status_display": status_display,
                "delay_minutes": getattr(doc, "delay_minutes", 0) or 0,
                "delay_reason": getattr(doc, "delay_reason", "") or "",
                "next_in_line": next_tokens,
                "total_waiting": len(waiting_bookings),
                "average_consultation_minutes": getattr(doc, "average_consultation_minutes", 15) or 15,
            })

        return Response({
            "hospital": {
                "id": hospital.id,
                "name": hospital.name,
                "city": hospital.city,
                "address": hospital.address,
                "is_demo": hospital.is_demo,
            },
            "date": today.isoformat(),
            "server_time": timezone.localtime().isoformat(),
            "total_waiting": total_waiting_hospital,
            "active_doctors_count": len(doctors),
            "most_recent_call": most_recent_call,
            "doctor_queues": doctor_queues,
        })


# ==============================================================================
# Patient Booking & Queue Views
# ==============================================================================

class PatientBookingListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsPatient]
    serializer_class = BookingSerializer

    def get_queryset(self):
        return Booking.objects.filter(patient=get_patient(self.request.user)).select_related(
            "hospital", "department", "doctor", "slot", "patient"
        ).prefetch_related("payments__refunds")

    def create(self, request, *args, **kwargs):
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking, created = create_booking(request.user, serializer.validated_data)
        response = BookingSerializer(booking, context={"request": request}).data
        response["created"] = created
        response["message"] = (
            "Booking confirmed by the hospital API adapter."
            if booking.authoritative_external
            else "QueueFree-managed OPD token confirmed."
        )
        return Response(response, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class PatientBookingDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsPatient]
    serializer_class = BookingSerializer
    lookup_url_kwarg = "booking_id"

    def get_queryset(self):
        return Booking.objects.filter(patient=get_patient(self.request.user)).select_related(
            "hospital", "department", "doctor", "slot", "patient"
        ).prefetch_related("payments__refunds")


class PatientCancelView(APIView):
    permission_classes = [IsAuthenticated, IsPatient]

    def post(self, request, booking_id):
        serializer = CancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = get_patient(request.user)
        booking = get_object_or_404(Booking.objects.select_related("hospital", "slot"), pk=booking_id)
        result, refund, percentage = cancel_booking(booking, patient, serializer.validated_data["reason"], request.user)
        return Response({
            "booking": BookingSerializer(result, context={"request": request}).data,
            "refund": {"amount": str(refund), "percentage": percentage, "status": "simulated" if refund else "not_applicable"},
        })


class PatientRescheduleView(APIView):
    permission_classes = [IsAuthenticated, IsPatient]

    def post(self, request, booking_id):
        serializer = RescheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = get_patient(request.user)
        with transaction.atomic():
            booking = get_object_or_404(
                Booking.objects.select_for_update().select_related("hospital", "doctor", "slot", "patient"),
                pk=booking_id,
                patient=patient,
            )
            if booking.status not in {Booking.Status.WAITING, Booking.Status.ARRIVED}:
                raise Conflict("Only a waiting booking can be rescheduled.")
            if booking.authoritative_external:
                raise Conflict("This hospital manages the booking; use its official booking service to reschedule.")
            Hospital.objects.select_for_update().get(pk=booking.hospital_id)
            new_slot = get_object_or_404(
                AppointmentSlot.objects.select_for_update(),
                pk=serializer.validated_data["slot_id"],
                doctor=booking.doctor,
                appointment_date=serializer.validated_data["date"],
            )
            occupied = Booking.objects.filter(
                slot=new_slot,
                status__in=[Booking.Status.WAITING, Booking.Status.ARRIVED, Booking.Status.SERVING],
            ).exclude(pk=booking.pk).count()
            if occupied >= new_slot.capacity:
                raise Conflict("This slot is no longer available.")
            booking.slot = new_slot
            booking.appointment_date = serializer.validated_data["date"]
            booking.save(update_fields=["slot", "appointment_date", "updated_at"])
            AuditLog.objects.create(hospital=booking.hospital, actor=request.user, booking=booking, action="booking.rescheduled")
        return Response(BookingSerializer(booking, context={"request": request}).data)


class DemoPaymentConfirmView(APIView):
    permission_classes = [IsAuthenticated, IsPatient]

    def post(self, request, booking_id):
        if not settings.DEMO_PAYMENTS_ENABLED:
            raise APIException("No payment provider is configured; payment has not been confirmed.")
        booking = get_object_or_404(Booking, pk=booking_id, patient=get_patient(request.user), hospital__payment_required=True)
        payment = booking.payments.order_by("-created_at").first()
        if not payment:
            raise NotFound("Payment record was not found.")
        if payment.status != Payment.Status.SUCCEEDED:
            payment.status = Payment.Status.SUCCEEDED
            payment.provider = "demo"
            payment.provider_reference = "DEMO-PAY-" + str(booking.pk)[:8]
            payment.simulated = True
            payment.save(update_fields=["status", "provider", "provider_reference", "simulated", "updated_at"])
            booking.payment_state = Booking.PaymentState.PAID
            booking.save(update_fields=["payment_state", "updated_at"])
            AuditLog.objects.create(hospital=booking.hospital, actor=request.user, booking=booking, action="payment.demo_confirmed")
        return Response({"status": "succeeded", "simulated": True, "booking": BookingSerializer(booking, context={"request": request}).data})


# ==============================================================================
# Staff Queue Management Views (Doctor & Receptionist)
# ==============================================================================

class StaffQueueView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalStaff]

    def get(self, request):
        staff = staff_for(request.user)
        day_text = request.query_params.get("date", timezone.localdate().isoformat())
        try:
            day = date.fromisoformat(day_text)
        except ValueError as exc:
            raise ValidationError({"date": "Provide an ISO date (YYYY-MM-DD)."}) from exc

        hospital = staff.hospital
        if not hospital and staff.role == StaffProfile.Role.SUPER_ADMIN:
            hospital_id = request.query_params.get("hospital_id")
            if hospital_id:
                hospital = get_object_or_404(Hospital, pk=hospital_id)
            else:
                hospital = Hospital.objects.filter(is_active=True).first()

        bookings = Booking.objects.filter(hospital=hospital, appointment_date=day).exclude(
            status=Booking.Status.CANCELLED
        ).select_related("hospital", "department", "doctor", "patient", "slot").order_by("slot__start_time", "token_number")

        if staff.role == StaffProfile.Role.DOCTOR and staff.doctor_id:
            bookings = bookings.filter(doctor_id=staff.doctor_id)

        is_paused = False
        if hospital:
            is_paused = QueueControl.objects.filter(
                hospital=hospital,
                doctor=staff.doctor if staff.role == StaffProfile.Role.DOCTOR else None,
                appointment_date=day,
                paused=True,
            ).exists()

        return Response({
            "hospital": HospitalSerializer(hospital).data if hospital else None,
            "role": staff.role,
            "paused": is_paused,
            "bookings": BookingSerializer(bookings, many=True, context={"request": request}).data,
        })


class StaffQueueActionView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalStaff]

    def post(self, request, booking_id):
        serializer = QueueActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = perform_queue_action(request.user, booking_id, serializer.validated_data["action"])
        booking.refresh_from_db()
        return Response(BookingSerializer(booking, context={"request": request}).data)


class StaffQueueControlView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalStaff]

    def post(self, request):
        staff = staff_for(request.user)
        action = request.data.get("action")
        if action not in {"pause", "resume"}:
            raise ValidationError({"action": "Choose pause or resume."})
        try:
            day = date.fromisoformat(request.data.get("date", timezone.localdate().isoformat()))
        except ValueError as exc:
            raise ValidationError({"date": "Provide an ISO date (YYYY-MM-DD)."}) from exc
        QueueControl.objects.update_or_create(
            hospital=staff.hospital,
            doctor=staff.doctor if staff.role == StaffProfile.Role.DOCTOR else None,
            appointment_date=day,
            defaults={"paused": action == "pause"},
        )
        AuditLog.objects.create(hospital=staff.hospital, actor=request.user, action="queue." + action)
        return Response({"paused": action == "pause", "date": day.isoformat()})


class StaffWalkInBookingView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalStaff]

    def post(self, request):
        serializer = WalkInBookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = create_walk_in_booking(request.user, serializer.validated_data)
        return Response(
            BookingSerializer(booking, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class StaffAutoNoShowView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalStaff]

    def post(self, request):
        staff = staff_for(request.user)
        grace = int(request.data.get("grace_minutes", 30))
        day_str = request.data.get("date")
        target_day = date.fromisoformat(day_str) if day_str else timezone.localdate()
        result = process_auto_no_shows(staff.hospital, target_day, grace)
        return Response(result, status=status.HTTP_200_OK)


class DoctorProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]

    def get(self, request):
        doctor = getattr(request.user.staff_profile, "doctor", None)
        if not doctor:
            raise NotFound("No doctor profile assigned to this staff account.")
        return Response(DoctorSerializer(doctor).data)

    def patch(self, request):
        doctor = getattr(request.user.staff_profile, "doctor", None)
        if not doctor:
            raise NotFound("No doctor profile assigned to this staff account.")
        old_delay = doctor.delay_minutes
        serializer = DoctorSerializer(doctor, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        AuditLog.objects.create(hospital=doctor.department.hospital, actor=request.user, action="doctor.status_updated", metadata=serializer.validated_data)

        # Broadcast delay notifications to all active waiting patients if delay increased or updated
        new_delay = serializer.validated_data.get("delay_minutes", old_delay)
        reason = serializer.validated_data.get("delay_reason", doctor.delay_reason)
        if new_delay > 0 and (new_delay != old_delay or "delay_reason" in request.data):
            try:
                from .notifications import dispatch_doctor_delay
                dispatch_doctor_delay(doctor, new_delay, reason)
            except Exception as notif_err:
                logger.warning(f"Failed to broadcast doctor delay: {notif_err}")

        return Response(serializer.data)


# ==============================================================================
# Hospital Admin Views (Strict Tenant Isolation)
# ==============================================================================

class HospitalAdminHospitalDetailView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def get(self, request):
        hospital = get_user_tenant_hospital(request.user)
        return Response(HospitalSerializer(hospital).data)

    def patch(self, request):
        hospital = get_user_tenant_hospital(request.user)
        serializer = HospitalSerializer(hospital, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        AuditLog.objects.create(hospital=hospital, actor=request.user, action="hospital.updated", metadata=serializer.validated_data)
        return Response(serializer.data)


class HospitalAdminDepartmentsView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def get(self, request):
        hospital = get_user_tenant_hospital(request.user)
        depts = Department.objects.filter(hospital=hospital).annotate(doctors_count=Count("doctors"))
        return Response(DepartmentSerializer(depts, many=True).data)

    def post(self, request):
        hospital = get_user_tenant_hospital(request.user)
        serializer = DepartmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dept = serializer.save(hospital=hospital)
        AuditLog.objects.create(hospital=hospital, actor=request.user, action="department.created", metadata={"name": dept.name, "code": dept.code})
        return Response(DepartmentSerializer(dept).data, status=status.HTTP_201_CREATED)


class HospitalAdminDoctorsView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def get(self, request):
        hospital = get_user_tenant_hospital(request.user)
        doctors = Doctor.objects.filter(department__hospital=hospital).select_related("department").prefetch_related("schedules")
        return Response(DoctorSerializer(doctors, many=True).data)

    def post(self, request):
        hospital = get_user_tenant_hospital(request.user)
        department_id = request.data.get("department") or request.data.get("department_id")
        department = get_object_or_404(Department, pk=department_id, hospital=hospital)
        serializer = DoctorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        doc = serializer.save(department=department)
        AuditLog.objects.create(hospital=hospital, actor=request.user, action="doctor.created", metadata={"name": doc.display_name})
        return Response(DoctorSerializer(doc).data, status=status.HTTP_201_CREATED)


class HospitalAdminDoctorDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsHospitalAdmin]
    serializer_class = DoctorSerializer

    def get_queryset(self):
        hospital = get_user_tenant_hospital(self.request.user)
        return Doctor.objects.filter(department__hospital=hospital)


class HospitalAdminSlotGenerateView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def post(self, request):
        hospital = get_user_tenant_hospital(request.user)
        doctor_id = request.data.get("doctor_id")
        doctor = get_object_or_404(Doctor, pk=doctor_id, department__hospital=hospital)
        start_date = date.fromisoformat(request.data.get("start_date", timezone.localdate().isoformat()))
        end_date_str = request.data.get("end_date")
        end_date = date.fromisoformat(end_date_str) if end_date_str else start_date

        created_count = generate_slots_for_doctor(doctor, start_date, end_date)
        return Response({
            "doctor_id": doctor.pk,
            "doctor_name": doctor.display_name,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "slots_created": created_count,
        }, status=status.HTTP_200_OK)


class HospitalAdminDoctorScheduleView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def get(self, request):
        hospital = get_user_tenant_hospital(request.user)
        doctor_id = request.query_params.get("doctor_id")
        qs = DoctorSchedule.objects.filter(doctor__department__hospital=hospital)
        if doctor_id:
            qs = qs.filter(doctor_id=doctor_id)
        return Response(DoctorScheduleSerializer(qs, many=True).data)

    def post(self, request):
        hospital = get_user_tenant_hospital(request.user)
        doctor = get_object_or_404(Doctor, pk=request.data.get("doctor"), department__hospital=hospital)
        serializer = DoctorScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        schedule = serializer.save(doctor=doctor)
        return Response(DoctorScheduleSerializer(schedule).data, status=status.HTTP_201_CREATED)


class HospitalAdminHolidayView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def get(self, request):
        hospital = get_user_tenant_hospital(request.user)
        holidays = HospitalHoliday.objects.filter(hospital=hospital)
        return Response(HospitalHolidaySerializer(holidays, many=True).data)

    def post(self, request):
        hospital = get_user_tenant_hospital(request.user)
        serializer = HospitalHolidaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        holiday = serializer.save(hospital=hospital)
        return Response(HospitalHolidaySerializer(holiday).data, status=status.HTTP_201_CREATED)


class HospitalAdminStaffListView(APIView):
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def get(self, request):
        hospital = get_user_tenant_hospital(request.user)
        staff_qs = StaffProfile.objects.filter(hospital=hospital).select_related("user", "doctor")
        return Response(StaffProfileSerializer(staff_qs, many=True).data)


# ==============================================================================
# Super Admin Views (Platform Oversight & Onboarding)
# ==============================================================================

class SuperAdminHospitalListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    serializer_class = SuperAdminHospitalSerializer
    queryset = Hospital.objects.all().order_by("-created_at")


class SuperAdminHospitalDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    serializer_class = SuperAdminHospitalSerializer
    queryset = Hospital.objects.all()


class SuperAdminAnalyticsView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        today = timezone.localdate()
        total_hospitals = Hospital.objects.count()
        active_hospitals = Hospital.objects.filter(is_active=True).count()
        mode_counts = {
            "api": Hospital.objects.filter(integration_type=Hospital.IntegrationType.API).count(),
            "redirect": Hospital.objects.filter(integration_type=Hospital.IntegrationType.WEBSITE).count(),
            "native": Hospital.objects.filter(integration_type=Hospital.IntegrationType.QUEUEFREE).count(),
        }
        total_bookings_today = Booking.objects.filter(appointment_date=today).count()
        completed_today = Booking.objects.filter(appointment_date=today, status=Booking.Status.COMPLETED).count()
        active_queue_today = Booking.objects.filter(
            appointment_date=today,
            status__in=[Booking.Status.WAITING, Booking.Status.ARRIVED, Booking.Status.SERVING],
        ).count()

        return Response({
            "total_hospitals": total_hospitals,
            "active_hospitals": active_hospitals,
            "integration_modes": mode_counts,
            "today_metrics": {
                "date": today.isoformat(),
                "total_bookings": total_bookings_today,
                "active_in_queue": active_queue_today,
                "completed": completed_today,
            },
        })


class SuperAdminTestConnectionView(APIView):
    """Diagnoses external API or redirect connectivity for any hospital facility."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def post(self, request, pk):
        hospital = get_object_or_404(Hospital, pk=pk)
        adapter = adapter_for(hospital)
        result = adapter.test_connection()
        AuditLog.objects.create(
            hospital=hospital,
            actor=request.user,
            action="hospital.test_connection",
            metadata={"status_code": result.get("status_code"), "latency_ms": result.get("latency_ms"), "success": result.get("success")},
        )
        return Response(result)


class SuperAdminApiConfigUpdateView(APIView):
    """Updates external hospital API connection parameters with encrypted storage."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def patch(self, request, pk):
        hospital = get_object_or_404(Hospital, pk=pk)
        current_cfg = hospital.api_config or {}
        incoming_cfg = request.data.get("api_config", request.data)

        from .crypto import encrypt_secret, mask_secret

        auth_token = incoming_cfg.get("auth_token")
        if auth_token and not auth_token.startswith("••••") and not auth_token.startswith("enc:v1:"):
            incoming_cfg["auth_token"] = encrypt_secret(auth_token)
        elif not auth_token or auth_token.startswith("••••"):
            incoming_cfg["auth_token"] = current_cfg.get("auth_token", "")

        current_cfg.update(incoming_cfg)
        hospital.api_config = current_cfg
        hospital.integration_configured = bool(current_cfg.get("base_url") or current_cfg.get("mock_mode"))
        hospital.save(update_fields=["api_config", "integration_configured", "updated_at"])

        AuditLog.objects.create(
            hospital=hospital,
            actor=request.user,
            action="hospital.api_config_updated",
            metadata={"base_url": current_cfg.get("base_url"), "auth_type": current_cfg.get("auth_type")},
        )

        safe_cfg = dict(current_cfg)
        if "auth_token" in safe_cfg:
            safe_cfg["auth_token"] = mask_secret(safe_cfg["auth_token"])

        return Response({
            "hospital_id": hospital.id,
            "api_config": safe_cfg,
            "integration_configured": hospital.integration_configured,
        })


class IntegrationAdminView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsHospitalAdmin]
    serializer_class = HospitalSerializer
    queryset = Hospital.objects.all()


# ==============================================================================
# Phase 4: Real-Time SSE Streams & Notification Hub
# ==============================================================================

def _authenticate_token_param(request):
    """Allows SSE EventSource connections to authenticate via ?token=<jwt>."""
    token = request.query_params.get("token")
    if token and (not request.user or not request.user.is_authenticated):
        from rest_framework_simplejwt.authentication import JWTAuthentication
        try:
            jwt_auth = JWTAuthentication()
            validated_token = jwt_auth.get_validated_token(token)
            request.user = jwt_auth.get_user(validated_token)
        except Exception:
            pass


class StaffQueueStreamView(APIView):
    """
    Server-Sent Events (SSE) live queue update stream for Doctor & Reception dashboards.
    Pushes live queue states, token sequence, and active delays directly to connected clients.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        _authenticate_token_param(request)
        if not request.user or not request.user.is_authenticated:
            raise PermissionDenied("Authentication required for live queue stream.")
        try:
            staff = staff_for(request.user)
        except Exception as exc:
            raise PermissionDenied(str(exc))

        day_text = request.query_params.get("date", timezone.localdate().isoformat())
        try:
            day = date.fromisoformat(day_text)
        except ValueError:
            day = timezone.localdate()

        hospital = staff.hospital
        if not hospital and staff.role == StaffProfile.Role.SUPER_ADMIN:
            hospital_id = request.query_params.get("hospital_id")
            if hospital_id:
                hospital = Hospital.objects.filter(pk=hospital_id).first()
            else:
                hospital = Hospital.objects.filter(is_active=True).first()

        doctor_filter_id = None
        if staff.role == StaffProfile.Role.DOCTOR and staff.doctor_id:
            doctor_filter_id = staff.doctor_id
        elif request.query_params.get("doctor_id"):
            try:
                doctor_filter_id = int(request.query_params.get("doctor_id"))
            except ValueError:
                pass

        def event_stream():
            yield "event: connected\ndata: {\"status\":\"connected\",\"timestamp\":\"%s\"}\n\n" % timezone.now().isoformat()
            last_signature = None

            # Run stream for up to 25 iterations (~37s) so connection cycles cleanly
            for _ in range(25):
                bookings_qs = Booking.objects.filter(
                    hospital=hospital,
                    appointment_date=day,
                ).exclude(status=Booking.Status.CANCELLED).select_related(
                    "hospital", "department", "doctor", "patient", "slot"
                ).order_by("slot__start_time", "token_number")

                if doctor_filter_id:
                    bookings_qs = bookings_qs.filter(doctor_id=doctor_filter_id)

                bookings = list(bookings_qs)
                sig_parts = [f"{b.id}-{b.status}-{b.updated_at.timestamp()}" for b in bookings]
                if doctor_filter_id:
                    doc = Doctor.objects.filter(pk=doctor_filter_id).first()
                    if doc:
                        sig_parts.append(f"delay-{doc.delay_minutes}-{doc.delay_reason}")
                current_signature = "|".join(sig_parts)

                if current_signature != last_signature:
                    last_signature = current_signature
                    payload = {
                        "date": day.isoformat(),
                        "paused": False,
                        "bookings": BookingSerializer(bookings, many=True, context={"request": request}).data,
                        "updated_at": timezone.now().isoformat(),
                    }
                    if doctor_filter_id:
                        doc = Doctor.objects.filter(pk=doctor_filter_id).first()
                        if doc:
                            payload["doctor"] = DoctorSerializer(doc).data
                    yield "event: queue_update\ndata: %s\n\n" % json.dumps(payload)
                else:
                    yield ": ping\n\n"

                time.sleep(1.5)

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class PatientQueueStreamView(APIView):
    """
    Server-Sent Events (SSE) live queue update stream for Patients.
    Pushes booking status, current serving token, doctor delay, and turn alerts.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        booking_id = request.query_params.get("booking_id")
        if not booking_id:
            raise ValidationError({"booking_id": "Booking ID is required for patient queue stream."})

        try:
            booking = Booking.objects.select_related("hospital", "department", "doctor", "patient", "slot").get(pk=booking_id)
        except (Booking.DoesNotExist, ValueError):
            raise NotFound("Booking not found.")

        def event_stream():
            yield "event: connected\ndata: {\"status\":\"connected\",\"token_number\":\"%s\"}\n\n" % booking.token_number
            last_sig = None
            start_time = timezone.now()

            for _ in range(25):
                b = Booking.objects.select_related("doctor", "hospital", "patient").filter(pk=booking_id).first()
                if not b:
                    break

                serving = Booking.objects.filter(
                    doctor=b.doctor,
                    appointment_date=b.appointment_date,
                    status=Booking.Status.SERVING,
                ).first()

                ahead_count = Booking.objects.filter(
                    doctor=b.doctor,
                    appointment_date=b.appointment_date,
                    status__in=[Booking.Status.WAITING, Booking.Status.ARRIVED, Booking.Status.CALLING, Booking.Status.SERVING],
                    queue_sequence__lt=b.queue_sequence,
                ).count()

                sig = f"{b.status}-{serving.token_number if serving else 'none'}-{ahead_count}-{b.doctor.delay_minutes}-{b.doctor.delay_reason}"
                if sig != last_sig:
                    last_sig = sig
                    payload = {
                        "booking_id": str(b.id),
                        "token_number": b.token_number,
                        "status": b.status,
                        "doctor": {
                            "id": b.doctor.id,
                            "name": b.doctor.display_name,
                            "room": b.doctor.room_number,
                            "delay_minutes": b.doctor.delay_minutes,
                            "delay_reason": b.doctor.delay_reason,
                        },
                        "now_serving": serving.token_number if serving else "-",
                        "position_ahead": ahead_count,
                        "estimated_wait_minutes": max(0, ahead_count * (b.doctor.average_consultation_minutes or 10) + b.doctor.delay_minutes),
                        "updated_at": timezone.now().isoformat(),
                    }
                    yield "event: queue_update\ndata: %s\n\n" % json.dumps(payload)

                latest_notif = NotificationLog.objects.filter(
                    booking=b,
                    created_at__gte=start_time,
                ).order_by("-created_at").first()

                if latest_notif:
                    yield "event: notification\ndata: %s\n\n" % json.dumps(NotificationLogSerializer(latest_notif).data)

                time.sleep(1.5)

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class PatientNotificationListView(APIView):
    """Returns recent notification logs for a patient by phone or user."""
    permission_classes = [AllowAny]

    def get(self, request):
        phone = request.query_params.get("phone", "").strip()
        if not phone and request.user.is_authenticated:
            try:
                patient = get_patient(request.user)
                phone = patient.phone
            except Exception:
                pass

        if not phone:
            return Response([])

        clean = "".join(filter(str.isdigit, phone))[-10:]
        logs = NotificationLog.objects.filter(
            Q(recipient_phone__icontains=clean)
        ).select_related("hospital", "booking").order_by("-created_at")[:20]
        return Response(NotificationLogSerializer(logs, many=True).data)


class HospitalAdminNotificationListView(APIView):
    """Tenant-scoped notifications log for Hospital Admin."""
    permission_classes = [IsAuthenticated, IsHospitalAdmin]

    def get(self, request):
        hospital = get_user_tenant_hospital(request.user)
        logs = NotificationLog.objects.filter(hospital=hospital).select_related("hospital", "booking").order_by("-created_at")[:50]
        return Response(NotificationLogSerializer(logs, many=True).data)


class SuperAdminNotificationListView(APIView):
    """Platform-wide notification log for Super Admin."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get(self, request):
        hospital_id = request.query_params.get("hospital_id")
        qs = NotificationLog.objects.all().select_related("hospital", "booking")
        if hospital_id:
            qs = qs.filter(hospital_id=hospital_id)
        logs = qs.order_by("-created_at")[:100]
        return Response(NotificationLogSerializer(logs, many=True).data)


class DoctorDelayBroadcastView(APIView):
    """Doctor emergency delay setter and instant notification broadcaster."""
    permission_classes = [IsAuthenticated, IsDoctor]

    def post(self, request):
        doctor = getattr(request.user.staff_profile, "doctor", None)
        if not doctor:
            raise NotFound("No doctor profile assigned to this staff account.")

        delay_minutes = int(request.data.get("delay_minutes", 0))
        reason = request.data.get("reason", "").strip()

        doctor.delay_minutes = delay_minutes
        doctor.delay_reason = reason
        doctor.save(update_fields=["delay_minutes", "delay_reason"])

        AuditLog.objects.create(
            hospital=doctor.department.hospital,
            actor=request.user,
            action="doctor.delay_broadcast",
            metadata={"delay_minutes": delay_minutes, "reason": reason},
        )

        sent_count = 0
        if delay_minutes > 0:
            try:
                from .notifications import dispatch_doctor_delay
                results = dispatch_doctor_delay(doctor, delay_minutes, reason)
                sent_count = len(results)
            except Exception as notif_err:
                logger.warning(f"Failed to broadcast delay: {notif_err}")

        return Response({
            "doctor": DoctorSerializer(doctor).data,
            "delay_minutes": delay_minutes,
            "reason": reason,
            "notifications_dispatched": sent_count,
        })

