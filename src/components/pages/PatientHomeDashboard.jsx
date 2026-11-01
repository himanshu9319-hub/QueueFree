import { useState, useMemo } from 'react'
import {
  Calendar, Users, Clock, Building2, ArrowRight, MapPin, Siren, Heart,
  CheckCircle2, Sparkles, ShieldCheck, AlertCircle, Printer, XCircle,
  FileText, Bell, ChevronRight, User, Stethoscope, RefreshCw, BadgeCheck,
  Monitor
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { CardSpotlight, GsapCounter } from '../ui/AceternityCards'
import { PrintableTokenSlip } from '../patient/PrintableTokenSlip'
import { apiRequest } from '../../lib/queueApi'

export function PatientHomeDashboard({
  onNavigate,
  bookings = [],
  hospitalsCount = 12,
  activeToken = null,
  patientSession = null,
  patientAbhaVerified = false,
  patientAbhaId = '',
  refreshBookings,
  onLogout,
}) {
  const [selectedBookingForSlip, setSelectedBookingForSlip] = useState(null)
  const [cancelModalBooking, setCancelModalBooking] = useState(null)
  const [cancelReason, setCancelReason] = useState('patient_request')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [toastMessage, setToastMessage] = useState('')

  // Identify active token: current waiting, confirmed, or serving appointment
  const activeBooking = useMemo(() => {
    return bookings.find(b => ['waiting', 'serving', 'arrived', 'calling', 'confirmed', 'booked'].includes(b.status)) || activeToken
  }, [bookings, activeToken])

  // Split into upcoming and past history
  const { upcomingBookings, historyBookings } = useMemo(() => {
    const upcoming = bookings.filter(b => ['waiting', 'serving', 'arrived', 'calling', 'confirmed', 'booked'].includes(b.status))
    const history = bookings.filter(b => ['completed', 'cancelled', 'no_show', 'missed', 'skipped'].includes(b.status))
    return { upcomingBookings: upcoming, historyBookings: history }
  }, [bookings])

  const tokenDisplay = activeBooking ? (activeBooking.token_number || `Token #${activeBooking.id}`) : 'None'
  const waitDisplay = activeBooking ? `~ ${activeBooking.estimated_wait_minutes ?? 15} min` : 'None'
  const bookingsCount = bookings.length

  // Handle Cancel Appointment
  const handleConfirmCancel = async () => {
    if (!cancelModalBooking?.id) return
    setCancelling(true)
    setCancelError('')
    try {
      await apiRequest(`/bookings/${cancelModalBooking.id}/cancel/`, {
        method: 'POST',
        body: { reason: cancelReason },
      })
      setToastMessage('Appointment cancelled successfully.')
      setCancelModalBooking(null)
      refreshBookings?.()
    } catch (err) {
      setCancelError(err.message || 'Could not cancel booking. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  const patientName = patientSession?.name || 'Patient User'
  const patientPhone = patientSession?.phone || '+91 98765 43210'

  return (
    <motion.div
      className="dashboard-view-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* =================================================================== */}
      {/* PATIENT PROFILE & ABHA VERIFICATION BANNER                          */}
      {/* =================================================================== */}
      <section className="patient-identity-banner">
        <div className="identity-left-col">
          <div className="patient-avatar-box">
            <span>{patientName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="patient-meta-text">
            <h2>{patientName}</h2>
            <p className="patient-contact-line">
              <span>{patientPhone}</span>
              {patientSession?.email && <span>· {patientSession.email}</span>}
            </p>
          </div>
        </div>

        <div className="identity-right-col">
          {patientAbhaVerified ? (
            <div className="abha-status-badge verified">
              <ShieldCheck size={18} className="badge-icon" />
              <div>
                <span className="badge-title">ABHA VERIFIED PATIENT</span>
                <strong className="badge-id">{patientAbhaId || 'Official ABHA Verified'}</strong>
              </div>
            </div>
          ) : (
            <div className="abha-status-badge unverified">
              <AlertCircle size={18} className="badge-icon" />
              <div>
                <span className="badge-title">STANDARD ACCOUNT (UNVERIFIED)</span>
                <button
                  type="button"
                  className="btn-link-abha-inline"
                  onClick={() => onNavigate?.('profile')}
                >
                  Link ABHA ID
                </button>
              </div>
            </div>
          )}

          <div className="identity-actions-group">
            <button
              type="button"
              className="btn-dash-action"
              onClick={() => onNavigate?.('profile')}
              title="View full patient profile"
            >
              <User size={15} />
              <span>Profile</span>
            </button>
            <button
              type="button"
              className="btn-dash-action"
              onClick={() => onNavigate?.('records')}
              title="View notifications"
            >
              <Bell size={15} />
              <span>Notifications</span>
            </button>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 1-CLICK VIEW LIVE TV BOARD BANNER (POST-SIGNUP & LOGIN VISIBILITY)  */}
      {/* =================================================================== */}
      <section className="live-board-promo-banner">
        <div className="live-board-promo-content">
          <div className="live-board-icon-chip">
            <Monitor size={22} className="text-blue-600" />
            <span className="live-indicator-dot" />
          </div>
          <div className="live-board-promo-text">
            <div className="live-board-title-line">
              <h4>Hospital Waiting Hall Live Display Board</h4>
              <span className="live-tv-tag">Zero PII TV Broadcast</span>
            </div>
            <p>
              Check live consultation room calls, current serving tokens, and wait sequence on the official lobby display board.
            </p>
          </div>
        </div>

        <div className="live-board-promo-cta">
          <a
            href="/display"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-view-live-display"
            title="Open Hospital Waiting Hall Live Display Board in new window"
          >
            <Monitor size={15} />
            <span>View Live Board</span>
            <ArrowRight size={14} />
          </a>
        </div>
      </section>

      {/* Top 4 Quick Stat Cards */}
      <section className="stats-cards-grid" aria-label="Quick statistics">
        <CardSpotlight
          className="stat-card"
          spotlightColor="rgba(37, 99, 235, 0.12)"
          onClick={() => onNavigate('records')}
        >
          <div className="stat-card-left">
            <span className="stat-label">My Bookings</span>
            <strong className="stat-value">
              <GsapCounter value={bookingsCount} duration={0.8} />
            </strong>
          </div>
          <div className="stat-icon-wrapper blue-bg">
            <Calendar size={22} className="stat-icon blue-text" />
          </div>
        </CardSpotlight>

        <CardSpotlight
          className="stat-card"
          spotlightColor="rgba(6, 182, 212, 0.12)"
          onClick={() => onNavigate('queue')}
        >
          <div className="stat-card-left">
            <span className="stat-label">Active Token</span>
            <strong className="stat-value">{tokenDisplay}</strong>
          </div>
          <div className="stat-icon-wrapper cyan-bg">
            <Users size={22} className="stat-icon cyan-text" />
          </div>
        </CardSpotlight>

        <CardSpotlight
          className="stat-card"
          spotlightColor="rgba(245, 158, 11, 0.12)"
          onClick={() => onNavigate('queue')}
        >
          <div className="stat-card-left">
            <span className="stat-label">Est. Wait</span>
            <strong className="stat-value">{waitDisplay}</strong>
          </div>
          <div className="stat-icon-wrapper orange-bg">
            <Clock size={22} className="stat-icon orange-text" />
          </div>
        </CardSpotlight>

        <CardSpotlight
          className="stat-card"
          spotlightColor="rgba(99, 102, 241, 0.12)"
          onClick={() => onNavigate('nearby')}
        >
          <div className="stat-card-left">
            <span className="stat-label">Hospitals</span>
            <strong className="stat-value">
              <GsapCounter value={hospitalsCount} duration={1} />
            </strong>
          </div>
          <div className="stat-icon-wrapper indigo-bg">
            <Building2 size={22} className="stat-icon indigo-text" />
          </div>
        </CardSpotlight>
      </section>

      {/* =================================================================== */}
      {/* ACTIVE TOKEN SPOTLIGHT CARD                                         */}
      {/* =================================================================== */}
      {activeBooking ? (
        <section className="active-token-spotlight-card">
          <div className="spotlight-header">
            <div className="spotlight-title">
              <span className="live-dot-pulse" />
              <h3>Current Active OPD Token</h3>
            </div>
            <span className="token-status-chip">
              Status: <strong>{(activeBooking.status || 'WAITING').toUpperCase()}</strong>
            </span>
          </div>

          <div className="spotlight-body-grid">
            <div className="token-number-hero">
              <span className="hero-token-lbl">TOKEN NO</span>
              <h1 className="hero-token-val">
                {activeBooking.token_number || activeBooking.id || 'A-025'}
              </h1>
              <span className="hero-queue-pos">
                ~ {activeBooking.queue_position || activeBooking.queue_sequence || 12} in queue line
              </span>
            </div>

            <div className="token-details-column">
              <div className="detail-row">
                <Building2 size={16} className="text-blue" />
                <div>
                  <small>HOSPITAL</small>
                  <strong>{activeBooking.hospital_name || 'Hospital Facility'}</strong>
                </div>
              </div>

              <div className="detail-row">
                <Building2 size={16} className="text-sky-600" />
                <div>
                  <small style={{ color: '#0369a1', fontWeight: 800 }}>OPD DEPARTMENT</small>
                  <strong className="badge-highlight-dept" style={{ display: 'inline-flex', marginTop: '2px' }}>
                    🏥 {activeBooking.department_name || 'OPD Department'}
                  </strong>
                </div>
              </div>

              <div className="detail-row">
                <Stethoscope size={16} className="text-indigo-600" />
                <div>
                  <small style={{ color: '#6b21a8', fontWeight: 800 }}>CONSULTING DOCTOR</small>
                  <strong className="badge-highlight-doctor" style={{ display: 'inline-flex', marginTop: '2px' }}>
                    👨‍⚕️ {activeBooking.doctor_name || 'Assigned Doctor'}
                  </strong>
                </div>
              </div>

              <div className="detail-row">
                <Clock size={16} className="text-orange" />
                <div>
                  <small>APPOINTMENT SCHEDULE</small>
                  <strong>
                    {activeBooking.appointment_date || new Date().toISOString().split('T')[0]} at{' '}
                    {activeBooking.slot_time || 'Scheduled Slot'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="token-actions-column">
              <button
                type="button"
                className="btn-track-queue-primary"
                onClick={() => onNavigate('queue')}
              >
                <span>Track Live Queue</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="btn-print-token-secondary"
                onClick={() => setSelectedBookingForSlip(activeBooking)}
              >
                <Printer size={15} />
                <span>Print Token Slip</span>
              </button>

              <button
                type="button"
                className="btn-cancel-token-danger"
                onClick={() => setCancelModalBooking(activeBooking)}
              >
                <XCircle size={15} />
                <span>Cancel Token</span>
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* Empty State: No active OPD token found */
        <section className="promo-banner-card">
          <div className="promo-banner-content">
            <span className="inline-block text-xs font-semibold text-teal-400 uppercase tracking-wider mb-1">
              Live Queue Status
            </span>
            <h2>No active OPD token found</h2>
            <p>You have no active doctor consultation token or waiting queue position for today. Book an appointment from home to skip registration desk queues.</p>
            <motion.button
              type="button"
              className="btn-book-now"
              onClick={() => onNavigate('book')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <span>Book New Appointment</span>
              <ArrowRight size={16} />
            </motion.button>
          </div>

          <div className="promo-banner-illustration">
            <div className="doctor-badge-quote">
              <Heart size={16} className="heart-icon-badge" />
              <span>"Healthy India Happy India"</span>
            </div>
            <div className="doctor-avatar-art">
              <span className="doctor-emoji-art" role="img" aria-label="Doctor">👩‍⚕️</span>
            </div>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* UPCOMING APPOINTMENTS SECTION                                       */}
      {/* =================================================================== */}
      <section className="dashboard-section-block">
        <div className="section-header-row">
          <div>
            <h3 className="section-main-title">Upcoming Appointments</h3>
            <p className="section-sub">Scheduled doctor visits and active queue tokens</p>
          </div>
          <button
            type="button"
            className="btn-dash-link"
            onClick={() => onNavigate('book')}
          >
            <span>+ Book New Appointment</span>
          </button>
        </div>

        {upcomingBookings.length > 0 ? (
          <div className="appointments-table-card">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Hospital & Department</th>
                  <th>Doctor</th>
                  <th>Date & Slot</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {upcomingBookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className="table-token-badge">{b.token_number || b.id}</span>
                    </td>
                    <td>
                      <strong style={{ display: 'block', color: '#0f172a', marginBottom: '3px' }}>{b.hospital_name || b.hospital}</strong>
                      <span className="table-dept-pill">🏥 {b.department_name || b.department}</span>
                    </td>
                    <td>
                      <span className="table-doctor-pill">👨‍⚕️ {b.doctor_name || b.doctor}</span>
                    </td>
                    <td>
                      <div>{b.appointment_date}</div>
                      <small className="text-muted">{b.slot_time || '09:00 AM'}</small>
                    </td>
                    <td>
                      <span className={`status-pill ${b.status || 'waiting'}`}>
                        {b.status || 'waiting'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions-cell">
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => setSelectedBookingForSlip(b)}
                          title="Print OPD confirmation slip"
                        >
                          <Printer size={14} />
                          <span>Slip</span>
                        </button>
                        <button
                          type="button"
                          className="btn-table-action text-red"
                          onClick={() => setCancelModalBooking(b)}
                          title="Cancel appointment"
                        >
                          <XCircle size={14} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-appointments-box">
            <Calendar size={32} className="empty-icon" />
            <p>No upcoming appointments found. Ready to book your consultation?</p>
            <button
              type="button"
              className="btn-primary-blue-sm"
              onClick={() => onNavigate('book')}
            >
              Book OPD Appointment
            </button>
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* QUICK SERVICES SECTION                                              */}
      {/* =================================================================== */}
      <section className="quick-services-section">
        <h3 className="section-title">Healthcare Services</h3>

        <div className="quick-services-grid">
          <CardSpotlight
            className="quick-service-card"
            spotlightColor="rgba(37, 99, 235, 0.1)"
            onClick={() => onNavigate('nearby')}
          >
            <div className="service-icon-box bg-blue">
              <MapPin size={24} className="text-blue" />
            </div>
            <span className="service-title">Nearby Hospitals</span>
            <span className="service-sub">Find verified care near you</span>
          </CardSpotlight>

          <CardSpotlight
            className="quick-service-card"
            spotlightColor="rgba(6, 182, 212, 0.1)"
            onClick={() => onNavigate('book')}
          >
            <div className="service-icon-box bg-cyan">
              <Calendar size={24} className="text-cyan" />
            </div>
            <span className="service-title">OPD Booking</span>
            <span className="service-sub">Instant token reservation</span>
          </CardSpotlight>

          <CardSpotlight
            className="quick-service-card"
            spotlightColor="rgba(99, 102, 241, 0.1)"
            onClick={() => onNavigate('queue')}
          >
            <div className="service-icon-box bg-indigo">
              <Users size={24} className="text-indigo" />
            </div>
            <span className="service-title">Live Queue</span>
            <span className="service-sub">Track wait time & turn</span>
          </CardSpotlight>

          <CardSpotlight
            className="quick-service-card"
            spotlightColor="rgba(239, 68, 68, 0.1)"
            onClick={() => onNavigate('emergency')}
          >
            <div className="service-icon-box bg-red">
              <Siren size={24} className="text-red" />
            </div>
            <span className="service-title">Emergency Finder</span>
            <span className="service-sub">ICU, Oxygen & General beds</span>
          </CardSpotlight>
        </div>
      </section>

      {/* Printable OPD Slip Modal */}
      {selectedBookingForSlip && (
        <PrintableTokenSlip
          booking={selectedBookingForSlip}
          onClose={() => setSelectedBookingForSlip(null)}
        />
      )}

      {/* Cancel Appointment Confirmation Modal */}
      {cancelModalBooking && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="cancel-confirm-modal">
            <div className="modal-header-danger">
              <AlertCircle size={24} />
              <h3>Cancel OPD Appointment</h3>
            </div>

            <p className="modal-body-text">
              Are you sure you want to cancel token <strong>{cancelModalBooking.token_number || cancelModalBooking.id}</strong> at{' '}
              <strong>{cancelModalBooking.hospital_name || cancelModalBooking.hospital}</strong>?
            </p>

            <div className="form-group">
              <label>Reason for Cancellation</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="select-dropdown"
              >
                <option value="patient_request">Patient Request / Change of Plans</option>
                <option value="doctor_unavailable">Doctor Unavailable / Delay</option>
                <option value="duplicate_payment">Duplicate Booking</option>
              </select>
            </div>

            {cancelError && (
              <div className="form-error-banner">
                <AlertCircle size={15} />
                <span>{cancelError}</span>
              </div>
            )}

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-danger-confirm"
                onClick={handleConfirmCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelling…' : 'Yes, Cancel Appointment'}
              </button>
              <button
                type="button"
                className="btn-secondary-cancel"
                onClick={() => setCancelModalBooking(null)}
                disabled={cancelling}
              >
                Keep Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}
    </motion.div>
  )
}
