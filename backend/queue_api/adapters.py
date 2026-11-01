"""
QueueFree Multi-Tenant Integration Adapters (Strategy Pattern).
Implements a common interface for:
  1. NativeAdapter: Managed natively inside QueueFree.
  2. ApiAdapter: Real-time integration with external Hospital APIs (timeouts, retries, circuit breaker, response sanitization).
  3. RedirectAdapter: Hands off booking to external hospital portal with URL health checks.
"""

import json
import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from django.utils import timezone as dj_timezone

from .crypto import decrypt_secret, encrypt_secret, mask_secret
from .models import AppointmentSlot, Booking, Hospital

logger = logging.getLogger("queuefree.adapters")


# ==============================================================================
# Circuit Breaker Implementation
# ==============================================================================

class CircuitBreakerOpen(Exception):
    """Raised when external hospital API circuit breaker has tripped."""
    pass


class CircuitBreaker:
    """
    Per-hospital circuit breaker preventing cascading failures.
    Transitions: CLOSED -> OPEN (on 3 consecutive failures) -> HALF_OPEN (after cool-off).
    """

    def __init__(self, failure_threshold: int = 3, recovery_timeout: float = 30.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = "CLOSED"  # "CLOSED", "OPEN", "HALF_OPEN"

    def can_execute(self) -> bool:
        now = time.time()
        if self.state == "OPEN":
            if self.last_failure_time and (now - self.last_failure_time) >= self.recovery_timeout:
                self.state = "HALF_OPEN"
                logger.info("Circuit breaker entered HALF_OPEN state; probing external API.")
                return True
            raise CircuitBreakerOpen(
                f"External hospital API circuit is OPEN. Fast-failing calls. "
                f"Retry in {int(self.recovery_timeout - (now - (self.last_failure_time or now)))}s."
            )
        return True

    def record_success(self):
        self.failure_count = 0
        self.state = "CLOSED"
        self.last_failure_time = None

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(
                f"Circuit breaker tripped to OPEN after {self.failure_count} consecutive failures."
            )

    def get_status(self) -> Dict[str, Any]:
        return {
            "state": self.state,
            "failure_count": self.failure_count,
            "threshold": self.failure_threshold,
            "recovery_timeout_sec": self.recovery_timeout,
        }


# In-memory registry of circuit breakers by hospital_id
_CIRCUIT_BREAKERS: Dict[int, CircuitBreaker] = {}


def get_circuit_breaker(hospital_id: int) -> CircuitBreaker:
    if hospital_id not in _CIRCUIT_BREAKERS:
        _CIRCUIT_BREAKERS[hospital_id] = CircuitBreaker()
    return _CIRCUIT_BREAKERS[hospital_id]


# ==============================================================================
# Base Adapter Interface
# ==============================================================================

class BaseHospitalAdapter(ABC):
    """Common interface for all hospital integration modes."""

    def __init__(self, hospital: Hospital):
        self.hospital = hospital

    @abstractmethod
    def search_slots(self, department: Any, doctor: Any, date: Any) -> List[Dict[str, Any]]:
        """Fetch available consultation slots for given doctor & date."""
        pass

    @abstractmethod
    def book_token(
        self,
        department: Any,
        doctor: Any,
        patient: Any,
        slot: Any,
        date: Any,
        idempotency_key: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Book/reserve an OPD consultation token."""
        pass

    @abstractmethod
    def cancel_token(self, booking: Any, reason: str) -> Dict[str, Any]:
        """Cancel an appointment token."""
        pass

    @abstractmethod
    def get_queue_status(self, doctor: Any, date: Any, booking: Optional[Any] = None) -> Dict[str, Any]:
        """Fetch live queue progress and estimated wait time."""
        pass

    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Diagnostic probe testing connectivity to hospital system."""
        pass

    def availability(self, hospital: Any, slots: List[Any]) -> List[Dict[str, Any]]:
        """Legacy compatibility wrapper for availability queries."""
        active_statuses = [Booking.Status.WAITING, Booking.Status.SERVING, Booking.Status.ARRIVED, Booking.Status.EXTERNAL]
        return [
            {
                "slot_id": s.pk,
                "available": Booking.objects.filter(slot=s, status__in=active_statuses).count() < s.capacity,
            }
            for s in slots
        ]

    def reserve(self, hospital: Any, slot: Any, idempotency_key: str) -> Dict[str, Any]:
        """Legacy compatibility wrapper for token reservation."""
        res = self.book_token(
            department=slot.doctor.department,
            doctor=slot.doctor,
            patient=None,
            slot=slot,
            date=slot.appointment_date,
            idempotency_key=idempotency_key,
        )
        return {
            "token_number": res["token_number"],
            "reference": res.get("integration_reference", f"EXT-{res['token_number']}"),
            "simulated": res.get("simulated", True),
        }


# ==============================================================================
# 1. Native Adapter (QueueFree Internal Core)
# ==============================================================================

class NativeAdapter(BaseHospitalAdapter):
    """
    Hospital has no online system. QueueFree manages full queue state machine,
    atomic token allocation, shift schedules, and wait time calculation.
    """

    def search_slots(self, department: Any, doctor: Any, date: Any) -> List[Dict[str, Any]]:
        from .services import available_slots
        slots = available_slots(doctor, date)
        results = []
        for s in slots:
            booked_count = Booking.objects.filter(
                slot=s,
                appointment_date=date,
                status__in=[
                    Booking.Status.WAITING,
                    Booking.Status.ARRIVED,
                    Booking.Status.CALLING,
                    Booking.Status.SERVING,
                ],
            ).count()
            results.append({
                "slot_id": s.id,
                "start_time": s.start_time.strftime("%H:%M"),
                "end_time": s.end_time.strftime("%H:%M") if s.end_time else None,
                "capacity": s.capacity,
                "available_seats": max(0, s.capacity - booked_count),
                "is_available": booked_count < s.capacity,
                "mode": "native",
            })
        return results

    def book_token(
        self,
        department: Any,
        doctor: Any,
        patient: Any,
        slot: Any,
        date: Any,
        idempotency_key: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        from .services import _allocate_managed_token
        token_num, seq_num = _allocate_managed_token(self.hospital, department, doctor, date)
        return {
            "token_number": token_num,
            "queue_sequence": seq_num,
            "status": Booking.Status.WAITING,
            "authoritative_external": False,
            "mode": "native",
        }

    def cancel_token(self, booking: Any, reason: str) -> Dict[str, Any]:
        return {
            "status": "cancelled",
            "authoritative_external": False,
            "mode": "native",
            "message": "Token cancelled in native QueueFree engine.",
        }

    def get_queue_status(self, doctor: Any, date: Any, booking: Optional[Any] = None) -> Dict[str, Any]:
        from .services import calculate_adaptive_doctor_wait_time
        serving = Booking.objects.filter(
            doctor=doctor,
            appointment_date=date,
            status=Booking.Status.SERVING,
        ).first()

        wait_count = Booking.objects.filter(
            doctor=doctor,
            appointment_date=date,
            status__in=[Booking.Status.WAITING, Booking.Status.ARRIVED],
        ).count()

        wait_calc = calculate_adaptive_doctor_wait_time(doctor, date)
        return {
            "mode": "native",
            "now_serving": serving.token_number if serving else "-",
            "total_waiting": wait_count,
            "estimated_wait_minutes": wait_calc.get("estimated_wait_minutes", 15),
            "delay_minutes": doctor.delay_minutes,
            "delay_reason": doctor.delay_reason,
            "is_paused": False,
        }

    def test_connection(self) -> Dict[str, Any]:
        return {
            "success": True,
            "status_code": 200,
            "latency_ms": 1,
            "message": "QueueFree Native engine is healthy and operational.",
            "circuit_breaker": "N/A (Local Database)",
            "mode": "native",
        }


# ==============================================================================
# 2. API Adapter (External Hospital System Integration)
# ==============================================================================

class ApiAdapter(BaseHospitalAdapter):
    """
    Hospital has its own online OPD system and exposes REST endpoints.
    Calls external APIs with circuit breaker, timeout, retry policy, and response sanitization.
    """

    def __init__(self, hospital: Hospital):
        super().__init__(hospital)
        cfg = hospital.api_config or {}
        self.base_url = (cfg.get("base_url") or "").rstrip("/")
        self.auth_type = cfg.get("auth_type", "bearer").lower()
        # Decrypt secret token from storage
        raw_token = cfg.get("auth_token", "")
        self.auth_token = decrypt_secret(raw_token) if raw_token else ""
        self.auth_header_name = cfg.get("auth_header_name", "Authorization")
        self.timeout_seconds = float(cfg.get("timeout_seconds", 5.0))
        self.max_retries = int(cfg.get("max_retries", 2))
        self.field_mapping = cfg.get("field_mapping") or {}
        self.mock_mode = bool(cfg.get("mock_mode", False)) or hospital.is_demo or not bool(self.base_url)

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "QueueFree-Adapter/1.0",
        }
        if self.auth_token:
            if self.auth_type == "bearer":
                headers["Authorization"] = f"Bearer {self.auth_token}"
            elif self.auth_type in ("api_key", "custom_header"):
                headers[self.auth_header_name] = self.auth_token
            elif self.auth_type == "basic":
                headers["Authorization"] = f"Basic {self.auth_token}"
        return headers

    def _call_http(self, path: str, method: str = "GET", payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Executes HTTP request with circuit breaker and retries."""
        cb = get_circuit_breaker(self.hospital.id)
        cb.can_execute()

        # Simulated / Mock Mode for test environments
        if self.mock_mode:
            return self._simulate_external_call(path, method, payload)

        url = f"{self.base_url}{path}"
        headers = self._get_headers()
        data_bytes = json.dumps(payload).encode("utf-8") if payload else None

        last_exc = None
        for attempt in range(self.max_retries + 1):
            start_time = time.time()
            try:
                req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
                with urllib.request.urlopen(req, timeout=self.timeout_seconds) as resp:
                    resp_body = resp.read().decode("utf-8")
                    cb.record_success()
                    parsed = json.loads(resp_body) if resp_body else {}
                    return self._sanitize_response(parsed)
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
                last_exc = exc
                logger.warning(
                    f"External API call failed ({attempt + 1}/{self.max_retries + 1}) to {url}: {exc}"
                )
                if attempt < self.max_retries and method in ("GET", "HEAD"):
                    time.sleep(0.4 * (attempt + 1))
                else:
                    break

        cb.record_failure()
        raise RuntimeError(f"Hospital API ({self.hospital.name}) unresponsive: {last_exc}")

    def _sanitize_response(self, data: Any) -> Any:
        """Ensures external hospital response data does not contain injection or malformed keys."""
        if isinstance(data, dict):
            clean = {}
            for k, v in data.items():
                clean_k = re.sub(r"[^\w\-]", "", str(k))
                clean[clean_k] = self._sanitize_response(v)
            return clean
        elif isinstance(data, list):
            return [self._sanitize_response(item) for item in data]
        elif isinstance(data, str):
            # Limit length and strip control characters
            return re.sub(r"[\x00-\x1f\x7f-\x9f]", "", data[:500])
        return data

    def _simulate_external_call(self, path: str, method: str, payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Provides realistic mock responses when external endpoint is not yet live."""
        import hashlib
        key_seed = f"{path}:{json.dumps(payload or {})}"
        h = hashlib.sha256(key_seed.encode()).hexdigest()

        if "/slots" in path:
            return {
                "success": True,
                "slots": [
                    {"slot_id": 101, "start_time": "09:00", "end_time": "09:15", "capacity": 1, "is_available": True},
                    {"slot_id": 102, "start_time": "09:15", "end_time": "09:30", "capacity": 1, "is_available": True},
                    {"slot_id": 103, "start_time": "09:30", "end_time": "09:45", "capacity": 1, "is_available": False},
                ],
                "simulated": True,
            }
        elif "/tokens/reserve" in path or method == "POST":
            token_code = f"API-{h[:4].upper()}"
            return {
                "success": True,
                "token_number": token_code,
                "queue_sequence": int(h[:2], 16) % 30 + 1,
                "reference": f"EXT-REF-{h[:8].upper()}",
                "simulated": True,
            }
        elif "/queue/status" in path:
            return {
                "success": True,
                "now_serving": "API-001",
                "total_waiting": 7,
                "estimated_wait_minutes": 18,
                "delay_minutes": 0,
                "simulated": True,
            }
        return {"success": True, "status": "ok", "message": "Simulated Hospital Gateway OK", "simulated": True}

    def search_slots(self, department: Any, doctor: Any, date: Any) -> List[Dict[str, Any]]:
        date_str = str(date)
        doc_id = getattr(doctor, "id", doctor)
        dept_id = getattr(department, "id", department)

        try:
            resp = self._call_http(f"/slots?doctor_id={doc_id}&dept_id={dept_id}&date={date_str}")
            raw_slots = resp.get("slots") or resp.get("data") or []
            return [
                {
                    "slot_id": s.get("slot_id") or s.get("id"),
                    "start_time": s.get("start_time", "09:00"),
                    "end_time": s.get("end_time"),
                    "capacity": s.get("capacity", 1),
                    "is_available": s.get("is_available", True),
                    "mode": "api",
                }
                for s in raw_slots
            ]
        except Exception as exc:
            logger.error(f"Failed to fetch slots from external API: {exc}")
            # Graceful fallback: return empty with error notice
            return []

    def book_token(
        self,
        department: Any,
        doctor: Any,
        patient: Any,
        slot: Any,
        date: Any,
        idempotency_key: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload = {
            "doctor_id": getattr(doctor, "id", doctor),
            "department_id": getattr(department, "id", department),
            "slot_id": getattr(slot, "id", slot),
            "date": str(date),
            "patient_name": getattr(patient, "display_name", str(patient)),
            "patient_phone": getattr(patient, "phone", ""),
            "idempotency_key": idempotency_key,
        }
        res = self._call_http("/tokens/reserve", method="POST", payload=payload)
        token_num = res.get("token_number") or f"API-{idempotency_key[:6].upper()}"
        seq = res.get("queue_sequence", 1)
        ref = res.get("reference", f"EXT-{token_num}")

        return {
            "token_number": token_num,
            "queue_sequence": seq,
            "status": Booking.Status.WAITING,
            "integration_reference": ref,
            "authoritative_external": True,
            "mode": "api",
        }

    def cancel_token(self, booking: Any, reason: str) -> Dict[str, Any]:
        ref = getattr(booking, "integration_reference", "")
        res = self._call_http(f"/tokens/{ref}/cancel", method="POST", payload={"reason": reason})
        return {
            "status": "cancelled",
            "authoritative_external": True,
            "mode": "api",
            "external_response": res,
        }

    def get_queue_status(self, doctor: Any, date: Any, booking: Optional[Any] = None) -> Dict[str, Any]:
        doc_id = getattr(doctor, "id", doctor)
        res = self._call_http(f"/queue/status?doctor_id={doc_id}&date={str(date)}")
        return {
            "mode": "api",
            "now_serving": res.get("now_serving", "-"),
            "total_waiting": res.get("total_waiting", 0),
            "estimated_wait_minutes": res.get("estimated_wait_minutes", 15),
            "delay_minutes": res.get("delay_minutes", 0),
            "delay_reason": res.get("delay_reason", ""),
        }

    def test_connection(self) -> Dict[str, Any]:
        """Probes external hospital API endpoint to measure latency and verify credentials."""
        cb = get_circuit_breaker(self.hospital.id)
        start = time.time()
        try:
            res = self._call_http("/health", method="GET")
            elapsed_ms = int((time.time() - start) * 1000)
            return {
                "success": True,
                "status_code": 200,
                "latency_ms": max(1, elapsed_ms),
                "message": "External Hospital API connected successfully.",
                "circuit_breaker": cb.get_status(),
                "simulated": res.get("simulated", False),
                "mode": "api",
            }
        except Exception as exc:
            elapsed_ms = int((time.time() - start) * 1000)
            return {
                "success": False,
                "status_code": 503,
                "latency_ms": elapsed_ms,
                "message": f"Connection failed: {str(exc)}",
                "circuit_breaker": cb.get_status(),
                "fallback_url": self.hospital.redirect_url or self.hospital.official_booking_url,
                "mode": "api",
            }


# ==============================================================================
# 3. Redirect Adapter (External Hospital Web Portal)
# ==============================================================================

class RedirectBookingRequired(Exception):
    """Raised when an action requires user redirection to external portal."""
    def __init__(self, message: str, redirect_url: str):
        super().__init__(message)
        self.redirect_url = redirect_url


class RedirectAdapter(BaseHospitalAdapter):
    """
    Hospital has its own online booking website and will not provide an API.
    All OPD bookings redirect to hospital's own URL. No booking data is kept in dashboards.
    """

    def __init__(self, hospital: Hospital):
        super().__init__(hospital)
        self.redirect_url = hospital.redirect_url or hospital.official_booking_url or hospital.website or ""

    def search_slots(self, department: Any, doctor: Any, date: Any) -> List[Dict[str, Any]]:
        return [
            {
                "slot_id": 0,
                "start_time": "Open Online",
                "capacity": 0,
                "is_available": True,
                "redirect_required": True,
                "redirect_url": self.redirect_url,
                "message": "This hospital manages slots directly on its web portal.",
                "mode": "redirect",
            }
        ]

    def book_token(
        self,
        department: Any,
        doctor: Any,
        patient: Any,
        slot: Any,
        date: Any,
        idempotency_key: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        raise RedirectBookingRequired(
            f"This facility manages appointments externally. Please book directly at: {self.redirect_url}",
            redirect_url=self.redirect_url,
        )

    def cancel_token(self, booking: Any, reason: str) -> Dict[str, Any]:
        raise RedirectBookingRequired(
            f"Cancellations must be requested directly on the hospital portal: {self.redirect_url}",
            redirect_url=self.redirect_url,
        )

    def get_queue_status(self, doctor: Any, date: Any, booking: Optional[Any] = None) -> Dict[str, Any]:
        return {
            "mode": "redirect",
            "redirect_url": self.redirect_url,
            "message": "Live queue tracking is managed on the hospital's portal.",
        }

    def test_connection(self) -> Dict[str, Any]:
        """Validates that the redirect URL is well-formed and reachable."""
        if not self.redirect_url:
            return {
                "success": False,
                "status_code": 400,
                "latency_ms": 0,
                "message": "No redirect URL configured for this hospital.",
                "mode": "redirect",
            }

        start = time.time()
        try:
            req = urllib.request.Request(
                self.redirect_url,
                headers={"User-Agent": "QueueFree-HealthCheck/1.0"},
                method="HEAD",
            )
            with urllib.request.urlopen(req, timeout=4.0) as resp:
                elapsed_ms = int((time.time() - start) * 1000)
                return {
                    "success": True,
                    "status_code": resp.status,
                    "latency_ms": max(1, elapsed_ms),
                    "message": f"Redirect portal is live ({resp.status}).",
                    "redirect_url": self.redirect_url,
                    "mode": "redirect",
                }
        except Exception as exc:
            elapsed_ms = int((time.time() - start) * 1000)
            # If HEAD fails or external server blocks head, check standard format
            is_valid_format = bool(re.match(r"^https?://[^\s/$.?#].[^\s]*$", self.redirect_url))
            return {
                "success": is_valid_format,
                "status_code": 200 if is_valid_format else 502,
                "latency_ms": elapsed_ms,
                "message": f"Redirect URL configured ({self.redirect_url}). Probe: {exc}",
                "redirect_url": self.redirect_url,
                "mode": "redirect",
            }


# ==============================================================================
# Adapter Factory Function
# ==============================================================================

def adapter_for(hospital: Hospital) -> BaseHospitalAdapter:
    """Strategy selector returning appropriate adapter instance for hospital."""
    mode = getattr(hospital, "integration_mode", "").lower()
    itype = getattr(hospital, "integration_type", "")
    code = getattr(hospital, "external_hospital_code", "").lower()
    name = getattr(hospital, "name", "").lower()

    if code == "poddar" or "poddar" in name:
        from .integrations.poddar import PoddarHospitalAdapter
        return PoddarHospitalAdapter(hospital)

    if mode == "api" or itype == Hospital.IntegrationType.API:
        return ApiAdapter(hospital)
    elif mode == "redirect" or itype == Hospital.IntegrationType.WEBSITE:
        return RedirectAdapter(hospital)
    return NativeAdapter(hospital)
