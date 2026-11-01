"""
Error handler and response standardizer for B. P. Poddar Hospital API.
Maps HTTP statuses, TLS errors, timeouts, and IIS errors to structured application exceptions.
"""

import logging
import ssl

logger = logging.getLogger(__name__)


class PoddarIntegrationError(Exception):
    """Base exception for Poddar Hospital API integration."""
    def __init__(self, message: str, status_code: int = 502, technical_details: str = "", status: str = "ERROR"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.technical_details = technical_details
        self.status = status


class PoddarConnectionError(PoddarIntegrationError):
    """Raised when connection cannot be established or TLS resets."""
    def __init__(self, technical_details: str = ""):
        super().__init__(
            message="B. P. Poddar Hospital API endpoint is currently unreachable or rejecting connections.",
            status_code=503,
            technical_details=technical_details,
            status="UNAVAILABLE",
        )


class PoddarAuthRequiredError(PoddarIntegrationError):
    """Raised when the endpoint requires authentication or client certificate."""
    def __init__(self, technical_details: str = ""):
        super().__init__(
            message="B. P. Poddar Hospital requires client credentials or internal network access.",
            status_code=401,
            technical_details=technical_details,
            status="AUTHENTICATION_REQUIRED",
        )


class PoddarSlotUnavailableError(PoddarIntegrationError):
    """Raised when a selected appointment slot has already been booked or expired."""
    def __init__(self, slot_id: str = ""):
        super().__init__(
            message=f"The selected appointment slot ({slot_id}) is no longer available at B. P. Poddar Hospital.",
            status_code=409,
            status="ERROR",
        )


def handle_poddar_exception(exc: Exception) -> PoddarIntegrationError:
    """Classifies an exception from urllib/socket/requests into a typed PoddarIntegrationError."""
    err_str = str(exc)

    if isinstance(exc, PoddarIntegrationError):
        return exc

    # TLS Handshake reset / connection closed by remote host (WinError 10054 / errno 113)
    if "10054" in err_str or "Connection was reset" in err_str or "errno=113" in err_str or isinstance(exc, ConnectionResetError):
        return PoddarConnectionError(
            technical_details="Remote IIS 10.0 server reset TLS handshake. Endpoint may require internal VPN/IP whitelist or client cert."
        )

    # SSL / TLS error
    if isinstance(exc, ssl.SSLError) or "SSL" in err_str:
        return PoddarConnectionError(technical_details=f"TLS negotiation error: {err_str}")

    # Timeout
    if "timed out" in err_str.lower() or isinstance(exc, TimeoutError):
        return PoddarIntegrationError(
            message="B. P. Poddar Hospital API response timed out.",
            status_code=504,
            technical_details=err_str,
            status="UNAVAILABLE",
        )

    return PoddarIntegrationError(
        message=f"B. P. Poddar Hospital API error: {err_str}",
        status_code=500,
        technical_details=err_str,
        status="ERROR",
    )
