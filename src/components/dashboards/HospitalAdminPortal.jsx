import { useState, useEffect } from 'react'
import {
  Building2, Users, Calendar, Clock, Stethoscope, Plus, RefreshCw,
  LogOut, CheckCircle2, AlertCircle, Settings, Layers, CalendarCheck,
  Bell, MessageSquare
} from 'lucide-react'
import {
  getHospitalAdminDetails, updateHospitalAdminDetails,
  getHospitalAdminDepartments, createHospitalAdminDepartment,
  getHospitalAdminDoctors, createHospitalAdminDoctor,
  generateDoctorSlots, getHospitalAdminStaff, setApiAccessToken,
  getHospitalAdminNotifications
} from '../../lib/queueApi'
import hospitalAdminBg from '../../assets/backgrounds/hospital-admin-bg.png'

export function HospitalAdminPortal({ onExitToPatientPortal, onLogout, initialAuth = null }) {
  const [hospital, setHospital] = useState(null)
  const [departments, setDepartments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [staff, setStaff] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState('overview') // 'overview' | 'departments' | 'doctors' | 'slots' | 'staff' | 'notifications' | 'settings'

  // Modals & Forms
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' })

  const [showDocModal, setShowDocModal] = useState(false)
  const [docForm, setDocForm] = useState({
    display_name: '',
    qualification: 'MBBS, MD',
    room_number: 'Room 101',
    department: '',
    average_consultation_minutes: 10,
  })

  const [showSlotGenModal, setShowSlotGenModal] = useState(false)
  const [slotGenForm, setSlotGenForm] = useState({
    doctor_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  })
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [hospData, deptsData, docsData, staffData, notifsData] = await Promise.all([
        getHospitalAdminDetails(),
        getHospitalAdminDepartments(),
        getHospitalAdminDoctors(),
        getHospitalAdminStaff(),
        getHospitalAdminNotifications().catch(() => []),
      ])
      setHospital(hospData)
      setDepartments(Array.isArray(deptsData) ? deptsData : deptsData.results || [])
      setDoctors(Array.isArray(docsData) ? docsData : docsData.results || [])
      setStaff(Array.isArray(staffData) ? staffData : staffData.results || [])
      setNotifications(Array.isArray(notifsData) ? notifsData : [])
      if (deptsData.length > 0 && !docForm.department) {
        setDocForm(prev => ({ ...prev, department: deptsData[0].id }))
      }
      if (docsData.length > 0 && !slotGenForm.doctor_id) {
        setSlotGenForm(prev => ({ ...prev, doctor_id: docsData[0].id }))
      }
    } catch (err) {
      setError(err.message || 'Failed to load hospital admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreateDepartment = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    setError('')
    try {
      await createHospitalAdminDepartment(deptForm)
      setToast('Department created successfully!')
      setShowDeptModal(false)
      setDeptForm({ name: '', code: '', description: '' })
      fetchData()
    } catch (err) {
      setError(err.message || 'Failed to create department')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateDoctor = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    setError('')
    try {
      await createHospitalAdminDoctor(docForm)
      setToast('Doctor registered successfully!')
      setShowDocModal(false)
      setDocForm({ display_name: '', qualification: 'MBBS, MD', room_number: 'Room 101', department: departments[0]?.id || '', average_consultation_minutes: 10 })
      fetchData()
    } catch (err) {
      setError(err.message || 'Failed to register doctor')
    } finally {
      setActionLoading(false)
    }
  }

  const handleGenerateSlots = async (e) => {
    e.preventDefault()
    setActionLoading(true)
    setError('')
    try {
      const res = await generateDoctorSlots(slotGenForm)
      setToast(`Generated ${res.slots_created} slots successfully!`)
      setShowSlotGenModal(false)
    } catch (err) {
      setError(err.message || 'Slot generation failed')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="portal-container min-h-screen bg-slate-50 text-slate-800 relative">
      {/* Background Noticeable Faded Image */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <img
          src={hospitalAdminBg}
          alt=""
          className="w-full h-full object-cover object-center filter blur-[1px] opacity-[0.35] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/50 to-slate-50/70" />
      </div>

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
            <Building2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {hospital?.name || 'Hospital Administration'}
              </h1>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-xs font-semibold">
                Tenant Scoped
              </span>
            </div>
            <p className="text-xs text-slate-500">{hospital?.city || 'Healthcare Operations Portal'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 sm:mt-0">
          <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
            ✨ Skip the Line. Save Your Time.
          </span>

          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setApiAccessToken('')
              onLogout?.()
              onExitToPatientPortal?.()
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium transition"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-6 space-y-6 relative z-10">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle size={18} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {toast && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-sm">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{toast}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-sm font-medium">
          <button
            onClick={() => setTab('overview')}
            className={`px-4 py-2 rounded-xl transition ${tab === 'overview' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setTab('departments')}
            className={`px-4 py-2 rounded-xl transition ${tab === 'departments' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Departments ({departments.length})
          </button>
          <button
            onClick={() => setTab('doctors')}
            className={`px-4 py-2 rounded-xl transition ${tab === 'doctors' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Doctors ({doctors.length})
          </button>
          <button
            onClick={() => setTab('slots')}
            className={`px-4 py-2 rounded-xl transition ${tab === 'slots' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Shift Schedules & Slots
          </button>
          <button
            onClick={() => setTab('staff')}
            className={`px-4 py-2 rounded-xl transition ${tab === 'staff' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Staff Accounts ({staff.length})
          </button>
          <button
            onClick={() => setTab('notifications')}
            className={`px-4 py-2 rounded-xl transition ${tab === 'notifications' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Notifications / SMS Audit ({notifications.length})
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {tab === 'overview' && hospital && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-slate-500 text-sm font-medium">Active Departments</div>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">{departments.length}</div>
                <div className="mt-1 text-xs text-blue-600">Configured OPD clinics</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-slate-500 text-sm font-medium">On-Duty Doctors</div>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">{doctors.filter(d => d.is_available).length}</div>
                <div className="mt-1 text-xs text-emerald-600">{doctors.length} registered specialists</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-slate-500 text-sm font-medium">Consultation Fee</div>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">
                  {hospital.payment_required ? `₹${hospital.consultation_fee}` : 'Free'}
                </div>
                <div className="mt-1 text-xs text-slate-500">OPD ticket charge</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-slate-500 text-sm font-medium">Staff Accounts</div>
                <div className="mt-2 text-3xl font-extrabold text-slate-900">{staff.length}</div>
                <div className="mt-1 text-xs text-slate-500">Receptionists & Doctors</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900">Hospital Facility Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 block">Facility Name</span>
                  <span className="font-semibold text-slate-800">{hospital.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">City & Region</span>
                  <span className="font-semibold text-slate-800">{hospital.city}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Address</span>
                  <span className="font-semibold text-slate-800">{hospital.address || 'Not specified'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Official Contact</span>
                  <span className="font-semibold text-slate-800">{hospital.phone || 'Not specified'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DEPARTMENTS */}
        {tab === 'departments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">OPD Clinical Departments</h3>
              <button
                onClick={() => setShowDeptModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
              >
                <Plus size={16} />
                <span>Add Department</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept) => (
                <div key={dept.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-base">{dept.name}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-xs font-semibold uppercase">
                      {dept.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{dept.description || 'Specialized outpatient medical consultation'}</p>
                  <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100">
                    <span>Doctors: {dept.doctors_count || 0}</span>
                    <span className="text-emerald-600 font-medium">Active</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DOCTORS */}
        {tab === 'doctors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Registered Medical Doctors</h3>
              <button
                onClick={() => setShowDocModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition"
              >
                <Plus size={16} />
                <span>Register Doctor</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((doc) => (
                <div key={doc.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-base">{doc.display_name}</div>
                      <div className="text-xs text-blue-600 font-medium">{doc.qualification || 'MBBS, MD'}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold text-xs">
                      {doc.room_number || 'Room 101'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Department: <span className="font-medium text-slate-700">{doc.department_name}</span></div>
                    <div>Avg Consultation: <span className="font-medium text-slate-700">{doc.average_consultation_minutes} mins</span></div>
                    {doc.delay_minutes > 0 && (
                      <div className="text-amber-600 font-semibold">⚠️ Delay: +{doc.delay_minutes}m ({doc.delay_reason})</div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
                    <span className={doc.is_available ? 'text-emerald-600 font-semibold' : 'text-slate-400 font-medium'}>
                      ● {doc.is_available ? 'Available' : 'On Leave'}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">ID #{doc.id}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SHIFT SCHEDULES & SLOTS */}
        {tab === 'slots' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Doctor Shifts & OPD Slot Generator</h3>
                <p className="text-xs text-slate-500">Generate atomic appointment slots for doctors based on weekly schedules</p>
              </div>
              <button
                onClick={() => setShowSlotGenModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition"
              >
                <CalendarCheck size={16} />
                <span>Run Slot Generator</span>
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700">Configured Weekly Shifts</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doctors.map(d => (
                  <div key={d.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="font-bold text-slate-900 text-sm">{d.display_name} ({d.department_name})</div>
                    <div className="text-xs text-slate-500">
                      {d.schedules && d.schedules.length > 0 ? (
                        <div className="space-y-1">
                          {d.schedules.map(s => (
                            <div key={s.id} className="flex justify-between">
                              <span>{s.day_name}: {s.start_time} - {s.end_time}</span>
                              <span className="font-mono text-slate-400">{s.slot_duration_minutes}m slots (cap: {s.slot_capacity})</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span>Default: Mon-Sat 09:00 - 13:00 (15m intervals)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: STAFF */}
        {tab === 'staff' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-900">
              Staff Members Assigned to Facility
            </div>
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Assigned Doctor</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{s.username}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {s.role_label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{s.doctor_name || 'N/A (Front Desk)'}</td>
                    <td className="py-3 px-4 text-emerald-600 font-semibold text-xs">Active</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 6: NOTIFICATIONS / SMS AUDIT */}
        {tab === 'notifications' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Patient SMS, WhatsApp & Alert Logs</h3>
                <p className="text-xs text-slate-500">Live delivery records for booking confirmations, turn-near alerts, and doctor delays</p>
              </div>
              <button
                onClick={fetchData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs text-slate-600 hover:bg-slate-50 transition"
              >
                <RefreshCw size={13} />
                <span>Refresh Logs</span>
              </button>
            </div>
            {notifications.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                No notifications logged for this facility yet. SMS and turn-near alerts will appear here as patients book and doctors call tokens.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Channel</th>
                      <th className="py-3 px-4">Message Preview</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Dispatched At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {notifications.map(n => (
                      <tr key={n.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {n.recipient_phone}
                          {n.recipient_name && <span className="block text-[11px] text-slate-500 font-normal">{n.recipient_name}</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 capitalize">
                            {n.notification_type?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 uppercase font-mono text-[10px] text-slate-500">{n.channel}</td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-700" title={n.message}>{n.message}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {n.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Department Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900">Add Clinical Department</h3>
              <button onClick={() => setShowDeptModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateDepartment} className="space-y-3 text-sm">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dermatology"
                  value={deptForm.name}
                  onChange={e => setDeptForm({ ...deptForm, name: e.target.value, code: deptForm.code || e.target.value.toLowerCase().replace(/\s+/g, '-').slice(0, 10) })}
                  className="w-full px-3 py-2 border rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Code Slug *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. derma"
                  value={deptForm.code}
                  onChange={e => setDeptForm({ ...deptForm, code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowDeptModal(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold">
                  {actionLoading ? 'Saving...' : 'Add Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doctor Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900">Register Doctor</h3>
              <button onClick={() => setShowDocModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateDoctor} className="space-y-3 text-sm">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Doctor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Ramesh Gupta"
                  value={docForm.display_name}
                  onChange={e => setDocForm({ ...docForm, display_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Department *</label>
                <select
                  required
                  value={docForm.department}
                  onChange={e => setDocForm({ ...docForm, department: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl outline-none bg-white font-medium"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Qualifications</label>
                  <input
                    type="text"
                    value={docForm.qualification}
                    onChange={e => setDocForm({ ...docForm, qualification: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Room Number</label>
                  <input
                    type="text"
                    value={docForm.room_number}
                    onChange={e => setDocForm({ ...docForm, room_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowDocModal(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-blue-600 text-white rounded-xl font-semibold">
                  {actionLoading ? 'Saving...' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slot Generator Modal */}
      {showSlotGenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900">Run Slot Generator</h3>
              <button onClick={() => setShowSlotGenModal(false)}>✕</button>
            </div>
            <form onSubmit={handleGenerateSlots} className="space-y-3 text-sm">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Doctor *</label>
                <select
                  required
                  value={slotGenForm.doctor_id}
                  onChange={e => setSlotGenForm({ ...slotGenForm, doctor_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl outline-none bg-white font-medium"
                >
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.display_name} - {d.department_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={slotGenForm.start_date}
                    onChange={e => setSlotGenForm({ ...slotGenForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={slotGenForm.end_date}
                    onChange={e => setSlotGenForm({ ...slotGenForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowSlotGenModal(false)} className="px-4 py-2 text-slate-600">Cancel</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-semibold">
                  {actionLoading ? 'Generating...' : 'Generate Slots'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default HospitalAdminPortal
