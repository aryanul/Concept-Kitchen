import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppLayout() {
  const location = useLocation();
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--ck-bg)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar />
        <main
          key={location.pathname}
          className="ck-page-enter"
          style={{ padding: '18px 24px 48px', flex: 1 }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
