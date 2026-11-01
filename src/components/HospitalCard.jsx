import React, { useState } from 'react'
import { ArrowRight, Hospital, MapPin, ExternalLink, ShieldAlert, CheckCircle2, AlertCircle, X, Shield, Globe } from 'lucide-react'

export function HospitalCard({ hospital, onBook, onViewLocation, onFocus, active = false }) {
  const [expanded, setExpanded] = useState(false)
  const [showRedirectModal, setShowRedirectModal] = useState(false)
  const [showUnavailableModal, setShowUnavailableModal] = useState(false)

  // Explicit Category Classification
  // Category A: Single platform demonstration hospital (District Hospital Rishikesh)
  const isDemo = Boolean(hospital.is_demo || hospital.slug === 'district-hospital-rishikesh' || hospital.id === 10)

  // Category B: Externally linked hospital with a verified URL
  const verifiedUrl = hospital.official_booking_url || hospital.redirect_url || hospital.website || ''
  const isExternal = !isDemo && Boolean(verifiedUrl && verifiedUrl.startsWith('http'))

  // Category C: Hospital not yet configured or without verified appointment URL
  const isUnavailable = !isDemo && !isExternal

  const handleActionClick = (e) => {
    e?.stopPropagation()
    if (isDemo) {
      onBook(hospital)
    } else if (isExternal) {
      setShowRedirectModal(true)
    } else {
      setShowUnavailableModal(true)
    }
  }

  const handleProceedToExternal = () => {
    if (verifiedUrl) {
      window.open(verifiedUrl, '_blank', 'noopener,noreferrer')
      setShowRedirectModal(false)
    }
  }

  return (
    <>
      <article
        onClick={() => onFocus?.(hospital)}
        className={active ? 'hospital-card is-active' : 'hospital-card'}
        id={'hospital-' + (hospital.id || hospital.slug || hospital.name)}
      >
        <div className="hospital-icon">
          <Hospital size={21} />
        </div>

        <div className="hospital-info">
          <div className="hospital-title-row">
            <h3>{hospital.name}</h3>
            {hospital.rating && <span className="rating">★ {hospital.rating}</span>}
          </div>

          <p className="muted">
            <MapPin size={14} /> {hospital.area || hospital.city || 'Regional Center'}, {hospital.city || ''}
            {hospital.distance && <><span className="dot-sep">·</span> {hospital.distance}</>}
          </p>

          <div className="hospital-tags">
            {/* Category Indicator Badges */}
            {isDemo && (
              <span className="tag" style={{ background: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', borderColor: 'rgba(20, 184, 166, 0.3)' }}>
                Demo Hospital (Native OPD)
              </span>
            )}
            {isExternal && hospital.integration_mode === 'api' && (
              <span className="tag" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                Verified API Integrated
              </span>
            )}
            {isExternal && hospital.integration_mode !== 'api' && (
              <span className="tag" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                External Booking Portal
              </span>
            )}
            {isUnavailable && (
              <span className="tag" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                Not Listed on DEMO
              </span>
            )}

            <span className="tag">{hospital.specialty || 'General Hospital'}</span>
            {hospital.wait && isDemo && <span className="wait-pill">{hospital.wait}</span>}
          </div>

          {expanded && (
            <div className="hospital-details">
              <p><strong>Address:</strong> {hospital.address || hospital.area || hospital.city}</p>
              {hospital.phone && <p><strong>Phone:</strong> {hospital.phone}</p>}
              {hospital.website && <p><strong>Website:</strong> <a href={hospital.website} target="_blank" rel="noopener noreferrer" className="text-teal-400 underline">{hospital.website}</a></p>}
              {verifiedUrl && <p><strong>Official Booking:</strong> <span className="text-blue-400 font-mono text-xs">{verifiedUrl}</span></p>}
              <p><strong>Integration Mode:</strong> {isDemo ? 'Category A: Platform Demonstration Hospital' : isExternal ? 'Category B: Externally Verified Hospital Portal' : 'Category C: Unlisted Community Provider'}</p>
            </div>
          )}
        </div>

        <div className="hospital-actions">
          {onViewLocation && (
            <button
              type="button"
              className="direction-link"
              onClick={(e) => { e.stopPropagation(); onViewLocation(hospital); }}
            >
              View location
            </button>
          )}

          <button
            type="button"
            className="direction-link"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? 'Hide details' : 'View details'}
          </button>

          {isDemo && (
            <button
              type="button"
              className="small-book"
              onClick={handleActionClick}
              title="Book token on internal demonstration system"
            >
              Book OPD Token <ArrowRight size={14} />
            </button>
          )}

          {isExternal && (
            <button
              type="button"
              className="small-book"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
              onClick={handleActionClick}
              title="Redirect to verified official booking portal"
            >
              Book on Hospital Portal <ExternalLink size={14} />
            </button>
          )}

          {isUnavailable && (
            <button
              type="button"
              className="small-book"
              style={{ background: '#475569', color: '#cbd5e1', cursor: 'pointer' }}
              onClick={handleActionClick}
              title="View listing availability"
            >
              Check Availability <AlertCircle size={14} />
            </button>
          )}
        </div>
      </article>

      {/* =================================================================== */}
      {/* CATEGORY B: EXTERNAL REDIRECTION CONFIRMATION MODAL                 */}
      {/* =================================================================== */}
      {showRedirectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowRedirectModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <ExternalLink size={24} />
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-blue-400 tracking-wider">
                  External Hospital Redirection
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Continue to {hospital.name}?
                </h3>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-3 leading-relaxed">
              You are navigating to the official online appointment system of <strong>{hospital.name}</strong>.
            </p>

            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl mb-4">
              <small className="block text-xs text-slate-400 mb-1">Destination Address:</small>
              <div className="flex items-center gap-2 text-xs font-mono text-blue-300 break-all">
                <Globe size={14} className="shrink-0 text-blue-400" />
                <span>{verifiedUrl}</span>
              </div>
            </div>

            <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl mb-5 text-xs text-blue-200/90 flex items-start gap-2">
              <Shield size={16} className="text-blue-400 shrink-0 mt-0.5" />
              <span>
                This is a verified external destination. DEMO facilitates direct access to authentic hospital booking portals while maintaining zero unauthorized fee markups.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRedirectModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToExternal}
                className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 flex items-center gap-2 transition"
              >
                <span>Continue to Hospital Website</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CATEGORY C: HOSPITAL NOT YET AVAILABLE NOTICE MODAL                 */}
      {/* =================================================================== */}
      {showUnavailableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowUnavailableModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertCircle size={24} />
              </div>
              <div>
                <span className="text-xs uppercase font-semibold text-amber-400 tracking-wider">
                  Network Status
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Hospital Not Yet Available
                </h3>
              </div>
            </div>

            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl mb-4">
              <p className="text-sm text-slate-300 leading-relaxed font-normal">
                This hospital is not currently listed with a verified online appointment service on DEMO. We are working to expand our hospital network. Please check back in the future.
              </p>
            </div>

            <div className="p-3 bg-amber-950/30 border border-amber-800/30 rounded-xl mb-5 text-xs text-amber-200/90">
              <p>
                <strong>Hospital:</strong> {hospital.name} ({hospital.city || 'Regional Area'})
              </p>
              <p className="mt-1 text-slate-400">
                For in-person consultations, please visit the hospital registration desk directly or contact their front desk.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowUnavailableModal(false)}
                className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
