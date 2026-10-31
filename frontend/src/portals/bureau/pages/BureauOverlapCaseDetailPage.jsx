
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, Building2, Calendar, FileText } from 'lucide-react';
import { bureauApi } from '../../../shared/api/bureauApi';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { SkeletonLoader } from '../../../shared/components/SkeletonLoader';

export function BureauOverlapCaseDetailPage() {
  const { id } = useParams();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bureau', 'overlap-case', id],
    queryFn: () => bureauApi.getOverlapCaseReadOnly(id),
    enabled: Boolean(id),
    retry: false,
  });

  const complaint = data?.data;

  if (isLoading) {
    return <div className="space-y-4"><SkeletonLoader className="h-40 w-full" /></div>;
  }

  if (isError || !complaint) {
    return (
      <div className="bg-[#101D35] border border-red-500/30 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-slate-100">Complaint unavailable</h2>
        <p className="text-sm text-slate-400 mt-2">
          {error?.response?.data?.message || 'You are not authorised to view this complaint.'}
        </p>
        <Link to="/bureau/overlaps" className="text-blue-400 text-sm mt-4 inline-block">
          Back to overlaps
        </Link>
      </div>
    );
  }

  const institution = complaint.institution;
  const bureau = complaint.currentBureau;

  return (
    <div className="space-y-6">
      <Link to="/bureau/overlaps" className="inline-flex items-center gap-2 text-sm text-blue-400">
        <ArrowLeft className="w-4 h-4" /> Back to overlaps
      </Link>

      <div className="bg-[#101D35] border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold text-slate-100">Cross-Bureau Complaint View</h1>
            <p className="text-xs text-emerald-400">Read-only access</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-xs text-slate-400">Complaint ID</p>
            <p className="text-sm text-slate-100 font-mono mt-1">{complaint.caseId || complaint._id}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Originating Bureau</p>
            <p className="text-sm text-slate-100 mt-1">{bureau?.name || 'Not available'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Institution</p>
            <p className="text-sm text-slate-100 mt-1">{institution?.name || complaint.rawInstitutionName || 'Not available'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Category</p>
            <p className="text-sm text-slate-100 mt-1">{complaint.category || 'Not available'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Received Date</p>
            <p className="text-sm text-slate-100 mt-1">
              {complaint.receivedDate ? new Date(complaint.receivedDate).toLocaleDateString() : 'Not available'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Expected Disposal Date</p>
            <p className="text-sm text-slate-100 mt-1">
              {complaint.expectedDisposalDate ? new Date(complaint.expectedDisposalDate).toLocaleDateString() : 'Not available'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Status</p>
            <div className="mt-1"><StatusBadge status={complaint.status} size="sm" /></div>
          </div>
          <div>
            <p className="text-xs text-slate-400">Source System</p>
            <p className="text-sm text-slate-100 mt-1">{complaint.sourceSystem || 'Not available'}</p>
          </div>
        </div>
      </div>

      <div className="bg-[#101D35] border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-bold text-slate-100">Complaint Description</h2>
        </div>
        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
          {complaint.description || 'No description available.'}
        </p>
      </div>

      <div className="bg-[#0B1730] border border-emerald-500/20 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <p className="text-sm font-semibold text-slate-100">Read-only protection</p>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          This complaint is available for cross-bureau coordination only. Status updates,
          transfers, escalations, actions and internal history are not available here.
        </p>
      </div>
    </div>
  );
}

export default BureauOverlapCaseDetailPage;
