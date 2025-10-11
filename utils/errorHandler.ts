import { Logger } from './logger';
import { ERROR_CODES, ERROR_MESSAGES, ERROR_SEVERITY_MAP } from './errorCodes';
import type { ErrorResponse, ErrorCode } from '../types';

/**
 * Centralized error handling utility for consistent error processing
 */
export class ErrorHandler {
  /**
   * Create a standardized error response
   */
  static createError(
    code: ErrorCode,
    details?: string,
    component?: string,
    correlationId?: string
  ): ErrorResponse {
    return {
      message: ERROR_MESSAGES[code],
      code,
      details: details || '',
      timestamp: new Date().toISOString(),
      correlationId: correlationId || Logger.getCorrelationId(),
      component: component || 'Unknown',
      severity: ERROR_SEVERITY_MAP[code],
    };
  }

  /**
   * Handle and log an error with appropriate severity
   */
  static handleError(
    error: ErrorResponse | Error | any,
    context?: Record<string, any>
  ): ErrorResponse {
    let structuredError: ErrorResponse;

    // Convert various error types to structured ErrorResponse
    if (error.code && error.message && error.severity) {
      // Already a structured error
      structuredError = error;
    } else if (error instanceof Error) {
      // Standard JavaScript Error
      structuredError = this.createError(
        'UNHANDLED_FRONTEND_ERROR',
        error.message,
        context?.component
      );
    } else if (typeof error === 'string') {
      // String error
      structuredError = this.createError(
        'UNHANDLED_FRONTEND_ERROR',
        error,
        context?.component
      );
    } else {
      // Unknown error type
      structuredError = this.createError(
        'UNHANDLED_FRONTEND_ERROR',
        JSON.stringify(error),
        context?.component
      );
    }

    // Special handling for auth errors - trigger logout
    if (this.isAuthError(structuredError)) {
      Logger.warn('Auth error detected, triggering logout', {
        component: 'ErrorHandler',
        errorCode: structuredError.code,
      });
      
      // Import auth store dynamically to avoid circular dependency
      import('../stores/authStore').then(({ useAuthStore }) => {
        useAuthStore.getState().clearAuth();
      });
    }

    // Log with appropriate severity
    switch (structuredError.severity) {
      case 'critical':
        Logger.critical(structuredError, context);
        break;
      case 'error':
        Logger.error(structuredError, context);
        break;
      case 'warn':
        Logger.warn(structuredError.message, context);
        break;
      default:
        Logger.info(structuredError.message, context);
    }

    return structuredError;
  }

  /**
   * Check if an error is auth-related and should trigger logout
   */
  private static isAuthError(error: ErrorResponse): boolean {
    const authErrorCodes = [
      'AUTH_INVALID_CREDENTIALS',
      'AUTH_SESSION_VALIDATION_ERROR',
      'AUTH_SESSION_REFRESH_ERROR',
      'AUTH_TOKEN_EXPIRED',
      'AUTH_INVALID_TOKEN',
    ];
    
    const authErrorMessages = [
      'Invalid JWT',
      'JWT expired',
      'Invalid token',
      'Session expired',
      'Authentication required',
      'Unauthorized',
    ];
    
    return authErrorCodes.includes(error.code) ||
           authErrorMessages.some(msg => error.message.includes(msg) || error.details?.includes(msg));
  }

  /**
   * Handle Supabase-specific errors with enhanced context
   */
  static handleSupabaseError(
    error: any,
    operation: string,
    context?: Record<string, any>
  ): ErrorResponse {
    const errorCode = this.mapSupabaseErrorToCode(error, operation);
    
    const structuredError = this.createError(
      errorCode,
      error.message || error.details || 'Database operation failed',
      'SupabaseApiService',
      context?.correlationId
    );

    this.handleError(structuredError, {
      ...context,
      operation,
      supabaseError: error,
    });

    return structuredError;
  }

  /**
   * Map Supabase errors to our error codes
   */
  private static mapSupabaseErrorToCode(error: any, operation: string): ErrorCode {
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('row level security')) {
      return 'AUTH_INVALID_CREDENTIALS';
    }
    
    if (errorMessage.includes('duplicate key') || errorMessage.includes('already exists')) {
      return 'API_DUPLICATE_ENTRY';
    }
    
    if (errorMessage.includes('foreign key') || errorMessage.includes('violates')) {
      return 'API_TOOL_CREATE_ERROR';
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'API_MAX_RETRIES_EXCEEDED';
    }

    // Default based on operation
    switch (operation.toLowerCase()) {
      case 'gettools':
      case 'fetchtools':
        return 'API_TOOLS_FETCH_ERROR';
      case 'createtool':
        return 'API_TOOL_CREATE_ERROR';
      case 'updatetool':
        return 'API_TOOL_UPDATE_ERROR';
      case 'deletetool':
        return 'API_TOOL_DELETE_ERROR';
      case 'getcategories':
        return 'API_CATEGORIES_FETCH_ERROR';
      case 'updatechatsession':
        return 'CHAT_SESSION_SAVE_ERROR';
      default:
        return 'API_GENERIC_ERROR';
    }
  }

  /**
   * Retry mechanism for failed operations
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
    context?: Record<string, any>
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 1) {
          Logger.info(`Operation succeeded on retry attempt ${attempt}`, {
            component: 'ErrorHandler',
            attempt,
            maxRetries,
            ...context,
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        Logger.warn(`Operation failed on attempt ${attempt}/${maxRetries}`, {
          component: 'ErrorHandler',
          attempt,
          maxRetries,
          error: error instanceof Error ? error.message : 'Unknown error',
          ...context,
        });
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
      }
    }
    
    const finalError = this.createError(
      'API_MAX_RETRIES_EXCEEDED',
      `Operation failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
      context?.component
    );
    
    throw finalError;
  }

  /**
   * Validate required environment variables
   */
  static validateEnvironment(): { isValid: boolean; missingVars: string[] } {
    const requiredVars = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY'
    ];
    
    const missingVars = requiredVars.filter(varName => {
      const value = import.meta.env[varName];
      return !value || value === 'your_supabase_project_url' || value === 'your_supabase_anon_key';
    });
    
    if (missingVars.length > 0) {
      const error = this.createError(
        'AUTH_SUPABASE_NOT_CONFIGURED',
        `Missing environment variables: ${missingVars.join(', ')}`,
        'ErrorHandler'
      );
      
      this.handleError(error, {
        missingVars,
        allEnvVars: Object.keys(import.meta.env),
      });
    }
    
    return {
      isValid: missingVars.length === 0,
      missingVars
    };
  }
}