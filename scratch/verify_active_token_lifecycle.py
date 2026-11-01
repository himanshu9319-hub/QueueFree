import os, sys, django

sys.path.insert(0, os.path.abspath('backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'queuefree_backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from queue_api.models import Hospital, Department, Doctor, AppointmentSlot, Booking, PatientProfile, StaffProfile
from queue_api.services import create_booking, create_walk_in_booking, perform_queue_action
from rest_framework.exceptions import APIException

User = get_user_model()
today = timezone.localdate()

print("=" * 70)
print("VERIFICATION SUITE: 1-ACTIVE-TOKEN POLICY & MULTI-DEPARTMENT WORKFLOW")
print("=" * 70)

h = Hospital.objects.get(pk=10)
print(f"Hospital: {h.name} (ID: {h.id})")

# Ensure Vikram Malhotra starts with active WAITING token
Booking.objects.filter(token_number="GEN-MED-008").update(
    status=Booking.Status.WAITING,
    consultation_started_at=None,
    consultation_ended_at=None,
)

# 1. Verify 6 Departments & Booked Demo Tokens
print("\n[Step 1] Verifying Distinct Users & Booked Tokens Across Departments:")
expected_patients = [
    ("General Medicine", "Dr. Aarav Sharma", "Vikram Malhotra", "+919876543210"),
    ("Cardiology", "Dr. Meera Kapoor", "Kavita Sundaram", "+919876543211"),
    ("Orthopedics", "Dr. Rohan Verma", "Rajesh Verma", "+919876543212"),
    ("Neurology", "Dr. Ananya Joshi", "Pooja Iyer", "+919876543213"),
    ("Dermatology", "Dr. Kabir Malhotra", "Amitabh Sen", "+919876543214"),
    ("Pediatrics", "Dr. Vikram Singh", "Baby Ananya Nair", "+919876543215"),
]

for dept_name, doc_name, patient_name, phone in expected_patients:
    dept = Department.objects.get(hospital=h, name__iexact=dept_name)
    doc = Doctor.objects.get(department=dept, display_name__icontains=doc_name)
    prof = PatientProfile.objects.get(phone=phone)
    active = Booking.objects.filter(
        hospital=h,
        doctor=doc,
        patient=prof,
        appointment_date=today,
        status__in=[Booking.Status.WAITING, Booking.Status.ARRIVED, Booking.Status.CALLING, Booking.Status.SERVING],
    ).first()
    assert active is not None, f"Expected active token for {patient_name} in {dept_name}"
    print(f"  [OK] {dept_name:16} | {doc.display_name:18} | Patient: {patient_name:18} | Token: {active.token_number:12} | Status: {active.status}")

# 2. Test 1-Active-Token Validation Rule on Online Booking
print("\n[Step 2] Testing Anti-Slot-Hoarding Validation on Patient Vikram Malhotra:")
vikram_profile = PatientProfile.objects.get(phone="+919876543210")
vikram_user = vikram_profile.user

# Attempt to book another token in Cardiology with Dr. Meera Kapoor while having active token in Gen Med
cardio_dept = Department.objects.get(hospital=h, name__iexact="Cardiology")
cardio_doc = Doctor.objects.get(department=cardio_dept, display_name__icontains="Meera Kapoor")
slot = AppointmentSlot.objects.filter(doctor=cardio_doc, appointment_date=today, capacity__gt=0).exclude(
    bookings__status__in=[Booking.Status.WAITING, Booking.Status.ARRIVED, Booking.Status.CALLING, Booking.Status.SERVING]
).first()

payload = {
    "hospital_id": h.id,
    "department_id": cardio_dept.id,
    "doctor_id": cardio_doc.id,
    "date": today.isoformat(),
    "slot_id": slot.id,
    "idempotency_key": f"test-concurrent-check-{timezone.now().timestamp()}",
}

try:
    create_booking(vikram_user, payload)
    print("  [FAIL] FAILED: Patient was allowed to book a 2nd concurrent token!")
    sys.exit(1)
except APIException as e:
    print(f"  [OK] SUCCESS: Backend rejected concurrent booking as expected!")
    print(f"    Rejection Reason: {e.detail}")

# 3. Test 1-Active-Token Validation Rule on Receptionist Walk-in Booking
print("\n[Step 3] Testing Anti-Slot-Hoarding on Receptionist Walk-in desk for Vikram Malhotra:")
reception_user = User.objects.get(username="demo.reception")

walkin_payload = {
    "patient_name": "Vikram Malhotra",
    "phone": "+919876543210",
    "age": 34,
    "gender": "male",
    "department_id": cardio_dept.id,
    "doctor_id": cardio_doc.id,
    "symptoms": "Secondary consultation request",
}

try:
    create_walk_in_booking(reception_user, walkin_payload)
    print("  [FAIL] FAILED: Walk-in counter allowed concurrent token for active patient!")
    sys.exit(1)
except APIException as e:
    print(f"  [OK] SUCCESS: Reception walk-in desk rejected concurrent token as expected!")
    print(f"    Rejection Reason: {e.detail}")

# 4. Doctor Consultation Lifecycle: Reach Doctor and Come Out
print("\n[Step 4] Doctor Consultation Lifecycle: Doctor calls patient, consults, and marks completed:")
aarav_staff = StaffProfile.objects.get(user__username="demo.doctor")
active_gen_med = Booking.objects.filter(
    patient=vikram_profile,
    doctor=aarav_staff.doctor,
    status=Booking.Status.WAITING,
).first()

print(f"  Initial State: Token {active_gen_med.token_number} is {active_gen_med.status}")

# Doctor calls patient
b_calling = perform_queue_action(aarav_staff.user, active_gen_med.id, "calling")
print(f"  Doctor calls patient -> Status: {b_calling.status}")

# Doctor serves patient in consultation room
b_serving = perform_queue_action(aarav_staff.user, active_gen_med.id, "serving")
print(f"  Patient enters room -> Status: {b_serving.status} (Started: {b_serving.consultation_started_at})")

# Doctor finishes consultation (patient comes out)
b_completed = perform_queue_action(aarav_staff.user, active_gen_med.id, "complete")
print(f"  Patient finishes & exits consultation room -> Status: {b_completed.status} (Ended: {b_completed.consultation_ended_at})")

# 5. Verify Patient Can Now Book Another Token
print("\n[Step 5] Verifying Vikram Malhotra can now book another token after consultation completes:")
payload_after_complete = {
    "hospital_id": h.id,
    "department_id": cardio_dept.id,
    "doctor_id": cardio_doc.id,
    "date": today.isoformat(),
    "slot_id": slot.id,
    "idempotency_key": f"test-post-complete-{timezone.now().timestamp()}",
}

new_booking, created = create_booking(vikram_user, payload_after_complete)
print(f"  [OK] SUCCESS: Vikram Malhotra successfully booked new token after leaving Dr. Aarav Sharma!")
print(f"    New Token: {new_booking.token_number} with Dr. {new_booking.doctor.display_name} in {new_booking.department.name} (Status: {new_booking.status})")

# Now reset the test token back so demo state remains pristine
new_booking.status = Booking.Status.CANCELLED
new_booking.save()
print("  (Cleaned up test token for clean demo environment)")

# Reset Vikram Malhotra's General Medicine token back to WAITING for demo presentation
active_gen_med.status = Booking.Status.WAITING
active_gen_med.consultation_started_at = None
active_gen_med.consultation_ended_at = None
active_gen_med.save()
print("  (Reset Vikram Malhotra's GEN-MED-008 back to WAITING for live demonstration)")

print("\n" + "=" * 70)
print("ALL VERIFICATION CHECKS PASSED PERFECTLY!")
print("=" * 70)
