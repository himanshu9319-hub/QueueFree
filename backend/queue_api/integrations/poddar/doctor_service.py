"""
Doctor Service for B. P. Poddar Hospital API.
Fetches doctors by department using GET /api/Doctor/getDoctors/{departmentId}
and specific doctor profile using GET /api/Doctor/getDoctorById/{DocId}.
"""

import logging
from typing import Any, Dict, List, Optional

from .client import PoddarApiClient
from .config import PoddarConfig
from .response_mapper import PoddarResponseMapper

logger = logging.getLogger(__name__)


class PoddarDoctorService:
    def __init__(self, client: PoddarApiClient):
        self.client = client
        self.mapper = PoddarResponseMapper()

    def get_doctors_by_department(self, department_id: int) -> List[Dict[str, Any]]:
        """
        Retrieves doctors assigned to department.
        Endpoint: GET /api/Doctor/getDoctors/{departmentId}
        """
        endpoint = PoddarConfig.ENDPOINTS["doctors_by_department"].format(departmentId=department_id)
        success, raw_data, is_mock = self.client.request("GET", endpoint)

        if not raw_data or not isinstance(raw_data, list):
            return []

        return [
            self.mapper.map_doctor(doc)
            for doc in raw_data
            if isinstance(doc, dict) and doc.get("IsActive", True)
        ]

    def get_doctor_by_id(self, doctor_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieves individual doctor profile by ID.
        Endpoint: GET /api/Doctor/getDoctorById/{DocId}
        """
        endpoint = PoddarConfig.ENDPOINTS["doctor_by_id"].format(DocId=doctor_id)
        success, raw_data, is_mock = self.client.request("GET", endpoint)

        if not raw_data or not isinstance(raw_data, dict):
            return None

        return self.mapper.map_doctor(raw_data)
