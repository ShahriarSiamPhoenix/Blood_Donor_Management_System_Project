import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Droplets,
  Filter,
  MessageSquare,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { ContactDonorModal } from '../../components/donors/ContactDonorModal';
import { SearchableDepartmentSelect } from '../../components/common/SearchableDepartmentSelect';
import { CardGridSkeleton, EmptyState } from '../../components/common/StateFeedback';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  fetchActiveDepartments,
  searchPublicDonors,
} from '../../services/publicService';
import type { Department, PublicDonor } from '../../types/database';
import { BLOOD_GROUPS, getDonationIntervalStatus } from '../../utils/bloodCompatibility';

const PAGE_SIZE = 12;

export function FindDonorsPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [bloodGroup, setBloodGroup] = useState(searchParams.get('bloodGroup') || '');
  const [departmentId, setDepartmentId] = useState('');
  const [batch, setBatch] = useState('');
  const [location, setLocation] = useState('');
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [page, setPage] = useState(1);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [donors, setDonors] = useState<PublicDonor[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDonor, setSelectedDonor] = useState<PublicDonor | null>(null);

  useEffect(() => {
    fetchActiveDepartments().then(setDepartments);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadDonors() {
      setLoading(true);
      setError(null);
      const res = await searchPublicDonors({
        bloodGroup,
        departmentId,
        batch,
        location,
        onlyEligible,
        page,
        pageSize: PAGE_SIZE,
      });
      if (!active) return;
      setDonors(res.donors);
      setTotalCount(res.totalCount);
      setError(res.error);
      setLoading(false);
    }
    loadDonors();
    return () => {
      active = false;
    };
  }, [bloodGroup, departmentId, batch, location, onlyEligible, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const resetFilters = () => {
    setBloodGroup('');
    setDepartmentId('');
    setBatch('');
    setLocation('');
    setOnlyEligible(false);
    setPage(1);
    setSearchParams({});
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t.donors.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {t.donors.subtitle}
          </p>
        </div>
        <Link
          to="/requests/new"
          className="inline-flex items-center justify-center rounded-lg bg-[#C62828] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B71C1C] whitespace-nowrap shrink-0"
        >
          Post Blood Request
        </Link>
      </div>

      {/* Filter Toolbar */}
      <section
        aria-label="Donor search filters"
        className="mt-8 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Filter className="h-4 w-4 text-[#C62828] dark:text-red-400" />
            <span>Filter Verified Available Donors</span>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Filters
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label
              htmlFor="filter-blood-group"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Blood Group
            </label>
            <select
              id="filter-blood-group"
              value={bloodGroup}
              onChange={(e) => {
                setBloodGroup(e.target.value);
                setPage(1);
              }}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#C62828] focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All Blood Groups</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-department"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Department
            </label>
            <SearchableDepartmentSelect
              id="filter-department"
              value={departmentId}
              onChange={(val) => {
                setDepartmentId(val);
                setPage(1);
              }}
              departments={departments}
              placeholder="All Departments"
              emptyOptionLabel="All Departments"
              allowClear
              compact
            />
          </div>

          <div>
            <label
              htmlFor="filter-batch"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Batch
            </label>
            <input
              id="filter-batch"
              type="text"
              value={batch}
              onChange={(e) => {
                setBatch(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. 2021-22 or 4th"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#C62828] focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="filter-location"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Location
            </label>
            <input
              id="filter-location"
              type="text"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. Netrokona, Campus"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#C62828] focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="flex items-end">
            <label className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <input
                type="checkbox"
                checked={onlyEligible}
                onChange={(e) => {
                  setOnlyEligible(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded accent-[#C62828]"
              />
              <span>90+ days since last donation</span>
            </label>
          </div>
        </div>
      </section>

      {/* Results Header */}
      <div className="mt-6 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-mono-tabular">
          {loading ? 'Searching donors...' : `${totalCount} verified available donors found`}
        </span>
        <span className="font-mono-tabular">
          Page {page} of {totalPages}
        </span>
      </div>

      {/* Results Grid */}
      <div className="mt-4">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            Error loading donors: {error}
          </div>
        )}

        {loading ? (
          <CardGridSkeleton count={6} />
        ) : donors.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title={t.donors.noResults}
            description="Only moderator-verified donors who are currently marked Available and opted into Public Discovery are listed here."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Clear Filters
                </button>
                <Link
                  to="/register"
                  className="rounded-lg bg-[#C62828] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B71C1C]"
                >
                  Register as a Donor
                </Link>
              </div>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {donors.map((donor) => {
              const interval = getDonationIntervalStatus(donor.last_donation_date);
              return (
                <article
                  key={donor.donor_id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {donor.avatar_url ? (
                          <img
                            src={donor.avatar_url}
                            alt={donor.display_name}
                            referrerPolicy="no-referrer"
                            className="h-11 w-11 shrink-0 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {(donor.display_name || 'ND').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-bold text-slate-900 dark:text-white">
                            {donor.display_name}
                          </h2>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                            <span>Verified Donor</span>
                          </div>
                        </div>
                      </div>

                      <span className="font-display shrink-0 rounded-lg bg-[#C62828] px-2.5 py-1 text-base font-extrabold text-white">
                        {donor.blood_group}
                      </span>
                    </div>

                    {/* Clean unboxed metadata with typographic separators */}
                    <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <span>{donor.department_name}</span>
                      <span aria-hidden="true">·</span>
                      <span>Batch {donor.batch}</span>
                      <span aria-hidden="true">·</span>
                      <span>{donor.location}</span>
                    </div>

                    <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Availability</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          Available
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Recorded Donations</span>
                        <span className="font-mono-tabular font-semibold text-slate-800 dark:text-slate-200">
                          {donor.total_donations}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Last Donation</span>
                        <span className="font-mono-tabular">
                          {donor.last_donation_date
                            ? `${donor.last_donation_date} (${interval.daysSinceLastDonation}d ago)`
                            : 'Not listed'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedDonor(donor)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:border-[#C62828] hover:bg-red-50 hover:text-[#C62828] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-red-500 dark:hover:bg-red-950/30"
                  >
                    <MessageSquare className="h-4 w-4" />
                    {t.donors.requestContact}
                  </button>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalCount > PAGE_SIZE && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="font-mono-tabular text-xs font-semibold text-slate-600 dark:text-slate-300">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Educational reminder */}
      <div className="mt-10 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <Droplets className="h-4 w-4 shrink-0 text-[#C62828] dark:text-red-400" />
        <span>
          Hospital blood banks must perform full ABO/Rh crossmatching and donor health screening
          before any transfusion.
        </span>
      </div>

      <ContactDonorModal donor={selectedDonor} onClose={() => setSelectedDonor(null)} />
    </div>
  );
}
