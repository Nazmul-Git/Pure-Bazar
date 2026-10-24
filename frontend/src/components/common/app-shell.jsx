'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Header from './header';
import Sidebar from './sidebar';
import { getCurrentSection, getPageKey, getRoutePermissions } from './navigation';
import useAuth from '@/store/use-auth';
import { restoreAuth } from '@/store/auth-slice';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { initialized, isAuthenticated, canAccess } = useAuth();

  useEffect(() => {
    dispatch(restoreAuth());
  }, [dispatch]);

  useEffect(() => {
    if (!initialized) return;
    if (pathname === '/login' && isAuthenticated) router.replace('/dashboard');
    if (pathname !== '/login' && !isAuthenticated) router.replace('/login');
  }, [initialized, isAuthenticated, pathname, router]);

  if (!initialized) {
    return <main className="auth-status" role="status">Checking your session...</main>;
  }
  if (pathname === '/login') return isAuthenticated ? null : children;
  if (!isAuthenticated) return <main className="auth-status" role="status">Redirecting to sign in...</main>;
  if (!canAccess(getRoutePermissions(pathname), getPageKey(pathname))) {
    return (
      <main className="auth-status">
        <section className="access-denied">
          <h1>Access denied</h1>
          <p>Your role does not have permission to view this page.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="workspace">
        <Header section={getCurrentSection(pathname)} onMenuClick={() => setSidebarOpen(true)} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}