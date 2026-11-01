import { useState, useEffect, useRef } from 'react'
import {
  Stethoscope, Activity, Check, Play, Pause, SkipForward, LogOut,
  RefreshCw, Users, Clock, AlertCircle, ArrowLeft, ShieldCheck,
  AlertTriangle, RotateCcw, Timer, Building2
} from 'lucide-react'
import {
  apiRequest, localIsoDate, setApiAccessToken, staffLogin,
  getDoctorProfile, updateDoctorStatus, createSseQueueSubscriber,
  broadcastDoctorDelay
} from '../../lib/queueApi'
import doctorBg from '../../assets/backgrounds/doctor-bg.png'

export function DoctorPortal({ onExitToPatientPortal, onLogout, initialAuth = null }) {
  const [username, setUsername] = useState('demo.doctor')
  const [password, setPassword] = useState('DoctorDemo@2026!')
  const [auth, setAuth] = useState(initialAuth)
  const [data, setData] = useState(null)
  const [doctorProfile, setDoctorProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [date, setDate] = useState(localIsoDate())
  const [streamMode, setStreamMode] = useState('connecting')

  // Delay broadcast modal state
  const [showDelayModal, setShowDelayModal] = useState(false)
  const [delayMinutes, setDelayMinutes] = useState(15)
  const [delayReason, setDelayReason] = useState('Emergency clinical consultation')
  const [delayUpdating, setDelayUpdating] = useState(false)

  // Consultation live timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const demoDoctorPassword = import.meta.env.VITE_DEMO_DOCTOR_PASSWORD || 'DoctorDemo@2026!'

  const refreshQueue = async () => {
    if (!auth) return
    try {
      const [queueRes, docRes] = await Promise.all([
        apiRequest(`/staff/queue/?date=${encodeURIComponent(date)}`),
        getDoctorProfile().catch(() => null),
      ])
      setData(queueRes)
      if (docRes) {
        setDoctorProfile(docRes)
        setDelayMinutes(docRes.delay_minutes || 0)
        setDelayReason(docRes.delay_reason || '')
      }
      setError('')
    } catch (err) {
      setError(err.message || 'Unable to connect to live queue server.')
    }
  }

  useEffect(() => {
    if (auth) {
      setLoading(true)
      refreshQueue().finally(() => setLoading(false))

      // Connect via Server-Sent Events (SSE) with transparent polling fallback
      const sub = createSseQueueSubscriber({
        path: `/staff/queue/stream/?date=${encodeURIComponent(date)}`,
        onUpdate: (streamPayload) => {
          setData(streamPayload)
          if (streamPayload.doctor) {
            setDoctorProfile(streamPayload.doctor)
            setDelayMinutes(streamPayload.doctor.delay_minutes || 0)
            setDelayReason(streamPayload.doctor.delay_reason || '')
          }
          setStreamMode('sse')
          setError('')
        },
        onError: () => {
          setStreamMode('polling')
        },
        fetchFallback: refreshQueue,
      })

      return () => sub.close()
    }
  }, [auth, date])

  // Live timer for current serving patient
  const servingBooking = data?.bookings?.find(b => b.status === 'serving')
  useEffect(() => {
    if (!servingBooking) {
      setElapsedSeconds(0)
      return
    }
    const startTime = servingBooking.consultation_started_at
      ? new Date(servingBooking.consultation_started_at).getTime()
      : Date.now()
    const timerInterval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)))
    }, 1000)
    return () => clearInterval(timerInterval)
  }, [servingBooking?.id, servingBooking?.consultation_started_at])

  const handleLogin = async (e) => {
    e?.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await staffLogin(username, password)
      if (res.role !== 'doctor') {
        throw new Error('This console is restricted to Doctor accounts only. Please use demo.doctor credentials.')
      }
      setApiAccessToken(res.access)
      setAuth(res)
    } catch (err) {
      setError(err.message || 'Doctor login failed. Please check credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setApiAccessToken('')
    setAuth(null)
    setData(null)
    if (onLogout) onLogout()
    else if (onExitToPatientPortal) onExitToPatientPortal()
  }

  const handleAction = async (bookingId, action) => {
    setActionLoading(true)
    setError('')
    try {
      await apiRequest(`/staff/bookings/${bookingId}/action/`, {
        method: 'POST',
        body: { action }
      })
      await refreshQueue()
    } catch (err) {
      setError(err.message || `Failed to perform ${action}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCallNext = async () => {
    // Next candidate: first arrived, or next waiting
    const candidate = data?.bookings?.find(b => b.status === 'arrived') ||
                      data?.bookings?.find(b => b.status === 'waiting')
    if (!candidate) {
      setError('No waiting or arrived patients remaining in queue.')
      return
    }
    await handleAction(candidate.id, 'call_next')
  }

  const handleTogglePause = async () => {
    const nextState = !data?.paused
    setActionLoading(true)
    try {
      await apiRequest('/staff/queue/control/', {
        method: 'POST',
        body: { action: nextState ? 'pause' : 'resume', date }
      })
      await refreshQueue()
    } catch (err) {
      setError(err.message || 'Failed to toggle queue pause')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSaveDelay = async (e) => {
    e.preventDefault()
    setDelayUpdating(true)
    setError('')
    try {
      const res = await broadcastDoctorDelay(Number(delayMinutes), delayReason.trim())
      setDoctorProfile(res.doctor)
      setShowDelayModal(false)
      setToastMsg(`Emergency delay updated to +${delayMinutes}m. Notifications dispatched to ${res.notifications_dispatched || 0} waiting patients.`)
      setTimeout(() => setToastMsg(''), 6000)
      await refreshQueue()
    } catch (err) {
      setError(err.message || 'Failed to broadcast delay')
    } finally {
      setDelayUpdating(false)
    }
  }

  const formatTimer = (totalSec) => {
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const waitingCount = data?.bookings?.filter(b => b.status === 'waiting').length || 0
  const arrivedCount = data?.bookings?.filter(b => b.status === 'arrived').length || 0
  const completedCount = data?.bookings?.filter(b => b.status === 'completed').length || 0

  return (
    <div className="portal-container doctor-portal-theme min-h-screen bg-slate-50 text-slate-800 relative">
      {/* Background Noticeable Faded Image */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <img
          src={doctorBg}
          alt=""
          className="w-full h-full object-cover object-center filter blur-[1px] opacity-[0.35] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/50 to-slate-50/70" />
      </div>
      {/* Top Bar */}
      <header className="portal-topbar bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="portal-brand flex items-center gap-3">
          <div className="brand-icon-box doctor-brand-box w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            <Stethoscope size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="portal-title text-base font-bold text-slate-900 badge-highlight-doctor">
                👨‍⚕️ {auth?.doctor_name || auth?.full_name || 'Dr. On Duty'}
              </span>
              <span className="badge-highlight-dept">
                🏥 {doctorProfile?.department_name || data?.doctor?.department_name || 'OPD Specialist'}
              </span>
              {(doctorProfile?.room_number || data?.doctor?.room_number) && (
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-xs border border-slate-200">
                  {doctorProfile?.room_number || data?.doctor?.room_number}
                </span>
              )}
            </div>
            <span className="portal-sub text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Building2 size={12} className="text-blue-500" />
              <strong>{data?.hospital?.name || auth?.hospital_name || 'DEMO General Hospital'}</strong>
              <span>({data?.hospital?.city || 'Dehradun / Rishikesh'})</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 sm:mt-0">
          <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
            ✨ Skip the Line. Save Your Time.
          </span>

          {auth && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                streamMode === 'sse'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title={streamMode === 'sse' ? 'Connected via real-time Server-Sent Events' : 'Using active interval polling fallback'}
            >
              <span className={`w-2 h-2 rounded-full ${streamMode === 'sse' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {streamMode === 'sse' ? 'Live Stream (SSE)' : 'Live Polling'}
            </span>
          )}

          {auth && (
            <button
              onClick={() => setShowDelayModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                doctorProfile?.delay_minutes > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle size={14} className={doctorProfile?.delay_minutes > 0 ? "text-amber-500" : ""} />
              <span>
                {doctorProfile?.delay_minutes > 0 ? `Delay Active (+${doctorProfile.delay_minutes}m)` : 'Broadcast Delay'}
              </span>
            </button>
          )}

          <button
            type="button"
            className="portal-exit-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200 transition"
            onClick={handleLogout}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {toastMsg && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between shadow-sm">
            <span>{toastMsg}</span>
            <button onClick={() => setToastMsg('')} className="font-bold ml-3 text-emerald-900">&times;</button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="portal-main-content max-w-7xl mx-auto p-6 space-y-6 relative z-10">
        {!auth ? (
          /* Doctor Login Form */
          <div className="portal-login-card max-w-md mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
            <div className="login-card-badge doctor-badge w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/30">
              <Stethoscope size={28} />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Doctor Portal Sign In</h2>
              <p className="text-xs text-slate-500">Access your designated OPD consultation queue and patient flow controls.</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="login-form space-y-4 text-sm">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Doctor Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition"
              >
                {loading ? 'Authenticating...' : 'Sign In as Doctor'}
              </button>
            </form>
          </div>
        ) : (
          /* Doctor Active Console */
          <div className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 text-sm">
                <AlertCircle size={18} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Emergency Delay Banner if doctor declared delay */}
            {doctorProfile?.delay_minutes > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-amber-800 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                  <span>
                    Emergency Delay Broadcasted: <strong>+{doctorProfile.delay_minutes} minutes</strong> ({doctorProfile.delay_reason})
                  </span>
                </div>
                <button
                  onClick={() => handleSaveDelay({ preventDefault: () => {}, delayMinutes: 0, delayReason: '' })}
                  className="text-xs bg-amber-200/60 hover:bg-amber-200 text-amber-900 px-3 py-1 rounded-lg font-semibold transition"
                >
                  Clear Delay
                </button>
              </div>
            )}

            {/* Overview Metric Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Currently Serving</span>
                <div className="mt-1 text-2xl font-bold text-blue-600 font-mono">
                  {servingBooking ? servingBooking.token_number : 'None'}
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Checked-In / Arrived</span>
                <div className="mt-1 text-2xl font-bold text-emerald-600 font-mono">
                  {arrivedCount}
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Waiting Online</span>
                <div className="mt-1 text-2xl font-bold text-slate-700 font-mono">
                  {waitingCount}
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Completed Today</span>
                <div className="mt-1 text-2xl font-bold text-indigo-600 font-mono">
                  {completedCount}
                </div>
              </div>
            </div>

            {/* Currently In Consultation (Hero Card) */}
            <div className="bg-white p-6 rounded-3xl border-2 border-blue-500/40 shadow-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-blue-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping"></span>
                  <span>Active Consultation Room</span>
                </div>
                {servingBooking && (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-xl font-mono text-sm font-semibold border border-blue-200">
                    <Timer size={16} />
                    <span>Elapsed: {formatTimer(elapsedSeconds)}</span>
                  </div>
                )}
              </div>

              {servingBooking ? (
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-extrabold text-slate-900 font-mono">{servingBooking.token_number}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        IN CONSULTATION
                      </span>
                    </div>
                    <div className="text-lg font-bold text-slate-800">{servingBooking.patient_display_name}</div>
                    <div className="text-xs text-slate-500">
                      Slot: {servingBooking.slot_time} • Type: <span className="capitalize font-semibold">{servingBooking.booking_type || 'online'}</span>
                      {servingBooking.notes && ` • Notes: ${servingBooking.notes}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction(servingBooking.id, 'complete')}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-md transition"
                    >
                      <Check size={18} />
                      <span>Complete Consultation</span>
                    </button>
                    <button
                      onClick={() => handleAction(servingBooking.id, 'skip')}
                      disabled={actionLoading}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition"
                    >
                      <SkipForward size={18} />
                      <span>Skip</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-slate-500">No patient is currently in consultation.</p>
                  <button
                    onClick={handleCallNext}
                    disabled={actionLoading || (waitingCount === 0 && arrivedCount === 0)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                  >
                    <Play size={18} />
                    <span>Call Next Patient</span>
                  </button>
                </div>
              )}
            </div>

            {/* Queue Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900 text-sm">Today's Patient Queue ({data?.bookings?.length || 0})</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTogglePause}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                      data?.paused
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-amber-50 text-amber-700 border-amber-300'
                    }`}
                  >
                    {data?.paused ? <Play size={14} /> : <Pause size={14} />}
                    <span>{data?.paused ? 'Resume Queue' : 'Pause Queue'}</span>
                  </button>
                  <button
                    onClick={handleCallNext}
                    disabled={actionLoading}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
                  >
                    Call Next
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Token</th>
                      <th className="py-3 px-4">Patient</th>
                      <th className="py-3 px-4">Slot</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(!data?.bookings || data.bookings.length === 0) ? (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Users className="w-8 h-8 text-slate-300" />
                            <span className="font-medium text-slate-600 text-sm">No appointments scheduled for today</span>
                            <span className="text-xs text-slate-400">New patient bookings or walk-in tokens will appear here automatically in real time.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      data.bookings.map(b => (
                        <tr key={b.id} className={b.status === 'serving' ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'}>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.token_number}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{b.patient_display_name}</td>
                          <td className="py-3 px-4 font-mono text-xs">{b.slot_time}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              b.status === 'serving' ? 'bg-blue-100 text-blue-800' :
                              b.status === 'arrived' ? 'bg-emerald-100 text-emerald-800' :
                              b.status === 'completed' ? 'bg-slate-100 text-slate-600' :
                              b.status === 'skipped' ? 'bg-amber-100 text-amber-800' :
                              b.status === 'missed' ? 'bg-red-100 text-red-800' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {b.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 capitalize text-xs text-slate-500">{b.booking_type || 'online'}</td>
                          <td className="py-3 px-4 text-right space-x-1">
                            {b.status === 'waiting' && (
                              <button
                                onClick={() => handleAction(b.id, 'arrived')}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              >
                                Arrived
                              </button>
                            )}
                            {b.status === 'skipped' && (
                              <button
                                onClick={() => handleAction(b.id, 'recall')}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 flex-inline items-center gap-1"
                              >
                                <RotateCcw size={12} className="inline mr-1" />
                                Recall
                              </button>
                            )}
                            {['waiting', 'arrived'].includes(b.status) && (
                              <button
                                onClick={() => handleAction(b.id, 'serving')}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                              >
                                Call In
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Emergency Delay Modal */}
      {showDelayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                <span>Broadcast Emergency Delay</span>
              </h3>
              <button onClick={() => setShowDelayModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveDelay} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Expected Delay Duration (Minutes)</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[10, 15, 20, 30].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDelayMinutes(m)}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                        delayMinutes === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      +{m}m
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={delayMinutes}
                  onChange={e => setDelayMinutes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Reason (Shown to Patients)</label>
                <input
                  type="text"
                  required
                  value={delayReason}
                  onChange={e => setDelayReason(e.target.value)}
                  placeholder="e.g. Attending emergency surgery"
                  className="w-full px-3 py-2 border rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDelayModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={delayUpdating}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                >
                  {delayUpdating ? 'Saving...' : 'Broadcast to Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default DoctorPortal
