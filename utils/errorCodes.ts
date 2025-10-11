// Centralized error code definitions for consistency across the application

export const ERROR_CODES = {
  // Authentication Errors
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_USER_EXISTS: 'AUTH_USER_EXISTS',
  AUTH_EMAIL_NOT_CONFIRMED: 'AUTH_EMAIL_NOT_CONFIRMED',
  AUTH_NETWORK_ERROR: 'AUTH_NETWORK_ERROR',
  AUTH_RATE_LIMIT: 'AUTH_RATE_LIMIT',
  AUTH_GENERIC_ERROR: 'AUTH_GENERIC_ERROR',
  AUTH_STATUS_CHECK_ERROR: 'AUTH_STATUS_CHECK_ERROR',
  AUTH_SESSION_VALIDATION_ERROR: 'AUTH_SESSION_VALIDATION_ERROR',
  AUTH_SESSION_REFRESH_ERROR: 'AUTH_SESSION_REFRESH_ERROR',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_STATE_ERROR: 'AUTH_STATE_ERROR',
  AUTH_SUPABASE_NOT_CONFIGURED: 'AUTH_SUPABASE_NOT_CONFIGURED',

  // API Errors
  API_TOOLS_FETCH_ERROR: 'API_TOOLS_FETCH_ERROR',
  API_TOOL_CREATE_ERROR: 'API_TOOL_CREATE_ERROR',
  API_TOOL_UPDATE_ERROR: 'API_TOOL_UPDATE_ERROR',
  API_TOOL_DELETE_ERROR: 'API_TOOL_DELETE_ERROR',
  API_CATEGORIES_FETCH_ERROR: 'API_CATEGORIES_FETCH_ERROR',
  API_MAX_RETRIES_EXCEEDED: 'API_MAX_RETRIES_EXCEEDED',
  API_DUPLICATE_ENTRY: 'API_DUPLICATE_ENTRY',

  // AI Errors
  AI_RATE_LIMIT_EXCEEDED: 'AI_RATE_LIMIT_EXCEEDED',
  AI_MODEL_UNAVAILABLE: 'AI_MODEL_UNAVAILABLE',
  AI_CONTENT_POLICY_VIOLATION: 'AI_CONTENT_POLICY_VIOLATION',
  AI_TOKEN_LIMIT_EXCEEDED: 'AI_TOKEN_LIMIT_EXCEEDED',
  AI_NETWORK_ERROR: 'AI_NETWORK_ERROR',
  AI_UNKNOWN_ERROR: 'AI_UNKNOWN_ERROR',
  AI_CHAT_PROCESSING_ERROR: 'AI_CHAT_PROCESSING_ERROR',

  // Frontend Errors
  REACT_ERROR_BOUNDARY: 'REACT_ERROR_BOUNDARY',
  UNHANDLED_FRONTEND_ERROR: 'UNHANDLED_FRONTEND_ERROR',
  UNHANDLED_PROMISE_REJECTION: 'UNHANDLED_PROMISE_REJECTION',
  MISSING_ROOT_ELEMENT: 'MISSING_ROOT_ELEMENT',

  // Hook Errors
  HOOK_TOOLS_FETCH_ERROR: 'HOOK_TOOLS_FETCH_ERROR',
  HOOK_TOOLS_NETWORK_ERROR: 'HOOK_TOOLS_NETWORK_ERROR',
  HOOK_TOOL_CREATE_ERROR: 'HOOK_TOOL_CREATE_ERROR',

  // File Processing Errors
  FILE_PROCESSING_ERROR: 'FILE_PROCESSING_ERROR',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  FILE_SIZE_EXCEEDED: 'FILE_SIZE_EXCEEDED',
  FILE_TYPE_NOT_SUPPORTED: 'FILE_TYPE_NOT_SUPPORTED',

  // Chat Errors
  CHAT_AI_RESPONSE_ERROR: 'CHAT_AI_RESPONSE_ERROR',
  CHAT_FLOW_ERROR: 'CHAT_FLOW_ERROR',
  CHAT_SESSION_SAVE_ERROR: 'CHAT_SESSION_SAVE_ERROR',
  CHAT_SESSION_NOT_FOUND: 'CHAT_SESSION_NOT_FOUND',

  // Edge Function Errors
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  INVALID_JSON: 'INVALID_JSON',
  MISSING_TOOL_ID: 'MISSING_TOOL_ID',
  INVALID_MESSAGES: 'INVALID_MESSAGES',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',

  // Generic API Errors
  API_GENERIC_ERROR: 'API_GENERIC_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Error severity mapping for different error codes
export const ERROR_SEVERITY_MAP: Record<ErrorCode, 'info' | 'warn' | 'error' | 'critical'> = {
  // Authentication - mostly warnings except for critical system issues
  AUTH_INVALID_CREDENTIALS: 'warn',
  AUTH_USER_EXISTS: 'warn',
  AUTH_EMAIL_NOT_CONFIRMED: 'warn',
  AUTH_NETWORK_ERROR: 'error',
  AUTH_RATE_LIMIT: 'warn',
  AUTH_GENERIC_ERROR: 'error',
  AUTH_STATUS_CHECK_ERROR: 'error',
  AUTH_SESSION_VALIDATION_ERROR: 'warn',
  AUTH_SESSION_REFRESH_ERROR: 'error',
  AUTH_TOKEN_EXPIRED: 'warn',
  AUTH_INVALID_TOKEN: 'warn',
  AUTH_STATE_ERROR: 'error',
  AUTH_SUPABASE_NOT_CONFIGURED: 'error',

  // API - errors that affect functionality
  API_TOOLS_FETCH_ERROR: 'error',
  API_TOOL_CREATE_ERROR: 'error',
  API_TOOL_UPDATE_ERROR: 'error',
  API_TOOL_DELETE_ERROR: 'error',
  API_CATEGORIES_FETCH_ERROR: 'error',
  API_MAX_RETRIES_EXCEEDED: 'warn',
  API_DUPLICATE_ENTRY: 'warn',

  // AI - varies based on impact
  AI_RATE_LIMIT_EXCEEDED: 'warn',
  AI_MODEL_UNAVAILABLE: 'error',
  AI_CONTENT_POLICY_VIOLATION: 'warn',
  AI_TOKEN_LIMIT_EXCEEDED: 'warn',
  AI_NETWORK_ERROR: 'error',
  AI_UNKNOWN_ERROR: 'error',
  AI_CHAT_PROCESSING_ERROR: 'error',

  // Frontend - critical system issues
  REACT_ERROR_BOUNDARY: 'critical',
  UNHANDLED_FRONTEND_ERROR: 'critical',
  UNHANDLED_PROMISE_REJECTION: 'critical',
  MISSING_ROOT_ELEMENT: 'critical',

  // Hooks - errors that affect data loading
  HOOK_TOOLS_FETCH_ERROR: 'error',
  HOOK_TOOLS_NETWORK_ERROR: 'error',
  HOOK_TOOL_CREATE_ERROR: 'error',

  // Files - mostly warnings unless critical
  FILE_PROCESSING_ERROR: 'warn',
  FILE_UPLOAD_ERROR: 'warn',
  FILE_SIZE_EXCEEDED: 'warn',
  FILE_TYPE_NOT_SUPPORTED: 'warn',

  // Chat - errors that affect user experience
  CHAT_AI_RESPONSE_ERROR: 'error',
  CHAT_FLOW_ERROR: 'error',
  CHAT_SESSION_SAVE_ERROR: 'warn',
  CHAT_SESSION_NOT_FOUND: 'warn',

  // Edge Functions - varies based on context
  METHOD_NOT_ALLOWED: 'warn',
  INVALID_JSON: 'warn',
  MISSING_TOOL_ID: 'warn',
  INVALID_MESSAGES: 'warn',
  TOOL_NOT_FOUND: 'warn',

  // Generic
  API_GENERIC_ERROR: 'error',
};

// User-friendly error messages for each error code
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password. Please check your credentials and try again.',
  AUTH_USER_EXISTS: 'An account with this email already exists. Please sign in instead.',
  AUTH_EMAIL_NOT_CONFIRMED: 'Please confirm your email address before signing in.',
  AUTH_NETWORK_ERROR: 'Network connection error. Please check your internet connection and try again.',
  AUTH_RATE_LIMIT: 'Too many login attempts. Please wait a moment before trying again.',
  AUTH_GENERIC_ERROR: 'Authentication failed. Please try again or contact support if the problem persists.',
  AUTH_STATUS_CHECK_ERROR: 'Unable to verify authentication status. Please refresh the page.',
  AUTH_SESSION_VALIDATION_ERROR: 'Your session could not be validated. Please sign in again.',
  AUTH_SESSION_REFRESH_ERROR: 'Failed to refresh your session. Please sign in again.',
  AUTH_TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  AUTH_INVALID_TOKEN: 'Invalid authentication token. Please sign in again.',
  AUTH_STATE_ERROR: 'Authentication error occurred. Please sign in again.',
  AUTH_SUPABASE_NOT_CONFIGURED: 'Backend not configured. Please contact support.',

  // API
  API_TOOLS_FETCH_ERROR: 'Failed to load tools. Please refresh the page or try again later.',
  API_TOOL_CREATE_ERROR: 'Failed to create tool. Please check your input and try again.',
  API_TOOL_UPDATE_ERROR: 'Failed to update tool. Please try again.',
  API_TOOL_DELETE_ERROR: 'Failed to delete tool. Please try again.',
  API_CATEGORIES_FETCH_ERROR: 'Failed to load categories. Please refresh the page.',
  API_MAX_RETRIES_EXCEEDED: 'Service temporarily unavailable. Please try again in a few minutes.',
  API_DUPLICATE_ENTRY: 'A record with this name already exists. Please choose a different name.',

  // AI
  AI_RATE_LIMIT_EXCEEDED: 'AI service is busy. Please wait a moment and try again.',
  AI_MODEL_UNAVAILABLE: 'AI model temporarily unavailable. Please try again.',
  AI_CONTENT_POLICY_VIOLATION: 'Content violates AI policy. Please rephrase your request.',
  AI_TOKEN_LIMIT_EXCEEDED: 'Request too long. Please shorten your input and try again.',
  AI_NETWORK_ERROR: 'AI service connection error. Please try again.',
  AI_UNKNOWN_ERROR: 'AI processing error. Please try again or contact support.',
  AI_CHAT_PROCESSING_ERROR: 'Failed to process chat request. Please try again.',

  // Frontend
  REACT_ERROR_BOUNDARY: 'An unexpected error occurred in the application.',
  UNHANDLED_FRONTEND_ERROR: 'An unexpected error occurred.',
  UNHANDLED_PROMISE_REJECTION: 'An unexpected error occurred.',
  MISSING_ROOT_ELEMENT: 'Critical application error: Unable to start application.',

  // Hooks
  HOOK_TOOLS_FETCH_ERROR: 'Failed to load tools data.',
  HOOK_TOOLS_NETWORK_ERROR: 'Network error while loading tools.',
  HOOK_TOOL_CREATE_ERROR: 'Failed to create tool.',

  // Files
  FILE_PROCESSING_ERROR: 'Failed to process uploaded file. Please try a different file.',
  FILE_UPLOAD_ERROR: 'Failed to upload file. Please try again.',
  FILE_SIZE_EXCEEDED: 'File size too large. Please choose a smaller file.',
  FILE_TYPE_NOT_SUPPORTED: 'File type not supported. Please use PDF, DOCX, TXT, or MD files.',

  // Chat
  CHAT_AI_RESPONSE_ERROR: 'Failed to generate AI response. Please try again.',
  CHAT_FLOW_ERROR: 'Chat session error. Please refresh and try again.',
  CHAT_SESSION_SAVE_ERROR: 'Failed to save chat session.',
  CHAT_SESSION_NOT_FOUND: 'Chat session no longer exists.',

  // Edge Functions
  METHOD_NOT_ALLOWED: 'Invalid request method.',
  INVALID_JSON: 'Invalid request format.',
  MISSING_TOOL_ID: 'Tool ID is required.',
  INVALID_MESSAGES: 'Invalid message format.',
  TOOL_NOT_FOUND: 'Requested tool not found.',

  // Generic
  API_GENERIC_ERROR: 'An unexpected error occurred. Please try again.',
};