import React, { useState } from 'react';
import type { View } from '../types';
import { ArtemoFullLogo, DashboardIcon, BoxIcon, UsersIcon, SettingsIcon, LogOutIcon, MenuIcon, XIcon, BellIcon } from './Icons';

interface AdminLayoutProps {
  currentView: View;
  onNavigate: (view: View) => void;
  children: React.ReactNode;
}

const AdminNavLink: React.FC<{
  view: View;
  currentView: View;
  onNavigate: (view: View) => void;
  icon: React.ReactNode;
  label: string;
}> = ({ view, currentView, onNavigate, icon, label }) => (
  <a
    href="#"
    onClick={(e) => { e.preventDefault(); onNavigate(view); }}
    className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
      currentView === view
        ? 'bg-primary-accent text-text-on-accent'
        : 'text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-page dark:hover:bg-dark-bg-page hover:text-light-text-primary dark:hover:text-dark-text-primary'
    }`}
  >
    {icon}
    <span>{label}</span>
  </a>
);

export const AdminLayout: React.FC<AdminLayoutProps> = ({ currentView, onNavigate, children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const adminNavItems = [
    { view: 'admin-dashboard' as View, icon: <DashboardIcon className="w-5 h-5" />, label: 'Dashboard' },
    { view: 'admin-categories' as View, icon: <SettingsIcon className="w-5 h-5" />, label: 'Categories' },
    { view: 'admin-tools' as View, icon: <BoxIcon className="w-5 h-5" />, label: 'Tools' },
    { view: 'admin-users' as View, icon: <UsersIcon className="w-5 h-5" />, label: 'Users' },
    { view: 'admin-announcements' as View, icon: <BellIcon className="w-5 h-5" />, label: 'Announcements' },
  ];

  return (
    <div className="flex h-screen bg-light-bg-page dark:bg-dark-bg-page">
      {/* Mobile overlay */}
      <div 
        className={`fixed inset-0 z-40 bg-black/40 dark:bg-black/50 transition-opacity lg:hidden ${
          isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`} 
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`fixed lg:relative top-0 left-0 h-full w-64 bg-light-bg-sidebar dark:bg-dark-bg-sidebar border-r border-light-border dark:border-dark-border flex flex-col p-4 z-50 transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex items-center justify-between mb-8">
          <ArtemoFullLogo className="h-8" />
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md text-light-text-tertiary dark:text-dark-text-tertiary hover:bg-light-bg-page dark:hover:bg-dark-bg-page"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="px-4 py-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-grow space-y-2">
          {adminNavItems.map(item => (
            <AdminNavLink key={item.view} {...item} currentView={currentView} onNavigate={onNavigate} />
          ))}
        </nav>

        <div className="border-t border-light-border dark:border-dark-border pt-4">
          <button 
            onClick={() => onNavigate('dashboard-view')}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-md text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg-page dark:hover:bg-dark-bg-page hover:text-light-text-primary dark:hover:text-dark-text-primary"
          >
            <LogOutIcon className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border bg-light-bg-page dark:bg-dark-bg-page">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-1 rounded-md text-light-text-primary dark:text-dark-text-primary"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
          <h1 className="font-serif text-lg font-bold text-light-text-primary dark:text-dark-text-primary">Admin Panel</h1>
          <div className="w-8" /> {/* Spacer for centering */}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};