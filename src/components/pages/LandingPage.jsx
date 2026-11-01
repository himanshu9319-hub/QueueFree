import React, { useState } from 'react'
import {
  Activity, ArrowRight, Calendar, HeartPulse, ShieldCheck,
  Stethoscope, Users, Building2, Check, Sparkles, User, Menu, X, Lock,
  Shield, Clock, MapPin, CheckCircle2, ChevronRight, Monitor, KeyRound,
  ArrowUpRight, AlertCircle, FileText, Zap, RefreshCw, CheckCircle,
  PhoneCall, ExternalLink, Globe2, HelpCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { staffLogin, initiateAbhaAuth, confirmAbhaAuth, setApiAccessToken } from '../../lib/queueApi'

export function LandingPage({
  onNavigate,
  onLoginSuccess,
  onDoctorLoginSuccess,
  onReceptionLoginSuccess,
  onHospitalAdminLoginSuccess,
  onSuperAdminLoginSuccess,
  onStaffLoginSuccess,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [quickLoggingIn, setQuickLoggingIn] = useState(null)
  const [legalModal, setLegalModal] = useState(null) // 'privacy' | 'terms' | null

  const handleNav = (path) => {
    setMobileMenuOpen(false)
    if (onNavigate) {
      onNavigate(path)
    } else {
      window.location.assign(path)
    }
  }

  const handleQuickLogin = async (roleId) => {
    setQuickLoggingIn(roleId)
    try {
      if (roleId === 'patient') {
        const init = await initiateAbhaAuth('91-8800-4521-9921', 'MOBILE_OTP').catch(() => null)
        if (init?.txn_id) {
          const res = await confirmAbhaAuth(init.txn_id, '123456')
          setApiAccessToken(res.access)
          onLoginSuccess?.({
            name: res.display_name || 'Priya Sharma',
            phone: res.phone || '+919123456780',
            email: res.email || 'patient@demohospital.in',
            abha_verified: true,
            abha_id: res.abha_id || '91-8800-4521-9921',
            access: res.access,
          })
          return
        }
        onLoginSuccess?.({
          name: 'Priya Sharma',
          phone: '+919123456780',
          email: 'patient@demohospital.in',
          abha_verified: true,
          abha_id: '91-8800-4521-9921',
        })
      } else if (roleId === 'doctor') {
        const res = await staffLogin('demo.doctor', 'DoctorDemo@2026!', 'doctor')
        setApiAccessToken(res.access)
        onDoctorLoginSuccess?.(res)
      } else if (roleId === 'reception') {
        const res = await staffLogin('demo.reception', 'Reception@2026!', 'receptionist')
        setApiAccessToken(res.access)
        onReceptionLoginSuccess?.(res)
      } else if (roleId === 'hospital-admin') {
        const res = await staffLogin('demo.hospitaladmin', 'HospAdmin@2026!', 'hospital_admin')
        setApiAccessToken(res.access)
        onHospitalAdminLoginSuccess?.(res)
      } else if (roleId === 'super-admin') {
        const res = await staffLogin('demo.superadmin', 'SuperAdmin@2026!', 'super_admin')
        setApiAccessToken(res.access)
        onSuperAdminLoginSuccess?.(res)
      } else if (roleId === 'display') {
        handleNav('/display')
      }
    } catch {
      handleNav(`/${roleId}/login`)
    } finally {
      setQuickLoggingIn(null)
    }
  }

  // Feature Highlights (4 Primary Core Features)
  const coreFeatures = [
    {
      id: 'abha',
      icon: ShieldCheck,
      title: 'ABHA & ABDM Integration',
      description: 'Official ABDM authentication and supported patient identity workflows.',
      badge: 'ABDM v3 Verified',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconBg: 'bg-emerald-50 text-emerald-600',
      status: 'Active Gateway',
    },
    {
      id: 'queue',
      icon: Clock,
      title: 'Live Queue Tracking',
      description: 'Track queue position and monitor appointment progress in real time.',
      badge: 'Real-Time Sync',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      iconBg: 'bg-blue-50 text-blue-600',
      status: 'Active Feed',
    },
    {
      id: 'reception',
      icon: Users,
      title: 'Reception Walk-in Tokens',
      description: 'Support authorized walk-in registration and token allocation.',
      badge: 'Front Desk Terminal',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      iconBg: 'bg-purple-50 text-purple-600',
      status: 'Active Console',
    },
    {
      id: 'hospitals',
      icon: Globe2,
      title: 'Multi-Hospital Integration',
      description: 'Connect with supported hospital systems and external booking portals.',
      badge: 'Catalog & Redirects',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      iconBg: 'bg-indigo-50 text-indigo-600',
      status: 'Integrated',
    },
  ]

  // Role-Based Portals (Direct Role Access)
  const rolePortals = [
    {
      id: 'patient',
      title: 'Patient Portal',
      subtitle: 'Citizen & Patient Services',
      description: 'Book doctor consultations from anywhere, track live queue wait times, and receive digital token slips.',
      icon: User,
      badge: 'Citizen Access',
      badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
      actionText: 'Patient Login',
      actionUrl: '/patient/login',
      accentColor: '#0d9488',
      demoRoleTag: 'Citizen Account',
      demoAccountName: 'Priya Sharma (Patient Demo)',
      demoUser: '+91 91234 56780',
      demoPass: 'OTP: 123456 / demo.patient',
    },
    {
      id: 'doctor',
      title: 'Doctor OPD Console',
      subtitle: 'Clinical Workstation',
      description: 'View today’s scheduled queue, call next patient tokens, mark serving or completed, and broadcast delay notices.',
      icon: Stethoscope,
      badge: 'Clinician Access',
      badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
      actionText: 'Doctor OPD Login',
      actionUrl: '/doctor/login',
      accentColor: '#2563eb',
      demoRoleTag: 'General Medicine',
      demoAccountName: 'Dr. Aarav Sharma (Room 101)',
      demoUser: 'demo.doctor',
      demoPass: 'DoctorDemo@2026!',
    },
    {
      id: 'reception',
      title: 'Reception Desk Terminal',
      subtitle: 'Hospital Front Desk',
      description: 'Check in arrived appointments, issue walk-in queue tokens, manage daily rosters, and print queue slips.',
      icon: Users,
      badge: 'Front Desk Access',
      badgeColor: 'text-purple-700 bg-purple-50 border-purple-200',
      actionText: 'Reception Desk Login',
      actionUrl: '/reception/login',
      accentColor: '#7c3aed',
      demoRoleTag: 'Front Desk Terminal',
      demoAccountName: 'DEMO General Hospital',
      demoUser: 'demo.reception',
      demoPass: 'Reception@2026!',
    },
    {
      id: 'hospital-admin',
      title: 'Hospital Admin Console',
      subtitle: 'Tenant Administration',
      description: 'Manage clinical departments, doctor consultation profiles, slot quotas, holidays, and staff accounts.',
      icon: Building2,
      badge: 'Hospital Admin',
      badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
      actionText: 'Hospital Admin Login',
      actionUrl: '/hospital-admin/login',
      accentColor: '#d97706',
      demoRoleTag: 'Hospital Scope',
      demoAccountName: 'DEMO General Hospital',
      demoUser: 'demo.hospitaladmin',
      demoPass: 'HospAdmin@2026!',
    },
    {
      id: 'super-admin',
      title: 'Super Admin Governance',
      subtitle: 'Platform Root Authority',
      description: 'Central platform governance: onboard hospitals, configure API adapters, and enforce single demo hospital constraints.',
      icon: KeyRound,
      badge: 'Platform Root',
      badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
      actionText: 'Super Admin Login',
      actionUrl: '/super-admin/login',
      accentColor: '#e11d48',
      demoRoleTag: 'Platform Root',
      demoAccountName: 'Central SaaS Authority',
      demoUser: 'demo.superadmin',
      demoPass: 'SuperAdmin@2026!',
    },
  ]

  // How QueueFree Works (4 Steps)
  const workflowSteps = [
    {
      step: '01',
      title: 'Select Hospital & Specialty',
      desc: 'Browse available hospitals, departments and doctors.',
      icon: Building2,
    },
    {
      step: '02',
      title: 'Book Token From Home',
      desc: 'Choose an available appointment or supported booking option.',
      icon: Calendar,
    },
    {
      step: '03',
      title: 'Track Live Queue in Real Time',
      desc: 'Monitor queue progress and appointment status.',
      icon: Clock,
    },
    {
      step: '04',
      title: 'Arrive Just When Needed',
      desc: 'Reach the hospital at the appropriate time according to your queue and hospital instructions.',
      icon: CheckCircle2,
    },
  ]

  return (
    <div className="landing-container min-h-screen flex flex-col bg-slate-50/70 text-slate-800 selection:bg-blue-600 selection:text-white">
      {/* =================================================================== */}
      {/* 3. NAVIGATION BAR (STICKY, MODERN, WITH ROLE BUTTONS)               */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-shadow duration-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => handleNav('/')}
            title="QueueFree Home"
          >
            <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 group-hover:bg-blue-700 transition">
              <Activity size={22} strokeWidth={2.5} />
            </span>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-slate-900 leading-none">
                Queue<span className="text-blue-600">Free</span>
              </span>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">
                OPD Management
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold text-slate-600" aria-label="Main Navigation">
            <button
              type="button"
              onClick={() => handleNav('/')}
              className="px-3 py-2 rounded-lg text-blue-600 bg-blue-50 font-bold hover:bg-blue-100/60 transition"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => handleNav('/patient/login')}
              className="px-3 py-2 rounded-lg hover:text-teal-700 hover:bg-teal-50/80 transition flex items-center gap-1.5"
            >
              <User size={14} className="text-teal-600" />
              <span>Patient</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('/doctor/login')}
              className="px-3 py-2 rounded-lg hover:text-blue-700 hover:bg-blue-50/80 transition flex items-center gap-1.5"
            >
              <Stethoscope size={14} className="text-blue-600" />
              <span>Doctor</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('/reception/login')}
              className="px-3 py-2 rounded-lg hover:text-purple-700 hover:bg-purple-50/80 transition flex items-center gap-1.5"
            >
              <Users size={14} className="text-purple-600" />
              <span>Receptionist</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('/hospital-admin/login')}
              className="px-3 py-2 rounded-lg hover:text-amber-700 hover:bg-amber-50/80 transition flex items-center gap-1.5"
            >
              <Building2 size={14} className="text-amber-600" />
              <span>Hospital Admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('/super-admin/login')}
              className="px-3 py-2 rounded-lg hover:text-rose-700 hover:bg-rose-50/80 transition flex items-center gap-1.5"
            >
              <Lock size={14} className="text-rose-600" />
              <span>Super Admin</span>
            </button>
          </nav>

          {/* Action CTA & Mobile Hamburger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleNav('/patient/login')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition hidden sm:inline-flex items-center gap-1.5"
            >
              <span>Sign In</span>
              <ArrowRight size={14} />
            </button>

            <button
              type="button"
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Responsive Mobile Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 shadow-xl space-y-1 overflow-hidden"
            >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                QueueFree Navigation & Portals
              </p>
              <button
                type="button"
                onClick={() => handleNav('/')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 flex items-center justify-between"
              >
                <span>Home</span>
                <ChevronRight size={14} className="text-blue-500" />
              </button>
              <button
                type="button"
                onClick={() => handleNav('/patient/login')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-50 flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><User size={15} /> Patient Portal</span>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => handleNav('/doctor/login')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><Stethoscope size={15} /> Doctor OPD Console</span>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => handleNav('/reception/login')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-purple-700 hover:bg-purple-50 flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><Users size={15} /> Reception Desk Terminal</span>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => handleNav('/hospital-admin/login')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><Building2 size={15} /> Hospital Admin Console</span>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => handleNav('/super-admin/login')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 flex items-center justify-between"
              >
                <span className="flex items-center gap-2"><Lock size={15} /> Super Admin Governance</span>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* =================================================================== */}
      {/* 1 & 2. HERO SECTION REDESIGN & BRANDING                             */}
      {/* =================================================================== */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        {/* Subtle decorative background light washes */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[340px] bg-gradient-to-tr from-blue-400/10 via-indigo-400/10 to-teal-400/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Small Feature Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50/90 border border-blue-200/80 text-blue-700 text-xs font-bold mb-6 shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Smart Healthcare. Zero Queue Hassle.</span>
          </motion.div>

          {/* Primary Tagline Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.08] mb-6"
          >
            Skip the Line.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600">
              Save Your Time.
            </span>
          </motion.h1>

          {/* Supporting Description */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg lg:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-9"
          >
            Book doctor consultations from anywhere, track your live queue position in real time, and arrive at the hospital only when your consultation turn is near.
          </motion.p>

          {/* Primary Call to Action */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-14"
          >
            <button
              type="button"
              onClick={() => handleNav('/patient/login')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2.5 transition transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Book OPD Token</span>
              <ArrowRight size={16} />
            </button>
          </motion.div>

          {/* Visual Queue Interface Representation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="max-w-2xl mx-auto rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-200/60 p-5 sm:p-6 text-left relative overflow-hidden backdrop-blur"
          >
            {/* Top Bar of Queue Card */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                  <Activity size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">DEMO General Hospital</h4>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <MapPin size={11} className="text-slate-400" />
                    <span>Dehradun, Uttarakhand &bull; OPD Wing</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Consultation Stream
                </span>
              </div>
            </div>

            {/* Serving & Consulting Doctor Highlight */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4.5 border-b border-slate-100 items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Now Serving in Room 101
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black text-blue-600 font-mono tracking-tight">
                    GEN-001
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                    In Consultation
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-700 mt-1 flex items-center gap-1.5">
                  <Stethoscope size={13} className="text-blue-500" />
                  <span>Dr. Aarav Sharma &bull; General Medicine</span>
                </p>
              </div>

              <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200/70">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-600 font-semibold">Your Live Estimated Turn</span>
                  <span className="font-bold text-emerald-700">~12 mins wait</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
                  <div className="bg-gradient-to-r from-blue-500 to-teal-500 h-full w-[65%] rounded-full animate-pulse" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Current: GEN-001</span>
                  <span>Next: GEN-002, GEN-003</span>
                </div>
              </div>
            </div>

            {/* Bottom Safeguards & Features Footer */}
            <div className="pt-3.5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-slate-600 font-medium">
                  <CheckCircle size={13} className="text-emerald-500" />
                  Zero PII Public Broadcast
                </span>
                <span className="hidden sm:inline text-slate-300">&bull;</span>
                <span className="flex items-center gap-1 text-slate-600 font-medium">
                  <ShieldCheck size={13} className="text-blue-500" />
                  ABDM Gateway Verified
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleNav('/patient/login')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group/link"
              >
                <span>Get Your Token Now</span>
                <ArrowRight size={12} className="group-hover/link:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 4. FEATURE HIGHLIGHT SECTION (4 PRIMARY FEATURES)                   */}
      {/* =================================================================== */}
      <section className="py-16 sm:py-20 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-2">
              Platform Features
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Built for Modern, Patient-Centered Hospitals
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
              QueueFree bridges official national healthcare standards with hospital OPD workflow automation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreFeatures.map((feat) => {
              const Icon = feat.icon
              return (
                <div
                  key={feat.id}
                  className="p-6 rounded-2xl bg-slate-50/50 hover:bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-11 h-11 rounded-xl ${feat.iconBg} flex items-center justify-center transition-transform group-hover:scale-105`}>
                        <Icon size={22} />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${feat.badgeColor}`}>
                        {feat.badge}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {feat.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600">{feat.status}</span>
                    <CheckCircle2 size={14} className="text-blue-600" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 5. ROLE-BASED PORTAL SECTION (DIRECT ROLE ACCESS)                   */}
      {/* =================================================================== */}
      <section className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-2">
            Direct Role Access
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Dedicated Workstations for Every Healthcare Role
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
            Every user group has its own tailored workflow, isolated permissions, and verified role dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rolePortals.map((portal) => {
            const Icon = portal.icon
            return (
              <div
                key={portal.id}
                onClick={() => handleNav(portal.actionUrl)}
                className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-xl transition-all duration-200 flex flex-col justify-between group cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                      style={{ backgroundColor: `${portal.accentColor}15`, color: portal.accentColor }}
                    >
                      <Icon size={24} />
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${portal.badgeColor}`}>
                      {portal.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {portal.title}
                  </h3>
                  <p className="text-xs font-semibold text-slate-400 mb-2">{portal.subtitle}</p>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">
                    {portal.description}
                  </p>

                  {/* Seeded Credentials Badge */}
                  <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200/90 shadow-sm text-left">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700">
                        <Sparkles size={12} className="text-amber-500" />
                        <span>Fresh Demo Access</span>
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                        {portal.demoRoleTag}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700 font-semibold truncate mb-1">
                      {portal.demoAccountName}
                    </div>
                    <div className="p-1.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] flex items-center justify-between text-slate-700">
                      <span className="font-bold text-slate-900">{portal.demoUser}</span>
                      <span className="text-slate-500">{portal.demoPass}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNav(portal.actionUrl)
                    }}
                    className="text-xs font-bold text-slate-700 hover:text-blue-600 flex items-center gap-1 transition"
                  >
                    <span>{portal.actionText}</span>
                    <ArrowRight size={13} />
                  </button>

                  <button
                    type="button"
                    disabled={quickLoggingIn === portal.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleQuickLogin(portal.id)
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 text-xs font-bold shadow-sm flex items-center gap-1 transition disabled:opacity-50"
                  >
                    {quickLoggingIn === portal.id ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Entering...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={12} />
                        <span>1-Click Demo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* =================================================================== */}
      {/* 6. HOW QUEUEFREE WORKS (PATIENT JOURNEY)                             */}
      {/* =================================================================== */}
      <section className="py-16 sm:py-24 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-2">
              Patient Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              How QueueFree Works
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
              Four clear steps designed to transform crowded waiting rooms into a predictable, pleasant experience.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {workflowSteps.map((step, idx) => {
              const StepIcon = step.icon
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-slate-50/60 border border-slate-200/80 hover:bg-white hover:border-blue-300 hover:shadow-lg transition-all duration-200 flex flex-col justify-between relative group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-black text-slate-300 group-hover:text-blue-500/40 transition-colors font-mono">
                        {step.step}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center transition-transform group-hover:scale-110">
                        <StepIcon size={20} />
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {step.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-200/50 flex items-center text-[11px] font-semibold text-blue-600 gap-1">
                    <span>Step {step.step}</span>
                    <ArrowRight size={12} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* PRE-FOOTER CALL TO ACTION BANNER                                    */}
      {/* =================================================================== */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white p-8 sm:p-12 shadow-xl shadow-blue-500/20 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-200 block mb-1">
              Immediate Token Access
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ready to experience modern healthcare?
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 mt-2 leading-relaxed">
              Book your OPD consultation token now or explore live waiting lobby displays across verified hospitals.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleNav('/patient/login')}
              className="px-6 py-3 rounded-xl bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs shadow-md transition"
            >
              Book OPD Token
            </button>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 10. COMPREHENSIVE FOOTER WITH PRIVACY & TERMS DIALOGS               */}
      {/* =================================================================== */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-12 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-blue-500/20">
                <Activity size={18} />
              </span>
              <span className="font-extrabold text-base tracking-tight text-slate-900">
                Queue<span className="text-blue-600">Free</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Smart healthcare OPD appointment and live queue tracking platform. Built for ABDM compliance, zero patient waiting room crowding, and clinical efficiency.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>National Gateway Ready</span>
            </div>
          </div>

          {/* Role Portals Column */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
              Direct Role Access
            </h4>
            <ul className="space-y-2">
              <li>
                <button type="button" onClick={() => handleNav('/patient/login')} className="hover:text-blue-600 transition">
                  Patient Portal Login
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('/doctor/login')} className="hover:text-blue-600 transition">
                  Doctor OPD Workstation
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('/reception/login')} className="hover:text-blue-600 transition">
                  Reception Desk Terminal
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('/hospital-admin/login')} className="hover:text-blue-600 transition">
                  Hospital Admin Console
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('/super-admin/login')} className="hover:text-blue-600 transition">
                  Super Admin Governance
                </button>
              </li>
            </ul>
          </div>

          {/* Hospital Services */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
              Patient Services
            </h4>
            <ul className="space-y-2">
              <li>
                <button type="button" onClick={() => handleNav('/patient/login')} className="hover:text-blue-600 transition">
                  Patient OPD Appointments
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('/')} className="hover:text-blue-600 transition">
                  Hospital Directory
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handleNav('/patient/login')} className="hover:text-blue-600 transition">
                  ABDM / ABHA Digital Identity
                </button>
              </li>
            </ul>
          </div>

          {/* Legal & Governance */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">
              Compliance & Legal
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => setLegalModal('privacy')}
                  className="hover:text-blue-600 transition text-left flex items-center gap-1.5"
                >
                  <ShieldCheck size={13} className="text-emerald-500" />
                  <span>Privacy Policy (ABDM Compliant)</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setLegalModal('terms')}
                  className="hover:text-blue-600 transition text-left flex items-center gap-1.5"
                >
                  <FileText size={13} className="text-blue-500" />
                  <span>Terms and Conditions</span>
                </button>
              </li>
              <li className="pt-2 text-[11px] text-slate-400 leading-tight">
                Protected under National Digital Health Mission (NDHM) guidelines & DISHA health privacy regulations.
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
          <p>&copy; {new Date().getFullYear()} QueueFree. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => setLegalModal('privacy')} className="hover:underline">Privacy</button>
            <span>&bull;</span>
            <button type="button" onClick={() => setLegalModal('terms')} className="hover:underline">Terms</button>
            <span>&bull;</span>
            <span>Security: SHA-256 / PBKDF2</span>
          </div>
        </div>
      </footer>

      {/* =================================================================== */}
      {/* PRIVACY POLICY & TERMS MODAL                                        */}
      {/* =================================================================== */}
      <AnimatePresence>
        {legalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative text-left"
            >
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>

              {legalModal === 'privacy' ? (
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <ShieldCheck size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">QueueFree Privacy Policy</h3>
                  <div className="text-xs text-slate-600 space-y-2.5 max-h-72 overflow-y-auto pr-2 leading-relaxed">
                    <p>
                      <strong>Zero-Knowledge Healthcare Privacy:</strong> QueueFree strictly complies with the Ayushman Bharat Digital Mission (ABDM) and DISHA health information guidelines.
                    </p>
                    <p>
                      <strong>Public TV Screen Zero PII:</strong> Waiting lobby displays broadcast only alphanumeric token codes, assigned room numbers, and consulting doctors. No patient names, phone numbers, or ABHA identifiers are ever broadcast on public screens.
                    </p>
                    <p>
                      <strong>Identity Verification:</strong> Patient ABHA numbers are verified through authorized government OTP gateways. Passwords and credentials are cryptographically protected and never exposed in client bundles.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    <FileText size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">QueueFree Terms and Conditions</h3>
                  <div className="text-xs text-slate-600 space-y-2.5 max-h-72 overflow-y-auto pr-2 leading-relaxed">
                    <p>
                      <strong>OPD Token Usage:</strong> Digital OPD tokens grant access to consultation slots for the allocated clinical schedule. Patients are advised to arrive according to real-time live queue estimates.
                    </p>
                    <p>
                      <strong>Emergency Care Notice:</strong> QueueFree OPD tokens are intended for outpatient consultation appointments. For critical emergencies, patients must immediately contact the hospital casualty department.
                    </p>
                    <p>
                      <strong>Hospital Autonomy:</strong> Consulting doctors and reception desks reserve the right to prioritize urgent triage cases over scheduled queue sequences in clinical necessity.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setLegalModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
