from concurrent.futures import ThreadPoolExecutor
from datetime import date, time, timedelta
from decimal import Decimal
from unittest import skipUnless
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from .models import AppointmentSlot, Booking, Department, Doctor, Hospital, PatientProfile, Payment, StaffProfile


User = get_user_model()


class DemoPatientLoginTests(APITestCase):
    def test_demo_login_requires_phone_and_notification_consent(self):
        response = self.client.post(
            "/api/v1/auth/patient/demo/",
            {
                "abha_demo_identifier": "DEMO-ABHA-3000-3000",
                "phone": "+919876543210",
                "whatsapp_notifications_consent": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="patient-demo-abha-3000-3000").exists())

    def test_demo_login_saves_phone_and_notification_consent(self):
        response = self.client.post(
            "/api/v1/auth/patient/demo/",
            {
                "abha_demo_identifier": "DEMO-ABHA-3001-3001",
                "phone": "+919876543210",
                "whatsapp_notifications_consent": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        profile = PatientProfile.objects.get(user__username="patient-demo-abha-3001-3001")
        self.assertEqual(profile.phone, "+919876543210")
        self.assertTrue(profile.consent_preferences["whatsapp_queue_notifications"])
        self.assertIn("whatsapp_queue_notifications_consented_at", profile.consent_preferences)
        self.assertNotIn("phone", response.data)

    def test_phone_login_does_not_ask_abha_at_start(self):
        response = self.client.post(
            "/api/v1/auth/patient/phone/",
            {"phone": "+919876543210", "name": "Ambika Sharma"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertFalse(response.data["abha_verified"])
        self.assertEqual(response.data["display_name"], "Ambika Sharma")

    def test_booking_rejected_until_abha_verified_then_succeeds(self):
        login_res = self.client.post(
            "/api/v1/auth/patient/phone/",
            {"phone": "+919876543219", "name": "Ambika Sharma"},
            format="json",
        )
        user = User.objects.get(username="patient-phone-919876543219")
        self.client.force_authenticate(user)

        # Attempt to book token before ABHA verification
        hospital = Hospital.objects.create(name="Hosp A", integration_type=Hospital.IntegrationType.QUEUEFREE, city="Dehradun")
        dept = Department.objects.create(hospital=hospital, name="Gen Med", code="gm")
        doc = Doctor.objects.create(department=dept, display_name="Dr. Demo")
        slot = AppointmentSlot.objects.create(doctor=doc, appointment_date=date.today() + timedelta(days=2), start_time=time(10), capacity=1)

        payload = {
            "hospital_id": hospital.pk,
            "department_id": dept.pk,
            "doctor_id": doc.pk,
            "date": (date.today() + timedelta(days=2)).isoformat(),
            "slot_id": slot.pk,
            "idempotency_key": str(uuid4()),
        }
        book_res = self.client.post("/api/v1/bookings/", payload, format="json")
        self.assertEqual(book_res.status_code, 409)
        self.assertIn("ABHA ID verification is mandatory", str(book_res.data))

        # Verify ABHA ID
        verify_res = self.client.post(
            "/api/v1/auth/patient/verify-abha/",
            {"abha_identifier": "DEMO-ABHA-8888-9999", "whatsapp_notifications_consent": True},
            format="json",
        )
        self.assertEqual(verify_res.status_code, 200)

        # Now booking succeeds
        book_res_2 = self.client.post("/api/v1/bookings/", payload, format="json")
        self.assertIn(book_res_2.status_code, [200, 201])
        self.assertEqual(Booking.objects.filter(patient__user=user).count(), 1)


class BookingApiTests(APITestCase):
    def setUp(self):
        self.patient_user = User.objects.create_user(username="patient-a", password="test-password")
        self.patient = PatientProfile.objects.create(
            user=self.patient_user,
            abha_demo_identifier="DEMO-ABHA-1000-1000",
            display_name="Test Patient",
        )
        self.hospital = Hospital.objects.create(
            name="Managed Test Hospital",
            integration_type=Hospital.IntegrationType.QUEUEFREE,
            city="Test City",
            cancellation_policy={
                "more_than_24_hours": 100,
                "between_6_and_24_hours": 75,
                "less_than_6_hours": 50,
                "no_show": 0,
                "doctor_unavailable": 100,
                "duplicate_payment": 100,
            },
        )
        self.department = Department.objects.create(hospital=self.hospital, name="General Medicine", code="gen")
        self.doctor = Doctor.objects.create(department=self.department, display_name="Dr. Test")
        self.other_hospital = Hospital.objects.create(
            name="Other Test Hospital",
            integration_type=Hospital.IntegrationType.QUEUEFREE,
            city="Other City",
        )
        self.other_department = Department.objects.create(hospital=self.other_hospital, name="Cardiology", code="cardio")
        self.other_doctor = Doctor.objects.create(department=self.other_department, display_name="Dr. Other")
        self.day = date.today() + timedelta(days=3)
        self.slot = AppointmentSlot.objects.create(doctor=self.doctor, appointment_date=self.day, start_time=time(10), capacity=1)
        self.other_slot = AppointmentSlot.objects.create(doctor=self.other_doctor, appointment_date=self.day, start_time=time(10), capacity=1)
        self.client.force_authenticate(self.patient_user)

    def payload(self, slot=None, hospital=None, department=None, doctor=None, key=None):
        return {
            "hospital_id": (hospital or self.hospital).pk,
            "department_id": (department or self.department).pk,
            "doctor_id": (doctor or self.doctor).pk,
            "date": self.day.isoformat(),
            "slot_id": (slot or self.slot).pk,
            "idempotency_key": key or str(uuid4()),
        }

    def make_booking(self, **kwargs):
        response = self.client.post("/api/v1/bookings/", self.payload(**kwargs), format="json")
        self.assertIn(response.status_code, [200, 201], response.data)
        return response.data

    def test_type_c_booking_appears_in_scoped_reception_queue(self):
        booking = self.make_booking()
        staff_user = User.objects.create_user(username="reception", password="test-password")
        StaffProfile.objects.create(user=staff_user, hospital=self.hospital, role=StaffProfile.Role.RECEPTION)
        staff_client = APIClient()
        staff_client.force_authenticate(staff_user)
        response = staff_client.get("/api/v1/staff/queue/", {"date": self.day.isoformat()})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["bookings"]], [booking["id"]])
        self.assertEqual(response.data["bookings"][0]["patient_display_name"], "Test P.")

    def test_hospital_a_booking_is_not_visible_to_hospital_b(self):
        self.make_booking()
        other_staff = User.objects.create_user(username="other-reception", password="test-password")
        StaffProfile.objects.create(user=other_staff, hospital=self.other_hospital, role=StaffProfile.Role.RECEPTION)
        staff_client = APIClient()
        staff_client.force_authenticate(other_staff)
        response = staff_client.get("/api/v1/staff/queue/", {"date": self.day.isoformat()})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["bookings"], [])

    def test_repeated_idempotency_key_returns_original_token(self):
        key = str(uuid4())
        first = self.make_booking(key=key)
        second = self.make_booking(key=key)
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(Booking.objects.count(), 1)

    @patch("queue_api.services.adapter_for")
    def test_type_a_delegates_reservation_without_claiming_real_api(self, adapter_for_mock):
        hospital = Hospital.objects.create(
            name="API Demo",
            integration_type=Hospital.IntegrationType.API,
            integration_configured=False,
            city="Test City",
        )
        department = Department.objects.create(hospital=hospital, name="General Medicine", code="api-gen")
        doctor = Doctor.objects.create(department=department, display_name="Dr. API")
        slot = AppointmentSlot.objects.create(doctor=doctor, appointment_date=self.day, start_time=time(11), capacity=2)
        adapter = adapter_for_mock.return_value
        adapter.availability.return_value = [{"slot_id": slot.pk, "available": True}]
        adapter.reserve.return_value = {"reference": "DEMO-REF-1", "token_number": "API-1001", "simulated": True}
        result = self.make_booking(slot=slot, hospital=hospital, department=department, doctor=doctor)
        adapter.availability.assert_called_once()
        adapter.reserve.assert_called_once()
        self.assertEqual(result["token_number"], "API-1001")
        self.assertTrue(result["authoritative_external"])
        self.assertEqual(Booking.objects.filter(hospital=hospital).count(), 1)

    def test_type_b_does_not_create_queuefree_booking(self):
        hospital = Hospital.objects.create(
            name="Website Test",
            integration_type=Hospital.IntegrationType.WEBSITE,
            official_booking_url="https://booking.example.test/",
            city="Test City",
        )
        department = Department.objects.create(hospital=hospital, name="General Medicine", code="web-gen")
        doctor = Doctor.objects.create(department=department, display_name="Dr. Website")
        slot = AppointmentSlot.objects.create(doctor=doctor, appointment_date=self.day, start_time=time(11), capacity=1)
        response = self.client.post(
            "/api/v1/bookings/",
            self.payload(slot=slot, hospital=hospital, department=department, doctor=doctor),
            format="json",
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["error"]["details"]["official_booking_url"], hospital.official_booking_url)
        self.assertFalse(Booking.objects.filter(hospital=hospital).exists())

    def test_queue_action_updates_patient_booking(self):
        booking = self.make_booking()
        staff_user = User.objects.create_user(username="reception-next", password="test-password")
        StaffProfile.objects.create(user=staff_user, hospital=self.hospital, role=StaffProfile.Role.RECEPTION)
        staff_client = APIClient()
        staff_client.force_authenticate(staff_user)
        response = staff_client.post(
            f"/api/v1/staff/bookings/{booking['id']}/action/",
            {"action": "call_next"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        patient_response = self.client.get(f"/api/v1/bookings/{booking['id']}/")
        self.assertEqual(patient_response.status_code, 200)
        self.assertEqual(patient_response.data["status"], Booking.Status.SERVING)

    def test_patient_cannot_access_staff_route_and_staff_cannot_cross_hospital(self):
        self.assertEqual(self.client.get("/api/v1/staff/queue/").status_code, 403)
        booking = self.make_booking()
        other_staff = User.objects.create_user(username="other-action", password="test-password")
        StaffProfile.objects.create(user=other_staff, hospital=self.other_hospital, role=StaffProfile.Role.RECEPTION)
        staff_client = APIClient()
        staff_client.force_authenticate(other_staff)
        result = staff_client.post(
            f"/api/v1/staff/bookings/{booking['id']}/action/",
            {"action": "complete"},
            format="json",
        )
        self.assertEqual(result.status_code, 403)

    def test_cancel_refund_uses_hospital_policy(self):
        hospital = self.hospital
        hospital.payment_required = True
        hospital.consultation_fee = Decimal("400.00")
        hospital.save()
        booking = self.make_booking(key=str(uuid4()))
        payment = Payment.objects.get(booking_id=booking["id"])
        self.assertEqual(payment.status, Payment.Status.SUCCEEDED)
        response = self.client.post(
            f"/api/v1/bookings/{booking['id']}/cancel/",
            {"reason": "patient_request"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["refund"]["percentage"], 100)
        self.assertEqual(response.data["refund"]["amount"], "400.00")
        self.assertEqual(payment.refunds.get().status, "simulated")


class ConcurrentBookingTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.user = User.objects.create_user(username="concurrent-patient", password="test-password")
        self.patient = PatientProfile.objects.create(user=self.user, abha_demo_identifier="DEMO-ABHA-2000-2000")
        self.hospital = Hospital.objects.create(name="Race Test", integration_type=Hospital.IntegrationType.QUEUEFREE, city="Test")
        self.department = Department.objects.create(hospital=self.hospital, name="General", code="gen")
        self.doctor = Doctor.objects.create(department=self.department, display_name="Dr. Race")
        self.day = date.today() + timedelta(days=2)
        self.slot = AppointmentSlot.objects.create(doctor=self.doctor, appointment_date=self.day, start_time=time(9), capacity=1)

    @skipUnless(connection.vendor == "postgresql", "The production row-lock race test requires PostgreSQL.")
    def test_two_concurrent_requests_cannot_allocate_the_last_slot(self):
        def attempt(key):
            close_old_connections()
            client = APIClient()
            client.force_authenticate(User.objects.get(pk=self.user.pk))
            result = client.post("/api/v1/bookings/", {
                "hospital_id": self.hospital.pk,
                "department_id": self.department.pk,
                "doctor_id": self.doctor.pk,
                "date": self.day.isoformat(),
                "slot_id": self.slot.pk,
                "idempotency_key": key,
            }, format="json")
            close_old_connections()
            return result.status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(attempt, [str(uuid4()), str(uuid4())]))
        self.assertCountEqual(outcomes, [201, 409])
        self.assertEqual(Booking.objects.filter(slot=self.slot, status=Booking.Status.WAITING).count(), 1)


class Phase1FoundationTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.hospital_a = Hospital.objects.create(
            name="Hospital Alpha",
            slug="hospital-alpha",
            integration_type=Hospital.IntegrationType.QUEUEFREE,
            city="Rishikesh",
        )
        self.hospital_b = Hospital.objects.create(
            name="Hospital Beta",
            slug="hospital-beta",
            integration_type=Hospital.IntegrationType.API,
            city="Dehradun",
        )
        self.dept_a = Department.objects.create(hospital=self.hospital_a, name="General Med", code="gm")
        self.dept_b = Department.objects.create(hospital=self.hospital_b, name="Cardiology", code="cardio")

        # Create staff accounts
        self.superadmin_user = User.objects.create_user(username="test-super", password="SuperPassword@123", is_superuser=True)
        StaffProfile.objects.create(user=self.superadmin_user, role=StaffProfile.Role.SUPER_ADMIN)

        self.admin_a_user = User.objects.create_user(username="test-admin-a", password="AdminPassword@123")
        StaffProfile.objects.create(user=self.admin_a_user, hospital=self.hospital_a, role=StaffProfile.Role.ADMIN)

        self.admin_b_user = User.objects.create_user(username="test-admin-b", password="AdminPassword@123")
        StaffProfile.objects.create(user=self.admin_b_user, hospital=self.hospital_b, role=StaffProfile.Role.ADMIN)

    def test_otp_send_and_verify_flow(self):
        # 1. Send OTP
        send_res = self.client.post("/api/v1/auth/patient/send-otp/", {"phone": "9876543210"}, format="json")
        self.assertEqual(send_res.status_code, 200)
        self.assertTrue(send_res.data["success"])
        dev_otp = send_res.data["dev_otp"]
        self.assertTrue(bool(dev_otp))

        # 2. Verify with wrong OTP
        wrong_res = self.client.post("/api/v1/auth/patient/verify-otp/", {"phone": "9876543210", "otp": "000000"}, format="json")
        self.assertEqual(wrong_res.status_code, 400)

        # 3. Verify with correct OTP
        verify_res = self.client.post(
            "/api/v1/auth/patient/verify-otp/",
            {"phone": "9876543210", "otp": dev_otp, "name": "Rohan Gupta", "email": "rohan@example.com"},
            format="json",
        )
        self.assertEqual(verify_res.status_code, 200)
        self.assertIn("access", verify_res.data)
        self.assertEqual(verify_res.data["display_name"], "Rohan Gupta")
        self.assertTrue(User.objects.filter(username="patient-phone-9876543210").exists())

    def test_staff_login_returns_roles_and_tenancy(self):
        # Super admin login
        res = self.client.post("/api/v1/auth/staff/login/", {"username": "test-super", "password": "SuperPassword@123"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["role"], "super_admin")
        self.assertIsNone(res.data["hospital_id"])

        # Hospital admin login
        res_admin = self.client.post("/api/v1/auth/staff/login/", {"username": "test-admin-a", "password": "AdminPassword@123"}, format="json")
        self.assertEqual(res_admin.status_code, 200)
        self.assertEqual(res_admin.data["role"], "hospital_admin")
        self.assertEqual(res_admin.data["hospital_id"], self.hospital_a.pk)

    def test_hospital_admin_cannot_access_or_modify_other_hospital(self):
        self.client.force_authenticate(self.admin_a_user)

        # Hospital Admin A views departments -> only Hospital A's departments
        depts_res = self.client.get("/api/v1/hospital-admin/departments/")
        self.assertEqual(depts_res.status_code, 200)
        dept_ids = [d["id"] for d in depts_res.data]
        self.assertIn(self.dept_a.pk, dept_ids)
        self.assertNotIn(self.dept_b.pk, dept_ids)

        # Hospital Admin A creates doctor in Hospital B's department -> 404 forbidden
        create_doc_res = self.client.post(
            "/api/v1/hospital-admin/doctors/",
            {"department": self.dept_b.pk, "display_name": "Intruder Doctor"},
            format="json",
        )
        self.assertEqual(create_doc_res.status_code, 404)
        self.assertFalse(Doctor.objects.filter(display_name="Intruder Doctor").exists())

    def test_super_admin_analytics_and_hospital_onboarding(self):
        self.client.force_authenticate(self.superadmin_user)

        # Platform Analytics
        analytics_res = self.client.get("/api/v1/super-admin/analytics/")
        self.assertEqual(analytics_res.status_code, 200)
        self.assertIn("total_hospitals", analytics_res.data)
        self.assertIn("integration_modes", analytics_res.data)

        # Onboard new hospital
        onboard_res = self.client.post(
            "/api/v1/super-admin/hospitals/",
            {
                "name": "Apollo Clinic",
                "slug": "apollo-clinic",
                "city": "Haridwar",
                "integration_mode": "native",
                "payment_required": False,
            },
            format="json",
        )
        self.assertEqual(onboard_res.status_code, 201)
        self.assertTrue(Hospital.objects.filter(slug="apollo-clinic").exists())


class Phase2QueueEngineTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.hospital = Hospital.objects.create(
            name="District Hospital Rishikesh",
            slug="district-rishikesh",
            integration_type=Hospital.IntegrationType.QUEUEFREE,
            city="Rishikesh",
            payment_required=True,
            consultation_fee=Decimal("50.00"),
        )
        self.department = Department.objects.create(hospital=self.hospital, name="General Medicine", code="gen")
        self.doctor = Doctor.objects.create(
            department=self.department,
            display_name="Dr. Ananya Rao",
            average_consultation_minutes=10,
        )
        self.today = timezone.localdate()
        self.slot1 = AppointmentSlot.objects.create(doctor=self.doctor, appointment_date=self.today, start_time=time(9, 0), capacity=1)
        self.slot2 = AppointmentSlot.objects.create(doctor=self.doctor, appointment_date=self.today, start_time=time(9, 15), capacity=1)

        # Receptionist
        self.reception_user = User.objects.create_user(username="test-reception-p2", password="ReceptionPassword@123")
        StaffProfile.objects.create(user=self.reception_user, hospital=self.hospital, role=StaffProfile.Role.RECEPTION)

        # Doctor Staff
        self.doctor_user = User.objects.create_user(username="test-doc-staff-p2", password="DoctorPassword@123")
        StaffProfile.objects.create(user=self.doctor_user, hospital=self.hospital, role=StaffProfile.Role.DOCTOR, doctor=self.doctor)

        # Patient
        self.patient_user = User.objects.create_user(username="test-queue-patient-p2", password="PatientPassword@123")
        self.patient = PatientProfile.objects.create(
            user=self.patient_user,
            abha_demo_identifier="DEMO-ABHA-7777-7777",
            display_name="Test Patient",
            phone="+919876543210",
            is_abha_verified=True,
        )

        # Hospital Admin
        self.hospital_admin_user = User.objects.create_user(username="test-hosp-admin-p2", password="AdminPassword@123")
        StaffProfile.objects.create(user=self.hospital_admin_user, hospital=self.hospital, role=StaffProfile.Role.ADMIN)

    def test_duplicate_booking_prevention_same_doctor_same_day(self):
        self.client.force_authenticate(self.patient_user)
        # First booking succeeds
        payload = {
            "hospital_id": self.hospital.pk,
            "department_id": self.department.pk,
            "doctor_id": self.doctor.pk,
            "date": self.today.isoformat(),
            "slot_id": self.slot1.pk,
            "idempotency_key": str(uuid4()),
        }
        res1 = self.client.post("/api/v1/bookings/", payload, format="json")
        self.assertIn(res1.status_code, [200, 201])

        # Second booking with same doctor on same date is blocked
        payload2 = {
            "hospital_id": self.hospital.pk,
            "department_id": self.department.pk,
            "doctor_id": self.doctor.pk,
            "date": self.today.isoformat(),
            "slot_id": self.slot2.pk,
            "idempotency_key": str(uuid4()),
        }
        res2 = self.client.post("/api/v1/bookings/", payload2, format="json")
        self.assertEqual(res2.status_code, 409)
        self.assertIn("already have an active appointment booked with this doctor", str(res2.data))

    def test_walk_in_booking_by_receptionist(self):
        self.client.force_authenticate(self.reception_user)
        payload = {
            "patient_name": "Suresh Gupta",
            "phone": "9876500001",
            "age": 45,
            "gender": "male",
            "department_id": self.department.pk,
            "doctor_id": self.doctor.pk,
            "symptoms": "Mild fever and cough",
        }
        res = self.client.post("/api/v1/staff/queue/walk-in/", payload, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["booking_type"], "walk_in")
        self.assertEqual(res.data["status"], "arrived")
        self.assertEqual(res.data["payment_state"], "paid")
        self.assertTrue(res.data["token_number"].startswith("GEN-"))

    def test_doctor_queue_actions_call_next_serving_and_complete(self):
        self.client.force_authenticate(self.reception_user)
        # Issue 2 walk-in tokens
        res1 = self.client.post("/api/v1/staff/queue/walk-in/", {
            "patient_name": "Patient One",
            "phone": "9876500011",
            "department_id": self.department.pk,
            "doctor_id": self.doctor.pk,
        }, format="json")
        res2 = self.client.post("/api/v1/staff/queue/walk-in/", {
            "patient_name": "Patient Two",
            "phone": "9876500012",
            "department_id": self.department.pk,
            "doctor_id": self.doctor.pk,
        }, format="json")
        b1_id = res1.data["id"]
        b2_id = res2.data["id"]

        # Doctor calls next patient
        self.client.force_authenticate(self.doctor_user)
        call_res = self.client.post(f"/api/v1/staff/bookings/{b1_id}/action/", {"action": "call_next"}, format="json")
        self.assertEqual(call_res.status_code, 200)

        # Check b1 is now SERVING
        b1 = Booking.objects.get(pk=b1_id)
        self.assertEqual(b1.status, Booking.Status.SERVING)
        self.assertIsNotNone(b1.consultation_started_at)

        # Doctor completes consultation or calls next
        call_res_2 = self.client.post(f"/api/v1/staff/bookings/{b2_id}/action/", {"action": "call_next"}, format="json")
        self.assertEqual(call_res_2.status_code, 200)

        # b1 should be COMPLETED, b2 should be SERVING
        b1.refresh_from_db()
        b2 = Booking.objects.get(pk=b2_id)
        self.assertEqual(b1.status, Booking.Status.COMPLETED)
        self.assertIsNotNone(b1.consultation_ended_at)
        self.assertEqual(b2.status, Booking.Status.SERVING)

    def test_auto_no_show_marks_stale_bookings(self):
        self.client.force_authenticate(self.reception_user)
        # Create an expired booking on a past date
        past_date = self.today - timedelta(days=1)
        past_slot = AppointmentSlot.objects.create(doctor=self.doctor, appointment_date=past_date, start_time=time(9, 0), capacity=2)
        stale_booking = Booking.objects.create(
            hospital=self.hospital,
            department=self.department,
            doctor=self.doctor,
            patient=self.patient,
            slot=past_slot,
            appointment_date=past_date,
            token_number="GEN-099",
            status=Booking.Status.WAITING,
            idempotency_key=str(uuid4()),
        )

        # Trigger auto no-show processing
        res = self.client.post("/api/v1/staff/queue/auto-no-show/", {"grace_minutes": 30, "date": past_date.isoformat()}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(res.data["processed_count"], 1)

        stale_booking.refresh_from_db()
        self.assertEqual(stale_booking.status, Booking.Status.MISSED)

    def test_booking_creates_confirmation_notification(self):
        """Verifies booking confirmation notification is logged in DB."""
        from queue_api.models import NotificationLog
        self.client.force_authenticate(self.patient_user)

        res = self.client.post("/api/v1/bookings/", {
            "hospital_id": self.hospital.id,
            "department_id": self.department.id,
            "doctor_id": self.doctor.id,
            "date": self.today.isoformat(),
            "slot_id": self.slot1.id,
            "idempotency_key": str(uuid4()),
        }, format="json")
        self.assertEqual(res.status_code, 201)

        notif = NotificationLog.objects.filter(
            booking_id=res.data["id"],
            notification_type=NotificationLog.NotificationType.BOOKING_CONFIRMATION,
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn("Token #", notif.message)
        self.assertEqual(notif.recipient_phone, self.patient.phone)

    def test_doctor_delay_broadcast_and_notifications(self):
        """Verifies doctor emergency delay broadcast notifies active waiting patients."""
        from queue_api.models import NotificationLog

        # Create 2 waiting bookings for this doctor today
        Booking.objects.create(
            hospital=self.hospital,
            department=self.department,
            doctor=self.doctor,
            patient=self.patient,
            slot=self.slot1,
            appointment_date=self.today,
            token_number="GEN-081",
            status=Booking.Status.WAITING,
            idempotency_key=str(uuid4()),
        )

        self.client.force_authenticate(self.doctor_user)
        res = self.client.post("/api/v1/staff/doctor/delay/", {
            "delay_minutes": 25,
            "reason": "Emergency trauma case",
        }, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["delay_minutes"], 25)
        self.assertGreaterEqual(res.data["notifications_dispatched"], 1)

        # Check notification logged
        delay_notifs = NotificationLog.objects.filter(
            notification_type=NotificationLog.NotificationType.DOCTOR_DELAY,
            recipient_phone=self.patient.phone,
        )
        self.assertTrue(delay_notifs.exists())
        self.assertIn("Emergency trauma case", delay_notifs.first().message)

    def test_turn_near_alert_trigger(self):
        """Verifies turn near notification is sent when patient is <= 3 in line."""
        from queue_api.models import NotificationLog

        b_serving = Booking.objects.create(
            hospital=self.hospital,
            department=self.department,
            doctor=self.doctor,
            patient=self.patient,
            slot=self.slot1,
            appointment_date=self.today,
            token_number="GEN-085",
            queue_sequence=1,
            status=Booking.Status.ARRIVED,
            idempotency_key=str(uuid4()),
        )
        b_waiting = Booking.objects.create(
            hospital=self.hospital,
            department=self.department,
            doctor=self.doctor,
            patient=self.patient,
            slot=self.slot2,
            appointment_date=self.today,
            token_number="GEN-086",
            queue_sequence=2,
            status=Booking.Status.WAITING,
            idempotency_key=str(uuid4()),
        )

        self.client.force_authenticate(self.doctor_user)
        # Doctor calls next (b_serving becomes SERVING, b_waiting is next in line)
        self.client.post(f"/api/v1/staff/bookings/{b_serving.id}/action/", {"action": "call_next"}, format="json")

        # b_waiting should now have received a turn_near notification
        turn_notifs = NotificationLog.objects.filter(
            booking=b_waiting,
            notification_type=NotificationLog.NotificationType.TURN_NEAR,
        )
        self.assertTrue(turn_notifs.exists())
        self.assertIn("Your Turn Is Near", turn_notifs.first().title)

    def test_patient_and_admin_notification_endpoints(self):
        """Verifies patient and admin notification query endpoints."""
        from queue_api.models import NotificationLog
        NotificationLog.objects.create(
            hospital=self.hospital,
            recipient_phone=self.patient.phone,
            recipient_name="Test Patient",
            notification_type=NotificationLog.NotificationType.BOOKING_CONFIRMATION,
            title="Confirmed",
            message="Your token is confirmed",
            status=NotificationLog.DeliveryStatus.DELIVERED,
        )

        # Patient query
        self.client.force_authenticate(self.patient_user)
        p_res = self.client.get(f"/api/v1/patient/notifications/?phone={self.patient.phone}")
        self.assertEqual(p_res.status_code, 200)
        self.assertGreaterEqual(len(p_res.data), 1)

        # Hospital Admin query
        self.client.force_authenticate(self.hospital_admin_user)
        ha_res = self.client.get("/api/v1/hospital-admin/notifications/")
        self.assertEqual(ha_res.status_code, 200)
        self.assertGreaterEqual(len(ha_res.data), 1)


class Phase5AdapterTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.superadmin_user = User.objects.create_superuser(username="test-sa-p5", password="SuperAdminPassword@123")
        StaffProfile.objects.create(user=self.superadmin_user, role=StaffProfile.Role.SUPER_ADMIN)

        # 1. Native Hospital
        self.native_hosp = Hospital.objects.create(
            name="District Hospital Haridwar",
            slug="haridwar-district",
            integration_mode="native",
            city="Haridwar",
        )
        self.native_dept = Department.objects.create(hospital=self.native_hosp, name="General Medicine", code="gen")
        self.native_doc = Doctor.objects.create(department=self.native_dept, display_name="Dr. Haridwar Doc")

        # 2. API Hospital
        self.api_hosp = Hospital.objects.create(
            name="Max Super Speciality Dehradun",
            slug="max-dehradun",
            integration_mode="api",
            city="Dehradun",
            api_config={
                "base_url": "https://api.maxhealthcare.mock/v1",
                "auth_type": "bearer",
                "auth_token": "mock-api-bearer-token-1234",
                "mock_mode": True,
            },
        )
        self.api_dept = Department.objects.create(hospital=self.api_hosp, name="Cardiology", code="cardio")
        self.api_doc = Doctor.objects.create(department=self.api_dept, display_name="Dr. Cardio Specialist")

        # 3. Redirect Hospital
        self.redirect_hosp = Hospital.objects.create(
            name="Apollo Clinic Dehradun",
            slug="apollo-dehradun",
            integration_mode="redirect",
            city="Dehradun",
            redirect_url="https://www.apollo247.com/doctors",
        )

    def test_adapter_factory_returns_correct_strategy(self):
        from queue_api.adapters import adapter_for, NativeAdapter, ApiAdapter, RedirectAdapter
        self.assertIsInstance(adapter_for(self.native_hosp), NativeAdapter)
        self.assertIsInstance(adapter_for(self.api_hosp), ApiAdapter)
        self.assertIsInstance(adapter_for(self.redirect_hosp), RedirectAdapter)

    def test_api_adapter_circuit_breaker(self):
        from queue_api.adapters import CircuitBreaker, CircuitBreakerOpen
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=0.1)
        self.assertEqual(cb.state, "CLOSED")
        self.assertTrue(cb.can_execute())

        cb.record_failure()
        cb.record_failure()
        self.assertEqual(cb.state, "CLOSED")

        # 3rd failure trips the breaker
        cb.record_failure()
        self.assertEqual(cb.state, "OPEN")
        with self.assertRaises(CircuitBreakerOpen):
            cb.can_execute()

        # After timeout, enters HALF_OPEN
        import time as sys_time
        sys_time.sleep(0.15)
        self.assertTrue(cb.can_execute())
        self.assertEqual(cb.state, "HALF_OPEN")

        # Success resets to CLOSED
        cb.record_success()
        self.assertEqual(cb.state, "CLOSED")
        self.assertEqual(cb.failure_count, 0)

    def test_superadmin_api_config_encryption_and_masking(self):
        self.client.force_authenticate(self.superadmin_user)
        # Update with plaintext secret token
        res = self.client.patch(f"/api/v1/super-admin/hospitals/{self.api_hosp.id}/api-config/", {
            "base_url": "https://api.maxhealthcare.mock/v2",
            "auth_type": "bearer",
            "auth_token": "super_secret_api_key_xyz_1234",
            "mock_mode": True,
        }, format="json")
        self.assertEqual(res.status_code, 200)

        # Response must NOT expose the raw secret
        self.assertNotIn("super_secret_api_key_xyz_1234", res.data["api_config"]["auth_token"])
        self.assertTrue(res.data["api_config"]["auth_token"].startswith("••••"))

        # Database must store ciphertext (starts with enc:v1:)
        self.api_hosp.refresh_from_db()
        db_token = self.api_hosp.api_config["auth_token"]
        self.assertTrue(db_token.startswith("enc:v1:"))

        # Decryption in backend must reveal original value
        from queue_api.crypto import decrypt_secret
        self.assertEqual(decrypt_secret(db_token), "super_secret_api_key_xyz_1234")

    def test_superadmin_test_connection_diagnostics(self):
        self.client.force_authenticate(self.superadmin_user)
        # 1. Test API Hospital
        api_res = self.client.post(f"/api/v1/super-admin/hospitals/{self.api_hosp.id}/test-connection/")
        self.assertEqual(api_res.status_code, 200)
        self.assertTrue(api_res.data["success"])
        self.assertEqual(api_res.data["mode"], "api")
        self.assertIn("latency_ms", api_res.data)

        # 2. Test Native Hospital
        nat_res = self.client.post(f"/api/v1/super-admin/hospitals/{self.native_hosp.id}/test-connection/")
        self.assertEqual(nat_res.status_code, 200)
        self.assertTrue(nat_res.data["success"])
        self.assertEqual(nat_res.data["mode"], "native")

        # 3. Test Redirect Hospital
        red_res = self.client.post(f"/api/v1/super-admin/hospitals/{self.redirect_hosp.id}/test-connection/")
        self.assertEqual(red_res.status_code, 200)
        self.assertEqual(red_res.data["mode"], "redirect")


class ABDMIntegrationTests(APITestCase):
    def test_abha_init_valid_14_digits(self):
        res = self.client.post(
            "/api/v1/auth/patient/abha/init/",
            {"identifier": "12-3456-7890-1234", "auth_mode": "MOBILE_OTP", "phone": "+919876543210"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("txn_id", res.data)
        self.assertEqual(res.data["abha_number"], "12-3456-7890-1234")
        self.assertEqual(res.data["state"], "OTP_PENDING")
        self.assertIn("masked_mobile", res.data)

    def test_abha_init_invalid_identifier(self):
        res = self.client.post(
            "/api/v1/auth/patient/abha/init/",
            {"identifier": "12345", "auth_mode": "MOBILE_OTP"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", str(res.data))

    def test_abha_init_and_confirm_success(self):
        # 1. Init
        init_res = self.client.post(
            "/api/v1/auth/patient/abha/init/",
            {"identifier": "91880045219921", "auth_mode": "MOBILE_OTP", "phone": "+919876543210"},
            format="json",
        )
        self.assertEqual(init_res.status_code, 200)
        txn_id = init_res.data["txn_id"]

        # 2. Confirm with valid OTP 123456
        confirm_res = self.client.post(
            "/api/v1/auth/patient/abha/confirm/",
            {"txn_id": txn_id, "otp": "123456"},
            format="json",
        )
        self.assertEqual(confirm_res.status_code, 200)
        self.assertTrue(confirm_res.data["abha_verified"])
        self.assertEqual(confirm_res.data["abha_id"], "91-8800-4521-9921")
        self.assertIn("access", confirm_res.data)

        # 3. Verify PatientABHAIdentity created
        from .models import PatientABHAIdentity
        identity = PatientABHAIdentity.objects.get(abha_number="91-8800-4521-9921")
        self.assertTrue(identity.is_active)
        self.assertEqual(identity.patient_profile.display_name, confirm_res.data["display_name"])

    def test_abha_confirm_invalid_otp(self):
        init_res = self.client.post(
            "/api/v1/auth/patient/abha/init/",
            {"identifier": "91880045219921"},
            format="json",
        )
        txn_id = init_res.data["txn_id"]

        confirm_res = self.client.post(
            "/api/v1/auth/patient/abha/confirm/",
            {"txn_id": txn_id, "otp": "999999"},
            format="json",
        )
        self.assertEqual(confirm_res.status_code, 400)
        self.assertIn("error", str(confirm_res.data))

    def test_patient_registration_flow(self):
        res = self.client.post(
            "/api/v1/auth/patient/register/",
            {
                "name": "Pooja Verma",
                "phone": "+919811223344",
                "email": "pooja.verma@example.com",
                "date_of_birth": "1995-04-12",
                "gender": "F",
                "address": "Civil Lines, Rishikesh",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["display_name"], "Pooja Verma")
        self.assertFalse(res.data["abha_verified"])  # Registered account is NOT marked verified without ABDM OTP

        # Query profile detail endpoint with authenticated token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        profile_res = self.client.get("/api/v1/patient/profile/")
        self.assertEqual(profile_res.status_code, 200)
        self.assertEqual(profile_res.data["display_name"], "Pooja Verma")
        self.assertFalse(profile_res.data["is_abha_verified"])
        self.assertEqual(profile_res.data["gender"], "F")


class PoddarHospitalIntegrationTests(APITestCase):
    def setUp(self):
        self.poddar_hosp, _ = Hospital.objects.update_or_create(
            slug="bp-poddar-hospital-kolkata",
            defaults={
                "name": "B. P. Poddar Hospital & Medical Research Limited",
                "city": "Kolkata, West Bengal",
                "integration_type": Hospital.IntegrationType.API,
                "external_hospital_code": "poddar",
                "status": Hospital.Status.ACTIVE,
                "payment_required": True,
                "consultation_fee": Decimal("800.00"),
                "api_config": {
                    "base_url": "https://ios.bppoddarhospital.com",
                    "use_mock_fallback": True,
                    "timeout_seconds": 3,
                },
            },
        )
        self.patient_user = User.objects.create_user(username="test_patient_poddar")
        self.patient = PatientProfile.objects.create(
            user=self.patient_user,
            display_name="Tanmoy Chatterjee",
            phone="+919830123456",
            email="tanmoy@example.com",
            address="Alipore, Kolkata",
            abha_demo_identifier="DEMO-ABHA-7788-9900",
        )

    def test_adapter_factory_returns_poddar_adapter(self):
        from .adapters import adapter_for
        from .integrations.poddar import PoddarHospitalAdapter

        adapter = adapter_for(self.poddar_hosp)
        self.assertIsInstance(adapter, PoddarHospitalAdapter)
        self.assertEqual(adapter.hospital.external_hospital_code, "poddar")

    def test_department_service_retrieves_active_departments(self):
        from .adapters import adapter_for

        adapter = adapter_for(self.poddar_hosp)
        departments = adapter.department_service.get_departments()
        self.assertGreaterEqual(len(departments), 1)
        cardio = next((d for d in departments if "Cardio" in d["name"]), None)
        self.assertIsNotNone(cardio)
        self.assertIn("external_department_id", cardio)
        self.assertEqual(cardio["source"], "poddar_hospital_api")

    def test_doctor_service_retrieves_doctors(self):
        from .adapters import adapter_for

        adapter = adapter_for(self.poddar_hosp)
        doctors = adapter.doctor_service.get_doctors_by_department(1)
        self.assertGreaterEqual(len(doctors), 1)
        doc = doctors[0]
        self.assertIn("display_name", doc)
        self.assertIn("consultation_fee", doc)
        self.assertIn("external_doctor_id", doc)
        self.assertEqual(doc["source"], "poddar_hospital_api")

    def test_appointment_service_retrieves_slots(self):
        from .adapters import adapter_for

        adapter = adapter_for(self.poddar_hosp)
        slots = adapter.search_slots(department=None, doctor=None, date="2026-11-01")
        self.assertGreaterEqual(len(slots), 1)
        first_slot = slots[0]
        self.assertIn("slot_label", first_slot)
        self.assertIn("external_slot_id", first_slot)
        self.assertIn("start_time", first_slot)

    def test_patient_identity_mapping_without_leaking_abha(self):
        from .adapters import adapter_for

        adapter = adapter_for(self.poddar_hosp)
        patient_id = adapter.patient_service.get_or_register_hospital_patient(self.patient)
        self.assertTrue(bool(patient_id))
        self.patient.refresh_from_db()
        self.assertIn("poddar", self.patient.external_patient_ids)
        self.assertEqual(self.patient.external_patient_ids["poddar"], patient_id)

    def test_book_token_creates_external_appointment_reference(self):
        from .adapters import adapter_for

        adapter = adapter_for(self.poddar_hosp)
        result = adapter.book_token(
            department=type("obj", (), {"id": 1}),
            doctor=type("obj", (), {"id": 101, "external_id": "101"}),
            patient=self.patient,
            slot=type("obj", (), {"id": 1001, "external_id": "1001"}),
            date="2026-11-01",
            idempotency_key="idemp_poddar_test_001",
        )
        self.assertIn("external_reference", result)
        self.assertIn("external_token_number", result)
        self.assertEqual(result["external_hospital_id"], "poddar")
        self.assertTrue(result["authoritative_external"])

    def test_cancel_token_service(self):
        from .adapters import adapter_for

        adapter = adapter_for(self.poddar_hosp)
        booking = type("obj", (), {"external_appointment_id": "PODDAR-APP-TEST1234", "integration_reference": ""})
        cancel_res = adapter.cancel_token(booking, reason="patient_request")
        self.assertTrue(cancel_res.get("success"))

    def test_test_connection_diagnostics(self):
        from .adapters import adapter_for

        adapter = adapter_for(self.poddar_hosp)
        probe_res = adapter.test_connection()
        self.assertIn("status", probe_res)
        self.assertIn("latency_ms", probe_res)
        self.assertEqual(probe_res["mode"], "api")
        self.assertEqual(probe_res["hospital_code"], "poddar")

    def test_create_booking_service_stores_all_external_fields(self):
        from .services import create_booking

        dept = Department.objects.create(hospital=self.poddar_hosp, name="Cardiology", code="cardio")
        doc = Doctor.objects.create(department=dept, display_name="Dr. S. Mukherjee")
        slot = AppointmentSlot.objects.create(doctor=doc, appointment_date=timezone.localdate(), start_time=time(10, 0), capacity=1)
        booking, created = create_booking(
            self.patient_user,
            {
                "hospital_id": self.poddar_hosp.id,
                "department_id": dept.id,
                "doctor_id": doc.id,
                "slot_id": slot.id,
                "date": timezone.localdate().isoformat(),
                "idempotency_key": "poddar_service_idemp_999",
            },
        )
        self.assertTrue(created)
        self.assertTrue(booking.authoritative_external)
        self.assertTrue(bool(booking.external_appointment_id))
        self.assertTrue(bool(booking.external_token_number))
        self.assertEqual(booking.external_hospital_id, "poddar")
        self.assertEqual(booking.external_booking_status, "CONFIRMED")


class StaffRoleEnforcementAndSegregationTests(APITestCase):
    def setUp(self):
        self.hospital = Hospital.objects.create(name="District Hospital Rishikesh", is_demo=True, city="Rishikesh")

        self.reception_user = User.objects.create_user(username="test_reception", password="ReceptionPassword123")
        self.reception_staff = StaffProfile.objects.create(
            user=self.reception_user,
            hospital=self.hospital,
            role=StaffProfile.Role.RECEPTION,
        )

        dept = Department.objects.create(hospital=self.hospital, name="General Medicine", code="genmed")
        self.doctor = Doctor.objects.create(department=dept, display_name="Dr. Test Specialist")
        self.doctor_user = User.objects.create_user(username="test_doctor", password="DoctorPassword123")
        self.doctor_staff = StaffProfile.objects.create(
            user=self.doctor_user,
            hospital=self.hospital,
            doctor=self.doctor,
            role=StaffProfile.Role.DOCTOR,
        )

        self.super_user = User.objects.create_superuser(username="test_superadmin", password="SuperPassword123")
        self.super_staff = StaffProfile.objects.create(
            user=self.super_user,
            hospital=None,
            role=StaffProfile.Role.SUPER_ADMIN,
        )

    def test_receptionist_login_succeeds_for_receptionist_role(self):
        res = self.client.post("/api/v1/auth/staff/login/", {
            "username": "test_reception",
            "password": "ReceptionPassword123",
            "expected_role": "receptionist",
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["role"], "reception")

    def test_receptionist_login_fails_when_accessing_doctor_portal(self):
        res = self.client.post("/api/v1/auth/staff/login/", {
            "username": "test_reception",
            "password": "ReceptionPassword123",
            "expected_role": "doctor",
        })
        self.assertEqual(res.status_code, 403)
        self.assertIn("error", res.data)
        self.assertEqual(res.data["error"]["code"], "role_mismatch")

    def test_doctor_login_fails_when_accessing_reception_portal(self):
        res = self.client.post("/api/v1/auth/staff/login/", {
            "username": "test_doctor",
            "password": "DoctorPassword123",
            "expected_role": "receptionist",
        })
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data["error"]["code"], "role_mismatch")

    def test_super_admin_can_access_any_portal(self):
        res = self.client.post("/api/v1/auth/staff/login/", {
            "username": "test_superadmin",
            "password": "SuperPassword123",
            "expected_role": "doctor",
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["role"], "super_admin")


class SingleDemonstrationHospitalConstraintTests(APITestCase):
    def test_single_demo_hospital_enforcement(self):
        hosp1 = Hospital.objects.create(name="Demo Hospital Alpha", is_demo=True, city="City A")
        self.assertTrue(hosp1.is_demo)

        hosp2 = Hospital.objects.create(name="Demo Hospital Beta", is_demo=True, city="City B")
        self.assertTrue(hosp2.is_demo)

        # Previous demo hospital must automatically be updated to is_demo=False
        hosp1.refresh_from_db()
        self.assertFalse(hosp1.is_demo)

        # Exactly 1 hospital in the entire database has is_demo=True
        self.assertEqual(Hospital.objects.filter(is_demo=True).count(), 1)


class HospitalSearchAndRedirectionTests(APITestCase):
    def setUp(self):
        self.hosp_demo = Hospital.objects.create(
            name="District Hospital Rishikesh",
            city="Rishikesh",
            is_demo=True,
            official_booking_url="",
        )
        self.hosp_poddar = Hospital.objects.create(
            name="B. P. Poddar Hospital",
            city="Kolkata",
            is_demo=False,
            official_booking_url="https://ios.bppoddarhospital.com",
        )
        self.hosp_unlisted = Hospital.objects.create(
            name="Alipore Community Health Center",
            city="Kolkata",
            is_demo=False,
            official_booking_url="",
            integration_status=Hospital.IntegrationStatus.NOT_CONFIGURED,
        )

    def test_hospital_search_query(self):
        res = self.client.get("/api/v1/hospitals/?search=Poddar")
        self.assertEqual(res.status_code, 200)
        names = [h["name"] for h in res.data["results"]]
        self.assertIn("B. P. Poddar Hospital", names)
        self.assertNotIn("District Hospital Rishikesh", names)

    def test_hospital_city_filter(self):
        res = self.client.get("/api/v1/hospitals/?city=Rishikesh")
        self.assertEqual(res.status_code, 200)
        names = [h["name"] for h in res.data["results"]]
        self.assertIn("District Hospital Rishikesh", names)
        self.assertNotIn("B. P. Poddar Hospital", names)


class PublicDisplayBoardTests(APITestCase):
    def setUp(self):
        self.hospital = Hospital.objects.create(
            name="District Hospital Rishikesh",
            city="Rishikesh",
            is_demo=True,
        )
        self.dept = Department.objects.create(
            hospital=self.hospital,
            name="General Medicine",
            code="gen-med",
            is_active=True,
        )
        self.doctor = Doctor.objects.create(
            department=self.dept,
            display_name="Dr. Ananya Rao",
            room_number="Room 101",
            is_available=True,
        )
        self.patient_user = User.objects.create_user(username="test-patient-display", password="Password123!")
        self.patient = PatientProfile.objects.create(
            user=self.patient_user,
            abha_demo_identifier="TEST-ABHA-DISP-001",
            display_name="Patient One",
        )
        self.today = timezone.localdate()
        self.slot = AppointmentSlot.objects.create(
            doctor=self.doctor,
            appointment_date=self.today,
            start_time=time(9, 0),
            capacity=1,
        )
        self.serving_booking = Booking.objects.create(
            patient=self.patient,
            hospital=self.hospital,
            department=self.dept,
            doctor=self.doctor,
            slot=self.slot,
            appointment_date=self.today,
            token_number="GEN-001",
            queue_sequence=1,
            status=Booking.Status.SERVING,
        )

    def test_public_display_endpoint_requires_no_auth(self):
        res = self.client.get("/api/v1/public/display/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["hospital"]["name"], "District Hospital Rishikesh")
        self.assertEqual(len(res.data["doctor_queues"]), 1)
        queue = res.data["doctor_queues"][0]
        self.assertEqual(queue["doctor_name"], "Dr. Ananya Rao")
        self.assertEqual(queue["room"], "Room 101")
        self.assertEqual(queue["now_serving"], "GEN-001")
        self.assertEqual(queue["status"], "SERVING")
        self.assertNotIn("Patient One", str(res.data))
        self.assertNotIn("phone", str(res.data))

    def test_public_display_with_hospital_id_param(self):
        res = self.client.get(f"/api/v1/public/display/?hospital_id={self.hospital.id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["hospital"]["id"], self.hospital.id)


class HospitalDataIsolationAndDepartmentQueueTests(APITestCase):
    def setUp(self):
        self.hosp_demo = Hospital.objects.create(name="DEMO General Hospital", city="Dehradun", is_demo=True)
        self.hosp_other = Hospital.objects.create(name="Other Hospital", city="Kolkata", is_demo=False)

        self.dept_demo_gen = Department.objects.create(hospital=self.hosp_demo, name="General Medicine", code="gen-med")
        self.dept_demo_cardio = Department.objects.create(hospital=self.hosp_demo, name="Cardiology", code="cardio")
        self.dept_other_cardio = Department.objects.create(hospital=self.hosp_other, name="Other Cardiology", code="o-cardio")

        self.doc_demo_gen = Doctor.objects.create(department=self.dept_demo_gen, display_name="Dr. Demo Gen")
        self.doc_demo_cardio = Doctor.objects.create(department=self.dept_demo_cardio, display_name="Dr. Demo Cardio")
        self.doc_other = Doctor.objects.create(department=self.dept_other_cardio, display_name="Dr. Other Doc")

    def test_doctor_hospital_auto_population(self):
        self.assertEqual(self.doc_demo_gen.hospital, self.hosp_demo)
        self.assertEqual(self.doc_other.hospital, self.hosp_other)

    def test_doctor_list_scoped_strictly_by_hospital(self):
        res_demo = self.client.get(f"/api/v1/doctors/?hospital_id={self.hosp_demo.id}")
        self.assertEqual(res_demo.status_code, 200)
        results_demo = res_demo.data.get("results", res_demo.data)
        names = [d["display_name"] for d in results_demo]
        self.assertIn("Dr. Demo Gen", names)
        self.assertIn("Dr. Demo Cardio", names)
        self.assertNotIn("Dr. Other Doc", names)

        res_other = self.client.get(f"/api/v1/doctors/?hospital_id={self.hosp_other.id}")
        self.assertEqual(res_other.status_code, 200)
        results_other = res_other.data.get("results", res_other.data)
        names_other = [d["display_name"] for d in results_other]
        self.assertIn("Dr. Other Doc", names_other)
        self.assertNotIn("Dr. Demo Gen", names_other)

    def test_doctor_list_filtered_by_department(self):
        res = self.client.get(f"/api/v1/doctors/?hospital_id={self.hosp_demo.id}&department_id={self.dept_demo_gen.id}")
        self.assertEqual(res.status_code, 200)
        results = res.data.get("results", res.data)
        names = [d["display_name"] for d in results]
        self.assertIn("Dr. Demo Gen", names)
        self.assertNotIn("Dr. Demo Cardio", names)

    def test_public_display_department_filter(self):
        res = self.client.get(f"/api/v1/public/display/?hospital_id={self.hosp_demo.id}&department_id={self.dept_demo_cardio.id}")
        self.assertEqual(res.status_code, 200)
        queue_names = [q["doctor_name"] for q in res.data["doctor_queues"]]
        self.assertIn("Dr. Demo Cardio", queue_names)
        self.assertNotIn("Dr. Demo Gen", queue_names)








