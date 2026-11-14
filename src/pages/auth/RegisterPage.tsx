import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { SearchableDepartmentSelect } from '../../components/common/SearchableDepartmentSelect';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getConfiguredUniversityDomain } from '../../lib/supabase';
import { fetchActiveDepartments, fetchPublicPlatformSettings } from '../../services/publicService';
import type { BloodGroup, Department } from '../../types/database';
import { BLOOD_GROUPS } from '../../utils/bloodCompatibility';
import { validateRegistrationForm } from '../../utils/validation';

export function RegisterPage() {
  const { signUp } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [emailConfig, setEmailConfig] = useState<{
    enforce_domain: boolean;
    allowed_domains: string[];
  }>({
    enforce_domain: false,
    allowed_domains: [getConfiguredUniversityDomain()],
  });

  const [form, setForm] = useState({
    fullName: '',
    studentId: '',
    email: '',
    departmentId: '',
    batch: '',
    phone: '',
    bloodGroup: 'O+' as BloodGroup,
    password: '',
    confirmPassword: '',
    agreedToPrivacy: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    fetchActiveDepartments().then(setDepartments);
    fetchPublicPlatformSettings().then((settings) => {
      const cfg = settings.university_email_config as
        | { enforce_domain?: boolean; allowed_domains?: string[] }
        | undefined;
      if (cfg) {
        setEmailConfig({
          enforce_domain: Boolean(cfg.enforce_domain),
          allowed_domains:
            Array.isArray(cfg.allowed_domains) && cfg.allowed_domains.length > 0
              ? cfg.allowed_domains
              : [getConfiguredUniversityDomain()],
        });
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const validationErrors = validateRegistrationForm({
      ...form,
      enforceUniversityDomain: emailConfig.enforce_domain,
      allowedDomains: emailConfig.allowed_domains,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    const res = await signUp({
      email: form.email,
      password: form.password,
      fullName: form.fullName,
      studentId: form.studentId,
      departmentId: form.departmentId,
      batch: form.batch,
      phone: form.phone,
      bloodGroup: form.bloodGroup,
    });
    setSubmitting(false);

    if (res.error) {
      setServerError(res.error);
      return;
    }

    if (res.needsEmailConfirmation) {
      setConfirmationSent(true);
      showToast(
        'Check Your Email',
        'success',
        'Please confirm your email address, then sign in. A moderator will review your Student ID.'
      );
      return;
    }

    showToast(
      'Registration Submitted',
      'success',
      'Your profile is pending moderator verification before appearing in public donor searches.'
    );
    navigate('/dashboard');
  };

  if (confirmationSent) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-600" />
          <h1 className="font-display mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            Verify Your Email Address
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            We sent a confirmation link to <strong>{form.email}</strong>. After verifying your email,
            sign in to upload your student ID proof if needed. A campus moderator will verify your
            donor status.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg bg-[#C62828] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B71C1C]"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Student Donor Registration
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          Netrokona University · All submitted Student IDs require moderator approval before public
          listing.
        </p>

        {serverError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="reg-full-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Full Name *
              </label>
              <input
                id="reg-full-name"
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
            </div>

            <div>
              <label
                htmlFor="reg-student-id"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Student ID (kept private) *
              </label>
              <input
                id="reg-student-id"
                type="text"
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                placeholder="e.g. 20220104012"
                className="font-mono-tabular mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              {errors.studentId && <p className="mt-1 text-xs text-red-600">{errors.studentId}</p>}
            </div>

            <div>
              <label
                htmlFor="reg-email"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                University Email *
              </label>
              <input
                id="reg-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={`name@${emailConfig.allowed_domains[0] || 'neu.ac.bd'}`}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label
                htmlFor="reg-phone"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Phone Number (kept private) *
              </label>
              <input
                id="reg-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="01712345678"
                className="font-mono-tabular mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
            </div>

            <div>
              <label
                htmlFor="reg-dept"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Department *
              </label>
              <SearchableDepartmentSelect
                id="reg-dept"
                value={form.departmentId}
                onChange={(departmentId) => {
                  setForm({ ...form, departmentId });
                  if (errors.departmentId) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.departmentId;
                      return next;
                    });
                  }
                }}
                departments={departments}
                placeholder="Select Your Department"
                required
                hasError={Boolean(errors.departmentId)}
                describedBy={errors.departmentId ? 'reg-dept-error' : undefined}
              />
              {errors.departmentId && (
                <p id="reg-dept-error" className="mt-1 text-xs text-red-600">
                  {errors.departmentId}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-batch"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Batch / Session *
              </label>
              <input
                id="reg-batch"
                type="text"
                value={form.batch}
                onChange={(e) => setForm({ ...form, batch: e.target.value })}
                placeholder="e.g. 2022-23 or 5th Batch"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              {errors.batch && <p className="mt-1 text-xs text-red-600">{errors.batch}</p>}
            </div>

            <div>
              <label
                htmlFor="reg-blood-group"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Blood Group *
              </label>
              <select
                id="reg-blood-group"
                value={form.bloodGroup}
                onChange={(e) => setForm({ ...form, bloodGroup: e.target.value as BloodGroup })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              {errors.bloodGroup && (
                <p className="mt-1 text-xs text-red-600">{errors.bloodGroup}</p>
              )}
            </div>

            <div className="hidden sm:block" />

            <div>
              <label
                htmlFor="reg-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Password (min 8 chars) *
              </label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>

            <div>
              <label
                htmlFor="reg-confirm-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Confirm Password *
              </label>
              <input
                id="reg-confirm-password"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div>
            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.agreedToPrivacy}
                onChange={(e) => setForm({ ...form, agreedToPrivacy: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded accent-[#C62828]"
              />
              <span>
                I agree to the Campus Blood Connect privacy policy. My Student ID and phone number
                will remain private and only my name, blood group, department, batch, and general
                availability will appear after moderator verification.
              </span>
            </label>
            {errors.agreedToPrivacy && (
              <p className="mt-1 text-xs text-red-600">{errors.agreedToPrivacy}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#C62828] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#B71C1C] disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {submitting ? 'Creating Account...' : 'Create Student Donor Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-600 dark:text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-[#C62828] hover:underline dark:text-red-400">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
