const defaultBase = typeof window !== 'undefined' ? '/api/v1' : 'http://127.0.0.1:8000/api/v1'
const API_BASE = (import.meta.env.VITE_API_URL || defaultBase).replace(/\/$/, '')
let accessToken = ''

export function setApiAccessToken(token) {
  accessToken = token || ''
}

export function getApiAccessToken() {
  return accessToken
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  headers.set('Accept', 'application/json')
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  const isPublicCatalog = /^\/(hospitals|doctors|availability|public\/display)/.test(path)
  if (accessToken && !isPublicCatalog) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  })
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) {
      accessToken = ''
    }
    const error = body?.error
    const detail = error?.details
    const message = typeof detail?.message === 'string'
      ? detail.message
      : typeof error?.message === 'string' && error.message !== 'The request could not be completed.'
        ? error.message
        : typeof detail === 'string' ? detail : `QueueFree API request failed (${response.status}).`
    const requestError = new Error(message)
    requestError.status = response.status
    requestError.details = detail
    throw requestError
  }
  return body
}

export async function getResults(path) {
  const response = await apiRequest(path)
  return Array.isArray(response) ? response : response.results || []
}

export async function getPublicHospitals(params = {}) {
  const query = new URLSearchParams()
  if (params.city) query.set('city', params.city)
  if (params.search) query.set('search', params.search)
  if (params.mode) query.set('mode', params.mode)
  const qs = query.toString() ? `?${query.toString()}` : ''
  return getResults(`/hospitals/${qs}`)
}

// -----------------------------------------------------------------------------
// Official ABDM / ABHA v3 & Patient Portal
// -----------------------------------------------------------------------------

export async function initiateAbhaAuth(identifier, authMode = 'MOBILE_OTP', phone = '') {
  return apiRequest('/auth/patient/abha/init/', {
    method: 'POST',
    body: { identifier, auth_mode: authMode, phone },
  })
}

export async function confirmAbhaAuth(txnId, otp) {
  return apiRequest('/auth/patient/abha/confirm/', {
    method: 'POST',
    body: { txn_id: txnId, otp },
  })
}

export async function cancelAbhaAuth(txnId) {
  return apiRequest('/auth/patient/abha/cancel/', {
    method: 'POST',
    body: { txn_id: txnId },
  })
}

export async function registerPatient(patientData) {
  return apiRequest('/auth/patient/register/', {
    method: 'POST',
    body: patientData,
  })
}

export async function getPatientProfile() {
  return apiRequest('/patient/profile/')
}

export async function updatePatientProfile(data) {
  return apiRequest('/patient/profile/', {
    method: 'PATCH',
    body: data,
  })
}

// -----------------------------------------------------------------------------
// Patient Auth
// -----------------------------------------------------------------------------

export async function sendOtp(phone) {
  return apiRequest('/auth/patient/send-otp/', { method: 'POST', body: { phone } })
}

export async function verifyOtp(phone, otp, name = '', email = '') {
  return apiRequest('/auth/patient/verify-otp/', { method: 'POST', body: { phone, otp, name, email } })
}

export async function patientDemoLogin(identifier, phone, whatsappConsent) {
  return apiRequest('/auth/patient/demo/', {
    method: 'POST',
    body: {
      abha_demo_identifier: identifier,
      phone,
      whatsapp_notifications_consent: whatsappConsent,
    },
  })
}

export async function patientPhoneLogin(phone, name = 'Patient User', email = 'patient@example.com') {
  return apiRequest('/auth/patient/phone/', {
    method: 'POST',
    body: { phone, name, email },
  })
}

export async function patientVerifyAbha(abha_identifier, whatsappConsent = true) {
  return apiRequest('/auth/patient/verify-abha/', {
    method: 'POST',
    body: {
      abha_identifier,
      whatsapp_notifications_consent: whatsappConsent,
    },
  })
}

// -----------------------------------------------------------------------------
// Staff Auth & Live Queue Actions
// -----------------------------------------------------------------------------

export async function staffLogin(username, password, expectedRole = '') {
  const body = { username, password }
  if (expectedRole) body.expected_role = expectedRole
  return apiRequest('/auth/staff/login/', { method: 'POST', body })
}

export async function getStaffMe() {
  return apiRequest('/auth/staff/me/')
}

export async function performQueueAction(bookingId, action) {
  return apiRequest(`/staff/bookings/${bookingId}/action/`, { method: 'POST', body: { action } })
}

export async function createWalkInBooking(payload) {
  return apiRequest('/staff/queue/walk-in/', { method: 'POST', body: payload })
}

export async function triggerAutoNoShow(graceMinutes = 30) {
  return apiRequest('/staff/queue/auto-no-show/', { method: 'POST', body: { grace_minutes: graceMinutes } })
}

export async function getDoctorProfile() {
  return apiRequest('/staff/doctor/profile/')
}

export async function updateDoctorStatus(payload) {
  return apiRequest('/staff/doctor/profile/', { method: 'PATCH', body: payload })
}

// -----------------------------------------------------------------------------
// Bookings & Catalog
// -----------------------------------------------------------------------------

export async function createBooking(payload) {
  return apiRequest('/bookings/', { method: 'POST', body: payload })
}

export async function cancelBookingApi(bookingId, reason = 'patient_request') {
  return apiRequest(`/bookings/${bookingId}/cancel/`, { method: 'POST', body: { reason } })
}

export async function rescheduleBookingApi(bookingId, date, slotId) {
  return apiRequest(`/bookings/${bookingId}/reschedule/`, { method: 'POST', body: { date, slot_id: slotId } })
}

// -----------------------------------------------------------------------------
// Hospital Admin & Super Admin APIs
// -----------------------------------------------------------------------------

export async function getHospitalAdminDetails() {
  return apiRequest('/hospital-admin/hospital/')
}

export async function updateHospitalAdminDetails(data) {
  return apiRequest('/hospital-admin/hospital/', { method: 'PATCH', body: data })
}

export async function getHospitalAdminDepartments() {
  return apiRequest('/hospital-admin/departments/')
}

export async function createHospitalAdminDepartment(data) {
  return apiRequest('/hospital-admin/departments/', { method: 'POST', body: data })
}

export async function getHospitalAdminDoctors() {
  return apiRequest('/hospital-admin/doctors/')
}

export async function createHospitalAdminDoctor(data) {
  return apiRequest('/hospital-admin/doctors/', { method: 'POST', body: data })
}

export async function generateDoctorSlots(data) {
  return apiRequest('/hospital-admin/slots/generate/', { method: 'POST', body: data })
}

export async function getHospitalAdminStaff() {
  return apiRequest('/hospital-admin/staff/')
}

export async function getSuperAdminAnalytics() {
  return apiRequest('/super-admin/analytics/')
}

export async function getSuperAdminHospitals() {
  return apiRequest('/super-admin/hospitals/')
}

export async function onboardHospital(data) {
  return apiRequest('/super-admin/hospitals/', { method: 'POST', body: data })
}

export function localIsoDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// -----------------------------------------------------------------------------
// Real-Time SSE Streams & Notifications (Phase 4)
// -----------------------------------------------------------------------------

export function createSseQueueSubscriber({
  path,
  onUpdate,
  onNotification,
  onError,
  fallbackPollMs = 3500,
  fetchFallback,
}) {
  let eventSource = null
  let pollInterval = null
  let isClosed = false
  let mode = 'connecting'

  const token = getApiAccessToken()
  const sep = path.includes('?') ? '&' : '?'
  const sseUrl = `${API_BASE}${path}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`

  const startPolling = () => {
    if (pollInterval || isClosed) return
    mode = 'polling'
    if (fetchFallback) {
      fetchFallback().catch(err => {
        if (onError) onError(err)
      })
      pollInterval = setInterval(() => {
        if (!isClosed && fetchFallback) {
          fetchFallback().catch(err => {
            if (onError) onError(err)
          })
        }
      }, fallbackPollMs)
    }
  }

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  try {
    if (typeof window !== 'undefined' && window.EventSource) {
      eventSource = new EventSource(sseUrl)
      mode = 'sse'

      eventSource.addEventListener('queue_update', (e) => {
        try {
          const data = JSON.parse(e.data)
          if (onUpdate) onUpdate(data)
        } catch (err) {
          console.error('SSE parse error:', err)
        }
      })

      eventSource.addEventListener('notification', (e) => {
        try {
          const data = JSON.parse(e.data)
          if (onNotification) onNotification(data)
        } catch (err) {
          console.error('SSE notification parse error:', err)
        }
      })

      eventSource.onopen = () => {
        mode = 'sse'
        stopPolling()
      }

      eventSource.onerror = () => {
        if (!isClosed) {
          startPolling()
        }
      }
    } else {
      startPolling()
    }
  } catch {
    startPolling()
  }

  return {
    getMode: () => mode,
    close: () => {
      isClosed = true
      stopPolling()
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
    },
  }
}

export async function broadcastDoctorDelay(delayMinutes, reason = '') {
  return apiRequest('/staff/doctor/delay/', {
    method: 'POST',
    body: { delay_minutes: delayMinutes, reason },
  })
}

export async function getPatientNotifications(phone) {
  const query = phone ? `?phone=${encodeURIComponent(phone)}` : ''
  return apiRequest(`/patient/notifications/${query}`)
}

export async function getHospitalAdminNotifications() {
  return apiRequest('/hospital-admin/notifications/')
}

export async function getSuperAdminNotifications(hospitalId = null) {
  const query = hospitalId ? `?hospital_id=${encodeURIComponent(hospitalId)}` : ''
  return apiRequest(`/super-admin/notifications/${query}`)
}

// -----------------------------------------------------------------------------
// Phase 5: API Integration Mode & Diagnostics
// -----------------------------------------------------------------------------

export async function testHospitalConnection(hospitalId) {
  return apiRequest(`/super-admin/hospitals/${hospitalId}/test-connection/`, {
    method: 'POST',
  })
}

export async function updateHospitalApiConfig(hospitalId, apiConfig) {
  return apiRequest(`/super-admin/hospitals/${hospitalId}/api-config/`, {
    method: 'PATCH',
    body: { api_config: apiConfig },
  })
}


