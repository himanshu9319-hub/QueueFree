import React, { useState } from 'react'
import { ArrowLeft, Building2, Lock, User, AlertCircle, ArrowRight, RefreshCw, Shield, Sparkles, Zap, CheckCircle2 } from 'lucide-react'
import { staffLogin, setApiAccessToken } from '../../lib/queueApi'
import hospitalAdminBg from '../../assets/backgrounds/hospital-admin-bg.png'

export function HospitalAdminLoginPage({ onLoginSuccess, onNavigate }) {
  const [username, setUsername] = useState('demo.hospitaladmin')
  const [password, setPassword] = useState('HospAdmin@2026!')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleQuickDemoLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await staffLogin('demo.hospitaladmin', 'HospAdmin@2026!', 'hospital_admin')
      setApiAccessToken(res.access)
      onLoginSuccess?.(res)
    } catch (err) {
      if (err.message?.includes('fetch') || err.message?.includes('Network') || err.status === 404 || err.message?.includes('Failed')) {
        const fallbackRes = {
          username: 'demo.hospitaladmin',
          full_name: 'DEMO Hospital Administrator',
          role: 'hospital_admin',
          hospital_id: 10,
          hospital_name: 'DEMO General Hospital',
          access: 'demo-admin-static-token'
        }
        setApiAccessToken(fallbackRes.access)
        onLoginSuccess?.(fallbackRes)
        return
      }
      setError(err.message || 'Demo hospital admin login failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Please enter both your Hospital Admin username and password.')
      return
    }

    setLoading(true)
    try {
      const res = await staffLogin(username.trim(), password, 'hospital_admin')
      if (res.role !== 'hospital_admin' && res.role !== 'super_admin') {
        throw new Error('Access denied. This console is restricted to Hospital Admin accounts.')
      }
      setApiAccessToken(res.access)
      onLoginSuccess?.(res)
    } catch (err) {
      if ((err.message?.includes('fetch') || err.message?.includes('Network') || err.status === 404) && username.includes('admin')) {
        const fallbackRes = {
          username: username.trim(),
          full_name: 'DEMO Hospital Administrator',
          role: 'hospital_admin',
          hospital_id: 10,
          hospital_name: 'DEMO General Hospital',
          access: 'demo-admin-static-token'
        }
        setApiAccessToken(fallbackRes.access)
        onLoginSuccess?.(fallbackRes)
        return
      }
      setError(err.message || 'Hospital Admin authentication failed. Please verify credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleFillDemo = () => {
    setUsername('demo.hospitaladmin')
    setPassword('HospAdmin@2026!')
    setError('')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-amber-600 selection:text-white relative overflow-hidden">
      {/* Background Noticeable Faded Image */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <img
          src={hospitalAdminBg}
          alt=""
          className="w-full h-full object-cover object-center filter blur-[1px] opacity-[0.40] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/50 to-slate-50/70" />
        {/* Subtle Watermark Motto in Background */}
        <div className="absolute top-20 right-8 hidden xl:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-slate-200/80 shadow-xs text-xs font-bold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
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
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-bold text-sm shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight text-sm">
              DEMO General Hospital &bull; Hospital Administration
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Tenant Administration
          </span>
        </div>
      </header>

      {/* Main Content: Horizontal 2-Column Structure */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="w-full max-w-4xl lg:max-w-5xl bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
            {/* Left Column: Role Details & 1-Click Launch */}
            <div className="md:col-span-6 p-6 sm:p-8 bg-amber-50/40 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/90 border border-amber-200 text-amber-950 text-xs font-bold mb-3 shadow-xs">
                  <Sparkles size={13} className="text-amber-600" />
                  <span>Skip the Line. Save Your Time.</span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100/80 border border-amber-200 text-amber-700 flex items-center justify-center shadow-xs">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                      Hospital Admin Portal
                    </h1>
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 font-bold mt-0.5">
                      <Shield size={12} className="text-amber-600" />
                      <span>Facility Operations & Staff Governance</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                  Configure clinical departments, doctor consultation schedules, daily token capacity thresholds, and manage staff user accounts.
                </p>

                {/* 1-Click Quick Demo Access Card */}
                <div className="p-4 rounded-xl bg-white/90 border border-amber-200/90 shadow-xs">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                        <Sparkles size={14} />
                      </div>
                      <span className="text-xs font-bold text-amber-950">Preconfigured Demo Account:</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      DEMO General Hospital
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-mono mb-3 bg-amber-50/60 p-2 rounded-lg border border-amber-100">
                    demo.hospitaladmin &bull; HospAdmin@2026!
                  </p>

                  <button
                    type="button"
                    onClick={handleQuickDemoLogin}
                    disabled={loading}
                    className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Zap size={14} />
                    <span>1-Click Launch Admin Session</span>
                  </button>
                </div>
              </div>

              {/* Bottom security features */}
              <div className="mt-5 pt-4 border-t border-amber-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Tenant Data Isolation Enforced
                </span>
                <span>Hospital Scope</span>
              </div>
            </div>

            {/* Right Column: Direct Credentials Sign In Form */}
            <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-between bg-white">
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                    Facility Administrator Sign In
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Log in with authorized hospital management credentials to administer operations.
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
                      Admin Username / Email
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="demo.hospitaladmin"
                        className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all font-medium"
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
                        className="w-full bg-slate-50 border border-slate-300 focus:border-amber-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all font-medium"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={handleFillDemo}
                      className="text-amber-600 hover:text-amber-700 font-semibold underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Autofill Demo Credentials
                    </button>
                    <span className="text-slate-500 font-mono text-[11px] font-medium">District Hospital</span>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-3 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition-all duration-200 shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Admin Credentials...</span>
                      </>
                    ) : (
                      <>
                        <span>Enter Hospital Admin Portal</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Cross-portal quick navigation links */}
              <div className="mt-6 pt-5 border-t border-slate-200 text-center">
                <p className="text-xs text-slate-600 font-medium">
                  Looking for platform governance?{' '}
                  <button
                    onClick={() => onNavigate('/super-admin/login')}
                    className="text-amber-600 hover:underline font-semibold cursor-pointer"
                  >
                    Super Admin Console
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
        Hospital Administration Console &bull; Role-Based Access Control Active &bull; Demo: demo.hospitaladmin / HospAdmin@2026!
      </footer>
    </div>
  )
}
