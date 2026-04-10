import { Boxes, ChartColumnBig, FileSpreadsheet, LayoutDashboard, MoonStar, Settings, SunMedium } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui';

const navigationItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/imports', label: 'Imports', icon: FileSpreadsheet },
  { to: '/reports', label: 'Reports', icon: ChartColumnBig },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-panel">
          <span className="brand-panel__eyebrow">Inventory SaaS</span>
          <h1>InventorySelf</h1>
          <p>Run a clean inventory operation with your own Databricks workspace behind it.</p>
        </div>
        <nav className="sidebar__nav">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  ['sidebar__link', isActive ? 'sidebar__link--active' : '']
                    .filter(Boolean)
                    .join(' ')
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="app-shell__content">
        <header className="topbar">
          <div>
            <span className="topbar__eyebrow">Operations Console</span>
            <h2>{user ? `Welcome back, ${user.username}` : 'Welcome back'}</h2>
          </div>
          <div className="topbar__actions">
            <Button variant="ghost" type="button" onClick={toggleTheme}>
              {theme === 'light' ? <MoonStar size={16} /> : <SunMedium size={16} />}
              <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
            >
              Sign out
            </Button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
