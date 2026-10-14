'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Menu, UserRound } from 'lucide-react';

export default function Header({ section, onMenuClick }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
          <span className="user-details"><strong>Admin User</strong><small>Super Admin</small></span>
          <ChevronDown size={16} className={userMenuOpen ? 'chevron-up' : ''} />
        </button>
        {userMenuOpen && (
          <div className="user-menu" role="menu">
            <div className="user-menu-info"><strong>Admin User</strong><span>Super Admin</span></div>
            <Link href="/settings" role="menuitem" onClick={() => setUserMenuOpen(false)}>Settings</Link>
          </div>
        )}
      </div>
    </header>
  );
}