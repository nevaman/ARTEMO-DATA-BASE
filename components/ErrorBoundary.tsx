import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Logger } from '../utils/logger';
import { ErrorHandler } from '../utils/errorHandler';
import type { ErrorResponse } from '../types';
import { ArtemoIcon, XIcon } from './Icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: crypto.randomUUID(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorResponse: ErrorResponse = {
      message: 'An unexpected error occurred in the application',
      code: 'REACT_ERROR_BOUNDARY',
      details: `${error.message}\n\nStack: ${error.stack}\n\nComponent Stack: ${errorInfo.componentStack}`,
      timestamp: new Date().toISOString(),
      correlationId: Logger.getCorrelationId(),
      component: this.getComponentName(errorInfo.componentStack),
      severity: 'critical',
      userId: window.BOLT_USER_ID,
      sessionId: window.BOLT_SESSION_ID,
      userAgent: navigator.userAgent,
    };

    // Use ErrorHandler for consistent error processing
    ErrorHandler.handleError(errorResponse, {
      errorInfo,
      errorId: this.state.errorId,
      componentStack: errorInfo.componentStack,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private getComponentName(componentStack: string): string {
    const lines = componentStack.split('\n');
    const firstComponent = lines.find(line => line.trim().startsWith('in '));
    return firstComponent ? firstComponent.trim().replace('in ', '') : 'Unknown';
  }

  private handleRetry = () => {
    Logger.info('User initiated error recovery', {
      component: 'ErrorBoundary',
      errorId: this.state.errorId,
    });
    
    this.setState({ hasError: false, error: null, errorId: null });
  };

  private handleGoHome = () => {
    Logger.info('User navigated to dashboard from error', {
      component: 'ErrorBoundary',
      errorId: this.state.errorId,
    });
    
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-light-bg-page dark:bg-dark-bg-page flex items-center justify-center p-4">
          <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg shadow-lg max-w-md w-full p-8 text-center">
            <div className="mb-6">
              <ArtemoIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h2 className="font-serif text-2xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
                Something went wrong
              </h2>
              <p className="text-light-text-secondary dark:text-dark-text-secondary mb-4">
                We encountered an unexpected error. Our team has been notified and is working on a fix.
              </p>
              {this.state.errorId && (
                <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary font-mono bg-light-bg-sidebar dark:bg-dark-bg-sidebar p-2 rounded">
                  Error ID: {this.state.errorId}
                </p>
              )}
            </div>
            
            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity font-medium"
              >
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="w-full px-4 py-2 bg-light-bg-sidebar dark:bg-dark-bg-component border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary rounded-md hover:opacity-85 transition-opacity"
              >
                Go to Dashboard
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-light-border dark:border-dark-border">
              <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                If this problem persists, please contact{' '}
                <a href="mailto:support@artemo.ai" className="text-primary-accent hover:underline">
                  support@artemo.ai
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}