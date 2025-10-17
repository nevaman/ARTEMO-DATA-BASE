# GHL Edge Function Analysis & Integration Plan

## Executive Summary

This document analyzes two GHL webhook edge functions:
1. **Working Function** (`susana.js`) - Successfully registers users WITHOUT signature verification
2. **Current Function** (`ghl-sync/index.ts`) - Fails with "Missing signature header" error

The analysis identifies why the working version succeeds, what can be improved, and provides a two-phase implementation plan to create a production-ready solution.

---

## Analysis: Why the Working Function Succeeds

### Key Success Factors

#### 1. **No Signature Verification Requirement**
- **Working Function**: Completely bypasses signature verification
- **Current Function**: Requires `x-wh-signature` header and validates with RSA-SHA256
- **Why it matters**: GHL may send webhooks without signatures in certain configurations

#### 2. **Defensive Error Handling**
```typescript
// Working function uses try-catch blocks everywhere
try {
  const ab = await req.arrayBuffer();
  bodyText = new TextDecoder().decode(ab || new ArrayBuffer(0));
} catch (err) {
  console.error(`Failed to read request body:`, err);
  return jsonResponse({ error: 'Bad request body' }, 400);
}
```

#### 3. **Feature Detection Pattern**
```typescript
// Checks if admin API is available before using it
if (!supabase.auth || !supabase.auth.admin) {
  return jsonResponse({
    error: 'Supabase admin API unavailable'
  }, 500);
}
```

#### 4. **Robust User Lookup**
- Uses `findAuthUserByEmail()` that paginates through ALL users
- Handles multiple response shapes from Supabase API
- Supports backward compatibility with different client versions

#### 5. **Better Request Logging**
- Generates unique `requestId` for tracking
- Logs timing information
- Verbose debug mode available via environment variable

---

## Current Function Shortcomings

### Critical Issues

1. **Hard Requirement for Signature Header**
   ```typescript
   if (!signatureHeader) {
     return new Response(JSON.stringify({
       error: 'Unauthorized',
       message: 'Missing signature header'
     }), { status: 401 });
   }
   ```
   **Impact**: Rejects all webhooks without signature

2. **Non-Idempotent User Lookup**
   - Uses `getUserByEmail()` which may fail if pagination needed
   - No fallback for API version differences

3. **Less Graceful Error Recovery**
   - Throws errors instead of returning fallback values
   - Less defensive about API shape changes

4. **Limited Lifecycle Action Coverage**
   - Missing `user_update` fallback action
   - Doesn't handle edge cases where contact exists but no event type

### Strengths to Preserve

1. **Comprehensive Signature Verification**
   - RSA-SHA256 with GHL public key
   - Proper PEM parsing and validation
   - Security-first approach when signatures ARE present

2. **Better User Metadata Management**
   - Properly merges existing metadata
   - Tracks role changes in user_metadata
   - Maintains `role_hint` for debugging

3. **More Sophisticated Profile Management**
   - Checks for metadata changes before updating
   - Uses `status_updated_at` field
   - Manages preferences more carefully

4. **Superior Logging Structure**
   - Context-aware logging with function names
   - Structured parameter logging
   - Better error context

---

## Best of Both Worlds: Hybrid Approach

### Features to Combine

| Feature | Source | Reason |
|---------|--------|--------|
| Optional signature verification | Working | Flexibility for different GHL configs |
| Defensive user lookup with pagination | Working | Handles large user bases |
| Feature detection for admin API | Working | Version compatibility |
| Comprehensive logging | Current | Better debugging |
| Metadata management | Current | Better data integrity |
| Role upgrade logic | Current | More sophisticated |
| Profile preference merging | Current | Better state management |
| User update fallback action | Working | Handles edge cases |

---

## Zapier Workflow Requirements

Based on the 5 Zapier workflows described, the edge function must handle:

### Workflow 1: Complete Onboarding
- **Trigger**: Webhook with user info (email, first name, last name)
- **Actions**:
  - Create user with default credits (1000 initial, 1000 monthly)
  - Send invitation email
  - Update GHL contact with Artemo User ID
  - Log status in Airtable

### Workflow 2: Failed Payment / Monthly Renewal
- **Trigger**: Payment failure webhook
- **Actions**:
  - Disable user account (state: inactive)
  - Set disabled message: "Oops! Payment didn't go through..."

### Workflow 3: Annual Subscription Expiration
- **Trigger**: Annual subscription end webhook
- **Actions**:
  - Disable user account
  - Set disabled message: "Your annual subscription has ended..."

### Workflow 4: Subscription Cancellation
- **Trigger**: Cancellation webhook
- **Actions**:
  - Disable user account
  - Set disabled message: "Looks like you canceled..."

### Workflow 5: Free Access Period End
- **Trigger**: Free period expiration webhook
- **Actions**:
  - Disable user account
  - Set disabled message with subscription link

### Cross-Cutting Concerns

1. **Credit Management**: Store initial_credits and monthly_credits
2. **Custom Messages**: Support user-facing disabled messages
3. **External Sync**: Support GHL contact ID updates
4. **Status Tracking**: Track state changes with timestamps
5. **Idempotency**: Handle duplicate webhooks gracefully

---

## Database Schema Requirements

### Current Schema Support
✅ `user_profiles.active` (boolean) - for activation/deactivation
✅ `user_profiles.preferences` (jsonb) - for storing GHL contact ID
✅ `user_profiles.status_updated_at` (timestamptz) - for tracking changes
✅ `user_profiles.role` (text) - for user/pro/admin roles

### Missing Schema Elements
❌ `initial_credits` - Need to track user credits
❌ `monthly_credits` - Need to track monthly allowance
❌ `disabled_message` - Need to store custom disabled messages
❌ `artemo_user_id` mapping for GHL sync

**NOTE**: As per instructions, Phase 1 will NOT modify the database schema. These will be tracked in `preferences` JSONB field as a workaround.

---

## Two-Phase Implementation Plan

### Phase 1: Core Edge Function Enhancement
**Goal**: Create a robust, production-ready edge function that handles all webhook scenarios

**Scope**: EDGE FUNCTION ONLY - No database changes

#### Tasks

1. **Signature Verification Enhancement**
   - Make signature verification OPTIONAL via environment variable
   - Add `REQUIRE_GHL_SIGNATURE` flag (default: true)
   - Log signature status but allow processing when disabled
   - Preserve existing RSA-SHA256 verification logic

2. **Defensive User Lookup**
   - Replace `getUserByEmail()` with pagination-aware `findAuthUserByEmail()`
   - Support multiple API response shapes
   - Add retry logic for race conditions
   - Handle "already registered" errors gracefully

3. **Enhanced Action Routing**
   - Add `user_update` action as fallback
   - Expand lifecycle event detection
   - Support multiple event naming conventions
   - Handle missing event types gracefully

4. **Credits & Message Management**
   - Store credits in `preferences.initial_credits` and `preferences.monthly_credits`
   - Store disabled message in `preferences.disabled_message`
   - Add helper functions for preference management
   - Default credits: 1000 initial, 1000 monthly

5. **Improved Error Handling**
   - Wrap all async operations in try-catch
   - Return meaningful error messages
   - Log errors with full context
   - Never throw unhandled exceptions

6. **Logging & Observability**
   - Generate unique request IDs
   - Log request/response timing
   - Add verbose debug mode
   - Structure all logs consistently

7. **Testing Scenarios**
   - Test without signature header
   - Test with invalid signature
   - Test with valid signature
   - Test user creation flow
   - Test user deactivation flow
   - Test duplicate webhook handling
   - Test role upgrade scenarios

#### Deliverables

- ✅ Enhanced `ghl-sync/index.ts` edge function
- ✅ Updated environment variables documentation
- ✅ Testing checklist with expected behaviors
- ✅ Deployment guide

#### Environment Variables Required

```bash
# Existing
SUPABASE_URL=<auto-populated>
SUPABASE_SERVICE_ROLE_KEY=<auto-populated>
APP_LOGIN_URL=https://app.artemo.ai/login
GHL_PRO_PRODUCT_IDS=prod_abc123,prod_def456
GHL_TRIAL_PRODUCT_IDS=prod_trial_123

# New
REQUIRE_GHL_SIGNATURE=false  # Make signature optional
VERBOSE_DEBUG=false           # Enable detailed logging
DEFAULT_INITIAL_CREDITS=1000
DEFAULT_MONTHLY_CREDITS=1000
```

#### Success Criteria

- [ ] Handles webhooks with or without signatures
- [ ] Successfully creates new users
- [ ] Properly manages active/inactive states
- [ ] Stores credits in preferences
- [ ] Stores disabled messages in preferences
- [ ] Handles all 5 Zapier workflow scenarios
- [ ] Logs comprehensively for debugging
- [ ] Passes all test scenarios

---

### Phase 2: API Endpoints for Complete Zapier Replacement
**Goal**: Create edge functions to replace ALL Zapier functionality

**Scope**: NEW EDGE FUNCTIONS - No database changes

#### Background

The Zapier workflows perform operations that go BEYOND just webhook handling:
- Updating GHL contacts with Artemo User IDs
- Creating/updating Airtable records
- Fetching user information for external systems

Phase 2 creates API endpoints that enable the AI to perform these operations directly.

#### New Edge Functions

##### 1. `artemo-user-api/index.ts`
**Purpose**: Admin API for user management

**Endpoints**:
```typescript
// GET /artemo-user-api?action=get&email=user@example.com
// Returns user information including Artemo user ID

// POST /artemo-user-api?action=create
// Body: { email, firstName, lastName, initialCredits, monthlyCredits }
// Creates user and returns user ID

// PUT /artemo-user-api?action=update&id=<uuid>
// Body: { state: "active" | "inactive" }
// Updates user state

// PUT /artemo-user-api?action=setMessage&id=<uuid>
// Body: { message: "Your custom message" }
// Sets disabled message
```

**Features**:
- API key authentication via `X-API-KEY` header
- CORS support for web clients
- Rate limiting (100 req/min per key)
- Comprehensive request/response logging

##### 2. `ghl-contact-sync/index.ts`
**Purpose**: Sync data TO GoHighLevel

**Endpoints**:
```typescript
// POST /ghl-contact-sync?action=updateContact
// Body: { contactId: "ghl_contact_123", artemoUserId: "uuid" }
// Updates GHL contact custom field with Artemo user ID

// POST /ghl-contact-sync?action=addTag
// Body: { contactId: "ghl_contact_123", tag: "artemo-active" }
// Adds tag to GHL contact
```

**Features**:
- GHL API integration
- Environment-based GHL credentials
- Error handling for GHL API failures
- Webhook verification for incoming GHL events

##### 3. `external-integrations/index.ts`
**Purpose**: Integration hub for third-party services (Airtable, etc.)

**Endpoints**:
```typescript
// POST /external-integrations?action=airtable&operation=create
// Body: { email, status: "Active", role: "Student" }
// Creates/updates Airtable record

// POST /external-integrations?action=airtable&operation=update
// Body: { email, artemoAccess: "Invited" }
// Updates Airtable status
```

**Features**:
- Pluggable integration architecture
- Support for multiple external services
- Configurable via environment variables
- Graceful degradation if service unavailable

#### Tasks

1. **Create User Management API**
   - Implement CRUD operations for users
   - Add credit management functions
   - Add message management functions
   - Secure with API keys

2. **Create GHL Sync API**
   - Implement GHL contact update
   - Add tag management
   - Handle GHL API authentication
   - Add retry logic for failures

3. **Create External Integrations API**
   - Implement Airtable connector
   - Add extensible integration framework
   - Support multiple service configurations
   - Log all integration attempts

4. **API Authentication System**
   - Generate secure API keys
   - Store keys in Supabase secrets
   - Implement key rotation
   - Add key-based rate limiting

5. **Documentation**
   - API reference for each endpoint
   - Integration guide for AI
   - Examples for each workflow
   - Troubleshooting guide

#### Deliverables

- ✅ `artemo-user-api` edge function
- ✅ `ghl-contact-sync` edge function
- ✅ `external-integrations` edge function
- ✅ API authentication system
- ✅ Complete API documentation
- ✅ Integration examples for AI
- ✅ Deployment guide

#### Environment Variables Required

```bash
# User API
ARTEMO_API_KEY=<secure-random-key>
ARTEMO_API_RATE_LIMIT=100

# GHL Integration
GHL_API_KEY=<your-ghl-api-key>
GHL_LOCATION_ID=<your-location-id>
GHL_BASE_URL=https://rest.gohighlevel.com/v1

# Airtable Integration
AIRTABLE_API_KEY=<your-airtable-key>
AIRTABLE_BASE_ID=<afa-command-center-base-id>
AIRTABLE_TABLE_NAME=Students
```

#### Success Criteria

- [ ] AI can create users via API
- [ ] AI can activate/deactivate users via API
- [ ] AI can set disabled messages via API
- [ ] AI can update GHL contacts with Artemo IDs
- [ ] AI can manage GHL tags
- [ ] AI can create/update Airtable records
- [ ] All endpoints properly authenticated
- [ ] Rate limiting functional
- [ ] Complete API documentation exists

---

## Comparison: Working vs Current Function

### Architecture Differences

| Aspect | Working Function | Current Function |
|--------|-----------------|------------------|
| **Signature Verification** | None | Required with RSA-SHA256 |
| **Error Philosophy** | Graceful degradation | Fail fast |
| **User Lookup** | Pagination-aware | Single API call |
| **API Compatibility** | Defensive feature detection | Assumes stable API |
| **Logging** | Request ID + timing | Detailed but no IDs |
| **Action Routing** | Fallback to user_update | Ignore if no match |
| **CORS** | Minimal headers | Comprehensive |

### Code Quality

| Aspect | Working Function | Current Function | Winner |
|--------|-----------------|------------------|--------|
| **Type Safety** | JavaScript | TypeScript | Current |
| **Error Messages** | Generic | Specific | Current |
| **Function Organization** | Flat | Well-structured | Current |
| **Comments** | Minimal | Comprehensive | Current |
| **Testability** | Low | High | Current |
| **Maintainability** | Medium | High | Current |

### Production Readiness

| Aspect | Working Function | Current Function | Hybrid |
|--------|-----------------|------------------|---------|
| **Security** | ⚠️ No verification | ✅ Strong verification | ✅ Optional |
| **Reliability** | ✅ Handles failures | ⚠️ May fail on edge cases | ✅ Best of both |
| **Scalability** | ✅ Pagination support | ⚠️ Limited to page 1 | ✅ Pagination |
| **Observability** | ✅ Request tracking | ⚠️ No request IDs | ✅ Both |
| **Flexibility** | ✅ Works unsecured | ⚠️ Signature required | ✅ Configurable |

---

## Risk Assessment

### Phase 1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Breaking existing functionality | Medium | High | Comprehensive testing before deployment |
| Performance degradation | Low | Medium | Use pagination only when needed |
| Missing edge cases | Medium | Medium | Add user_update fallback |
| Signature bypass security issue | Low | High | Default to required, explicit opt-out |

### Phase 2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| API key exposure | Medium | Critical | Use Supabase secrets, rotate regularly |
| Rate limit bypass | Low | Medium | Implement key-based tracking |
| External API failures | High | Low | Graceful degradation, retry logic |
| Scope creep | High | Medium | Clear deliverables, phase boundary |

---

## Timeline Estimates

### Phase 1: Core Edge Function Enhancement
- **Planning & Analysis**: 2 hours
- **Code Implementation**: 4 hours
- **Testing & Debugging**: 3 hours
- **Documentation**: 1 hour
- **Total**: ~10 hours

### Phase 2: API Endpoints
- **User Management API**: 3 hours
- **GHL Sync API**: 4 hours
- **External Integrations API**: 4 hours
- **Authentication System**: 2 hours
- **Testing All APIs**: 4 hours
- **Documentation**: 2 hours
- **Total**: ~19 hours

---

## Recommendations

### Immediate Actions (Phase 1)

1. **Deploy working function as-is to test environment**
   - Validate it works with production GHL webhooks
   - Confirm no signature is sent
   - Verify user creation flow

2. **Add signature support to working function**
   - Make it optional with environment flag
   - Test with signature when available
   - Keep backward compatibility

3. **Enhance logging**
   - Add request ID tracking
   - Add timing metrics
   - Enable verbose mode for debugging

### Future Actions (Phase 2)

1. **Create comprehensive API**
   - Build user management endpoint
   - Add GHL sync capability
   - Support external integrations

2. **Enable AI direct control**
   - Provide API documentation to AI
   - Create examples for each workflow
   - Enable webhook-less operation

3. **Deprecate Zapier**
   - Gradually move workflows to direct API
   - Monitor for issues
   - Full cutover when stable

---

## Conclusion

The working function succeeds because it takes a **defensive, forgiving approach** while the current function takes a **secure, strict approach**. Neither is wrong - they serve different purposes.

**The ideal solution combines both:**
- Security when possible (signature verification)
- Flexibility when needed (optional verification)
- Robust error handling (pagination, retries)
- Comprehensive logging (request tracking)
- Type safety (TypeScript)
- Clear organization (well-structured code)

**Phase 1** creates this ideal edge function without touching the database.

**Phase 2** enables the AI to completely replace Zapier by providing direct API access to all required operations.

Both phases maintain database safety by reading schema but never modifying it, using the existing `preferences` JSONB field for extended data storage.
