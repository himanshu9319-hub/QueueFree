from datetime import date
from django.utils import timezone
from rest_framework import serializers

from .models import (
    AppointmentSlot, Booking, DailyTokenSequence, Department, Doctor,
    DoctorSchedule, Hospital, HospitalHoliday, PatientProfile, Payment,
    Refund, StaffProfile
)


class HospitalSerializer(serializers.ModelSerializer):
    integration_label = serializers.CharField(read_only=True)
    integration_mode = serializers.CharField(read_only=True)
    booking_behavior = serializers.SerializerMethodField()

    class Meta:
        model = Hospital
        fields = [
            "id", "name", "slug", "city", "address", "phone", "website", "latitude", "longitude",
            "integration_type", "integration_mode", "integration_label", "integration_status",
            "external_hospital_code", "integration_configured",
            "status", "is_demo", "official_booking_url", "redirect_url",
            "payment_required", "consultation_fee", "currency", "booking_behavior", "created_at",
        ]

    def get_booking_behavior(self, hospital):
        if hospital.integration_type == Hospital.IntegrationType.API:
            return "QueueFree external hospital API integration"
        if hospital.integration_type == Hospital.IntegrationType.WEBSITE:
            return "Redirect to hospital's official booking portal"
        return "QueueFree native real-time queue system"


class SuperAdminHospitalSerializer(serializers.ModelSerializer):
    integration_mode = serializers.CharField(required=False)

    class Meta:
        model = Hospital
        fields = [
            "id", "name", "slug", "city", "address", "phone", "website", "latitude", "longitude",
            "integration_type", "integration_mode", "integration_status", "external_hospital_code",
            "integration_configured", "status",
            "is_demo", "official_booking_url", "redirect_url", "api_config",
            "payment_required", "consultation_fee", "currency", "cancellation_policy",
            "created_at", "updated_at",
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        cfg = ret.get("api_config")
        if isinstance(cfg, dict) and "auth_token" in cfg:
            from .crypto import mask_secret
            cfg["auth_token"] = mask_secret(cfg["auth_token"])
        return ret

    def create(self, validated_data):
        mode = validated_data.pop("integration_mode", None)
        cfg = validated_data.get("api_config")
        if isinstance(cfg, dict) and "auth_token" in cfg:
            token_val = cfg["auth_token"]
            if token_val and not token_val.startswith("enc:v1:"):
                from .crypto import encrypt_secret
                cfg["auth_token"] = encrypt_secret(token_val)
        hospital = Hospital(**validated_data)
        if mode:
            hospital.integration_mode = mode
        hospital.save()
        return hospital

    def update(self, instance, validated_data):
        mode = validated_data.pop("integration_mode", None)
        cfg = validated_data.get("api_config")
        if isinstance(cfg, dict) and "auth_token" in cfg:
            token_val = cfg["auth_token"]
            if token_val and not token_val.startswith("enc:v1:") and not token_val.startswith("••••"):
                from .crypto import encrypt_secret
                cfg["auth_token"] = encrypt_secret(token_val)
            elif token_val and token_val.startswith("••••"):
                # Retain existing encrypted token
                orig_cfg = instance.api_config or {}
                cfg["auth_token"] = orig_cfg.get("auth_token", "")
        if mode:
            instance.integration_mode = mode
        return super().update(instance, validated_data)


class DepartmentSerializer(serializers.ModelSerializer):
    doctors_count = serializers.IntegerField(source="doctors.count", read_only=True)

    class Meta:
        model = Department
        fields = ["id", "hospital", "name", "code", "description", "is_active", "doctors_count"]


class DoctorScheduleSerializer(serializers.ModelSerializer):
    day_name = serializers.CharField(source="get_day_of_week_display", read_only=True)

    class Meta:
        model = DoctorSchedule
        fields = ["id", "doctor", "day_of_week", "day_name", "start_time", "end_time", "slot_duration_minutes", "slot_capacity", "is_active"]


class HospitalHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = HospitalHoliday
        fields = ["id", "hospital", "date", "reason"]


class DoctorSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    hospital_name = serializers.CharField(source="department.hospital.name", read_only=True)
    hospital_id = serializers.IntegerField(source="department.hospital.id", read_only=True)
    fee = serializers.DecimalField(source="department.hospital.consultation_fee", max_digits=9, decimal_places=2, read_only=True)
    room = serializers.CharField(source="room_number", read_only=True)
    schedules = DoctorScheduleSerializer(many=True, read_only=True)

    class Meta:
        model = Doctor
        fields = [
            "id", "display_name", "qualification", "room_number", "room", "department",
            "department_name", "hospital_id", "hospital_name", "fee", "average_consultation_minutes",
            "is_available", "delay_minutes", "delay_reason", "available_weekdays", "schedules",
        ]


class DailyTokenSequenceSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source="doctor.display_name", read_only=True)

    class Meta:
        model = DailyTokenSequence
        fields = ["id", "doctor", "doctor_name", "appointment_date", "last_sequence_number", "updated_at"]


class PatientProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = PatientProfile
        fields = [
            "id", "user_id", "username", "display_name", "phone", "email", "age",
            "gender", "abha_id", "is_abha_verified", "preferred_language", "consent_preferences", "created_at"
        ]


class StaffProfileSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    doctor_name = serializers.CharField(source="doctor.display_name", read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = StaffProfile
        fields = ["id", "username", "email", "role", "role_label", "hospital", "hospital_name", "doctor", "doctor_name", "is_active"]


class BookingSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source="hospital.name", read_only=True)
    hospital_city = serializers.CharField(source="hospital.city", read_only=True)
    hospital_integration_type = serializers.CharField(source="hospital.integration_type", read_only=True)
    hospital_integration_mode = serializers.CharField(source="hospital.integration_mode", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    doctor_name = serializers.CharField(source="doctor.display_name", read_only=True)
    doctor_room = serializers.CharField(source="doctor.room_number", read_only=True)
    slot_time = serializers.TimeField(source="slot.start_time", read_only=True, format="%H:%M")
    patient_display_name = serializers.SerializerMethodField()
    payment = serializers.SerializerMethodField()
    refund_amount = serializers.SerializerMethodField()
    queue_position = serializers.SerializerMethodField()
    estimated_wait_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id", "hospital", "hospital_name", "hospital_city", "hospital_integration_type", "hospital_integration_mode",
            "department", "department_name", "doctor", "doctor_name", "doctor_room", "appointment_date", "slot_time",
            "token_number", "queue_sequence", "booking_type", "status", "payment_state", "integration_reference",
            "authoritative_external", "external_appointment_id", "external_token_number", "external_patient_id",
            "external_doctor_id", "external_department_id", "external_booking_status", "external_hospital_id",
            "patient_display_name", "payment", "refund_amount", "queue_position",
            "estimated_wait_minutes", "consultation_started_at", "consultation_ended_at", "notes", "created_at", "updated_at",
        ]

    def get_patient_display_name(self, booking):
        name = booking.patient.display_name
        if not name or name == "QueueFree demo patient":
            return "Demo patient"
        parts = name.split()
        return parts[0] + (" " + parts[-1][0] + "." if len(parts) > 1 else "")

    def get_payment(self, booking):
        payment = booking.payments.order_by("-created_at").first()
        if not payment:
            return {"status": "not_required", "amount": "0.00", "currency": booking.hospital.currency, "simulated": True}
        return {
            "status": payment.status,
            "amount": str(payment.amount),
            "currency": payment.currency,
            "simulated": payment.simulated,
        }

    def get_refund_amount(self, booking):
        return str(sum((refund.amount for payment in booking.payments.all() for refund in payment.refunds.all()), start=0))

    def get_queue_position(self, booking):
        if booking.authoritative_external:
            return None
        if booking.status not in {Booking.Status.WAITING, Booking.Status.ARRIVED}:
            return None
        before = Booking.objects.filter(
            hospital=booking.hospital,
            doctor=booking.doctor,
            appointment_date=booking.appointment_date,
            status__in=[Booking.Status.WAITING, Booking.Status.ARRIVED, Booking.Status.SERVING],
            created_at__lt=booking.created_at,
        ).count()
        return before + 1

    def get_estimated_wait_minutes(self, booking):
        if booking.authoritative_external:
            return None
        position = self.get_queue_position(booking)
        if position is None:
            return 0
        from .services import calculate_adaptive_doctor_wait_time
        estimate = calculate_adaptive_doctor_wait_time(booking.doctor, booking.appointment_date, position)
        return estimate["estimated_wait_minutes"]


class BookingCreateSerializer(serializers.Serializer):
    hospital_id = serializers.IntegerField()
    department_id = serializers.IntegerField()
    doctor_id = serializers.IntegerField()
    date = serializers.DateField()
    slot_id = serializers.IntegerField()
    idempotency_key = serializers.CharField(max_length=120)

    def validate(self, attrs):
        if attrs["date"] < timezone.localdate():
            raise serializers.ValidationError({"date": "Appointment date cannot be in the past."})
        return attrs


class WalkInBookingSerializer(serializers.Serializer):
    patient_name = serializers.CharField(max_length=120)
    phone = serializers.CharField(max_length=20)
    age = serializers.IntegerField(required=False, allow_null=True)
    gender = serializers.CharField(max_length=16, required=False, allow_blank=True)
    department_id = serializers.IntegerField()
    doctor_id = serializers.IntegerField()
    slot_id = serializers.IntegerField(required=False, allow_null=True)
    symptoms = serializers.CharField(required=False, allow_blank=True)


class AbhaAuthInitSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=60)
    auth_mode = serializers.ChoiceField(choices=["MOBILE_OTP", "AADHAAR_OTP"], default="MOBILE_OTP")
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")


class AbhaAuthConfirmSerializer(serializers.Serializer):
    txn_id = serializers.CharField(max_length=120)
    otp = serializers.CharField(max_length=10)


class PatientRegistrationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.ChoiceField(choices=["M", "F", "O", "male", "female", "other"], required=False, default="M")
    phone = serializers.CharField(max_length=20)
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    address = serializers.CharField(max_length=300, required=False, allow_blank=True, default="")
    abha_number = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    abha_address = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")

    def validate_phone(self, value):
        digits = "".join(filter(str.isdigit, value))
        if len(digits) < 10:
            raise serializers.ValidationError("Enter a valid 10-digit mobile number.")
        return digits[-10:]


class PatientProfileDetailSerializer(serializers.ModelSerializer):
    has_abha_identity = serializers.SerializerMethodField()
    abha_identity_details = serializers.SerializerMethodField()

    class Meta:
        model = PatientProfile
        fields = [
            "id",
            "display_name",
            "phone",
            "email",
            "age",
            "gender",
            "date_of_birth",
            "address",
            "abha_id",
            "abha_address",
            "is_abha_verified",
            "preferred_language",
            "has_abha_identity",
            "abha_identity_details",
            "created_at",
        ]

    def get_has_abha_identity(self, obj):
        return hasattr(obj, "abha_identity") and obj.abha_identity is not None

    def get_abha_identity_details(self, obj):
        if hasattr(obj, "abha_identity") and obj.abha_identity:
            identity = obj.abha_identity
            return {
                "abha_number": identity.abha_number,
                "abha_address": identity.abha_address,
                "name": identity.name,
                "gender": identity.gender,
                "date_of_birth": identity.date_of_birth,
                "mobile": identity.mobile,
                "district_name": identity.district_name,
                "state_name": identity.state_name,
                "verified_at": identity.verified_at,
            }
        return None


class DemoPatientLoginSerializer(serializers.Serializer):
    abha_demo_identifier = serializers.RegexField(r"^DEMO-ABHA-[0-9]{4}-[0-9]{4}$", max_length=40)
    phone = serializers.RegexField(r"^\+[1-9][0-9]{7,14}$", max_length=16)
    whatsapp_notifications_consent = serializers.BooleanField()

    def validate_whatsapp_notifications_consent(self, value):
        if not value:
            raise serializers.ValidationError("Consent is required to continue with the demo sign-in.")
        return value


class PatientPhoneLoginSerializer(serializers.Serializer):
    phone = serializers.RegexField(r"^\+[1-9][0-9]{7,14}$", max_length=16)
    name = serializers.CharField(max_length=120, required=False, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")


class PatientSendOtpSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)

    def validate_phone(self, value):
        digits = "".join(filter(str.isdigit, value))
        if len(digits) < 10:
            raise serializers.ValidationError("Enter a valid 10-digit mobile number.")
        return digits[-10:]


class PatientVerifyOtpSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    otp = serializers.CharField(max_length=6)
    name = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")


class PatientVerifyAbhaSerializer(serializers.Serializer):
    abha_identifier = serializers.RegexField(r"^DEMO-ABHA-[0-9]{4}-[0-9]{4}$", max_length=40)
    whatsapp_notifications_consent = serializers.BooleanField(default=True)


class StaffLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    expected_role = serializers.CharField(required=False, allow_blank=True, default="")


class QueueActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["call_next", "calling", "serving", "complete", "skip", "recall", "pause", "resume", "arrived", "missed"])


class CancelSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(choices=["patient_request", "doctor_unavailable", "duplicate_payment"])


class RescheduleSerializer(serializers.Serializer):
    date = serializers.DateField()
    slot_id = serializers.IntegerField()


class NotificationLogSerializer(serializers.ModelSerializer):
    hospital_name = serializers.CharField(source="hospital.name", read_only=True, default="")

    class Meta:
        from .models import NotificationLog
        model = NotificationLog
        fields = [
            "id",
            "hospital",
            "hospital_name",
            "booking",
            "recipient_phone",
            "recipient_name",
            "channel",
            "notification_type",
            "title",
            "message",
            "status",
            "provider_name",
            "provider_reference",
            "metadata",
            "created_at",
        ]

