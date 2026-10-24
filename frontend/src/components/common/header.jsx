'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, Menu, Settings, UserRound } from 'lucide-react';
import useAuth from '@/store/use-auth';
import Button from '@/components/ui/button';

export default function Header({ section, onMenuClick }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const wrapRef = useRef(null);
  const [logoutError, setLogoutError] = useState('');
  const { user, logout, status, canAccess } = useAuth();

  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setUserMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setUserMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [userMenuOpen]);

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
      <div className="user-menu-wrap" ref={wrapRef}>
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
            <div className="user-menu-info">
              <span className="user-menu-avatar"><UserRound size={20} /></span>
              <div className="user-menu-who"><strong>{user?.name || user?.email}</strong><span className="user-role-badge">{user?.role || 'Staff'}</span></div>
            </div>
            {logoutError && <p className="user-menu-error" role="alert">{logoutError}</p>}
            {canAccess(['settings:read']) && <Link href="/settings" role="menuitem" className="user-menu-item" onClick={() => setUserMenuOpen(false)}><Settings size={16} />Settings</Link>}
            <Button className="user-menu-logout" variant="ghost" size="sm" role="menuitem" disabled={status === 'loading'} onClick={handleLogout}>
              <LogOut size={16} />{status === 'loading' ? 'Signing out...' : 'Sign out'}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}