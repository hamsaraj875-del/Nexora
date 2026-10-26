import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Users,
  Clock,
  ShieldCheck,
  Save,
  Loader2,
  AlertCircle,
  Building2,
  CheckCircle2,
  Palette,
} from 'lucide-react';
import { officerApi } from '../../../shared/api/officerApi';
import { SkeletonLoader } from '../../../shared/components/SkeletonLoader';
import { ThemeToggle } from '../../../shared/components/ThemeToggle';

export function OfficerAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('sla');
  const [slaEdits, setSlaEdits] = useState({});
  const [savingCategory, setSavingCategory] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const { data: slaData, isLoading: slaLoading } = useQuery({
    queryKey: ['officer-admin-sla'],
    queryFn: officerApi.getSlaRules,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['officer-admin-users'],
    queryFn: officerApi.getUsers,
  });

  const { data: bureausData, isLoading: bureausLoading } = useQuery({
    queryKey: ['officer-admin-bureaus'],
    queryFn: officerApi.getBureaus,
  });

  const rules = slaData?.data || [];
  const users = usersData?.data || [];
  const bureaus = bureausData?.data || [];

  useEffect(() => {
    if (rules.length > 0) {
      const initial = {};
      rules.forEach((r) => {
        initial[r.category] = {
          daysToDispose: r.daysToDispose,
          reminderAfterDays: r.reminderAfterDays,
          dueSoonDays: r.dueSoonDays,
          escalateAfterDaysOverdue: r.escalateAfterDaysOverdue,
        };
      });
      setSlaEdits(initial);
    }
  }, [rules]);

  const updateMutation = useMutation({
    mutationFn: (payload) => officerApi.updateSlaRule(payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries(['officer-admin-sla']);
      setSavingCategory(null);
      setToastMessage(`SLA rule for '${vars.category}' updated successfully!`);
      setTimeout(() => setToastMessage(''), 3000);
    },
    onError: () => {
      setSavingCategory(null);
      alert('Failed to update SLA rule');
    },
  });

  const handleFieldChange = (category, field, value) => {
    setSlaEdits((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: Number(value) || 0,
      },
    }));
  };

  const handleSaveRule = (category) => {
    setSavingCategory(category);
    const rule = slaEdits[category] || {};
    updateMutation.mutate({
      category,
      daysToDispose: rule.daysToDispose,
      reminderAfterDays: rule.reminderAfterDays,
      dueSoonDays: rule.dueSoonDays,
      escalateAfterDaysOverdue: rule.escalateAfterDaysOverdue,
    });
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 overflow-hidden bg-[#0B1730] text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>Administration &amp; Statutory Settings</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-400/30">
              Super Admin Control
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure statutory disposal timelines, inspect registered officers, and verify AICTE cells.
          </p>
        </div>

        {toastMessage && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-xs font-bold text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 shrink-0 overflow-x-auto pb-1">
        {[
          { id: 'sla', label: 'SLA Timeline Rules', icon: Clock },
          { id: 'users', label: 'System Users', icon: Users },
          { id: 'bureaus', label: 'AICTE Bureaus', icon: Building2 },
          { id: 'theme', label: 'Appearance & Theme', icon: Palette },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'bg-[#101D35] text-slate-300 hover:text-white border border-slate-700/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 bg-[#101D35] border border-slate-700/80 rounded-2xl overflow-y-auto p-5">
        {activeTab === 'sla' && (
          <div>
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Statutory Disposal Deadlines (Citizen Charter)
              </h2>
              <p className="text-xs text-[#71717A]">
                Adjust days to dispose, reminder triggers, and automatic escalation countdowns per complaint category.
              </p>
            </div>

            {slaLoading ? (
              <SkeletonLoader count={6} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-700/80 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Complaint Category</th>
                      <th className="py-2.5 px-3">Disposal Target (Days)</th>
                      <th className="py-2.5 px-3">Reminder After (Days)</th>
                      <th className="py-2.5 px-3">Due Soon Threshold (Days)</th>
                      <th className="py-2.5 px-3">Escalate If Overdue (Days)</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {rules.map((rule) => {
                      const edit = slaEdits[rule.category] || rule;
                      const isSaving = savingCategory === rule.category;
                      return (
                        <tr key={rule._id} className="hover:bg-[#172846] transition">
                          <td className="py-3 px-3 font-semibold text-slate-100">{rule.category}</td>
                          <td className="py-3 px-3">
                            <input
                              type="number"
                              value={edit.daysToDispose ?? ''}
                              onChange={(e) => handleFieldChange(rule.category, 'daysToDispose', e.target.value)}
                              className="w-20 px-2 py-1 bg-[#0B1730] border border-slate-700/80 rounded text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="number"
                              value={edit.reminderAfterDays ?? ''}
                              onChange={(e) => handleFieldChange(rule.category, 'reminderAfterDays', e.target.value)}
                              className="w-20 px-2 py-1 bg-[#0B1730] border border-slate-700/80 rounded text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="number"
                              value={edit.dueSoonDays ?? ''}
                              onChange={(e) => handleFieldChange(rule.category, 'dueSoonDays', e.target.value)}
                              className="w-20 px-2 py-1 bg-[#0B1730] border border-slate-700/80 rounded text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="number"
                              value={edit.escalateAfterDaysOverdue ?? ''}
                              onChange={(e) => handleFieldChange(rule.category, 'escalateAfterDaysOverdue', e.target.value)}
                              className="w-20 px-2 py-1 bg-[#0B1730] border border-slate-700/80 rounded text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleSaveRule(rule.category)}
                              disabled={isSaving}
                              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                            >
                              {isSaving ? 'Saving...' : 'Save'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                System Personnel Directory ({users.length})
              </h2>
            </div>
            {usersLoading ? (
              <SkeletonLoader count={5} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-700/80 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">System Role</th>
                      <th className="py-2.5 px-3">Assigned Bureau</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {users.map((u) => (
                      <tr key={u._id} className="hover:bg-[#172846] transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-100">{u.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{u.email}</td>
                        <td className="py-2.5 px-3">
                          <span className="capitalize px-2 py-0.5 rounded bg-[#172846] text-slate-200 text-[11px]">
                            {u.role?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{u.bureau?.name || 'Central / Oversight'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] font-bold text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bureaus' && (
          <div>
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Registered AICTE Bureaus &amp; Regional Offices ({bureaus.length})
              </h2>
            </div>
            {bureausLoading ? (
              <SkeletonLoader count={4} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {bureaus.map((b) => (
                  <div key={b._id} className="p-4 rounded-xl bg-[#0B1730] border border-slate-700/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-300">
                        {b.code}
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize">{b.type}</span>
                    </div>
                    <div className="font-bold text-sm text-slate-100">{b.name}</div>
                    {b.region && (
                      <div className="text-xs text-slate-400 mt-1">Region: {b.region}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'theme' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                System Appearance &amp; Design Themes
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Choose between the default statutory dark theme and the warm, human-crafted Earth Editorial theme.
                Theme changes are instantly applied across all portals and persisted across refreshes.
              </p>
            </div>

            <ThemeToggle variant="cards" />

            {/* Theme Architectural Details */}
            <div className="mt-6 p-4 rounded-xl bg-[#0B1730] border border-slate-700/80">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
                Earth Editorial Design Specification
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#F5F0E8] border border-[#DED5C8]" />
                  <span className="text-slate-300">Canvas: <code className="text-[11px] font-mono text-slate-400">#F5F0E8</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#FFFCF7] border border-[#DED5C8]" />
                  <span className="text-slate-300">Panel/Card: <code className="text-[11px] font-mono text-slate-400">#FFFCF7</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#803D2D]" />
                  <span className="text-slate-300">Primary: <code className="text-[11px] font-mono text-slate-400">#803D2D</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#683123]" />
                  <span className="text-slate-300">Hover: <code className="text-[11px] font-mono text-slate-400">#683123</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#292621]" />
                  <span className="text-slate-300">Main Text: <code className="text-[11px] font-mono text-slate-400">#292621</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#71695F]" />
                  <span className="text-slate-300">Secondary Text: <code className="text-[11px] font-mono text-slate-400">#71695F</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#DED5C8]" />
                  <span className="text-slate-300">Borders: <code className="text-[11px] font-mono text-slate-400">#DED5C8</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#EAE2D5]" />
                  <span className="text-slate-300">Muted Surface: <code className="text-[11px] font-mono text-slate-400">#EAE2D5</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#4A6741]" />
                  <span className="text-slate-300">Success: <code className="text-[11px] font-mono text-slate-400">#4A6741</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#A66B2D]" />
                  <span className="text-slate-300">Warning: <code className="text-[11px] font-mono text-slate-400">#A66B2D</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#A33D32]" />
                  <span className="text-slate-300">Error: <code className="text-[11px] font-mono text-slate-400">#A33D32</code></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OfficerAdminPage;
