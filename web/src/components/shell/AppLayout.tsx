import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { IdleSessionGuard } from '../IdleSessionGuard';

export function AppLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--ck-bg)' }}>
      {/* Signs out after 30 min idle, and keeps active sessions alive */}
      <IdleSessionGuard />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="ck-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main key={location.pathname} className="ck-page-enter ck-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
