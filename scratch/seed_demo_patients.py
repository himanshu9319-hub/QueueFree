import os, sys, django

sys.path.insert(0, os.path.abspath('backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'queuefree_backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from queue_api.models import Hospital, Department, Doctor, AppointmentSlot, Booking, PatientProfile
from queue_api.services import _allocate_managed_token

User = get_user_model()
today = timezone.localdate()

h = Hospital.objects.get(pk=10)
print(f"Target Hospital: {h.name} (ID: {h.id}) on {today}")

patients_data = [
    {
        "dept_name": "General Medicine",
        "doctor_name": "Dr. Aarav Sharma",
        "patient_name": "Vikram Malhotra",
        "phone": "+919876543210",
        "abha_id": "DEMO-ABHA-1001-2002",
        "age": 34,
        "gender": "male",
        "notes": "Chronic mild hypertension & seasonal cough",
    },
    {
        "dept_name": "Cardiology",
        "doctor_name": "Dr. Meera Kapoor",
        "patient_name": "Kavita Sundaram",
        "phone": "+919876543211",
        "abha_id": "DEMO-ABHA-2002-3003",
        "age": 48,
        "gender": "female",
        "notes": "Routine ECG follow-up and chest tightness evaluation",
    },
    {
        "dept_name": "Orthopedics",
        "doctor_name": "Dr. Rohan Verma",
        "patient_name": "Rajesh Verma",
        "phone": "+919876543212",
        "abha_id": "DEMO-ABHA-3003-4004",
        "age": 52,
        "gender": "male",
        "notes": "Knee joint pain after morning walks",
    },
    {
        "dept_name": "Neurology",
        "doctor_name": "Dr. Ananya Joshi",
        "patient_name": "Pooja Iyer",
        "phone": "+919876543213",
        "abha_id": "DEMO-ABHA-4004-5005",
        "age": 29,
        "gender": "female",
        "notes": "Persistent migraine headaches with aura",
    },
    {
        "dept_name": "Dermatology",
        "doctor_name": "Dr. Kabir Malhotra",
        "patient_name": "Amitabh Sen",
        "phone": "+919876543214",
        "abha_id": "DEMO-ABHA-5005-6006",
        "age": 41,
        "gender": "male",
        "notes": "Skin rash and allergic dermatitis on forearm",
    },
    {
        "dept_name": "Pediatrics",
        "doctor_name": "Dr. Vikram Singh",
        "patient_name": "Baby Ananya Nair",
        "phone": "+919876543215",
        "abha_id": "DEMO-ABHA-6006-7007",
        "age": 4,
        "gender": "female",
        "notes": "Mild fever and pediatric vaccination review",
    },
]

for pdata in patients_data:
    dept = Department.objects.filter(hospital=h, name__iexact=pdata["dept_name"]).first()
    if not dept:
        print(f"Error: Dept {pdata['dept_name']} not found!")
        continue
    doctor = Doctor.objects.filter(department=dept, display_name__icontains=pdata["doctor_name"]).first()
    if not doctor:
        print(f"Error: Doctor {pdata['doctor_name']} not found in {dept.name}!")
        continue

    # 1. Look for existing profile by ABHA or Phone
    profile = PatientProfile.objects.filter(abha_demo_identifier=pdata["abha_id"]).first()
    if not profile:
        profile = PatientProfile.objects.filter(phone=pdata["phone"]).first()

    clean_phone = "".join(ch for ch in pdata["phone"] if ch.isdigit())
    username = f"patient-{clean_phone}"

    if profile:
        user = profile.user
        if not user:
            user, _ = User.objects.get_or_create(username=username, defaults={"first_name": pdata["patient_name"]})
            profile.user = user
    else:
        user, _ = User.objects.get_or_create(username=username, defaults={"first_name": pdata["patient_name"]})
        profile = PatientProfile.objects.filter(user=user).first()
        if not profile:
            profile = PatientProfile(user=user)

    user.set_password("PatientDemo@2026!")
    user.first_name = pdata["patient_name"]
    user.save()

    # Update profile fields to ensure exact demo data
    profile.abha_demo_identifier = pdata["abha_id"]
    profile.abha_id = pdata["abha_id"]
    profile.is_abha_verified = True
    profile.display_name = pdata["patient_name"]
    profile.phone = pdata["phone"]
    profile.age = pdata["age"]
    profile.gender = pdata["gender"]
    profile.save()

    # 3. Check for existing active booking today
    existing_booking = Booking.objects.filter(
        patient=profile,
        appointment_date=today,
        status__in=[Booking.Status.WAITING, Booking.Status.ARRIVED, Booking.Status.CALLING, Booking.Status.SERVING],
    ).first()

    if existing_booking:
        print(f"Patient {pdata['patient_name']} already has active token: {existing_booking.token_number} with {existing_booking.doctor.display_name} ({existing_booking.department.name}) [Status: {existing_booking.status}]")
    else:
        # Get or create slot for today
        slot = AppointmentSlot.objects.filter(doctor=doctor, appointment_date=today).order_by("start_time").first()
        if not slot:
            slot = AppointmentSlot.objects.create(
                doctor=doctor,
                appointment_date=today,
                start_time=timezone.now().time(),
                capacity=30,
            )

        token_number, queue_seq = _allocate_managed_token(h, dept, doctor, today)
        booking = Booking.objects.create(
            hospital=h,
            department=dept,
            doctor=doctor,
            patient=profile,
            slot=slot,
            appointment_date=today,
            token_number=token_number,
            queue_sequence=queue_seq,
            status=Booking.Status.WAITING,
            booking_type=Booking.BookingType.ONLINE,
            payment_state=Booking.PaymentState.NOT_REQUIRED,
            idempotency_key=f"demo-seed-{token_number}-{today}",
            notes=pdata["notes"],
        )
        print(f"Created token {booking.token_number} for {pdata['patient_name']} -> Dept: {dept.name}, Doctor: {doctor.display_name} (Status: {booking.status})")

print("\nSeeding completed successfully!")
