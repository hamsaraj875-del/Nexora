import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Bell, 
  RefreshCw, 
  Calendar, 
  Filter, 
  Menu, 
  ExternalLink,
  Sparkles,
  Flame,
  Coins,
  ChevronDown,
  User,
  PanelLeft
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../../shared/components/ThemeToggle';

export const TopNavbar = ({ setMobileOpen, sidebarCollapsed, setSidebarCollapsed }) => {
  const { 
    alerts = [], 
    markAlertRead, 
    markAllAlertsRead, 
    selectedDateRange, 
    setSelectedDateRange, 
    selectedBureauFilter, 
    setSelectedBureauFilter, 
    setCommandPaletteOpen,
    isRefreshing,
    triggerRefresh,
    cases = []
  } = useApp();

  const { user: currentUser } = useAuth();
  const [showAlertMenu, setShowAlertMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const alertMenuRef = useRef(null);
  const userMenuRef = useRef(null);
  const navigate = useNavigate();

  const unreadAlerts = alerts.filter((a) => !a.isRead);
  const overdueCount = cases.filter((c) => c.isOverdue || (c.status !== 'disposed' && c.expectedDisposalDate && new Date(c.expectedDisposalDate) < new Date())).length;

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (alertMenuRef.current && !alertMenuRef.current.contains(event.target)) {
        setShowAlertMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const bureauOptions = [
    'All Bureaus',
    'Approval Bureau',
    'Grievance Redressal Cell',
    'Regulation Bureau',
    'RIFD Bureau',
    'Administration & Vigilance',
    'Student Development Cell',
  ];

  const dateRangeOptions = [
    'Current Quarter (Q3 2026)',
    'Last 30 Days',
    'FY 2026-27 (Year to Date)',
    'All Time',
  ];

  return (
    <header className="bg-[#0F1011] border border-[#232427] rounded-[16px] px-3 sm:px-4 py-2 shrink-0 select-none">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Mobile trigger & Deep Purple Statutory Notice Banner (matching Image 1 FRI45 SALE strip) */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#1A1B1E] transition-colors"
            aria-label="Open mobile menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Slim Deep Purple Banner with Green Pill CTA */}
          <div className="hidden sm:flex items-center space-x-2.5 px-3 py-1 bg-gradient-to-r from-[#2E1065]/90 via-[#3B0764]/70 to-[#1E1B4B]/80 border border-[#581C87]/40 rounded-full text-xs">
            <span className="font-bold text-[11px] uppercase tracking-wider text-[#E9D5FF] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C084FC]" />
              <span>Statutory SLA Notice:</span>
            </span>
            <span className="text-[11px] text-[#D8B4FE] hidden lg:inline">
              {overdueCount > 0 ? `${overdueCount} cases exceed disposal deadline` : 'All council dockets within statutory norms'}
            </span>
            <button
              onClick={() => navigate('/cases?status=escalated')}
              className="px-2.5 py-0.5 rounded-full bg-[#00E676] hover:bg-[#00c864] text-black font-bold text-[10px] tracking-wide transition-all shadow-xs"
            >
              REVIEW NOW &rarr;
            </button>
          </div>
        </div>

        {/* Right: Search, Bureau Dropdown, Quarter Selector, Alerts & User Controls */}
        <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
          {/* Global Search Button */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="p-1.5 text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#1A1B1E] rounded-lg border border-transparent hover:border-[#232427] transition-colors flex items-center gap-1.5 text-xs"
            title="Search (⌘K)"
          >
            <Search className="w-4 h-4" />
            <span className="hidden xl:inline text-[#71717A] text-[11px]">Search...</span>
            <kbd className="hidden xl:inline-block px-1 py-0.2 text-[9px] font-mono text-[#71717A] bg-[#151618] border border-[#232427] rounded">
              ⌘K
            </kbd>
          </button>

          {/* Bureau Filter Dropdown */}
          <div className="hidden lg:flex items-center space-x-1.5 bg-[#151618] border border-[#232427] hover:border-[#2D2E32] rounded-lg px-2.5 py-1 text-xs text-[#A1A1AA] transition-colors">
            <Filter className="w-3 h-3 text-[#71717A]" />
            <select
              value={selectedBureauFilter}
              onChange={(e) => setSelectedBureauFilter(e.target.value)}
              className="bg-transparent border-none text-[11px] font-medium text-[#F4F4F5] focus:outline-none cursor-pointer pr-1"
            >
              {bureauOptions.map((b) => (
                <option key={b} value={b} className="bg-[#151618] text-[#F4F4F5]">{b}</option>
              ))}
            </select>
          </div>

          {/* Quarter / Date Range Selector */}
          <div className="hidden md:flex items-center space-x-1.5 bg-[#151618] border border-[#232427] hover:border-[#2D2E32] rounded-lg px-2.5 py-1 text-xs text-[#A1A1AA] transition-colors">
            <Calendar className="w-3 h-3 text-[#71717A]" />
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
              className="bg-transparent border-none text-[11px] font-medium text-[#F4F4F5] focus:outline-none cursor-pointer pr-1"
            >
              {dateRangeOptions.map((d) => (
                <option key={d} value={d} className="bg-[#151618] text-[#F4F4F5]">{d}</option>
              ))}
            </select>
          </div>

          {/* Live Sync Action */}
          <button
            onClick={triggerRefresh}
            disabled={isRefreshing}
            title="Refresh Central Registry"
            className="p-1.5 text-[#A1A1AA] hover:text-[#00E676] hover:bg-[#1A1B1E] rounded-lg transition-colors border border-transparent hover:border-[#232427]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00E676]' : ''}`} />
          </button>

          {/* Notification Bell Popover */}
          <div className="relative" ref={alertMenuRef}>
            <button
              onClick={() => setShowAlertMenu(!showAlertMenu)}
              className="relative p-1.5 text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#1A1B1E] rounded-lg transition-colors border border-transparent hover:border-[#232427]"
              title="Operational Alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadAlerts.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF4D79] rounded-full ring-2 ring-[#0F1011]" />
              )}
            </button>

            {showAlertMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0F1011] rounded-2xl shadow-modal border border-[#232427] z-50 overflow-hidden">
                <div className="p-3.5 bg-[#151618] border-b border-[#232427] flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#F4F4F5]">Regulatory Coordination Alerts</h4>
                    <p className="text-[11px] text-[#71717A]">
                      {unreadAlerts.length} pending actionable notices
                    </p>
                  </div>
                  {unreadAlerts.length > 0 && (
                    <button
                      onClick={markAllAlertsRead}
                      className="text-[11px] text-[#00E676] hover:underline font-semibold"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#232427]">
                  {alerts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#71717A]">
                      No operational notifications at this time.
                    </div>
                  ) : (
                    alerts.slice(0, 5).map((alert) => (
                      <div
                        key={alert.id}
                        onClick={() => {
                          markAlertRead(alert.id);
                          if (alert.relatedCaseId) {
                            setShowAlertMenu(false);
                            navigate(`/cases/${encodeURIComponent(alert.relatedCaseId)}`);
                          }
                        }}
                        className={`p-3 text-xs hover:bg-[#151618] cursor-pointer transition-colors ${
                          !alert.isRead ? 'bg-[#151618]/60' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`font-semibold ${alert.severity === 'critical' ? 'text-[#FF4D79]' : 'text-[#F4F4F5]'}`}>
                            {alert.title}
                          </span>
                          {!alert.isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D79] shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[#A1A1AA] text-[11px] mt-1 line-clamp-2">
                          {alert.description}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#71717A]">
                          <span className="truncate max-w-[180px]">{alert.institutionName || 'AICTE Central Registry'}</span>
                          <span>{alert.timestamp}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2.5 bg-[#151618] border-t border-[#232427] text-center">
                  <Link
                    to="/alerts"
                    onClick={() => setShowAlertMenu(false)}
                    className="text-xs font-semibold text-[#00E676] hover:underline inline-flex items-center gap-1"
                  >
                    <span>View all operational alerts</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Quick Stats Chips (matching Flame / Coin / Plus pill in Image 1) */}
          <div className="hidden sm:flex items-center space-x-1.5 bg-[#151618] border border-[#232427] px-2 py-1 rounded-lg text-xs font-mono">
            <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-[11px] font-bold text-[#F4F4F5]">Q3</span>
          </div>

          {/* Primary CTA Button (matching "+ Plus" in Image 1) */}
          <button
            onClick={() => navigate('/cases')}
            className="hidden sm:inline-flex items-center px-2.5 py-1 bg-[#00E676] hover:bg-[#00c864] text-black font-bold text-xs rounded-lg transition-all shadow-xs"
          >
            + Case
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
