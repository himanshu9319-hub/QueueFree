import { useState, useEffect } from 'react'
import {
  Building2, Users, Check, SkipForward, LogOut, RefreshCw, PlusCircle,
  AlertCircle, ArrowLeft, Search, CheckCircle2, Clock, Printer,
  UserCheck, ShieldCheck, FileText, UserPlus
} from 'lucide-react'
import {
  apiRequest, localIsoDate, setApiAccessToken, staffLogin,
  createWalkInBooking, triggerAutoNoShow, createSseQueueSubscriber
} from '../../lib/queueApi'
import receptionBg from '../../assets/backgrounds/reception-bg.png'

export function ReceptionPortal({ onExitToPatientPortal, onLogout, initialAuth = null }) {
  const [username, setUsername] = useState('demo.reception')
  const [password, setPassword] = useState('Reception@2026!')
  const [auth, setAuth] = useState(initialAuth)
  const [data, setData] = useState(null)
  const [departments, setDepartments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [streamMode, setStreamMode] = useState('connecting')
  const [date, setDate] = useState(localIsoDate())
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  // Walk-in modal state
  const [showWalkInModal, setShowWalkInModal] = useState(false)
  const [walkInError, setWalkInError] = useState('')
  const [walkInForm, setWalkInForm] = useState({
    patient_name: '',
    phone: '',
    age: '',
    gender: 'male',
    department_id: '',
    doctor_id: '',
    symptoms: '',
  })
  const [walkInLoading, setWalkInLoading] = useState(false)
  const [lastIssuedToken, setLastIssuedToken] = useState(null)

  const demoReceptionPassword = import.meta.env.VITE_DEMO_RECEPTION_PASSWORD || 'Reception@2026!'

  const refreshQueue = async () => {
    if (!auth) return
    try {
      const res = await apiRequest(`/staff/queue/?date=${encodeURIComponent(date)}`)
      setData(res)
      setError('')
    } catch (err) {
      setError(err.message || 'Unable to connect to live queue server.')
    }
  }

  const fetchHospitalMetadata = async (hospId) => {
    if (!hospId) return
    try {
      const [deptsRes, docsRes] = await Promise.all([
        apiRequest(`/hospitals/${hospId}/departments/`),
        apiRequest(`/doctors/?hospital_id=${hospId}`),
      ])
      const dList = Array.isArray(deptsRes) ? deptsRes : deptsRes.results || []
      const docList = Array.isArray(docsRes) ? docsRes : docsRes.results || []
      setDepartments(dList)
      setDoctors(docList)
      if (dList.length > 0) {
        setWalkInForm(prev => ({
          ...prev,
          department_id: prev.department_id || dList[0].id,
          doctor_id: prev.doctor_id || docList[0]?.id || '',
        }))
      }
    } catch {
      // Ignored non-critical
    }
  }

  useEffect(() => {
    if (auth) {
      setLoading(true)
      refreshQueue().finally(() => setLoading(false))
      if (auth.hospital_id) {
        fetchHospitalMetadata(auth.hospital_id)
      }

      const sub = createSseQueueSubscriber({
        path: `/staff/queue/stream/?date=${encodeURIComponent(date)}`,
        onUpdate: (streamPayload) => {
          setData(streamPayload)
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

  const handleLogin = async (e) => {
    e?.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await staffLogin(username, password)
      if (!['reception', 'hospital_admin', 'super_admin'].includes(res.role)) {
        throw new Error('This console is for Reception or Hospital Admin accounts. Use demo.reception.')
      }
      setApiAccessToken(res.access)
      setAuth(res)
      if (res.hospital_id) {
        fetchHospitalMetadata(res.hospital_id)
      }
    } catch (err) {
      setError(err.message || 'Reception login failed. Please check credentials.')
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
    try {
      await apiRequest(`/staff/bookings/${bookingId}/action/`, {
        method: 'POST',
        body: { action }
      })
      await refreshQueue()
    } catch (err) {
      setError(err.message || `Failed to perform ${action}`)
    }
  }

  const handleAutoNoShow = async () => {
    try {
      const res = await triggerAutoNoShow(30)
      setToast(`Processed ${res.processed_count} auto no-show records.`)
      await refreshQueue()
    } catch (err) {
      setError(err.message || 'Failed to trigger auto no-show')
    }
  }

  const handleWalkInSubmit = async (e) => {
    e.preventDefault()
    setWalkInLoading(true)
    setError('')
    setWalkInError('')
    try {
      const payload = {
        patient_name: walkInForm.patient_name.trim(),
        phone: walkInForm.phone.trim(),
        age: walkInForm.age ? Number(walkInForm.age) : null,
        gender: walkInForm.gender,
        department_id: Number(walkInForm.department_id),
        doctor_id: Number(walkInForm.doctor_id),
        symptoms: walkInForm.symptoms.trim(),
      }
      const created = await createWalkInBooking(payload)
      setLastIssuedToken(created)
      setShowWalkInModal(false)
      setWalkInError('')
      setToast(`Walk-in token ${created.token_number} issued! Confirmation SMS dispatched to ${walkInForm.phone.trim()}.`)
      setWalkInForm({
        patient_name: '',
        phone: '',
        age: '',
        gender: 'male',
        department_id: departments[0]?.id || '',
        doctor_id: doctors[0]?.id || '',
        symptoms: '',
      })
      await refreshQueue()
    } catch (err) {
      const msg = err.message || 'Failed to issue walk-in token'
      setWalkInError(msg)
      setError(msg)
    } finally {
      setWalkInLoading(false)
    }
  }

  const filteredBookings = (data?.bookings || []).filter(b => {
    const searchLower = (searchFilter || '').toLowerCase()
    const matchesSearch =
      String(b.token_number || '').toLowerCase().includes(searchLower) ||
      String(b.patient_display_name || '').toLowerCase().includes(searchLower) ||
      String(b.department_name || '').toLowerCase().includes(searchLower)
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter
    const matchesDept = departmentFilter === 'all' || b.department_name === departmentFilter
    return matchesSearch && matchesStatus && matchesDept
  })

  return (
    <div className="portal-container reception-portal-theme min-h-screen bg-slate-50 text-slate-800 relative">
      {/* Background Noticeable Faded Image */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <img
          src={receptionBg}
          alt=""
          className="w-full h-full object-cover object-center filter blur-[1px] opacity-[0.35] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/50 to-slate-50/70" />
      </div>
      {/* Top Header */}
      <header className="portal-topbar bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="portal-brand flex items-center gap-3">
          <div className="brand-icon-box reception-brand-box w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
            <Building2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="portal-title text-base font-bold text-slate-900">
                {auth?.username === 'reception.2' ? 'Reception Desk 2 (Specialty OPD)' : 'Reception Desk 1 (Main OPD Lobby)'}
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold text-xs border border-indigo-200">
                Front Desk Counter
              </span>
            </div>
            <span className="portal-sub text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Building2 size={12} className="text-indigo-500" />
              <strong>{data?.hospital?.name || auth?.hospital_name || 'DEMO General Hospital'}</strong>
              <span>({data?.hospital?.city || 'Dehradun / Rishikesh'})</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 sm:mt-0">
          <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs">
            ✨ Skip the Line. Save Your Time.
          </span>

          {auth && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                streamMode === 'sse'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title={streamMode === 'sse' ? 'Live queue stream active via Server-Sent Events' : 'Using active interval polling fallback'}
            >
              <span className={`w-2 h-2 rounded-full ${streamMode === 'sse' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {streamMode === 'sse' ? 'Live Stream (SSE)' : 'Live Polling'}
            </span>
          )}

          {auth && (
            <button
              onClick={() => { setShowWalkInModal(true); setWalkInError(''); }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
            >
              <UserPlus size={14} />
              <span>Issue Walk-in Token</span>
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

      {/* Main Content */}
      <main className="portal-main-content max-w-7xl mx-auto p-6 space-y-6 relative z-10">
        {!auth ? (
          <div className="portal-login-card max-w-md mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
            <div className="login-card-badge reception-badge w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-indigo-500/30">
              <Building2 size={28} />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Reception Desk Sign In</h2>
              <p className="text-xs text-slate-500">Sign in to manage OPD queue flow, patient arrivals, and in-person walk-ins.</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="login-form space-y-4 text-sm">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Reception Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md transition"
              >
                {loading ? 'Authenticating...' : 'Sign In to Reception'}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 text-sm">
                <AlertCircle size={18} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {toast && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <span>{toast}</span>
                </div>
                <button onClick={() => setToast('')} className="text-emerald-600 text-xs">✕</button>
              </div>
            )}

            {/* Reception Counter Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Today's Total OPD</span>
                <div className="mt-1 text-2xl font-bold text-slate-900 font-mono">
                  {data?.bookings?.length || 0}
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Checked In / Arrived</span>
                <div className="mt-1 text-2xl font-bold text-emerald-600 font-mono">
                  {data?.bookings?.filter(b => b.status === 'arrived').length || 0}
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Awaiting Arrival</span>
                <div className="mt-1 text-2xl font-bold text-amber-600 font-mono">
                  {data?.bookings?.filter(b => b.status === 'waiting').length || 0}
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-medium text-slate-500">Completed Visits</span>
                <div className="mt-1 text-2xl font-bold text-indigo-600 font-mono">
                  {data?.bookings?.filter(b => b.status === 'completed').length || 0}
                </div>
              </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 flex-1 min-w-[260px]">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by token, patient name, doctor..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-medium text-slate-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="waiting">Waiting (Pre-booked)</option>
                  <option value="arrived">Arrived (Checked In)</option>
                  <option value="serving">In Consultation</option>
                  <option value="completed">Completed</option>
                  <option value="missed">Missed / No-Show</option>
                </select>

                {departments.length > 0 && (
                  <select
                    value={departmentFilter}
                    onChange={e => setDepartmentFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-medium text-slate-700"
                  >
                    <option value="all">All Departments ({departments.length})</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoNoShow}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition"
                  title="Mark late unarrived patients past grace time as no-show"
                >
                  <Clock size={14} />
                  <span>Check No-Shows</span>
                </button>

                <button
                  onClick={() => setShowWalkInModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                >
                  <PlusCircle size={14} />
                  <span>Issue Walk-in</span>
                </button>
              </div>
            </div>

            {/* Queue Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Token</th>
                      <th className="py-3 px-4">Patient</th>
                      <th className="py-3 px-4">Doctor & Room</th>
                      <th className="py-3 px-4">Slot Time</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Desk Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No OPD appointments found for selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.token_number}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            <div>{b.patient_display_name}</div>
                            {b.notes && <div className="text-[11px] font-normal text-slate-400 italic">{b.notes}</div>}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className="badge-highlight-doctor" style={{ display: 'inline-flex', marginBottom: '4px' }}>
                              👨‍⚕️ {b.doctor_name}
                            </span>
                            <div className="badge-highlight-dept" style={{ display: 'inline-flex' }}>
                              🏥 {b.department_name} {b.doctor_room ? `· (${b.doctor_room})` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">{b.slot_time}</td>
                          <td className="py-3 px-4 capitalize text-xs">
                            <span className={`px-2 py-0.5 rounded font-semibold ${
                              b.booking_type === 'walk_in' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {b.booking_type || 'online'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              b.status === 'serving' ? 'bg-blue-100 text-blue-800' :
                              b.status === 'arrived' ? 'bg-emerald-100 text-emerald-800' :
                              b.status === 'completed' ? 'bg-slate-100 text-slate-600' :
                              b.status === 'missed' ? 'bg-red-100 text-red-800' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {b.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {b.status === 'waiting' && (
                              <button
                                onClick={() => handleAction(b.id, 'arrived')}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                              >
                                Check In
                              </button>
                            )}
                            {b.status === 'arrived' && (
                              <span className="text-xs text-emerald-600 font-semibold flex items-center justify-end gap-1">
                                <Check size={14} />
                                Checked In
                              </span>
                            )}
                            {['serving', 'completed'].includes(b.status) && (
                              <span className="text-xs text-slate-400 font-medium">In Flow</span>
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

      {/* Walk-in Token Generation Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus size={18} className="text-indigo-600" />
                <span>Issue Walk-in OPD Token</span>
              </h3>
              <button onClick={() => { setShowWalkInModal(false); setWalkInError(''); }}>✕</button>
            </div>

            {walkInError && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block text-red-800">Cannot Issue Token: 1-Active-Token Rule</strong>
                  <span className="leading-relaxed">{walkInError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleWalkInSubmit} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Patient Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={walkInForm.patient_name}
                  onChange={e => setWalkInForm({ ...walkInForm, patient_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="10-digit number"
                    value={walkInForm.phone}
                    onChange={e => setWalkInForm({ ...walkInForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Gender / Age</label>
                  <div className="flex gap-2">
                    <select
                      value={walkInForm.gender}
                      onChange={e => setWalkInForm({ ...walkInForm, gender: e.target.value })}
                      className="px-2 py-2 border rounded-xl outline-none bg-white w-24 text-xs font-medium"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Age"
                      value={walkInForm.age}
                      onChange={e => setWalkInForm({ ...walkInForm, age: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-sky-50/60 border border-sky-200 rounded-xl">
                  <label className="block text-sky-900 font-bold text-xs uppercase mb-1 flex items-center gap-1.5">
                    <Building2 size={13} className="text-sky-600" />
                    <span>OPD Department *</span>
                  </label>
                  <select
                    required
                    value={walkInForm.department_id}
                    onChange={e => {
                      const dId = Number(e.target.value)
                      const matchingDocs = doctors.filter(d => d.department === dId)
                      setWalkInForm({
                        ...walkInForm,
                        department_id: dId,
                        doctor_id: matchingDocs[0]?.id || '',
                      })
                    }}
                    className="w-full px-3 py-2 border border-sky-300 rounded-xl outline-none bg-white font-semibold text-slate-800 text-xs"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
                  <label className="block text-purple-900 font-bold text-xs uppercase mb-1 flex items-center gap-1.5">
                    <Stethoscope size={13} className="text-purple-600" />
                    <span>Consulting Doctor *</span>
                  </label>
                  <select
                    required
                    value={walkInForm.doctor_id}
                    onChange={e => setWalkInForm({ ...walkInForm, doctor_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-purple-300 rounded-xl outline-none bg-white font-semibold text-slate-800 text-xs"
                  >
                    {doctors
                      .filter(d => !walkInForm.department_id || d.department === Number(walkInForm.department_id))
                      .map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.display_name} ({doc.room_number})</option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Chief Symptoms / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Fever, cough, follow-up"
                  value={walkInForm.symptoms}
                  onChange={e => setWalkInForm({ ...walkInForm, symptoms: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={walkInLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md transition"
                >
                  {walkInLoading ? 'Allocating Token...' : 'Issue & Check In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Token Slip Modal */}
      {lastIssuedToken && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Walk-in Token Issued</h3>
              <p className="text-xs text-slate-500">Patient checked in directly at counter</p>
            </div>

            <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl space-y-2">
              <div className="text-xs font-semibold text-slate-500">{lastIssuedToken.hospital_name}</div>
              <div className="text-4xl font-extrabold text-indigo-700 font-mono tracking-tight">
                {lastIssuedToken.token_number}
              </div>
              <div className="text-sm font-bold text-slate-800">{lastIssuedToken.patient_display_name}</div>
              <div className="text-xs text-slate-600">
                {lastIssuedToken.doctor_name} • {lastIssuedToken.doctor_room}
              </div>
              <div className="text-[11px] text-slate-400">
                Est. Wait: ~{lastIssuedToken.estimated_wait_minutes || 0} mins • Queue Seq: #{lastIssuedToken.queue_sequence}
              </div>
            </div>

            <div className="flex gap-2 justify-center">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-50"
              >
                <Printer size={14} />
                <span>Print Slip</span>
              </button>
              <button
                onClick={() => setLastIssuedToken(null)}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default ReceptionPortal
