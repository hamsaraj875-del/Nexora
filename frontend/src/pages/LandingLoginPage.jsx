import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  ShieldAlert,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../shared/components/ThemeToggle';

const PORTAL_CONFIGS = {
  officer: {
    id: 'officer',
    title: 'Statutory Officer Portal',
    subtitle: 'Apex Governance, Overlap Coordination & Regional Oversight',
    badge: 'Statutory Oversight',
    icon: ShieldAlert,
    accentColor: '#60A5FA',
    accentBg: 'rgba(59, 130, 246, 0.12)',
    accentBorder: 'rgba(59, 130, 246, 0.35)',
    btnColor: 'bg-blue-500 hover:bg-blue-600 text-slate-100 font-extrabold',
    redirectPath: '/officer',
    placeholderEmail: 'admin@aicte.gov.in',
    demoAccounts: [
      {
        name: 'Super Admin',
        role: 'Central IT & Admin (Full Access)',
        email: 'admin@aicte.gov.in',
      },
      {
        name: 'Senior Management',
        role: 'AICTE Director (Read-Only Oversight)',
        email: 'director@aicte.gov.in',
      },
      {
        name: 'Regional Officer (North)',
        role: 'RO Northern Region (Scoped)',
        email: 'ro.north@aicte.gov.in',
      },
    ],
  },
  bureau: {
    id: 'bureau',
    title: 'Bureau Operations Portal',
    subtitle: 'Assigned Cell Inquiries, Bulk Data Intake & Case Disposal',
    badge: 'Bureau Operations',
    icon: Briefcase,
    accentColor: '#60A5FA',
    accentBg: 'rgba(59, 130, 246, 0.12)',
    accentBorder: 'rgba(59, 130, 246, 0.35)',
    btnColor: 'bg-blue-500 hover:bg-blue-600 text-slate-100',
    redirectPath: '/bureau',
    placeholderEmail: 'officer.rb@aicte.gov.in',
    demoAccounts: [
      {
        name: 'Regulatory Bureau (RB)',
        role: 'Regulatory Officer',
        email: 'officer.rb@aicte.gov.in',
      },
      {
        name: 'Grievance Cell (PGRC)',
        role: 'PGRC Officer',
        email: 'officer.pgrc@aicte.gov.in',
      },
      {
        name: 'Approval Bureau',
        role: 'Approval Officer',
        email: 'officer.approval@aicte.gov.in',
      },
      {
        name: 'Academic Bureau',
        role: 'Academic Officer',
        email: 'officer.academic@aicte.gov.in',
      },
      {
        name: 'Data Operator',
        role: 'Intake & Match Review Operator',
        email: 'operator@aicte.gov.in',
      },
    ],
  },
  student: {
    id: 'student',
    title: 'Complainant Reference Portal (Archived)',
    subtitle: 'Reference status look-up for ingested complaints',
    badge: 'Complainant Reference',
    icon: ShieldCheck,
    accentColor: '#60A5FA',
    accentBg: 'rgba(59, 130, 246, 0.12)',
    accentBorder: 'rgba(59, 130, 246, 0.35)',
    btnColor: 'bg-blue-500 hover:bg-blue-600 text-slate-100',
    redirectPath: '/student',
    placeholderEmail: 'student@example.com',
    demoAccounts: [
      {
        name: 'Sample Complainant',
        role: 'Reference Account',
        email: 'student@example.com',
      },
    ],
  },
};

export function LandingLoginPage({ defaultPortal }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPortal = searchParams.get('portal');

  // Default to internal officer portal as primary workflow
  const initialPortal = defaultPortal || (urlPortal && PORTAL_CONFIGS[urlPortal] ? urlPortal : 'officer');
  const [activePortal, setActivePortal] = useState(initialPortal);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const cfg = PORTAL_CONFIGS[activePortal] || PORTAL_CONFIGS.officer;

  useEffect(() => {
    if (defaultPortal && PORTAL_CONFIGS[defaultPortal]) {
      setActivePortal(defaultPortal);
    } else if (urlPortal && PORTAL_CONFIGS[urlPortal]) {
      setActivePortal(urlPortal);
    }
  }, [defaultPortal, urlPortal]);

  const handleSwitchTab = (portalKey) => {
    setActivePortal(portalKey);
    setError('');
    setEmail('');
    setPassword('');
    setSearchParams({ portal: portalKey });
  };

  const handleQuickLogin = (accEmail) => {
    setEmail(accEmail);
    setPassword('Password@123');
    setError('');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!email || !password) {
      setError('Please provide both email address and password.');
      return;
    }

    try {
      setError('');
      setSubmitting(true);
      await login(email, password, activePortal);
      navigate(cfg.redirectPath, { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Authentication failed. Please verify credentials.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const Icon = cfg.icon;

  return (
    <div className="min-h-screen w-full bg-[#0B1730] text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans selection:bg-[#00E676]/30 selection:text-blue-300 overflow-y-auto relative">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
        <ThemeToggle />
      </div>

      {/* Background ambient glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[140px] transition-all duration-700 opacity-20"
          style={{ backgroundColor: cfg.accentColor }}
        />
        <div
          className="absolute bottom-10 right-10 w-96 h-96 rounded-full blur-[140px] transition-all duration-700 opacity-15"
          style={{ backgroundColor: cfg.accentColor }}
        />
      </div>

      {/* Header Branding */}
      <header className="relative max-w-xl mx-auto w-full pt-4 sm:pt-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#172846] border border-slate-700/80 text-xs font-medium text-slate-300 mb-2">
          <ShieldCheck className="w-4 h-4 text-blue-300" />
          <span>All India Council for Technical Education</span>
          <span className="text-slate-500">&bull;</span>
          <span className="text-slate-100 font-semibold">SIH Dashboard</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-100">
          Institution Complaint Monitoring System
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Single-window tracking, cross-bureau statutory overlap detection, and SLA oversight across AICTE Bureaus and Cells.
        </p>
      </header>

      {/* Main Login Card */}
      <main className="relative max-w-lg mx-auto w-full my-6">
        <div className="bg-[#101D35] rounded-2xl border border-slate-700/80 shadow-2xl p-5 sm:p-7 relative overflow-hidden">
          {/* Top glow line */}
          <div
            className="absolute top-0 left-0 right-0 h-1 transition-all duration-500"
            style={{ backgroundColor: cfg.accentColor }}
          />

          {/* Primary Official Selection Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#172846] border border-slate-700/80 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => handleSwitchTab('officer')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePortal === 'officer'
                  ? 'bg-blue-500 text-slate-100 shadow-md'
                  : 'text-slate-300 hover:text-slate-100 hover:bg-[#1D3153]'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Officer Portal</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('bureau')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activePortal === 'bureau'
                  ? 'bg-blue-500 text-slate-100 shadow-md'
                  : 'text-slate-300 hover:text-slate-100 hover:bg-[#1D3153]'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Bureau Portal</span>
            </button>
          </div>

          {/* Current Portal Header Info */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border tracking-wider uppercase"
                  style={{
                    backgroundColor: cfg.accentBg,
                    borderColor: cfg.accentBorder,
                    color: cfg.accentColor,
                  }}
                >
                  {cfg.badge}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                {cfg.title}
              </h2>
              <p className="text-xs text-slate-400">
                {cfg.subtitle}
              </p>
            </div>
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: cfg.accentBg,
                borderColor: cfg.accentBorder,
                color: cfg.accentColor,
              }}
            >
              <Icon className="w-6 h-6" />
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2.5 text-xs animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={cfg.placeholderEmail}
                  required
                  className="w-full pl-9 pr-3 py-2 bg-[#172846] border border-slate-700/80 rounded-xl text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-[#172846] border border-slate-700/80 rounded-xl text-slate-100 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${cfg.btnColor}`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to {cfg.badge}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Login Section for AICTE Statutory Roles */}
          <div className="mt-6 pt-5 border-t border-slate-700/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-300" />
                <span>Authorized Demo Accounts</span>
              </span>
              <span className="text-[10px] text-slate-500">
                Preset Password: <code className="text-blue-300 font-mono">Password@123</code>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {cfg.demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickLogin(acc.email)}
                  className="text-left p-2.5 rounded-xl bg-[#172846] hover:bg-[#1D3153] border border-slate-700/80 hover:border-blue-500/40 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-blue-300 transition-colors">
                      {acc.name}
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {acc.role}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                    {acc.email}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative max-w-xl mx-auto w-full pb-2 text-center text-[11px] text-slate-400">
        <p>
          AICTE Central Statutory Monitoring Layer &bull; Problem Statement SIH 2024
        </p>
        <p className="text-[10px] text-slate-500 mt-1">
          Complaints ingested via Regulatory Bureau &amp; PGRC connectors and bulk CSV/XLSX imports.
        </p>
      </footer>
    </div>
  );
}

export default LandingLoginPage;
