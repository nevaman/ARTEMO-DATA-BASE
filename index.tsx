import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // Import BrowserRouter
import { Logger } from './utils/logger';
import type { ErrorResponse } from './types';
import { DialogProvider } from './contexts/DialogContext';
import { NotificationProvider } from './contexts/NotificationContext';
import App from './App';

// Global error handlers for unhandled errors and promise rejections
window.addEventListener('error', (event) => {
  // Filter out ResizeObserver loop errors - these are browser warnings, not critical errors
  if (event.message?.includes('ResizeObserver loop completed with undelivered notifications')) {
    return;
  }

  const error: ErrorResponse = {
    message: event.message || 'An unhandled error occurred',
    code: 'UNHANDLED_FRONTEND_ERROR',
    details: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
    timestamp: new Date().toISOString(),
    correlationId: Logger.getCorrelationId(),
    component: 'Global',
    severity: 'critical',
    userId: (window as any).BOLT_USER_ID,
    sessionId: (window as any).BOLT_SESSION_ID,
    userAgent: navigator.userAgent,
  };

  Logger.critical(error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });

  // Prevent default browser error reporting
  event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
  // Filter out ResizeObserver related promise rejections
  if (event.reason?.message?.includes('ResizeObserver loop completed with undelivered notifications')) {
    return;
  }

  const error: ErrorResponse = {
    message: event.reason?.message || 'An unhandled promise rejection occurred',
    code: 'UNHANDLED_PROMISE_REJECTION',
    details: event.reason?.stack || JSON.stringify(event.reason),
    timestamp: new Date().toISOString(),
    correlationId: Logger.getCorrelationId(),
    component: 'Global',
    severity: 'critical',
    userId: (window as any).BOLT_USER_ID,
    sessionId: (window as any).BOLT_SESSION_ID,
    userAgent: navigator.userAgent,
  };

  Logger.critical(error, {
    reason: event.reason,
  });

  // Prevent default browser error reporting
  event.preventDefault();
});

// Initialize application logging
Logger.info('Application starting', {
  component: 'Bootstrap',
  userAgent: navigator.userAgent,
  url: window.location.href,
  timestamp: new Date().toISOString(),
});

// Add diagnostic logging for page lifecycle events
console.log('🔧 AUTH DIAGNOSTIC: Application bootstrap started', {
  timestamp: new Date().toISOString(),
  userAgent: navigator.userAgent,
  url: window.location.href,
  tabVisible: !document.hidden,
  pageVisibility: document.visibilityState
});

// Monitor page lifecycle events that might affect authentication
window.addEventListener('beforeunload', () => {
  console.log('🔧 AUTH DIAGNOSTIC: Page beforeunload event', {
    timestamp: new Date().toISOString(),
    currentAuthState: window.localStorage.getItem('artemo-auth-storage')
  });
});

window.addEventListener('pagehide', () => {
  console.log('🔧 AUTH DIAGNOSTIC: Page pagehide event', {
    timestamp: new Date().toISOString()
  });
});

window.addEventListener('pageshow', (event) => {
  console.log('🔧 AUTH DIAGNOSTIC: Page pageshow event', {
    timestamp: new Date().toISOString(),
    persisted: event.persisted
  });
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  const error: ErrorResponse = {
    message: 'Critical application error: Root element not found',
    code: 'MISSING_ROOT_ELEMENT',
    details: 'Could not find root element with id="root" to mount React application',
    timestamp: new Date().toISOString(),
    component: 'Bootstrap',
    severity: 'critical',
  };

  Logger.critical(error);
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* Wrap the entire application with BrowserRouter */}
    <BrowserRouter>
      <NotificationProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </NotificationProvider>
    </BrowserRouter>
  </React.StrictMode>
);
