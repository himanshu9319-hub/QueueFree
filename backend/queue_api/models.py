import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


def default_cancellation_policy():
    return {
        "more_than_24_hours": 100,
        "between_6_and_24_hours": 75,
        "less_than_6_hours": 50,
        "no_show": 0,
        "doctor_unavailable": 100,
        "duplicate_payment": 100,
    }


class Hospital(models.Model):
    class IntegrationType(models.TextChoices):
        API = "A", "API integrated"
        WEBSITE = "B", "Website booking (Redirect)"
        QUEUEFREE = "C", "QueueFree managed (Native)"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        ONBOARDING = "onboarding", "Onboarding"
        SUSPENDED = "suspended", "Suspended"

    class IntegrationStatus(models.TextChoices):
        NOT_CONFIGURED = "NOT_CONFIGURED", "Not Configured"
        CONFIGURED = "CONFIGURED", "Configured"
        CONNECTED = "CONNECTED", "Connected"
        AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED", "Authentication Required"
        UNAVAILABLE = "UNAVAILABLE", "Unavailable"
        ERROR = "ERROR", "Error"

    name = models.CharField(max_length=180)
    slug = models.SlugField(max_length=120, blank=True, null=True, unique=True)
    integration_type = models.CharField(max_length=1, choices=IntegrationType.choices, default=IntegrationType.QUEUEFREE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    integration_status = models.CharField(max_length=32, choices=IntegrationStatus.choices, default=IntegrationStatus.NOT_CONFIGURED)
    external_hospital_code = models.CharField(max_length=40, blank=True, default="")
    integration_configured = models.BooleanField(default=False)
    api_config = models.JSONField(default=dict, blank=True)
    redirect_url = models.URLField(blank=True)
    is_demo = models.BooleanField(default=False)
    official_booking_url = models.URLField(blank=True)
    city = models.CharField(max_length=120)
    address = models.CharField(max_length=240, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    website = models.URLField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    payment_required = models.BooleanField(default=False)
    consultation_fee = models.DecimalField(max_digits=9, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="INR")
    cancellation_policy = models.JSONField(default=default_cancellation_policy)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["city", "name"]
        indexes = [
            models.Index(fields=["city", "is_active"]),
            models.Index(fields=["status", "is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.city})"

    def save(self, *args, **kwargs):
        if self.is_demo:
            # Enforce exactly one demonstration hospital across the platform
            Hospital.objects.filter(is_demo=True).exclude(pk=self.pk).update(is_demo=False)
        super().save(*args, **kwargs)

    @property
    def integration_label(self):
        return self.get_integration_type_display()

    @property
    def integration_mode(self):
        mapping = {
            self.IntegrationType.API: "api",
            self.IntegrationType.WEBSITE: "redirect",
            self.IntegrationType.QUEUEFREE: "native",
        }
        return mapping.get(self.integration_type, "native")

    @integration_mode.setter
    def integration_mode(self, mode_str):
        mapping = {
            "api": self.IntegrationType.API,
            "redirect": self.IntegrationType.WEBSITE,
            "website": self.IntegrationType.WEBSITE,
            "native": self.IntegrationType.QUEUEFREE,
            "queuefree": self.IntegrationType.QUEUEFREE,
        }
        self.integration_type = mapping.get(str(mode_str).lower(), self.IntegrationType.QUEUEFREE)


class Department(models.Model):
    hospital = models.ForeignKey(Hospital, related_name="departments", on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    code = models.SlugField(max_length=24)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["hospital", "code"], name="unique_hospital_department")]
        ordering = ["name"]

    def __str__(self):
        return f"{self.hospital.name} - {self.name}"


class Doctor(models.Model):
    hospital = models.ForeignKey(Hospital, related_name="doctors", on_delete=models.CASCADE, null=True, blank=True)
    department = models.ForeignKey(Department, related_name="doctors", on_delete=models.CASCADE)
    display_name = models.CharField(max_length=120)
    qualification = models.CharField(max_length=120, blank=True, default="MBBS, MD")
    room_number = models.CharField(max_length=40, blank=True, default="Room 101")
    average_consultation_minutes = models.PositiveSmallIntegerField(default=10)
    is_available = models.BooleanField(default=True)
    delay_minutes = models.PositiveSmallIntegerField(default=0)
    delay_reason = models.CharField(max_length=180, blank=True)
    available_weekdays = models.JSONField(default=list)

    class Meta:
        ordering = ["display_name"]
        indexes = [
            models.Index(fields=["hospital", "is_available"]),
            models.Index(fields=["department", "is_available"]),
        ]

    def __str__(self):
        hosp_name = self.hospital.name if self.hospital else (self.department.hospital.name if self.department else "Unassigned")
        return f"{self.display_name} ({self.department.name} - {hosp_name})"

    def clean(self):
        super().clean()
        if self.department and self.hospital and self.department.hospital_id != self.hospital_id:
            from django.core.exceptions import ValidationError
            raise ValidationError("Doctor hospital must match the department hospital.")

    def save(self, *args, **kwargs):
        if self.department and (not self.hospital_id or self.hospital_id != self.department.hospital_id):
            self.hospital = self.department.hospital
        super().save(*args, **kwargs)


class DoctorSchedule(models.Model):
    class DayOfWeek(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    doctor = models.ForeignKey(Doctor, related_name="schedules", on_delete=models.CASCADE)
    day_of_week = models.PositiveSmallIntegerField(choices=DayOfWeek.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    slot_duration_minutes = models.PositiveSmallIntegerField(default=15)
    slot_capacity = models.PositiveSmallIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["doctor", "day_of_week", "start_time"], name="unique_doctor_shift_start")
        ]
        ordering = ["day_of_week", "start_time"]

    def __str__(self):
        return f"{self.doctor.display_name} - {self.get_day_of_week_display()} ({self.start_time}-{self.end_time})"


class HospitalHoliday(models.Model):
    hospital = models.ForeignKey(Hospital, related_name="holidays", on_delete=models.CASCADE)
    date = models.DateField()
    reason = models.CharField(max_length=180, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["hospital", "date"], name="unique_hospital_holiday")
        ]
        ordering = ["date"]

    def __str__(self):
        return f"{self.hospital.name} Holiday on {self.date}: {self.reason}"


class DailyTokenSequence(models.Model):
    doctor = models.ForeignKey(Doctor, related_name="token_sequences", on_delete=models.CASCADE)
    appointment_date = models.DateField()
    last_sequence_number = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["doctor", "appointment_date"], name="unique_doctor_daily_sequence")
        ]
        indexes = [
            models.Index(fields=["doctor", "appointment_date"]),
        ]

    def __str__(self):
        return f"{self.doctor.display_name} - {self.appointment_date} (Seq: {self.last_sequence_number})"


class PatientProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name="patient_profile", on_delete=models.CASCADE)
    abha_demo_identifier = models.CharField(max_length=40, unique=True)
    display_name = models.CharField(max_length=120, default="QueueFree demo patient")
    phone = models.CharField(max_length=40, blank=True, db_index=True)
    email = models.EmailField(blank=True)
    age = models.PositiveSmallIntegerField(null=True, blank=True)
    gender = models.CharField(max_length=16, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    abha_id = models.CharField(max_length=40, blank=True)
    abha_address = models.CharField(max_length=120, blank=True)
    is_abha_verified = models.BooleanField(default=False)
    preferred_language = models.CharField(max_length=8, default="en")
    consent_preferences = models.JSONField(default=dict)
    external_patient_ids = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.display_name} ({self.phone or self.abha_demo_identifier})"


class ABHAAuthenticationTransaction(models.Model):
    class State(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Not Started"
        OTP_REQUESTED = "OTP_REQUESTED", "OTP Requested"
        OTP_PENDING = "OTP_PENDING", "OTP Pending"
        VERIFIED = "VERIFIED", "Verified"
        FAILED = "FAILED", "Failed"
        EXPIRED = "EXPIRED", "Expired"
        CANCELLED = "CANCELLED", "Cancelled"

    class AuthMode(models.TextChoices):
        MOBILE_OTP = "MOBILE_OTP", "Mobile OTP"
        AADHAAR_OTP = "AADHAAR_OTP", "Aadhaar OTP"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    txn_id = models.CharField(max_length=120, unique=True, db_index=True)
    abha_number = models.CharField(max_length=40, db_index=True)
    abha_address = models.CharField(max_length=120, blank=True)
    auth_mode = models.CharField(max_length=32, choices=AuthMode.choices, default=AuthMode.MOBILE_OTP)
    state = models.CharField(max_length=24, choices=State.choices, default=State.NOT_STARTED)
    otp_channel = models.CharField(max_length=32, default="MOBILE_OTP")
    masked_identifier = models.CharField(max_length=40, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    patient_profile = models.ForeignKey(PatientProfile, null=True, blank=True, on_delete=models.SET_NULL)
    profile_data = models.JSONField(default=dict, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["txn_id", "state"]),
            models.Index(fields=["abha_number", "-created_at"]),
        ]

    def __str__(self):
        return f"ABHA Txn {self.txn_id} ({self.state}) - {self.abha_number}"


class PatientABHAIdentity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient_profile = models.OneToOneField(PatientProfile, related_name="abha_identity", on_delete=models.CASCADE)
    abha_number = models.CharField(max_length=24, unique=True, db_index=True)
    abha_address = models.CharField(max_length=120, blank=True)
    name = models.CharField(max_length=180)
    gender = models.CharField(max_length=16, blank=True)
    date_of_birth = models.CharField(max_length=20, blank=True)
    mobile = models.CharField(max_length=20)
    address_line = models.TextField(blank=True)
    district_name = models.CharField(max_length=100, blank=True)
    state_name = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=12, blank=True)
    verified_at = models.DateTimeField(auto_now_add=True)
    consent_token = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} - ABHA: {self.abha_number}"


class StaffProfile(models.Model):
    class Role(models.TextChoices):
        SUPER_ADMIN = "super_admin", "Super Admin"
        ADMIN = "hospital_admin", "Hospital admin"
        DOCTOR = "doctor", "Doctor"
        RECEPTION = "reception", "Reception"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name="staff_profile", on_delete=models.CASCADE)
    hospital = models.ForeignKey(Hospital, related_name="staff", null=True, blank=True, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=Role.choices)
    doctor = models.ForeignKey(Doctor, null=True, blank=True, on_delete=models.SET_NULL)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        hospital_name = self.hospital.name if self.hospital else "Platform Wide"
        return f"{self.user.username} ({self.get_role_display()} at {hospital_name})"


class AppointmentSlot(models.Model):
    doctor = models.ForeignKey(Doctor, related_name="slots", on_delete=models.CASCADE)
    appointment_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)
    capacity = models.PositiveSmallIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["doctor", "appointment_date", "start_time"], name="unique_doctor_slot"),
            models.CheckConstraint(condition=Q(capacity__gt=0), name="slot_capacity_positive"),
        ]
        ordering = ["appointment_date", "start_time"]
        indexes = [
            models.Index(fields=["doctor", "appointment_date", "start_time"]),
        ]

    def __str__(self):
        return f"{self.doctor.display_name} - {self.appointment_date} {self.start_time}"


class QueueControl(models.Model):
    hospital = models.ForeignKey(Hospital, related_name="queue_controls", on_delete=models.CASCADE)
    doctor = models.ForeignKey(Doctor, related_name="queue_controls", null=True, blank=True, on_delete=models.CASCADE)
    appointment_date = models.DateField()
    paused = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["hospital", "doctor", "appointment_date"], name="unique_queue_control")]


class Booking(models.Model):
    class Status(models.TextChoices):
        BOOKED = "booked", "Booked"
        CONFIRMED = "confirmed", "Confirmed"
        CHECKED_IN = "checked_in", "Checked In"
        WAITING = "waiting", "Waiting"
        ARRIVED = "arrived", "Arrived"
        CALLING = "calling", "Calling"
        CALLED = "called", "Called"
        SERVING = "serving", "Serving"
        IN_CONSULTATION = "in_consultation", "In Consultation"
        COMPLETED = "completed", "Completed"
        SKIPPED = "skipped", "Skipped"
        MISSED = "missed", "Missed"
        NO_SHOW = "no_show", "No Show"
        CANCELLED = "cancelled", "Cancelled"
        EXTERNAL = "external_pending", "Awaiting hospital confirmation"

    class PaymentState(models.TextChoices):
        NOT_REQUIRED = "not_required", "Not required"
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        REFUNDED = "refunded", "Refunded"
        PARTIALLY_REFUNDED = "partially_refunded", "Partially refunded"

    class BookingType(models.TextChoices):
        ONLINE = "online", "Online"
        WALK_IN = "walk_in", "Walk-in"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital = models.ForeignKey(Hospital, related_name="bookings", on_delete=models.PROTECT)
    department = models.ForeignKey(Department, related_name="bookings", on_delete=models.PROTECT)
    doctor = models.ForeignKey(Doctor, related_name="bookings", on_delete=models.PROTECT)
    patient = models.ForeignKey(PatientProfile, related_name="bookings", on_delete=models.PROTECT)
    slot = models.ForeignKey(AppointmentSlot, related_name="bookings", on_delete=models.PROTECT)
    appointment_date = models.DateField()
    token_number = models.CharField(max_length=40)
    queue_sequence = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.WAITING)
    booking_type = models.CharField(max_length=20, choices=BookingType.choices, default=BookingType.ONLINE)
    payment_state = models.CharField(max_length=24, choices=PaymentState.choices, default=PaymentState.NOT_REQUIRED)
    integration_reference = models.CharField(max_length=120, blank=True)
    authoritative_external = models.BooleanField(default=False)
    external_appointment_id = models.CharField(max_length=80, blank=True)
    external_token_number = models.CharField(max_length=80, blank=True)
    external_patient_id = models.CharField(max_length=80, blank=True)
    external_doctor_id = models.CharField(max_length=80, blank=True)
    external_department_id = models.CharField(max_length=80, blank=True)
    external_booking_status = models.CharField(max_length=80, blank=True)
    external_hospital_id = models.CharField(max_length=80, blank=True)
    idempotency_key = models.CharField(max_length=120)
    consultation_started_at = models.DateTimeField(null=True, blank=True)
    consultation_ended_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["patient", "idempotency_key"], name="unique_patient_idempotency"),
            models.UniqueConstraint(fields=["hospital", "department", "appointment_date", "token_number"], name="unique_daily_token"),
        ]
        ordering = ["appointment_date", "slot__start_time", "token_number"]
        indexes = [
            models.Index(fields=["hospital", "appointment_date", "status"]),
            models.Index(fields=["doctor", "appointment_date", "status"]),
        ]

    def __str__(self):
        return f"Token {self.token_number} - {self.patient.display_name} ({self.status})"


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    booking = models.ForeignKey(Booking, related_name="payments", on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=9, decimal_places=2)
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    provider = models.CharField(max_length=32, default="demo")
    provider_reference = models.CharField(max_length=120, blank=True)
    simulated = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Payment {self.provider_reference} - {self.currency} {self.amount} ({self.status})"


class Refund(models.Model):
    payment = models.ForeignKey(Payment, related_name="refunds", on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=9, decimal_places=2)
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=16, default="simulated")
    reason = models.CharField(max_length=40)
    provider_reference = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Refund {self.provider_reference} - {self.currency} {self.amount} ({self.status})"


class AuditLog(models.Model):
    hospital = models.ForeignKey(Hospital, null=True, blank=True, on_delete=models.SET_NULL)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    booking = models.ForeignKey(Booking, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=64)
    metadata = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["hospital", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {self.action} by {self.actor or 'System'}"


class NotificationLog(models.Model):
    class Channel(models.TextChoices):
        SMS = "sms", "SMS"
        WHATSAPP = "whatsapp", "WhatsApp"
        EMAIL = "email", "Email"
        IN_APP = "in_app", "In-App"

    class NotificationType(models.TextChoices):
        BOOKING_CONFIRMATION = "booking_confirmation", "Booking Confirmation"
        TURN_NEAR = "turn_near", "Your Turn Is Near"
        DOCTOR_DELAY = "doctor_delay", "Doctor Delay Alert"
        CANCELLATION = "cancellation", "Cancellation Notice"
        RECALL = "recall", "Patient Recalled"

    class DeliveryStatus(models.TextChoices):
        SENT = "sent", "Sent"
        DELIVERED = "delivered", "Delivered"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hospital = models.ForeignKey(Hospital, related_name="notification_logs", on_delete=models.CASCADE, null=True, blank=True)
    booking = models.ForeignKey(Booking, related_name="notification_logs", on_delete=models.SET_NULL, null=True, blank=True)
    recipient_phone = models.CharField(max_length=20)
    recipient_name = models.CharField(max_length=120, blank=True)
    channel = models.CharField(max_length=16, choices=Channel.choices, default=Channel.SMS)
    notification_type = models.CharField(max_length=32, choices=NotificationType.choices)
    title = models.CharField(max_length=200)
    message = models.TextField()
    status = models.CharField(max_length=16, choices=DeliveryStatus.choices, default=DeliveryStatus.SENT)
    provider_name = models.CharField(max_length=40, default="composite")
    provider_reference = models.CharField(max_length=120, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient_phone", "-created_at"]),
            models.Index(fields=["hospital", "-created_at"]),
            models.Index(fields=["notification_type", "-created_at"]),
        ]

    def __str__(self):
        return f"[{self.channel.upper()}] {self.notification_type} -> {self.recipient_phone} ({self.status})"

