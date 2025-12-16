# Google OAuth 2.0 Social Login Setup Guide

This guide walks you through setting up Google OAuth 2.0 authentication for your application, from creating a Google Cloud project to implementing the login flow in your backend and frontend.

---

## Table of Contents

1. [Overview](#overview)
2. [Google Cloud Console Setup](#google-cloud-console-setup)
3. [Backend Implementation (NestJS)](#backend-implementation-nestjs)
4. [Frontend Implementation (React/Next.js)](#frontend-implementation-reactnextjs)
5. [Security Considerations](#security-considerations)
6. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Google OAuth 2.0?

Google OAuth 2.0 allows users to sign in to your application using their Google account, eliminating the need for them to create and remember another password. The flow works as follows:

1. User clicks "Sign in with Google" button
2. User is redirected to Google's authentication page
3. User grants permission to your app
4. Google redirects back to your app with an authorization code
5. Your backend exchanges the code for user information
6. Your backend creates/updates the user and issues your own JWT tokens

### Benefits

- **Better UX**: One-click login without password creation
- **Enhanced Security**: Leverage Google's security infrastructure
- **Reduced Friction**: Lower barrier to entry for new users
- **Trust**: Users trust Google authentication

---

## Google Cloud Console Setup

### Step 1: Create a Google Cloud Project

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click **"New Project"**
4. Enter your project name (e.g., "Bus Ticket App")
5. Click **"Create"**

### Step 2: Enable Google+ API

1. In the left sidebar, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"** or **"Google Identity"**
3. Click on it and press **"Enable"**

> **Note**: As of 2023, Google recommends using the Google Identity Services instead of the deprecated Google+ API. The OAuth 2.0 flow remains the same.

### Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Choose **User Type**:
   - **Internal**: Only for Google Workspace users in your organization
   - **External**: For anyone with a Google account (choose this for public apps)
3. Click **"Create"**

#### Fill in App Information:

- **App name**: Your application name (e.g., "Bus Ticket Booking")
- **User support email**: Your email address
- **App logo**: (Optional) Upload your app logo
- **App domain**: Your application's domain
- **Authorized domains**: Add your domain (e.g., `yourdomain.com`)
- **Developer contact information**: Your email address

4. Click **"Save and Continue"**

#### Scopes:

5. Click **"Add or Remove Scopes"**
6. Select the following scopes:
   - `userinfo.email` - See your email address
   - `userinfo.profile` - See your personal info, including any personal info you've made publicly available
   - `openid` - Authenticate using OpenID Connect
7. Click **"Update"** → **"Save and Continue"**

#### Test Users (for External apps in testing):

8. Add test users if your app is still in testing mode
9. Click **"Save and Continue"**

#### Summary:

10. Review your settings and click **"Back to Dashboard"**

### Step 4: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Choose **Application type**: **"Web application"**
4. Enter a **Name** (e.g., "Bus Ticket Web Client")

#### Configure Authorized Redirect URIs:

5. Under **"Authorized JavaScript origins"**, add:

   ```
   http://localhost:8000
   https://yourdomain.com
   ```

6. Under **"Authorized redirect URIs"**, add:

   ```
   http://localhost:3000/auth/google/callback
   http://localhost:8000/auth/google/callback
   https://yourdomain.com/auth/google/callback
   ```

   > **Important**: The redirect URI must exactly match the one configured in your backend code.

7. Click **"Create"**

### Step 5: Save Your Credentials

After creation, you'll see a modal with:

- **Client ID**: A long string like `123456789-abc123.apps.googleusercontent.com`
- **Client Secret**: A secret string like `GOCSPX-abc123xyz789`

**Important**: Copy and save these credentials securely. You'll need them for your backend configuration.

---

## Backend Implementation (NestJS)

### Step 1: Install Required Packages

```bash
npm install @nestjs/passport passport passport-google-oauth20
npm install -D @types/passport-google-oauth20
```

### Step 2: Configure Environment Variables

Add to your `.env` file:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Frontend URL (for redirects after auth)
FRONTEND_URL=http://localhost:8000
```

### Step 3: Create Google Strategy

Create `src/auth/strategies/google.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;

    const user = {
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos[0].value,
      accessToken,
      provider: 'google',
      providerId: profile.id,
    };

    done(null, user);
  }
}
```

### Step 4: Create Google Auth Guard

Create `src/auth/guards/google-auth.guard.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
```

### Step 5: Update Auth Service

Add methods to `src/auth/auth.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateGoogleUser(googleUser: any): Promise<User> {
    const { email, firstName, lastName, picture, providerId } = googleUser;

    // Check if user exists
    let user = await this.usersRepository.findOne({
      where: [{ email }, { provider: 'google', providerId }],
    });

    if (!user) {
      // Create new user
      user = this.usersRepository.create({
        email,
        firstName,
        lastName,
        avatar: picture,
        provider: 'google',
        providerId,
        isEmailVerified: true, // Google emails are pre-verified
      });
      await this.usersRepository.save(user);
    } else if (user.provider !== 'google') {
      // Link Google account to existing email/password account
      user.provider = 'google';
      user.providerId = providerId;
      user.avatar = picture || user.avatar;
      user.isEmailVerified = true;
      await this.usersRepository.save(user);
    }

    return user;
  }

  async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '1h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    // Store refresh token in database
    await this.storeRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, token: string) {
    // Implementation depends on your refresh token storage strategy
    // See AUTHENTICATION.md for details
  }
}
```

### Step 6: Update Auth Controller

Add routes to `src/auth/auth.controller.ts`:

```typescript
import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Initiates the Google OAuth flow
    // User will be redirected to Google's consent page
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthCallback(@Req() req, @Res() res: Response) {
    // Validate and create/update user
    const user = await this.authService.validateGoogleUser(req.user);

    // Generate JWT tokens
    const { accessToken, refreshToken } =
      await this.authService.generateTokens(user);

    // Set HTTP-only cookies
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 3600000, // 1 hour
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 604800000, // 7 days
    });

    // Redirect to frontend
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    res.redirect(`${frontendUrl}/auth/success`);
  }
}
```

### Step 7: Register Strategy in Auth Module

Update `src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

### Step 8: Update User Entity

Ensure your `User` entity supports OAuth fields:

```typescript
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  password: string; // Nullable for OAuth users

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ default: 'local' })
  provider: string; // 'local', 'google', 'facebook', etc.

  @Column({ nullable: true })
  providerId: string; // ID from OAuth provider

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
```

---

## Frontend Implementation (React/Next.js)

### Step 1: Create Google Login Button Component

Create `components/GoogleLoginButton.tsx`:

```typescript
import React from 'react';

interface GoogleLoginButtonProps {
  text?: string;
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  text = 'Continue with Google'
}) => {
  const handleGoogleLogin = () => {
    // Redirect to backend Google OAuth endpoint
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  return (
    <button
      onClick={handleGoogleLogin}
      className="google-login-btn"
      type="button"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
        <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
        <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
      </svg>
      <span>{text}</span>
    </button>
  );
};
```

### Step 2: Add Styles

Add to your CSS file:

```css
.google-login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 12px 24px;
  background: white;
  border: 1px solid #dadce0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #3c4043;
  cursor: pointer;
  transition: all 0.2s ease;
}

.google-login-btn:hover {
  background: #f8f9fa;
  border-color: #d2d3d4;
  box-shadow:
    0 1px 2px 0 rgba(60, 64, 67, 0.3),
    0 1px 3px 1px rgba(60, 64, 67, 0.15);
}

.google-login-btn:active {
  background: #f1f3f4;
  border-color: #d2d3d4;
}
```

### Step 3: Create Auth Success Page

Create `pages/auth/success.tsx` (or `app/auth/success/page.tsx` for App Router):

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthSuccessPage() {
  const router = useRouter();
  const { fetchCurrentUser } = useAuth();

  useEffect(() => {
    const handleAuthSuccess = async () => {
      try {
        // Fetch the current user (cookies are automatically sent)
        await fetchCurrentUser();

        // Redirect to dashboard or home
        router.push('/dashboard');
      } catch (error) {
        console.error('Auth success error:', error);
        router.push('/login?error=auth_failed');
      }
    };

    handleAuthSuccess();
  }, [router, fetchCurrentUser]);

  return (
    <div className="auth-success-container">
      <div className="spinner"></div>
      <p>Completing sign in...</p>
    </div>
  );
}
```

### Step 4: Configure Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### Step 5: Use the Google Login Button

In your login page:

```typescript
import { GoogleLoginButton } from '@/components/GoogleLoginButton';

export default function LoginPage() {
  return (
    <div className="login-page">
      <h1>Sign In</h1>

      {/* Traditional email/password form */}
      <form>
        {/* ... */}
      </form>

      <div className="divider">
        <span>OR</span>
      </div>

      {/* Google OAuth */}
      <GoogleLoginButton />
    </div>
  );
}
```

---

## Security Considerations

### 1. Validate Redirect URIs

- **Always** whitelist exact redirect URIs in Google Cloud Console
- Never use wildcards in production
- Validate the `state` parameter to prevent CSRF attacks

### 2. Secure Token Storage

- Store tokens in **HTTP-only cookies** (not localStorage)
- Use `Secure` flag in production (HTTPS only)
- Use `SameSite=Lax` or `SameSite=Strict`

### 3. Environment Variables

- **Never** commit `.env` files to version control
- Use different credentials for development and production
- Rotate secrets regularly

### 4. HTTPS in Production

- Always use HTTPS in production
- Update authorized origins and redirect URIs to use `https://`

### 5. Handle Account Linking

- Decide how to handle cases where:
  - User signs up with email/password, then tries Google OAuth with same email
  - User has multiple Google accounts
- Implement proper account linking or merging logic

### 6. Scope Minimization

- Only request the scopes you actually need
- Users are more likely to grant permission for minimal scopes

---

## Troubleshooting

### Error: "redirect_uri_mismatch"

**Cause**: The redirect URI in your code doesn't match the one configured in Google Cloud Console.

**Solution**:

1. Check the exact URI in the error message
2. Go to Google Cloud Console → Credentials
3. Add the exact URI to "Authorized redirect URIs"
4. Wait a few minutes for changes to propagate

### Error: "Access blocked: This app's request is invalid"

**Cause**: OAuth consent screen is not properly configured.

**Solution**:

1. Complete all required fields in the OAuth consent screen
2. Add your email to test users if the app is in testing mode
3. Verify the app domain is authorized

### Error: "invalid_client"

**Cause**: Client ID or Client Secret is incorrect.

**Solution**:

1. Double-check your `.env` file
2. Ensure there are no extra spaces or quotes
3. Regenerate credentials if necessary

### Cookies Not Being Set

**Cause**: CORS or SameSite issues.

**Solution**:

1. Ensure backend CORS is configured with `credentials: true`
2. Frontend must use `withCredentials: true` in axios
3. In development, use `SameSite=Lax` instead of `Strict`
4. Ensure frontend and backend are on compatible domains

### User Redirected but Not Logged In

**Cause**: Cookies not being sent or auth context not updated.

**Solution**:

1. Check browser DevTools → Application → Cookies
2. Verify cookies are being set with correct domain
3. Ensure `fetchCurrentUser()` is called after redirect
4. Check for JavaScript errors in console

---

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Identity Services](https://developers.google.com/identity/gsi/web)
- [Passport.js Google Strategy](http://www.passportjs.org/packages/passport-google-oauth20/)
- [NestJS Passport Integration](https://docs.nestjs.com/security/authentication)

---

## Summary

You've now set up Google OAuth 2.0 authentication! The flow is:

1. ✅ User clicks "Continue with Google"
2. ✅ User is redirected to Google's consent page
3. ✅ User grants permission
4. ✅ Google redirects to your backend callback
5. ✅ Backend validates user and issues JWT tokens
6. ✅ Tokens are stored in HTTP-only cookies
7. ✅ User is redirected to frontend success page
8. ✅ Frontend fetches user data and redirects to dashboard

This implementation follows security best practices and integrates seamlessly with your existing JWT authentication system.
