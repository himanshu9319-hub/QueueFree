# Phase 1: Existing Project Audit & Architecture Review

## 1. Project Overview
The application is a full-stack Hospital OPD Queue Management platform:
- **Backend**: Django 5.1.2, Django REST Framework, SimpleJWT, SQLite / PostgreSQL ready.
- **Frontend**: React 18, Vite 5, Tailwind/CSS3 design system (`modern-theme.css`), Framer Motion, Lucide React icons.
- **Architecture**: Multi-tenant with three integration modes (`API`, `REDIRECT`, `NATIVE`), role-based access control (Super Admin, Hospital Admin, Reception, Doctor, Patient).

---

## 2. Component Inspection & Reuse vs. Modification Matrix

| Component / Subsystem | Current State | Reusable? | Required Modification |
|---|---|---|---|
| **Patient Login Page** (`LandingPage.jsx`) | Generic role selector with basic phone OTP. No ABHA login. | ⚠️ Redesign | Replace with dedicated healthcare Patient Portal login featuring **Option A** (14-digit ABHA / ABDM OTP verification) and **Option B** (Existing Registered Patient account). Clear separation; non-ABHA logins cannot claim verified status. |
| **Patient Registration** (`models.py`, frontend) | Basic phone + email + name fields only. | ⚠️ Modify | Implement complete registration capturing Full Name, DOB, Gender, Mobile, optional Email, Address, optional ABHA number/address. |
| **ABHA Authentication Engine** (`abdm_service.py`) | No dedicated ABDM service; basic mock ABHA identifier. | ❌ New Build | Build official ABDM v3 / sandbox authentication service handling states (`NOT_STARTED`, `OTP_REQUESTED`, `OTP_PENDING`, `VERIFIED`, `FAILED`, `EXPIRED`, `CANCELLED`). Add `ABHAAuthenticationTransaction` and `PatientABHAIdentity` models. |
| **Patient Dashboard** (`PatientHomeDashboard.jsx`) | Stat cards and booking buttons. | ⚠️ Enhance | Display Patient Profile, ABHA Verification Badge (verified vs. unverified), active OPD token, token status, upcoming bookings, cancellation action, and booking history. |
| **Hospital Management** (`Hospital` model & Admin) | Multi-tenant hospital model with integration modes. | ✅ Reusable | Keep intact, ensure multi-tenant scoping and active/inactive state enforcement. |
| **Department Management** | Database-driven `Department` model per hospital. | ✅ Reusable | Maintain dynamic departments (General Medicine, Cardiology, Orthopedics, Pediatrics, etc.) rather than hardcoded enums. |
| **Doctor Management** | `Doctor` model with qualification, fee, daily schedules. | ✅ Reusable | Expand schedule & availability management for Hospital Admin. |
| **Appointment Scheduling & Slot Engine** | `AppointmentSlot` and `AvailabilityView` with concurrency checks. | ✅ Reusable | Support appointment vs. walk-in quota separation and prevent double booking. |
| **OPD Token Generation** | Atomic sequence counter with `select_for_update`. | ✅ Reusable | Align statuses to official lifecycle: `BOOKED`, `CONFIRMED`, `CHECKED_IN`, `WAITING`, `CALLED`, `IN_CONSULTATION`, `COMPLETED`, `CANCELLED`, `NO_SHOW`. |
| **Token Confirmation Slip** | Basic confirmation card. | ⚠️ Enhance | Add printable appointment slip and generate secure, non-sensitive QR code (referencing booking UUID only, zero patient PII/ABHA). |
| **Doctor Dashboard** (`DoctorPortal.jsx`) | Live queue, Call Next, Consultation Timer, Delay Broadcast. | ✅ Reusable | Connect to updated token statuses (`IN_CONSULTATION`, `COMPLETED`, `NO_SHOW`). |
| **Reception Dashboard** (`ReceptionPortal.jsx`) | Queue view, Check-in, Walk-in token generator. | ✅ Reusable | Ensure walk-in registration aligns with queue capacity and role permissions. |
| **Live Display Board** | Not segregated from staff view. | ❌ New Build | Create public display board displaying Token Number, Room Number, Doctor Name, and Status with zero patient names or ABHA identifiers. |
| **Role-Based Access Control** | Custom permissions in `permissions.py`. | ✅ Reusable | Strict enforcement on backend for all endpoints. |

---

## 3. Implementation Plan by Phase

1. **Phase 1**: Audit report completed.
2. **Phase 2**: Redesign Patient Login Page with Option A (Official ABHA Login) and Option B (Registered Phone Login).
3. **Phase 3**: Patient Registration & Account Profile management.
4. **Phase 4**: Official ABDM ABHA Authentication Service & Transaction State Engine (`NOT_STARTED` to `VERIFIED`/`FAILED`).
5. **Phase 5**: Patient Dashboard upgrade with active token badge, ABHA verification card, upcoming appointments, and cancellation.
6. **Phase 6**: Hospital, Department, and Doctor administrative management.
7. **Phase 7**: Appointment Scheduling engine with capacity constraints.
8. **Phase 8**: OPD Token Generation with printable confirmation and non-sensitive QR code.
9. **Phase 9**: Live Queue Management & Privacy-Compliant Public Display Board.
10. **Phase 10**: Reception and Doctor dashboard enhancements.
11. **Phase 11**: Security and Role Permission hardening.
12. **Phase 12**: Automated Backend & Frontend Integration Testing.
13. **Phase 13**: Final Documentation & Acceptance Verification.
