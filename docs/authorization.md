# Authorization — Technical Documentation

**Backend**: NestJS + TypeORM

**Frontend**: Next.js + React Query + Axios + JWT

**Authorization Model**: Role-Based Access Control (RBAC)

## Authentication Overview (JWT Access + Refresh Tokens)

The system uses **JSON Web Tokens** for authentication, with two token types:

### Access Token

- Short-lived
- Stored in memory only
- Attached to all authorized API requests
- Prevents token theft via XSS

### Refresh Token

- Longer-lived
- Stored in `localStorage`
- Used to obtain new access tokens
- Rotates when refreshed

### Login Flow

1. User sends credentials to `/auth/login`
2. Server validates email/password
3. Server returns:

```json
{
  "accessToken": "...",
  "refreshToken": "..."
}
```

4. Access token stored in memory
5. Refresh token stored in `localStorage`

### Automatic Token Refresh (via Axios interceptor)

When a protected API returns `401 Unauthorized`:

1. Axios calls `/auth/refresh`
2. Server validates refresh token
3. If valid → new access token issued
4. If invalid → user is logged out automatically

## Server-Side Authorization (RBAC)

Authorization is enforced using Role-Based Access Control (RBAC) with roles:

- `ADMIN`
- `OPERATOR`
- `CUSTOMER`

**Key Components**

- `@Roles()` decorator
- `RolesGuard` — checks user.role
- `JwtAuthGuard` — validates token + loads `req.user`

**Protected Endpoint Example**

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get('users')
getAllUsers() {
  return this.adminService.findAllUsers();
}
```

**Why Both Guards?**
| Guard          | Purpose                                               |
| -------------- | ----------------------------------------------------- |
| `JwtAuthGuard` | Authenticates user, verifies JWT, attaches `req.user` |
| `RolesGuard`   | Checks if the user’s role has permission              |


RolesGuard **cannot work alone**, because `req.user` comes from `JwtAuthGuard`.

## Client-Side Authorization

Client-side authorization is enforced through:

### 3.1 Protected Routes

Access is restricted based on the authenticated user's role.

```tsx
export default function ProtectedRole({ allowed, children }) {
  const { user } = useAuth();
  if (!user) return <Redirect to="/login" />;
  if (!allowed.includes(user.role)) return <Redirect to="/" />;
  return children;
}
```

Used in the Admin page:

```tsx
<ProtectedRole allowed={['ADMIN']}>
  <AdminPage />
</ProtectedRole>
```

### 3.2 UI Hiding

The navigation bar changes based on whether the user is logged in:

```tsx
{user ? (
  <>
    <span>{user.name}</span>
    <button onClick={logout}>Logout</button>
  </>
) : (
  <>
    <Link href="/login">Login</Link>
    <Link href="/register">Sign up</Link>
  </>
)}
```

Admins see admin links. Customers do not.

### 3.3 React Query Integration

React Query automatically fetches user data only if authorized.

```tsx
useQuery({
  queryKey: ['admin', 'users'],
  queryFn: () => api.get('/admin/users').then(r => r.data),
  enabled: user?.role === 'ADMIN'
});
```

## Axios Interceptor (Token Management)

A centralized Axios instance:

- Adds the access token to every request
- Refreshes expired tokens
- Auto-logs out if refresh fails

```ts
api.interceptors.response.use(
  res => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refresh = localStorage.getItem('refreshToken');
      if (!refresh) return logout();

      const newAccess = await api.post('/auth/refresh', { refresh });
      setAccessToken(newAccess.data.accessToken);

      error.config.headers.Authorization = 
        `Bearer ${newAccess.data.accessToken}`;
      return api(error.config);
    }
    return Promise.reject(error);
  }
);
```

## Admin Role Management (Server Enforcement)

### Controller

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get('users')
async getAllUsers() {
  return this.adminService.findAllUsers();
}
```

### Service

```ts
async findAllUsers() {
  const users = await this.usersRepo.find();
  return users.map(u => ({
    userId: u.id,
    fullName: u.name,
    email: u.email,
    role: u.role,
  }));
}
```

Frontend Example

```ts
const { data: users } = useAdminUsers();
```

## Why Role-Based Authorization?

### Pros

- Simple & easy to understand
- Fast checks (single string compare)
- Perfect for small/medium systems
- NestJS provides first-class support
- Easy to enforce on UI and API

### Cons

- Not flexible for large systems
- Cannot express fine-grained permissions
- Often requires adding many roles later

### Tradeoffs

RBAC works best when:

- Roles are few
- Privileges are predictable
- Assignment requires clear separation (admin/customer/operator)

Given these constraints, RBAC is the ideal authorization model for this project.

## Additional Security Features

The system includes:

- Password hashing (bcrypt)
- JWT validation (expiry, issuer, audience)
- Refresh token validation
- Token blacklist during logout
- Admin action audit logs
- Guards protecting all server routes
- Avoiding localStorage for access tokens (XSS protection)

## Final Security Checklist

| Feature                  | Status |
| ------------------------ | ------ |
| Login                    | ✔      |
| Register                 | ✔      |
| Access Token             | ✔      |
| Refresh Token            | ✔      |
| Token Refresh Flow       | ✔      |
| Logout                   | ✔      |
| Role-Based Authorization | ✔      |
| Admin-Only Pages         | ✔      |
| Axios Interceptors       | ✔      |
| Protected Routes         | ✔      |
| Server Guards            | ✔      |
| UI Hiding                | ✔      |
| Audit Logging            | ✔      |
| Token Blacklist          | ✔      |
