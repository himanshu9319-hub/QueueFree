import os, sys, django

sys.path.insert(0, os.path.abspath('backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'queuefree_backend.settings')
django.setup()

from queue_api.models import PatientProfile, Booking, Doctor, Department, Hospital, StaffProfile
from django.utils import timezone

today = timezone.localdate()
print(f"Today: {today}")
h = Hospital.objects.get(pk=10)
print(f"Hospital: {h.name} (ID: {h.id})")
depts = Department.objects.filter(hospital=h, is_active=True)
for d in depts:
    docs = Doctor.objects.filter(department=d, is_available=True)
    print(f"Department: {d.name} (ID: {d.id})")
    for doc in docs:
        staff = StaffProfile.objects.filter(doctor=doc).first()
        username = staff.user.username if (staff and staff.user) else "None"
        print(f"  Doctor: {doc.display_name} (ID: {doc.id}, username={username}, room={doc.room_number})")

print("\n--- Staff Profiles at Demo Hospital ---")
for sp in StaffProfile.objects.filter(hospital=h, is_active=True):
    print(f"User: {sp.user.username}, Role: {sp.role}, Doctor: {sp.doctor.display_name if sp.doctor else 'N/A'}")

print("\n--- Bookings Today in Demo Hospital ---")
bookings = Booking.objects.filter(hospital=h, appointment_date=today)
print(f"Total bookings today: {bookings.count()}")
for b in bookings:
    print(f"Booking {b.id}: Token={b.token_number}, Patient={b.patient.display_name} (ABHA: {b.patient.abha_demo_identifier}, Phone: {b.patient.phone}), Dept={b.department.name}, Doc={b.doctor.display_name}, Status={b.status}")
