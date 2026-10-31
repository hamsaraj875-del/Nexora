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
  Sparkles,
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
  
  const resolveMutation = useMutation({
  mutationFn: ({ id, data }) => officerApi.resolveOverlap(id, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['officer-overlaps'] });
    setResolveModal(false);
    setResolveError('');
  },
  onError: (error) => {
    setResolveError(
      error.response?.data?.message || 'Failed to update overlap status.'
    );
  },
});

  const sortedOverlaps = [...overlaps].sort((a, b) => {
  const aHasCandidates = (a.candidatePairs?.length || 0) > 0;
  const bHasCandidates = (b.candidatePairs?.length || 0) > 0;

  if (aHasCandidates !== bHasCandidates) {
    return Number(bHasCandidates) - Number(aHasCandidates);
  }

  const severityOrder = { high: 0, medium: 1, low: 2 };

  return (
    (severityOrder[a.severity] ?? 3) -
    (severityOrder[b.severity] ?? 3)
  );
});

const selectedGroup =
  sortedOverlaps.find(
    (o) => o._id === (selectedOverlapId || sortedOverlaps[0]?._id)
  ) || sortedOverlaps[0];

const groupCases = selectedGroup?.cases || [];

// Fetch cached AI explanations only for the selected group.
const {
  data: explanationResponse,
  isLoading: explanationsLoading,
  isError: explanationsError,
} = useQuery({
  queryKey: ['overlap-explanations', selectedGroup?._id],
  queryFn: () =>
    officerApi.getOverlapExplanations(selectedGroup._id),
  enabled:
    Boolean(selectedGroup?._id) &&
    (selectedGroup?.candidatePairs?.length || 0) > 0,
});

const aiExplanations = explanationResponse?.data || [];

const hasNoQualifyingCandidates =
  selectedGroup?.systemEvaluation?.outcome === 'no_candidates';

const hasNoCrossBureauCases =
  selectedGroup?.systemEvaluation?.outcome === 'no_cross_bureau_cases';

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
                  filterStatus === st
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
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
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isFetching ? 'animate-spin text-blue-400' : ''
              }`}
            />
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
          <h3 className="text-base font-bold text-white">
            No Overlaps in this filter
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Select another filter status or check back as complaints arrive.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Panel: Overlap Clusters List */}
          <div className="lg:col-span-5 bg-[#0B1730] border border-slate-700/80 rounded-2xl p-3 flex flex-col overflow-hidden">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 mb-2">
              Overlap Groups ({overlaps.length})
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {sortedOverlaps.map((ov) => {
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
                      {ov.institution?.city || 'Location N/A'} &bull; Status:{' '}
                      <span className="capitalize text-slate-300">
                        {ov.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Detailed Coordination View */}
          <div className="lg:col-span-7 bg-[#0B1730] border border-slate-700/80 rounded-2xl p-5 flex flex-col min-h-0 overflow-y-auto">
            {selectedGroup ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
                {/* Header & Status */}
                <div className="pb-4 border-b border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-base font-bold text-white">
                        {selectedGroup.institution?.name}
                      </h2>

                      <OverlapBadge severity={selectedGroup.severity || 'high'} />

                     <span
  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase border ${
    hasNoQualifyingCandidates || hasNoCrossBureauCases
      ? 'bg-slate-500/15 text-slate-300 border-slate-500/30'
      : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
  }`}
>
  {hasNoQualifyingCandidates
    ? 'No Qualifying Overlap'
    : hasNoCrossBureauCases
      ? 'No Active Cross-Bureau Cases'
      : selectedGroup.overlapType === 'duplicate_complaint'
        ? 'Potential Duplicate'
        : 'Coordination Required'}
</span>
                    </div>

                    <div className="text-xs text-slate-400">
                      AICTE ID:{' '}
                      <span className="font-mono text-white">
                        {selectedGroup.institution?.aictePermanentId || 'Pending'}
                      </span>{' '}
                      &bull; Region:{' '}
                      <span className="text-white">
                        {selectedGroup.institution?.region || 'Central'}
                      </span>
                    </div>
                  </div>

                  {/* Resolve Actions */}
                  {selectedGroup.status === 'open' && (
                  <div className="flex items-center gap-2">
                    {!hasNoQualifyingCandidates && !hasNoCrossBureauCases && (
                      <button
                        onClick={() => handleOpenResolve('coordinated')}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Coordinate</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenResolve('dismissed')}
                      className="px-3 py-1.5 rounded-xl bg-[#101D35] hover:bg-[#232427] text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium transition cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                                </div>

                {/* System Re-evaluation */}
                {(hasNoQualifyingCandidates || hasNoCrossBureauCases) && (
                  <div className="my-3 p-3 rounded-xl bg-slate-500/10 border border-slate-500/25 text-xs">
                    <div className="font-bold text-slate-200 mb-1">
                      System Re-evaluation
                    </div>

                    <p className="text-slate-400 leading-relaxed">
                      {selectedGroup.systemEvaluation?.remarks ||
                        'The system found no qualifying overlap candidates.'}
                    </p>

                    {selectedGroup.systemEvaluation?.evaluatedAt && (
                      <p className="text-[10px] text-slate-500 mt-2">
                        Evaluated:{' '}
                        {new Date(
                          selectedGroup.systemEvaluation.evaluatedAt
                        ).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Overlap Reason Callout */}
                {selectedGroup.reason && (
                  <div className="my-2 p-3 rounded-xl bg-[#101D35] border border-slate-700/80 text-xs">
                    <span className="font-bold text-blue-400 capitalize">
                      {selectedGroup.status}:{' '}
                    </span>
                    <span className="text-slate-300">
                      {selectedGroup.reason ||
                        selectedGroup.systemEvaluation?.remarks ||
                        'No additional explanation is available.'}
                    </span>
                  </div>
                )}

                
    {/* Explainable Candidate Pair Evidence */}
    {selectedGroup.candidatePairs?.length > 0 && (
      <div className="my-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Explainable Overlap Evidence
          </h3>

          <span className="text-[10px] text-slate-400">
            {selectedGroup.candidatePairs.length} candidate pairs
          </span>
        </div>

        {selectedGroup.candidatePairs.map((pair, index) => {
          const caseA = pair.caseA;
          const caseB = pair.caseB;
          const evidence = pair.evidence || {};
                    const pairIds = [caseA?._id, caseB?._id]
            .filter(Boolean)
            .map(String)
            .sort();

          const aiExplanation = aiExplanations.find((item) => {
            const explanationIds = [item.caseA, item.caseB]
              .map(String)
              .sort();

            return (
              explanationIds.length === pairIds.length &&
              explanationIds.every((id, i) => id === pairIds[i])
            );
          });

          const commonTokens = evidence.commonDescriptionTokens || [];
          const keywordsA = evidence.regulatoryKeywordsA || [];
          const keywordsB = evidence.regulatoryKeywordsB || [];

          if (!caseA || !caseB) return null;

          return (
            <div
              key={`${caseA._id}-${caseB._id}-${index}`}
              className="p-3 rounded-xl bg-[#101D35] border border-slate-700/80 space-y-3"
            >
              {/* Pair heading */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-white">
                  Candidate Pair {index + 1}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-1 rounded bg-blue-500/15 text-blue-300 capitalize">
                    {pair.overlapType?.replaceAll('_', ' ') || 'Overlap'}
                  </span>

                  <span className="text-[10px] px-2 py-1 rounded bg-amber-500/15 text-amber-300">
                    Heuristic score: {pair.score ?? 'N/A'}/100
                  </span>
                </div>
              </div>

              {/* Complaint comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[caseA, caseB].map((c, caseIndex) => (
                  <div
                    key={c._id || caseIndex}
                    className="p-3 rounded-lg bg-[#0B1730] border border-slate-700/70 space-y-2"
                  >
                    <div className="text-xs font-bold text-blue-300">
                      {c.caseId || 'Complaint'}
                    </div>

                    <div className="text-[11px] text-slate-300">
                      Bureau: {c.currentBureau?.name || 'Unknown'}
                    </div>

                    <div className="text-[11px] text-slate-300">
                      Category: {c.category || 'Not available'}
                    </div>

                    <div className="text-[11px] text-slate-300">
                      Source: {c.sourceSystem || 'Not available'}
                    </div>

                    <div className="text-[11px] text-slate-300">
                      Received:{' '}
                      {c.receivedDate
                        ? new Date(c.receivedDate).toLocaleDateString()
                        : 'Not available'}
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {c.description || 'Description unavailable'}
                    </p>
                  </div>
                ))}
              </div>

              {/* Explainable metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-3 rounded-lg bg-[#0B1730] border border-slate-700/70">
                  <div className="text-[10px] text-slate-400 mb-1">
                    Description text similarity (Jaccard)
                  </div>

                  <div className="text-lg font-bold text-blue-300">
                    {typeof pair.descriptionSimilarity === 'number'
                      ? `${pair.descriptionSimilarity}%`
                      : 'Not available'}
                  </div>

                  <div className="text-[10px] text-slate-500 mt-1">
                    Measures shared description tokens, not semantic similarity.
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0B1730] border border-slate-700/70">
                  <div className="text-[10px] text-slate-400 mb-1">
                    Date difference
                  </div>

                  <div className="text-lg font-bold text-blue-300">
                    {typeof evidence.dateDifferenceDays === 'number'
                      ? `${evidence.dateDifferenceDays} days`
                      : 'Not available'}
                  </div>

                  <div className="text-[10px] text-slate-500 mt-1">
                    Difference between the complaint dates used for comparison.
                  </div>
                </div>
              </div>

          {/* Shared description tokens */}
          <div className="p-3 rounded-lg bg-[#0B1730] border border-slate-700/70">
            <div className="text-[10px] font-semibold text-slate-300 mb-2">
              Shared description terms
            </div>

            {commonTokens.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {commonTokens.map((token, tokenIndex) => (
                  <span
                    key={`${token}-${tokenIndex}`}
                    className="text-[10px] px-2 py-1 rounded bg-blue-500/15 text-blue-300"
                  >
                    {token}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                No common description terms identified.
              </p>
            )}

            <div className="text-[10px] text-slate-500 mt-2">
              Complaint A: {evidence.descriptionTokenCountA ?? 'N/A'} tokens
              {' | '}
              Complaint B: {evidence.descriptionTokenCountB ?? 'N/A'} tokens
            </div>
          </div>

          {/* Category comparison */}
          <div className="p-3 rounded-lg bg-[#0B1730] border border-slate-700/70">
            <div className="text-[10px] text-slate-400 mb-1">
              Category comparison
            </div>

            <span
              className={`text-xs font-semibold ${
                evidence.categoryMatch
                  ? 'text-emerald-400'
                  : 'text-amber-300'
              }`}
            >
              {evidence.categoryMatch ? 'Categories match' : 'Categories differ'}
            </span>
          </div>

          {/* Regulatory keywords */}
          <div className="p-3 rounded-lg bg-[#0B1730] border border-slate-700/70 space-y-3">
            <div className="text-[10px] font-semibold text-slate-300">
              Regulatory keywords found in complaint/action text
            </div>

            {[keywordsA, keywordsB].map((keywords, keywordIndex) => (
              <div key={keywordIndex}>
                <div className="text-[10px] text-slate-400 mb-2">
                  Complaint {keywordIndex === 0 ? 'A' : 'B'}
                </div>

                {keywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((keyword, keywordIndex2) => (
                      <span
                        key={`${keyword}-${keywordIndex2}`}
                        className="text-[10px] px-2 py-1 rounded bg-amber-500/15 text-amber-300"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-500">
                    No listed regulatory keywords found.
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Reason */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="text-[10px] font-semibold text-amber-300 mb-1">
              Why was this pair flagged?
            </div>

            <p className="text-[11px] text-slate-300">
              {pair.reason || 'No explanation recorded.'}
            </p>
          </div>
          {/* AI Semantic Explanation */}
          <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-400/25 space-y-3">

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-300" />
                <h4 className="text-xs font-bold text-purple-200">
                  AI Semantic Explanation
                </h4>
              </div>
              <span className="text-[9px] px-2 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-400/20">
                {aiExplanation ? 'AI-generated' : 'API activation pending'}
              </span>
            </div>

            {explanationsLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading saved AI explanation...
              </div>
            ) : explanationsError ? (
              <p className="text-xs text-amber-300">
                AI explanation could not be loaded. Please refresh and try again.
              </p>
            ) : !aiExplanation ? (
              <p className="text-xs text-slate-400 leading-relaxed">
                No saved explanation is available for this complaint pair.
                AI generation runs in the background and requires an active
                OpenAI API connection with available API credits.
              </p>
            ) : (
              <>
                <div>
                  <div className="text-[10px] text-slate-400 mb-1">
                    Relationship assessment
                  </div>
                  <span className="inline-block text-xs font-semibold capitalize text-purple-200 bg-purple-500/10 px-2 py-1 rounded">
                    {aiExplanation.aiAnalysis?.relationshipType?.replaceAll('_', ' ') ||
                      'Not available'}
                  </span>
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-300 mb-1">
                    Common issue identified
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {aiExplanation.aiAnalysis?.commonIssue || 'Not available'}
                  </p>
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-300 mb-1">
                    Supporting evidence
                  </div>
                  {aiExplanation.aiAnalysis?.supportingEvidence?.length > 0 ? (
                    <ul className="list-disc pl-4 space-y-1">
                      {aiExplanation.aiAnalysis.supportingEvidence.map(
                        (item, i) => (
                          <li
                            key={i}
                            className="text-xs text-slate-400 leading-relaxed"
                          >
                            {item}
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No supporting evidence recorded.
                    </p>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-300 mb-1">
                    Key differences
                  </div>
                  {aiExplanation.aiAnalysis?.keyDifferences?.length > 0 ? (
                    <ul className="list-disc pl-4 space-y-1">
                      {aiExplanation.aiAnalysis.keyDifferences.map(
                        (item, i) => (
                          <li
                            key={i}
                            className="text-xs text-slate-400 leading-relaxed"
                          >
                            {item}
                          </li>
                        )
                      )}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No key differences recorded.
                    </p>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-300 mb-1">
                    Coordination rationale
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {aiExplanation.aiAnalysis?.coordinationRationale ||
                      'Not available'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="text-[10px] font-semibold text-amber-300 mb-1">
                    Uncertainty and limitations
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {aiExplanation.aiAnalysis?.uncertainty || 'Not available'}
                  </p>
                </div>

                <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-slate-700/70">
                  <span className="text-[10px] text-slate-500">
                    Model: {aiExplanation.model || 'Not recorded'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Generated:{' '}
                    {aiExplanation.generatedAt
                      ? new Date(aiExplanation.generatedAt).toLocaleString()
                      : 'Not recorded'}
                  </span>
                </div>
              </>
            )}

            <p className="text-[10px] text-slate-500 leading-relaxed">
              AI-generated analysis is an assistive explanation, not a verified
              finding. Officers must independently review the complaints and
              evidence before making decisions.
            </p>
          </div>
          

          {/* Limitations */}
          <p className="text-[10px] text-slate-500 leading-relaxed">
            The heuristic score is not a probability. Description similarity
            represents token overlap only and may be affected by repeated
            wording or institution names. Regulatory keywords may come from
            complaint descriptions or action text. These indicators do not
            establish that complaints are duplicates. Human review is required.
          </p>
        </div>
      );
    })}
  </div>
)}


                {/* Overlapping Cases in this Group */}
                <div className="mt-2 space-y-3">
                  <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                    <span>
                      Concurrent Cases Across Bureaus ({groupCases.length})
                    </span>
                    <span className="text-[10px] font-normal text-slate-400">
                      Click any case to inspect audit history
                    </span>
                  </div>

                  {groupCases.map((c) => (
                    <div
                      key={c._id}
                      onClick={() => navigate(`/officer/cases/${c._id}`)}
                      className="p-3.5 rounded-xl bg-[#101D35] hover:bg-[#172846] border border-slate-700/80 hover:border-blue-500/50 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-blue-400">
                            {c.caseId}
                          </span>
                          <span className="text-[10px] text-slate-300">
                            &bull; {c.category}
                          </span>

                          {c.assignedOfficer && (
                            <span className="text-[10px] text-slate-400">
                              &bull; Assigned:{' '}
                              <span className="text-slate-200">
                                {c.assignedOfficer.name}
                              </span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                          {c.description || 'Description unavailable'}
                        </p>

                        {c.lastActionText && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            Latest Action:{' '}
                            <span className="text-slate-300">
                              {c.lastActionText}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {c.currentBureau && (
                          <BureauBadge bureau={c.currentBureau.name} />
                        )}
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
              {resolutionStatus === 'coordinated'
                ? 'Mark Overlap Coordinated'
                : 'Dismiss Overlap'}
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
                <label className="block text-slate-300 mb-1 font-medium">
                  Statutory Resolution Remarks *
                </label>
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
                  {resolveMutation.isPending
                    ? 'Saving...'
                    : 'Confirm Resolution'}
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
