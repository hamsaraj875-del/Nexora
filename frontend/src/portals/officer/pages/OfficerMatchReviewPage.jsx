import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  MapPin,
  ShieldCheck,
  Loader2,
  AlertCircle,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { officerApi } from '../../../shared/api/officerApi';
import { bureauApi } from '../../../shared/api/bureauApi';
import { BureauBadge } from '../../../shared/components/BureauBadge';
import { SkeletonLoader } from '../../../shared/components/SkeletonLoader';

export function OfficerMatchReviewPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Pending');
  const [remarks, setRemarks] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  const isBureau = typeof window !== 'undefined' && window.location.pathname.startsWith('/bureau');
  const api = isBureau ? bureauApi : officerApi;
  const queryKey = isBureau ? ['bureau-match-review'] : ['officer-match-review'];

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: api.getMatchReviewQueue,
  });

  const confirmMutation = useMutation({
    mutationFn: ({ caseId, institutionId, remarks }) =>
      api.confirmMatch(caseId, { institutionId, remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries(queryKey);
      setConfirmingId(null);
      setRemarks('');
      refetch();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ caseId, remarks }) =>
      api.rejectMatch(caseId, { remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries(queryKey);
      setRejectingId(null);
      refetch();
    },
  });

  const rawItems = data?.data || [];

  // Normalize shape: backend returns { case, currentScore, matchStatus, suggestions } or flat case
  const items = rawItems.map((entry) => {
    const c = entry.case || entry;
    const suggestions = entry.suggestions || [];
    const topSuggested = suggestions[0]?.institution || c.institution || null;
    return {
      _id: c._id,
      caseId: c.caseId,
      rawInstitutionName: c.rawInstitutionName,
      rawCity: c.rawCity,
      rawState: c.rawState,
      category: c.category,
      matchStatus: entry.matchStatus || c.matchStatus,
      matchScore: entry.currentScore !== undefined ? entry.currentScore : c.matchScore,
      currentBureau: c.currentBureau,
      suggestedInstitution: topSuggested,
      suggestions,
    };
  });

  const filtered = items.filter((item) => {
    if (activeTab === 'Pending') return item.matchStatus === 'review';
    if (activeTab === 'Confirmed') return item.matchStatus === 'matched';
    if (activeTab === 'Unmatched') return item.matchStatus === 'unmatched';
    return true;
  });

  const handleConfirm = (caseId, institutionId) => {
    setConfirmingId(caseId);
    confirmMutation.mutate({
      caseId,
      institutionId,
      remarks: remarks || 'Confirmed by authorized operator in Match Review queue',
    });
  };

  const handleReject = (caseId) => {
    setRejectingId(caseId);
    rejectMutation.mutate({
      caseId,
      remarks: 'Rejected suggestion; marked as unmatched for physical registry review',
    });
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Institution Match Review Queue</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {filtered.length} In Queue
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit low-confidence institution names against the AICTE Permanent Registry before case grouping.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-[#0B1730] border border-slate-700/80 p-0.5 text-xs">
            {['Pending', 'Confirmed', 'Unmatched', 'All'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                  activeTab === tab ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
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

      {/* Main Container */}
      <div className="flex-1 bg-[#0B1730] border border-slate-700/80 rounded-2xl p-4 overflow-y-auto">
        {isLoading ? (
          <SkeletonLoader count={6} />
        ) : filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <CheckCheck className="w-12 h-12 text-blue-400/50 mb-2" />
            <h3 className="text-base font-bold text-white">Queue is Clear</h3>
            <p className="text-xs text-slate-400 mt-1">No cases require manual institution verification in this tab.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item._id}
                className="p-4 rounded-xl bg-[#101D35] border border-slate-700/80 hover:border-blue-500/40 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-400">{item.caseId}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#172846] text-slate-300">
                      {item.category}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      Confidence: {item.matchScore}%
                    </span>
                    {item.currentBureau && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {item.currentBureau.name || item.currentBureau.code}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Incoming Raw Input Name:</span>
                    <h3 className="text-sm font-semibold text-white">{item.rawInstitutionName}</h3>
                    <div className="text-[10px] text-slate-400">
                      City: {item.rawCity || 'N/A'} &bull; State: {item.rawState || 'N/A'}
                    </div>
                  </div>

                  {item.suggestedInstitution && (
                    <div className="p-2.5 rounded-lg bg-[#0B1730] border border-slate-700/80 text-xs">
                      <span className="text-[10px] text-blue-400 uppercase font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Suggested AICTE Master Registry Match:
                      </span>
                      <div className="font-semibold text-white mt-0.5">{item.suggestedInstitution.name}</div>
                      <div className="text-[10px] text-slate-400">
                        AICTE Permanent ID: <span className="font-mono text-slate-200">{item.suggestedInstitution.aictePermanentId}</span> &bull; Region: {item.suggestedInstitution.region || 'N/A'} &bull; City: {item.suggestedInstitution.city}
                      </div>
                    </div>
                  )}
                </div>

                {item.suggestedInstitution && item.matchStatus !== 'matched' && (
                  <div className="shrink-0 flex items-center gap-2 self-end lg:self-center">
                    <button
                      onClick={() => handleReject(item._id)}
                      disabled={rejectMutation.isPending && rejectingId === item._id}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {rejectMutation.isPending && rejectingId === item._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => handleConfirm(item._id, item.suggestedInstitution._id)}
                      disabled={confirmMutation.isPending && confirmingId === item._id}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {confirmMutation.isPending && confirmingId === item._id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          <span>Confirming...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirm Match</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OfficerMatchReviewPage;