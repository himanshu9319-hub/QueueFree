import React from 'react'
import { ArrowLeft, Shield, Sparkles, Building2, Stethoscope, Users, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { PatientPortalAuth } from './PatientPortalAuth'

export function PatientLoginPage({ onLoginSuccess, onNavigate }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Background soft ambient accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-8 py-4 flex items-center justify-between relative z-10 shadow-xs">
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
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              Q
            </div>
            <span className="font-bold text-slate-900 tracking-tight text-sm">
              DEMO Hospital OPD Platform
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Patient Access Portal
          </span>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 mb-3 shadow-md shadow-blue-500/10">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
              Patient Portal Login
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Sign in with your official ABHA identity or registered mobile number to manage your OPD appointments and live tokens.
            </p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 relative">
            <PatientPortalAuth onLoginSuccess={onLoginSuccess} />
          </div>

          {/* Quick links to staff portals */}
          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <p className="text-xs font-semibold text-slate-500 mb-3">Healthcare staff and administrators:</p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <button
                onClick={() => onNavigate('/doctor/login')}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50/50 transition flex items-center gap-1.5 shadow-xs cursor-pointer font-medium"
              >
                <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                Doctor Login
              </button>
              <button
                onClick={() => onNavigate('/reception/login')}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-purple-700 hover:border-purple-300 hover:bg-purple-50/50 transition flex items-center gap-1.5 shadow-xs cursor-pointer font-medium"
              >
                <Users className="w-3.5 h-3.5 text-purple-600" />
                Reception Login
              </button>
              <button
                onClick={() => onNavigate('/hospital-admin/login')}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-amber-700 hover:border-amber-300 hover:bg-amber-50/50 transition flex items-center gap-1.5 shadow-xs cursor-pointer font-medium"
              >
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                Hospital Admin
              </button>
              <button
                onClick={() => onNavigate('/super-admin/login')}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50/50 transition flex items-center gap-1.5 shadow-xs cursor-pointer font-medium"
              >
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                Super Admin
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500 relative z-10">
        DEMO Hospital OPD Platform &copy; {new Date().getFullYear()} &bull; Integrated with Ayushman Bharat Digital Mission (ABDM)
      </footer>
    </div>
  )
}
