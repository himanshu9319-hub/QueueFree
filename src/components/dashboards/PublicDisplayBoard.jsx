import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Monitor, Clock, Building2, Stethoscope, Users, Radio, Maximize,
  Minimize, ArrowLeft, Volume2, VolumeX, ShieldCheck, Activity,
  Sparkles, AlertCircle, RefreshCw, CheckCircle2, ChevronRight, Bell
} from 'lucide-react'
import { apiRequest } from '../../lib/queueApi'

// Synthesizes a high-fidelity two-tone hospital lobby chime (Ding-Dong)
function playHospitalChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const now = ctx.currentTime

    // Tone 1 (Ding): High E (659.25 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(659.25, now)
    gain1.gain.setValueAtTime(0.3, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.6)

    // Tone 2 (Dong): Middle C (523.25 Hz) with 0.28s offset
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(523.25, now + 0.28)
    gain2.gain.setValueAtTime(0.35, now + 0.28)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.28)
    osc2.stop(now + 1.2)
  } catch {
    // Autoplay permissions may require user interaction
  }
}

// Speaks vocal token announcement through the browser's speech synthesizer
function vocalizeTokenCall(tokenNumber, roomNumber) {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
      window.speechSynthesis.cancel()
      const text = `Token number ${tokenNumber}, please proceed to ${roomNumber}.`
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.95
      utterance.pitch = 1.05
      utterance.volume = 0.85
      window.speechSynthesis.speak(utterance)
    }
  } catch {
    // Graceful fallback if speech synthesis is restricted
  }
}

export function PublicDisplayBoard({ onExit, initialHospitalId = null }) {
  // Hospital & Selection State
  const [hospitals, setHospitals] = useState([])
  const [selectedHospitalId, setSelectedHospitalId] = useState(initialHospitalId)
  const [hospitalInfo, setHospitalInfo] = useState({
    name: 'DEMO General Hospital',
    city: 'Dehradun, Uttarakhand',
    is_demo: true,
  })

  // Live Queue & Metrics (strictly populated from real hospital DB)
  const [doctorQueues, setDoctorQueues] = useState([])
  const [totalWaiting, setTotalWaiting] = useState(0)
  const [activeDoctorsCount, setActiveDoctorsCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(true)
  const [error, setError] = useState('')

  // UI, Clock, Sound & Filters
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedDept, setSelectedDept] = useState('all')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [recentlyCalledDoctorId, setRecentlyCalledDoctorId] = useState(null)

  // Track previous serving tokens to detect new calls and trigger chimes
  const previousServingMap = useRef({})
  const hasInitializedServing = useRef(false)

  // 1. Digital Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 2. Fetch list of hospitals for the selector
  useEffect(() => {
    let mounted = true
    apiRequest('/hospitals/')
      .then((res) => {
        if (!mounted) return
        const list = Array.isArray(res) ? res : res.results || []
        setHospitals(list)
        // Prefer demonstration hospital as the default if not pre-set
        if (!selectedHospitalId && list.length > 0) {
          const demo = list.find((h) => h.is_demo) || list[0]
          setSelectedHospitalId(demo.id)
          setHospitalInfo(demo)
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  // 3. Poll Real Hospital Live Queue Data from the public display endpoint
  const fetchLiveDisplayData = useCallback(async () => {
    try {
      const queryParam = selectedHospitalId ? `?hospital_id=${selectedHospitalId}` : ''
      const res = await apiRequest(`/public/display/${queryParam}`)

      if (res?.hospital) {
        setHospitalInfo(res.hospital)
      }

      if (Array.isArray(res?.doctor_queues)) {
        const newQueues = res.doctor_queues

        // Check for newly called or newly serving tokens to trigger audio announcement
        if (hasInitializedServing.current && soundEnabled) {
          newQueues.forEach((doc) => {
            const prevToken = previousServingMap.current[doc.doctor_id]
            const currentToken = doc.now_serving
            if (currentToken && currentToken !== '—' && currentToken !== prevToken) {
              // Play chime and announce over TV speakers
              playHospitalChime()
              vocalizeTokenCall(currentToken, doc.room)
              setRecentlyCalledDoctorId(doc.doctor_id)
              setTimeout(() => setRecentlyCalledDoctorId(null), 8000)
            }
          })
        }

        // Cache current serving tokens
        const newMap = {}
        newQueues.forEach((doc) => {
          newMap[doc.doctor_id] = doc.now_serving
        })
        previousServingMap.current = newMap
        hasInitializedServing.current = true

        setDoctorQueues(newQueues)
        setTotalWaiting(res.total_waiting || 0)
        setActiveDoctorsCount(res.active_doctors_count || newQueues.length)
        setIsConnected(true)
        setError('')
      }
    } catch (err) {
      setError('Waiting for hospital live feed...')
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }, [selectedHospitalId, soundEnabled])

  // Set up polling loop every 3.5 seconds
  useEffect(() => {
    fetchLiveDisplayData()
    const pollInterval = setInterval(fetchLiveDisplayData, 3500)
    return () => clearInterval(pollInterval)
  }, [fetchLiveDisplayData])

  // Fullscreen toggle for TV wall mounts
  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement?.requestFullscreen?.().catch(() => {})
        setIsFullscreen(true)
      } else {
        document.exitFullscreen?.().catch(() => {})
        setIsFullscreen(false)
      }
    } catch {
      // Graceful fallback if fullscreen is restricted
    }
  }

  // Handle hospital selector change
  const handleHospitalChange = (e) => {
    const newId = Number(e.target.value)
    setSelectedHospitalId(newId)
    setLoading(true)
    hasInitializedServing.current = false
    previousServingMap.current = {}
    const selected = hospitals.find((h) => h.id === newId)
    if (selected) setHospitalInfo(selected)
  }

  // Sound toggle with quick preview
  const handleToggleSound = () => {
    const nextState = !soundEnabled
    setSoundEnabled(nextState)
    if (nextState) {
      playHospitalChime()
    }
  }

  // Unique departments for filter pills (guaranteed array & string names)
  const safeQueues = Array.isArray(doctorQueues) ? doctorQueues : []
  const availableDepts = [
    'all',
    ...Array.from(new Set(
      safeQueues
        .map((d) => (typeof d?.department === 'object' ? d.department?.name : d?.department))
        .filter(Boolean)
        .map(String)
    )),
  ]

  const filteredDoctors =
    selectedDept === 'all'
      ? safeQueues
      : safeQueues.filter((d) => {
          const dept = typeof d?.department === 'object' ? d.department?.name : d?.department
          return String(dept || '').toLowerCase() === selectedDept.toLowerCase()
        })

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between selection:bg-blue-500 selection:text-white font-sans ${isFullscreen ? 'p-3' : 'p-4 sm:p-6'}`}>
      {/* =================================================================== */}
      {/* 1. TOP HEADER BAR: HOSPITAL TITLE, LIVE TIME & CONTROLS             */}
      {/* =================================================================== */}
      <header className="border-b border-slate-200 bg-white rounded-2xl px-5 py-4 mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Left: Exit button, Hospital Name & Live Broadcast Pill */}
        <div className="flex items-center gap-4">
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
              title="Exit Public Live Display"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Exit TV Board</span>
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20">
              Q
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  {hospitalInfo?.name || 'Hospital Waiting Area'}
                </h1>
                {hospitalInfo?.is_demo && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Official OPD
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE OPD TV BROADCAST
                </span>
                <span className="text-slate-400">&bull;</span>
                <span className="text-[11px] text-slate-500">
                  Zero PII Public Waiting Area Display
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Hospital Switcher & Department Filter */}
        <div className="flex items-center flex-wrap gap-2.5">
          {hospitals.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs">
              <Building2 size={14} className="text-slate-500" />
              <select
                value={selectedHospitalId || ''}
                onChange={handleHospitalChange}
                className="bg-transparent text-slate-800 focus:outline-none cursor-pointer text-xs font-semibold"
              >
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id} className="bg-white text-slate-800">
                    {h.name} {h.is_demo ? '(Demo Hospital)' : `(${h.city})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Department Filter Pills */}
          {availableDepts.length > 2 && (
            <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              {availableDepts.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDept(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    selectedDept === d
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {d === 'all' ? 'All Rooms' : d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Sound Chime Toggle, Live Digital Clock & Fullscreen */}
        <div className="flex items-center gap-4">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-sm ${
              soundEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
            title={soundEnabled ? 'Chime sound is active. Click to mute.' : 'Chime is muted. Click to enable sound.'}
          >
            {soundEnabled ? (
              <>
                <Volume2 size={15} className="text-emerald-600 animate-pulse" />
                <span>Chime ON</span>
              </>
            ) : (
              <>
                <VolumeX size={15} />
                <span>Chime OFF</span>
              </>
            )}
          </button>

          {/* Lobby Waiting Count */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            <Users size={15} className="text-blue-600" />
            <span>
              <strong className="text-slate-900 font-mono text-sm">{totalWaiting}</strong> Patients in Waiting Hall
            </span>
          </div>

          {/* Digital Clock with Seconds */}
          <div className="text-right">
            <div className="text-xl sm:text-2xl font-black font-mono tracking-wider text-slate-900">
              {currentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {currentTime.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>

          {/* Fullscreen TV Mode Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition"
            title="Toggle TV Fullscreen"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 2. MAIN OPD CONSULTATION ROOMS GRID                                 */}
      {/* =================================================================== */}
      <main className="flex-1 flex flex-col justify-start">
        {loading && doctorQueues.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <RefreshCw size={36} className="text-blue-500 animate-spin mb-4" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">Connecting to Hospital OPD Terminal...</h2>
            <p className="text-xs text-slate-500">Loading live doctor queues and current serving tokens from hospital records.</p>
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-sm">
            <Stethoscope size={40} className="text-slate-400 mb-3" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">No Active OPD Consultations</h2>
            <p className="text-xs text-slate-500 max-w-md">
              There are currently no active doctor queues scheduled for this department at {hospitalInfo?.name || 'this hospital'}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredDoctors.map((doc) => {
              const isNewlyCalled = recentlyCalledDoctorId === doc.doctor_id
              const isServing = doc.status === 'SERVING'
              const isCalling = doc.status === 'CALLING'

              return (
                <div
                  key={doc.doctor_id}
                  className={`rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden relative shadow-sm ${
                    isNewlyCalled
                      ? 'bg-emerald-50/40 border-emerald-500 ring-4 ring-emerald-500/20'
                      : isServing
                      ? 'bg-white border-slate-200 hover:shadow-md'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Top Ambient Glow Indicator for Newly Called Room */}
                  {isNewlyCalled && (
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 animate-pulse" />
                  )}

                  {/* Room & Doctor Identification Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-mono font-black text-sm tracking-wide mb-2 shadow-xs">
                          <span>{typeof doc.room === 'object' ? doc.room?.name || 'OPD Room' : String(doc.room || 'OPD Room')}</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                          <span>👨‍⚕️ {typeof doc.doctor_name === 'object' ? doc.doctor_name?.display_name || 'Specialist' : String(doc.doctor_name || 'Specialist')}</span>
                        </h2>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md">
                            🏥 {typeof doc.department === 'object' ? doc.department?.name || 'General OPD' : String(doc.department || 'General OPD')}
                          </span>
                          {doc.qualification && (
                            <span className="text-xs text-slate-500 font-medium">
                              · {doc.qualification}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isServing ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            NOW SERVING
                          </span>
                        ) : isCalling ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                            NOW CALLING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            READY
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delay Notice Banner if doctor announced a delay */}
                    {doc.delay_minutes > 0 && (
                      <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0 text-amber-600" />
                        <span>
                          OPD delayed by <strong>{doc.delay_minutes} min</strong>
                          {doc.delay_reason ? ` (${doc.delay_reason})` : ''}
                        </span>
                      </div>
                    )}

                    {/* ======================================================= */}
                    {/* GIANT "NOW SERVING" TOKEN DISPLAY BOX                   */}
                    {/* ======================================================= */}
                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center my-3 relative overflow-hidden group shadow-inner">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                        Currently Serving Token
                      </div>

                      <div
                        className={`text-5xl sm:text-6xl font-black font-mono tracking-tight my-2 select-all ${
                          doc.now_serving && doc.now_serving !== '—'
                            ? 'text-emerald-600 drop-shadow-sm'
                            : 'text-slate-400'
                        }`}
                      >
                        {typeof doc.now_serving === 'object' ? doc.now_serving?.token_number || '—' : String(doc.now_serving || '—')}
                      </div>

                      <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-2 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span>Please enter Room when your token displays</span>
                      </div>
                    </div>
                  </div>

                  {/* ======================================================= */}
                  {/* NEXT IN LINE TOKENS ROW                                 */}
                  {/* ======================================================= */}
                  <div className="px-5 py-4 bg-slate-50/80 border-t border-slate-200">
                    <div className="flex items-center justify-between text-xs mb-2.5">
                      <span className="font-bold uppercase tracking-wider text-slate-600 text-[11px]">
                        Next In Line ({doc.total_waiting} Waiting):
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        ~{doc.average_consultation_minutes} min / patient
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {Array.isArray(doc.next_in_line) && doc.next_in_line.length > 0 ? (
                        doc.next_in_line.map((tok, i) => (
                          <span
                            key={i}
                            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition ${
                              i === 0
                                ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-xs'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            {typeof tok === 'object' ? tok?.token_number || tok?.token || '—' : String(tok)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic py-1">
                          No patients currently in queue line
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* 3. BOTTOM TICKER TAPE FOR PATIENTS IN WAITING HALL                  */}
      {/* =================================================================== */}
      <footer className="mt-6 border-t border-slate-200 bg-white rounded-2xl p-3 sm:px-5 flex items-center justify-between gap-4 shadow-sm text-xs text-slate-600">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Bell size={15} />
          </span>
          <span className="font-bold text-slate-900 tracking-wide uppercase text-[11px]">
            Notice for Patients
          </span>
        </div>

        <div className="overflow-hidden whitespace-nowrap flex-1 text-slate-600 font-medium">
          <div className="inline-block animate-marquee">
            Please proceed immediately to your designated OPD consultation room when your token number appears on screen · Keep your digital OPD token or SMS confirmation ready · For emergency bed availability or ambulance requests, report directly to Ground Floor Emergency Triage · Patient Privacy Guarantee: Public display board broadcasts zero personal identity data (ABDM Compliant).
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-slate-500 shrink-0 font-medium text-[11px]">
          <ShieldCheck size={14} className="text-emerald-600" />
          <span>ABDM Verified Platform</span>
        </div>
      </footer>
    </div>
  )
}
