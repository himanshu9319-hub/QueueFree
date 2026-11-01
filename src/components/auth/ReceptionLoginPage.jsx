import React, { useState } from 'react'
import { ArrowLeft, Users, Lock, User, AlertCircle, ArrowRight, RefreshCw, Building2, Sparkles, Zap, CheckCircle2 } from 'lucide-react'
import { staffLogin, setApiAccessToken } from '../../lib/queueApi'
import receptionBg from '../../assets/backgrounds/reception-bg.png'

const DEMO_RECEPTIONS = [
  { username: 'demo.reception', name: 'Reception Desk 1', desc: 'Main OPD Lobby (Ground Floor)', badge: 'Desk 1' },
  { username: 'reception.2', name: 'Reception Desk 2', desc: 'Specialty Clinics (1st Floor)', badge: 'Desk 2' },
]

export function ReceptionLoginPage({ onLoginSuccess, onNavigate }) {
  const demoReceptionPassword = import.meta.env.VITE_DEMO_RECEPTION_PASSWORD || 'Reception@2026!'
  const [username, setUsername] = useState('demo.reception')
  const [password, setPassword] = useState(demoReceptionPassword)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLaunchReception = async (recUsername) => {
    setLoading(true)
    setError('')
    setUsername(recUsername)
    setPassword(demoReceptionPassword)
    try {
      const res = await staffLogin(recUsername, demoReceptionPassword, 'receptionist')
      setApiAccessToken(res.access)
      onLoginSuccess?.(res)
    } catch (err) {
      const recObj = DEMO_RECEPTIONS.find(r => r.username === recUsername) || DEMO_RECEPTIONS[0]
      if (err.message?.includes('fetch') || err.message?.includes('Network') || err.status === 404 || err.message?.includes('Failed')) {
        const fallbackRes = {
          username: recUsername,
          full_name: recObj.name,
          role: 'receptionist',
          hospital_id: 10,
          hospital_name: 'DEMO General Hospital',
          desk_name: recObj.name,
          access: 'demo-reception-static-token'
        }
        setApiAccessToken(fallbackRes.access)
        onLoginSuccess?.(fallbackRes)
        return
      }
      setError(err.message || `Failed to log in as ${recUsername}.`)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Please enter both your Receptionist username and password.')
      return
    }

    setLoading(true)
    try {
      const res = await staffLogin(username.trim(), password, 'receptionist')
      if (!['reception', 'receptionist', 'super_admin'].includes(res.role)) {
        throw new Error('Access denied. This console is restricted to Reception Desk staff.')
      }
      setApiAccessToken(res.access)
      onLoginSuccess?.(res)
    } catch (err) {
      const recObj = DEMO_RECEPTIONS.find(r => r.username === username.trim()) || DEMO_RECEPTIONS[0]
      if ((err.message?.includes('fetch') || err.message?.includes('Network') || err.status === 404) && username.includes('reception')) {
        const fallbackRes = {
          username: username.trim(),
          full_name: recObj.name,
          role: 'receptionist',
          hospital_id: 10,
          hospital_name: 'DEMO General Hospital',
          desk_name: recObj.name,
          access: 'demo-reception-static-token'
        }
        setApiAccessToken(fallbackRes.access)
        onLoginSuccess?.(fallbackRes)
        return
      }
      setError(err.message || 'Receptionist authentication failed. Please verify credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleFillDemo = () => {
    setUsername('demo.reception')
    setPassword(demoReceptionPassword)
    setError('')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-purple-600 selection:text-white relative overflow-hidden">
      {/* Background Noticeable Faded Image */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <img
          src={receptionBg}
          alt=""
          className="w-full h-full object-cover object-center filter blur-[1px] opacity-[0.40] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/50 to-slate-50/70" />
        {/* Subtle Watermark Motto in Background */}
        <div className="absolute top-20 right-8 hidden xl:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-slate-200/80 shadow-xs text-xs font-bold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
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
            <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 font-bold text-sm shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight text-sm">
              DEMO General Hospital &bull; Reception Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            Front Desk Terminal
          </span>
        </div>
      </header>

      {/* Main Content: Horizontal 2-Column Structure */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="w-full max-w-4xl lg:max-w-5xl bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
            {/* Left Column: Role Details & Interactive Desk Selector */}
            <div className="md:col-span-6 p-6 sm:p-8 bg-purple-50/40 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100/90 border border-purple-200 text-purple-900 text-xs font-bold mb-3 shadow-xs">
                  <Sparkles size={13} className="text-purple-600" />
                  <span>Skip the Line. Save Your Time.</span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100/80 border border-purple-200 text-purple-700 flex items-center justify-center shadow-xs">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                      Reception Desk Portal
                    </h1>
                    <div className="flex items-center gap-1.5 text-xs text-purple-700 font-bold mt-0.5">
                      <Building2 size={12} className="text-purple-600" />
                      <span>DEMO General Hospital &bull; Dehradun</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                  Support authorized walk-in patient registration, issue instant physical token slips, verify patient arrival check-in, and manage waiting room flow.
                </p>

                {/* Specific Reception Desk Selector Cards */}
                <div className="p-3.5 rounded-xl bg-white/90 border border-purple-200/80 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-purple-600" />
                      <span className="text-xs font-bold text-purple-950">1-Click Launch Reception Terminal:</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono font-medium">Instant session</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {DEMO_RECEPTIONS.map((rec) => {
                      const isSelected = username === rec.username
                      return (
                        <button
                          key={rec.username}
                          type="button"
                          onClick={() => handleLaunchReception(rec.username)}
                          disabled={loading}
                          className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 text-slate-800 shadow-xs'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                              {rec.name}
                            </div>
                            <div className={`text-[10px] ${isSelected ? 'text-purple-100' : 'text-purple-600 font-medium'}`}>
                              {rec.desc}
                            </div>
                          </div>
                          <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                            isSelected
                              ? 'bg-purple-700 text-white'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {rec.badge}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom status badge */}
              <div className="mt-5 pt-4 border-t border-purple-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Thermal Printer Slip Ready
                </span>
                <span>Front Desk Terminal</span>
              </div>
            </div>

            {/* Right Column: Direct Credentials Sign In Form */}
            <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between bg-white">
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    Receptionist Authentication
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Log in to issue walk-in queue numbers, print token receipts, and monitor active hall queue.
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
                      Receptionist Username
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="demo.reception"
                        className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-medium"
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
                        className="w-full bg-slate-50 border border-slate-300 focus:border-purple-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={handleFillDemo}
                      className="text-purple-600 hover:text-purple-700 font-semibold underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Autofill Demo Credentials
                    </button>
                    <span className="text-slate-500 font-mono text-[11px] font-medium">District Hospital</span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-3 py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-all duration-200 shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Reception Credentials...</span>
                      </>
                    ) : (
                      <>
                        <span>Enter Reception Console</span>
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
                    onClick={() => onNavigate('/doctor/login')}
                    className="text-blue-600 hover:underline font-semibold cursor-pointer"
                  >
                    Doctor OPD Console
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
        Reception Desk Front Console &bull; Role-Based Access Control Active &bull; Demo: demo.reception / Reception@2026!
      </footer>
    </div>
  )
}
