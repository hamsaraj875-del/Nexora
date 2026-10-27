import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitMerge,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  Building2,
  Clock,
  X,
} from 'lucide-react';
import { officerApi } from '../../../shared/api/officerApi';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { BureauBadge } from '../../../shared/components/BureauBadge';
import { OverlapBadge } from '../../../shared/components/OverlapBadge';
import { SkeletonLoader } from '../../../shared/components/SkeletonLoader';

export function OfficerOverlapsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedOverlapId, setSelectedOverlapId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('open');
  const [resolveModal, setResolveModal] = useState(false);
  const [resolutionStatus, setResolutionStatus] = useState('coordinated');
  const [remarks, setRemarks] = useState('');
  const [resolveError, setResolveError] = useState('');

  const params = filterStatus !== 'all' ? { status: filterStatus } : {};

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['officer-overlaps', params],
    queryFn: () => officerApi.getOverlaps(params),
  });

  const overlaps = data?.data || [];
  const selectedGroup = overlaps.find((o) => o._id === (selectedOverlapId || overlaps[0]?._id)) || overlaps[0];
  const groupCases = selectedGroup?.cases || [];

  const resolveMutation = useMutation({
    mutationFn: ({ id, data }) => officerApi.resolveOverlap(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['officer-overlaps']);
      setResolveModal(false);
      setRemarks('');
      setResolveError('');
      refetch();
    },
    onError: (err) => {
      setResolveError(err?.response?.data?.message || err?.message || 'Resolution failed');
    },
  });

  const handleOpenResolve = (statusVal) => {
    setResolutionStatus(statusVal);
    setRemarks(
      statusVal === 'coordinated'
        ? 'Cross-bureau inquiry consolidated. Regulatory Bureau appointed as lead cell.'
        : 'Overlap reviewed and dismissed. Separate unrelated grounds.'
    );
    setResolveError('');
    setResolveModal(true);
  };

  const handleResolveSubmit = (e) => {
    e.preventDefault();
    if (!selectedGroup) return;
    resolveMutation.mutate({
      id: selectedGroup._id,
      data: { status: resolutionStatus, remarks },
    });
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Statutory Overlap Coordination Centre</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {overlaps.length} Clusters
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Identify institutions with concurrent cases across multiple AICTE cells to prevent contradictory orders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-[#0B1730] border border-slate-700/80 p-0.5 text-xs">
            {['open', 'coordinated', 'dismissed', 'all'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-md capitalize font-medium transition cursor-pointer ${
                  filterStatus === st ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg bg-[#101D35] hover:bg-[#172846] border border-slate-700/80 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      {isLoading ? (
        <div className="p-4">
          <SkeletonLoader count={6} />
        </div>
      ) : overlaps.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0B1730] border border-slate-700/80 rounded-2xl">
          <GitMerge className="w-12 h-12 text-slate-500 mb-2" />
          <h3 className="text-base font-bold text-white">No Overlaps in this filter</h3>
          <p className="text-xs text-slate-400 mt-1">Select another filter status or check back as complaints arrive.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Panel: Overlap Clusters List */}
          <div className="lg:col-span-5 bg-[#0B1730] border border-slate-700/80 rounded-2xl p-3 flex flex-col overflow-hidden">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 mb-2">
              Overlap Groups ({overlaps.length})
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {overlaps.map((ov) => {
                const isSelected = ov._id === selectedGroup?._id;
                return (
                  <div
                    key={ov._id}
                    onClick={() => setSelectedOverlapId(ov._id)}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#101D35] border-blue-500/40 shadow-md'
                        : 'bg-[#101D35] border-slate-700/80 hover:border-blue-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <OverlapBadge severity={ov.severity || 'high'} />
                      <span className="text-[10px] font-mono text-slate-400">
                        {ov.cases?.length || 0} Open Cases
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-white truncate">
                      {ov.institution?.name || 'Institution Record'}
                    </h3>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {ov.institution?.city || 'Location N/A'} &bull; Status: <span className="capitalize text-slate-300">{ov.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Detailed Coordination View */}
          <div className="lg:col-span-7 bg-[#0B1730] border border-slate-700/80 rounded-2xl p-5 flex flex-col overflow-hidden">
            {selectedGroup ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header & Status */}
                <div className="pb-4 border-b border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-base font-bold text-white">
                        {selectedGroup.institution?.name}
                      </h2>
                      <OverlapBadge severity={selectedGroup.severity || 'high'} />
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        {selectedGroup.overlapType === 'duplicate_complaint' ? 'Potential Duplicate' : 'Coordination Required'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      AICTE ID: <span className="font-mono text-white">{selectedGroup.institution?.aictePermanentId || 'Pending'}</span> &bull; Region: <span className="text-white">{selectedGroup.institution?.region || 'Central'}</span>
                    </div>
                  </div>

                  {/* Resolve Actions (Officer only) */}
                  {selectedGroup.status === 'open' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenResolve('coordinated')}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Coordinate</span>
                      </button>
                      <button
                        onClick={() => handleOpenResolve('dismissed')}
                        className="px-3 py-1.5 rounded-xl bg-[#101D35] hover:bg-[#232427] text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium transition cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>

                {/* Overlap Reason Callout */}
                {selectedGroup.reason && (
                  <div className="my-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-0.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Reason for Overlap Alert</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11px]">{selectedGroup.reason}</p>
                  </div>
                )}

                {selectedGroup.status !== 'open' && (
                  <div className="my-2 p-3 rounded-xl bg-[#101D35] border border-slate-700/80 text-xs">
                    <span className="font-bold text-blue-400 capitalize">{selectedGroup.status}: </span>
                    <span className="text-slate-300">{selectedGroup.resolutionRemarks || 'Resolved by statutory officer.'}</span>
                  </div>
                )}

                {/* Overlapping Cases in this Group */}
                <div className="flex-1 overflow-y-auto mt-2 space-y-3">
                  <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                    <span>Concurrent Cases Across Bureaus ({groupCases.length})</span>
                    <span className="text-[10px] font-normal text-slate-400">Click any case to inspect audit history</span>
                  </div>
                  {groupCases.map((c) => (
                    <div
                      key={c._id}
                      onClick={() => navigate(`/officer/cases/${c._id}`)}
                      className="p-3.5 rounded-xl bg-[#101D35] hover:bg-[#172846] border border-slate-700/80 hover:border-blue-500/50 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-blue-400">{c.caseId}</span>
                          <span className="text-[10px] text-slate-300">&bull; {c.category}</span>
                          {c.assignedOfficer && (
                            <span className="text-[10px] text-slate-400">
                              &bull; Assigned: <span className="text-slate-200">{c.assignedOfficer.name}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-1">{c.description || 'Regulatory matter'}</p>
                        {c.lastActionText && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            Latest Action: <span className="text-slate-300">{c.lastActionText}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {c.currentBureau && <BureauBadge bureau={c.currentBureau.name} />}
                        <StatusBadge status={c.status} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                Select an overlap group to view details
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESOLVE OVERLAP MODAL */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#101D35] border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setResolveModal(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-white mb-1">
              {resolutionStatus === 'coordinated' ? 'Mark Overlap Coordinated' : 'Dismiss Overlap'}
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              {resolutionStatus === 'coordinated'
                ? 'Consolidate multiple bureau investigations under a lead cell.'
                : 'Dismiss this cluster if investigations are completely unrelated.'}
            </p>

            {resolveError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {resolveError}
              </div>
            )}

            <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Statutory Resolution Remarks *</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  required
                  className="w-full py-1.5 px-3 bg-[#101D35] border border-slate-700/80 rounded-lg text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setResolveModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#101D35] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolveMutation.isPending}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold disabled:opacity-50"
                >
                  {resolveMutation.isPending ? 'Saving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OfficerOverlapsPage;
