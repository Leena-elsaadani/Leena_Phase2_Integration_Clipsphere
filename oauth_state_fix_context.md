# OAuth2 State CSRF Protection Implementation Context

## 1. Problem Summary

### Current Issue
The auth_service.go currently uses a hardcoded "state" value in the OAuth2 authorization flow, which is passed directly to the authorization code URL without validation in the callback.

### Security Risk: CSRF Attack in OAuth2 Callback
The OAuth2 authorization flow is vulnerable to Cross-Site Request Forgery (CSRF) attacks when state validation is absent:

- **Attack Scenario**: An attacker tricks a user into clicking a malicious link that initiates an OAuth flow with attacker-controlled parameters
- **Exploitation**: Without state validation, the callback handler accepts any state value, allowing the attacker to link the user's account to the attacker's OAuth provider account
- **Impact**: Account compromise - the attacker gains access to the legitimate user's account

### Why Hardcoded State Fails
- A static state value provides no session-specific verification
- Does not bind the authorization request to the specific user session
- Cannot detect if a callback originates from an attacker-initiated request
- Defeats the purpose of OAuth2's state parameter mechanism

## 2. Required Behavior

### Login Flow (InitiateOAuth)
1. **Generate State**: Create cryptographically secure random value
   - Use `crypto/rand` (NOT `math/rand`)
   - Generate 16 random bytes
   - Hex encode the bytes to create state string
2. **Store in Redis**: Persist state for callback validation
   - Redis key format: `oauth_state:{state}` (where {state} is the hex-encoded value)
   - Redis value: `"1"` (sentinel value, only presence matters)
   - TTL: 5 minutes (allows time for user to complete OAuth redirect and return)
3. **Pass to Authorization URL**: Include state in AuthCodeURL
   - Call `AuthCodeURL(state)` with the generated state
   - Redirect user to authorization URL

### Callback Flow (HandleOAuthCallback)
1. **Extract State**: Read state parameter from callback query string
2. **Validate in Redis**:
   - Check if Redis key `oauth_state:{state}` exists
   - **If key missing**: Return error with message: `"invalid or expired OAuth state"`
   - **If key exists**:
     - Delete the Redis key immediately (one-time use enforcement)
     - Continue with normal login flow (token exchange, user creation/update)
3. **Error Handling**: Return appropriate HTTP error response for missing/expired state

## 3. Implementation Requirements

### generateState() Function
- **Signature**: `generateState() string`
- **Implementation Requirements**:
  - Use `crypto/rand.Read()` to generate 16 bytes of cryptographic randomness
  - MUST NOT use `math/rand` (insufficient entropy)
  - Hex encode the 16-byte value using `hex.EncodeToString()`
  - Return as string
- **Expected Output**: 32-character hexadecimal string (16 bytes × 2 hex chars per byte)

### Redis Key-Value Operations
- **Set Operation** (login flow):
  - Key: `oauth_state:{state}`
  - Value: `"1"`
  - Expiration: 5 minutes (300 seconds)
  - Use existing Redis client's Set method with TTL
- **Get Operation** (callback flow):
  - Key: `oauth_state:{state}`
  - Check existence (EXIST command or equivalent)
- **Delete Operation** (callback flow):
  - Key: `oauth_state:{state}`
  - Remove immediately after validation success (enforce one-time use)

## 4. Constraints

### DO NOT
- Refactor any code outside OAuth state generation and validation logic
- Introduce new dependencies (use existing Redis client/infrastructure)
- Modify function signatures of existing exported functions
- Change error handling patterns used elsewhere in service
- Add new database tables or Redis data structures

### DO
- Use existing Redis client instance/interface
- Follow existing error handling patterns in service
- Maintain consistency with current code style
- Keep state generation isolated in dedicated function

## 5. Testing Requirements

### Test Case 1: Invalid/Expired State Rejection
**Scenario**: Callback received with state that does not exist in Redis
- **Setup**: Do NOT store any state in Redis for this test
- **Action**: Call HandleOAuthCallback with arbitrary state value
- **Expected Result**:
  - Function returns error
  - Error message exactly contains: `"invalid or expired OAuth state"`
  - No user login occurs
  - Redis receives no DELETE operation

### Test Case 2: Valid State Acceptance with One-Time Use
**Scenario**: Callback received with state that exists in Redis
- **Setup**: Pre-populate Redis with key `oauth_state:{teststate}` = `"1"`
- **Action**: Call HandleOAuthCallback with valid state value
- **Expected Result**:
  - Function accepts the state as valid
  - Continues to OAuth token exchange logic
  - Redis DELETE operation called for key `oauth_state:{teststate}`
  - Subsequent callback with same state fails (key no longer exists)
  - Second call returns `"invalid or expired OAuth state"` error

### Additional Test Considerations
- Verify generateState() produces different values on multiple calls
- Verify generateState() output is always 32 hex characters
- Test that Redis TTL causes state expiration after 5 minutes
- Test that state validation occurs before any external OAuth calls

## 6. Files Involved

- **auth_service.go**: Main service file containing OAuth flows
  - Function to modify: Login handler (InitiateOAuth or equivalent)
  - Function to modify: Callback handler (HandleOAuthCallback or equivalent)
  - Function to add: generateState()
  - Redis client must be accessible within these functions

- **auth_service_test.go**: Test file
  - Add test cases for invalid state rejection
  - Add test cases for valid state acceptance and one-time use
  - Mock Redis client for testing

## 7. Implementation Output Expectations

### Code Quality
- Concise, readable implementation
- No unnecessary comments (self-documenting code)
- Follow existing service code patterns

### Testing
- All test cases from section 5 must pass
- No regression in existing OAuth functionality tests

### Verification
- State values are cryptographically random (verified via test)
- Redis operations complete successfully
- Error messages match exactly: `"invalid or expired OAuth state"`
- One-time use enforced (state deleted after first valid use)

### Documentation
- Function comments explain purpose and Redis key format
- Error message is clear and specific

---

**Status**: Ready for implementation  
**Single Source of Truth**: Use this document as reference during implementation
