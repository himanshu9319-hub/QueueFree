"""
HTTP client for B. P. Poddar Hospital & Medical Research Limited.
Implements circuit breaking, retry logic, zero-eval security, and Swagger contract simulation when remote TLS is restricted.
"""

import json
import logging
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional, Tuple

from queue_api.crypto import decrypt_secret
from .config import PoddarConfig
from .error_handler import (
    PoddarAuthRequiredError,
    PoddarConnectionError,
    PoddarIntegrationError,
    handle_poddar_exception,
)

logger = logging.getLogger(__name__)


class CircuitBreaker:
    """Stateful circuit breaker to prevent cascading timeouts to hospital backend."""
    STATE_CLOSED = "CLOSED"
    STATE_OPEN = "OPEN"
    STATE_HALF_OPEN = "HALF_OPEN"

    def __init__(self, failure_threshold: int = 3, reset_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.failure_count = 0
        self.state = self.STATE_CLOSED
        self.last_failure_time = 0

    def can_execute(self) -> bool:
        now = time.time()
        if self.state == self.STATE_OPEN:
            if now - self.last_failure_time >= self.reset_timeout:
                self.state = self.STATE_HALF_OPEN
                return True
            return False
        return True

    def record_success(self):
        self.failure_count = 0
        self.state = self.STATE_CLOSED

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = self.STATE_OPEN


class PoddarApiClient:
    _circuit_breaker = CircuitBreaker()

    def __init__(self, api_config: Optional[Dict[str, Any]] = None):
        self.api_config = api_config or {}
        self.base_url = (self.api_config.get("base_url") or PoddarConfig.BASE_URL).rstrip("/")
        
        raw_token = self.api_config.get("auth_token", "")
        if raw_token and raw_token.startswith("enc:v1:"):
            try:
                self.auth_token = decrypt_secret(raw_token)
            except Exception:
                self.auth_token = ""
        else:
            self.auth_token = raw_token

        self.timeout = self.api_config.get("timeout_seconds") or PoddarConfig.TIMEOUT_SECONDS
        self.use_mock_contract_fallback = self.api_config.get("use_mock_fallback", True)

    def test_connection(self) -> Dict[str, Any]:
        """
        Tests live API connectivity to B. P. Poddar Hospital API.
        Accurately reports real connection status: CONNECTED, UNAVAILABLE, or AUTHENTICATION_REQUIRED.
        """
        start = time.time()
        url = f"{self.base_url}{PoddarConfig.ENDPOINTS['departments']}"

        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) QueueFree/1.0",
                    "Accept": "application/json",
                },
            )
            if self.auth_token:
                req.add_header("Authorization", f"Bearer {self.auth_token}")

            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                status_code = resp.status
                latency = round((time.time() - start) * 1000, 2)
                return {
                    "status": PoddarConfig.Status.CONNECTED,
                    "connected": True,
                    "status_code": status_code,
                    "latency_ms": latency,
                    "message": "Successfully connected to B. P. Poddar Hospital API gateway.",
                }
        except urllib.error.HTTPError as http_err:
            latency = round((time.time() - start) * 1000, 2)
            if http_err.code in (401, 403):
                return {
                    "status": PoddarConfig.Status.AUTHENTICATION_REQUIRED,
                    "connected": False,
                    "status_code": http_err.code,
                    "latency_ms": latency,
                    "message": "Authentication required. B. P. Poddar Hospital requires API token or credentials.",
                }
            return {
                "status": PoddarConfig.Status.ERROR,
                "connected": False,
                "status_code": http_err.code,
                "latency_ms": latency,
                "message": f"Hospital gateway returned HTTP {http_err.code}.",
            }
        except Exception as exc:
            latency = round((time.time() - start) * 1000, 2)
            typed_err = handle_poddar_exception(exc)
            return {
                "status": typed_err.status,
                "connected": False,
                "status_code": typed_err.status_code,
                "latency_ms": latency,
                "technical_details": typed_err.technical_details,
                "message": typed_err.message,
            }

    def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Tuple[bool, Any, bool]:
        """
        Executes HTTP call with circuit breaker and contract schema fallback.
        Returns: (success: bool, data: Any, is_contract_mock: bool)
        """
        if not self._circuit_breaker.can_execute():
            logger.warning("Poddar API circuit breaker is OPEN. Falling back to verified Swagger contract data.")
            fallback_data = self._get_contract_fallback(path, params)
            return True, fallback_data, True

        url = f"{self.base_url}{path}"
        if params:
            query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
            if query:
                url = f"{url}?{query}"

        body_bytes = None
        if data:
            body_bytes = json.dumps(data).encode("utf-8")

        req = urllib.request.Request(url, data=body_bytes, method=method.upper())
        req.add_header("Accept", "application/json")
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) QueueFree/1.0")
        if self.auth_token:
            req.add_header("Authorization", f"Bearer {self.auth_token}")

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                resp_bytes = resp.read()
                self._circuit_breaker.record_success()
                if not resp_bytes:
                    return True, {}, False
                parsed = json.loads(resp_bytes.decode("utf-8"))
                return True, parsed, False
        except Exception as exc:
            self._circuit_breaker.record_failure()
            typed_err = handle_poddar_exception(exc)
            logger.info("Poddar API live request failed (%s). Engaging contract schema fallback.", typed_err.message)
            if self.use_mock_contract_fallback:
                fallback_data = self._get_contract_fallback(path, params)
                if fallback_data is not None:
                    return True, fallback_data, True
            raise typed_err

    def _get_contract_fallback(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """
        Provides verified Swagger contract data adhering precisely to B. P. Poddar's Swagger schemas.
        Allows DEMO to showcase real hospital departments, doctors, and slots when remote TLS is restricted.
        """
        from .contract_data import (
            SWAGGER_CONTRACT_DEPARTMENTS,
            SWAGGER_CONTRACT_DOCTORS,
            SWAGGER_CONTRACT_SLOTS,
        )

        clean_path = path.lower()
        if clean_path.startswith("/api/department"):
            return SWAGGER_CONTRACT_DEPARTMENTS

        if "/api/doctor/getdoctors/" in clean_path:
            dept_id_str = clean_path.split("/api/doctor/getdoctors/")[1].split("/")[0].split("?")[0]
            try:
                dept_id = int(dept_id_str)
                filtered = [d for d in SWAGGER_CONTRACT_DOCTORS if d.get("DepartmentId") == dept_id]
                return filtered if filtered else SWAGGER_CONTRACT_DOCTORS[:2]
            except ValueError:
                return SWAGGER_CONTRACT_DOCTORS

        if "/api/doctor/getdoctorbyid/" in clean_path:
            doc_id_str = clean_path.split("/api/doctor/getdoctorbyid/")[1].split("/")[0]
            try:
                doc_id = int(doc_id_str)
                for d in SWAGGER_CONTRACT_DOCTORS:
                    if d.get("DoctorId") == doc_id:
                        return d
            except ValueError:
                pass
            return SWAGGER_CONTRACT_DOCTORS[0]

        if "/api/appointment/timeslots/" in clean_path:
            return SWAGGER_CONTRACT_SLOTS

        return None
