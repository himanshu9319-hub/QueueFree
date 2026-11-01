from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError

from .adapters import adapter_for
from .refund_policy import refund_percentage
from .models import (
    AppointmentSlot, AuditLog, Booking, DailyTokenSequence, Department,
    Doctor, DoctorSchedule, Hospital, HospitalHoliday, PatientProfile, Payment,
    QueueControl, Refund, StaffProfile
)


class Conflict(APIException):
    status_code = 409
    default_code = "conflict"
    default_detail = "The requested resource is no longer available."


class ServiceUnavailable(APIException):
    status_code = 503
    default_code = "service_unavailable"
    default_detail = "The required booking or payment service is unavailable."


def event_audit(action, booking, actor=None, metadata=None):
    AuditLog.objects.create(
        hospital=booking.hospital if booking else None,
        actor=actor,
        booking=booking,
        action=action,
        metadata=metadata or {},
    )


def get_patient(user):
    try:
        return user.patient_profile
    except Exception as exc:
        raise PermissionDenied("A patient profile is required.") from exc


def available_slots(doctor, day):
    return AppointmentSlot.objects.filter(doctor=doctor, appointment_date=day).annotate(
        active_bookings=Count(
            "bookings",
            filter=~Q(
                bookings__status__in=[Booking.Status.CANCELLED, Booking.Status.MISSED]
            ),
        )
    )


def _allocate_managed_token(hospital, department, doctor, day):
    """
    Concurrency-safe atomic daily sequential token allocation.
    Uses select_for_update() row lock on DailyTokenSequence per doctor per day.
    """
    seq, _ = DailyTokenSequence.objects.select_for_update().get_or_create(
        doctor=doctor,
        appointment_date=day,
        defaults={"last_sequence_number": 0},
    )
    seq.last_sequence_number += 1
    seq.save(update_fields=["last_sequence_number", "updated_at"])
    prefix = department.code.upper()
    return f"{prefix}-{seq.last_sequence_number:03d}", seq.last_sequence_number


# ==============================================================================
# Adaptive Wait Time Engine
# ==============================================================================

def calculate_adaptive_doctor_wait_time(doctor, appointment_day, queue_position=None):
    """
    Computes rolling average consultation duration from actual completed visits today,
    clamped to safe bounds, plus doctor delay minutes and queue position.
    """
    completed_today = Booking.objects.filter(
        doctor=doctor,
        appointment_date=appointment_day,
        status=Booking.Status.COMPLETED,
        consultation_started_at__isnull=False,
        consultation_ended_at__isnull=False,
    )

    if completed_today.count() >= 3:
        durations = [
            (b.consultation_ended_at - b.consultation_started_at).total_seconds() / 60.0
            for b in completed_today
        ]
        valid_durations = [d for d in durations if 1.0 <= d <= 90.0]
        if len(valid_durations) >= 3:
            avg_minutes = round(sum(valid_durations) / len(valid_durations), 1)
        else:
            avg_minutes = float(doctor.average_consultation_minutes)
    else:
        avg_minutes = float(doctor.average_consultation_minutes)

    ahead = max(0, (queue_position - 1)) if queue_position else 0
    estimated_wait = max(0, int(round(ahead * avg_minutes + doctor.delay_minutes)))

    return {
        "estimated_wait_minutes": estimated_wait,
        "average_consultation_minutes": avg_minutes,
        "delay_minutes": doctor.delay_minutes,
        "ahead_count": ahead,
    }


# ==============================================================================
# Token Booking Service
# ==============================================================================

@transaction.atomic
def create_booking(user, data, booking_type=Booking.BookingType.ONLINE):
    patient = PatientProfile.objects.select_for_update().get(pk=get_patient(user).pk)
    if not patient.abha_demo_identifier or patient.abha_demo_identifier.startswith("PENDING-"):
        raise Conflict("ABHA ID verification is mandatory to book an OPD appointment token and prevent unauthorized bookings.")

    existing = Booking.objects.filter(patient=patient, idempotency_key=data["idempotency_key"]).first()
    if existing:
        return existing, False

    try:
        hospital = Hospital.objects.select_for_update().get(pk=data["hospital_id"], is_active=True)
    except Hospital.DoesNotExist as exc:
        raise NotFound("Hospital was not found or is inactive.") from exc

    existing = Booking.objects.filter(patient=patient, idempotency_key=data["idempotency_key"]).first()
    if existing:
        return existing, False

    department_id = data["department_id"]
    doctor_id = data["doctor_id"]
    day = data["date"]
    if not hospital.departments.filter(pk=department_id, is_active=True).exists():
        raise ValidationError({"department_id": "Department does not belong to this hospital."})
    try:
        doctor = hospital.departments.get(pk=department_id).doctors.get(pk=doctor_id, is_available=True)
    except Exception as exc:
        raise ValidationError({"doctor_id": "Doctor is unavailable or does not belong to this department."}) from exc

    if hospital.integration_type == Hospital.IntegrationType.WEBSITE:
        raise Conflict({
            "code": "external_booking_required",
            "message": "This hospital confirms appointments on its official website; QueueFree has not booked a token.",
            "official_booking_url": hospital.official_booking_url or hospital.website or hospital.redirect_url,
        })

    # Rule: Same patient cannot book multiple appointments with the same doctor on the same date
    if Booking.objects.filter(
        patient=patient,
        doctor=doctor,
        appointment_date=day,
        status__in=[Booking.Status.WAITING, Booking.Status.ARRIVED, Booking.Status.CALLING, Booking.Status.SERVING],
    ).exists():
        raise Conflict("You already have an active appointment booked with this doctor on this date.")

    # Rule: One active token policy - patient cannot book another token until previous is completed or cancelled
    active_booking = Booking.objects.filter(
        patient=patient,
        status__in=[Booking.Status.WAITING, Booking.Status.ARRIVED, Booking.Status.CALLING, Booking.Status.SERVING, Booking.Status.EXTERNAL],
    ).select_related("doctor", "department").first()
    if active_booking:
        raise Conflict(
            f"You already have an active appointment token (#{active_booking.token_number} with Dr. {active_booking.doctor.display_name} in {active_booking.department.name}). "
            f"Per hospital policy, you can only book another token once your current consultation is completed by the doctor or cancelled."
        )

    if hospital.payment_required and not settings.DEMO_PAYMENTS_ENABLED:
        raise ServiceUnavailable("This hospital requires payment, but no payment provider is configured. No booking was created.")

    if hospital.integration_type == Hospital.IntegrationType.API:
        if not hospital.integration_configured:
            adapter = adapter_for(hospital)
        else:
            try:
                adapter = adapter_for(hospital)
            except NotImplementedError as exc:
                raise ServiceUnavailable("No authorized hospital API adapter is configured. No booking was created.") from exc
    else:
        adapter = None

    try:
        slot = AppointmentSlot.objects.select_for_update().get(
            pk=data["slot_id"], doctor=doctor, appointment_date=day
        )
    except AppointmentSlot.DoesNotExist as exc:
        raise Conflict("The selected slot is no longer available.") from exc

    active_statuses = [Booking.Status.WAITING, Booking.Status.ARRIVED, Booking.Status.CALLING, Booking.Status.SERVING, Booking.Status.EXTERNAL]
    current_count = Booking.objects.filter(slot=slot, status__in=active_statuses).count()
    if hospital.integration_type == Hospital.IntegrationType.QUEUEFREE and current_count >= slot.capacity:
        raise Conflict("This slot is no longer available. Refresh availability and choose another time.")

    if adapter:
        availability = adapter.availability(hospital, [slot])
        if not any(item["slot_id"] == slot.pk and item["available"] for item in availability):
            raise Conflict("The hospital reports that this slot is no longer available.")
        try:
            reservation = adapter.reserve(hospital, slot, data["idempotency_key"], patient=patient)
        except TypeError:
            reservation = adapter.reserve(hospital, slot, data["idempotency_key"])
        token_number = reservation["token_number"]
        queue_sequence = 1
        integration_reference = reservation["reference"]
        external_appointment_id = reservation.get("external_appointment_id") or integration_reference
        external_token_number = reservation.get("external_token_number") or token_number
        external_patient_id = reservation.get("external_patient_id", "")
        external_doctor_id = reservation.get("external_doctor_id", str(doctor.id))
        external_department_id = reservation.get("external_department_id", str(doctor.department.id))
        external_hospital_id = reservation.get("external_hospital_id", str(hospital.id))
        external_booking_status = reservation.get("external_booking_status", "CONFIRMED")
        status = reservation.get("status", Booking.Status.WAITING)
        external = True
    else:
        token_number, queue_sequence = _allocate_managed_token(hospital, doctor.department, doctor, day)
        integration_reference = ""
        external_appointment_id = ""
        external_token_number = ""
        external_patient_id = ""
        external_doctor_id = ""
        external_department_id = ""
        external_hospital_id = ""
        external_booking_status = ""
        status = Booking.Status.WAITING
        external = False

    payment_state = Booking.PaymentState.NOT_REQUIRED
    if hospital.payment_required:
        payment_state = Booking.PaymentState.PENDING

    booking = Booking.objects.create(
        hospital=hospital,
        department=doctor.department,
        doctor=doctor,
        patient=patient,
        slot=slot,
        appointment_date=day,
        token_number=token_number,
        queue_sequence=queue_sequence,
        status=status,
        booking_type=booking_type,
        payment_state=payment_state,
        integration_reference=integration_reference,
        external_appointment_id=external_appointment_id,
        external_token_number=external_token_number,
        external_patient_id=external_patient_id,
        external_doctor_id=external_doctor_id,
        external_department_id=external_department_id,
        external_hospital_id=external_hospital_id,
        external_booking_status=external_booking_status,
        authoritative_external=external,
        idempotency_key=data["idempotency_key"],
    )
    if hospital.payment_required:
        payment_status = Payment.Status.SUCCEEDED if settings.DEMO_PAYMENTS_ENABLED else Payment.Status.PENDING
        payment = Payment.objects.create(
            booking=booking,
            amount=hospital.consultation_fee,
            currency=hospital.currency,
            status=payment_status,
            provider="demo" if settings.DEMO_PAYMENTS_ENABLED else "unconfigured",
            provider_reference="DEMO-PAY-" + str(booking.pk)[:8] if settings.DEMO_PAYMENTS_ENABLED else "",
            simulated=True,
        )
        if payment.status == Payment.Status.SUCCEEDED:
            booking.payment_state = Booking.PaymentState.PAID
            booking.save(update_fields=["payment_state", "updated_at"])
    event_audit("booking.created", booking, user, {"integration_type": hospital.integration_type})
    try:
        from .notifications import dispatch_booking_confirmation
        dispatch_booking_confirmation(booking)
    except Exception as notif_err:
        logger.warning(f"Failed to dispatch booking confirmation: {notif_err}")
    return booking, True


# ==============================================================================
# Walk-in Token Engine
# ==============================================================================

@transaction.atomic
def create_walk_in_booking(staff_user, data):
    """
    Issued by Receptionist at hospital desk.
    Creates or looks up patient profile, issues sequential token,
    and automatically marks status as ARRIVED (checked-in).
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    staff = staff_for(staff_user)
    hospital = staff.hospital
    if not hospital:
        raise PermissionDenied("Staff is not assigned to a hospital.")

    dept_id = data["department_id"]
    doc_id = data["doctor_id"]
    today = timezone.localdate()

    try:
        doctor = Doctor.objects.select_for_update().get(pk=doc_id, department_id=dept_id, department__hospital=hospital)
    except Doctor.DoesNotExist:
        raise NotFound("Doctor not found in this hospital department.")

    phone = data["phone"].strip()
    clean_phone = "".join(ch for ch in phone if ch.isdigit())
    last10 = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone

    # Look up existing patient profile by mobile phone or create if new
    patient = PatientProfile.objects.filter(
        Q(phone__endswith=last10) | Q(phone=phone)
    ).first()

    if not patient:
        username = f"patient-walkin-{clean_phone}"
        patient_user, _ = User.objects.get_or_create(username=username, defaults={"first_name": data["patient_name"]})
        abha_id = f"WALKIN-ABHA-{last10[-8:] if len(last10) >= 8 else last10}"
        patient, _ = PatientProfile.objects.get_or_create(
            user=patient_user,
            defaults={
                "abha_demo_identifier": abha_id,
                "abha_id": abha_id,
                "is_abha_verified": True,
                "display_name": data["patient_name"],
                "phone": f"+91{last10}",
                "age": data.get("age"),
                "gender": data.get("gender", ""),
            },
        )

    # Rule: One active token policy - walk-in patient cannot have a concurrent active token
    active_walkin = Booking.objects.filter(
        patient=patient,
        status__in=[Booking.Status.WAITING, Booking.Status.ARRIVED, Booking.Status.CALLING, Booking.Status.SERVING, Booking.Status.EXTERNAL],
    ).select_related("doctor", "department").first()
    if active_walkin:
        raise Conflict(
            f"Patient {patient.display_name} already has an active token (#{active_walkin.token_number} with Dr. {active_walkin.doctor.display_name} in {active_walkin.department.name}). "
            f"Per hospital queue rules, a new token can only be issued after the current consultation is completed or cancelled."
        )

    # Find or allocate today's slot
    slot_id = data.get("slot_id")
    if slot_id:
        slot = get_object_or_404(AppointmentSlot, pk=slot_id, doctor=doctor, appointment_date=today)
    else:
        slot = AppointmentSlot.objects.filter(doctor=doctor, appointment_date=today).order_by("start_time").first()
        if not slot:
            slot = AppointmentSlot.objects.create(doctor=doctor, appointment_date=today, start_time=timezone.localtime().time(), capacity=50)

    token_number, queue_seq = _allocate_managed_token(hospital, doctor.department, doctor, today)

    booking = Booking.objects.create(
        hospital=hospital,
        department=doctor.department,
        doctor=doctor,
        patient=patient,
        slot=slot,
        appointment_date=today,
        token_number=token_number,
        queue_sequence=queue_seq,
        status=Booking.Status.ARRIVED,  # Physically present at reception!
        booking_type=Booking.BookingType.WALK_IN,
        payment_state=Booking.PaymentState.PAID if hospital.payment_required else Booking.PaymentState.NOT_REQUIRED,
        idempotency_key=f"walkin-{booking_seq(token_number)}-{clean_phone}-{timezone.now().timestamp()}",
        notes=data.get("symptoms", ""),
    )

    if hospital.payment_required:
        Payment.objects.create(
            booking=booking,
            amount=hospital.consultation_fee,
            currency=hospital.currency,
            status=Payment.Status.SUCCEEDED,
            provider="cash_counter",
            provider_reference=f"COUNTER-RECEIPT-{token_number}",
            simulated=False,
        )

    event_audit("booking.walk_in_issued", booking, staff_user, {"token": token_number, "counter": staff.user.username})
    try:
        from .notifications import dispatch_booking_confirmation
        dispatch_booking_confirmation(booking)
    except Exception as notif_err:
        logger.warning(f"Failed to dispatch walk-in confirmation: {notif_err}")
    return booking


def booking_seq(token):
    return token.replace("-", "").lower()


# ==============================================================================
# Grace Time & Auto No-Show Handler
# ==============================================================================

@transaction.atomic
def process_auto_no_shows(hospital, target_date=None, grace_minutes=30):
    """
    Finds WAITING patients whose slot start_time + grace_minutes has passed without check-in,
    and transitions them to MISSED.
    """
    target_date = target_date or timezone.localdate()
    now_local = timezone.localtime()

    if target_date < now_local.date():
        cutoff_time = "23:59:59"
        stale_bookings = Booking.objects.select_for_update().filter(
            hospital=hospital,
            appointment_date=target_date,
            status=Booking.Status.WAITING,
        )
    else:
        cutoff_dt = now_local - timedelta(minutes=grace_minutes)
        if cutoff_dt.date() < now_local.date():
            cutoff_time = time(0, 0, 0)
        else:
            cutoff_time = cutoff_dt.time()
        stale_bookings = Booking.objects.select_for_update().filter(
            hospital=hospital,
            appointment_date=target_date,
            status=Booking.Status.WAITING,
            slot__start_time__lt=cutoff_time,
        )

    missed_count = 0
    missed_ids = []
    for b in stale_bookings:
        b.status = Booking.Status.MISSED
        b.save(update_fields=["status", "updated_at"])
        event_audit("booking.auto_no_show", b, metadata={"grace_minutes": grace_minutes, "cutoff": str(cutoff_time)})
        missed_ids.append(str(b.pk))
        missed_count += 1

    return {"processed_count": missed_count, "missed_booking_ids": missed_ids}


# ==============================================================================
# Slot Generator Utility (from Doctor Schedules)
# ==============================================================================

@transaction.atomic
def generate_slots_for_doctor(doctor, start_date, end_date=None):
    """
    Generates AppointmentSlot entries from the doctor's weekly shift schedules.
    Skips hospital holidays.
    """
    end_date = end_date or start_date
    created_count = 0
    hospital = doctor.department.hospital

    cur = start_date
    while cur <= end_date:
        # Check hospital holiday
        if HospitalHoliday.objects.filter(hospital=hospital, date=cur).exists():
            cur += timedelta(days=1)
            continue

        weekday = cur.weekday()
        schedules = DoctorSchedule.objects.filter(doctor=doctor, day_of_week=weekday, is_active=True)

        if not schedules.exists() and (weekday in (doctor.available_weekdays or [])):
            # Default fallback schedule if none defined explicitly
            schedules = [DoctorSchedule(
                doctor=doctor,
                day_of_week=weekday,
                start_time=time(9, 0),
                end_time=time(13, 0),
                slot_duration_minutes=15,
                slot_capacity=1 if hospital.integration_type == Hospital.IntegrationType.QUEUEFREE else 4,
            )]

        for sched in schedules:
            slot_duration = timedelta(minutes=sched.slot_duration_minutes)
            slot_start_dt = datetime.combine(cur, sched.start_time)
            slot_end_dt = datetime.combine(cur, sched.end_time)

            step = slot_start_dt
            while step < slot_end_dt:
                t_start = step.time()
                t_end = (step + slot_duration).time()
                _, created = AppointmentSlot.objects.get_or_create(
                    doctor=doctor,
                    appointment_date=cur,
                    start_time=t_start,
                    defaults={
                        "end_time": t_end,
                        "capacity": sched.slot_capacity,
                    },
                )
                if created:
                    created_count += 1
                step += slot_duration

        cur += timedelta(days=1)

    return created_count


# ==============================================================================
# Cancellation & Queue Action State Transitions
# ==============================================================================

@transaction.atomic
def cancel_booking(booking, patient, reason, actor):
    booking = Booking.objects.select_for_update().select_related("hospital").get(pk=booking.pk)
    if booking.patient_id != patient.pk:
        raise PermissionDenied("You can only cancel your own booking.")
    if booking.status not in {Booking.Status.WAITING, Booking.Status.ARRIVED}:
        raise Conflict("Only a waiting or arrived booking can be cancelled.")
    if booking.authoritative_external:
        raise Conflict("This hospital owns the booking. Contact its booking service to cancel; QueueFree did not allocate the token.")

    hours = (datetime.combine(booking.appointment_date, booking.slot.start_time, tzinfo=timezone.get_current_timezone()) - timezone.now()).total_seconds() / 3600
    percentage = refund_percentage(booking.hospital.cancellation_policy, reason, hours)

    booking.status = Booking.Status.CANCELLED
    booking.save(update_fields=["status", "updated_at"])
    refund_total = Decimal("0.00")
    payment = booking.payments.filter(status=Payment.Status.SUCCEEDED).order_by("-created_at").first()
    if payment and percentage:
        previously_refunded = sum((refund.amount for refund in payment.refunds.all()), Decimal("0.00"))
        refund_total = min(payment.amount - previously_refunded, (payment.amount * percentage / 100).quantize(Decimal("0.01")))
        if refund_total > 0:
            Refund.objects.create(
                payment=payment,
                amount=refund_total,
                currency=payment.currency,
                status="simulated",
                reason=reason,
                provider_reference="DEMO-REFUND-" + str(booking.pk)[:8],
            )
            total_refunded = previously_refunded + refund_total
            booking.payment_state = Booking.PaymentState.REFUNDED if total_refunded >= payment.amount else Booking.PaymentState.PARTIALLY_REFUNDED
            booking.save(update_fields=["payment_state", "updated_at"])
    event_audit("booking.cancelled", booking, actor, {"reason": reason, "refund_amount": str(refund_total), "simulated": True})
    try:
        from .notifications import dispatch_cancellation_alert
        dispatch_cancellation_alert(booking, reason)
    except Exception as notif_err:
        logger.warning(f"Failed to dispatch cancellation alert: {notif_err}")
    return booking, refund_total, percentage


def staff_for(user):
    try:
        return user.staff_profile
    except StaffProfile.DoesNotExist as exc:
        raise PermissionDenied("A hospital staff profile is required.") from exc


@transaction.atomic
def perform_queue_action(user, booking_id, action):
    staff = staff_for(user)
    booking = Booking.objects.select_for_update().select_related("hospital", "doctor").get(pk=booking_id)
    if staff.role != StaffProfile.Role.SUPER_ADMIN and booking.hospital_id != staff.hospital_id:
        raise PermissionDenied("You cannot access bookings for another hospital.")
    if booking.authoritative_external:
        raise Conflict("The hospital system owns this queue. QueueFree cannot change its status.")
    if staff.role == StaffProfile.Role.DOCTOR and staff.doctor_id != booking.doctor_id:
        raise PermissionDenied("Doctors can only act on their assigned patients.")
        
    now = timezone.now()
    if action in {"pause", "resume"}:
        QueueControl.objects.update_or_create(
            hospital=booking.hospital,
            doctor=booking.doctor,
            appointment_date=booking.appointment_date,
            defaults={"paused": action == "pause"},
        )
        event_audit("queue." + action, booking, user)
        return booking

    if action == "call_next":
        # 1. Complete currently serving patient if any
        current = Booking.objects.select_for_update().filter(
            hospital=booking.hospital, doctor=booking.doctor, appointment_date=booking.appointment_date,
            status__in=[Booking.Status.CALLING, Booking.Status.SERVING],
        ).first()
        if current:
            current.status = Booking.Status.COMPLETED
            current.consultation_ended_at = now
            current.save(update_fields=["status", "consultation_ended_at", "updated_at"])

        # 2. Pick next in line: Prioritize ARRIVED patients over not-yet-arrived WAITING patients
        next_booking = Booking.objects.select_for_update().filter(
            hospital=booking.hospital, doctor=booking.doctor, appointment_date=booking.appointment_date,
            status=Booking.Status.ARRIVED,
        ).order_by("queue_sequence", "created_at").first()

        if not next_booking:
            next_booking = Booking.objects.select_for_update().filter(
                hospital=booking.hospital, doctor=booking.doctor, appointment_date=booking.appointment_date,
                status=Booking.Status.WAITING,
            ).order_by("queue_sequence", "created_at").first()

        if next_booking:
            next_booking.status = Booking.Status.SERVING
            next_booking.consultation_started_at = now
            next_booking.save(update_fields=["status", "consultation_started_at", "updated_at"])
            booking = next_booking

    elif action == "calling":
        booking.status = Booking.Status.CALLING
    elif action == "serving":
        booking.status = Booking.Status.SERVING
        if not booking.consultation_started_at:
            booking.consultation_started_at = now
    elif action == "complete":
        booking.status = Booking.Status.COMPLETED
        booking.consultation_ended_at = now
    elif action == "skip":
        booking.status = Booking.Status.SKIPPED
    elif action == "recall":
        # Recalls skipped patient back into ARRIVED queue
        booking.status = Booking.Status.ARRIVED
        try:
            from .notifications import dispatch_recall_alert
            dispatch_recall_alert(booking)
        except Exception as notif_err:
            logger.warning(f"Failed to dispatch recall alert: {notif_err}")
    elif action == "arrived":
        booking.status = Booking.Status.ARRIVED
    elif action == "missed":
        booking.status = Booking.Status.MISSED

    booking.save(update_fields=["status", "consultation_started_at", "consultation_ended_at", "updated_at"])
    event_audit("queue." + action, booking, user)

    # Automatically check if any active patients ahead are now <= 3 in line and notify them
    if action in {"call_next", "serving", "complete", "skip", "recall", "arrived", "missed"}:
        try:
            from .notifications import check_and_dispatch_turn_near_alerts
            check_and_dispatch_turn_near_alerts(booking.hospital, booking.doctor, booking.appointment_date)
        except Exception as notif_err:
            logger.warning(f"Failed to check turn-near alerts: {notif_err}")

    return booking
