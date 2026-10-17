'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { navigationItems } from './navigation';
import useAuth from '@/store/use-auth';

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { canAccess } = useAuth();
  const visibleItems = navigationItems.filter((item) => canAccess(item.permissions));

  return (
    <>
      {open && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar${open ? ' sidebar-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <Link href="/dashboard" className="brand-link" onClick={onClose}>
            <span className="brand-mark" aria-hidden="true">P</span>
            <span className="brand-name">PureBazar</span>
          </Link>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <p className="nav-caption">WORKSPACE</p>
          {visibleItems.map(({ label, href, icon: Icon }) => {
            const section = href.split('/')[1];
            const active = pathname === href || pathname.startsWith(`/${section}/`);
            return (
              <Link
                href={href}
                key={label}
                className={`nav-link${active ? ' nav-link-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={onClose}
              >
                <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>Offline workspace</span>
        </div>
      </aside>
    </>
  );
}