# Authentication Architecture

## Access Token + Refresh Token Model

We utilize a dual-token system to balance security and user experience:

1.  **Access Token (Short-lived)**:
    - **Purpose**: Used to authenticate API requests.
    - **Format**: JWT (JSON Web Token).
    - **Lifespan**: Short (1 hour).
    - **Storage**: HTTP-only, Secure, SameSite cookie.
    - **Benefit**: Minimizes the window of opportunity for an attacker if the token is stolen. Since it's stateless, it doesn't require a database lookup for every request, ensuring high performance.

2.  **Refresh Token (Long-lived)**:
    - **Purpose**: Used _only_ to obtain a new Access Token when the current one expires.
    - **Format**: JWT.
    - **Lifespan**: Long (7 days).
    - **Storage**: HTTP-only, Secure, SameSite cookie.
    - **Benefit**: Allows users to stay logged in without re-entering credentials frequently. Protected from XSS attacks.

## Why Store Refresh Tokens in the Database?

While JWTs are typically stateless, we persist **Refresh Tokens** in our database (`refresh_tokens` table) for the following critical security reasons:

1.  **Revocation & Control**:
    - If a user's device is lost or stolen, or if we detect suspicious activity, we can simply delete the corresponding refresh token from the database.
    - This immediately prevents the attacker from generating new access tokens, effectively logging them out once their current short-lived access token expires.
    - Stateless refresh tokens cannot be revoked without changing the signing secret (which logs out _everyone_).

2.  **Token Rotation (Reuse Detection)**:
    - We implement **Refresh Token Rotation**. Every time a refresh token is used to get a new access token, a _new_ refresh token is also issued, and the old one is invalidated (deleted).
    - If an attacker steals a refresh token and tries to use it _after_ the legitimate user has already used it (or vice versa), the database lookup will fail.
    - This significantly limits the lifespan and utility of a stolen refresh token.

3.  **Session Management**:
    - Storing tokens allows us to track active sessions. We can build features like "Sign out of all devices" or show users a list of their active logins.

## Why we chose Access + Refresh Token?

1.  **Scalability vs Sessions**:
    - Traditional server-side sessions require looking up the session in the database/cache for _every single API request_.
    - Access Tokens (JWT) are stateless. The server can verify them mathematically without checking the database. This reduces latency and database load significantly.

2.  **Security vs Single Long-lived JWT**:
    - If we used a single long-lived JWT (e.g., valid for 7 days), stealing it would give an attacker access for 7 days with no easy way to revoke it (unless we blacklist it, which re-introduces database lookups).
    - By using a short-lived Access Token (1 hour), if it's stolen, the damage is limited. The Refresh Token is more secure (kept in HTTP-only cookies) and because we store it in the DB, we _can_ revoke it if needed.

3.  **Best of Both Worlds**:
    - We get the performance of stateless auth (for most requests).
    - We get the control/revocability of stateful sessions (via the Refresh Token flow).

## Session Flow

The following steps describe the typical lifecycle of a user session in our system:

### 1. Login (Initial Authentication)

- **Action**: User submits their credentials (email/password) to the `/auth/login` endpoint.
- **Server**:
  - Validates credentials against the database.
  - Generates a pair of tokens:
    - **Access Token**: Signed with a short expiration time (1 hour).
    - **Refresh Token**: Signed with a long expiration time (7 days) and **stored in the database** linked to the user.
  - Sets both tokens as **HTTP-only, Secure, SameSite cookies**:
    - `access_token` cookie (maxAge: 1 hour)
    - `refresh_token` cookie (maxAge: 7 days)
- **Client**: Receives user data in response body. Tokens are automatically stored in cookies by the browser and sent with subsequent requests.

### 2. Accessing Protected Resources

- **Action**: Client makes a request to a protected API endpoint (e.g., `/auth/me`).
- **Cookies**: The browser automatically includes the `access_token` cookie with the request.
- **Server**:
  - Extracts the Access Token from the cookie.
  - Verifies the token's signature and expiration. **No database check is performed** at this stage for the token itself (stateless verification).
- **Response**: If valid, the server processes the request and returns the data.

### 3. Token Expiration & Refresh

- **Scenario**: The Access Token expires (after 1 hour).
- **Action**: Client attempts a request, but the server returns a `401 Unauthorized` error.
- **Client Logic**: The client detects the 401 error and automatically sends a request to the `/auth/refresh-token` endpoint. The `refresh_token` cookie is sent automatically by the browser.
- **Server**:
  - Extracts the Refresh Token from the cookie.
  - Verifies the Refresh Token's signature.
  - **Checks the database**: Verifies that the Refresh Token exists and belongs to the user.
  - **Token Rotation**: If valid, the server **deletes the old Refresh Token** and issues a **NEW Access Token** and a **NEW Refresh Token**.
  - Sets new cookies for both tokens.
- **Response**: Returns success status. New tokens are now in cookies.
- **Client**: Automatically retries the original failed request with the new access token cookie.

### 4. Logout

- **Action**: User clicks "Logout".
- **Client**: Sends a request to `/auth/logout`. The `refresh_token` cookie is sent automatically.
- **Server**:
  - **Deletes the Refresh Token from the database**.
  - Clears both cookies (`access_token` and `refresh_token`).
- **Client**: Cookies are cleared by the server response.
- **Result**: The session is effectively terminated. Even if the Access Token is still valid (for a few minutes), it cannot be refreshed once it expires.

## Security Benefits of HTTP-only Cookies

### Protection Against XSS Attacks

- **HTTP-only flag**: Prevents JavaScript from accessing the cookies, making them immune to XSS attacks.
- **Secure flag**: Ensures cookies are only sent over HTTPS in production.
- **SameSite flag**: Prevents CSRF attacks by restricting when cookies are sent with cross-site requests.

### Comparison with localStorage

| Feature             | HTTP-only Cookies    | localStorage         |
| ------------------- | -------------------- | -------------------- |
| **XSS Protection**  | ✅ Protected         | ❌ Vulnerable        |
| **CSRF Protection** | ⚠️ Needs SameSite    | ✅ Not affected      |
| **Auto-send**       | ✅ Automatic         | ❌ Manual            |
| **Expiration**      | ✅ Server-controlled | ❌ Manual management |
| **Size Limit**      | 4KB per cookie       | 5-10MB               |

## Implementation Notes

### Backend (NestJS)

- Cookies are set using `res.cookie()` with appropriate flags
- JWT Strategy extracts tokens from cookies using `request?.cookies?.access_token`
- Cookie-parser middleware is required: `app.use(cookieParser())`

### Frontend (React/Next.js)

- Axios configured with `withCredentials: true` to send cookies
- No manual token management needed
- Tokens are automatically included in requests
- No localStorage usage for tokens

### CORS Configuration

```typescript
app.enableCors({
  origin: 'http://localhost:8000',
  credentials: true, // Required for cookies
});
```
