import { LayoutDashboard, CalendarPlus, Users, MapPin, Siren, FileText, User, LogOut, Activity, X, Monitor } from 'lucide-react'

export function PatientSidebar({
  activeTab,
  onSelectTab,
  onLogout,
  patientName = 'Patient',
  isOpen = false,
  onClose,
}) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'nearby', label: 'Nearby Hospitals', icon: MapPin },
    { id: 'book', label: 'Book OPD', icon: CalendarPlus },
    { id: 'queue', label: 'Live Queue', icon: Users },
    { id: 'display', label: 'Live TV Board', icon: Monitor, isLiveBoard: true },
    { id: 'emergency', label: 'Emergency', icon: Siren },
    { id: 'records', label: 'Health Records', icon: FileText },
    { id: 'profile', label: 'Profile', icon: User },
  ]

  const handleItemClick = (id) => {
    if (id === 'display') {
      window.open('/display', '_blank')
    } else {
      onSelectTab(id)
    }
    onClose?.()
  }

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`patient-sidebar ${isOpen ? 'mobile-drawer-open' : ''}`} aria-label="Patient navigation">
        <div className="patient-sidebar-brand">
          <div className="brand-logo-container">
            <span className="brand-icon-box">
              <Activity size={20} strokeWidth={2.5} />
            </span>
            <span className="brand-title">Queue<span>Free</span></span>
          </div>

          {onClose && (
            <button
              type="button"
              className="sidebar-mobile-close-btn"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="patient-sidebar-nav">
          {navItems.map(({ id, label, icon: Icon, isLiveBoard }) => (
            <button
              key={id}
              type="button"
              className={`patient-nav-item ${activeTab === id ? 'is-active' : ''} ${isLiveBoard ? 'live-board-nav-item' : ''}`}
              onClick={() => handleItemClick(id)}
            >
              <Icon size={18} className="nav-icon" />
              <span>{label}</span>
              {isLiveBoard && (
                <span className="ml-auto text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full border border-emerald-300">
                  LIVE
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="patient-sidebar-footer">
          <button
            type="button"
            className="patient-nav-item logout-item"
            onClick={() => {
              onClose?.()
              onLogout()
            }}
          >
            <LogOut size={18} className="nav-icon" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}
