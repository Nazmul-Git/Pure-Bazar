'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { navigationItems } from './navigation';
import useAuth from '@/store/use-auth';

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { canAccess } = useAuth();
  const visibleItems = navigationItems.filter((item) => (
    canAccess(item.permissions)
    || item.children?.some((child) => canAccess(child.permissions))
  ));

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
          {visibleItems.map(({ label, href, icon: Icon, permissions, children = [] }) => {
            const section = href.split('/')[1];
            const itemAccessible = canAccess(permissions);
            const active = pathname === href
              || (!children.length && pathname.startsWith(`/${section}/`));
            const visibleChildren = children.filter((child) => canAccess(child.permissions));
            return (
              <div key={label}>
                {itemAccessible ? (
                  <Link
                    href={href}
                    className={`nav-link${active ? ' nav-link-active' : ''}`}
                    aria-current={pathname === href ? 'page' : undefined}
                    onClick={onClose}
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                ) : (
                  <div className="nav-link" aria-hidden="true">
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </div>
                )}
                {visibleChildren.map(({ label: childLabel, href: childHref, icon: ChildIcon }) => {
                  const childActive = pathname === childHref;
                  return (
                    <Link
                      href={childHref}
                      key={childHref}
                      className={`nav-link ml-4 min-h-[36px] text-sm${childActive ? ' nav-link-active' : ''}`}
                      aria-current={childActive ? 'page' : undefined}
                      onClick={onClose}
                    >
                      <ChildIcon size={17} strokeWidth={1.8} aria-hidden="true" />
                      <span>{childLabel}</span>
                    </Link>
                  );
                })}
              </div>
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