"""
Response mapper and schema normalizer for B. P. Poddar Hospital API.
Transforms raw hospital payloads into standardized DEMO data structures.
"""

from typing import Any, Dict, List


class PoddarResponseMapper:
    @staticmethod
    def map_department(raw: Dict[str, Any]) -> Dict[str, Any]:
        dept_id = raw.get("DepartmentId") or raw.get("id") or 1
        name = raw.get("DepartmentName") or raw.get("name") or "Speciality Care"
        slug_code = f"poddar-dept-{dept_id}"
        return {
            "id": dept_id,
            "external_department_id": str(dept_id),
            "name": name,
            "code": slug_code,
            "description": raw.get("Description", ""),
            "is_active": raw.get("IsActive", True),
            "source": "poddar_hospital_api",
        }

    @staticmethod
    def map_doctor(raw: Dict[str, Any], department_name: str = "") -> Dict[str, Any]:
        doc_id = raw.get("DoctorId") or raw.get("id") or 101
        dept_id = raw.get("DepartmentId")
        return {
            "id": doc_id,
            "external_doctor_id": str(doc_id),
            "display_name": raw.get("DoctorName") or "Consultant Specialist",
            "department_id": dept_id,
            "department_name": raw.get("DepartmentName") or department_name,
            "qualification": raw.get("Qualification") or "MBBS, MD",
            "designation": raw.get("Designation") or "Consultant",
            "experience": raw.get("Experience") or "10+ Years",
            "consultation_fee": float(raw.get("ConsultationFee") or 800.0),
            "room_number": raw.get("RoomNo") or f"OPD Room {doc_id % 20 + 1}",
            "is_available": raw.get("IsActive", True),
            "average_consultation_minutes": 15,
            "source": "poddar_hospital_api",
        }

    @staticmethod
    def map_slot(raw: Dict[str, Any], date_str: str) -> Dict[str, Any]:
        slot_id = raw.get("TimeSlotId") or raw.get("id") or 1001
        start_time = raw.get("StartTime") or "10:00:00"
        end_time = raw.get("EndTime") or "10:15:00"
        slot_label = raw.get("SlotTime") or f"{start_time[:5]} - {end_time[:5]}"
        is_available = raw.get("IsAvailable", True) and raw.get("AvailableSeats", 1) > 0

        return {
            "id": slot_id,
            "external_slot_id": str(slot_id),
            "appointment_date": date_str,
            "start_time": start_time[:5],
            "end_time": end_time[:5],
            "slot_label": slot_label,
            "is_available": is_available,
            "capacity": raw.get("AvailableSeats", 1),
            "source": "poddar_hospital_api",
        }

    @staticmethod
    def map_appointment_confirmation(raw: Dict[str, Any], fallback_ref: str = "") -> Dict[str, Any]:
        appt_id = raw.get("AppointmentId") or raw.get("id") or fallback_ref
        token_num = raw.get("TokenNumber") or raw.get("TokenNo") or f"PODDAR-OPD-{appt_id}"
        
        return {
            "external_appointment_id": str(appt_id),
            "external_token_number": str(token_num),
            "status": raw.get("Status") or "CONFIRMED",
            "booking_reference": str(appt_id),
            "is_authoritative_external": True,
            "source": "poddar_hospital_api",
        }
