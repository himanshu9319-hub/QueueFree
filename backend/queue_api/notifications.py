"""
QueueFree Notification Service & Swappable Provider Abstraction.
Supports SMS, WhatsApp, Email, and In-App alert notifications with provider swapping,
database auditing, and mock capabilities for testing.
"""

import logging
import uuid
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger("queuefree.notifications")


class BaseNotificationProvider(ABC):
    """Abstract notification provider interface."""

    @abstractmethod
    def send(
        self,
        recipient_phone: str,
        title: str,
        message: str,
        notification_type: str,
        channel: str = "sms",
        recipient_name: str = "",
        hospital: Any = None,
        booking: Any = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Send a notification and return delivery status."""
        pass


class ConsoleNotificationProvider(BaseNotificationProvider):
    """Outputs notifications to application logger / terminal."""

    def send(
        self,
        recipient_phone: str,
        title: str,
        message: str,
        notification_type: str,
        channel: str = "sms",
        recipient_name: str = "",
        hospital: Any = None,
        booking: Any = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        logger.info(
            f"[NOTIF-{channel.upper()}] To: {recipient_phone} ({recipient_name}) | "
            f"Type: {notification_type} | Title: {title} | Body: {message}"
        )
        return {
            "status": "sent",
            "provider": "console",
            "reference": f"console-{uuid.uuid4().hex[:8]}",
        }


class MockNotificationProvider(BaseNotificationProvider):
    """In-memory notification recorder for unit and integration testing."""

    sent_messages: List[Dict[str, Any]] = []

    @classmethod
    def reset(cls):
        cls.sent_messages = []

    def send(
        self,
        recipient_phone: str,
        title: str,
        message: str,
        notification_type: str,
        channel: str = "sms",
        recipient_name: str = "",
        hospital: Any = None,
        booking: Any = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        record = {
            "recipient_phone": recipient_phone,
            "recipient_name": recipient_name,
            "title": title,
            "message": message,
            "notification_type": notification_type,
            "channel": channel,
            "hospital_id": getattr(hospital, "id", None),
            "booking_id": getattr(booking, "id", None),
            "metadata": metadata or {},
            "sent_at": timezone.now().isoformat(),
            "status": "delivered",
            "reference": f"mock-{uuid.uuid4().hex[:8]}",
        }
        self.__class__.sent_messages.append(record)
        return {
            "status": "delivered",
            "provider": "mock",
            "reference": record["reference"],
        }


class DatabaseNotificationProvider(BaseNotificationProvider):
    """Persists notification records directly into the NotificationLog model."""

    def send(
        self,
        recipient_phone: str,
        title: str,
        message: str,
        notification_type: str,
        channel: str = "sms",
        recipient_name: str = "",
        hospital: Any = None,
        booking: Any = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        from .models import NotificationLog

        ref = f"db-{uuid.uuid4().hex[:10]}"
        log_entry = NotificationLog.objects.create(
            hospital=hospital,
            booking=booking,
            recipient_phone=recipient_phone,
            recipient_name=recipient_name or "",
            channel=channel,
            notification_type=notification_type,
            title=title,
            message=message,
            status=NotificationLog.DeliveryStatus.DELIVERED,
            provider_name="database",
            provider_reference=ref,
            metadata=metadata or {},
        )
        return {
            "status": "delivered",
            "provider": "database",
            "reference": ref,
            "log_id": str(log_entry.id),
        }


class CompositeNotificationProvider(BaseNotificationProvider):
    """Dispatches to database auditing AND console logging simultaneously."""

    def __init__(self):
        self.db_provider = DatabaseNotificationProvider()
        self.console_provider = ConsoleNotificationProvider()

    def send(
        self,
        recipient_phone: str,
        title: str,
        message: str,
        notification_type: str,
        channel: str = "sms",
        recipient_name: str = "",
        hospital: Any = None,
        booking: Any = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        self.console_provider.send(
            recipient_phone=recipient_phone,
            title=title,
            message=message,
            notification_type=notification_type,
            channel=channel,
            recipient_name=recipient_name,
            hospital=hospital,
            booking=booking,
            metadata=metadata,
        )
        return self.db_provider.send(
            recipient_phone=recipient_phone,
            title=title,
            message=message,
            notification_type=notification_type,
            channel=channel,
            recipient_name=recipient_name,
            hospital=hospital,
            booking=booking,
            metadata=metadata,
        )


def get_notification_provider() -> BaseNotificationProvider:
    """Factory returns configured provider instance based on settings."""
    provider_type = getattr(settings, "NOTIFICATION_PROVIDER", "composite").lower()
    if provider_type == "mock":
        return MockNotificationProvider()
    elif provider_type == "console":
        return ConsoleNotificationProvider()
    elif provider_type == "database":
        return DatabaseNotificationProvider()
    return CompositeNotificationProvider()


# ==============================================================================
# Domain Notification Dispatchers
# ==============================================================================

def dispatch_booking_confirmation(booking) -> Dict[str, Any]:
    """Sends immediate confirmation when a token is booked online or at reception."""
    provider = get_notification_provider()
    patient = booking.patient
    phone = patient.phone
    if not phone:
        return {"status": "skipped", "reason": "no_phone"}

    slot_time = booking.slot.start_time.strftime("%I:%M %p") if booking.slot else "Open Slot"
    title = f"Token #{booking.token_number} Confirmed"
    message = (
        f"QueueFree: Your Token #{booking.token_number} is confirmed for {booking.doctor.display_name} "
        f"({booking.department.name}) at {booking.hospital.name} on {booking.appointment_date}. "
        f"Slot: {slot_time}. Room: {booking.doctor.room_number}. "
        f"Track live: /track?booking={booking.id}"
    )

    return provider.send(
        recipient_phone=phone,
        recipient_name=patient.display_name,
        title=title,
        message=message,
        notification_type="booking_confirmation",
        channel="sms",
        hospital=booking.hospital,
        booking=booking,
        metadata={
            "token_number": booking.token_number,
            "doctor": booking.doctor.display_name,
            "appointment_date": str(booking.appointment_date),
            "slot": slot_time,
        },
    )


def dispatch_turn_near_alert(booking, queue_position: int, eta_minutes: int) -> Dict[str, Any]:
    """Alerts patient when their queue position is <= 3."""
    from .models import NotificationLog

    # Duplicate check: don't spam if already sent for this booking
    already_sent = NotificationLog.objects.filter(
        booking=booking,
        notification_type=NotificationLog.NotificationType.TURN_NEAR,
    ).exists()
    if already_sent:
        return {"status": "skipped", "reason": "already_notified"}

    provider = get_notification_provider()
    patient = booking.patient
    phone = patient.phone
    if not phone:
        return {"status": "skipped", "reason": "no_phone"}

    title = f"Your Turn Is Near! (#{queue_position} in line)"
    message = (
        f"QueueFree Alert: You are #{queue_position} in line for {booking.doctor.display_name}. "
        f"Token #{booking.token_number}. Estimated wait: ~{eta_minutes} mins. "
        f"Please proceed to {booking.doctor.room_number} waiting area now."
    )

    return provider.send(
        recipient_phone=phone,
        recipient_name=patient.display_name,
        title=title,
        message=message,
        notification_type="turn_near",
        channel="sms",
        hospital=booking.hospital,
        booking=booking,
        metadata={
            "queue_position": queue_position,
            "eta_minutes": eta_minutes,
            "token_number": booking.token_number,
            "room_number": booking.doctor.room_number,
        },
    )


def dispatch_doctor_delay(doctor, delay_minutes: int, reason: str = "", affected_bookings: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
    """Broadcasts delay alerts to all waiting and arrived patients for this doctor today."""
    from .models import Booking

    today = timezone.localdate()
    if affected_bookings is None:
        affected_bookings = list(
            Booking.objects.filter(
                doctor=doctor,
                appointment_date=today,
                status__in=[Booking.Status.WAITING, Booking.Status.ARRIVED],
            ).select_related("patient", "hospital", "slot")
        )

    provider = get_notification_provider()
    results = []
    title = f"Doctor Schedule Update: +{delay_minutes}m Delay"
    reason_text = f" due to {reason}" if reason else ""

    for booking in affected_bookings:
        phone = booking.patient.phone
        if not phone:
            continue
        message = (
            f"QueueFree Update: Dr. {doctor.display_name} has an emergency delay of ~{delay_minutes} mins{reason_text}. "
            f"Your Token #{booking.token_number} estimated consultation time has been adjusted. "
            f"Please plan your arrival accordingly."
        )
        res = provider.send(
            recipient_phone=phone,
            recipient_name=booking.patient.display_name,
            title=title,
            message=message,
            notification_type="doctor_delay",
            channel="sms",
            hospital=booking.hospital,
            booking=booking,
            metadata={
                "delay_minutes": delay_minutes,
                "reason": reason,
                "doctor_id": doctor.id,
                "token_number": booking.token_number,
            },
        )
        results.append(res)

    return results


def dispatch_cancellation_alert(booking, reason: str = "") -> Dict[str, Any]:
    """Alerts patient that their appointment has been cancelled."""
    provider = get_notification_provider()
    patient = booking.patient
    phone = patient.phone
    if not phone:
        return {"status": "skipped", "reason": "no_phone"}

    title = f"Token #{booking.token_number} Cancelled"
    reason_text = f" Reason: {reason}." if reason else ""
    message = (
        f"QueueFree: Your appointment with {booking.doctor.display_name} on {booking.appointment_date} "
        f"(Token #{booking.token_number}) has been cancelled.{reason_text}"
    )

    return provider.send(
        recipient_phone=phone,
        recipient_name=patient.display_name,
        title=title,
        message=message,
        notification_type="cancellation",
        channel="sms",
        hospital=booking.hospital,
        booking=booking,
        metadata={"reason": reason, "token_number": booking.token_number},
    )


def dispatch_recall_alert(booking) -> Dict[str, Any]:
    """Alerts a skipped patient who has been recalled to the room."""
    provider = get_notification_provider()
    patient = booking.patient
    phone = patient.phone
    if not phone:
        return {"status": "skipped", "reason": "no_phone"}

    title = f"Token #{booking.token_number} Recalled!"
    message = (
        f"QueueFree Alert: Dr. {booking.doctor.display_name} has recalled your Token #{booking.token_number}. "
        f"Please enter {booking.doctor.room_number} immediately."
    )

    return provider.send(
        recipient_phone=phone,
        recipient_name=patient.display_name,
        title=title,
        message=message,
        notification_type="recall",
        channel="sms",
        hospital=booking.hospital,
        booking=booking,
        metadata={"token_number": booking.token_number, "room_number": booking.doctor.room_number},
    )


def check_and_dispatch_turn_near_alerts(hospital, doctor, appointment_date) -> List[Dict[str, Any]]:
    """
    Evaluates current queue order for doctor on date.
    Finds patients at position <= 3 and dispatches turn-near notifications.
    """
    from .models import Booking
    from .services import calculate_adaptive_doctor_wait_time

    # Active queue candidates ordered by sequence
    candidates = list(
        Booking.objects.filter(
            hospital=hospital,
            doctor=doctor,
            appointment_date=appointment_date,
            status__in=[Booking.Status.ARRIVED, Booking.Status.WAITING],
        ).select_related("patient", "hospital", "doctor", "slot").order_by("queue_sequence", "created_at")
    )

    results = []
    # Position in line is index + 1 (1st waiting patient is next)
    for idx, booking in enumerate(candidates):
        position = idx + 1
        if position <= 3:
            wait_info = calculate_adaptive_doctor_wait_time(doctor, appointment_date, queue_position=position)
            eta_mins = wait_info.get("estimated_wait_minutes", position * 10)
            res = dispatch_turn_near_alert(booking, queue_position=position, eta_minutes=eta_mins)
            if res.get("status") not in ("skipped",):
                results.append(res)

    return results
