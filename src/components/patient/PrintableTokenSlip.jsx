import { Printer, X, ShieldCheck, Calendar, Clock, MapPin, Building2, User } from 'lucide-react'
import { SecureQrCode } from '../ui/SecureQrCode'

export function PrintableTokenSlip({ booking, onClose }) {
  if (!booking) return null

  const hospitalName = booking.hospital_name || booking.hospital || 'AIIMS Rishikesh'
  const hospitalCity = booking.hospital_city || booking.city || 'Rishikesh, Uttarakhand'
  const departmentName = booking.department_name || booking.department || 'General Medicine'
  const doctorName = booking.doctor_name || booking.doctor || 'Dr. Ananya Rao'
  const tokenNumber = booking.token_number || booking.id || 'A-025'
  const patientName = booking.patient_name || 'Patient'
  const appointmentDate = booking.appointment_date || new Date().toISOString().split('T')[0]
  const timeSlot = booking.slot_time || '09:00 AM - 09:15 AM'
  const queueSequence = booking.queue_sequence || '12'
  const bookingId = booking.id || 'DEMO-BOOKING-001'
  const secureTrackUrl = `https://queuefree.health/track?booking=${encodeURIComponent(bookingId)}`

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="printable-slip-overlay" role="dialog" aria-modal="true">
      <div className="printable-slip-modal">
        {/* Modal Controls (Hidden in print) */}
        <div className="slip-modal-toolbar no-print">
          <span className="slip-preview-tag">Official Hospital OPD Slip</span>
          <div className="toolbar-actions">
            <button
              type="button"
              className="btn-print-slip"
              onClick={handlePrint}
            >
              <Printer size={16} />
              <span>Print Token Slip</span>
            </button>
            <button
              type="button"
              className="btn-close-slip"
              onClick={onClose}
              title="Close print preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* The Printable Paper Slip */}
        <div className="slip-paper-body" id="opd-token-slip">
          <header className="slip-hospital-header">
            <div className="slip-gov-seal">
              <ShieldCheck size={28} className="seal-icon" />
              <div>
                <h2>{hospitalName}</h2>
                <p>{hospitalCity} · National Health Portal Integrated</p>
              </div>
            </div>
            <div className="slip-type-badge">
              <span>OPD TOKEN SLIP</span>
            </div>
          </header>

          <div className="slip-divider-dashed" />

          {/* Token Highlight Section */}
          <div className="slip-token-banner">
            <div className="token-number-box">
              <span className="slip-lbl">TOKEN NUMBER</span>
              <h1 className="slip-token-value">{tokenNumber}</h1>
              <span className="slip-seq-tag">Queue Seq: #{queueSequence}</span>
            </div>

            <div className="slip-qr-box">
              <SecureQrCode value={secureTrackUrl} size={110} />
            </div>
          </div>

          <div className="slip-divider-dashed" />

          {/* Consultation Details Grid */}
          <div className="slip-details-grid">
            <div className="slip-detail-cell">
              <span className="cell-label">PATIENT NAME</span>
              <strong className="cell-val">{patientName}</strong>
            </div>

            <div className="slip-detail-cell">
              <span className="cell-label">DEPARTMENT</span>
              <strong className="cell-val">{departmentName}</strong>
            </div>

            <div className="slip-detail-cell">
              <span className="cell-label">ATTENDING DOCTOR</span>
              <strong className="cell-val">{doctorName}</strong>
            </div>

            <div className="slip-detail-cell">
              <span className="cell-label">APPOINTMENT DATE</span>
              <strong className="cell-val">{appointmentDate}</strong>
            </div>

            <div className="slip-detail-cell">
              <span className="cell-label">REPORTING SLOT</span>
              <strong className="cell-val">{timeSlot}</strong>
            </div>

            <div className="slip-detail-cell">
              <span className="cell-label">STATUS</span>
              <strong className="cell-val text-green font-bold">CONFIRMED (IN QUEUE)</strong>
            </div>
          </div>

          <footer className="slip-instructions-footer">
            <h4>Instructions for Patient:</h4>
            <ul>
              <li>Please reach the OPD waiting lobby 15 minutes before your scheduled slot.</li>
              <li>Scan the QR code above at the reception kiosk to mark your physical arrival.</li>
              <li>Keep this printed slip or mobile confirmation handy until consultation is completed.</li>
              <li>Live queue turn notifications are broadcast via SMS and live screen board.</li>
            </ul>
            <div className="slip-barcode-row">
              <small>Ref: {String(bookingId).slice(0, 18)} · Secure Non-Sensitive Appointment Reference</small>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
