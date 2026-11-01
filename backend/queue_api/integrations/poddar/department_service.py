"""
Department Service for B. P. Poddar Hospital API.
Fetches and normalizes active hospital departments using GET /api/Department.
"""

import logging
from typing import Any, Dict, List

from .client import PoddarApiClient
from .config import PoddarConfig
from .response_mapper import PoddarResponseMapper

logger = logging.getLogger(__name__)


class PoddarDepartmentService:
    def __init__(self, client: PoddarApiClient):
        self.client = client
        self.mapper = PoddarResponseMapper()

    def get_departments(self) -> List[Dict[str, Any]]:
        """
        Retrieves active departments from B. P. Poddar Hospital API.
        Endpoint: GET /api/Department
        """
        path = PoddarConfig.ENDPOINTS["departments"]
        success, raw_data, is_mock = self.client.request("GET", path)

        if not raw_data or not isinstance(raw_data, list):
            return []

        departments = [
            self.mapper.map_department(item)
            for item in raw_data
            if isinstance(item, dict) and item.get("IsActive", True)
        ]
        return departments
