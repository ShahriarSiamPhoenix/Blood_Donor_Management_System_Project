import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Droplets,
  HeartHandshake,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  EMPTY_PLATFORM_STATS,
  fetchApprovedTestimonials,
  fetchPublicBloodRequests,
  fetchPublicPlatformStats,
} from '../../services/publicService';
import type { PublicBloodRequest, PublicPlatformStats, TestimonialItem } from '../../types/database';
import { BLOOD_GROUPS } from '../../utils/bloodCompatibility';
import { formatRequestStatusLabel, getRequestStatusBadgeClass } from '../../utils/requestStatus';
import donorCareImg from '../../assets/images/about_donor_care_1794561232149.jpg';

const FAQS = [
  {
    q: 'Who can register as a donor on Campus Blood Connect?',
    a: 'Students, faculty, and staff of Netrokona University can register. Every donor profile undergoes manual review by a campus moderator before appearing in public donor searches.',
  },
  {
    q: 'Are my phone number and Student ID visible to the public?',
    a: 'No. Public donor search results never expose phone numbers, email addresses, or Student IDs. Requesters send an in-app contact request, and you decide whether to accept and share your contact.',
  },
  {
    q: 'How does community blood request publishing work?',
    a: 'Registered members can submit blood requests and have them published immediately without waiting for admin approval. Other donors express interest in-app, and the request owner selects the donor and marks the donation complete.',
  },
  {
    q: 'Does this platform guarantee transfusion compatibility or medical eligibility?',
    a: 'No. Campus Blood Connect only coordinates voluntary donors. Hospital blood banks must perform formal crossmatching, screening, and medical eligibility clearance before any donation or transfusion.',
  },
];

export function HomePage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<PublicPlatformStats>(EMPTY_PLATFORM_STATS);
  const [recentRequests, setRecentRequests] = useState<PublicBloodRequest[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [careImgFailed, setCareImgFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [statsRes, reqRes, testRes] = await Promise.all([
          fetchPublicPlatformStats(),
          fetchPublicBloodRequests({ page: 1, pageSize: 4 }),
          fetchApprovedTestimonials(),
        ]);
        if (!active) return;
        setStats(statsRes.stats);
        setSchemaError(statsRes.error);
        setRecentRequests(reqRes.requests);
        setTestimonials(testRes);
      } catch {
        // Keep safe defaults
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      {/* 1. Hero Section */}
      <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-sm font-semibold text-[#C62828] dark:text-red-400">
                {t.universityName} · Bangladesh
              </p>
              <h1
                className="font-display mt-3 font-extrabold tracking-tight text-slate-900 dark:text-white"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', lineHeight: 1.1, textWrap: 'balance' }}
              >
                {t.hero.headline}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                {t.hero.subheadline}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/donors"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#C62828] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#B71C1C] whitespace-nowrap shrink-0"
                >
                  <Search className="h-4 w-4" />
                  {t.hero.primaryCta}
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <UserPlus className="h-4 w-4" />
                  {t.hero.secondaryCta}
                </Link>
                <Link
                  to="/requests/new"
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-[#C62828] transition-colors hover:bg-red-100 whitespace-nowrap shrink-0 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                >
                  <AlertCircle className="h-4 w-4" />
                  {t.hero.emergencyCta}
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-64 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                {!heroImgFailed ? (
                  <img
                    src="/assets/aistudio/Sunset_Reflections_at_TSC_Campus_eee489ad.png"
                    alt="Netrokona University campus reflected in water at sunset"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="h-full w-full object-cover lg:min-h-[380px]"
                  />
                ) : (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center bg-gradient-to-br from-red-50 to-slate-100 p-8 text-center dark:from-red-950/40 dark:to-slate-900">
                    <Droplets className="h-12 w-12 text-[#C62828]" />
                    <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Netrokona University Donor Network
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {schemaError && (
            <div
              role="status"
              className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <span className="font-semibold">Database migrations pending:</span> Supabase is
              connected, but the database tables/RPCs are not yet initialized ({schemaError}). Run{' '}
              <code className="font-mono">supabase/migrations/001_initial_schema.sql</code>,{' '}
              <code className="font-mono">002_rls_and_security.sql</code>, and{' '}
              <code className="font-mono">003_storage_and_seed.sql</code> in your Supabase SQL
              Editor.
            </div>
          )}

          {/* 4-Column Live Supabase Statistics Strip */}
          <div className="mt-10 grid grid-cols-2 gap-4 border-t border-slate-200 pt-8 lg:grid-cols-4 dark:border-slate-800">
            {[
              { label: t.stats.totalDonors, value: stats.total_donors },
              { label: t.stats.verifiedDonors, value: stats.verified_donors },
              { label: t.stats.successfulDonations, value: stats.total_donations },
              { label: t.stats.activeRequests, value: stats.active_requests },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {item.label}
                </p>
                <p className="font-mono-tabular mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                  {loading ? '—' : item.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Blood Group Availability Overview */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t.sections.bloodGroupAvailability}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Live count of verified, publicly discoverable student donors currently marked available.
            </p>
          </div>
          <Link
            to="/donors"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#C62828] hover:underline dark:text-red-400"
          >
            Browse all donors
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {BLOOD_GROUPS.map((group) => {
            const count = stats.blood_group_counts[group] ?? 0;
            return (
              <Link
                key={group}
                to={`/donors?bloodGroup=${encodeURIComponent(group)}`}
                className="group rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#C62828] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-red-500"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl font-extrabold text-[#C62828] dark:text-red-400">
                    {group}
                  </span>
                  <Droplets className="h-4 w-4 text-slate-300 transition-colors group-hover:text-[#C62828] dark:text-slate-600" />
                </div>
                <p className="font-mono-tabular mt-3 text-lg font-bold text-slate-900 dark:text-white">
                  {loading ? '—' : count}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {count === 1 ? 'donor ready' : 'donors ready'}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. Recent Verified Blood Requests */}
      <section className="border-y border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {t.sections.recentRequests}
              </h2>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                Active and recently completed hospital requests posted by campus members.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/requests/new"
                className="text-sm font-semibold text-[#C62828] hover:underline dark:text-red-400"
              >
                Submit a request
              </Link>
              <Link
                to="/requests"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-36 animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                  />
                ))}
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-950">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No active blood requests right now.
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Need urgent blood at Netrokona Sadar Hospital or nearby clinics? Submit a request
                  to publish it immediately for campus donors.
                </p>
                <Link
                  to="/requests/new"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#C62828] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B71C1C]"
                >
                  Request Blood Support
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {recentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          {req.is_emergency && req.status !== 'completed' && (
                            <span className="font-semibold text-[#C62828] dark:text-red-400">
                              Emergency
                            </span>
                          )}
                          {req.is_emergency && req.status !== 'completed' && <span aria-hidden="true">·</span>}
                          <span
                            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${getRequestStatusBadgeClass(
                              req.status
                            )}`}
                          >
                            {formatRequestStatusLabel(req.status)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {req.bags_needed} {req.bags_needed === 1 ? 'bag' : 'bags'}
                          </span>
                        </div>
                        <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                          {req.hospital_name}
                        </h3>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                          {req.hospital_location} · Needed {req.required_date}
                        </p>
                      </div>
                      <span className="font-display shrink-0 rounded-lg bg-[#C62828] px-3 py-1.5 text-base font-bold text-white">
                        {req.required_blood_group}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                      {req.emergency_description}
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">
                        Contact: {req.contact_person}
                      </span>
                      <Link
                        to={`/requests?requestId=${encodeURIComponent(req.id)}`}
                        className="font-semibold text-[#C62828] hover:underline dark:text-red-400"
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. How It Works & Why Donate Blood */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t.sections.howItWorks}
            </h2>
            <div className="mt-8 space-y-6">
              {[
                {
                  step: '01. Student Registration & Moderator Verification',
                  text: 'Students register with their Netrokona University details and blood group. Campus moderators verify student identity before activating public donor visibility.',
                },
                {
                  step: '02. Privacy-Protected Donor Discovery',
                  text: 'Search verified, currently available donors by blood group, department, batch, and location. Personal phone numbers and Student IDs remain hidden from public pages.',
                },
                {
                  step: '03. Authorized Contact & Hospital Confirmation',
                  text: 'Send an in-app contact request to matching donors or post a verified emergency request. Hospital blood banks perform all medical screening and crossmatching.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="border-b border-slate-200 pb-6 last:border-b-0 dark:border-slate-800"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{item.step}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {!careImgFailed ? (
                <img
                  src={donorCareImg}
                  alt="Medical volunteer checking a university blood donor at a campus drive"
                  referrerPolicy="no-referrer"
                  onError={() => setCareImgFailed(true)}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 dark:bg-slate-800">
                  <HeartHandshake className="h-12 w-12 text-[#C62828]" />
                </div>
              )}
              <div className="p-6">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {t.sections.whyDonate}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  In Netrokona and surrounding districts, timely voluntary blood support for trauma
                  cases, surgeries, and thalassemia care depends on organized local donor networks.
                  One voluntary donation can support multiple patients when processed into red cells,
                  platelets, and plasma.
                </p>
                <Link
                  to="/compatibility"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#C62828] hover:underline dark:text-red-400"
                >
                  Explore ABO/Rh compatibility guide
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Approved Student Testimonials (Real Submissions Only) */}
      <section className="border-y border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t.sections.testimonials}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Verified reflections submitted by registered Netrokona University students and approved
            by moderators.
          </p>

          {testimonials.length === 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No approved student testimonials have been published yet. Verified donors can submit
                their real donation experience directly from the Student Dashboard.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {testimonials.map((item) => (
                <blockquote
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950"
                >
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    "{item.quote}"
                  </p>
                  <footer className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {item.profile?.full_name || 'Campus Donor'}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span>{item.role_label}</span>
                    {item.profile?.department?.name && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>{item.profile.department.name}</span>
                      </>
                    )}
                  </footer>
                </blockquote>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 6. FAQ & Contact Information */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t.sections.faq}
            </h2>
            <div className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {FAQS.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={faq.q}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/60"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {t.sections.contact}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Reach the Campus Blood Connect moderation team at Netrokona University for donor
                verification questions, urgent hospital coordination, or department onboarding.
              </p>

              <div className="mt-6 space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#C62828] dark:text-red-400" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">University Campus</p>
                    <p className="text-slate-600 dark:text-slate-400">
                      Netrokona University, Netrokona-2400, Bangladesh
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#C62828] dark:text-red-400" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">Official Email</p>
                    <a
                      href="mailto:siam62326@gmail.com"
                      className="inline-block break-all text-slate-600 transition-colors hover:text-[#C62828] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C62828]/50 dark:text-slate-400 dark:hover:text-red-400"
                    >
                      siam62326@gmail.com
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#C62828] dark:text-red-400" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">Medical Notice</p>
                    <p className="text-slate-600 dark:text-slate-400">
                      All transfusions and donor eligibility checks must be performed by qualified
                      hospital blood bank staff.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
