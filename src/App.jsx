import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, X, LayoutDashboard, CalendarPlus, Users, MapPin, User, Siren, FileText } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { useLenisSmoothScroll } from './lib/lenisSmoothScroll'
import { PageTransition } from './components/ui/AceternityCards'

// Layout components
import { PatientSidebar } from './components/layout/PatientSidebar'
import { PatientTopBar } from './components/layout/PatientTopBar'
import { IntroSplash } from './components/layout/IntroSplash'

// Page components
import { LandingPage } from './components/pages/LandingPage'
import { PatientHomeDashboard } from './components/pages/PatientHomeDashboard'
import { NearbyPage } from './components/pages/NearbyPage'
import { BookOpdStepper } from './components/pages/BookOpdStepper'
import { LiveQueueTracking } from './components/pages/LiveQueueTracking'
import { EmergencyBedFinder } from './components/pages/EmergencyBedFinder'
import { HealthRecords } from './components/pages/HealthRecords'
import { PatientProfile } from './components/pages/PatientProfile'

// Staff & Display portals
import { DoctorPortal } from './components/dashboards/DoctorPortal'
import { ReceptionPortal } from './components/dashboards/ReceptionPortal'
import { HospitalAdminPortal } from './components/dashboards/HospitalAdminPortal'
import { SuperAdminPortal } from './components/dashboards/SuperAdminPortal'
import { PublicDisplayBoard } from './components/dashboards/PublicDisplayBoard'

// Dedicated Role Login Pages
import { PatientLoginPage } from './components/auth/PatientLoginPage'
import { DoctorLoginPage } from './components/auth/DoctorLoginPage'
import { ReceptionLoginPage } from './components/auth/ReceptionLoginPage'
import { HospitalAdminLoginPage } from './components/auth/HospitalAdminLoginPage'
import { SuperAdminLoginPage } from './components/auth/SuperAdminLoginPage'
import { ErrorBoundary } from './components/common/ErrorBoundary'

// Location & Maps (kept intact as instructed)
import { LocationPanel } from './components/LocationPanel'

// Data & Helpers
import {
  initialHospitals, departments, doctorsByDept, createDoctorDirectory,
  hospitalKey, opdKey, loadJson, persistJson, PHOTON_API, distanceKm,
  deriveNameFromEmail
} from './lib/appData'
import { getResults, patientPhoneLogin, setApiAccessToken } from './lib/queueApi'

export function App() {
  // Lenis smooth inertia scrolling
  useLenisSmoothScroll()

  // Opening entrance animation state: default false for instant loading without blank screen delay
  const [showIntro, setShowIntro] = useState(false)

  // Mobile sidebar drawer toggle
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const resolveRoute = useCallback(() => {
    const p = (window.location.pathname || '/').toLowerCase()
    const s = (window.location.search || '').toLowerCase()
    if (s.includes('portal=display') || s.includes('display') || p.includes('display')) return '/display'
    if (s.includes('portal=doctor') || p.includes('doctor')) return '/doctor'
    if (s.includes('portal=reception') || p.includes('reception')) return '/reception'
    if (s.includes('portal=superadmin') || p.includes('super-admin') || p.includes('superadmin')) return '/super-admin'
    if (s.includes('portal=admin') || p.includes('hospital-admin')) return '/hospital-admin'
    return p
  }, [])

  // Explicit Pathname-based Routing: supports dedicated role login pages and dashboards
  const [currentPath, setCurrentPath] = useState(resolveRoute)

  const navigate = useCallback((to) => {
    window.history.pushState({}, '', to)
    const lower = to.toLowerCase()
    if (lower.includes('display') || lower.includes('portal=display')) {
      setCurrentPath('/display')
    } else {
      setCurrentPath(lower)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(resolveRoute())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [resolveRoute])

  // Synchronize active tab from route
  useEffect(() => {
    if (currentPath.includes('/book')) setTab('book')
    else if (currentPath.includes('/queue')) setTab('queue')
    else if (currentPath.includes('/nearby')) setTab('nearby')
    else if (currentPath.includes('/emergency')) setTab('emergency')
    else if (currentPath.includes('/records')) setTab('records')
    else if (currentPath.includes('/profile')) setTab('profile')
  }, [currentPath])

  // Patient Authentication & Session (NO ABHA ASKED AT LOGIN!)
  const [patientSession, setPatientSession] = useState(() => loadJson('queuefree-patient-session', null))
  const [patientAbhaVerified, setPatientAbhaVerified] = useState(() => loadJson('queuefree-abha-verified', false))
  const [patientAbhaId, setPatientAbhaId] = useState(() => loadJson('queuefree-abha-id', ''))

  // Staff Authentication & Session (Doctor or Receptionist)
  const [staffSession, setStaffSession] = useState(() => loadJson('queuefree-staff-session', null))

  // Active Tab for Patient Portal
  const [tab, setTab] = useState('dashboard')

  // Chosen Hospital for Booking
  const [selectedHospital, setSelectedHospital] = useState(null)

  // Search & Location
  const [city, setCity] = useState('Rishikesh, Uttarakhand')
  const [cityCenter, setCityCenter] = useState({ lat: 30.0765, lon: 78.2882 })
  const [citySelected, setCitySelected] = useState(true)
  const [search, setSearch] = useState('')
  const [citySuggestions, setCitySuggestions] = useState([])
  const [liveHospitals, setLiveHospitals] = useState([])
  const [hospitalLoading, setHospitalLoading] = useState(false)
  const [hospitalError, setHospitalError] = useState('')
  const [locationHospital, setLocationHospital] = useState(null)
  const [locationAsked, setLocationAsked] = useState(false)

  // Queue & Token State
  const [token, setToken] = useState(() => {
    try {
      const saved = loadJson('queuefree-token', null)
      if (!saved) return null
      const hosp = String(saved.hospital_name || (typeof saved.hospital === 'object' ? saved.hospital?.name : saved.hospital) || '').toLowerCase()
      const doc = String(saved.doctor_name || (typeof saved.doctor === 'object' ? saved.doctor?.display_name : saved.doctor) || '').toLowerCase()
      if (hosp.includes('apollo') || doc.includes('sharmistha')) {
        localStorage.removeItem('queuefree-token')
        return null
      }
      return saved
    } catch {
      localStorage.removeItem('queuefree-token')
      return null
    }
  })
  const [queues, setQueues] = useState(() => loadJson('queuefree-queues', {}))
  const [toast, setToast] = useState('')
  const [apiBookings, setApiBookings] = useState([])
  const [apiError, setApiError] = useState('')

  // OPD Department & Doctor selections
  const [dept, setDept] = useState(departments[0])
  const [doctor, setDoctor] = useState(doctorsByDept[departments[0]][0])
  const [booking, setBooking] = useState(null)

  // Persist patient session
  useEffect(() => {
    if (patientSession) persistJson('queuefree-patient-session', patientSession)
    else localStorage.removeItem('queuefree-patient-session')
  }, [patientSession])

  useEffect(() => {
    if (staffSession) persistJson('queuefree-staff-session', staffSession)
    else localStorage.removeItem('queuefree-staff-session')
  }, [staffSession])

  useEffect(() => {
    persistJson('queuefree-abha-verified', patientAbhaVerified)
    persistJson('queuefree-abha-id', patientAbhaId)
  }, [patientAbhaVerified, patientAbhaId])

  useEffect(() => {
    if (token) persistJson('queuefree-token', token)
    else localStorage.removeItem('queuefree-token')
  }, [token])

  useEffect(() => {
    persistJson('queuefree-queues', queues)
  }, [queues])

  // Toast timer
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(id)
  }, [toast])

  // Poll patient bookings if signed in with API token
  const refreshPatientBookings = useCallback(async () => {
    if (!patientSession?.access) return
    try {
      const data = await getResults('/bookings/')
      setApiBookings(data)
      setApiError('')
    } catch (err) {
      if (err.status === 401) {
        setToast('Session expired. Please sign in again.')
        setPatientSession(null)
        setApiAccessToken('')
        setToken(null)
        setApiBookings([])
        localStorage.removeItem('queuefree-patient-session')
        localStorage.removeItem('queuefree-token')
        localStorage.removeItem('queuefree-queues')
      } else {
        setApiError(err.message)
      }
    }
  }, [patientSession])

  useEffect(() => {
    if (patientSession?.access) {
      setApiAccessToken(patientSession.access)
      refreshPatientBookings()
      const interval = setInterval(refreshPatientBookings, 5000)
      return () => clearInterval(interval)
    }
  }, [patientSession, refreshPatientBookings])

  // Geocoding and Nearby/Emergency hospitals loader
  useEffect(() => {
    const query = city.trim()
    if ((tab !== 'nearby' && tab !== 'emergency') || query.length < 2 || citySelected) {
      setCitySuggestions([])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: '8', lang: 'en' })
        params.append('layer', 'city')
        params.append('layer', 'locality')
        const response = await fetch(`${PHOTON_API}/api/?${params}`)
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled) {
          setCitySuggestions((data.features || []).filter(f => f.geometry?.coordinates?.length === 2).map(f => {
            const p = f.properties
            const [lon, lat] = f.geometry.coordinates
            return { id: `${p.osm_type}-${p.osm_id}`, name: p.name || query, label: [p.name, p.state, p.country].filter(Boolean).join(', '), lat, lon }
          }))
        }
      } catch {
        if (!cancelled) setCitySuggestions([])
      }
    }, 700)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [city, citySelected, tab])

  useEffect(() => {
    if ((tab !== 'nearby' && tab !== 'emergency') || !citySelected || !cityCenter) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setHospitalLoading(true)
      setHospitalError('')
      try {
        const params = new URLSearchParams({
          q: search.trim() || 'hospital',
          lat: String(cityCenter.lat),
          lon: String(cityCenter.lon),
          limit: '30',
          zoom: '13',
          lang: 'en'
        })
        params.append('osm_tag', 'amenity:hospital')
        params.append('osm_tag', 'healthcare:hospital')
        const response = await fetch(`${PHOTON_API}/api/?${params}`, { signal: controller.signal, headers: { Accept: 'application/geo+json' } })
        if (!response.ok) throw new Error('Hospital listings unavailable')
        const data = await response.json()
        const results = (data.features || []).map(feature => {
          const p = feature.properties || {}
          const [lon, lat] = feature.geometry?.coordinates || []
          const extra = p.extra || {}
          const street = [p.housenumber, p.street].filter(Boolean).join(' ')
          const area = p.locality || p.district || p.city || p.county || city
          return {
            id: `${p.osm_type}-${p.osm_id}`,
            name: p.name || 'Hospital',
            city: p.city || p.county || city,
            area,
            address: [street, area, p.state, p.postcode].filter(Boolean).join(', '),
            lat,
            lng: lon,
            latitude: lat,
            longitude: lon,
            openingHours: p.opening_hours || extra.opening_hours,
            distanceKm: Number.isFinite(lat) && Number.isFinite(lon) ? distanceKm(cityCenter, { lat, lon }) : null,
            specialty: p.osm_value === 'hospital' ? 'Hospital' : (p.osm_value || 'General Hospital'),
            phone: p.phone || extra.phone,
            website: p.website || extra.website,
          }
        }).filter(h => h.name !== 'Hospital' && (h.distanceKm == null || h.distanceKm < 50))
          .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
          .map(h => ({
            ...h,
            distance: h.distanceKm == null ? 'Nearby' : `${h.distanceKm.toFixed(1)} km`,
            rating: (4.4 + Math.random() * 0.5).toFixed(1),
          }))
        setLiveHospitals(results)
      } catch (err) {
        if (!controller.signal.aborted) {
          setLiveHospitals([])
          setHospitalError(err.message || 'Could not load hospital listings.')
        }
      } finally {
        if (!controller.signal.aborted) setHospitalLoading(false)
      }
    }, search ? 650 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [city, cityCenter, citySelected, search, tab])

  // Location handler
  const useLocation = () => {
    if (!navigator.geolocation) {
      setToast('Location is not supported on this device')
      return
    }
    setLocationAsked(true)
    navigator.geolocation.getCurrentPosition(pos => {
      const center = { lat: pos.coords.latitude, lon: pos.coords.longitude }
      setCityCenter(center)
      setCitySelected(true)
      setCitySuggestions([])
      setTab('nearby')
      setToast('Showing hospitals near your current location')
      setLocationAsked(false)
    }, () => {
      setLocationAsked(false)
      setToast('Could not access GPS location. Please select a city.')
    }, { timeout: 10000 })
  }

  const openHospitalLocation = (h) => setLocationHospital(h)

  const chooseLocationHospital = (h) => {
    setSelectedHospital(h)
    setBooking(h)
    setCity(h.city || 'Rishikesh, Uttarakhand')
    setLocationHospital(null)
    setTab('book')
  }

  // When patient clicks "Book token" on any hospital in Nearby
  const bookHospital = (h) => {
    setSelectedHospital(h)
    setBooking(h)
    setCity(h.city || 'Rishikesh, Uttarakhand')
    setTab('book')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Patient Login Handler supporting both Option A (ABHA) and Option B (Phone)
  const handlePatientLogin = async (authResult) => {
    const phone = authResult?.phone || '+919876543210'
    const userEmail = authResult?.email || 'patient@example.com'
    const userName = authResult?.name || deriveNameFromEmail(userEmail, 'Patient User')
    const isAbha = Boolean(authResult?.abha_verified)
    const abhaId = authResult?.abha_id || ''

    if (authResult?.access) {
      setApiAccessToken(authResult.access)
      const session = {
        ...authResult,
        phone,
        email: userEmail,
        name: userName,
        abha_verified: isAbha,
        abha_id: abhaId,
      }
      setPatientSession(session)
      setPatientAbhaVerified(isAbha)
      setPatientAbhaId(abhaId)
      setToast(isAbha ? `Welcome, ${userName}! Verified via ABHA. Live Board ready.` : `Welcome, ${userName}! Signed in. Live Board ready.`)
      setTab('dashboard')
      navigate('/patient/dashboard')
      return
    }

    try {
      const session = await patientPhoneLogin(phone, userName, userEmail)
      setApiAccessToken(session.access)
      const finalName = session.display_name || userName
      setPatientSession({ ...session, phone, email: userEmail, name: finalName })
      if (session.abha_verified) {
        setPatientAbhaVerified(true)
        setPatientAbhaId(session.abha_id)
      } else {
        setPatientAbhaVerified(false)
        setPatientAbhaId('')
      }
      setToast(`Welcome, ${finalName}! Signed in successfully. Live Board ready.`)
      setTab('dashboard')
      navigate('/patient/dashboard')
    } catch {
      // Offline fallback session
      const fallbackSession = {
        access: 'mock-patient-jwt',
        phone,
        email: userEmail,
        name: userName,
        abha_verified: false,
      }
      setPatientSession(fallbackSession)
      setPatientAbhaVerified(false)
      setToast(`Welcome, ${userName}! Signed in successfully.`)
      setTab('dashboard')
      navigate('/patient/dashboard')
    }
  }

  // Explicit Logout Handler for Patients
  const handlePatientLogout = () => {
    setApiAccessToken('')
    setPatientSession(null)
    setPatientAbhaVerified(false)
    setPatientAbhaId('')
    setSelectedHospital(null)
    setToken(null)
    setApiBookings([])
    localStorage.removeItem('queuefree-patient-session')
    localStorage.removeItem('queuefree-abha-verified')
    localStorage.removeItem('queuefree-abha-id')
    localStorage.removeItem('queuefree-token')
    localStorage.removeItem('queuefree-queues')
    setToast('You have been signed out safely.')
    navigate('/patient/login')
  }

  // Doctor Staff Login Handler
  const handleDoctorLogin = (authData) => {
    const session = { ...authData, role: 'doctor' }
    setStaffSession(session)
    if (authData?.access) setApiAccessToken(authData.access)
    setToast(`Welcome, ${authData.doctor_name || authData.username || 'Doctor'}!`)
    navigate('/doctor/dashboard')
  }

  const handleDoctorLogout = () => {
    setApiAccessToken('')
    setStaffSession(null)
    setToast('Doctor signed out safely.')
    navigate('/doctor/login')
  }

  // Reception Staff Login Handler
  const handleReceptionLogin = (authData) => {
    const session = { ...authData, role: 'reception' }
    setStaffSession(session)
    if (authData?.access) setApiAccessToken(authData.access)
    setToast(`Welcome, ${authData.username || 'Receptionist'}!`)
    navigate('/reception/dashboard')
  }

  const handleReceptionLogout = () => {
    setApiAccessToken('')
    setStaffSession(null)
    setToast('Receptionist signed out safely.')
    navigate('/reception/login')
  }

  // Hospital Admin Staff Login Handler
  const handleHospitalAdminLogin = (authData) => {
    const session = { ...authData, role: 'hospital_admin' }
    setStaffSession(session)
    if (authData?.access) setApiAccessToken(authData.access)
    setToast(`Welcome to ${authData.hospital_name || 'Hospital'} Admin Portal.`)
    navigate('/hospital-admin/dashboard')
  }

  const handleHospitalAdminLogout = () => {
    setApiAccessToken('')
    setStaffSession(null)
    setToast('Hospital Admin signed out safely.')
    navigate('/hospital-admin/login')
  }

  // Super Admin Staff Login Handler
  const handleSuperAdminLogin = (authData) => {
    const session = { ...authData, role: 'super_admin' }
    setStaffSession(session)
    if (authData?.access) setApiAccessToken(authData.access)
    setToast(`Welcome Super Admin! Signed in to Platform Root.`)
    navigate('/super-admin/dashboard')
  }

  const handleSuperAdminLogout = () => {
    setApiAccessToken('')
    setStaffSession(null)
    setToast('Super Admin signed out safely.')
    navigate('/super-admin/login')
  }

  // Unified Staff Login Handler (Dispatches according to role)
  const handleStaffLogin = (authData) => {
    if (authData.role === 'super_admin') handleSuperAdminLogin(authData)
    else if (authData.role === 'hospital_admin') handleHospitalAdminLogin(authData)
    else if (authData.role === 'doctor') handleDoctorLogin(authData)
    else handleReceptionLogin(authData)
  }

  const handleStaffLogout = () => {
    setApiAccessToken('')
    setStaffSession(null)
    setToast('Logged out of staff console safely.')
    navigate('/')
  }

  const handleAbhaVerifiedSuccess = (verifiedId) => {
    setPatientAbhaVerified(true)
    setPatientAbhaId(verifiedId)
    setToast('✓ ABHA ID verified and linked to your patient profile!')
  }

  const onApiBookingConfirmed = (bookingResult) => {
    setToken(bookingResult)
    setToast('OPD Appointment Token Confirmed!')
    setTab('queue')
    refreshPatientBookings()
  }

  const handleIntroComplete = () => {
    setShowIntro(false)
  }

  // Props passed down to NearbyPage.jsx (keeping file intact)
  const pageProps = {
    labels: {
      nearbyTitle: 'Find a hospital nearby',
      location: 'Use my location',
      book: 'Book token',
    },
    city,
    citySelected,
    useLocation,
    search,
    setSearch,
    citySuggestions,
    setCity,
    setCityCenter,
    setCitySelected,
    setCitySuggestions,
    setLiveHospitals,
    setHospitalError,
    hospitals: liveHospitals.length ? liveHospitals : initialHospitals,
    hospitalLoading,
    hospitalError,
    bookHospital,
    onViewLocation: openHospitalLocation,
    cityCenter,
  }

  // Opening Entrance Splash Animation (Requested by User)
  if (showIntro) {
    return <IntroSplash onComplete={handleIntroComplete} />
  }

  // =========================================================================
  // ROUTE DISPLAY: LIVE DISPLAY BOARD (/display) - REQUIRES SIGNIN / LOGIN
  // =========================================================================
  if (currentPath === '/display' || currentPath.includes('display')) {
    if (!patientSession && !staffSession) {
      return (
        <ErrorBoundary onReset={() => navigate('/')}>
          <PatientLoginPage
            onLoginSuccess={(auth) => {
              handlePatientLogin(auth)
              navigate('/display')
            }}
            onNavigate={navigate}
          />
        </ErrorBoundary>
      )
    }

    return (
      <ErrorBoundary onReset={() => navigate('/')}>
        <PublicDisplayBoard
          onExit={() => {
            navigate('/')
          }}
        />
      </ErrorBoundary>
    )
  }

  // =========================================================================
  // ROUTE 0: SUPER ADMIN PORTAL (/super-admin) - Platform Root
  // =========================================================================
  if (currentPath.includes('/super-admin') || currentPath.includes('/superadmin')) {
    if (currentPath.includes('/login') || !staffSession || staffSession.role !== 'super_admin') {
      return (
        <>
          <SuperAdminLoginPage onLoginSuccess={handleSuperAdminLogin} onNavigate={navigate} />
          {toast && (
            <div className="toast" role="status">
              <Check size={16} />
              <span>{toast}</span>
            </div>
          )}
        </>
      )
    }
    return (
      <>
        <SuperAdminPortal
          initialAuth={staffSession}
          onLogout={handleSuperAdminLogout}
          onExitToPatientPortal={() => navigate('/')}
        />
        {toast && (
          <div className="toast" role="status">
            <Check size={16} />
            <span>{toast}</span>
          </div>
        )}
      </>
    )
  }

  // =========================================================================
  // ROUTE 1: HOSPITAL ADMIN PORTAL (/hospital-admin) - Hospital Admin Only
  // =========================================================================
  if (currentPath.includes('/hospital-admin') || (currentPath.includes('/admin') && !currentPath.includes('super'))) {
    if (currentPath.includes('/login') || !staffSession || !['hospital_admin', 'super_admin'].includes(staffSession.role)) {
      return (
        <>
          <HospitalAdminLoginPage onLoginSuccess={handleHospitalAdminLogin} onNavigate={navigate} />
          {toast && (
            <div className="toast" role="status">
              <Check size={16} />
              <span>{toast}</span>
            </div>
          )}
        </>
      )
    }
    return (
      <>
        <HospitalAdminPortal
          initialAuth={staffSession}
          onLogout={handleHospitalAdminLogout}
          onExitToPatientPortal={() => navigate('/')}
        />
        {toast && (
          <div className="toast" role="status">
            <Check size={16} />
            <span>{toast}</span>
          </div>
        )}
      </>
    )
  }

  // =========================================================================
  // ROUTE 2: DOCTOR PORTAL (/doctor) - Doctor Consultation Only
  // =========================================================================
  if (currentPath.includes('/doctor')) {
    if (currentPath.includes('/login') || !staffSession || !['doctor', 'super_admin'].includes(staffSession.role)) {
      return (
        <>
          <DoctorLoginPage onLoginSuccess={handleDoctorLogin} onNavigate={navigate} />
          {toast && (
            <div className="toast" role="status">
              <Check size={16} />
              <span>{toast}</span>
            </div>
          )}
        </>
      )
    }
    return (
      <>
        <DoctorPortal
          initialAuth={staffSession}
          onLogout={handleDoctorLogout}
          onExitToPatientPortal={() => navigate('/')}
        />
        {toast && (
          <div className="toast" role="status">
            <Check size={16} />
            <span>{toast}</span>
          </div>
        )}
      </>
    )
  }

  // =========================================================================
  // ROUTE 3: RECEPTION PORTAL (/reception) - Receptionist Only
  // =========================================================================
  if (currentPath.includes('/reception')) {
    if (currentPath.includes('/login') || !staffSession || !['reception', 'receptionist', 'super_admin'].includes(staffSession.role)) {
      return (
        <>
          <ReceptionLoginPage onLoginSuccess={handleReceptionLogin} onNavigate={navigate} />
          {toast && (
            <div className="toast" role="status">
              <Check size={16} />
              <span>{toast}</span>
            </div>
          )}
        </>
      )
    }
    return (
      <>
        <ReceptionPortal
          initialAuth={staffSession}
          onLogout={handleReceptionLogout}
          onExitToPatientPortal={() => navigate('/')}
        />
        {toast && (
          <div className="toast" role="status">
            <Check size={16} />
            <span>{toast}</span>
          </div>
        )}
      </>
    )
  }

  // =========================================================================
  // ROUTE 4: DEDICATED PATIENT LOGIN (/patient/login)
  // =========================================================================
  if (currentPath === '/patient/login') {
    return (
      <>
        <PatientLoginPage onLoginSuccess={handlePatientLogin} onNavigate={navigate} />
        {toast && (
          <div className="toast" role="status">
            <Check size={16} />
            <span>{toast}</span>
          </div>
        )}
      </>
    )
  }

  // =========================================================================
  // ROUTE 5: UNAUTHENTICATED PATIENT ACCESS (Redirect or Landing)
  // =========================================================================
  if (!patientSession) {
    if (currentPath.startsWith('/patient')) {
      return (
        <>
          <PatientLoginPage onLoginSuccess={handlePatientLogin} onNavigate={navigate} />
          {toast && (
            <div className="toast" role="status">
              <Check size={16} />
              <span>{toast}</span>
            </div>
          )}
        </>
      )
    }

    return (
      <>
        <LandingPage
          onLoginSuccess={handlePatientLogin}
          onDoctorLoginSuccess={handleDoctorLogin}
          onReceptionLoginSuccess={handleReceptionLogin}
          onHospitalAdminLoginSuccess={handleHospitalAdminLogin}
          onSuperAdminLoginSuccess={handleSuperAdminLogin}
          onStaffLoginSuccess={handleStaffLogin}
          onNavigate={navigate}
        />
        {toast && (
          <div className="toast" role="status">
            <Check size={16} />
            <span>{toast}</span>
          </div>
        )}
      </>
    )
  }

  // Logged-in Patient View with Dynamic User Profile & Responsive Nav
  const patientDisplayName = patientSession?.name || deriveNameFromEmail(patientSession?.email, 'Patient')
  const patientEmail = patientSession?.email || 'patient@example.com'
  const patientPhone = patientSession?.phone || '+91 98765 43210'

  return (
    <div className="patient-app-wrapper">
      {/* Left Sidebar (Desktop + Mobile Slide-out Drawer) */}
      <PatientSidebar
        activeTab={tab}
        onSelectTab={setTab}
        onLogout={handlePatientLogout}
        patientName={patientDisplayName}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="patient-main-view">
        <PatientTopBar
          activeTab={tab}
          patientName={patientDisplayName}
          patientEmail={patientEmail}
          patientPhone={patientPhone}
          city={city}
          searchQuery={search}
          onSearchChange={setSearch}
          onOpenLocation={() => setTab('nearby')}
          onLogout={handlePatientLogout}
          onToggleMobileMenu={() => setMobileSidebarOpen(true)}
        />

        <main className="patient-page-body">
          <ErrorBoundary onReset={() => setTab('dashboard')}>
            <AnimatePresence mode="wait">
              <PageTransition tabKey={tab}>
              {tab === 'dashboard' && (
                <PatientHomeDashboard
                  onNavigate={setTab}
                  bookings={apiBookings}
                  activeToken={token}
                  hospitalsCount={liveHospitals.length || 12}
                  patientSession={patientSession}
                  patientAbhaVerified={patientAbhaVerified}
                  patientAbhaId={patientAbhaId}
                  refreshBookings={refreshPatientBookings}
                  onLogout={handlePatientLogout}
                />
              )}

              {tab === 'nearby' && (
                <NearbyPage {...pageProps} />
              )}

              {tab === 'book' && (
                <BookOpdStepper
                  selectedHospital={selectedHospital}
                  onConfirmed={onApiBookingConfirmed}
                  onViewLocation={openHospitalLocation}
                  patientAbhaVerified={patientAbhaVerified}
                  onAbhaVerifiedSuccess={handleAbhaVerifiedSuccess}
                  city={city}
                  onNavigate={setTab}
                  patientSession={patientSession}
                  onLoginSuccess={handlePatientLogin}
                  existingBookings={apiBookings}
                />
              )}

              {tab === 'queue' && (
                <LiveQueueTracking
                  bookings={apiBookings}
                  activeToken={token}
                  patientName={patientDisplayName}
                  onCancelBooking={() => { setToken(null); setToast('Token cancelled'); }}
                  onNavigate={setTab}
                  onViewLocation={openHospitalLocation}
                  refreshBookings={refreshPatientBookings}
                />
              )}

              {tab === 'emergency' && (
                <EmergencyBedFinder
                  city={city}
                  setCity={setCity}
                  cityCenter={cityCenter}
                  setCityCenter={setCityCenter}
                  citySelected={citySelected}
                  setCitySelected={setCitySelected}
                  citySuggestions={citySuggestions}
                  setCitySuggestions={setCitySuggestions}
                  useLocation={useLocation}
                  hospitals={liveHospitals.length ? liveHospitals : initialHospitals}
                  hospitalLoading={hospitalLoading}
                  hospitalError={hospitalError}
                  onBookEmergencyOpd={(h) => {
                    bookHospital(h)
                    setTab('book')
                  }}
                  onViewLocation={openHospitalLocation}
                />
              )}

              {tab === 'records' && (
                <HealthRecords
                  bookings={apiBookings}
                  patientName={patientDisplayName}
                />
              )}

              {tab === 'profile' && (
                <PatientProfile
                  patientName={patientDisplayName}
                  phone={patientPhone}
                  email={patientEmail}
                  abhaVerified={patientAbhaVerified}
                  abhaId={patientAbhaId}
                  onVerifyAbha={handleAbhaVerifiedSuccess}
                />
              )}
            </PageTransition>
          </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>

      {/* Sleek Mobile Bottom Navigation Bar (For Phones & Tablets) */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`mobile-tab-btn ${tab === 'dashboard' ? 'is-active' : ''}`}
          onClick={() => setTab('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>Home</span>
        </button>

        <button
          type="button"
          className={`mobile-tab-btn ${tab === 'nearby' ? 'is-active' : ''}`}
          onClick={() => setTab('nearby')}
        >
          <MapPin size={20} />
          <span>Hospitals</span>
        </button>

        <button
          type="button"
          className={`mobile-tab-btn book-tab ${tab === 'book' ? 'is-active' : ''}`}
          onClick={() => setTab('book')}
        >
          <div className="book-circle-icon">
            <CalendarPlus size={20} />
          </div>
          <span>Book OPD</span>
        </button>

        <button
          type="button"
          className={`mobile-tab-btn ${tab === 'queue' ? 'is-active' : ''}`}
          onClick={() => setTab('queue')}
        >
          <Users size={20} />
          <span>Live Queue</span>
        </button>

        <button
          type="button"
          className={`mobile-tab-btn ${tab === 'profile' ? 'is-active' : ''}`}
          onClick={() => setTab('profile')}
        >
          <User size={20} />
          <span>Profile</span>
        </button>
      </nav>

      {/* Location Drawer when requested */}
      {locationHospital && (
        <LocationPanel
          hospital={locationHospital}
          origin={cityCenter}
          onClose={() => setLocationHospital(null)}
          onSelect={chooseLocationHospital}
          liveQueueLength={12}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          <span>{toast}</span>
          <button type="button" className="icon-button" onClick={() => setToast('')}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export default App
