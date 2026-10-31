
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FolderArchive,
  Clock,
  CheckCircle2,
  AlertTriangle,
  GitMerge,
  Layers,
  ChevronRight,
  Building2,
  RefreshCw,
} from 'lucide-react';

import { officerApi } from '../../../shared/api/officerApi';
import { dashboardApi } from '../../../api/client';
import { KpiCard } from '../../../shared/components/KpiCard';
import { OverlapBadge } from '../../../shared/components/OverlapBadge';
import { SkeletonLoader } from '../../../shared/components/SkeletonLoader';
import { MonthlyComplaintTrends } from '../../../components/dashboard/MonthlyComplaintTrends';

export function OfficerDashboardPage() {
  const navigate = useNavigate();

  const {
    data: summaryData,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['officer-summary'],
    queryFn: officerApi.getSummary,
  });

  const {
    data: workloadData,
    isLoading: workloadLoading,
    refetch: refetchWorkload,
  } = useQuery({
    queryKey: ['officer-bureau-workload'],
    queryFn: officerApi.getBureauWorkload,
  });

  const {
    data: institutionData,
    isLoading: instLoading,
    refetch: refetchInst,
  } = useQuery({
    queryKey: ['officer-institution-status'],
    queryFn: officerApi.getInstitutionStatus,
  });

  const {
    data: monthlyTrendsData,
    isLoading: monthlyTrendsLoading,
    refetch: refetchMonthlyTrends,
  } = useQuery({
    queryKey: ['dashboard-monthly-trends'],
    queryFn: dashboardApi.getMonthlyTrends,
  });

  const summary = summaryData?.data || {};
  const workload = workloadData?.data || [];
  const institutions = institutionData?.data || [];

  const monthlyTrends = (
    monthlyTrendsData?.data || []
  ).map((item) => ({
    month: item.month,
    received: Number(item.received) || 0,
    resolved: Number(item.resolved) || 0,
  }));

  const handleRefresh = () => {
    refetchSummary();
    refetchWorkload();
    refetchInst();
    refetchMonthlyTrends();
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Statutory Oversight Dashboard</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
              Live Feed
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time cross-bureau institutional complaint monitoring, overlap
            detection &amp; disposal analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#101D35] hover:bg-[#172846] border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => navigate('/officer/assignment-queue')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Assignment Queue</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {summaryLoading ? (
        <SkeletonLoader count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            label="Total Dockets Filed"
            value={summary.totalReceived ?? 0}
            icon={FolderArchive}
            sublabel="Across all AICTE bureaus"
            trend="neutral"
            variant="indigo"
          />

          <KpiCard
            label="Active Overlap Clusters"
            value={summary.activeOverlaps ?? 0}
            icon={GitMerge}
            sublabel="Multi-bureau institution overlaps"
            trend="down"
            variant="amber"
            onClick={() => navigate('/officer/overlaps')}
          />

          <KpiCard
            label="SLA Timeline Breached"
            value={summary.beyondTimeline ?? 0}
            icon={AlertTriangle}
            sublabel="Immediate escalation priority"
            trend="up"
            variant="rose"
            onClick={() => navigate('/officer/cases?status=escalated')}
          />

          <KpiCard
            label="Disposal Resolution Rate"
            value={summary.disposalRate || '0%'}
            icon={CheckCircle2}
            sublabel={`${summary.disposed || 0} total cases disposed`}
            trend="up"
            variant="teal"
          />
        </div>
      )}

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#101D35] border border-slate-700/80">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Unassigned / Pending
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {summary.pending ?? 0}
          </div>
          <div className="text-[10px] text-slate-300 mt-0.5">
            Awaiting bureau routing
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#101D35] border border-slate-700/80">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Under Process
          </div>
          <div className="text-xl font-bold text-blue-400 mt-1">
            {summary.underProcess ?? 0}
          </div>
          <div className="text-[10px] text-slate-300 mt-0.5">
            Active bureau enquiry
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#101D35] border border-slate-700/80">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Needs Student Info
          </div>
          <div className="text-xl font-bold text-[#F59E0B] mt-1">
            {summary.needsInfo ?? 0}
          </div>
          <div className="text-[10px] text-slate-300 mt-0.5">
            Awaiting complainant reply
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#101D35] border border-slate-700/80">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Escalated Cases
          </div>
          <div className="text-xl font-bold text-[#FF4D79] mt-1">
            {summary.escalated ?? 0}
          </div>
          <div className="text-[10px] text-slate-300 mt-0.5">
            Senior management attention
          </div>
        </div>
      </div>

      {/* Bureau Workload Distribution */}
      <div className="bg-[#101D35] border border-slate-700/80 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Bureau Workload Distribution
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Active complaints allocated per AICTE cell
          </span>
        </div>

        {workloadLoading ? (
          <SkeletonLoader count={3} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-700/80 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2.5 px-3">Bureau / Cell</th>
                  <th className="py-2.5 px-3 text-center">Pending</th>
                  <th className="py-2.5 px-3 text-center">In Progress</th>
                  <th className="py-2.5 px-3 text-center">Needs Info</th>
                  <th className="py-2.5 px-3 text-center">Disposed</th>
                  <th className="py-2.5 px-3 text-center font-bold text-white">
                    Total Load
                  </th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-700/60">
                {workload.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-[#172846] transition"
                  >
                    <td className="py-2.5 px-3 font-semibold text-white">
                      <div>{b.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {b.code} &bull; {b.type}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                      {b.pending}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-blue-400">
                      {b.under_process}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[#F59E0B]">
                      {b.needs_info}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-blue-400">
                      {b.disposed}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                      {b.total}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() =>
                          navigate(`/officer/cases?bureau=${b.id}`)
                        }
                        className="px-2 py-1 rounded-lg bg-[#101D35] hover:bg-[#172846] text-slate-300 hover:text-white border border-slate-700/80 text-[11px] font-medium transition cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monthly Complaint Trends */}
      {monthlyTrendsLoading ? (
        <div className="bg-[#101D35] border border-slate-700/80 rounded-2xl p-5">
          <SkeletonLoader count={3} />
        </div>
      ) : (
        <MonthlyComplaintTrends data={monthlyTrends} />
      )}

      {/* Top Institutions Status */}
      <div className="bg-[#101D35] border border-slate-700/80 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Top Institutions by Complaint Density
            </h2>
          </div>

          <button
            onClick={() => navigate('/officer/institutions')}
            className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View All Directory</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {instLoading ? (
          <SkeletonLoader count={3} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-700/80 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2.5 px-3">Institution Name</th>
                  <th className="py-2.5 px-3">Region</th>
                  <th className="py-2.5 px-3 text-center">Open Dockets</th>
                  <th className="py-2.5 px-3 text-center">Disposed</th>
                  <th className="py-2.5 px-3 text-center">
                    Cross-Bureau Overlap
                  </th>
                  <th className="py-2.5 px-3 text-right">Details</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-700/60">
                {institutions.slice(0, 7).map((inst) => (
                  <tr
                    key={inst.id}
                    className="hover:bg-[#172846] transition"
                  >
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-white truncate max-w-xs">
                        {inst.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ID: {inst.aicteId} &bull; {inst.city}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {inst.region}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                      {inst.openCases}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-blue-400">
                      {inst.disposedCases}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {inst.hasOverlap ? (
                        <OverlapBadge
                          severity={inst.overlapSeverity || 'high'}
                        />
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          &mdash;
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() =>
                          navigate(`/officer/institutions/${inst.id}`)
                        }
                        className="px-2 py-1 rounded-lg bg-[#101D35] hover:bg-[#172846] text-slate-300 hover:text-white border border-slate-700/80 text-[11px] font-medium transition cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default OfficerDashboardPage;
