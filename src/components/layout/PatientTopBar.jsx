import { useState, useRef, useEffect } from 'react'
import {
  Bell, MapPin, Search, ChevronDown, LogOut,
  User, CheckCircle, ShieldCheck, Menu, Clock, MessageSquare, AlertTriangle, Check,
  Monitor
} from 'lucide-react'
import { getPatientNotifications } from '../../lib/queueApi'

export function PatientTopBar({
  activeTab,
  patientName = 'Patient',
  patientEmail = 'patient@example.com',
  patientPhone = '+91 98765 43210',
  city = 'Rishikesh, Uttarakhand',
  searchQuery = '',
  onSearchChange,
  onOpenLocation,
  onLogout,
  onToggleMobileMenu,
  unreadCount = 2,
}) {
  const isDashboard = activeTab === 'dashboard'
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const menuRef = useRef(null)
  const notifRef = useRef(null)
  const firstName = patientName.trim().split(' ')[0] || 'Patient'

  // Fetch patient notifications
  useEffect(() => {
    let cancelled = false
    const loadNotifs = async () => {
      try {
        const res = await getPatientNotifications(patientPhone)
        if (!cancelled && Array.isArray(res)) {
          setNotifications(res)
        }
      } catch {
        // Ignored
      }
    }
    loadNotifs()
    const timer = setInterval(loadNotifs, 8000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [patientPhone])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <header className="patient-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-mobile-menu-btn"
          onClick={onToggleMobileMenu}
          aria-label="Open mobile navigation"
        >
          <Menu size={20} />
        </button>

        {isDashboard ? (
          <div className="patient-greeting">
            <h1>Hello, {firstName} 👋</h1>
            <p className="greeting-sub">“Skip the line, save your time.”</p>
          </div>
        ) : (
          <div className="topbar-search-wrap">
            <div className="topbar-search">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => onSearchChange?.(e.target.value)}
                placeholder="Search hospitals near you..."
              />
            </div>
            {city && (
              <button type="button" className="topbar-location-pill" onClick={onOpenLocation}>
                <MapPin size={14} className="location-pin-icon" />
                <span>{city}</span>
                <ChevronDown size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="topbar-right">
        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            className="topbar-icon-btn notification-btn"
            onClick={() => setNotifOpen(!notifOpen)}
            aria-label="Notifications"
            title="Live SMS & Alert notifications"
          >
            <Bell size={18} />
            {notifications.length > 0 && <span className="notification-dot" />}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden text-left">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-blue-600" />
                  <span className="font-bold text-sm text-slate-800">Live SMS & Alerts</span>
                </div>
                <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                  {notifications.length} alerts
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No notifications yet. You will receive booking confirmations, "turn is near" and doctor delay SMS alerts here.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-3.5 hover:bg-slate-50 transition space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">{n.title}</span>
                        <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {n.channel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock size={10} />
                        <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="ml-auto text-emerald-600 font-medium">✓ Delivered</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Public Waiting Hall Live TV Screen Button */}
        <a
          href="/display"
          className="topbar-display-btn"
          title="Open Hospital Waiting Hall Live Display Board (Zero PII)"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Monitor size={15} />
          <span>Live Board</span>
        </a>

        {/* Direct One-Click Logout Button (Requested by User) */}
        <button
          type="button"
          className="topbar-quick-logout-btn"
          onClick={onLogout}
          title="Sign out of this patient account"
        >
          <LogOut size={15} />
          <span>Logout</span>
        </button>

        {/* User Avatar with Profile Dropdown Menu */}
        <div className="user-profile-menu-wrapper" ref={menuRef}>
          <button
            type="button"
            className="user-avatar-badge-btn"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-label="User profile menu"
          >
            <span>{patientName.charAt(0).toUpperCase()}</span>
          </button>

          {userMenuOpen && (
            <div className="user-dropdown-popover">
              <div className="dropdown-user-header">
                <strong>{patientName}</strong>
                <small>{patientEmail}</small>
                <small className="dropdown-phone">{patientPhone}</small>
              </div>

              <div className="dropdown-divider" />

              <button
                type="button"
                className="dropdown-menu-item red-logout-btn"
                onClick={() => {
                  setUserMenuOpen(false)
                  onLogout?.()
                }}
              >
                <LogOut size={15} />
                <span>Log out from account</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
