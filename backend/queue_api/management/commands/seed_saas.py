import os
from datetime import date, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from queue_api.models import (
    AppointmentSlot, Booking, DailyTokenSequence, Department, Doctor,
    DoctorSchedule, Hospital, HospitalHoliday, PatientProfile, Payment,
    StaffProfile
)

User = get_user_model()


class Command(BaseCommand):
    help = "Seed multi-tenant SaaS data: Super Admin, 3 Integration Modes, Staff, Schedules, and Live Queues."

    def handle(self, *args, **options):
        self.stdout.write("Starting QueueFree Multi-Tenant SaaS database seeding...")

        # ----------------------------------------------------------------------
        # 1. Super Admin Account
        # ----------------------------------------------------------------------
        super_password = os.environ.get("DEMO_SUPERADMIN_PASSWORD", "SuperAdmin@123")
        super_user, _ = User.objects.get_or_create(username="superadmin", defaults={"first_name": "Super", "last_name": "Admin", "email": "superadmin@queuefree.in", "is_staff": True, "is_superuser": True})
        super_user.set_password(super_password)
        super_user.is_staff = True
        super_user.is_superuser = True
        super_user.save()

        StaffProfile.objects.update_or_create(
            user=super_user,
            defaults={
                "hospital": None,
                "role": StaffProfile.Role.SUPER_ADMIN,
                "is_active": True,
            },
        )
        self.stdout.write(self.style.SUCCESS("[OK] Super Admin: superadmin / " + super_password))

        # ----------------------------------------------------------------------
        # 2. Hospital Specifications (Covering all 3 Integration Modes)
        # ----------------------------------------------------------------------
        hospitals_data = [
            {
                "name": "District Hospital Rishikesh",
                "slug": "district-hospital-rishikesh",
                "city": "Rishikesh",
                "integration_type": Hospital.IntegrationType.QUEUEFREE,
                "status": Hospital.Status.ACTIVE,
                "payment_required": True,
                "consultation_fee": Decimal("50.00"),
                "address": "Barrage Road, Rishikesh, Uttarakhand",
                "phone": "+91-135-2430001",
                "website": "https://gov.uk.nic.in/health",
                "admin_username": "admin.district",
                "reception_username": "reception.demo",
                "doctor_username": "doctor.demo",
                "departments": [
                    {"name": "General Medicine", "code": "gen-med", "doc_name": "Dr. Ananya Rao", "qual": "MBBS, MD", "room": "Room 101"},
                    {"name": "Orthopedics", "code": "ortho", "doc_name": "Dr. Arjun Nair", "qual": "MS Ortho", "room": "Room 104"},
                ],
            },
            {
                "name": "AIIMS Rishikesh",
                "slug": "aiims-rishikesh",
                "city": "Rishikesh",
                "integration_type": Hospital.IntegrationType.API,
                "status": Hospital.Status.ACTIVE,
                "payment_required": True,
                "consultation_fee": Decimal("350.00"),
                "address": "Virbhadra Road, Rishikesh, Uttarakhand",
                "phone": "+91-135-2462929",
                "website": "https://aiimsrishikesh.edu.in",
                "official_booking_url": "https://aiimsrishikesh.edu.in/opd",
                "api_config": {
                    "base_url": "https://api.aiimsrishikesh.edu.in/v1",
                    "auth_type": "bearer",
                    "auth_token": "enc:v1:seeded_aiims_token",
                    "timeout_seconds": 5,
                    "max_retries": 2,
                    "mock_mode": True,
                    "simulated": True,
                },
                "admin_username": "admin.aiims",
                "reception_username": "reception.aiims",
                "doctor_username": "dr.aiims.rao",
                "departments": [
                    {"name": "Cardiology", "code": "cardio", "doc_name": "Dr. Neha Shah", "qual": "DM Cardiology", "room": "Room 205"},
                    {"name": "Neurology", "code": "neuro", "doc_name": "Dr. Vikram Seth", "qual": "DM Neurology", "room": "Room 302"},
                ],
            },
            {
                "name": "Max Super Speciality Hospital",
                "slug": "max-hospital-dehradun",
                "city": "Dehradun",
                "integration_type": Hospital.IntegrationType.WEBSITE,
                "status": Hospital.Status.ACTIVE,
                "payment_required": False,
                "consultation_fee": Decimal("0.00"),
                "address": "Mussoorie Diversion Road, Dehradun, Uttarakhand",
                "phone": "+91-135-7193000",
                "website": "https://www.maxhealthcare.in",
                "official_booking_url": "https://www.maxhealthcare.in/book-an-appointment",
                "redirect_url": "https://www.maxhealthcare.in/book-an-appointment",
                "admin_username": "admin.max",
                "reception_username": "reception.max",
                "doctor_username": "dr.max.gupta",
                "departments": [
                    {"name": "Oncology", "code": "onco", "doc_name": "Dr. Rajiv Gupta", "qual": "MD Oncology", "room": "Room 101"},
                ],
            },
            {
                "name": "B. P. Poddar Hospital & Medical Research Limited",
                "slug": "bp-poddar-hospital-kolkata",
                "city": "Kolkata, West Bengal",
                "integration_type": Hospital.IntegrationType.API,
                "external_hospital_code": "poddar",
                "integration_status": Hospital.IntegrationStatus.UNAVAILABLE,
                "status": Hospital.Status.ACTIVE,
                "payment_required": True,
                "consultation_fee": Decimal("800.00"),
                "address": "71/1, Humayun Kabir Sarani, Block G, New Alipore, Kolkata, West Bengal 700053",
                "phone": "+91-33-2445-8001",
                "website": "https://www.bppoddarhospital.com/",
                "official_booking_url": "https://ios.bppoddarhospital.com/index.html",
                "latitude": Decimal("22.5085"),
                "longitude": Decimal("88.3312"),
                "api_config": {
                    "base_url": "https://ios.bppoddarhospital.com",
                    "auth_token": "enc:v1:poddar_demo_api_token",
                    "use_mock_fallback": True,
                    "timeout_seconds": 6,
                },
                "admin_username": "admin.poddar",
                "reception_username": "reception.poddar",
                "doctor_username": "dr.poddar.subhashish",
                "departments": [
                    {
                        "name": "Cardiology & Interventional Care",
                        "code": "poddar-dept-1",
                        "description": "Comprehensive adult and pediatric heart care with state-of-the-art Cath Lab & CCU",
                        "doctors": [
                            {"name": "Dr. Subhashish Poddar", "qual": "MBBS, MD (Med), DM (Cardiology)", "room": "OPD Block A - Room 102", "avg_mins": 15},
                            {"name": "Dr. Ritwik Ghosh", "qual": "MBBS, DNB (Cardiology), FACC", "room": "OPD Block A - Room 104", "avg_mins": 15},
                        ],
                    },
                    {
                        "name": "Neurology & Neurosurgery",
                        "code": "poddar-dept-2",
                        "description": "Advanced brain, spine and neurological stroke intervention center",
                        "doctors": [
                            {"name": "Dr. Debashis Sen", "qual": "MBBS, MS, MCh (Neuro)", "room": "Neuro Suite - Room 201", "avg_mins": 15},
                        ],
                    },
                    {
                        "name": "Orthopedics & Joint Replacement",
                        "code": "poddar-dept-3",
                        "description": "Complex trauma, arthroscopy, joint reconstruction, and spine surgery",
                        "doctors": [
                            {"name": "Dr. Amitava Mukherjee", "qual": "MBBS, MS (Ortho), FRCS", "room": "Ortho Wing - Room 115", "avg_mins": 15},
                        ],
                    },
                    {
                        "name": "General & Internal Medicine",
                        "code": "poddar-dept-4",
                        "description": "Adult preventive care, metabolic management, and critical inpatient care",
                        "doctors": [
                            {"name": "Dr. Sharmistha Bhattacharya", "qual": "MBBS, MD (Medicine)", "room": "General OPD - Room 101", "avg_mins": 15},
                        ],
                    },
                    {
                        "name": "Gastroenterology & Hepatology",
                        "code": "poddar-dept-5",
                        "description": "Digestive health, therapeutic endoscopy, and liver disease treatment",
                        "doctors": [
                            {"name": "Dr. Souvik Banerjee", "qual": "MBBS, MD, DNB (Gastro)", "room": "Endoscopy Suite - Room 305", "avg_mins": 15},
                        ],
                    },
                    {
                        "name": "Nephrology & Renal Sciences",
                        "code": "poddar-dept-6",
                        "description": "Kidney disease management, peritoneal and hemodialysis support",
                        "doctors": [
                            {"name": "Dr. Anirban Majumder", "qual": "MBBS, MD, DM (Nephrology)", "room": "Renal Sciences - Room 208", "avg_mins": 15},
                        ],
                    },
                ],
            },
        ]

        staff_password = os.environ.get("DEMO_STAFF_PASSWORD", "StaffDemo@123")
        reception_password = os.environ.get("DEMO_RECEPTION_PASSWORD", "ReceptionDemo@123")
        doctor_password = os.environ.get("DEMO_DOCTOR_PASSWORD", "DoctorDemo@123")
        admin_password = os.environ.get("DEMO_ADMIN_PASSWORD", "HospitalAdmin@123")

        today = timezone.localdate()

        for h_info in hospitals_data:
            hospital, _ = Hospital.objects.update_or_create(
                slug=h_info["slug"],
                defaults={
                    "name": h_info["name"],
                    "city": h_info["city"],
                    "integration_type": h_info["integration_type"],
                    "status": h_info["status"],
                    "payment_required": h_info["payment_required"],
                    "consultation_fee": h_info["consultation_fee"],
                    "address": h_info["address"],
                    "phone": h_info["phone"],
                    "website": h_info["website"],
                    "official_booking_url": h_info.get("official_booking_url", ""),
                    "redirect_url": h_info.get("redirect_url", ""),
                    "api_config": h_info.get("api_config", {}),
                    "external_hospital_code": h_info.get("external_hospital_code", ""),
                    "integration_status": h_info.get("integration_status", Hospital.IntegrationStatus.CONFIGURED),
                    "latitude": h_info.get("latitude"),
                    "longitude": h_info.get("longitude"),
                    "is_demo": h_info["slug"] == "district-hospital-rishikesh",
                    "is_active": True,
                },
            )

            # Hospital Admin account
            admin_user, _ = User.objects.get_or_create(username=h_info["admin_username"], defaults={"first_name": "Admin", "last_name": hospital.name[:10]})
            admin_user.set_password(admin_password)
            admin_user.save()
            StaffProfile.objects.update_or_create(
                user=admin_user,
                defaults={"hospital": hospital, "role": StaffProfile.Role.ADMIN, "is_active": True},
            )

            # Receptionist account
            reception_user, _ = User.objects.get_or_create(username=h_info["reception_username"], defaults={"first_name": "Reception Desk"})
            reception_user.set_password(reception_password)
            reception_user.save()
            StaffProfile.objects.update_or_create(
                user=reception_user,
                defaults={"hospital": hospital, "role": StaffProfile.Role.RECEPTION, "is_active": True},
            )

            first_doctor = None
            for dept_spec in h_info["departments"]:
                department, _ = Department.objects.update_or_create(
                    hospital=hospital,
                    code=dept_spec["code"],
                    defaults={"name": dept_spec["name"], "description": dept_spec.get("description", ""), "is_active": True},
                )

                doc_list = dept_spec.get("doctors") or [
                    {
                        "name": dept_spec["doc_name"],
                        "qual": dept_spec["qual"],
                        "room": dept_spec["room"],
                        "avg_mins": 10,
                    }
                ]

                for doc_spec in doc_list:
                    doctor, _ = Doctor.objects.update_or_create(
                        department=department,
                        display_name=doc_spec["name"],
                        defaults={
                            "qualification": doc_spec["qual"],
                            "room_number": doc_spec["room"],
                            "average_consultation_minutes": doc_spec.get("avg_mins", 15),
                            "is_available": True,
                            "available_weekdays": [0, 1, 2, 3, 4, 5],
                        },
                    )
                    if not first_doctor:
                        first_doctor = doctor

                    # Create weekly shift schedules (Monday to Saturday, 09:30 - 13:00)
                    for day_idx in range(6):
                        DoctorSchedule.objects.update_or_create(
                            doctor=doctor,
                            day_of_week=day_idx,
                            start_time=time(9, 30),
                            defaults={
                                "end_time": time(13, 0),
                                "slot_duration_minutes": 15,
                                "slot_capacity": 1 if hospital.integration_type == Hospital.IntegrationType.QUEUEFREE else 4,
                                "is_active": True,
                            },
                        )

                    # Generate slots for next 7 days
                    for offset in range(8):
                        slot_date = today + timedelta(days=offset)
                        for h, m in [(9, 30), (9, 45), (10, 0), (10, 15), (10, 30), (10, 45), (11, 0), (11, 15), (11, 30), (11, 45)]:
                            AppointmentSlot.objects.get_or_create(
                                doctor=doctor,
                                appointment_date=slot_date,
                                start_time=time(h, m),
                                defaults={"capacity": 1 if hospital.integration_type == Hospital.IntegrationType.QUEUEFREE else 4},
                            )

            # Doctor Staff account
            if first_doctor:
                doc_user, _ = User.objects.get_or_create(username=h_info["doctor_username"], defaults={"first_name": first_doctor.display_name})
                doc_user.set_password(doctor_password)
                doc_user.save()
                StaffProfile.objects.update_or_create(
                    user=doc_user,
                    defaults={"hospital": hospital, "role": StaffProfile.Role.DOCTOR, "doctor": first_doctor, "is_active": True},
                )

            self.stdout.write(f"[OK] Seeded hospital: {hospital.name} ({hospital.get_integration_type_display()})")

        # ----------------------------------------------------------------------
        # 3. Demo Patients & Live Queue State for Today
        # ----------------------------------------------------------------------
        patient_specs = [
            ("patient-demo", "DEMO-ABHA-0000-0001", "Priya Sharma", "+919876543210", "priya.sharma@example.com", True),
            ("patient-rahul", "DEMO-ABHA-0000-0002", "Rahul Verma", "+919876543211", "rahul.verma@example.com", True),
            ("patient-sunita", "DEMO-ABHA-0000-0003", "Sunita Devi", "+919876543212", "sunita.devi@example.com", True),
            ("patient-amit", "DEMO-ABHA-0000-0004", "Amit Patel", "+919876543213", "amit.patel@example.com", True),
        ]

        patients = []
        for uname, abha, dname, ph, em, verified in patient_specs:
            p_user, _ = User.objects.get_or_create(username=uname, defaults={"first_name": dname})
            p_user.set_password("PatientDemo@123")
            p_user.save()
            profile, _ = PatientProfile.objects.update_or_create(
                user=p_user,
                defaults={
                    "abha_demo_identifier": abha,
                    "abha_id": abha if verified else "",
                    "is_abha_verified": verified,
                    "display_name": dname,
                    "phone": ph,
                    "email": em,
                    "consent_preferences": {"whatsapp_queue_notifications": True},
                },
            )
            patients.append(profile)

        # Populate today's active queue for District Hospital
        district_hosp = Hospital.objects.get(slug="district-hospital-rishikesh")
        primary_doc = Doctor.objects.filter(department__hospital=district_hosp).first()
        today_slots = AppointmentSlot.objects.filter(doctor=primary_doc, appointment_date=today).order_by("start_time")[:4]

        queue_states = [
            (Booking.Status.SERVING, 1, "GEN-001"),
            (Booking.Status.ARRIVED, 2, "GEN-002"),
            (Booking.Status.WAITING, 3, "GEN-003"),
            (Booking.Status.WAITING, 4, "GEN-004"),
        ]

        DailyTokenSequence.objects.update_or_create(
            doctor=primary_doc,
            appointment_date=today,
            defaults={"last_sequence_number": len(queue_states)},
        )

        for idx, (slot, (b_status, seq_num, t_num)) in enumerate(zip(today_slots, queue_states)):
            p = patients[idx % len(patients)]
            booking, _ = Booking.objects.update_or_create(
                patient=p,
                idempotency_key=f"demo-seed-booking-{p.pk}-{today}",
                defaults={
                    "hospital": district_hosp,
                    "department": primary_doc.department,
                    "doctor": primary_doc,
                    "slot": slot,
                    "appointment_date": today,
                    "token_number": t_num,
                    "queue_sequence": seq_num,
                    "status": b_status,
                    "payment_state": Booking.PaymentState.PAID,
                    "booking_type": Booking.BookingType.ONLINE,
                },
            )
            Payment.objects.update_or_create(
                booking=booking,
                defaults={
                    "amount": district_hosp.consultation_fee,
                    "currency": district_hosp.currency,
                    "status": Payment.Status.SUCCEEDED,
                    "provider": "demo",
                    "provider_reference": f"DEMO-PAY-{booking.pk.hex[:8]}",
                    "simulated": True,
                },
            )

            # Sample notification log entry for this booking
            from queue_api.models import NotificationLog
            NotificationLog.objects.update_or_create(
                booking=booking,
                notification_type=NotificationLog.NotificationType.BOOKING_CONFIRMATION,
                defaults={
                    "hospital": district_hosp,
                    "recipient_phone": p.phone,
                    "recipient_name": p.display_name,
                    "channel": NotificationLog.Channel.SMS,
                    "title": f"Token #{t_num} Confirmed",
                    "message": f"QueueFree: Your Token #{t_num} is confirmed for {primary_doc.display_name} at {district_hosp.name}. Slot: {slot.start_time.strftime('%I:%M %p')}.",
                    "status": NotificationLog.DeliveryStatus.DELIVERED,
                    "provider_name": "console",
                },
            )

        self.stdout.write(self.style.SUCCESS("[OK] Successfully seeded 4 live patient queue entries & SMS notification logs for today!"))
        self.stdout.write(self.style.SUCCESS("QueueFree Multi-Tenant SaaS Seed completed successfully."))
