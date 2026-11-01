"""
Configuration for B. P. Poddar Hospital & Medical Research Limited API integration.
Based on published Swagger specification at https://ios.bppoddarhospital.com/swagger/v1/swagger.json
"""

import os

class PoddarConfig:
    HOSPITAL_NAME = "B. P. Poddar Hospital & Medical Research Limited"
    HOSPITAL_CODE = "poddar"
    HOSPITAL_CITY = "Kolkata, West Bengal"
    HOSPITAL_ADDRESS = "71/1, Humayun Kabir Sarani, Block G, New Alipore, Kolkata, West Bengal 700053"
    HOSPITAL_WEBSITE = "https://www.bppoddarhospital.com/"
    
    # Official API host
    DEFAULT_BASE_URL = "https://ios.bppoddarhospital.com"
    BASE_URL = os.getenv("PODDAR_API_BASE_URL", DEFAULT_BASE_URL)
    
    # Timeouts & Circuit Breaker Thresholds
    TIMEOUT_SECONDS = int(os.getenv("PODDAR_API_TIMEOUT", "6"))
    MAX_RETRIES = int(os.getenv("PODDAR_API_RETRIES", "2"))
    CIRCUIT_BREAKER_FAILURES = 3
    CIRCUIT_BREAKER_RESET_SECONDS = 60
    CACHE_TTL_MINUTES = 15

    # Documented Swagger Endpoints
    ENDPOINTS = {
        # Department Controller
        "departments": "/api/Department",
        
        # Doctor Controller
        "doctors_by_department": "/api/Doctor/getDoctors/{departmentId}",
        "doctor_by_id": "/api/Doctor/getDoctorById/{DocId}",
        
        # Appointment & Slot Controller
        "time_slots": "/api/Appointment/TimeSlots/{Date}/{DocId}",
        "appointment_schedule": "/api/Appointment/{Date}/{DocId}",
        "appointment_conflict_check": "/api/Appointment/GetAppointmentByDate/{Date}/{PatientId}/{DoctorId}/{IsRescheduling}/{TimeSlotId}",
        "appointment_details": "/api/Appointment/getAppointmentDetails/{AppointmentId}",
        "appointment_create": "/api/Appointment/Create",
        "appointment_legacy": "/api/Appointment",
        "appointment_confirm": "/api/Appointment/ConfirmBooking/{AppointmentId}",
        "appointment_cancel": "/api/Appointment/CancelAppointment/{AppointmentId}/{Reason}/{IsOnWallet}/{UserId}",
        "appointment_reschedule": "/api/Appointment/RescheduleAppointment/{AppointmentId}/{AppointmentDate}/{AppointmentChildId}/{DoctorId}/{PatientId}",
        "appointments_by_mobile": "/api/Appointment/getAppointments/{MobileNo}/{IsOnline}/{AppointmentType}",
        "appointments_all": "/api/Appointment/getAppointments",
        
        # Patient / User Controller
        "user_by_mobile": "/api/getUserByMobile/{mobile}",
        "user_register": "/api/UserRegister",
        "user_update": "/api/UserUpdate",
        "user_by_patient_id": "/api/getUserByPatientId",
        
        # Payment Gateway Controller
        "payment_get_order_id": "/api/PaymentGateway/GetOrderId/{AppointmentId}/{Amount}/{UserId}",
        "payment_order_details": "/api/PaymentGateway/GetOrderDetailsByOrderId/{OrderId}",
        "payment_create_order": "/api/PaymentGateway/CreateOrder",
        "payment_insert": "/api/PaymentGateway/InsertUserPayment",
    }

    # Integration Status Enum
    class Status:
        NOT_CONFIGURED = "NOT_CONFIGURED"
        CONFIGURED = "CONFIGURED"
        CONNECTED = "CONNECTED"
        AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED"
        UNAVAILABLE = "UNAVAILABLE"
        ERROR = "ERROR"
