import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Globe, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BrandLogo } from '../common/BrandLogo';
import { NotificationBell } from '../common/NotificationBell';

export function Navbar() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const dashboardPath =
    profile?.role === 'super_admin'
      ? '/admin'
      : profile?.role === 'moderator'
        ? '/moderator'
        : '/dashboard';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap shrink-0 text-sm font-medium transition-colors py-1 border-b-2 ${
      isActive
        ? 'border-[#C62828] text-[#C62828] dark:border-red-400 dark:text-red-400'
        : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
    }`;

  const handleSignOut = async () => {
    await signOut();
    setMobileOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          <BrandLogo className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
          <span className="font-display text-sm font-bold tracking-tight text-slate-900 sm:text-lg dark:text-white">
            {t.brandName}
          </span>
        </Link>

        {/* Zone 2: 5 concise single-line nav links */}
        <nav aria-label="Primary navigation" className="hidden items-center gap-6 lg:flex">
          <NavLink to="/" end className={navLinkClass}>
            {t.nav.home}
          </NavLink>
          <NavLink to="/donors" className={navLinkClass}>
            {t.nav.findDonors}
          </NavLink>
          <NavLink to="/requests" className={navLinkClass}>
            {t.nav.requests}
          </NavLink>
          <NavLink to="/compatibility" className={navLinkClass}>
            {t.nav.compatibility}
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            {t.nav.about}
          </NavLink>
        </nav>

        {/* Zone 3: Utilities + Primary Action */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={language === 'en' ? 'Switch language to Bangla' : 'Switch language to English'}
            className="flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 sm:h-10 sm:gap-1.5 sm:px-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{language === 'en' ? 'বাংলা' : 'EN'}</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 shrink-0 sm:h-10 sm:w-10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          {user && <NotificationBell />}

          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                to={dashboardPath}
                className="rounded-lg bg-[#C62828] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#B71C1C] whitespace-nowrap shrink-0"
              >
                {t.nav.dashboard}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label={t.nav.signOut}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden rounded-lg bg-[#C62828] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#B71C1C] whitespace-nowrap shrink-0 sm:inline-flex"
            >
              {t.nav.signIn}
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 lg:hidden sm:h-10 sm:w-10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden dark:border-slate-800 dark:bg-slate-900">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {[
              { to: '/', label: t.nav.home },
              { to: '/donors', label: t.nav.findDonors },
              { to: '/requests', label: t.nav.requests },
              { to: '/compatibility', label: t.nav.compatibility },
              { to: '/about', label: t.nav.about },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive
                      ? 'bg-red-50 text-[#C62828] dark:bg-red-950/40 dark:text-red-400'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}

            <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              {user ? (
                <>
                  <Link
                    to={dashboardPath}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg bg-[#C62828] px-4 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    {t.nav.dashboard}
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    {t.nav.signOut}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg bg-[#C62828] px-4 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    {t.nav.signIn}
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    {t.nav.register}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
