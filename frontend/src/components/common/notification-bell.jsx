'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { Bell } from 'lucide-react';
import { getNotifications } from '@/services/notifications';

const POLL_MS = 30000;

export default function NotificationBell() {
  const router = useRouter();
  const token = useSelector((state) => state.auth.token);
  const [data, setData] = useState({ total: 0, groups: [] });
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const response = await getNotifications(token);
      setData(response.data.notifications || { total: 0, groups: [] });
    } catch {
      // keep the last known state; the next poll retries
    }
  }, [token]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function go(href) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        className="icon-button notif-trigger"
        aria-label={`Notifications${data.total ? `, ${data.total} pending` : ''}`}
        aria-expanded={open}
        onClick={() => { setOpen((v) => !v); load(); }}
      >
        <Bell size={20} />
        {data.total > 0 && <span className="notif-badge" data-testid="notification-badge">{data.total > 99 ? '99+' : data.total}</span>}
      </button>
      {open && (
        <div className="notif-menu" role="menu">
          <div className="notif-title">Pending actions</div>
          {data.groups.length === 0 && <p className="notif-empty">You are all caught up.</p>}
          {data.groups.map((group) => (
            <div key={group.key} className="notif-group">
              <button className={`notif-group-head notif-${group.severity}`} onClick={() => go(group.href)}>
                <span>{group.label}</span><strong>{group.count}</strong>
              </button>
              {group.items.slice(0, 3).map((item) => (
                <button key={item.id} className="notif-item" role="menuitem" onClick={() => go(item.href)}>{item.title}</button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
