import { useState, useEffect } from 'react'
import {
  ShieldAlert, Building2, Plus, RefreshCw, LogOut, CheckCircle2,
  ExternalLink, Database, Activity, Search, AlertCircle, ArrowLeft,
  Settings, Users, Globe, Bell, MessageSquare, Zap, Key, ShieldCheck,
  Check, AlertTriangle
} from 'lucide-react'
import {
  getSuperAdminAnalytics, getSuperAdminHospitals, onboardHospital,
  setApiAccessToken, getSuperAdminNotifications, testHospitalConnection,
  updateHospitalApiConfig
} from '../../lib/queueApi'
import superAdminBg from '../../assets/backgrounds/super-admin-bg.png'

export function SuperAdminPortal({ onExitToPatientPortal, onLogout, initialAuth = null }) {
  const [analytics, setAnalytics] = useState(null)
  const [hospitals, setHospitals] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('hospitals') // 'hospitals' | 'notifications'

  // Modal State for API Configuration & Health Test (Phase 5)
  const [selectedHospitalForApi, setSelectedHospitalForApi] = useState(null)
  const [showApiConfigModal, setShowApiConfigModal] = useState(false)
  const [apiConfigForm, setApiConfigForm] = useState({
    base_url: '',
    auth_type: 'bearer',
    auth_token: '',
    auth_header_name: 'Authorization',
    timeout_seconds: 5,
    max_retries: 2,
    mock_mode: true,
  })
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [apiConfigSaving, setApiConfigSaving] = useState(false)
  const [apiConfigSuccess, setApiConfigSuccess] = useState('')

  // Modal State for Onboarding
  const [showOnboardModal, setShowOnboardModal] = useState(false)
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    slug: '',
    city: '',
    address: '',
    phone: '',
    website: '',
    integration_mode: 'native', // 'native' | 'api' | 'redirect'
    official_booking_url: '',
    api_base_url: '',
    api_auth_token: '',
    payment_required: false,
    consultation_fee: '0.00',
  })
  const [onboardLoading, setOnboardLoading] = useState(false)
  const [onboardSuccess, setOnboardSuccess] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [anData, hospData, notifsData] = await Promise.all([
        getSuperAdminAnalytics(),
        getSuperAdminHospitals(),
        getSuperAdminNotifications().catch(() => []),
      ])
      setAnalytics(anData)
      setHospitals(Array.isArray(hospData) ? hospData : hospData.results || [])
      setNotifications(Array.isArray(notifsData) ? notifsData : [])
    } catch (err) {
      setError(err.message || 'Failed to load platform data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreateHospital = async (e) => {
    e.preventDefault()
    setOnboardLoading(true)
    setError('')
    setOnboardSuccess('')
    try {
      const payload = {
        name: onboardForm.name,
        slug: onboardForm.slug || onboardForm.name.toLowerCase().replace(/\s+/g, '-'),
        city: onboardForm.city,
        address: onboardForm.address,
        phone: onboardForm.phone,
        website: onboardForm.website,
        integration_mode: onboardForm.integration_mode,
        payment_required: onboardForm.payment_required,
        consultation_fee: onboardForm.consultation_fee,
        status: 'active',
      }

      if (onboardForm.integration_mode === 'redirect') {
        payload.official_booking_url = onboardForm.official_booking_url || onboardForm.website
        payload.redirect_url = onboardForm.official_booking_url || onboardForm.website
      } else if (onboardForm.integration_mode === 'api') {
        payload.official_booking_url = onboardForm.official_booking_url
        payload.api_config = {
          base_url: onboardForm.api_base_url,
          auth_token: onboardForm.api_auth_token,
          timeout: 5,
        }
      }

      await onboardHospital(payload)
      setOnboardSuccess(`Successfully onboarded ${onboardForm.name}!`)
      setShowOnboardModal(false)
      setOnboardForm({
        name: '', slug: '', city: '', address: '', phone: '', website: '',
        integration_mode: 'native', official_booking_url: '', api_base_url: '',
        api_auth_token: '', payment_required: false, consultation_fee: '0.00'
      })
      fetchData()
    } catch (err) {
      setError(err.message || 'Failed to onboard hospital')
    } finally {
      setOnboardLoading(false)
    }
  }

  const handleOpenApiConfig = (hosp) => {
    setSelectedHospitalForApi(hosp)
    const cfg = hosp.api_config || {}
    setApiConfigForm({
      base_url: cfg.base_url || '',
      auth_type: cfg.auth_type || 'bearer',
      auth_token: cfg.auth_token || '',
      auth_header_name: cfg.auth_header_name || 'Authorization',
      timeout_seconds: cfg.timeout_seconds || 5,
      max_retries: cfg.max_retries || 2,
      mock_mode: cfg.mock_mode !== undefined ? Boolean(cfg.mock_mode) : true,
    })
    setTestResult(null)
    setApiConfigSuccess('')
    setShowApiConfigModal(true)
  }

  const handleTestConnection = async () => {
    if (!selectedHospitalForApi) return
    setTestingConnection(true)
    setTestResult(null)
    try {
      const res = await testHospitalConnection(selectedHospitalForApi.id)
      setTestResult(res)
    } catch (err) {
      setTestResult({
        success: false,
        status_code: 500,
        latency_ms: 0,
        message: err.message || 'Diagnostic call failed',
      })
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSaveApiConfig = async (e) => {
    e.preventDefault()
    if (!selectedHospitalForApi) return
    setApiConfigSaving(true)
    setApiConfigSuccess('')
    try {
      await updateHospitalApiConfig(selectedHospitalForApi.id, apiConfigForm)
      setApiConfigSuccess('API credentials encrypted and configuration saved successfully!')
      fetchData()
    } catch (err) {
      setError(err.message || 'Failed to update API configuration')
    } finally {
      setApiConfigSaving(false)
    }
  }

  const filteredHospitals = hospitals.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.city.toLowerCase().includes(search.toLowerCase()) ||
    h.integration_mode?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="portal-container min-h-screen bg-slate-50 text-slate-800 relative">
      {/* Background Noticeable Faded Image */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <img
          src={superAdminBg}
          alt=""
          className="w-full h-full object-cover object-center filter blur-[1px] opacity-[0.35] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/50 to-slate-50/70" />
      </div>

      {/* Top Bar */}
      <header className="bg-white text-slate-900 px-6 py-4 flex flex-wrap items-center justify-between border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
            QF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-900">QueueFree Super Admin</h1>
              <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider">
                Platform Root
              </span>
            </div>
            <p className="text-xs text-slate-500">Multi-Tenant SaaS Operations & Governance</p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 sm:mt-0">
          <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 shadow-xs">
            ✨ Skip the Line. Save Your Time.
          </span>

          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm border border-slate-200 transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setApiAccessToken('')
              onLogout?.()
              onExitToPatientPortal?.()
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm border border-red-500/30 transition"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6 space-y-6 relative z-10">
        {/* Error notification */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle size={18} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Platform Metric Cards */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
                <span>Total Hospitals</span>
                <Building2 size={18} className="text-blue-500" />
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {analytics.total_hospitals}
              </div>
              <div className="mt-1 text-xs text-emerald-600 font-medium">
                {analytics.active_hospitals} active facilities
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
                <span>Native OPD System</span>
                <Database size={18} className="text-indigo-500" />
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {analytics.integration_modes?.native || 0}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Full QueueFree managed queue
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
                <span>API / Redirect Modes</span>
                <Globe size={18} className="text-amber-500" />
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {(analytics.integration_modes?.api || 0) + (analytics.integration_modes?.redirect || 0)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {analytics.integration_modes?.api || 0} API • {analytics.integration_modes?.redirect || 0} Redirect
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 text-sm font-medium">
                <span>Today's Bookings</span>
                <Activity size={18} className="text-emerald-500" />
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {analytics.today_metrics?.total_bookings || 0}
              </div>
              <div className="mt-1 text-xs text-blue-600 font-medium">
                {analytics.today_metrics?.active_in_queue || 0} active in queue today
              </div>
            </div>
          </div>
        )}

        {/* Action & Tab Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('hospitals')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                activeTab === 'hospitals' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Hospitals Directory ({hospitals.length})
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                activeTab === 'notifications' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Platform SMS & Alerts Audit ({notifications.length})
            </button>
          </div>

          {activeTab === 'hospitals' && (
            <div className="flex items-center gap-3 flex-1 justify-end min-w-[260px]">
              <div className="relative flex-1 max-w-sm">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search hospitals by name, city, mode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              <button
                onClick={() => setShowOnboardModal(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition shrink-0"
              >
                <Plus size={16} />
                <span>Onboard Hospital</span>
              </button>
            </div>
          )}
        </div>

        {/* Hospitals Table */}
        {activeTab === 'hospitals' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Hospital Facility</th>
                  <th className="py-3.5 px-4">City</th>
                  <th className="py-3.5 px-4">Integration Mode</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Consultation Fee</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHospitals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No hospitals match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredHospitals.map((hosp) => (
                    <tr key={hosp.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div>{hosp.name}</div>
                        <div className="text-xs font-mono text-slate-400 font-normal">{hosp.slug || `hospital-${hosp.id}`}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{hosp.city}</td>
                      <td className="py-3.5 px-4">
                        {hosp.integration_mode === 'api' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            API Integrated
                          </span>
                        ) : hosp.integration_mode === 'redirect' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Website Redirect
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            QueueFree Native
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          hosp.status === 'active' || hosp.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${hosp.status === 'active' || hosp.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {hosp.status || 'Active'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium">
                        {hosp.payment_required ? `₹${hosp.consultation_fee}` : 'Free / Not Required'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenApiConfig(hosp)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition"
                            title="Configure API parameters & run live connectivity diagnostics"
                          >
                            <Zap size={13} className={hosp.integration_mode === 'api' ? 'text-amber-500' : 'text-blue-500'} />
                            <span>{hosp.integration_mode === 'api' ? 'API Config & Test' : 'Test Health'}</span>
                          </button>
                          {hosp.official_booking_url && (
                            <a
                              href={hosp.official_booking_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1"
                            >
                              <span>Portal</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Platform Notifications Audit Table */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Platform-Wide SMS & Notification Delivery Logs</h3>
                <p className="text-xs text-slate-500">Cross-tenant audit trail of all patient queue notifications dispatched across all registered facilities</p>
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
                No notification activity recorded across platform yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="py-3.5 px-4">Hospital Facility</th>
                      <th className="py-3.5 px-4">Recipient</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Channel</th>
                      <th className="py-3.5 px-4">Message Preview</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {notifications.map(n => (
                      <tr key={n.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">{n.hospital_name || 'System / Platform'}</td>
                        <td className="py-3 px-4 font-mono">
                          {n.recipient_phone}
                          {n.recipient_name && <span className="block text-[11px] text-slate-500 font-sans font-normal">{n.recipient_name}</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 capitalize">
                            {n.notification_type?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 uppercase font-mono text-[10px] text-slate-500">{n.channel}</td>
                        <td className="py-3 px-4 max-w-sm truncate text-slate-700" title={n.message}>{n.message}</td>
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

      {/* Onboard Hospital Modal */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Onboard New Hospital</h3>
              <button
                onClick={() => setShowOnboardModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateHospital} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Hospital Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fortis Memorial Hospital"
                  value={onboardForm.name}
                  onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gurugram"
                    value={onboardForm.city}
                    onChange={(e) => setOnboardForm({ ...onboardForm, city: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Slug</label>
                  <input
                    type="text"
                    placeholder="e.g. fortis-gurugram"
                    value={onboardForm.slug}
                    onChange={(e) => setOnboardForm({ ...onboardForm, slug: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Integration Mode *</label>
                <select
                  value={onboardForm.integration_mode}
                  onChange={(e) => setOnboardForm({ ...onboardForm, integration_mode: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl outline-none bg-white font-medium"
                >
                  <option value="native">Native Mode (QueueFree manages queues & slots)</option>
                  <option value="api">API Mode (Hospital has own API)</option>
                  <option value="redirect">Redirect Mode (Link to hospital's website)</option>
                </select>
              </div>

              {onboardForm.integration_mode === 'redirect' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Official Booking Portal URL *</label>
                  <input
                    type="url"
                    required
                    placeholder="https://hospital.com/book-appointment"
                    value={onboardForm.official_booking_url}
                    onChange={(e) => setOnboardForm({ ...onboardForm, official_booking_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none"
                  />
                </div>
              )}

              {onboardForm.integration_mode === 'api' && (
                <div className="space-y-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                  <div>
                    <label className="block font-medium text-purple-900 mb-1">API Base URL</label>
                    <input
                      type="url"
                      placeholder="https://api.hospital.com/v1"
                      value={onboardForm.api_base_url}
                      onChange={(e) => setOnboardForm({ ...onboardForm, api_base_url: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-purple-900 mb-1">API Auth Bearer Token</label>
                    <input
                      type="password"
                      placeholder="Bearer token or secret key"
                      value={onboardForm.api_auth_token}
                      onChange={(e) => setOnboardForm({ ...onboardForm, api_auth_token: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl outline-none bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91-00000-00000"
                    value={onboardForm.phone}
                    onChange={(e) => setOnboardForm({ ...onboardForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Consultation Fee (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={onboardForm.consultation_fee}
                    onChange={(e) => setOnboardForm({ ...onboardForm, consultation_fee: e.target.value, payment_required: Number(e.target.value) > 0 })}
                    className="w-full px-3 py-2 border rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboardLoading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
                >
                  {onboardLoading ? 'Saving...' : 'Confirm Onboarding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* API Configuration & Health Test Diagnostics Modal (Phase 5) */}
      {showApiConfigModal && selectedHospitalForApi && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Hospital API Gateway & Diagnostics</h3>
                  <p className="text-xs text-slate-500">{selectedHospitalForApi.name} ({selectedHospitalForApi.city})</p>
                </div>
              </div>
              <button
                onClick={() => setShowApiConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                &times;
              </button>
            </div>

            {/* Live Diagnostics Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Gateway Status & Health Probe</span>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  <RefreshCw size={13} className={testingConnection ? 'animate-spin' : ''} />
                  <span>{testingConnection ? 'Probing Gateway...' : 'Test Connection Now'}</span>
                </button>
              </div>

              {testResult && (
                <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                  testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-red-50 border-red-200 text-red-950'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      {testResult.success ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-red-600" />}
                      {testResult.success ? 'Gateway Online & Operational' : 'Connection Problem'}
                    </span>
                    <span className="font-mono text-[11px] font-semibold">
                      HTTP {testResult.status_code || 500} &bull; {testResult.latency_ms}ms
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{testResult.message}</p>
                  {testResult.circuit_breaker && typeof testResult.circuit_breaker === 'object' && (
                    <div className="pt-1 border-t border-emerald-200/60 flex items-center gap-3 text-[10px]">
                      <span>Circuit: <strong>{testResult.circuit_breaker.state}</strong></span>
                      <span>Failures: <strong>{testResult.circuit_breaker.failure_count}/{testResult.circuit_breaker.threshold}</strong></span>
                    </div>
                  )}
                  {testResult.fallback_url && (
                    <div className="text-[11px] font-medium text-amber-800 pt-1">
                      Fallback portal configured: <a href={testResult.fallback_url} target="_blank" rel="noreferrer" className="underline">{testResult.fallback_url}</a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* API Configuration Form */}
            <form onSubmit={handleSaveApiConfig} className="space-y-4 text-xs">
              {apiConfigSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
                  <Check size={16} className="text-emerald-600" />
                  <span>{apiConfigSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">API Base URL</label>
                <input
                  type="url"
                  placeholder="https://api.hospital-domain.org/opd/v1"
                  value={apiConfigForm.base_url}
                  onChange={e => setApiConfigForm({ ...apiConfigForm, base_url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Auth Type</label>
                  <select
                    value={apiConfigForm.auth_type}
                    onChange={e => setApiConfigForm({ ...apiConfigForm, auth_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    <option value="bearer">Bearer Token</option>
                    <option value="api_key">API Key (Header)</option>
                    <option value="custom_header">Custom Header</option>
                    <option value="basic">Basic Auth</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Auth Header Name</label>
                  <input
                    type="text"
                    value={apiConfigForm.auth_header_name}
                    onChange={e => setApiConfigForm({ ...apiConfigForm, auth_header_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                  <span>Secret Auth Token</span>
                  <span className="text-[10px] text-slate-400 font-normal">Encrypted with Master AES-HMAC</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter or replace secret token"
                    value={apiConfigForm.auth_token}
                    onChange={e => setApiConfigForm({ ...apiConfigForm, auth_token: e.target.value })}
                    className="w-full px-3 py-2 pl-8 border border-slate-200 rounded-xl font-mono outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <Key size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Timeout (Seconds)</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={apiConfigForm.timeout_seconds}
                    onChange={e => setApiConfigForm({ ...apiConfigForm, timeout_seconds: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Max Retries</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={apiConfigForm.max_retries}
                    onChange={e => setApiConfigForm({ ...apiConfigForm, max_retries: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  id="mock_mode_toggle"
                  checked={apiConfigForm.mock_mode}
                  onChange={e => setApiConfigForm({ ...apiConfigForm, mock_mode: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="mock_mode_toggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Enable Sandbox / Mock Gateway Emulation
                  <span className="block text-[10px] text-slate-400 font-normal">Simulates realistic hospital availability and token reservations when external host is unreachable</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowApiConfigModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={apiConfigSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {apiConfigSaving ? 'Encrypting & Saving...' : 'Save API Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default SuperAdminPortal
