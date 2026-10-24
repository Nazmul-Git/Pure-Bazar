"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { getPageKey, navigationItems } from "./navigation";
import useAuth from "@/store/use-auth";
import ThemeToggle from "./theme-toggle";

const matches = (pathname, href) =>
  pathname === href || pathname.startsWith(`${href}/`);

const allLinks = navigationItems.flatMap((item) =>
  (item.children || [item]).filter((link) => !link.noActive),
);

// Longest matching href wins so /vendors/payouts/history does not also light up /vendors/payouts.
function getActiveHref(pathname) {
  return allLinks
    .filter((link) => matches(pathname, link.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { canAccess } = useAuth();
  const canSee = (item) => canAccess(item.permissions, getPageKey(item.href));
  const activeHref = getActiveHref(pathname);
  const activeGroup = navigationItems.find((item) =>
    item.children?.some(
      (child) => !child.noActive && child.href === activeHref,
    ),
  )?.label;
  // Track the route the user manually toggled for, so navigation re-expands the active group.
  const [toggle, setToggle] = useState({ path: pathname, group: activeGroup });
  const openGroup = toggle.path === pathname ? toggle.group : activeGroup;

  const toggleGroup = (label) => {
    setToggle({ path: pathname, group: openGroup === label ? null : label });
  };

  return (
    <>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}
      <aside
        className={`sidebar${open ? " sidebar-open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <Link href="/dashboard" className="brand-link" onClick={onClose}>
            <img
              src="/logo.png"
              alt="PureBazar Logo"
              className="brand-logo-img"
              style={{ height: "46px", width: "auto", objectFit: "contain" }}
            />
          </Link>
          <button
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const { label, href, icon: Icon, children } = item;
            if (!children) {
              if (!canSee(item)) return null;
              const active = activeHref === href;
              return (
                <Link
                  key={label}
                  href={href}
                  className={`nav-link${active ? " nav-link-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={onClose}
                >
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              );
            }
            const visibleChildren = children.filter((child) => canSee(child));
            if (!visibleChildren.length) return null;
            const expanded = openGroup === label;
            const groupActive = activeGroup === label;
            const panelId = `nav-group-${label.replace(/\W+/g, "-").toLowerCase()}`;
            return (
              <div key={label}>
                <button
                  type="button"
                  className={`nav-link nav-group-toggle${groupActive ? " nav-group-active" : ""}`}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => toggleGroup(label)}
                >
                  <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                  <span>{label}</span>
                  <ChevronDown
                    size={16}
                    className={`nav-chevron${expanded ? " nav-chevron-open" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                <div
                  id={panelId}
                  className={`nav-sub${expanded ? " nav-sub-open" : ""}`}
                >
                  <div className="nav-sub-inner">
                    {visibleChildren.map(
                      ({
                        label: childLabel,
                        href: childHref,
                        icon: ChildIcon,
                      }) => {
                        const childActive = activeHref === childHref;
                        return (
                          <Link
                            href={childHref}
                            key={childLabel}
                            tabIndex={expanded ? 0 : -1}
                            className={`nav-sublink${childActive ? " nav-sublink-active" : ""}`}
                            aria-current={childActive ? "page" : undefined}
                            onClick={onClose}
                          >
                            <ChildIcon
                              size={16}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                            <span>{childLabel}</span>
                          </Link>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>Offline workspace</span>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
