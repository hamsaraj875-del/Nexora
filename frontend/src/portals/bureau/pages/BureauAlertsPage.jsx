
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  AlertTriangle,
  Info,
  Clock,
  CheckCheck,
  ExternalLink,
} from 'lucide-react';
import { bureauApi } from '../../../shared/api/bureauApi';
import { SkeletonLoader } from '../../../shared/components/SkeletonLoader';

const ALERT_TITLES = {
  overlap: 'Cross-Bureau Overlap Detected',
  pending_reminder: 'Complaint Activity Update',
  due_soon: 'SLA Deadline Approaching',
  breach: 'SLA Deadline Breached',
  escalation: 'Complaint Escalated',
};

const SEVERITY_STYLES = {
  high: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  medium: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  low: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
};

export function BureauAlertsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['bureau', 'alerts'],
    queryFn: () => bureauApi.getAlerts(),
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId) =>
      bureauApi.markAlertRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['bureau', 'alerts'],
      });
    },
  });

  const notifications = data?.data || [];
  const unreadCount = data?.unreadCount ?? 0;

  const openNotification = (notification) => {
    const alert = notification.alert;

    if (!alert) return;

    if (alert.case?._id) {
      navigate(`/bureau/cases/${alert.case._id}`);
    } else if (alert.overlapGroup) {
      navigate('/bureau/overlaps');
    }
  };

  const markRead = (notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.notificationId);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-semibold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">
            Operational Alerts
          </span>

          <h1 className="text-2xl font-bold text-white tracking-tight mt-2">
            Bureau Notifications
          </h1>

          <p className="text-xs text-slate-400 mt-1">
            Complaint assignments, student replies, SLA warnings,
            escalations and cross-bureau coordination alerts.
          </p>
        </div>

        {unreadCount > 0 && (
          <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-300 border border-blue-500/30">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="bg-[#101D35] border border-slate-700/80 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <SkeletonLoader className="h-14 w-full" />
            <SkeletonLoader className="h-14 w-full" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-16 text-center">
            <Bell className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-40" />
            <h3 className="text-sm font-semibold text-white">
              All clear!
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              No notifications have been generated for your account.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/70">
            {notifications.map((notification) => {
              const alert = notification.alert;

              if (!alert) return null;

              const severity = alert.severity || 'medium';
              const isUrgent = severity === 'high';
              const caseItem = alert.case;
              const institution =
                alert.institution?.name ||
                caseItem?.rawInstitutionName ||
                'Institution not available';

              const title =
                ALERT_TITLES[alert.alertType] ||
                'Operational Alert';

              const deadline = caseItem?.expectedDisposalDate
                ? new Date(caseItem.expectedDisposalDate).toLocaleDateString()
                : null;

              const canNavigate = Boolean(
                caseItem?._id || alert.overlapGroup
              );

              return (
                <div
                  key={notification.notificationId}
                  className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                    notification.isRead
                      ? 'opacity-60 bg-[#0B1730]'
                      : 'bg-[#0B1730]/60 hover:bg-[#172846]'
                  }`}
                >
                  <button
                    type="button"
                    disabled={!canNavigate}
                    onClick={() => openNotification(notification)}
                    className="flex items-start gap-3 min-w-0 flex-1 text-left disabled:cursor-default"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isUrgent
                          ? 'bg-rose-500/10 text-rose-300'
                          : 'bg-blue-500/10 text-blue-300'
                      }`}
                    >
                      {isUrgent ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <Info className="w-4 h-4" />
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">
                          {title}
                        </span>

                        {!notification.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {alert.message}
                      </p>

                      {caseItem && (
                        <div className="text-[11px] text-slate-400 space-y-1">
                          <p>
                            Complaint: {caseItem.caseId}
                          </p>
                          <p>
                            Institution: {institution}
                          </p>
                          <p>
                            Category: {caseItem.category}
                          </p>
                          {deadline && (
                            <p>
                              Expected disposal: {deadline}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span
                          className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${
                            SEVERITY_STYLES[severity] ||
                            SEVERITY_STYLES.medium
                          }`}
                        >
                          {severity} severity
                        </span>

                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(notification.createdAt).toLocaleString()}
                        </span>

                        {canNavigate && (
                          <span className="text-[10px] text-blue-300 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            View details
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {!notification.isRead && (
                    <button
                      type="button"
                      onClick={() => markRead(notification)}
                      disabled={markReadMutation.isPending}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#172846] hover:bg-[#203657] text-slate-300 hover:text-white transition-colors shrink-0 flex items-center gap-1"
                      title="Mark as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Read</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default BureauAlertsPage;
