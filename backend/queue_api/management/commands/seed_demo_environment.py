import os
import uuid
from datetime import date, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from queue_api.models import (
    AppointmentSlot, Booking, DailyTokenSequence, Department, Doctor,
    DoctorSchedule, Hospital, HospitalHoliday, PatientProfile, Payment,
    StaffProfile
)

User = get_user_model()


class Command(BaseCommand):
    help = "Controlled Demo Environment Reset & Fresh Data Initialization (Idempotent, Transaction-safe)"

    def handle(self, *args, **options):
        self.stdout.write("=================================================================")
        self.stdout.write("STARTING CONTROLLED DEMO ENVIRONMENT RESET AND FRESH SEEDING")
        self.stdout.write("=================================================================")

        with transaction.atomic():
            # ------------------------------------------------------------------
            # STEP 1: RESOLVE / ESTABLISH THE SINGLE DEMO HOSPITAL
            # ------------------------------------------------------------------
            demo_hospital = Hospital.objects.filter(is_demo=True).first()

            if not demo_hospital:
                demo_hospital = Hospital.objects.filter(slug="demo-general-hospital").first()

            if not demo_hospital:
                demo_hospital = Hospital.objects.create(
                    name="DEMO General Hospital",
                    slug="demo-general-hospital",
                    integration_type=Hospital.IntegrationType.QUEUEFREE,
                    status=Hospital.Status.ACTIVE,
                    is_active=True,
                    is_demo=True,
                    external_hospital_code="DEMO-HOSP-001",
                    city="Dehradun",
                    address="Demo Campus, Dehradun, Uttarakhand, India",
                    phone="+91-135-2999000",
                    website="https://demo.queuefree.in",
                    consultation_fee=Decimal("50.00"),
                    payment_required=True,
                )
                self.stdout.write(self.style.SUCCESS(f"Created new Demo Hospital (ID: {demo_hospital.id})"))
            else:
                demo_hospital.name = "DEMO General Hospital"
                demo_hospital.slug = "demo-general-hospital"
                demo_hospital.integration_type = Hospital.IntegrationType.QUEUEFREE
                demo_hospital.status = Hospital.Status.ACTIVE
                demo_hospital.is_active = True
                demo_hospital.is_demo = True
                demo_hospital.external_hospital_code = "DEMO-HOSP-001"
                demo_hospital.city = "Dehradun"
                demo_hospital.address = "Demo Campus, Dehradun, Uttarakhand, India"
                demo_hospital.phone = "+91-135-2999000"
                demo_hospital.website = "https://demo.queuefree.in"
                demo_hospital.consultation_fee = Decimal("50.00")
                demo_hospital.payment_required = True
                demo_hospital.save()
                self.stdout.write(self.style.SUCCESS(f"Reused & updated existing Demo Hospital (ID: {demo_hospital.id})"))

            # Ensure all other hospitals have is_demo = False
            Hospital.objects.exclude(pk=demo_hospital.pk).filter(is_demo=True).update(is_demo=False)

            # ------------------------------------------------------------------
            # STEP 2: CLEAN UP OLD DEMO ROLE ACCOUNTS & OLD DEMO DATA
            # ------------------------------------------------------------------
            old_usernames_to_remove = [
                "reception-demo", "doctor-demo", "patient-demo",
                "admin.district", "reception.demo", "doctor.demo",
                "patient-rahul", "patient-sunita", "patient-amit",
            ]
            
            # Clean old users matching pattern
            users_to_delete = User.objects.filter(
                username__in=old_usernames_to_remove
            ) | User.objects.filter(
                username__startswith="patient-demo-abha-"
            ) | User.objects.filter(
                username__startswith="patient-walkin-"
            ) | User.objects.filter(
                username__startswith="patient-abha-"
            )

            # Exclude superadmin
            users_to_delete = users_to_delete.exclude(username="superadmin")

            # First delete payments, bookings, and slots referencing these old demo users
            Payment.objects.filter(booking__patient__user__in=users_to_delete).delete()
            Payment.objects.filter(booking__hospital=demo_hospital).delete()
            Booking.objects.filter(patient__user__in=users_to_delete).delete()
            Booking.objects.filter(hospital=demo_hospital).delete()
            DailyTokenSequence.objects.filter(doctor__department__hospital=demo_hospital).delete()

            del_count, _ = users_to_delete.delete()
            self.stdout.write(f"Removed {del_count} old demo user accounts and cascading profiles.")

            # ------------------------------------------------------------------
            # STEP 3: CREATE DEPARTMENTS (THE 9 MANDATED DEPARTMENTS)
            # ------------------------------------------------------------------
            departments_data = [
                {"name": "General Medicine", "code": "gen-med", "desc": "Adult internal medicine, primary outpatient care and routine health evaluations."},
                {"name": "Cardiology", "code": "cardio", "desc": "Cardiac diagnostics, ECG, echocardiography and cardiovascular risk management."},
                {"name": "Orthopedics", "code": "ortho", "desc": "Musculoskeletal trauma, joint care, sports injuries and orthopedic rehabilitation."},
                {"name": "Neurology", "code": "neuro", "desc": "Neurological evaluations, headache clinic, peripheral neuropathy and stroke management."},
                {"name": "Dermatology", "code": "derma", "desc": "Skin, hair and nail diagnostics, allergy testing and cosmetic dermatology."},
                {"name": "ENT", "code": "ent", "desc": "Ear, nose, throat diagnostics, audiology screening and voice disorders."},
                {"name": "Pediatrics", "code": "pedia", "desc": "Infant, child and adolescent health, immunization and developmental tracking."},
                {"name": "Gynecology", "code": "gynae", "desc": "Women's health, obstetric counseling, antenatal care and reproductive wellness."},
                {"name": "Ophthalmology", "code": "opht", "desc": "Vision testing, cataract evaluation, glaucoma screening and eye care."},
            ]

            dept_map = {}
            for d in departments_data:
                dept_obj, _ = Department.objects.update_or_create(
                    hospital=demo_hospital,
                    code=d["code"],
                    defaults={
                        "name": d["name"],
                        "description": d["desc"],
                        "is_active": True,
                    },
                )
                dept_map[d["code"]] = dept_obj

            self.stdout.write(self.style.SUCCESS(f"Configured 9 Departments for {demo_hospital.name}"))

            # ------------------------------------------------------------------
            # STEP 4: CREATE DEMONSTRATION DOCTORS & CLINICAL SCHEDULES
            # ------------------------------------------------------------------
            doctors_data = [
                {
                    "name": "Dr. Aarav Sharma",
                    "dept_code": "gen-med",
                    "qual": "MBBS, MD (Medicine)",
                    "room": "Room 101",
                    "avg_mins": 15,
                },
                {
                    "name": "Dr. Meera Kapoor",
                    "dept_code": "cardio",
                    "qual": "MBBS, MD, DM (Cardiology)",
                    "room": "Room 201",
                    "avg_mins": 15,
                },
                {
                    "name": "Dr. Rohan Verma",
                    "dept_code": "ortho",
                    "qual": "MBBS, MS (Orthopedics)",
                    "room": "Room 104",
                    "avg_mins": 15,
                },
                {
                    "name": "Dr. Ananya Joshi",
                    "dept_code": "neuro",
                    "qual": "MBBS, MD, DM (Neurology)",
                    "room": "Room 301",
                    "avg_mins": 20,
                },
                {
                    "name": "Dr. Kabir Malhotra",
                    "dept_code": "derma",
                    "qual": "MBBS, MD (DVL)",
                    "room": "Room 108",
                    "avg_mins": 15,
                },
                {
                    "name": "Dr. Nisha Rawat",
                    "dept_code": "ent",
                    "qual": "MBBS, MS (ENT)",
                    "room": "Room 205",
                    "avg_mins": 15,
                },
                {
                    "name": "Dr. Vikram Singh",
                    "dept_code": "pedia",
                    "qual": "MBBS, MD (Pediatrics)",
                    "room": "Room 112",
                    "avg_mins": 15,
                },
                {
                    "name": "Dr. Priya Mehta",
                    "dept_code": "gynae",
                    "qual": "MBBS, MS (OBG)",
                    "room": "Room 210",
                    "avg_mins": 15,
                },
                {
                    "name": "Dr. Aditya Rao",
                    "dept_code": "opht",
                    "qual": "MBBS, MS (Ophthalmology)",
                    "room": "Room 115",
                    "avg_mins": 15,
                },
            ]

            # Remove any obsolete doctors from demo hospital
            Doctor.objects.filter(department__hospital=demo_hospital).exclude(
                display_name__in=[d["name"] for d in doctors_data]
            ).delete()

            doc_map = {}
            for d in doctors_data:
                dept_obj = dept_map[d["dept_code"]]
                doc_obj, _ = Doctor.objects.update_or_create(
                    department=dept_obj,
                    display_name=d["name"],
                    defaults={
                        "qualification": d["qual"],
                        "room_number": d["room"],
                        "average_consultation_minutes": d["avg_mins"],
                        "is_available": True,
                        "delay_minutes": 0,
                        "delay_reason": "",
                        "available_weekdays": [0, 1, 2, 3, 4, 5],  # Mon-Sat
                    },
                )
                doc_map[d["name"]] = doc_obj

            self.stdout.write(self.style.SUCCESS(f"Configured 9 Doctors for {demo_hospital.name}"))

            # Clean and generate schedules & appointment slots for the 9 doctors
            DoctorSchedule.objects.filter(doctor__department__hospital=demo_hospital).delete()
            AppointmentSlot.objects.filter(doctor__department__hospital=demo_hospital).delete()

            today = timezone.localdate()
            for doc in doc_map.values():
                # Schedule: Mon-Sat, Morning (09:00 - 13:00) & Afternoon (14:00 - 17:00)
                for day_idx in range(6):  # Mon=0, Sat=5
                    # Morning session
                    DoctorSchedule.objects.create(
                        doctor=doc,
                        day_of_week=day_idx,
                        start_time=time(9, 0),
                        end_time=time(13, 0),
                        slot_duration_minutes=doc.average_consultation_minutes,
                        slot_capacity=1,
                        is_active=True,
                    )
                    # Afternoon session
                    DoctorSchedule.objects.create(
                        doctor=doc,
                        day_of_week=day_idx,
                        start_time=time(14, 0),
                        end_time=time(17, 0),
                        slot_duration_minutes=doc.average_consultation_minutes,
                        slot_capacity=1,
                        is_active=True,
                    )

                # Generate slots for today and next 6 days
                for day_offset in range(7):
                    slot_date = today + timedelta(days=day_offset)
                    # Morning slots (09:00, 09:15, 09:30, 09:45, 10:00, 10:15, 10:30, 10:45)
                    for h, m in [(9, 0), (9, 15), (9, 30), (9, 45), (10, 0), (10, 15), (10, 30), (10, 45), (11, 0), (11, 15)]:
                        end_m = (m + 15) % 60
                        end_h = h + 1 if m + 15 >= 60 else h
                        AppointmentSlot.objects.create(
                            doctor=doc,
                            appointment_date=slot_date,
                            start_time=time(h, m),
                            end_time=time(end_h, end_m),
                            capacity=1,
                        )

            self.stdout.write(self.style.SUCCESS(f"Generated Doctor Schedules & Daily Appointment Slots"))

            # ------------------------------------------------------------------
            # STEP 5: CREATE FRESH MANDATED DEMO ROLE ACCOUNTS
            # ------------------------------------------------------------------
            # Role Accounts:
            # 1. Super Admin: demo.superadmin / SuperAdmin@2026!
            # 2. Hospital Admin: demo.hospitaladmin / HospAdmin@2026!
            # 3. Receptionist: demo.reception / Reception@2026!
            # 4. Doctor: demo.doctor / DoctorDemo@2026! (Dr. Aarav Sharma, Gen Med)
            # 5. Patient: demo.patient / PatientDemo@2026!

            # Super Admin
            u_super, _ = User.objects.get_or_create(username="demo.superadmin", defaults={"email": "superadmin@demohospital.in", "first_name": "Super", "last_name": "Admin"})
            u_super.set_password("SuperAdmin@2026!")
            u_super.is_staff = True
            u_super.is_superuser = True
            u_super.save()
            StaffProfile.objects.update_or_create(user=u_super, defaults={"hospital": None, "role": StaffProfile.Role.SUPER_ADMIN, "is_active": True})

            # Preserve root platform superadmin as well
            u_root, _ = User.objects.get_or_create(username="superadmin", defaults={"email": "superadmin@queuefree.in", "first_name": "Platform", "last_name": "Root"})
            u_root.set_password("SuperAdmin@123")
            u_root.is_staff = True
            u_root.is_superuser = True
            u_root.save()
            StaffProfile.objects.update_or_create(user=u_root, defaults={"hospital": None, "role": StaffProfile.Role.SUPER_ADMIN, "is_active": True})

            # Hospital Admin
            u_hosp_admin, _ = User.objects.get_or_create(username="demo.hospitaladmin", defaults={"email": "admin@demohospital.in", "first_name": "Hospital", "last_name": "Admin"})
            u_hosp_admin.set_password("HospAdmin@2026!")
            u_hosp_admin.save()
            StaffProfile.objects.update_or_create(user=u_hosp_admin, defaults={"hospital": demo_hospital, "role": StaffProfile.Role.ADMIN, "is_active": True})

            # Receptionist
            u_reception, _ = User.objects.get_or_create(username="demo.reception", defaults={"email": "reception@demohospital.in", "first_name": "Desk", "last_name": "Receptionist"})
            u_reception.set_password("Reception@2026!")
            u_reception.save()
            StaffProfile.objects.update_or_create(user=u_reception, defaults={"hospital": demo_hospital, "role": StaffProfile.Role.RECEPTION, "is_active": True})

            # Doctor Account (Linked to Dr. Aarav Sharma, General Medicine)
            u_doctor, _ = User.objects.get_or_create(username="demo.doctor", defaults={"email": "doctor@demohospital.in", "first_name": "Aarav", "last_name": "Sharma"})
            u_doctor.set_password("DoctorDemo@2026!")
            u_doctor.save()
            primary_doctor = doc_map["Dr. Aarav Sharma"]
            StaffProfile.objects.update_or_create(user=u_doctor, defaults={"hospital": demo_hospital, "role": StaffProfile.Role.DOCTOR, "doctor": primary_doctor, "is_active": True})

            # Patient Account (demo.patient)
            u_patient, _ = User.objects.get_or_create(username="demo.patient", defaults={"email": "patient@demohospital.in", "first_name": "Priya", "last_name": "Sharma"})
            u_patient.set_password("PatientDemo@2026!")
            u_patient.save()
            pat_profile, _ = PatientProfile.objects.update_or_create(
                user=u_patient,
                defaults={
                    "abha_demo_identifier": "DEMO-ABHA-9999-0001",
                    "display_name": "Priya Sharma",
                    "phone": "+919123456780",
                    "email": "patient@demohospital.in",
                    "date_of_birth": date(1996, 5, 14),
                    "gender": "F",
                    "address": "Flat 402, Demo Enclave, Dehradun, Uttarakhand",
                    "is_abha_verified": False,  # As instructed: NOT_VERIFIED
                },
            )

            self.stdout.write(self.style.SUCCESS("Created fresh role accounts: demo.superadmin, demo.hospitaladmin, demo.reception, demo.doctor, demo.patient"))

            # ------------------------------------------------------------------
            # STEP 6: CREATE 5 DEMONSTRATION PATIENTS
            # ------------------------------------------------------------------
            fictional_patients = [
                {"user": "pat.ramesh", "name": "Ramesh Patel", "phone": "+919123456781", "gender": "M", "dob": date(1985, 4, 12), "addr": "Block B, Dehradun"},
                {"user": "pat.sunita", "name": "Sunita Devi", "phone": "+919123456782", "gender": "F", "dob": date(1990, 8, 23), "addr": "Sector 4, Dehradun"},
                {"user": "pat.amit", "name": "Amit Kumar", "phone": "+919123456783", "gender": "M", "dob": date(1995, 12, 5), "addr": "Rajpur Road, Dehradun"},
                {"user": "pat.pooja", "name": "Pooja Gupta", "phone": "+919123456784", "gender": "F", "dob": date(1988, 2, 17), "addr": "Clock Tower, Dehradun"},
                {"user": "pat.rajesh", "name": "Rajesh Verma", "phone": "+919123456785", "gender": "M", "dob": date(1978, 6, 30), "addr": "Subhash Nagar, Dehradun"},
            ]

            patient_objs = []
            for p_idx, p in enumerate(fictional_patients, start=2):
                p_user, _ = User.objects.get_or_create(username=p["user"], defaults={"first_name": p["name"].split()[0], "last_name": p["name"].split()[-1]})
                p_user.set_password("PatientTest@2026!")
                p_user.save()
                p_prof, _ = PatientProfile.objects.update_or_create(
                    user=p_user,
                    defaults={
                        "abha_demo_identifier": f"DEMO-ABHA-9999-{p_idx:04d}",
                        "display_name": p["name"],
                        "phone": p["phone"],
                        "email": f"{p['user']}@example.com",
                        "date_of_birth": p["dob"],
                        "gender": p["gender"],
                        "address": p["addr"],
                        "is_abha_verified": False,  # Strictly NOT_VERIFIED
                    },
                )
                patient_objs.append(p_prof)

            self.stdout.write(self.style.SUCCESS(f"Created 5 Fictional Demo Patients (All ABHA NOT_VERIFIED)"))

            # ------------------------------------------------------------------
            # STEP 7: CREATE DEMONSTRATION APPOINTMENTS AND OPD TOKENS
            # ------------------------------------------------------------------
            slots_doc1 = AppointmentSlot.objects.filter(doctor=primary_doctor, appointment_date=today).order_by("start_time")
            cardio_doctor = doc_map["Dr. Meera Kapoor"]
            slots_doc2 = AppointmentSlot.objects.filter(doctor=cardio_doctor, appointment_date=today).order_by("start_time")
            ortho_doctor = doc_map["Dr. Rohan Verma"]
            slots_doc3 = AppointmentSlot.objects.filter(doctor=ortho_doctor, appointment_date=today).order_by("start_time")

            # 1. SERVING (Now in consultation): Ramesh Patel with Dr. Aarav Sharma
            Booking.objects.create(
                hospital=demo_hospital,
                department=primary_doctor.department,
                doctor=primary_doctor,
                patient=patient_objs[0],  # Ramesh Patel
                slot=slots_doc1[0],
                appointment_date=today,
                token_number="GEN-001",
                queue_sequence=1,
                status=Booking.Status.SERVING,
                booking_type=Booking.BookingType.ONLINE,
                payment_state=Booking.PaymentState.PAID,
                idempotency_key=f"seed-gen-001-{uuid.uuid4().hex[:8]}",
            )

            # 2. CALLING: Sunita Devi with Dr. Meera Kapoor (Cardiology)
            Booking.objects.create(
                hospital=demo_hospital,
                department=cardio_doctor.department,
                doctor=cardio_doctor,
                patient=patient_objs[1],  # Sunita Devi
                slot=slots_doc2[0],
                appointment_date=today,
                token_number="CARD-001",
                queue_sequence=1,
                status=Booking.Status.CALLING,
                booking_type=Booking.BookingType.ONLINE,
                payment_state=Booking.PaymentState.PAID,
                idempotency_key=f"seed-card-001-{uuid.uuid4().hex[:8]}",
            )

            # 3. ARRIVED (Checked in at reception desk): Amit Kumar with Dr. Aarav Sharma
            Booking.objects.create(
                hospital=demo_hospital,
                department=primary_doctor.department,
                doctor=primary_doctor,
                patient=patient_objs[2],  # Amit Kumar
                slot=slots_doc1[1],
                appointment_date=today,
                token_number="GEN-002",
                queue_sequence=2,
                status=Booking.Status.ARRIVED,
                booking_type=Booking.BookingType.ONLINE,
                payment_state=Booking.PaymentState.PAID,
                idempotency_key=f"seed-gen-002-{uuid.uuid4().hex[:8]}",
            )

            # 4. WAITING (Next in queue): Pooja Gupta with Dr. Aarav Sharma
            Booking.objects.create(
                hospital=demo_hospital,
                department=primary_doctor.department,
                doctor=primary_doctor,
                patient=patient_objs[3],  # Pooja Gupta
                slot=slots_doc1[2],
                appointment_date=today,
                token_number="GEN-003",
                queue_sequence=3,
                status=Booking.Status.WAITING,
                booking_type=Booking.BookingType.ONLINE,
                payment_state=Booking.PaymentState.PAID,
                idempotency_key=f"seed-gen-003-{uuid.uuid4().hex[:8]}",
            )

            # 5. WAITING: Rajesh Verma with Dr. Rohan Verma (Orthopedics)
            Booking.objects.create(
                hospital=demo_hospital,
                department=ortho_doctor.department,
                doctor=ortho_doctor,
                patient=patient_objs[4],  # Rajesh Verma
                slot=slots_doc3[0],
                appointment_date=today,
                token_number="ORTH-001",
                queue_sequence=1,
                status=Booking.Status.WAITING,
                booking_type=Booking.BookingType.WALK_IN,
                payment_state=Booking.PaymentState.PAID,
                idempotency_key=f"seed-orth-001-{uuid.uuid4().hex[:8]}",
            )

            # 6. UPCOMING (Future appointment for Priya Sharma): demo.patient
            upcoming_slot = AppointmentSlot.objects.filter(doctor=primary_doctor, appointment_date=today + timedelta(days=1)).first()
            if upcoming_slot:
                Booking.objects.create(
                    hospital=demo_hospital,
                    department=primary_doctor.department,
                    doctor=primary_doctor,
                    patient=pat_profile,  # Priya Sharma (demo.patient)
                    slot=upcoming_slot,
                    appointment_date=today + timedelta(days=1),
                    token_number="GEN-010",
                    queue_sequence=1,
                    status=Booking.Status.CONFIRMED,
                    booking_type=Booking.BookingType.ONLINE,
                    payment_state=Booking.PaymentState.PAID,
                    idempotency_key=f"seed-gen-010-{uuid.uuid4().hex[:8]}",
                )

            # 7. COMPLETED Consultation: Ramesh Patel earlier today
            Booking.objects.create(
                hospital=demo_hospital,
                department=primary_doctor.department,
                doctor=primary_doctor,
                patient=patient_objs[0],
                slot=slots_doc1[3],
                appointment_date=today,
                token_number="GEN-000",
                queue_sequence=0,
                status=Booking.Status.COMPLETED,
                booking_type=Booking.BookingType.ONLINE,
                payment_state=Booking.PaymentState.PAID,
                idempotency_key=f"seed-gen-000-{uuid.uuid4().hex[:8]}",
            )

            # 8. CANCELLED Appointment
            Booking.objects.create(
                hospital=demo_hospital,
                department=primary_doctor.department,
                doctor=primary_doctor,
                patient=patient_objs[2],
                slot=slots_doc1[4],
                appointment_date=today,
                token_number="GEN-999",
                queue_sequence=99,
                status=Booking.Status.CANCELLED,
                booking_type=Booking.BookingType.ONLINE,
                payment_state=Booking.PaymentState.REFUNDED,
                idempotency_key=f"seed-gen-999-{uuid.uuid4().hex[:8]}",
            )

            # Seed token sequence generator
            DailyTokenSequence.objects.update_or_create(
                doctor=primary_doctor,
                appointment_date=today,
                defaults={"last_sequence_number": 3},
            )
            DailyTokenSequence.objects.update_or_create(
                doctor=cardio_doctor,
                appointment_date=today,
                defaults={"last_sequence_number": 1},
            )
            DailyTokenSequence.objects.update_or_create(
                doctor=ortho_doctor,
                appointment_date=today,
                defaults={"last_sequence_number": 1},
            )

            self.stdout.write(self.style.SUCCESS("Created 8 Test Appointments covering SERVING, CALLING, ARRIVED, WAITING, UPCOMING, COMPLETED, CANCELLED"))

        self.stdout.write("=================================================================")
        self.stdout.write(self.style.SUCCESS("DEMO ENVIRONMENT RESET COMPLETED SUCCESSFULLY!"))
        self.stdout.write("=================================================================")
