'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Menu, UserRound } from 'lucide-react';
import useAuth from '@/store/use-auth';
import Button from '@/components/ui/button';

export default function Header({ section, onMenuClick }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { user, logout, status, canAccess } = useAuth();

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
    } catch (error) {
      setLogoutError(typeof error === 'string' ? error : error.message || 'Unable to sign out. Please try again.');
    }
  }

  return (
    <header className="app-header">
      <div className="header-leading">
        <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={onMenuClick}>
          <Menu size={21} />
        </button>
        <div className="header-context">
          <span className="header-eyebrow">PUREBAZAR</span>
          <span className="header-section">{section}</span>
        </div>
      </div>
      <div className="user-menu-wrap">
        <button
          className="user-menu-trigger"
          aria-expanded={userMenuOpen}
          aria-haspopup="menu"
          onClick={() => setUserMenuOpen((open) => !open)}
        >
          <span className="user-avatar"><UserRound size={18} /></span>
          <span className="user-details"><strong>{user?.name || user?.email}</strong><small>{user?.role || 'Staff'}</small></span>
          <ChevronDown size={16} className={userMenuOpen ? 'chevron-up' : ''} />
        </button>
        {userMenuOpen && (
          <div className="user-menu" role="menu">
            <div className="user-menu-info"><strong>{user?.name || user?.email}</strong><span>{user?.role || 'Staff'}</span></div>
            {logoutError && <p className="user-menu-error" role="alert">{logoutError}</p>}
            {canAccess(['settings:read']) && <Link href="/settings" role="menuitem" onClick={() => setUserMenuOpen(false)}>Settings</Link>}
            <Button className="user-menu-logout" variant="ghost" size="sm" role="menuitem" disabled={status === 'loading'} onClick={handleLogout}>
              {status === 'loading' ? 'Signing out...' : 'Sign out'}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}