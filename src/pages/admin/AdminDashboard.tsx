import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clock, Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  adminChangeUserRole,
  adminCreateDepartment,
  adminRecordDonation,
  adminRunExpirePastDue,
  adminToggleDepartment,
  adminToggleUserActive,
  adminUpdatePlatformSetting,
  fetchSuperAdminDashboardData,
  moderateBloodRequestStatus,
  resolveReport,
  reviewVerificationRequest,
  type AdminUserRow,
} from '../../services/adminService';
import type {
  AdminLogItem,
  BloodGroup,
  BloodRequest,
  Department,
  DonationHistory,
  ReportItem,
  RequestStatus,
  UserRole,
  VerificationRequest,
} from '../../types/database';
import { BLOOD_GROUPS } from '../../utils/bloodCompatibility';
import {
  canCompleteBloodRequest,
  formatRequestStatusError,
  formatRequestStatusLabel,
  getRequestStatusBadgeClass,
  validateRequestStatusTransition,
} from '../../utils/requestStatus';

type AdminTab =
  | 'overview'
  | 'users'
  | 'verifications'
  | 'requests'
  | 'donations'
  | 'departments'
  | 'logs'
  | 'settings';

const CHART_COLORS = ['#C62828', '#E53935', '#0F172A', '#334155', '#059669', '#D97706', '#2563EB', '#64748B'];

export function AdminDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [donations, setDonations] = useState<DonationHistory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [logs, setLogs] = useState<AdminLogItem[]>([]);
  const [settings, setSettings] = useState<
    Array<{ key: string; value: unknown; description: string | null; is_public: boolean }>
  >([]);

  const [userSearch, setUserSearch] = useState('');
  const [newDept, setNewDept] = useState({ code: '', name: '', nameBn: '' });
  const [donationForm, setDonationForm] = useState({
    donorId: '',
    bloodGroup: 'O+' as BloodGroup,
    donationDate: new Date().toISOString().slice(0, 10),
    hospitalName: 'Netrokona Sadar Hospital',
    unitsDonated: 1,
    notes: '',
  });
  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({});
  const [busyRequestIds, setBusyRequestIds] = useState<Record<string, boolean>>({});
  const [recordingDonation, setRecordingDonation] = useState(false);
  const [expiringRequests, setExpiringRequests] = useState(false);

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }
      try {
        const data = await fetchSuperAdminDashboardData();
        setUsers(data.users);
        setRequests(data.requests);
        setDonations(data.donations);
        setDepartments(data.departments);
        setVerifications(data.verifications);
        setReports(data.reports);
        setLogs(data.logs);
        setSettings(data.settings);

        const drafts: Record<string, string> = {};
        for (const s of data.settings) {
          drafts[s.key] = JSON.stringify(s.value, null, 2);
        }
        setSettingDrafts(drafts);
      } catch (err) {
        showToast(
          silent ? 'Failed to refresh dashboard' : 'Failed to load admin analytics',
          'error',
          err instanceof Error ? err.message : 'Check admin permissions.'
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Analytics derived strictly from real Supabase tables
  const analytics = useMemo(() => {
    const donors = users.filter((u) => Boolean(u.donor_details));
    const verifiedDonors = donors.filter(
      (u) => u.donor_details?.verification_status === 'approved'
    );
    const availableDonors = verifiedDonors.filter(
      (u) => u.donor_details?.is_available && u.donor_details?.is_publicly_discoverable
    );
    const activeRequests = requests.filter((r) => r.status === 'verified' || r.status === 'donor_found');
    const completedDonations = donations.length;

    const bloodGroupData = BLOOD_GROUPS.map((bg) => ({
      group: bg,
      count: donors.filter((u) => u.donor_details?.blood_group === bg).length,
    }));

    const deptCounts: Record<string, number> = {};
    for (const u of donors) {
      const label = u.department?.code || 'Other';
      deptCounts[label] = (deptCounts[label] || 0) + 1;
    }
    const departmentData = Object.entries(deptCounts).map(([department, count]) => ({
      department,
      count,
    }));

    const monthMap: Record<string, number> = {};
    for (const d of donations) {
      const month = (d.donation_date || '').slice(0, 7);
      if (!month) continue;
      monthMap[month] = (monthMap[month] || 0) + (Number(d.units_donated) || 0);
    }
    const monthlyTrends = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, units]) => ({ month, units }));

    const reqStatusMap: Record<string, number> = {};
    for (const r of requests) {
      const key = r.status || 'pending';
      reqStatusMap[key] = (reqStatusMap[key] || 0) + 1;
    }
    const requestStatusData = Object.entries(reqStatusMap).map(([name, value]) => ({
      name: formatRequestStatusLabel(name),
      value,
    }));

    return {
      totalUsers: users.length,
      totalDonors: donors.length,
      verifiedDonors: verifiedDonors.length,
      availableDonors: availableDonors.length,
      activeRequests: activeRequests.length,
      completedDonations,
      bloodGroupData,
      departmentData,
      monthlyTrends,
      requestStatusData,
    };
  }, [users, requests, donations]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.student_id.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const handleRoleChange = async (targetUserId: string, role: UserRole) => {
    try {
      await adminChangeUserRole(targetUserId, role);
      showToast('User Role Updated', 'success');
      await loadAll();
    } catch (err) {
      showToast('Role Update Failed', 'error', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleToggleActive = async (targetUserId: string, active: boolean) => {
    if (!user) return;
    try {
      await adminToggleUserActive(targetUserId, active, user.id);
      showToast(active ? 'Account Activated' : 'Account Suspended', 'success');
      await loadAll();
    } catch (err) {
      showToast('Update Failed', 'error', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleRecordDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recordingDonation) return;
    if (!user || !donationForm.donorId) {
      showToast('Select a donor', 'error');
      return;
    }
    setRecordingDonation(true);
    try {
      await adminRecordDonation({ ...donationForm, verifiedBy: user.id });
      showToast('Donation Recorded', 'success', 'Donor totals and last donation date updated.');
      await loadAll(true);
    } catch (err) {
      showToast('Failed', 'error', err instanceof Error ? err.message : 'Check inputs.');
    } finally {
      setRecordingDonation(false);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newDept.code.trim() || !newDept.name.trim()) return;
    try {
      await adminCreateDepartment({ ...newDept, actorId: user.id });
      setNewDept({ code: '', name: '', nameBn: '' });
      showToast('Department Added', 'success');
      await loadAll(true);
    } catch (err) {
      showToast('Error', 'error', err instanceof Error ? err.message : 'Could not add department.');
    }
  };

  const handleExpirePastDue = async () => {
    if (expiringRequests) return;
    setExpiringRequests(true);
    try {
      const count = await adminRunExpirePastDue();
      showToast('Expiration Sweep Completed', 'info', `${count} past-due requests marked expired.`);
      await loadAll(true);
    } catch (err) {
      showToast('Error', 'error', err instanceof Error ? err.message : 'Sweep failed.');
    } finally {
      setExpiringRequests(false);
    }
  };

  const handleSaveSetting = async (key: string) => {
    if (!user) return;
    try {
      const parsed = JSON.parse(settingDrafts[key] || '{}');
      await adminUpdatePlatformSetting(key, parsed, user.id);
      showToast(`Setting "${key}" updated`, 'success');
      await loadAll();
    } catch (err) {
      showToast('Invalid JSON or Permission Error', 'error', err instanceof Error ? err.message : 'Error');
    }
  };

  const handleReviewVerification = async (
    verificationId: string,
    decision: 'approved' | 'rejected'
  ) => {
    try {
      await reviewVerificationRequest(
        verificationId,
        decision,
        decision === 'rejected' ? 'Rejected by admin' : undefined
      );
      showToast(`Donor verification ${decision}`, 'success');
      await loadAll();
    } catch (err) {
      showToast(
        'Verification Action Failed',
        'error',
        err instanceof Error ? err.message : 'Unable to review verification request.'
      );
    }
  };

  const handleModerateRequest = async (
    requestId: string,
    nextStatus: Exclude<RequestStatus, 'pending'>
  ) => {
    if (busyRequestIds[requestId]) return;

    const currentRequest = requests.find((item) => item.id === requestId);
    if (currentRequest) {
      const check = validateRequestStatusTransition(currentRequest.status, nextStatus);
      if (!check.valid) {
        showToast(
          'Action Not Allowed',
          'error',
          check.reason || 'This blood request cannot be updated to that status.'
        );
        return;
      }
    }

    setBusyRequestIds((prev) => ({ ...prev, [requestId]: true }));
    try {
      await moderateBloodRequestStatus(requestId, nextStatus);
      const nowIso = new Date().toISOString();
      setRequests((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: nextStatus,
                verified_by: nextStatus === 'verified' ? user?.id ?? item.verified_by : item.verified_by,
                verified_at: nextStatus === 'verified' ? nowIso : item.verified_at,
                updated_at: nowIso,
              }
            : item
        )
      );
      showToast(
        nextStatus === 'completed' ? 'Donation Completed' : 'Blood Request Updated',
        'success',
        nextStatus === 'completed'
          ? 'The blood donation request has been marked as completed.'
          : `Request status updated to ${formatRequestStatusLabel(nextStatus)}.`
      );
      await loadAll(true);
    } catch (err) {
      showToast(
        'Request Update Failed',
        'error',
        formatRequestStatusError(err)
      );
    } finally {
      setBusyRequestIds((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    }
  };

  const handleToggleDepartment = async (deptId: string, nextActive: boolean) => {
    try {
      await adminToggleDepartment(deptId, nextActive);
      showToast(nextActive ? 'Department Activated' : 'Department Disabled', 'success');
      await loadAll();
    } catch (err) {
      showToast(
        'Department Update Failed',
        'error',
        err instanceof Error ? err.message : 'Unable to update department.'
      );
    }
  };

  const handleResolveReport = async (reportId: string) => {
    if (!user) return;
    try {
      await resolveReport(reportId, user.id, 'resolved', 'Resolved by admin');
      showToast('Report Resolved', 'success');
      await loadAll();
    } catch (err) {
      showToast(
        'Report Update Failed',
        'error',
        err instanceof Error ? err.message : 'Unable to resolve report.'
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold text-[#C62828] dark:text-red-400">
            Super Administrator Control Panel
          </p>
          <h1 className="font-display mt-1 text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
            Campus Blood Connect Admin
          </h1>
        </div>
        <button
          type="button"
          onClick={handleExpirePastDue}
          disabled={expiringRequests}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <Clock className="h-4 w-4 text-[#C62828]" />
          {expiringRequests ? 'Expiring...' : 'Expire Past-Due Requests'}
        </button>
      </div>

      {/* 6 Real Analytics Cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          { label: 'Total Users', value: analytics.totalUsers },
          { label: 'Registered Donors', value: analytics.totalDonors },
          { label: 'Verified Donors', value: analytics.verifiedDonors },
          { label: 'Available Donors', value: analytics.availableDonors },
          { label: 'Active Requests', value: analytics.activeRequests },
          { label: 'Completed Donations', value: analytics.completedDonations },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '—' : kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
        {[
          { key: 'overview', label: 'Analytics & Charts' },
          { key: 'users', label: `Users & Roles (${users.length})` },
          { key: 'verifications', label: `Verifications (${verifications.length})` },
          { key: 'requests', label: `Requests (${requests.length})` },
          { key: 'donations', label: `Donations (${donations.length})` },
          { key: 'departments', label: `Departments (${departments.length})` },
          { key: 'logs', label: `Reports & Logs (${reports.length})` },
          { key: 'settings', label: 'Settings' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as AdminTab)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === item.key
                ? 'bg-[#C62828] text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 1. Blood Group Distribution */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Blood Group Distribution
              </h2>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.bloodGroupData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="group" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#C62828" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Department-wise Donors */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Department-wise Donors
              </h2>
              <div className="mt-4 h-64 w-full">
                {analytics.departmentData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No donor records available yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.departmentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="department" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0F172A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* 3. Monthly Donation Trends */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Monthly Donation Trends
              </h2>
              <div className="mt-4 h-64 w-full">
                {analytics.monthlyTrends.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No completed donation history recorded yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="units" stroke="#C62828" strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* 4. Request Status Distribution */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Request Status Distribution
              </h2>
              <div className="mt-4 h-64 w-full">
                {analytics.requestStatusData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No blood requests recorded yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.requestStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {analytics.requestStatusData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center dark:border-slate-800">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                User, Donor & Moderator Management
              </h2>
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name, email, or student ID..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:w-72 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Student ID</th>
                    <th className="px-4 py-3 font-semibold">Group</th>
                    <th className="px-4 py-3 font-semibold">Verification</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{u.full_name}</p>
                        <p className="text-slate-500">{u.email}</p>
                      </td>
                      <td className="font-mono-tabular px-4 py-3">{u.student_id}</td>
                      <td className="font-bold text-[#C62828] px-4 py-3">
                        {u.donor_details?.blood_group || '—'}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {u.donor_details?.verification_status || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Role for ${u.full_name}`}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="student">Student / Donor</option>
                          <option value="moderator">Moderator</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(u.id, !u.is_active)}
                          className={`rounded px-2.5 py-1 font-semibold ${
                            u.is_active
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                          }`}
                        >
                          {u.is_active ? 'Active' : 'Suspended'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'verifications' && (
          <div className="space-y-3">
            {verifications.map((v) => (
              <div
                key={v.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <p className="text-xs text-slate-500">
                    <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-[#C62828]" />
                    <span className="capitalize font-semibold">{v.status}</span> ·{' '}
                    {v.requested_blood_group} · ID {v.student_id_snapshot}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                    {v.profile?.full_name || 'Student'}
                  </p>
                </div>
                {v.status === 'pending' &&
                  (v.user_id === user?.id ? (
                    <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                      Own verification (requires another moderator/admin)
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleReviewVerification(v.id, 'approved')}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewVerification(v.id, 'rejected')}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-[#C62828] hover:bg-red-50 dark:border-red-900 dark:text-red-400"
                      >
                        Reject
                      </button>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}

        {tab === 'requests' && (
          <div className="space-y-3">
            {requests.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                No blood donation requests found.
              </div>
            ) : (
              requests.map((r) => {
                const isBusy = Boolean(busyRequestIds[r.id]);
                return (
                  <div
                    key={r.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 font-semibold ${getRequestStatusBadgeClass(
                            r.status
                          )}`}
                        >
                          {formatRequestStatusLabel(r.status)}
                        </span>
                        <span>·</span>
                        <span>
                          {r.required_blood_group} · {r.bags_needed} bags · {r.required_date}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                        {r.patient_name} — {r.hospital_name}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.status === 'pending' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleModerateRequest(r.id, 'verified')}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? 'Updating...' : 'Verify'}
                        </button>
                      )}
                      {canCompleteBloodRequest(r.status) && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleModerateRequest(r.id, 'completed')}
                          className="rounded-lg bg-[#C62828] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#B71C1C] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? 'Completing...' : 'Donation Complete'}
                        </button>
                      )}
                      {r.status === 'completed' && (
                        <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'donations' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <form
              onSubmit={handleRecordDonation}
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Record Verified Donation
              </h2>
              <div>
                <label className="block text-xs font-semibold">Donor</label>
                <select
                  required
                  value={donationForm.donorId}
                  onChange={(e) => {
                    const selected = users.find((u) => u.id === e.target.value);
                    setDonationForm({
                      ...donationForm,
                      donorId: e.target.value,
                      bloodGroup: selected?.donor_details?.blood_group || donationForm.bloodGroup,
                    });
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">Select donor</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.donor_details?.blood_group || '?'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold">Blood Group</label>
                  <select
                    value={donationForm.bloodGroup}
                    onChange={(e) =>
                      setDonationForm({ ...donationForm, bloodGroup: e.target.value as BloodGroup })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    {BLOOD_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold">Date</label>
                  <input
                    type="date"
                    value={donationForm.donationDate}
                    onChange={(e) =>
                      setDonationForm({ ...donationForm, donationDate: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold">Hospital</label>
                <input
                  type="text"
                  required
                  value={donationForm.hospitalName}
                  onChange={(e) =>
                    setDonationForm({ ...donationForm, hospitalName: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <button
                type="submit"
                disabled={recordingDonation}
                className="w-full rounded-lg bg-[#C62828] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B71C1C] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {recordingDonation ? 'Recording...' : 'Record Donation'}
              </button>
            </form>

            <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Donation History Ledger
              </h2>
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {donations.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {d.hospital_name}
                      </p>
                      <p className="font-mono-tabular text-slate-500">
                        {d.donation_date} · {d.units_donated} unit(s)
                      </p>
                    </div>
                    <span className="font-bold text-[#C62828]">{d.blood_group}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'departments' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <form
              onSubmit={handleAddDepartment}
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Add University Department
              </h2>
              <input
                type="text"
                placeholder="Code (e.g. LAW)"
                required
                value={newDept.code}
                onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="text"
                placeholder="Department Name (English)"
                required
                value={newDept.name}
                onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="text"
                placeholder="Department Name (Bangla, optional)"
                value={newDept.nameBn}
                onChange={(e) => setNewDept({ ...newDept, nameBn: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#C62828] px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Create Department
              </button>
            </form>

            <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Netrokona University Departments
              </h2>
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {departments.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {d.name} ({d.code})
                      </p>
                      {d.name_bn && <p className="text-xs text-slate-500">{d.name_bn}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleDepartment(d.id, !d.is_active)}
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold dark:border-slate-700"
                    >
                      {d.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'logs' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Community Reports
              </h2>
              <div className="mt-4 space-y-3">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800"
                  >
                    <p className="font-bold">
                      {rep.reason} ({rep.status})
                    </p>
                    <p className="mt-1 text-slate-600 dark:text-slate-400">{rep.details}</p>
                    {rep.status === 'open' && user && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolveReport(rep.id)}
                          className="rounded bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700"
                        >
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Immutable Activity Logs
              </h2>
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <span className="font-semibold">{l.action}</span>
                      <span className="text-slate-500"> · {l.target_table}</span>
                    </div>
                    <span className="font-mono-tabular text-slate-400">
                      {new Date(l.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-4">
            {settings.map((s) => (
              <div
                key={s.key}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {s.key}
                    </h3>
                    <p className="text-xs text-slate-500">{s.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveSetting(s.key)}
                    className="rounded-lg bg-[#C62828] px-3.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Save Setting
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={settingDrafts[s.key] || ''}
                  onChange={(e) => setSettingDrafts({ ...settingDrafts, [s.key]: e.target.value })}
                  className="font-mono mt-3 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
