import React, { useState } from 'react'
import { ArrowLeft, Stethoscope, Lock, User, AlertCircle, ArrowRight, ShieldCheck, RefreshCw, Sparkles, Zap, Building2, CheckCircle2 } from 'lucide-react'
import { staffLogin, setApiAccessToken } from '../../lib/queueApi'
import doctorBg from '../../assets/backgrounds/doctor-bg.png'

const DEMO_DOCTORS = [
  { username: 'demo.doctor', name: 'Dr. Aarav Sharma', dept: 'General Medicine', room: 'OPD 101' },
  { username: 'dr.meera.kapoor', name: 'Dr. Meera Kapoor', dept: 'Cardiology', room: 'OPD 203' },
  { username: 'dr.rohan.verma', name: 'Dr. Rohan Verma', dept: 'Orthopedics', room: 'OPD 115' },
  { username: 'dr.ananya.joshi', name: 'Dr. Ananya Joshi', dept: 'Neurology', room: 'OPD 304' },
  { username: 'dr.kabir.malhotra', name: 'Dr. Kabir Malhotra', dept: 'Dermatology', room: 'OPD 108' },
  { username: 'dr.vikram.singh', name: 'Dr. Vikram Singh', dept: 'Pediatrics', room: 'OPD 205' },
]

export function DoctorLoginPage({ onLoginSuccess, onNavigate }) {
  const demoDoctorPassword = import.meta.env.VITE_DEMO_DOCTOR_PASSWORD || 'DoctorDemo@2026!'
  const [username, setUsername] = useState('demo.doctor')
  const [password, setPassword] = useState(demoDoctorPassword)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLaunchDoctor = async (docUsername) => {
    setLoading(true)
    setError('')
    setUsername(docUsername)
    setPassword(demoDoctorPassword)
    try {
      const res = await staffLogin(docUsername, demoDoctorPassword, 'doctor')
      setApiAccessToken(res.access)
      onLoginSuccess?.(res)
    } catch (err) {
      // Graceful static hosting fallback if backend is unreached or deploying
      const docObj = DEMO_DOCTORS.find(d => d.username === docUsername) || DEMO_DOCTORS[0]
      if (err.message?.includes('fetch') || err.message?.includes('Network') || err.status === 404 || err.message?.includes('Failed')) {
        const fallbackRes = {
          username: docUsername,
          doctor_name: docObj.name,
          full_name: docObj.name,
          role: 'doctor',
          hospital_id: 10,
          hospital_name: 'DEMO General Hospital',
          department_name: docObj.dept,
          room_number: docObj.room,
          access: 'demo-doctor-static-token'
        }
        setApiAccessToken(fallbackRes.access)
        onLoginSuccess?.(fallbackRes)
        return
      }
      setError(err.message || `Failed to log in as ${docUsername}.`)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Please enter both your Doctor ID/username and password.')
      return
    }

    setLoading(true)
    try {
      const res = await staffLogin(username.trim(), password, 'doctor')
      if (res.role !== 'doctor' && res.role !== 'super_admin') {
        throw new Error('Access denied. This console is restricted to Doctor accounts only.')
      }
      setApiAccessToken(res.access)
      onLoginSuccess?.(res)
    } catch (err) {
      const docObj = DEMO_DOCTORS.find(d => d.username === username.trim()) || DEMO_DOCTORS[0]
      if ((err.message?.includes('fetch') || err.message?.includes('Network') || err.status === 404) && (username.includes('doctor') || username.startsWith('dr.'))) {
        const fallbackRes = {
          username: username.trim(),
          doctor_name: docObj.name,
          full_name: docObj.name,
          role: 'doctor',
          hospital_id: 10,
          hospital_name: 'DEMO General Hospital',
          department_name: docObj.dept,
          room_number: docObj.room,
          access: 'demo-doctor-static-token'
        }
        setApiAccessToken(fallbackRes.access)
        onLoginSuccess?.(fallbackRes)
        return
      }
      setError(err.message || 'Doctor authentication failed. Please verify your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleFillDemo = () => {
    setUsername('demo.doctor')
    setPassword(demoDoctorPassword)
    setError('')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Background Noticeable Faded Image */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <img
          src={doctorBg}
          alt=""
          className="w-full h-full object-cover object-center filter blur-[1px] opacity-[0.40] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/50 to-slate-50/70" />
        {/* Subtle Watermark Motto in Background */}
        <div className="absolute top-20 right-8 hidden xl:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-slate-200/80 shadow-xs text-xs font-bold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <span>Skip the Line. Save Your Time.</span>
        </div>
      </div>

      {/* Top Header */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between relative z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-sm shadow-xs">
              <Stethoscope className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight text-sm">
              DEMO General Hospital &bull; Doctor OPD Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Clinician Access
          </span>
        </div>
      </header>

      {/* Main Content: Horizontal 2-Column Structure */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="w-full max-w-4xl lg:max-w-5xl bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
            {/* Left Column: Role Details & Interactive Doctor Picker */}
            <div className="md:col-span-6 p-6 sm:p-8 bg-blue-50/40 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/90 border border-blue-200 text-blue-900 text-xs font-bold mb-3 shadow-xs">
                  <Sparkles size={13} className="text-blue-600" />
                  <span>Skip the Line. Save Your Time.</span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100/80 border border-blue-200 text-blue-700 flex items-center justify-center shadow-xs">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                      Doctor OPD Console
                    </h1>
                    <div className="flex items-center gap-1.5 text-xs text-blue-700 font-bold mt-0.5">
                      <Building2 size={12} className="text-blue-600" />
                      <span>DEMO General Hospital &bull; Dehradun</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                  Call waiting tokens in real time, declare consultation delays, review assigned patient vitals, and mark completed OPD sessions.
                </p>

                {/* Interactive Doctor Quick Selector */}
                <div className="p-3.5 rounded-xl bg-white/90 border border-blue-200/80 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-blue-600" />
                      <span className="text-xs font-bold text-blue-950">1-Click Launch Doctor Queue:</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono font-medium">Auto-populates session</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DEMO_DOCTORS.map((doc) => {
                      const isSelected = username === doc.username
                      return (
                        <button
                          key={doc.username}
                          type="button"
                          onClick={() => handleLaunchDoctor(doc.username)}
                          disabled={loading}
                          className={`p-2 rounded-lg border text-left transition flex items-center justify-between gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-800 shadow-xs'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                              {doc.name}
                            </div>
                            <div className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-blue-600 font-medium'}`}>
                              {doc.dept}
                            </div>
                          </div>
                          <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                            isSelected
                              ? 'bg-blue-700 text-white'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {doc.room}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Security & Feature Badges */}
              <div className="mt-5 pt-4 border-t border-blue-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Live SSE Token Broadcast
                </span>
                <span>Role Protected</span>
              </div>
            </div>

            {/* Right Column: Direct Credentials Sign In Form */}
            <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between bg-white">
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    Sign In with Credentials
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter your assigned hospital medical credentials to open the live consultation stream.
                  </p>
                </div>

                {error && (
                  <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 font-medium shadow-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Doctor ID / Username
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="demo.doctor"
                        className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={handleFillDemo}
                      className="text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Autofill Demo Credentials
                    </button>
                    <span className="text-slate-500 font-mono text-[11px] font-medium">District Hospital</span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-3 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all duration-200 shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Doctor Credentials...</span>
                      </>
                    ) : (
                      <>
                        <span>Enter Doctor OPD Console</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Cross-portal quick navigation links */}
              <div className="mt-6 pt-5 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-600 font-medium">
                  Switch to other portals:{' '}
                  <button
                    onClick={() => onNavigate('/reception/login')}
                    className="text-purple-600 hover:underline font-semibold cursor-pointer"
                  >
                    Reception Desk
                  </button>
                  {' '}&bull;{' '}
                  <button
                    onClick={() => onNavigate('/patient/login')}
                    className="text-teal-600 hover:underline font-semibold cursor-pointer"
                  >
                    Patient Portal
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/90 px-4 py-3 text-center text-xs text-slate-500 relative z-10 font-medium">
        Doctor Clinical Workstation &bull; Role-Based Access Control Active &bull; Demo: demo.doctor / DoctorDemo@2026!
      </footer>
    </div>
  )
}
