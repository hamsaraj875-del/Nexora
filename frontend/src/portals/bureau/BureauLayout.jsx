import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  AlertTriangle,
  GitMerge,
  UploadCloud,
  Bell,
  LogOut,
  Menu,
  X,
  User,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../../shared/components/ThemeToggle';

export function BureauLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { getPortalAuth, logout } = useAuth();
  const { user } = getPortalAuth('bureau');
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/bureau', icon: LayoutDashboard, exact: true },
    { name: 'My Cases', path: '/bureau/cases', icon: Briefcase },
    { name: 'Needs Attention', path: '/bureau/attention', icon: AlertTriangle },
    { name: 'Overlaps (Read-Only)', path: '/bureau/overlaps', icon: GitMerge },
    { name: 'Import Data', path: '/bureau/imports', icon: UploadCloud },
    { name: 'Alerts', path: '/bureau/alerts', icon: Bell },
  ];

  const handleLogout = () => {
    logout('bureau');
  };

  return (
    <div className="h-screen w-screen bg-[#0B1730] text-slate-100 p-2 sm:p-2.5 flex gap-2 sm:gap-2.5 overflow-hidden font-sans">
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Bureau Left Sidebar */}
      <aside
        className={`fixed lg:static top-2.5 bottom-2.5 left-2.5 z-50 w-64 bg-[#101D35] border   border-slate-700/80 rounded-2xl flex flex-col justify-between transition-all duration-300 shadow-2xl shrink-0 overflow-hidden ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="p-4 border-b border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-300">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-white">Nexora AICTE</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                    BUREAU
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  {user?.bureau?.name || 'Assigned Bureau Workspace'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-2.5 space-y-1 overflow-y-auto max-h-[calc(100vh-210px)]">
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Bureau Operations
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-sm'
                      : 'text-slate-300 hover:bg-[#172846] hover:text-white border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#6C7BFF]' : 'text-[#71717A]'}`} />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Logout */}
        <div className="p-3 border-t border-slate-700/80 bg-[#0B1730]/60">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#172846] border border-slate-700/80 flex items-center justify-center text-blue-300 shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{user?.name || 'Bureau Officer'}</div>
                <div className="text-[10px] text-slate-400 capitalize truncate">{user?.role?.replace(/_/g, ' ')}</div>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-[#172846] hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-slate-700/80 hover:border-rose-500/30 text-xs font-medium transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col gap-2 sm:gap-2.5 min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 bg-[#101D35] border border-slate-700/80 rounded-2xl px-4 flex items-center justify-between shadow-lg shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg bg-[#172846] text-slate-300 hover:text-white"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide uppercase">
                Bureau Operations Portal
              </span>
              <span className="hidden sm:inline-block text-slate-500">&bull;</span>
              <span className="hidden sm:inline-block text-xs text-slate-400">
                {user?.bureau?.name ? `Assigned: ${user.bureau.name}` : 'Investigation Workspace'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#172846] border border-slate-700/80 text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
              title="Switch Portal"
            >
              <span>Switch Portal</span>
            </button>
            <div className="h-4 w-px bg-[#232427] hidden sm:block" />
            <div className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/25 font-semibold">
              {user?.bureau?.code || 'BUREAU'} Scope
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto bg-[#101D35] border border-slate-700/80 rounded-2xl relative p-4 sm:p-6 custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default BureauLayout;