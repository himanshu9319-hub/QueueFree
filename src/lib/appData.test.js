// Runtime validation coverage for hospital data and queue helpers.
import { describe, expect, it } from 'vitest'
import { createDoctorDirectory, distanceKm, doctorsByDept, hospitalKey, initialHospitals, navItems, opdKey, deriveNameFromEmail } from './appData.js'
import { generateQrMatrix } from './qrCode.js'

describe('hospital and queue helpers', () => {
  it('provides location data and stable keys for sample hospitals', () => {
    expect(initialHospitals.length).toBeGreaterThan(0)
    expect(initialHospitals[0].latitude).toBe(initialHospitals[0].lat)
    expect(hospitalKey(initialHospitals[0])).toBe(`${initialHospitals[0].city}::${initialHospitals[0].name}`)
    expect(opdKey(initialHospitals[0], 'Cardiology')).toBe(`${initialHospitals[0].city}::${initialHospitals[0].name}::Cardiology`)
  })

  it('provides navigation icons and department doctors', () => {
    expect(navItems).toHaveLength(5)
    expect(navItems.every(item => item.icon)).toBe(true)
    expect(doctorsByDept.Cardiology).toContain('Dr. Neha Shah')
  })

  it('generates selectable demo profiles with bounded metrics for every doctor', () => {
    const directory = createDoctorDirectory(() => 0.5)
    expect(directory).toHaveLength(Object.values(doctorsByDept).flat().length)
    expect(directory.find(doctor => doctor.name === 'Dr. Neha Shah')).toMatchObject({
      department: 'Cardiology',
      experienceYears: 15,
      rating: 4.6,
      patientsToday: 17,
      availableSlots: 4,
      averageMinutes: 18,
    })
    expect(directory.every(doctor => doctor.id === `${doctor.department}::${doctor.name}`)).toBe(true)
  })

  it('calculates zero distance for identical coordinates', () => {
    expect(distanceKm({ lat: 12.9, lon: 77.6 }, { lat: 12.9, lon: 77.6 })).toBe(0)
  })

  it('generates valid QR code matrix for UPI payment payload with hospital details', () => {
    const upiPayload = 'upi://pay?pa=aiims.opd@razorpay&pn=AIIMS%20Rishikesh&am=250&cu=INR&tn=Token_A025'
    const matrix = generateQrMatrix(upiPayload)
    expect(Array.isArray(matrix)).toBe(true)
    expect(matrix.length).toBeGreaterThanOrEqual(21)
    expect(matrix[0].length).toBe(matrix.length)
    // Finder pattern checks
    expect(matrix[0][0]).toBe(true)
    expect(matrix[0][1]).toBe(true)
    expect(matrix[0][6]).toBe(true)
  })

  it('dynamically derives clean user name from email instead of hardcoding', () => {
    expect(deriveNameFromEmail('priya.verma@gmail.com')).toBe('Priya Verma')
    expect(deriveNameFromEmail('rohit_kumar@yahoo.co.in')).toBe('Rohit Kumar')
    expect(deriveNameFromEmail('ananya@example.com')).toBe('Ananya')
    expect(deriveNameFromEmail('rajesh123@hospital.org')).toBe('Rajesh')
    expect(deriveNameFromEmail('', 'Fallback User')).toBe('Fallback User')
  })

  it('exports official ABDM and ABHA auth helper functions in queueApi', async () => {
    const api = await import('./queueApi.js')
    expect(typeof api.initiateAbhaAuth).toBe('function')
    expect(typeof api.confirmAbhaAuth).toBe('function')
    expect(typeof api.cancelAbhaAuth).toBe('function')
    expect(typeof api.registerPatient).toBe('function')
    expect(typeof api.getPatientProfile).toBe('function')
  })
})
