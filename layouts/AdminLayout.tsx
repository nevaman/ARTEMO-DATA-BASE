import { Outlet, Link, useLocation } from 'react-router-dom';
import React, { useState } from 'react';
import { ArtemoFullLogo, DashboardIcon, BoxIcon, UsersIcon, SettingsIcon, LogOutIcon, MenuIcon, XIcon, BellIcon } from '../components/Icons';
import { useUIStore } from '../stores/uiStore';

const AdminNavLink: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
}> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
        isActive
        ? 'bg-primary-accent text-text-on-accent'
        : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-page dark:hover:bg-dark-bg-page hover:text-light-text-primary dark:hover:text-dark-text-primary'
    }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
};

export const AdminLayout: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const adminNavItems = [
    { to: '/admin', icon: <DashboardIcon className="w-5 h-5" />, label: 'Dashboard' },
    { to: '/admin/categories', icon: <SettingsIcon className="w-5 h-5" />, label: 'Categories' },
    { to: '/admin/tools', icon: <BoxIcon className="w-5 h-5" />, label: 'Tools' },
    { to: '/admin/users', icon: <UsersIcon className="w-5 h-5" />, label: 'Users' },
    { to: '/admin/announcements', icon: <BellIcon className="w-5 h-5" />, label: 'Announcements' },
  ];

  return (
    <div className="flex h-screen bg-light-bg-primary dark:bg-dark-bg-primary">
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-light-bg-secondary dark:bg-dark-bg-secondary border-r border-light-border dark:border-dark-border
        transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out
        flex flex-col
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-light-border dark:border-dark-border">
          <ArtemoFullLogo className="h-8" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-page dark:hover:bg-dark-bg-page"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-grow space-y-2">
          {adminNavItems.map(item => <AdminNavLink key={item.to} {...item} />)}
        </nav>

        <div className="border-t border-light-border dark:border-dark-border pt-4">
          <Link 
            to="/"
            className="flex items-center gap-3 w-full px-4 py-3 rounded-md text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-page dark:hover:bg-dark-bg-page hover:text-light-text-primary dark:hover:text-dark-text-primary"
          >
            <LogOutIcon className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden bg-light-bg-secondary dark:bg-dark-bg-secondary border-b border-light-border dark:border-dark-border p-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-page dark:hover:bg-dark-bg-page"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};