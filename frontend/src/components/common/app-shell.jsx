'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Header from './header';
import Sidebar from './sidebar';
import { getCurrentSection } from './navigation';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (pathname === '/login') return children;

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