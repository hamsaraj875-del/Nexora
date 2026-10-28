import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  FolderArchive, 
  Clock, 
  Hourglass, 
  CheckCircle2, 
  ArrowRightLeft, 
  AlertTriangle, 
  AlertOctagon, 
  ShieldAlert, 
  Sparkles, 
  Activity, 
  DownloadCloud, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Layers, 
  ChevronRight,
  Pin,
  Plus,
  ArrowUpRight,
  ClipboardList,
  Check,
  TrendingUp,
  FileText,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { dashboardApi, reportsApi, overlapsApi, casesApi } from '../api/client';
import { KpiCard } from '../components/common/KpiCard';
import { BureauBadge } from '../components/common/BureauBadge';
import { SlaIndicator } from '../components/common/SlaIndicator';
import { OverlapBadge } from '../components/common/OverlapBadge';
import { SectionHeader } from '../components/common/SectionHeader';
import { BureauWorkloadChart } from '../components/dashboard/BureauWorkloadChart';

function MonthlyComplaintTrends({ data = [] }) {
  return (
    <section className="rounded-2xl border border-[#232427] bg-[#151618] p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Monthly Complaint Trends
        </h2>
        <p className="text-sm text-slate-500">
          Complaints received vs. resolved over the last 6 months
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="received"
            name="Received"
            stroke="#0f766e"
            strokeWidth={3}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="resolved"
            name="Resolved"
            stroke="#6366f1"
            strokeWidth={3}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}
export const DashboardPage = () => {
  const { selectedDateRange, triggerRefresh, isRefreshing } = useApp();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  // Tasks state for Daily Tasks card
  const [tasks, setTasks] = useState([]);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  // Queries
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardApi.getSummary,
  });

  const workloadQuery = useQuery({
    queryKey: ['dashboard-bureau-workload'],
    queryFn: dashboardApi.getBureauWorkload,
  });

  const monthlyTrendsQuery = useQuery({
    queryKey: ['dashboard-monthly-trends'],
    queryFn: dashboardApi.getMonthlyTrends,
  });
  const regionsQuery = useQuery({
    queryKey: ['dashboard-regions'],
    queryFn: () => reportsApi.getReportData('region'),
  });

  const ageingQuery = useQuery({
    queryKey: ['dashboard-ageing'],
    queryFn: () => reportsApi.getReportData('ageing'),
  });

  const overlapsQuery = useQuery({
    queryKey: ['dashboard-overlaps'],
    queryFn: () => overlapsApi.getOverlaps({ status: 'open' }),
  });

  const casesQuery = useQuery({
    queryKey: ['dashboard-recent-cases'],
    queryFn: () => casesApi.getCases({ limit: 40 }),
  });

  const isLoading = summaryQuery.isLoading || workloadQuery.isLoading;
  const isError = summaryQuery.isError || workloadQuery.isError;
  const errorMessage = summaryQuery.error?.message || workloadQuery.error?.message || 'Error connecting to central backend service.';

  const handleManualRefresh = async () => {
    await Promise.all([
      summaryQuery.refetch(),
      workloadQuery.refetch(),
      regionsQuery.refetch(),
      ageingQuery.refetch(),
      overlapsQuery.refetch(),
      casesQuery.refetch(),
      triggerRefresh(),
      monthlyTrendsQuery.refetch(),
    ]);
  };

  // Greeting logic
  const hour = new Date().getHours();
  const greetingTime = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const userName = currentUser?.name || 'Dr. Ramesh';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-8 text-[#71717A] bg-[#0F1011] rounded-panel border border-[#232427]">
        <Loader2 className="w-9 h-9 animate-spin text-[#00E676] mb-3" />
        <p className="text-sm font-semibold text-[#F4F4F5]">Loading AICTE Complaint Monitoring Dashboard...</p>
        <p className="text-xs text-[#71717A] mt-1">Synchronizing live bureau workload, SLA status, and overlap groups</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 bg-[#151618] border border-[#FF4D79]/30 rounded-panel text-center max-w-2xl mx-auto my-12 text-[#F4F4F5]">
        <AlertCircle className="w-10 h-10 text-[#FF4D79] mx-auto mb-3" />
        <h3 className="text-base font-bold text-[#F4F4F5]">Dashboard Unavailable</h3>
        <p className="text-xs text-[#FF4D79] mt-1">{errorMessage}</p>
        <p className="text-xs text-[#71717A] mt-2">Could not retrieve live metrics from backend.</p>
        <button
          onClick={handleManualRefresh}
          className="mt-4 px-4 py-2 bg-[#FF4D79] hover:bg-[#FF4D79]/80 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  // Summary Metrics
  const summary = summaryQuery.data?.data || {};
  const totalCases = summary.totalReceived || 0;
  const pendingCases = summary.pending || 0;
  const underProcessCases = summary.underProcess || 0;
  const disposedCases = summary.disposed || 0;
  const transferredCases = summary.transferred || 0;
  const escalatedCases = summary.escalated || 0;
  const beyondTimelineCases = summary.beyondTimeline || 0;

  // Donut chart status breakdown (Status Allocation Donut)
  const statusPieData = [
    { name: 'Pending', value: pendingCases, color: '#8A99B5' },
    { name: 'Under Process', value: underProcessCases, color: '#6C7BFF' },
    { name: 'Disposed', value: disposedCases, color: '#19D3A2' },
    { name: 'Transferred', value: transferredCases, color: '#B07CFF' },
    { name: 'Escalated', value: escalatedCases, color: '#FF4D79' },
  ];

  // Bureau Workload formatted for BureauWorkloadChart
  const rawWorkload = workloadQuery.data?.data || [];
  const monthlyTrends = (monthlyTrendsQuery.data?.data || []).map((item) => ({
    month: item.month,
    received: item.received,
    resolved: item.resolved,
  }));
  const bureauChartData = rawWorkload.map((b) => ({
    code: b.code || b.name,
    name: b.name,
    pending: b.pending || 0,
    process: b.under_process || 0,
    disposed: b.disposed || 0,
    transferred: b.transferred || 0,
    escalated: b.escalated || 0,
    total: b.total || 0,
  }));

  // Regional Distribution
  const rawRegions = regionsQuery.data?.data || [];
  const regionalChartData = rawRegions.map((r) => ({
    region: r._id || 'General',
    cases: r.totalCases || 0,
    pending: r.pendingCases || 0,
    disposed: r.disposedCases || 0,
    escalated: r.escalatedCases || 0,
  }));

  // Ageing Breakdown
  const ageingData = ageingQuery.data?.data?.summary || [];
  const ageingChartData = ageingData.map((a) => ({
    bucket: a.name,
    count: a.count,
  }));

  // Cases and Deadlines
  const recentCasesList = casesQuery.data?.data || [];
  const upcomingDeadlines = recentCasesList
    .filter((c) => c.status !== 'disposed' && c.expectedDisposalDate)
    .sort((a, b) => new Date(a.expectedDisposalDate).getTime() - new Date(b.expectedDisposalDate).getTime())
    .slice(0, 5);

  const priorityCase = upcomingDeadlines[0] || recentCasesList[0] || null;

  // Active Overlaps
  const activeOverlaps = (overlapsQuery.data?.data || []).slice(0, 4);

  const handleExportSummary = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      'Metric,Count\n' +
      `Total Received,${totalCases}\n` +
      `Pending,${pendingCases}\n` +
      `Under Process,${underProcessCases}\n` +
      `Disposed,${disposedCases}\n` +
      `Transferred,${transferredCases}\n` +
      `Escalated,${escalatedCases}\n` +
      `Beyond Timeline,${beyondTimelineCases}\n` +
      `Disposal Rate,${summary.disposalRate || '0%'}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AICTE_Nexora_Executive_Summary_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: newTaskText.trim(), completed: false }]);
    setNewTaskText('');
    setShowAddTaskModal(false);
  };

  return (
    <div className="flex gap-2 sm:gap-2.5 h-full w-full overflow-hidden select-none-off">
      {/* 1. Large Main Content Panel (Scrolls independently) */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[#0F1011] border border-[#232427] rounded-panel p-4 sm:p-6 space-y-6">
        {/* Top Greeting Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#F4F4F5] tracking-tight font-sans">
              {greetingTime}, {userName}
            </h1>
            <p className="text-xs sm:text-sm text-[#71717A] mt-0.5">
              One consolidated intelligence feed for regulatory compliance & statutory dispute resolution.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs text-[#71717A]">
            <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
            <span className="font-mono text-[11px] text-[#A1A1AA]">Central Registry Online</span>
          </div>
        </div>

        {/* Pin your subjects / Quick Access Row (Image 1 style) */}
        <div>
          <div className="flex items-center space-x-1.5 text-xs text-[#A1A1AA] font-medium mb-2.5">
            <Pin className="w-3.5 h-3.5 text-[#71717A]" />
            <span>Pinned operational desks</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <div 
              onClick={() => navigate('/cases?bureau=Regulation%20Bureau')}
              className="bg-[#151618] hover:bg-[#1A1B1E] border border-[#232427] hover:border-[#2D2E32] rounded-xl px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-all duration-150"
            >
              <div className="w-8 h-8 rounded-lg bg-[#6C7BFF]/15 text-[#6C7BFF] flex items-center justify-center font-bold text-xs">
                RB
              </div>
              <div>
                <span className="text-xs font-semibold text-[#F4F4F5] block">Regulation Bureau</span>
                <span className="text-[10px] text-[#71717A]">Statutory Compliance</span>
              </div>
            </div>

            <div 
              onClick={() => navigate('/cases?bureau=Approval%20Bureau')}
              className="bg-[#151618] hover:bg-[#1A1B1E] border border-[#232427] hover:border-[#2D2E32] rounded-xl px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-all duration-150"
            >
              <div className="w-8 h-8 rounded-lg bg-[#00E676]/15 text-[#00E676] flex items-center justify-center font-bold text-xs">
                AB
              </div>
              <div>
                <span className="text-xs font-semibold text-[#F4F4F5] block">Approval Bureau</span>
                <span className="text-[10px] text-[#71717A]">Campus Accreditations</span>
              </div>
            </div>

            <div 
              onClick={() => navigate('/cases?bureau=Public%20Grievance')}
              className="bg-[#151618] hover:bg-[#1A1B1E] border border-[#232427] hover:border-[#2D2E32] rounded-xl px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-all duration-150"
            >
              <div className="w-8 h-8 rounded-lg bg-[#B07CFF]/15 text-[#B07CFF] flex items-center justify-center font-bold text-xs">
                PGRC
              </div>
              <div>
                <span className="text-xs font-semibold text-[#F4F4F5] block">Grievance Cell</span>
                <span className="text-[10px] text-[#71717A]">Petitions & Disputes</span>
              </div>
            </div>

            {/* Dashed Add Card */}
            <button 
              onClick={() => navigate('/cases')}
              className="border border-dashed border-[#232427] hover:border-[#71717A] bg-[#151618]/40 hover:bg-[#151618] rounded-xl px-4 py-2.5 flex items-center justify-center gap-1.5 text-xs text-[#71717A] hover:text-[#F4F4F5] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Pin View</span>
            </button>
          </div>
        </div>

        {/* PLANLY-style Action Card (Image 1 style) */}
        <div 
          className="relative overflow-hidden bg-[#151618] border border-[#232427] rounded-card p-5 sm:p-6 transition-all"
          style={{ 
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', 
            backgroundSize: '18px 18px' 
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#00E676]/15 text-[#00E676] border border-[#00E676]/30 mb-2">
                <Sparkles className="w-3 h-3" />
                AICTE STATUTORY DIRECTIVES
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-[#F4F4F5] leading-snug tracking-tight">
                Enforce regulatory timelines and coordinate multi-bureau dispute resolution.
              </h2>
              <p className="text-xs text-[#71717A] mt-1">
                Statutory SLA window: <span className="text-[#A1A1AA] font-mono">{selectedDateRange}</span>. Ensure cross-bureau overlap hearings precede individual determinations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                onClick={handleExportSummary}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-[#F4F4F5] bg-[#151618] hover:bg-[#1A1B1E] rounded-lg transition-colors border border-[#232427]"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-[#71717A]" />
                <span>Executive CSV</span>
              </button>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-black bg-[#00E676] hover:bg-[#00c864] rounded-lg transition-all shadow-xs"
              >
                <Activity className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Synchronize Feeds &rarr;</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section Header: Case Overview */}
        <SectionHeader 
          title="Case Overview" 
          action={
            <button 
              onClick={() => navigate('/cases')} 
              className="text-[11px] font-medium text-[#71717A] hover:text-[#00E676] transition-colors"
            >
              All Dockets &rarr;
            </button>
          } 
        />

        {/* KPI Row: 7 Cards with 2px Colored Top Accent */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          <KpiCard
            label="Total Dockets"
            value={totalCases}
            sublabel="All registered cases"
            icon={FolderArchive}
            variant="default"
            onClick={() => navigate('/cases')}
          />
          <KpiCard
            label="Pending Triage"
            value={pendingCases}
            sublabel="Awaiting initial review"
            icon={Clock}
            variant="pending"
            onClick={() => navigate('/cases?status=pending')}
          />
          <KpiCard
            label="Under Process"
            value={underProcessCases}
            sublabel="Active investigation"
            icon={Hourglass}
            variant="process"
            onClick={() => navigate('/cases?status=under_process')}
          />
          <KpiCard
            label="Disposed"
            value={disposedCases}
            sublabel="Statutory order issued"
            icon={CheckCircle2}
            variant="disposed"
            trend={{ value: `${summary.disposalRate || '0%'} rate`, isUpward: true, isGood: true }}
            onClick={() => navigate('/cases?status=disposed')}
          />
          <KpiCard
            label="Transferred"
            value={transferredCases}
            sublabel="Inter-bureau routed"
            icon={ArrowRightLeft}
            variant="transferred"
            onClick={() => navigate('/cases?status=transferred')}
          />
          <KpiCard
            label="Escalated"
            value={escalatedCases}
            sublabel="Elevated to Council"
            icon={AlertTriangle}
            variant="escalated"
            onClick={() => navigate('/cases?status=escalated')}
          />
          <KpiCard
            label="Beyond SLA"
            value={beyondTimelineCases}
            sublabel="Timeline exceeded"
            icon={AlertOctagon}
            variant="danger"
            onClick={() => navigate('/cases?sla=overdue')}
          />
        </div>

        {/* Section Header: Bureau Caseload Distribution */}
        <SectionHeader title="Bureau & Cell Distribution" />

        {/* Bureau & Cell Stacked Bar Chart */}
        <div>
          <BureauWorkloadChart data={bureauChartData} isLoading={workloadQuery.isLoading} />
        </div>
          <SectionHeader title="Monthly Complaint Trends" />
          <MonthlyComplaintTrends data={monthlyTrends} />
        {/* Section Header: Regional & Ageing Analytics */}
        <SectionHeader title="Regional Load & Ageing Compliance" />

        {/* Regional Load & Case Ageing Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Regional Caseload Distribution */}
          <div className="lg:col-span-6 bg-[#151618] p-5 rounded-card border border-[#232427] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[#232427]">
              <div>
                <h3 className="text-sm font-bold text-[#F4F4F5] font-sans">Regional Caseload Distribution</h3>
                <p className="text-xs text-[#71717A]">Distribution across administrative council zones</p>
              </div>
              <span className="text-[10px] text-[#00E676] bg-[#00E676]/10 border border-[#00E676]/30 px-2 py-0.5 rounded font-mono font-medium">
                Live Aggregation
              </span>
            </div>

            <div className="h-64 mt-3">
              {regionalChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={regionalChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1B1C20" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#71717A' }} axisLine={{ stroke: '#232427' }} />
                    <YAxis dataKey="region" type="category" tick={{ fontSize: 11, fill: '#71717A', fontWeight: 500 }} axisLine={{ stroke: '#232427' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F1011',
                        borderColor: '#232427',
                        borderRadius: '12px',
                        color: '#F4F4F5',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="cases" name="Total Complaints" fill="#19D3A2" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="pending" name="Open Complaints" fill="#6C7BFF" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[#71717A]">
                  No regional data available.
                </div>
              )}
            </div>
          </div>

          {/* Complaint Ageing Breakdown */}
          <div className="lg:col-span-6 bg-[#151618] p-5 rounded-card border border-[#232427] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[#232427]">
              <div>
                <h3 className="text-sm font-bold text-[#F4F4F5] font-sans">Case Ageing & SLA Compliance</h3>
                <p className="text-xs text-[#71717A]">Classification of pending inquiries by duration</p>
              </div>
              <div className="flex items-center space-x-1 text-xs font-semibold text-[#19D3A2] bg-[#19D3A2]/10 border border-[#19D3A2]/30 px-2 py-0.5 rounded font-mono">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Disposal: {summary.disposalRate || '0%'}</span>
              </div>
            </div>

            <div className="h-64 mt-3">
              {ageingChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ageingChartData}
                    margin={{ top: 10, right: 15, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1B1C20" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#71717A', fontWeight: 500 }} axisLine={{ stroke: '#232427' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#71717A' }} axisLine={{ stroke: '#232427' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F1011',
                        borderColor: '#232427',
                        borderRadius: '12px',
                        color: '#F4F4F5',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" name="Open Inquiries" fill="#6C7BFF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[#71717A]">
                  No ageing data recorded.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section Header: Priority Cross-Bureau Overlaps */}
        <SectionHeader 
          title="Priority Cross-Bureau Overlaps" 
          action={
            <button 
              onClick={() => navigate('/overlaps')} 
              className="text-[11px] font-medium text-[#71717A] hover:text-[#00E676] transition-colors"
            >
              Overlap Centre &rarr;
            </button>
          } 
        />

        {/* Cross-Bureau Overlap Queue */}
        <div className="bg-[#151618] rounded-card border border-[#232427] p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#232427]">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-[#B07CFF]/15 text-[#B07CFF] rounded-lg border border-[#B07CFF]/30">
                <ShieldAlert className="w-4 h-4 text-[#B07CFF]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#F4F4F5] font-sans">Cross-Bureau Overlap Queue</h3>
                <p className="text-xs text-[#71717A]">Concurrent investigations across multiple bureau dockets</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-[#232427] mt-2">
            {activeOverlaps.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#71717A]">
                No active cross-bureau overlap groups detected.
              </div>
            ) : (
              activeOverlaps.map((ov) => {
                const instName = ov.institution?.name || 'Institutional Case Group';
                const permId = ov.institution?.aictePermanentId || 'AICTE-RECORD';
                const bureausList = (ov.cases || [])
                  .map((c) => c.currentBureau?.name || c.currentBureau?.code)
                  .filter(Boolean);
                const distinctBureaus = Array.from(new Set(bureausList));

                return (
                  <div key={ov._id} className="py-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-[#B07CFF] bg-[#B07CFF]/10 px-2 py-0.5 rounded border border-[#B07CFF]/30">
                            {ov._id.substring(ov._id.length - 8).toUpperCase()}
                          </span>
                          <span className="text-xs font-bold text-[#F4F4F5]">{instName}</span>
                        </div>
                        <p className="text-[11px] text-[#71717A] mt-0.5">
                          Permanent ID: <span className="font-mono font-medium text-[#A1A1AA]">{permId}</span>
                        </p>
                      </div>
                      <OverlapBadge severity={ov.severity} />
                    </div>

                    <p className="text-xs text-[#A1A1AA] line-clamp-2 bg-[#0F1011] p-2.5 rounded-lg border border-[#232427]">
                      {ov.resolutionRemarks || `Institution has ${ov.cases?.length || 0} active cases across ${distinctBureaus.length} different bureau dockets.`}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-semibold text-[#71717A]">Involved:</span>
                        <div className="flex flex-wrap gap-1">
                          {distinctBureaus.map((b) => (
                            <BureauBadge key={b} bureau={b} showCodeOnly />
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-[11px] text-[#71717A]">
                          Updated: {ov.updatedAt ? new Date(ov.updatedAt).toLocaleDateString() : 'Recent'}
                        </span>
                        <button
                          onClick={() => navigate('/overlaps')}
                          className="px-2.5 py-1 text-xs font-semibold text-[#B07CFF] bg-[#B07CFF]/10 hover:bg-[#B07CFF]/20 rounded border border-[#B07CFF]/30 transition-colors"
                        >
                          Coordinate Overlap &rarr;
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Mobile / Below-XL Right Rail Fallback */}
        <div className="xl:hidden pt-4 space-y-4">
          <SectionHeader title="Priority Allocation & Tasks" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Allocation for mobile */}
            <div className="bg-[#151618] p-5 rounded-card border border-[#232427]">
              <h4 className="text-sm font-bold text-[#F4F4F5]">Status Allocation ({totalCases} Total)</h4>
              <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                {statusPieData.map((item) => (
                  <div key={item.name} className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[#A1A1AA] text-[11px]">{item.name}:</span>
                    <span className="font-mono font-bold text-[#F4F4F5] ml-auto text-[11px]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Purple Alert card for mobile */}
            <div className="bg-gradient-to-br from-[#2E1065] via-[#3B0764] to-[#1E1B4B] border border-[#581C87] rounded-card p-5 text-white">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#E9D5FF]">Statutory SLA Alert</span>
              <h4 className="text-xl font-extrabold mt-1">{beyondTimelineCases} Cases Beyond SLA</h4>
              <button
                onClick={() => navigate('/cases?sla=overdue')}
                className="mt-3 w-full py-2 bg-[#00E676] hover:bg-[#00c864] text-black font-bold text-xs rounded-lg transition-colors"
              >
                Review SLA Breaches &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Right Rail of Stacked Widget Cards (~310px, Image 1 style) */}
      <div className="w-[310px] shrink-0 hidden xl:flex flex-col gap-2.5 h-full overflow-y-auto pr-0.5">
        {/* Widget 1: Status Allocation Donut Card (Thin ring, total in center, carousel dots) */}
        <div className="bg-[#0F1011] border border-[#232427] rounded-panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-[#232427]">
            <h3 className="text-xs font-bold text-[#F4F4F5] uppercase tracking-wider">Status Allocation</h3>
            <span className="text-[10px] font-mono font-bold text-[#A1A1AA] bg-[#151618] px-2 py-0.5 rounded border border-[#232427]">
              {totalCases} Cases
            </span>
          </div>

          {/* Thin Donut Chart */}
          <div className="h-44 relative my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="#0F1011"
                  strokeWidth={2}
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#0F1011',
                    borderColor: '#232427',
                    borderRadius: '10px',
                    color: '#F4F4F5',
                    fontSize: '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold font-mono text-[#F4F4F5] leading-none">{totalCases}</span>
              <span className="text-[9px] text-[#71717A] font-semibold uppercase tracking-wider mt-1">Total Cases</span>
            </div>
          </div>

          {/* Legend rows */}
          <div className="space-y-1.5 text-xs border-t border-[#232427] pt-2.5">
            {statusPieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[#A1A1AA]">{item.name}</span>
                </div>
                <span className="font-mono font-bold text-[#F4F4F5]">
                  {item.value} <span className="text-[#71717A] font-normal text-[10px]">({totalCases > 0 ? Math.round((item.value / totalCases) * 100) : 0}%)</span>
                </span>
              </div>
            ))}
          </div>

          {/* Carousel dots at bottom (Image 1 style) */}
          <div className="flex items-center justify-center space-x-1.5 pt-3">
            <span className="w-4 h-1 rounded-full bg-[#00E676]" />
            <span className="w-1.5 h-1 rounded-full bg-[#232427]" />
            <span className="w-1.5 h-1 rounded-full bg-[#232427]" />
          </div>
        </div>

        {/* Widget 2: Highlighted Alert Card (FRI45 SALE style) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#2E1065] via-[#3B0764] to-[#1E1B4B] border border-[#581C87] rounded-panel p-4 text-white shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#D8B4FE] block">
                STATUTORY DEADLINE
              </span>
              <h3 className="text-lg font-extrabold text-[#F4F4F5] mt-0.5 tracking-tight leading-tight">
                {beyondTimelineCases} Cases Beyond Timeline
              </h3>
              <p className="text-[11px] text-[#E9D5FF]/80 mt-1">
                Breaches mandatory AICTE Council resolution window.
              </p>
            </div>

            {/* Ticket / Calendar Badge */}
            <div className="bg-[#581C87]/80 border border-[#A855F7]/40 rounded-xl px-2.5 py-1.5 text-center shrink-0 shadow-inner">
              <Calendar className="w-3.5 h-3.5 text-[#E9D5FF] mx-auto mb-0.5" />
              <span className="block font-mono text-[9px] uppercase tracking-wider text-[#D8B4FE]">SLA</span>
              <span className="block font-mono font-bold text-xs text-white">OCT 23</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/cases?sla=overdue')}
            className="mt-3.5 w-full py-2 px-3 bg-[#00E676] hover:bg-[#00c864] text-black font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>Review SLA Breaches</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Widget 3: Priority Case of the Day Mini Card (Image 1 style Problem of the Day) */}
        <div className="bg-[#0F1011] border border-[#232427] rounded-panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-[#232427]">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-[#F4F4F5]">Priority Case of the Day</span>
              <ArrowUpRight className="w-3 h-3 text-[#71717A]" />
            </div>
            <span className="px-2 py-0.5 bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 rounded text-[10px] font-mono font-bold">
              CRITICAL
            </span>
          </div>

          {priorityCase ? (
            <div className="py-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-[#F4F4F5]">{priorityCase.caseId}</span>
                <span className="text-[10px] text-[#71717A] font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#FF5C5C]" />
                  Due Today
                </span>
              </div>
              <p className="text-xs text-[#A1A1AA] line-clamp-2">
                {priorityCase.institution?.name || priorityCase.rawInstitutionName || 'Urgent Institutional Dispute'}
              </p>
              <div className="pt-1 flex items-center justify-between text-[11px] text-[#71717A]">
                <span>{priorityCase.currentBureau?.code || 'Central Registry'}</span>
                <span className="text-[10px] text-[#19D3A2]">High SLA Impact</span>
              </div>
              <button
                onClick={() => navigate(`/cases/${encodeURIComponent(priorityCase._id)}`)}
                className="mt-2 w-full py-1.5 bg-[#151618] hover:bg-[#1A1B1E] text-[#F4F4F5] border border-[#232427] rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <span>Review Case Dossier</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#71717A]" />
              </button>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-[#71717A]">
              No high-priority cases pending review today.
            </div>
          )}
        </div>

        {/* Widget 4: Daily Tasks / Coordination Card (Image 1 style Daily Planner) */}
        <div className="bg-[#0F1011] border border-[#232427] rounded-panel p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-[#232427]">
            <h3 className="text-xs font-bold text-[#F4F4F5] uppercase tracking-wider">Daily Coordination Tasks</h3>
            <span className="text-[10px] text-[#71717A] font-mono">{tasks.length} active</span>
          </div>

          {tasks.length === 0 ? (
            /* Empty state (matching Image 1 empty state) */
            <div className="py-5 text-center flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-[#151618] border border-[#232427] flex items-center justify-center text-[#71717A] mb-2">
                <ClipboardList className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-semibold text-[#F4F4F5]">No tasks for today</h4>
              <p className="text-[11px] text-[#71717A] mt-0.5 max-w-[200px]">
                Add your tasks to see your daily coordination plan here.
              </p>
            </div>
          ) : (
            <div className="py-2 space-y-1.5 max-h-36 overflow-y-auto">
              {tasks.map((task) => (
                <div 
                  key={task.id} 
                  onClick={() => setTasks(tasks.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))}
                  className="p-2 bg-[#151618] hover:bg-[#1A1B1E] border border-[#232427] rounded-lg text-xs flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${task.completed ? 'bg-[#00E676] border-[#00E676] text-black' : 'border-[#71717A]'}`}>
                    {task.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className={`text-[11px] truncate ${task.completed ? 'line-through text-[#71717A]' : 'text-[#F4F4F5]'}`}>
                    {task.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Add tasks dashed button */}
          <button
            onClick={() => setShowAddTaskModal(true)}
            className="w-full py-1.5 border border-dashed border-[#232427] hover:border-[#71717A] rounded-lg text-xs text-[#71717A] hover:text-[#F4F4F5] transition-colors flex items-center justify-center gap-1.5 mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add task</span>
          </button>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F1011] border border-[#232427] rounded-2xl p-5 w-full max-w-sm text-[#F4F4F5] shadow-2xl">
            <h3 className="text-sm font-bold text-[#F4F4F5]">Add Daily Task</h3>
            <p className="text-xs text-[#71717A] mt-0.5">Quick reminder for today's complaint monitoring agenda.</p>
            <form onSubmit={handleAddTask} className="mt-3 space-y-3">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="e.g. Follow up on Regulation Bureau overlap"
                className="w-full bg-[#151618] border border-[#232427] rounded-lg px-3 py-2 text-xs text-[#F4F4F5] placeholder-[#71717A] focus:outline-none focus:border-[#00E676]"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="px-3 py-1.5 text-xs text-[#71717A] hover:text-[#F4F4F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#00E676] hover:bg-[#00c864] text-black font-bold text-xs rounded-lg transition-colors"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
