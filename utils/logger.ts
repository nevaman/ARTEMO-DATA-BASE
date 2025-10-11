import type { ErrorResponse, LogEntry, AuthError } from '../types';

// Global correlation ID management
declare global {
  interface Window {
    BOLT_CORRELATION_ID?: string;
    BOLT_SESSION_ID?: string;
    BOLT_USER_ID?: string;
  }
}

export class Logger {
  private static generateCorrelationId(): string {
    return crypto.randomUUID();
  }

  private static getSessionContext() {
    return {
      correlationId: window.BOLT_CORRELATION_ID || this.generateCorrelationId(),
      sessionId: window.BOLT_SESSION_ID || 'unknown',
      userId: window.BOLT_USER_ID || 'anonymous',
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };
  }

  private static createLogEntry(
    level: 'info' | 'warn' | 'error' | 'critical',
    message: string,
    context?: Record<string, any>,
    error?: ErrorResponse
  ): LogEntry {
    const sessionContext = this.getSessionContext();
    
    return {
      timestamp: sessionContext.timestamp,
      level,
      message,
      correlationId: sessionContext.correlationId,
      component: error?.component || context?.component || 'Unknown',
      userId: sessionContext.userId,
      sessionId: sessionContext.sessionId,
      context: {
        ...context,
        userAgent: sessionContext.userAgent,
        url: sessionContext.url,
      },
      error,
    };
  }

  private static outputLog(logEntry: LogEntry) {
    const logString = JSON.stringify(logEntry, null, 2);
    
    switch (logEntry.level) {
      case 'critical':
      case 'error':
        console.error(`[${logEntry.level.toUpperCase()}]`, logString);
        break;
      case 'warn':
        console.warn(`[WARN]`, logString);
        break;
      case 'info':
      default:
        console.log(`[INFO]`, logString);
        break;
    }

    // In production, this would send to external logging service
    // Example: Sentry.captureMessage(logString, logEntry.level);
    // Example: fetch('/api/logs', { method: 'POST', body: logString });
  }

  static info(message: string, context?: Record<string, any>) {
    const logEntry = this.createLogEntry('info', message, context);
    this.outputLog(logEntry);
  }

  static warn(message: string, context?: Record<string, any>) {
    const logEntry = this.createLogEntry('warn', message, context);
    this.outputLog(logEntry);
  }

  static error(error: ErrorResponse, context?: Record<string, any>) {
    const logEntry = this.createLogEntry('error', error.message, context, error);
    this.outputLog(logEntry);
  }

  static critical(error: ErrorResponse, context?: Record<string, any>) {
    const logEntry = this.createLogEntry('critical', error.message, context, error);
    this.outputLog(logEntry);
  }

  // Authentication-specific logging
  static authAttempt(method: 'signin' | 'signup' | 'signout', email?: string) {
    this.info(`Authentication attempt: ${method}`, {
      component: 'AuthService',
      authMethod: method,
      attemptedEmail: email ? this.sanitizeEmail(email) : undefined,
    });
  }

  static authSuccess(method: 'signin' | 'signup' | 'signout', userId?: string) {
    this.info(`Authentication success: ${method}`, {
      component: 'AuthService',
      authMethod: method,
      userId,
    });
  }

  static authError(authError: AuthError) {
    this.error(authError, {
      component: 'AuthService',
      authMethod: authError.authMethod,
      attemptedEmail: authError.attemptedEmail ? this.sanitizeEmail(authError.attemptedEmail) : undefined,
    });
  }

  // AI-specific logging
  static aiRequest(toolId: string, model: string, messageCount: number) {
    this.info(`AI request initiated`, {
      component: 'AIService',
      toolId,
      model,
      messageCount,
    });
  }

  static aiSuccess(toolId: string, model: string, responseLength: number, processingTime: number) {
    this.info(`AI request completed`, {
      component: 'AIService',
      toolId,
      model,
      responseLength,
      processingTimeMs: processingTime,
    });
  }

  static aiError(error: ErrorResponse, toolId: string, model: string, retryCount: number = 0) {
    this.error({
      ...error,
      retryCount,
    }, {
      component: 'AIService',
      toolId,
      model,
    });
  }

  static aiFallback(toolId: string, primaryModel: string, fallbackModel: string) {
    this.warn(`AI model fallback triggered`, {
      component: 'AIService',
      toolId,
      primaryModel,
      fallbackModel,
    });
  }

  // Utility methods
  private static sanitizeEmail(email: string): string {
    const [local, domain] = email.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  }

  static setCorrelationId(id?: string) {
    window.BOLT_CORRELATION_ID = id || this.generateCorrelationId();
  }

  static setSessionId(id: string) {
    window.BOLT_SESSION_ID = id;
  }

  static setUserId(id: string) {
    window.BOLT_USER_ID = id;
  }

  static getCorrelationId(): string {
    return window.BOLT_CORRELATION_ID || this.generateCorrelationId();
  }

  // Performance monitoring
  static performance(operation: string, duration: number, context?: Record<string, any>) {
    this.info(`Performance: ${operation}`, {
      component: 'Performance',
      operation,
      durationMs: duration,
      ...context,
    });
  }

  // User action tracking
  static userAction(action: string, context?: Record<string, any>) {
    this.info(`User action: ${action}`, {
      component: 'UserAction',
      action,
      ...context,
    });
  }
}