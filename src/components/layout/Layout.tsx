import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { SupabaseNoticeBanner } from '../common/SupabaseNoticeBanner';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <SupabaseNoticeBanner />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
