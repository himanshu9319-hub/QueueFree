# B. P. Poddar Hospital & Medical Research Limited — API Capability Report

## 1. Executive Summary & Target Infrastructure
- **Hospital Name**: B. P. Poddar Hospital & Medical Research Limited
- **Facility Location**: 71/1, Humayun Kabir Sarani, Block G, New Alipore, Kolkata, West Bengal 700053, India
- **Website**: `https://www.bppoddarhospital.com/`
- **API Host**: `https://ios.bppoddarhospital.com`
- **Swagger Documentation URL**: `https://ios.bppoddarhospital.com/index.html`
- **Swagger JSON Definition**: `https://ios.bppoddarhospital.com/swagger/v1/swagger.json`
- **Server Platform**: Microsoft-IIS/10.0 with ASP.NET Web API backend (resolved IP: `103.93.251.149`)

---

## 2. Live Connectivity & TLS Investigation Findings
During live socket and HTTP diagnostics on `103.93.251.149`:
1. **HTTP (Port 80)**:
   - Responded with `HTTP/1.1 307 Temporary Redirect`
   - Target: `Location: https://ios.bppoddarhospital.com/swagger/v1/swagger.json`
   - Server identification: `Microsoft-IIS/10.0`, `X-Powered-By: ASP.NET`
2. **HTTPS (Port 443)**:
   - Port 443 is open and listening.
   - During TLS handshake (tested across TLS 1.2 and TLS 1.3 with standard OpenSSL / Schannel / Python ssl), the remote server host resets the connection (`write:errno=113` / `[WinError 10054] Connection reset by peer`).
   - Root Cause: Remote IIS server endpoint requires either client-certificate authentication, internal hospital VPN/IP whitelisting, or exhibits an active SSL binding misconfiguration on IIS 10.
3. **Integration Status Classification**:
   - In accordance with Phase 3 criteria, B. P. Poddar Hospital is classified as **`UNAVAILABLE`** / **`AUTHENTICATION_REQUIRED`** for raw internet clients until hospital network administrators enable public TLS or whitelist DEMO gateway egress IPs.
   - Our integration module provides live probing with graceful fallback, circuit breaker protection, and a sandbox mock mode adhering to the published Swagger contracts.

---

## 3. Comprehensive API Capability Matrix

### 3.1 Department Controller
| Endpoint | Method | Params | Description | Auth Required |
|---|---|---|---|---|
| `/api/Department` | `GET` | None | Returns list of active clinical departments with IDs and names | Bearer / API Key (if configured) |

**Expected Response Schema**:
```json
[
  {
    "DepartmentId": 1,
    "DepartmentName": "Cardiology",
    "Description": "Heart and vascular care",
    "IsActive": true
  },
  {
    "DepartmentId": 2,
    "DepartmentName": "General Medicine",
    "Description": "Internal medicine and adult care",
    "IsActive": true
  }
]
```

---

### 3.2 Doctor Controller
| Endpoint | Method | Params | Description | Auth Required |
|---|---|---|---|---|
| `/api/Doctor/getDoctors/{departmentId}` | `GET` | `departmentId` (int) | Returns doctors assigned to department | Public / Client Token |
| `/api/Doctor/getDoctorById/{DocId}` | `GET` | `DocId` (int) | Returns detailed profile, qualification, fees, timings | Public / Client Token |

**Expected Doctor Response Schema**:
```json
[
  {
    "DoctorId": 101,
    "DoctorName": "Dr. Subhashish Poddar",
    "DepartmentId": 1,
    "DepartmentName": "Cardiology",
    "Qualification": "MD, DM (Cardio)",
    "Designation": "Senior Consultant",
    "Experience": "18 Years",
    "ConsultationFee": 800.0,
    "IsActive": true,
    "RoomNo": "OPD 12"
  }
]
```

---

### 3.3 Appointment Scheduling & Slot Controller
| Endpoint | Method | Params | Description | Auth Required |
|---|---|---|---|---|
| `/api/Appointment/TimeSlots/{Date}/{DocId}` | `GET` | `Date` (YYYY-MM-DD), `DocId` (int) | Available appointment time slots | Yes |
| `/api/Appointment/{Date}/{DocId}` | `GET` | `Date`, `DocId` | Doctor's schedule overview for given day | Yes |
| `/api/Appointment/GetAppointmentByDate/{Date}/{PatientId}/{DoctorId}/{IsRescheduling}/{TimeSlotId}` | `GET` | Date, PatientId, DoctorId, IsRescheduling, TimeSlotId | Pre-booking slot conflict & duplicate check | Yes |
| `/api/Appointment/getAppointmentDetails/{AppointmentId}` | `GET` | `AppointmentId` (int/str) | Fetch appointment reference details | Yes |
| `/api/Appointment/getAppointments/{MobileNo}/{IsOnline}/{AppointmentType}` | `GET` | MobileNo, IsOnline, AppointmentType | Patient appointment list by registered mobile | Yes |

**Expected Slot Schema**:
```json
[
  {
    "TimeSlotId": 501,
    "SlotTime": "10:00 AM - 10:15 AM",
    "StartTime": "10:00:00",
    "EndTime": "10:15:00",
    "IsAvailable": true,
    "AvailableSeats": 1
  }
]
```

---

### 3.4 Patient & User Registration Controller
| Endpoint | Method | Payload / Params | Description | Auth Required |
|---|---|---|---|---|
| `/api/getUserByMobile/{mobile}` | `GET` | `mobile` (string) | Check if patient is already registered | Yes |
| `/api/UserRegister` | `POST` | Patient demographic details | Creates hospital patient record, returns `PatientId` | Yes |
| `/api/UserUpdate` | `PUT` | Updated profile | Updates existing hospital patient record | Yes |
| `/api/getUserByPatientId` | `GET` | `PatientId` | Retrieve hospital patient identity details | Yes |

**ABHA Compatibility Note**:
The hospital's patient registration schema expects `FirstName`, `LastName`, `MobileNo`, `Email`, `Gender`, `Address`. It does **not** natively accept ABHA 14-digit identifiers. Therefore:
1. Patient authenticates with ABHA in DEMO.
2. DEMO requests explicit patient consent before transmitting necessary demographic fields (Name, Phone, DOB, Gender) to B. P. Poddar Hospital's `/api/UserRegister`.
3. DEMO maps B. P. Poddar's returned `PatientId` to `PatientProfile.external_patient_ids['poddar']` without sending national ABHA secrets.

---

### 3.5 Appointment Creation, Confirmation & Cancellation Controller
| Endpoint | Method | Params / Payload | Description |
|---|---|---|---|
| `/api/Appointment/Create` | `POST` | `PatientId`, `DoctorId`, `Date`, `TimeSlotId`, `Remarks` | Creates provisional appointment |
| `/api/Appointment/ConfirmBooking/{AppointmentId}` | `PUT` | `AppointmentId` | Confirms appointment following payment/check-in |
| `/api/Appointment/CancelAppointment/{AppointmentId}/{Reason}/{IsOnWallet}/{UserId}` | `PUT` | AppointmentId, Reason, IsOnWallet, UserId | Cancels appointment on hospital system |
| `/api/Appointment/RescheduleAppointment/{AppointmentId}/{AppointmentDate}/{AppointmentChildId}/{DoctorId}/{PatientId}` | `PUT` | Booking params | Reschedules appointment on hospital system |

---

### 3.6 Payment Gateway Controller
| Endpoint | Method | Description |
|---|---|---|
| `/api/PaymentGateway/GetOrderId/{AppointmentId}/{Amount}/{UserId}` | `GET` | Generates payment order ID for appointment |
| `/api/PaymentGateway/GetOrderDetailsByOrderId/{OrderId}` | `GET` | Inspects status of existing payment order |
| `/api/PaymentGateway/CreateOrder` | `POST` | Creates order on hospital's payment gateway |
| `/api/PaymentGateway/InsertUserPayment` | `POST` | Records verified transaction receipt |

---

### 3.7 Dangerous / Restricted Endpoints (EXCLUDED)
The Swagger schema also includes arbitrary SQL database query execution endpoints:
- `GET /api/Values/GetDataByQry/{Qry}`
- `POST /api/Values/UpdateInsertDataByQry/{Qry}`

**SECURITY DIRECTIVE**: As instructed in Phase 14, these endpoints are strictly excluded from our codebase to prevent SQL injection and unauthorized data mutation.
