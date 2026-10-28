
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Clock,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  FileText,
  Activity,
  Layers,
} from 'lucide-react';

import { bureauApi } from '../../../shared/api/bureauApi';
import { dashboardApi } from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { SkeletonLoader } from '../../../shared/components/SkeletonLoader';
import { MonthlyComplaintTrends } from '../../../components/dashboard/MonthlyComplaintTrends';

export function BureauDashboardPage() {
  const { getPortalAuth } = useAuth();
  const { user } = getPortalAuth('bureau');

  const { data: dashboardData, isLoading: dashLoading } = useQuery({
    queryKey: ['bureau', 'dashboard'],
    queryFn: () => bureauApi.getDashboard(),
  });

  const { data: casesData, isLoading: casesLoading } = useQuery({
    queryKey: ['bureau', 'recentCases'],
    queryFn: () => bureauApi.getCases({ limit: 6 }),
  });

  const {
    data: monthlyTrendsData,
    isLoading: monthlyTrendsLoading,
    refetch: refetchMonthlyTrends,
  } = useQuery({
    queryKey: ['dashboard-monthly-trends'],
    queryFn: dashboardApi.getMonthlyTrends,
  });

  const stats = dashboardData?.data || {
    assigned: 0,
    pending: 0,
    inProgress: 0,
    needsInfo: 0,
    disposed: 0,
    overdue: 0,
    dueSoon: 0,
    doneThisMonth: 0,
  };

  const recentCases = casesData?.data || [];

  const monthlyTrends = (monthlyTrendsData?.data || []).map((item) => ({
    month: item.month,
    received: Number(item.received) || 0,
    resolved: Number(item.resolved) || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Top Welcome / Header */}
      <div className="bg-[#101D35] border border-slate-700/80 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono font-semibold uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                {user?.role === 'data_operator'
                  ? 'Data Operator Portal'
                  : 'Bureau Officer Desk'}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-400 font-medium">
                {user?.bureau?.name || 'Operational Bureau'}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
              Welcome back, {user?.name || 'Officer'}
            </h1>

            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Manage grievances assigned to your bureau, track SLA deadlines,
              request applicant information, and process complaints to disposal.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/bureau/attention"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#FF4D79]/15 text-[#FF4D79] border border-[#FF4D79]/30 hover:bg-[#FF4D79]/25 transition-all shadow-sm"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>
                Needs Attention ({stats.overdue + stats.dueSoon})
              </span>
            </Link>

            <Link
              to="/bureau/cases"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 text-slate-100 hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
            >
              <Briefcase className="w-4 h-4" />
              <span>View All Assigned</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#101D35] border border-slate-700/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total Active Assigned
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-300 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-100">
              {dashLoading ? <SkeletonLoader className="h-8 w-16" /> : stats.assigned}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <span>{stats.pending} pending review</span>
              <span>•</span>
              <span>{stats.inProgress} in progress</span>
            </div>
          </div>
        </div>

        <div className="bg-[#101D35] border border-slate-700/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">
              Needs Info
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-[#F59E0B]">
              {dashLoading ? <SkeletonLoader className="h-8 w-16" /> : stats.needsInfo}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Awaiting replies from applicants
            </div>
          </div>
        </div>

        <div className="bg-[#101D35] border border-slate-700/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">
              Overdue SLA
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#FF4D79]/10 text-[#FF4D79] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-[#FF4D79]">
              {dashLoading ? <SkeletonLoader className="h-8 w-16" /> : stats.overdue}
            </div>
            <div className="text-[11px] text-[#FF4D79]/80 mt-1">
              Immediate escalation risk
            </div>
          </div>
        </div>

        <div className="bg-[#101D35] border border-slate-700/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">
              Done This Month
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#00E676]/10 text-[#00E676] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-[#00E676]">
              {dashLoading ? <SkeletonLoader className="h-8 w-16" /> : stats.doneThisMonth}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Disposed &amp; resolved cases
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#101D35] border border-slate-700/80 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Due within 72h</div>
              <div className="text-lg font-bold text-slate-100">
                {stats.dueSoon} cases
              </div>
            </div>
          </div>
          <Link to="/bureau/attention" className="text-xs text-blue-300 hover:underline flex items-center gap-1">
            Review <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-[#101D35] border border-slate-700/80 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00E676]/10 text-[#00E676] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Total Resolved (All-time)</div>
              <div className="text-lg font-bold text-slate-100">
                {stats.disposed} cases
              </div>
            </div>
          </div>
          <Link to="/bureau/cases?status=disposed" className="text-xs text-[#00E676] hover:underline flex items-center gap-1">
            History <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-[#101D35] border border-slate-700/80 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-300 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-slate-400">Cross-Bureau Overlaps</div>
              <div className="text-lg font-bold text-slate-100">Active Clusters</div>
            </div>
          </div>
          <Link to="/bureau/overlaps" className="text-xs text-blue-300 hover:underline flex items-center gap-1">
            View <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Monthly Complaint Trends */}
      {monthlyTrendsLoading ? (
        <div className="bg-[#101D35] border border-slate-700/80 rounded-2xl p-5">
          <SkeletonLoader count={3} />
        </div>
      ) : (
        <MonthlyComplaintTrends data={monthlyTrends} />
      )}

      {/* Recent Assigned Cases Table */}
      <div className="bg-[#101D35] border border-slate-700/80 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-blue-300" />
            <h2 className="text-sm font-bold text-slate-100">
              Recently Updated Bureau Cases
            </h2>
          </div>
          <Link
            to="/bureau/cases"
            className="text-xs font-semibold text-blue-300 hover:text-blue-200 flex items-center gap-1.5 transition-colors"
          >
            <span>Open All Bureau Cases</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {casesLoading ? (
          <div className="p-6 space-y-3">
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
          </div>
        ) : recentCases.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3 opacity-40" />
            <p className="text-sm text-slate-400 font-medium">
              No cases currently assigned to your bureau.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Cases assigned by officers will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/80 bg-[#0B1730]/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Case Ref</th>
                  <th className="py-3 px-4">Institution</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SLA Deadline</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2023] text-xs">
                {recentCases.map((c) => {
                  const isOverdue =
                    c.expectedDisposalDate &&
                    new Date(c.expectedDisposalDate) < new Date() &&
                    !['disposed', 'rejected'].includes(c.status);

                  return (
                    <tr key={c._id} className="hover:bg-[#172846] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-100">
                        <Link
                          to={`/bureau/cases/${c._id}`}
                          className="hover:text-blue-300"
                        >
                          {c.sourceCaseRef || c._id.slice(-8)}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 max-w-[220px] truncate text-slate-100">
                        {c.institution?.name ||
                          c.rawInstitutionName ||
                          'Unknown Institution'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {c.category || 'General'}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={c.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4">
                        {c.expectedDisposalDate ? (
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                              isOverdue
                                ? 'text-[#FF4D79] font-bold'
                                : 'text-slate-400'
                            }`}
                          >
                            {isOverdue && (
                              <AlertTriangle className="w-3 h-3" />
                            )}
                            {new Date(c.expectedDisposalDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/bureau/cases/${c._id}`}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#172846] hover:bg-[#203554] text-slate-100 transition-colors"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default BureauDashboardPage;
