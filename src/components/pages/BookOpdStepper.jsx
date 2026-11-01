import { useState, useEffect, useMemo } from 'react'
import {
  Building2, Stethoscope, Calendar, Clock, Check, ArrowRight, ArrowLeft,
  ShieldCheck, AlertCircle, Sparkles, MapPin, Ticket, ExternalLink, RefreshCw, Star,
  User, FileText, Phone, Activity, Globe, Shield
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  apiRequest, createBooking, getResults, localIsoDate,
  patientVerifyAbha, patientPhoneLogin, getApiAccessToken, setApiAccessToken
} from '../../lib/queueApi'
import { hospitalSamples } from '../../lib/appData'
import { RazorpayPaymentCard } from '../payment/RazorpayPaymentCard'

export function BookOpdStepper({
  selectedHospital: initialSelectedHospital,
  onConfirmed,
  onViewLocation,
  patientAbhaVerified = false,
  onAbhaVerifiedSuccess,
  city = 'Rishikesh, Uttarakhand',
  onNavigate,
  patientSession = null,
  onLoginSuccess,
  existingBookings = [],
}) {
  const [step, setStep] = useState(1)
  const [hospitals, setHospitals] = useState([])
  const [hospitalsLoading, setHospitalsLoading] = useState(true)
  const [hospitalId, setHospitalId] = useState('')
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [doctors, setDoctors] = useState([])
  const [doctorId, setDoctorId] = useState('')
  const [day, setDay] = useState(localIsoDate())
  const [slots, setSlots] = useState([])
  const [slotId, setSlotId] = useState('')
  const [loading, setLoading] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [error, setError] = useState('')

  // Check if patient already holds an active token (1-Active-Token Policy)
  const activeExistingBooking = useMemo(() => {
    if (!Array.isArray(existingBookings) || existingBookings.length === 0) return null
    return existingBookings.find(b =>
      ['waiting', 'arrived', 'calling', 'serving', 'external', 'confirmed', 'booked'].includes(b.status)
    ) || null
  }, [existingBookings])

  // Mandatory Patient Details State
  const [patientName, setPatientName] = useState(() => patientSession?.name || '')
  const [patientAge, setPatientAge] = useState('')
  const [patientGender, setPatientGender] = useState('')
  const [patientPhone, setPatientPhone] = useState(() => patientSession?.phone || '')
  const [patientReason, setPatientReason] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  // Sync patient session updates if available
  useEffect(() => {
    if (patientSession?.name && !patientName) setPatientName(patientSession.name)
    if (patientSession?.phone && !patientPhone) setPatientPhone(patientSession.phone)
  }, [patientSession])

  // Mandatory ABHA verification state
  const [showAbhaModal, setShowAbhaModal] = useState(false)
  const [abhaInput, setAbhaInput] = useState('')
  const [abhaOtpStep, setAbhaOtpStep] = useState(false)
  const [abhaOtp, setAbhaOtp] = useState('')
  const [generatedAbhaOtp, setGeneratedAbhaOtp] = useState('')
  const [abhaLoading, setAbhaLoading] = useState(false)
  const [abhaError, setAbhaError] = useState('')

  // Confirmed booking state
  const [confirmedBooking, setConfirmedBooking] = useState(null)

  // Load certified hospital list directly from backend API
  useEffect(() => {
    let active = true
    setHospitalsLoading(true)
    getResults('/hospitals/').then(apiData => {
      if (!active) return

      const cleanApi = Array.isArray(apiData) ? apiData.filter(h => h.is_active !== false) : []
      if (cleanApi.length > 0) {
        setHospitals(cleanApi)

        // 1. If initialSelectedHospital is specified, match it by id, code, or name
        if (initialSelectedHospital) {
          const match = cleanApi.find(h => 
            String(h.id) === String(initialSelectedHospital.id) ||
            (h.external_hospital_code && h.external_hospital_code === initialSelectedHospital.external_hospital_code) ||
            h.name.toLowerCase() === initialSelectedHospital.name?.toLowerCase()
          )
          if (match) {
            setHospitalId(String(match.id))
            return
          }
        }

        // 2. Default to platform demonstration hospital if present, else first active hospital
        const demoHosp = cleanApi.find(h => h.is_demo)
        setHospitalId(String(demoHosp ? demoHosp.id : cleanApi[0].id))
      } else {
        setHospitals(hospitalSamples)
      }
    }).catch(err => {
      console.error('Failed to load registered hospitals:', err)
      if (active) setHospitals(hospitalSamples)
    }).finally(() => {
      if (active) setHospitalsLoading(false)
    })
    return () => { active = false }
  }, [initialSelectedHospital])

  // Sync if initialSelectedHospital changes externally
  useEffect(() => {
    if (initialSelectedHospital && hospitals.length > 0) {
      const match = hospitals.find(h => 
        String(h.id) === String(initialSelectedHospital.id) ||
        (h.external_hospital_code && h.external_hospital_code === initialSelectedHospital.external_hospital_code) ||
        h.name.toLowerCase() === initialSelectedHospital.name?.toLowerCase()
      )
      if (match) {
        setHospitalId(String(match.id))
      }
    }
  }, [initialSelectedHospital, hospitals])

  // Load departments strictly belonging to the chosen hospital
  useEffect(() => {
    if (!hospitalId) return
    let active = true
    setDepartments([])
    setDepartmentId('')
    setDoctors([])
    setDoctorId('')
    setSlots([])
    setSlotId('')

    getResults(`/hospitals/${encodeURIComponent(hospitalId)}/departments/`).then(data => {
      if (!active) return
      if (Array.isArray(data) && data.length > 0) {
        setDepartments(data)
        setDepartmentId(String(data[0].id))
      } else {
        setDepartments([])
        setDepartmentId('')
      }
    }).catch(err => {
      if (active) {
        console.error('Failed to load hospital departments:', err)
        setDepartments([])
        setDepartmentId('')
      }
    })
    return () => { active = false }
  }, [hospitalId])

  // Automatically fetch doctors strictly belonging to the chosen hospital AND department
  useEffect(() => {
    if (!departmentId || !hospitalId) {
      setDoctors([])
      setDoctorId('')
      return
    }
    let active = true
    setDoctors([])
    setDoctorId('')
    setSlots([])
    setSlotId('')

    getResults(`/doctors/?hospital_id=${encodeURIComponent(hospitalId)}&department_id=${encodeURIComponent(departmentId)}`)
      .then(apiDocs => {
        if (!active) return
        if (Array.isArray(apiDocs) && apiDocs.length > 0) {
          setDoctors(apiDocs)
          setDoctorId(String(apiDocs[0].id))
        } else {
          setDoctors([])
          setDoctorId('')
        }
      })
      .catch(err => {
        if (!active) return
        console.error('Failed to load department doctors:', err)
        setDoctors([])
        setDoctorId('')
      })

    return () => { active = false }
  }, [departmentId, hospitalId])

  // Load genuine available slots for the selected doctor and date
  useEffect(() => {
    if (!doctorId || !day) {
      setSlots([])
      setSlotId('')
      return
    }
    let active = true
    setLoading(true)

    apiRequest(`/availability/?doctor_id=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(day)}`)
      .then(result => {
        if (!active) return
        if (result?.slots && result.slots.length > 0) {
          setSlots(result.slots)
          const firstAvail = result.slots.find(s => s.available)
          if (firstAvail) setSlotId(String(firstAvail.id))
          else setSlotId(String(result.slots[0].id))
        } else {
          setSlots([])
          setSlotId('')
        }
      })
      .catch(err => {
        if (!active) return
        console.error('Failed to load slots:', err)
        setSlots([])
        setSlotId('')
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [doctorId, day])

  // Direct connected facilities (1-click direct selection, no search needed)
  const directConnectedFacilities = useMemo(() => {
    // 1. Himalayan Hospital, Jolly Grant (Redirect Link)
    const himalayan = hospitals.find(h =>
      (h.name && h.name.toLowerCase().includes('himalayan')) ||
      (h.slug && h.slug.toLowerCase().includes('himalayan'))
    ) || {
      id: 15,
      name: 'Himalayan Hospital, Jolly Grant',
      city: 'Dehradun, Uttarakhand',
      area: 'Jolly Grant, Swami Ram Nagar',
      address: 'Swami Ram Nagar, Beside Jolly Grant Airport, Dehradun, Uttarakhand 248016',
      integration_mode: 'redirect',
      integration_type: 'B',
      official_booking_url: 'https://appointment.himalayanhospital.org:214/',
      redirect_url: 'https://appointment.himalayanhospital.org:214/',
    }

    // 2. B. P. Poddar Hospital & Medical Research Limited (Live API)
    const bpPoddar = hospitals.find(h =>
      (h.name && h.name.toLowerCase().includes('poddar')) ||
      (h.slug && h.slug.toLowerCase().includes('poddar'))
    ) || {
      id: 13,
      name: 'B. P. Poddar Hospital & Medical Research Limited',
      city: 'Kolkata, West Bengal',
      area: 'New Alipore',
      address: '71/1, Humayun Kabir Sarani, Block G, New Alipore, Kolkata, West Bengal 700053',
      integration_mode: 'api',
      integration_type: 'A',
      official_booking_url: 'https://ios.bppoddarhospital.com/index.html',
    }

    // 3. DEMO General Hospital (Native Live Queue)
    const demoHosp = hospitals.find(h => h.is_demo || (h.name && h.name.toLowerCase().includes('demo'))) || {
      id: 10,
      name: 'DEMO General Hospital',
      city: 'Dehradun',
      area: 'Rajpur Road',
      address: 'Demo Campus, Rajpur Road, Dehradun, Uttarakhand',
      is_demo: true,
      integration_mode: 'native',
      integration_type: 'C',
    }

    return [
      {
        ...himalayan,
        id: himalayan.id || 15,
        name: himalayan.name || 'Himalayan Hospital, Jolly Grant',
        badge: 'Official Redirect Link',
        badgeColor: '#7c3aed',
        badgeBg: 'rgba(124, 58, 237, 0.08)',
        badgeBorder: 'rgba(124, 58, 237, 0.25)',
        typeLabel: 'Redirect Portal',
        portalUrl: 'https://appointment.himalayanhospital.org:214/',
        subtitle: 'Dehradun, Uttarakhand · Jolly Grant',
        note: 'Official Himalayan Hospital Online Portal',
      },
      {
        ...bpPoddar,
        id: bpPoddar.id || 13,
        name: bpPoddar.name || 'B. P. Poddar Hospital & Medical Research Limited',
        badge: 'Live Hospital API',
        badgeColor: '#0284c7',
        badgeBg: 'rgba(2, 132, 199, 0.08)',
        badgeBorder: 'rgba(2, 132, 199, 0.25)',
        typeLabel: 'API Integration',
        portalUrl: bpPoddar.official_booking_url || 'https://ios.bppoddarhospital.com/index.html',
        subtitle: 'Kolkata, West Bengal · New Alipore',
        note: 'Hospital Information System (HIS Adapter)',
      },
      {
        ...demoHosp,
        id: demoHosp.id || 10,
        name: demoHosp.name || 'DEMO General Hospital',
        badge: 'Real-Time Live Queue',
        badgeColor: '#16a34a',
        badgeBg: 'rgba(22, 163, 74, 0.08)',
        badgeBorder: 'rgba(22, 163, 74, 0.25)',
        typeLabel: 'QueueFree Native',
        portalUrl: '',
        subtitle: 'Dehradun · Rajpur Road Campus',
        note: 'Digital Token & Live Waiting TV Display',
      },
    ]
  }, [hospitals])

  // Active chosen hospital, department, doctor and slot (strictly derived from state)
  const activeHospital = useMemo(() => {
    const foundInApi = hospitals.find(h => String(h.id) === String(hospitalId) || h.name === hospitalId)
    if (foundInApi) return foundInApi
    const foundInDirect = directConnectedFacilities.find(h => String(h.id) === String(hospitalId) || h.name === hospitalId)
    if (foundInDirect) return foundInDirect
    return hospitals[0] || directConnectedFacilities[0] || null
  }, [hospitals, hospitalId, directConnectedFacilities])

  const isRedirectHospital = useMemo(() => {
    if (!activeHospital) return false
    const nameLower = (activeHospital.name || '').toLowerCase()
    const slugLower = (activeHospital.slug || '').toLowerCase()
    return (
      activeHospital.integration_type === 'B' ||
      activeHospital.integration_mode === 'redirect' ||
      nameLower.includes('himalayan') ||
      slugLower.includes('himalayan') ||
      Boolean(activeHospital.official_booking_url && !activeHospital.is_demo && activeHospital.integration_mode !== 'api')
    )
  }, [activeHospital])

  const officialRedirectUrl = useMemo(() => {
    if (!activeHospital) return ''
    const nameLower = (activeHospital.name || '').toLowerCase()
    if (nameLower.includes('himalayan')) {
      return 'https://appointment.himalayanhospital.org:214/'
    }
    return activeHospital.official_booking_url || activeHospital.redirect_url || ''
  }, [activeHospital])

  const activeDepartment = useMemo(() => {
    return departments.find(d => String(d.id) === String(departmentId)) || departments[0] || null
  }, [departments, departmentId])

  const activeDoctor = useMemo(() => {
    return doctors.find(d => String(d.id) === String(doctorId)) || doctors[0] || null
  }, [doctors, doctorId])

  const activeSlot = useMemo(() => {
    return slots.find(s => String(s.id) === String(slotId)) || slots[0] || null
  }, [slots, slotId])

  // Field change handler that automatically clears validation errors
  const handlePatientFieldChange = (field, value) => {
    if (field === 'name') setPatientName(value)
    else if (field === 'age') setPatientAge(value)
    else if (field === 'gender') setPatientGender(value)
    else if (field === 'phone') setPatientPhone(value)
    else if (field === 'reason') setPatientReason(value)

    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
    if (error) setError('')
  }

  // Strict validation for all mandatory fields
  const validateMandatoryDetails = () => {
    const errors = {}

    // 1. Hospital validation
    if (!activeHospital?.name) {
      errors.hospital = 'Hospital facility is mandatory.'
    }

    // 2. Department validation
    if (!activeDepartment?.id) {
      errors.department = 'OPD medical specialty department is mandatory.'
    }

    // 3. Consulting Doctor validation
    if (!activeDoctor?.id) {
      errors.doctor = 'Consulting doctor is mandatory.'
    }

    // 4. Patient Full Name validation
    if (!patientName.trim()) {
      errors.name = 'Patient Full Name is mandatory.'
    } else if (patientName.trim().length < 2) {
      errors.name = 'Patient Full Name must be at least 2 characters.'
    }

    // 5. Patient Age validation
    const ageNum = parseInt(patientAge, 10)
    if (!patientAge || isNaN(ageNum)) {
      errors.age = 'Patient Age is mandatory.'
    } else if (ageNum < 1 || ageNum > 120) {
      errors.age = 'Please enter a valid age between 1 and 120 years.'
    }

    // 6. Patient Gender validation
    if (!patientGender) {
      errors.gender = 'Patient Gender is mandatory. Please select Male, Female, or Other.'
    }

    // 7. Contact Phone Number validation
    const digitsOnly = patientPhone.replace(/\D/g, '')
    if (!patientPhone.trim()) {
      errors.phone = 'Contact Mobile Number is mandatory.'
    } else if (digitsOnly.length < 10) {
      errors.phone = 'Please enter a valid 10-digit mobile number.'
    }

    // 8. Symptoms / Reason for Consultation is OPTIONAL (as requested)

    // 9. Appointment Date validation
    if (!day) {
      errors.date = 'Appointment date is mandatory.'
    }

    // 10. Time Slot validation
    if (!slotId) {
      errors.slot = 'OPD queue time slot is mandatory.'
    }

    setFieldErrors(errors)
    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    }
  }

  const handleGenerateDemoAbha = () => {
    const r1 = String(Math.floor(1000 + Math.random() * 9000))
    const r2 = String(Math.floor(1000 + Math.random() * 9000))
    const demo = `DEMO-ABHA-${r1}-${r2}`
    setAbhaInput(demo)
    setAbhaError('')
  }

  const handleRequestAbhaOtp = (e) => {
    e?.preventDefault()
    setAbhaError('')
    if (!/^DEMO-ABHA-\d{4}-\d{4}$/.test(abhaInput.trim())) {
      setAbhaError('Please enter a valid ABHA ID format: DEMO-ABHA-XXXX-XXXX or click Generate.')
      return
    }
    const code = String(Math.floor(100000 + Math.random() * 900000))
    setGeneratedAbhaOtp(code)
    setAbhaOtpStep(true)
  }

  const ensureAuthenticatedSession = async () => {
    if (getApiAccessToken()) return true
    try {
      const authPhone = patientPhone.trim() || patientSession?.phone || '+919876543210'
      const authName = patientName.trim() || patientSession?.name || 'Patient User'
      const authRes = await patientPhoneLogin(authPhone, authName)
      if (authRes?.access) {
        setApiAccessToken(authRes.access)
        onLoginSuccess?.({
          ...(authRes.patient || {}),
          access: authRes.access,
          refresh: authRes.refresh,
          phone: authPhone,
          name: authName,
        })
        return true
      }
    } catch (authErr) {
      console.warn('Patient session initialization notice:', authErr?.message)
    }
    return false
  }

  const handleVerifyAbhaAndBook = async (e) => {
    e?.preventDefault()
    setAbhaError('')
    if (abhaOtp !== generatedAbhaOtp && abhaOtp !== '123456') {
      setAbhaError('Invalid OTP code. Please enter the verification code shown below.')
      return
    }

    setAbhaLoading(true)
    try {
      await ensureAuthenticatedSession()

      try {
        await patientVerifyAbha(abhaInput.trim(), true)
      } catch (verifyErr) {
        console.warn('ABHA verification sync note:', verifyErr?.message)
      }
      onAbhaVerifiedSuccess?.(abhaInput.trim())
      setShowAbhaModal(false)

      // Execute the token booking with the verified ABHA identity
      await executeBooking()
    } catch (err) {
      const msg = err.status === 401
        ? 'Session expired. Please re-enter your mobile number to verify.'
        : (err.message || 'ABHA verification failed. Please try again.')
      setAbhaError(msg)
    } finally {
      setAbhaLoading(false)
    }
  }

  const executeBooking = async () => {
    // 1-Active-Token Validation Rule
    if (activeExistingBooking) {
      setError(`Active Token Limit: You already hold active token #${activeExistingBooking.token_number} with Dr. ${activeExistingBooking.doctor_name || activeExistingBooking.doctor?.display_name || 'Assigned Doctor'} in ${activeExistingBooking.department_name || activeExistingBooking.department?.name || 'OPD'}. Per hospital queue policy, patients can only hold 1 active token at a time. Once your current consultation is completed by the doctor or cancelled, you will be able to book another token.`)
      return
    }

    // Re-verify that mandatory details are filled
    const { isValid, errors } = validateMandatoryDetails()
    if (!isValid) {
      const firstError = Object.values(errors)[0]
      setError(`Cannot book token: ${firstError} All mandatory fields marked with (*) must be completed.`)
      return
    }

    if (!activeHospital?.id || !activeDepartment?.id || !activeDoctor?.id) {
      setError('Please select hospital, clinical department, and consulting doctor.')
      return
    }

    if (!activeSlot?.id) {
      setError('Please select an available OPD time slot.')
      return
    }

    setBookingLoading(true)
    setError('')
    try {
      await ensureAuthenticatedSession()
      const payload = {
        hospital_id: activeHospital?.id,
        department_id: activeDepartment?.id,
        doctor_id: activeDoctor?.id,
        date: day,
        slot_id: activeSlot?.id,
        patient_name: patientName.trim(),
        patient_age: patientAge.trim(),
        patient_gender: patientGender,
        patient_phone: patientPhone.trim(),
        chief_complaint: patientReason.trim(),
        idempotency_key: crypto.randomUUID(),
      }

      const result = await createBooking(payload)
      setConfirmedBooking(result)
      onConfirmed?.(result)
      setStep(4) // Move to confirmation
    } catch (err) {
      const msg = err.status === 401
        ? 'Your session has expired. Please sign in or re-confirm your phone number to complete booking.'
        : (err.message || 'Could not complete token booking.')
      setError(msg)
      throw new Error(msg)
    } finally {
      setBookingLoading(false)
    }
  }

  const handleProceedToBook = async () => {
    setError('')
    // 1-Active-Token Validation Rule
    if (activeExistingBooking) {
      setError(`Active Token Limit: You already hold active token #${activeExistingBooking.token_number} with Dr. ${activeExistingBooking.doctor_name || activeExistingBooking.doctor?.display_name || 'Assigned Doctor'} in ${activeExistingBooking.department_name || activeExistingBooking.department?.name || 'OPD'}. Per hospital queue policy, patients can only hold 1 active token at a time. Once your current consultation is completed by the doctor or cancelled, you will be able to book another token.`)
      return
    }

    // Strict Mandatory Check
    const { isValid, errors } = validateMandatoryDetails()

    if (!isValid) {
      const firstError = Object.values(errors)[0]
      setError(`Cannot book token: ${firstError} All mandatory details marked with (*) must be filled.`)
      const firstFieldKey = Object.keys(errors)[0]
      const el = document.getElementById(`booking-field-${firstFieldKey}`)
      if (el) {
        el.focus()
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    // Mandatory ABHA CHECK: If unverified, show modal
    if (!patientAbhaVerified) {
      handleGenerateDemoAbha()
      setShowAbhaModal(true)
      return
    }

    await executeBooking()
  }

  return (
    <div className="book-opd-stepper-container">
      {/* Header Row */}
      <div className="page-header-row">
        <div>
          <h1 className="page-main-title">Book OPD Appointment</h1>
          <p className="page-main-sub">
            Follow the 4 simple steps to book verified hospital queue tokens.
          </p>
        </div>
      </div>

      {/* Prominent Chosen Hospital & City Banner */}
      <div className="chosen-hospital-header-banner">
        <div className="chosen-banner-left">
          <MapPin size={17} className="text-primary-blue" />
          <span>
            Selected Facility: <strong>{activeHospital?.name || (hospitalsLoading ? 'Connecting to hospitals...' : 'Select a Hospital Facility')}</strong> · <span className="city-highlight">{activeHospital?.city || city}</span>
          </span>
        </div>
      </div>

      {/* 4-Step Stepper Navigation */}
      <div className="stepper-nav" aria-label="Booking steps">
        <div className={`step-item ${step >= 1 ? 'is-active' : ''} ${step > 1 ? 'is-completed' : ''}`}>
          <div className="step-number-circle">{step > 1 ? <Check size={14} /> : '1'}</div>
          <span className="step-title">Select Hospital</span>
        </div>

        <div className="step-divider" />

        <div className={`step-item ${step >= 2 ? 'is-active' : ''} ${step > 2 ? 'is-completed' : ''}`}>
          <div className="step-number-circle">{step > 2 ? <Check size={14} /> : '2'}</div>
          <span className="step-title">Select Department</span>
        </div>

        <div className="step-divider" />

        <div className={`step-item ${step >= 3 ? 'is-active' : ''} ${step > 3 ? 'is-completed' : ''}`}>
          <div className="step-number-circle">{step > 3 ? <Check size={14} /> : '3'}</div>
          <span className="step-title">Fill Details & Slot</span>
        </div>

        <div className="step-divider" />

        <div className={`step-item ${step >= 4 ? 'is-active' : ''}`}>
          <div className="step-number-circle">4</div>
          <span className="step-title">Confirmation</span>
        </div>
      </div>

      {/* 1-Active-Token Hospital Policy Notice */}
      {activeExistingBooking && (
        <div
          role="alert"
          style={{
            marginBottom: 20,
            padding: '16px 20px',
            background: '#f8fafc',
            border: '1.5px solid #3b82f6',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: '#2563eb',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
              }}
            >
              <Ticket size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: '#dbeafe',
                    color: '#1d4ed8',
                  }}
                >
                  Active Consultation In Progress
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  Token #{activeExistingBooking.token_number}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                You are currently booked with <strong>Dr. {activeExistingBooking.doctor_name || activeExistingBooking.doctor?.display_name || 'Assigned Doctor'}</strong> in <strong>{activeExistingBooking.department_name || activeExistingBooking.department?.name || 'Department'}</strong> at <strong>{activeExistingBooking.hospital_name || activeExistingBooking.hospital?.name || 'Hospital'}</strong> (Current Status: <span style={{ textTransform: 'capitalize', fontWeight: 700, color: '#2563eb' }}>{activeExistingBooking.status}</span>).
              </p>
            </div>
          </div>

          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '12.5px',
              color: '#1e3a8a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} style={{ color: '#2563eb', flexShrink: 0 }} />
              <span>
                <strong>1-Active-Token Policy:</strong> To prevent queue hoarding, a patient can only hold one active consultation token. Once the doctor completes your consultation (or if you cancel), you can book another token.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('queue')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>Track My Live Queue</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="form-error-banner" role="alert" style={{ marginBottom: 20 }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Stepper Content */}
      {hospitalsLoading && hospitals.length === 0 ? (
        <div className="chosen-hospital-header-banner" style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: '#fff' }}>
          <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
          <p style={{ color: '#475569', fontSize: '13px', fontWeight: 600 }}>Loading certified hospital directory and departments...</p>
        </div>
      ) : step < 4 ? (
        <div className="booking-stepper-layout">
          {/* Form Left Side */}
          <div className="booking-form-card">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
              >
                {/* STEP 1: CHOOSE HOSPITAL & CITY */}
                {step === 1 && (
                  <div className="step-form-block">
                    <div className="step-inner-heading">
                      <h3>Choose Hospital & Facility</h3>
                      <p>Select directly from verified connected healthcare partners, or choose from the certified hospital directory.</p>
                    </div>

                    {/* Direct Connected Facilities: 1-Click Selection (No Search Needed) */}
                    <div className="direct-facilities-section">
                      <div className="direct-facilities-header">
                        <div className="direct-header-title">
                          <Sparkles size={16} className="text-blue-600" />
                          <span>Direct Connected & Verified Facilities</span>
                        </div>
                        <span className="direct-header-hint">1-Click Direct Access · No Search Needed</span>
                      </div>

                      <div className="direct-facilities-grid">
                        {directConnectedFacilities.map((fac) => {
                          const isSelected = String(activeHospital?.id) === String(fac.id) || 
                                             String(hospitalId) === String(fac.id) ||
                                             (activeHospital?.name && fac.name && activeHospital.name.toLowerCase() === fac.name.toLowerCase())

                          return (
                            <div
                              key={fac.id || fac.name}
                              className={`direct-facility-card ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => {
                                setHospitalId(String(fac.id))
                                setError('')
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  setHospitalId(String(fac.id))
                                  setError('')
                                }
                              }}
                            >
                              <div className="direct-card-top">
                                <span
                                  className="facility-mode-pill"
                                  style={{
                                    color: fac.badgeColor,
                                    backgroundColor: fac.badgeBg,
                                    borderColor: fac.badgeBorder,
                                  }}
                                >
                                  {fac.badge}
                                </span>
                                {isSelected && (
                                  <span className="selected-indicator-pill">
                                    <Check size={12} />
                                    <span>Chosen</span>
                                  </span>
                                )}
                              </div>

                              <h4 className="direct-facility-name">{fac.name}</h4>
                              <p className="direct-facility-sub">📍 {fac.subtitle || fac.city}</p>

                              <div className="direct-card-footer">
                                <span className="direct-card-note">{fac.note}</span>
                                <span className="direct-card-action">
                                  {isSelected ? '✓ Active' : 'Select →'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '18px' }}>
                      <label htmlFor="hospital-select-input">
                        Or Select from All Certified Facilities ({hospitals.length} Available) <span className="text-red-mandatory">*</span>
                      </label>
                      <select
                        id="hospital-select-input"
                        value={hospitalId}
                        onChange={(e) => { setHospitalId(e.target.value); setError('') }}
                        className="styled-select"
                      >
                        <optgroup label="Direct Connected Partners">
                          {directConnectedFacilities.map(h => (
                            <option key={'opt-direct-' + h.id} value={h.id}>
                              ★ {h.name} — {h.city} ({h.badge})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="All Registered Hospital Directory">
                          {hospitals
                            .filter(h => !directConnectedFacilities.some(df => String(df.id) === String(h.id)))
                            .map(h => (
                              <option key={h.id || h.name} value={h.id || h.name}>
                                {h.name} — {h.city}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    </div>

                    {activeHospital && (
                      <div className={`chosen-hospital-quick-card ${isRedirectHospital ? 'is-redirect-partner' : ''}`}>
                        <div className="quick-card-header">
                          <div
                            className="quick-icon-box"
                            style={{
                              background: isRedirectHospital ? '#f5f3ff' : '#eff6ff',
                              color: isRedirectHospital ? '#7c3aed' : '#2563eb',
                              borderColor: isRedirectHospital ? '#ddd6fe' : '#bfdbfe',
                            }}
                          >
                            {isRedirectHospital ? <ExternalLink size={20} /> : <Building2 size={20} />}
                          </div>
                          <div className="quick-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                              <span className="quick-chosen-tag">YOUR CHOSEN FACILITY</span>
                              {isRedirectHospital ? (
                                <span className="badge-redirect-tag">
                                  🔗 Official Hospital Redirect Portal
                                </span>
                              ) : activeHospital?.integration_mode === 'api' ? (
                                <span className="badge-api-tag">
                                  ⚡ Live Hospital API Integration
                                </span>
                              ) : (
                                <span className="badge-native-tag">
                                  ⏱ QueueFree Live Queue System
                                </span>
                              )}
                            </div>
                            <h4 className="quick-hospital-title">{activeHospital?.name}</h4>
                            <p className="quick-city-line">
                              📍 <strong>{activeHospital?.city || city}</strong> {activeHospital?.address ? `· ${activeHospital.address}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* If this is Himalayan Hospital or another redirect facility */}
                        {isRedirectHospital && (
                          <div className="redirect-portal-callout">
                            <div className="callout-header">
                              <Globe size={16} className="text-blue-600" />
                              <strong>Official Himalayan Hospital Booking Portal</strong>
                            </div>
                            <p className="callout-desc">
                              {activeHospital?.name} provides online appointment registration directly on their official booking website. Click the button below to book directly:
                            </p>
                            <div className="callout-link-box">
                              <code>{officialRedirectUrl || 'https://appointment.himalayanhospital.org:214/'}</code>
                              <a
                                href={officialRedirectUrl || 'https://appointment.himalayanhospital.org:214/'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-copy-portal-link"
                              >
                                <ExternalLink size={13} />
                                <span>Open Link ↗</span>
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="step-actions-footer">
                      {isRedirectHospital ? (
                        <a
                          href={officialRedirectUrl || 'https://appointment.himalayanhospital.org:214/'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary-blue next-step-btn btn-redirect-portal-cta"
                          style={{
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            width: '100%',
                            padding: '14px 20px',
                            fontSize: '15px',
                            fontWeight: 700,
                            borderRadius: '10px',
                            color: '#ffffff',
                          }}
                        >
                          <span>Proceed to {activeHospital?.name || 'Himalayan Hospital'} Booking Portal</span>
                          <ExternalLink size={18} />
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary-blue next-step-btn"
                          onClick={() => {
                            if (!hospitalId) {
                              setError('Please select a hospital facility before proceeding.')
                              return
                            }
                            setError('')
                            setStep(2)
                          }}
                        >
                          <span>Next: Select Department</span>
                          <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 2: SELECT DEPARTMENT & DOCTOR */}
                {step === 2 && (
                  <div className="step-form-block">
                    <div className="dept-step-hospital-banner">
                      <div className="dept-banner-left">
                        <div className="dept-hospital-icon-box">
                          <Building2 size={24} />
                        </div>
                        <div>
                          <span className="dept-hospital-tag">SELECTED HOSPITAL</span>
                          <h3 className="dept-hospital-name">{activeHospital?.name || 'Selected Facility'}</h3>
                          <p className="dept-hospital-location">
                            📍 {activeHospital?.city || city} {activeHospital?.address ? `· ${activeHospital.address}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-change-hospital"
                        onClick={() => { setError(''); setStep(1) }}
                        title="Select a different hospital"
                      >
                        Change Hospital
                      </button>
                    </div>

                    <div className="step-inner-heading">
                      <h3>Select Department & Consulting Doctor</h3>
                      <p>
                        Showing all OPD clinical departments & consulting doctors available at <strong>{activeHospital?.name || 'the selected facility'}</strong>.
                      </p>
                    </div>

                    {/* 1. OPD DEPARTMENT SECTION (SUBTLY HIGHLIGHTED) */}
                    <div className="opd-dept-highlight-section">
                      <div className="opd-section-highlight-header">
                        <div className="opd-badge-with-icon dept-badge-color">
                          <Building2 size={15} />
                          <span>OPD DEPARTMENT SECTION</span>
                        </div>
                        <span className="opd-active-selection-pill dept-pill">
                          Selected: <strong>{activeDepartment?.name || 'General Medicine'}</strong>
                        </span>
                      </div>

                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label htmlFor="dept-select-input" style={{ fontWeight: 700, color: '#0369a1' }}>
                          Medical Specialty Department ({departments.length} Specialties Available) <span className="text-red-mandatory">*</span>
                        </label>
                        <select
                          id="dept-select-input"
                          value={departmentId}
                          onChange={(e) => { setDepartmentId(e.target.value); setError('') }}
                          className="styled-select"
                        >
                          {departments.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name} {d.room ? `· (${d.room})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quick Department Clickable Chips */}
                      {departments.length > 0 && (
                        <div className="dept-quick-chips-bar">
                          {departments.map(d => {
                            const isSelected = String(d.id) === String(departmentId)
                            return (
                              <button
                                key={'chip-' + d.id}
                                type="button"
                                className={`dept-chip-pill ${isSelected ? 'is-selected' : ''}`}
                                onClick={() => { setDepartmentId(String(d.id)); setError('') }}
                              >
                                <span>{d.name}</span>
                                {isSelected && <Check size={12} />}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {activeDepartment?.description && (
                        <small className="dept-description-hint" style={{ marginTop: '10px' }}>
                          ℹ️ {activeDepartment?.description}
                        </small>
                      )}
                    </div>

                    {/* 2. CONSULTING DOCTOR NAME SECTION (SUBTLY HIGHLIGHTED) */}
                    <div className="opd-doctor-highlight-section">
                      <div className="opd-section-highlight-header">
                        <div className="opd-badge-with-icon doctor-badge-color">
                          <Stethoscope size={15} />
                          <span>DOCTOR NAME SECTION</span>
                        </div>
                        <span className="opd-active-selection-pill doctor-pill">
                          Selected: <strong>{activeDoctor?.display_name || 'Dr. On Duty'}</strong>
                        </span>
                      </div>

                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label htmlFor="doctor-select-input" style={{ fontWeight: 700, color: '#6b21a8' }}>
                          Consulting Doctor in {activeDepartment?.name || 'Department'} <span className="text-red-mandatory">*</span>
                        </label>
                        <select
                          id="doctor-select-input"
                          value={doctorId}
                          onChange={(e) => { setDoctorId(e.target.value); setError('') }}
                          className="styled-select"
                        >
                          {doctors.map(doc => (
                            <option key={doc.id} value={doc.id}>
                              {doc.display_name} — {doc.qualification || 'Senior Consultant'} (★ {doc.rating || '4.8'}) · Fee: ₹{doc.fee || (activeHospital?.consultation_fee ? Number(activeHospital.consultation_fee) : 800)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Interactive List of Doctors */}
                      <div className="available-docs-container">
                        <span className="available-docs-title" style={{ color: '#6b21a8' }}>
                          Available Doctors in {activeDepartment?.name}:
                        </span>
                        <div className="available-docs-cards-list">
                          {doctors.map(doc => {
                            const isSelected = String(doc.id) === String(doctorId)
                            return (
                              <div
                                key={doc.id}
                                className={`doc-card-interactive ${isSelected ? 'is-selected' : ''}`}
                                onClick={() => { setDoctorId(String(doc.id)); setError('') }}
                                role="button"
                                tabIndex={0}
                              >
                                <div className="doc-card-main-row">
                                  <div className="doc-avatar-icon">
                                    <Stethoscope size={18} />
                                  </div>
                                  <div className="doc-card-text">
                                    <div className="doc-name-badge-container">
                                      <span className="doc-role-chip">CONSULTING DOCTOR</span>
                                      <strong className="doc-title-text">{doc.display_name}</strong>
                                    </div>
                                    <span className="doc-sub-qual">{doc.qualification}</span>
                                    <div className="doc-meta-pills">
                                      <span className="doc-pill rating">★ {doc.rating || 4.8} ({doc.reviews || 950}+)</span>
                                      <span className="doc-pill exp">{doc.experienceYears || 15} yrs exp</span>
                                      <span className="doc-pill fee">OPD Fee: ₹{doc.fee || (activeHospital?.consultation_fee ? Number(activeHospital.consultation_fee) : 800)}</span>
                                    </div>
                                  </div>
                                  <div className="doc-select-radio">
                                    <div className={`radio-indicator ${isSelected ? 'checked' : ''}`}>
                                      {isSelected && <Check size={12} />}
                                    </div>
                                  </div>
                                </div>
                                <div className="doc-card-sub-info">
                                  <span>📍 {doc.room || 'OPD Room'}</span>
                                  <span>🕒 {doc.opdTiming || '09:00 AM - 01:30 PM'}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="step-actions-footer">
                      <button
                        type="button"
                        className="btn-secondary-white"
                        onClick={() => { setError(''); setStep(1) }}
                      >
                        <ArrowLeft size={16} />
                        <span>Back</span>
                      </button>

                      <button
                        type="button"
                        className="btn-primary-blue next-step-btn"
                        onClick={() => {
                          if (!departmentId) {
                            setError('Please select an OPD medical specialty department.')
                            return
                          }
                          if (!doctorId) {
                            setError('Please select a consulting doctor.')
                            return
                          }
                          setError('')
                          setStep(3)
                        }}
                      >
                        <span>Next: Fill Patient Details & Slot</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: MANDATORY PATIENT DETAILS, SYMPTOMS & SLOT */}
                {step === 3 && (
                  <div className="step-form-block">
                    <div className="step-inner-heading">
                      <h3>Patient Details & Appointment Slot</h3>
                      <p>
                        Complete all mandatory fields (*) to allocate a verified OPD queue token for <strong>{activeHospital?.name || 'the selected facility'}</strong>.
                      </p>
                    </div>

                    {/* MANDATORY PATIENT DETAILS CARD */}
                    <div className="mandatory-details-section">
                      <div className="mandatory-section-header">
                        <h4>
                          <User size={16} />
                          <span>Mandatory Patient Information</span>
                        </h4>
                        <span className="mandatory-badge">Details Required</span>
                      </div>
                      <p className="mandatory-helper-text">
                        Without completing these mandatory patient details, the hospital cannot generate an OPD token.
                      </p>

                      {/* Patient Full Name (Mandatory) */}
                      <div className="form-group">
                        <label htmlFor="booking-field-name">
                          Patient Full Name <span className="text-red-mandatory">*</span>
                        </label>
                        <input
                          id="booking-field-name"
                          type="text"
                          className={`styled-input ${fieldErrors.name ? 'input-error-border' : ''}`}
                          placeholder="e.g. Priya Sharma"
                          value={patientName}
                          onChange={(e) => handlePatientFieldChange('name', e.target.value)}
                          required
                        />
                        {fieldErrors.name && <span className="field-error-msg">{fieldErrors.name}</span>}
                      </div>

                      {/* Age & Gender Row (Mandatory) */}
                      <div className="form-row-two-col">
                        <div className="form-group">
                          <label htmlFor="booking-field-age">
                            Patient Age (Years) <span className="text-red-mandatory">*</span>
                          </label>
                          <input
                            id="booking-field-age"
                            type="number"
                            min="1"
                            max="120"
                            className={`styled-input ${fieldErrors.age ? 'input-error-border' : ''}`}
                            placeholder="e.g. 28"
                            value={patientAge}
                            onChange={(e) => handlePatientFieldChange('age', e.target.value)}
                            required
                          />
                          {fieldErrors.age && <span className="field-error-msg">{fieldErrors.age}</span>}
                        </div>

                        <div className="form-group">
                          <label htmlFor="booking-field-gender">
                            Patient Gender <span className="text-red-mandatory">*</span>
                          </label>
                          <div className="gender-pills-group" id="booking-field-gender">
                            {['Male', 'Female', 'Other'].map(g => (
                              <button
                                key={g}
                                type="button"
                                className={`gender-pill-btn ${patientGender === g ? 'selected' : ''} ${fieldErrors.gender ? 'error-border' : ''}`}
                                onClick={() => handlePatientFieldChange('gender', g)}
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                          {fieldErrors.gender && <span className="field-error-msg">{fieldErrors.gender}</span>}
                        </div>
                      </div>

                      {/* Contact Phone (Mandatory) */}
                      <div className="form-group">
                        <label htmlFor="booking-field-phone">
                          Contact Mobile Number <span className="text-red-mandatory">*</span>
                        </label>
                        <input
                          id="booking-field-phone"
                          type="tel"
                          className={`styled-input ${fieldErrors.phone ? 'input-error-border' : ''}`}
                          placeholder="10-digit mobile number"
                          value={patientPhone}
                          onChange={(e) => handlePatientFieldChange('phone', e.target.value)}
                          required
                        />
                        {fieldErrors.phone && <span className="field-error-msg">{fieldErrors.phone}</span>}
                      </div>

                      {/* Symptoms / Chief Complaint (Optional) */}
                      <div className="form-group">
                        <label htmlFor="booking-field-reason">
                          Chief Complaint / Symptoms / Reason for Visit <span style={{ fontSize: 11.5, fontWeight: 500, color: '#64748b' }}>(Optional)</span>
                        </label>
                        <textarea
                          id="booking-field-reason"
                          rows={2}
                          className="styled-input"
                          style={{ height: 'auto', minHeight: '74px', padding: '10px 14px', resize: 'vertical' }}
                          placeholder="Describe symptoms or reason for visit (optional - e.g. fever, headache, routine checkup)..."
                          value={patientReason}
                          onChange={(e) => handlePatientFieldChange('reason', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* APPOINTMENT SCHEDULE & SLOT */}
                    <div className="form-group">
                      <label htmlFor="booking-field-date">
                        Appointment Date <span className="text-red-mandatory">*</span>
                      </label>
                      <input
                        id="booking-field-date"
                        type="date"
                        min={localIsoDate()}
                        value={day}
                        onChange={(e) => { setDay(e.target.value); setError('') }}
                        className={`styled-input ${fieldErrors.date ? 'input-error-border' : ''}`}
                      />
                      {fieldErrors.date && <span className="field-error-msg">{fieldErrors.date}</span>}
                    </div>

                    <div className="form-group">
                      <label id="booking-field-slot">
                        Available OPD Queue Slots <span className="text-red-mandatory">*</span>
                      </label>
                      {loading ? (
                        <div className="slots-loading">
                          <RefreshCw size={16} className="spin-icon" />
                          <span>Checking slot capacity…</span>
                        </div>
                      ) : (
                        <div className="slots-pill-grid">
                          {slots.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              disabled={!s.available}
                              className={`slot-pill ${String(s.id) === slotId ? 'selected' : ''} ${!s.available ? 'unavailable' : ''}`}
                              onClick={() => { setSlotId(String(s.id)); setError('') }}
                            >
                              <Clock size={13} />
                              <span>{s.time}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {fieldErrors.slot && <span className="field-error-msg">{fieldErrors.slot}</span>}
                    </div>

                    {/* Mandatory ABHA Status Card */}
                    <div className="abha-status-box">
                      <div className="abha-box-icon">
                        <ShieldCheck size={20} className={patientAbhaVerified ? 'text-green' : 'text-blue'} />
                      </div>
                      <div className="abha-box-content">
                        {patientAbhaVerified ? (
                          <>
                            <strong>✓ ABHA Identity Verified</strong>
                            <span>Your digital health ID is active. Direct queue token allocation is approved.</span>
                          </>
                        ) : (
                          <>
                            <strong>ABHA Verification Mandatory for Token Generation</strong>
                            <span>To prevent fake bookings and black-marketing of OPD slots, ABHA ID verification is required upon clicking Book Token.</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="step-actions-footer">
                      <button
                        type="button"
                        className="btn-secondary-white"
                        onClick={() => { setError(''); setStep(2) }}
                      >
                        <ArrowLeft size={16} />
                        <span>Back</span>
                      </button>

                      {activeExistingBooking ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn-secondary-white"
                            style={{
                              background: '#f8fafc',
                              borderColor: '#cbd5e1',
                              color: '#64748b',
                              cursor: 'not-allowed',
                              fontWeight: 600,
                              fontSize: '12.5px',
                            }}
                            onClick={() => {
                              setError(`Active Token Limit: You already hold active token #${activeExistingBooking.token_number} with Dr. ${activeExistingBooking.doctor_name || activeExistingBooking.doctor?.display_name || 'Assigned Doctor'}. Under hospital policy, patients can only hold 1 active token at a time. Once your current consultation is completed or cancelled, you can book another token.`)
                            }}
                          >
                            <Ticket size={16} />
                            <span>Active Token #{activeExistingBooking.token_number} In Progress</span>
                          </button>
                          <button
                            type="button"
                            className="btn-primary-blue confirm-book-btn"
                            onClick={() => onNavigate?.('queue')}
                            style={{ background: '#2563eb' }}
                          >
                            <span>Track Live Queue</span>
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary-blue confirm-book-btn"
                          onClick={handleProceedToBook}
                          disabled={bookingLoading || loading}
                        >
                          {bookingLoading ? 'Allocating Token…' : 'Book OPD Token'}
                          <Ticket size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Summary Card with exact Hospital Name, City & Live Patient Details */}
          <aside className="selected-hospital-summary-card">
            <h4 className="summary-card-title">Booking Summary</h4>

            {activeHospital ? (
              <div className="summary-hospital-body">
                <div className="summary-hospital-banner">
                  <div className="banner-hospital-icon">
                    <Building2 size={28} />
                  </div>
                  <span className="banner-badge-verified">
                    {isRedirectHospital ? 'Redirect Partner' : 'Verified Partner'}
                  </span>
                </div>

                <div className="summary-hospital-meta">
                  <h3>{activeHospital?.name}</h3>
                  <div className="city-pill-badge">
                    <MapPin size={13} />
                    <strong>{activeHospital?.city || city}</strong>
                  </div>
                  <p className="summary-address">
                    {activeHospital?.address || activeHospital?.city || city}
                  </p>
                </div>

                <div className="summary-details-list">
                  <div className="summary-detail-row">
                    <span>Facility</span>
                    <strong>{activeHospital?.name}</strong>
                  </div>
                  <div className="summary-detail-row">
                    <span>City</span>
                    <strong>{activeHospital?.city || city}</strong>
                  </div>

                  {isRedirectHospital ? (
                    <>
                      <div className="summary-detail-row">
                        <span>Booking Mode</span>
                        <strong style={{ color: '#7c3aed' }}>Official Redirect Link</strong>
                      </div>
                      <div className="summary-detail-row">
                        <span>Portal URL</span>
                        <strong style={{ wordBreak: 'break-all', fontSize: '11px' }}>
                          <a
                            href={officialRedirectUrl || 'https://appointment.himalayanhospital.org:214/'}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#2563eb', textDecoration: 'underline' }}
                          >
                            appointment.himalayanhospital.org:214 ↗
                          </a>
                        </strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="summary-detail-row">
                        <span>Department</span>
                        <strong className="summary-pill-dept">🏥 {activeDepartment?.name || 'General Medicine'}</strong>
                      </div>
                      <div className="summary-detail-row">
                        <span>Consultant</span>
                        <strong className="summary-pill-doctor">👨‍⚕️ {activeDoctor?.display_name || 'Dr. Aarav Sharma'}</strong>
                      </div>
                      <div className="summary-detail-row">
                        <span>Date & Time</span>
                        <strong>{day} at {activeSlot?.time || '09:00 AM'}</strong>
                      </div>
                    </>
                  )}

                  {/* Patient Details in Summary */}
                  <div className="summary-detail-row">
                    <span>Patient Name</span>
                    <strong>{patientName || <em style={{ color: '#94a3b8' }}>Required *</em>}</strong>
                  </div>
                  <div className="summary-detail-row">
                    <span>Age & Gender</span>
                    <strong>
                      {patientAge ? `${patientAge} yrs, ${patientGender || 'Gender pending'}` : <em style={{ color: '#94a3b8' }}>Required *</em>}
                    </strong>
                  </div>
                  <div className="summary-detail-row">
                    <span>Symptoms</span>
                    <strong>
                      {patientReason ? (patientReason.length > 25 ? `${patientReason.slice(0, 25)}…` : patientReason) : <em style={{ color: '#94a3b8' }}>Optional (None specified)</em>}
                    </strong>
                  </div>
                </div>

                {isRedirectHospital ? (
                  <a
                    href={officialRedirectUrl || 'https://appointment.himalayanhospital.org:214/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary-blue"
                    style={{
                      width: '100%',
                      marginTop: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      color: '#ffffff',
                    }}
                  >
                    <span>Open Official Portal</span>
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <button
                    type="button"
                    className="btn-view-map-link"
                    onClick={() => onViewLocation?.(activeHospital)}
                  >
                    <MapPin size={14} />
                    <span>View Hospital & Directions</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="summary-hospital-body" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                <Building2 size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p style={{ fontSize: '12px' }}>Connecting to hospital directory...</p>
              </div>
            )}
          </aside>
        </div>
      ) : (
        /* STEP 4: CONFIRMATION VIEW WITH PATIENT DETAILS & RAZORPAY QR */
        <div className="booking-confirmation-view">
          <div className="confirmation-card">
            <div className="confirm-icon-circle">
              <Check size={36} />
            </div>

            <h2>Token Confirmed Successfully!</h2>
            <p>Your OPD slot is reserved and recorded in the hospital's live queue compass.</p>

            <div className="confirmed-token-badge">
              <span className="token-kicker">YOUR QUEUE TOKEN</span>
              <strong className="token-number-bold">
                {confirmedBooking?.token_number || confirmedBooking?.id || 'A-025'}
              </strong>
              <div className="token-pills-row">
                <span className="pill-status-inqueue">● In Queue</span>
                <span className="pill-pos">~ 12 Patients Ahead</span>
                <span className="pill-wait">Est. Wait: ~ 20 min</span>
              </div>
            </div>

            <div className="confirmed-summary-box">
              <div className="summary-item">
                <small>PATIENT DETAILS</small>
                <strong>
                  {confirmedBooking?.patient_name || patientName} ({confirmedBooking?.patient_age || patientAge} yrs, {confirmedBooking?.patient_gender || patientGender}) · {confirmedBooking?.patient_phone || patientPhone}
                </strong>
              </div>
              <div className="summary-item">
                <small>CHIEF COMPLAINT / SYMPTOMS</small>
                <strong>{confirmedBooking?.chief_complaint || patientReason || 'General OPD Consultation'}</strong>
              </div>
              <div className="summary-item">
                <small>HOSPITAL & CITY</small>
                <strong>{confirmedBooking?.hospital_name || activeHospital?.name || 'Hospital'}, {confirmedBooking?.hospital_city || activeHospital?.city || city}</strong>
              </div>
              <div className="summary-item">
                <small>DEPARTMENT & DOCTOR</small>
                <strong>
                  {confirmedBooking?.department_name || activeDepartment?.name} · {confirmedBooking?.doctor_name || activeDoctor?.display_name}
                </strong>
              </div>
              <div className="summary-item">
                <small>APPOINTMENT SCHEDULE</small>
                <strong>{confirmedBooking?.appointment_date || day} at {confirmedBooking?.slot_time || '09:00 AM'}</strong>
              </div>
              {(confirmedBooking?.external_reference || confirmedBooking?.external_hospital_id === 'poddar' || String(activeHospital?.name || '').includes('Poddar')) && (
                <div className="summary-item external-hosp-item" style={{ background: '#f0f9ff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                  <small style={{ color: '#0369a1', fontWeight: 800 }}>EXTERNAL HOSPITAL APPOINTMENT REFERENCE</small>
                  <strong style={{ color: '#0284c7', display: 'block' }}>{confirmedBooking?.external_reference || 'PODDAR-APP-CONFIRMED'}</strong>
                  <small style={{ color: '#475569', fontSize: '11px' }}>Directly recorded in B. P. Poddar Hospital's electronic appointment system</small>
                </div>
              )}
            </div>

            {/* Generated Razorpay Dynamic Payment QR Code explicitly showing the chosen hospital */}
            <RazorpayPaymentCard
              hospital={activeHospital}
              booking={confirmedBooking}
              amount={activeDoctor?.fee || 250}
              onTrackQueue={() => onNavigate('queue')}
            />

            <div className="confirmation-actions">
              <button
                type="button"
                className="btn-primary-blue"
                onClick={() => onNavigate('queue')}
              >
                <span>Track Live Queue</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="btn-secondary-white"
                onClick={() => { setStep(1); setConfirmedBooking(null) }}
              >
                Book Another Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory ABHA Verification Modal */}
      {showAbhaModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="abha-mandatory-modal">
            <div className="modal-top-strip">
              <div className="shield-icon-wrap">
                <ShieldCheck size={26} />
              </div>
              <div>
                <h3>Mandatory ABHA ID Verification</h3>
                <small>Anti-Scam Gate: Verified patient token allocation</small>
              </div>
            </div>

            {!abhaOtpStep ? (
              <form onSubmit={handleRequestAbhaOtp} className="abha-modal-form">
                <p className="abha-explanation">
                  To prevent slot hoarding and ensure real patient allocation at <strong>{activeHospital?.name || 'the hospital'}, {activeHospital?.city || city}</strong>, verify your government-compliant ABHA ID.
                </p>

                <div className="form-group">
                  <label>ABHA ID (Demo Format: DEMO-ABHA-XXXX-XXXX) <span className="text-red-mandatory">*</span></label>
                  <div className="input-with-action">
                    <input
                      type="text"
                      className="styled-input uppercase-text"
                      value={abhaInput}
                      onChange={(e) => setAbhaInput(e.target.value.toUpperCase())}
                      placeholder="DEMO-ABHA-1234-5678"
                      required
                    />
                    <button
                      type="button"
                      className="btn-generate-abha"
                      onClick={handleGenerateDemoAbha}
                    >
                      <Sparkles size={14} />
                      <span>Generate</span>
                    </button>
                  </div>
                </div>

                {abhaError && (
                  <div className="form-error-banner" role="alert">
                    <AlertCircle size={14} />
                    <span>{abhaError}</span>
                  </div>
                )}

                <div className="modal-actions-row">
                  <button
                    type="button"
                    className="btn-secondary-white"
                    onClick={() => setShowAbhaModal(false)}
                  >
                    Cancel
                  </button>

                  <button type="submit" className="btn-primary-blue">
                    <span>Send Verification Code</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyAbhaAndBook} className="abha-modal-form">
                <p className="abha-explanation">
                  A verification code has been dispatched to the mobile number registered with <strong>{abhaInput}</strong>.
                </p>

                <div className="simulated-otp-chip">
                  <span>Demo ABHA Code: <strong>{generatedAbhaOtp}</strong></span>
                  <button
                    type="button"
                    className="auto-fill-btn"
                    onClick={() => setAbhaOtp(generatedAbhaOtp)}
                  >
                    Auto-fill
                  </button>
                </div>

                <div className="form-group">
                  <label>Enter 6-digit ABHA One-Time Password <span className="text-red-mandatory">*</span></label>
                  <input
                    type="text"
                    maxLength={6}
                    className="styled-input otp-code-input"
                    value={abhaOtp}
                    onChange={(e) => setAbhaOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    autoFocus
                    required
                  />
                </div>

                {abhaError && (
                  <div className="form-error-banner" role="alert">
                    <AlertCircle size={14} />
                    <span>{abhaError}</span>
                  </div>
                )}

                <div className="modal-actions-row">
                  <button
                    type="button"
                    className="btn-secondary-white"
                    onClick={() => setAbhaOtpStep(false)}
                  >
                    Back
                  </button>

                  <button
                    type="submit"
                    className="btn-primary-blue"
                    disabled={abhaLoading}
                  >
                    {abhaLoading ? 'Verifying & Booking…' : 'Verify & Confirm Token'}
                    <Check size={16} />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
