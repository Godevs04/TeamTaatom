# Auth Module – Developer Guide

In-depth documentation for **Authentication**: sign up, sign in, OTP, forgot/reset password, session, tokens.

---

## 1. Purpose & User Flow

- **Screens:** `app/(auth)/signin.tsx`, `signup.tsx`, `verifyOtp.tsx`, `forgot.tsx`, `reset-password.tsx`.
- **Purpose:** Register (sign up → verify OTP), sign in, forgot password (email → reset flow), reset password; maintain session (token on mobile, httpOnly cookies on web).
- **User flow:** Sign up → enter email/name/username/password → receive OTP → verify OTP → signed in. Sign in → email/password → token/cookie set. Forgot → email → link or code → reset password.

---

## 2. Key Functionality

| Feature | Description |
|---------|-------------|
| **Sign up** | `signUp({ fullName, username, email, password, termsAccepted? })`; backend may send OTP. |
| **Check username** | `checkUsernameAvailability(username)` → { available } or { error }. |
| **Verify OTP** | `verifyOTP({ email, otp })`; returns token/user. |
| **Resend OTP** | `resendOTP(email)`. |
| **Sign in** | `signIn({ email, password })`; mobile: store token in AsyncStorage; web: backend sets httpOnly cookie. |
| **Get current user** | `getCurrentUser()` → UserType | null | 'network-error'; 401/403 → null; rate limit/network → 'network-error'. |
| **Get user from storage** | `getUserFromStorage()` → cached user from AsyncStorage (no API call). |
| **Logout** | `logout()`; POST `/api/v1/auth/logout`; clear AsyncStorage (mobile). |
| **Forgot password** | `forgotPassword(email)` → POST `/api/v1/auth/forgot-password`. |
| **Google sign-in** | `googleAuth()` → exchange with backend `/api/v1/auth/google`. |
| **Token refresh** | api interceptor: on 401 try POST `/api/v1/auth/refresh` then retry request (mobile). |

---

## 3. Backend API Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/auth/signup` | Register. |
| GET | `/api/v1/auth/check-username?username=` | Username availability. |
| POST | `/api/v1/auth/verify-otp` | Verify OTP (body: email, otp). |
| POST | `/api/v1/auth/resend-otp` | Resend OTP (body: { email }). |
| POST | `/api/v1/auth/signin` | Sign in (body: email, password). |
| GET | `/api/v1/auth/me` | Current user (auth required). |
| POST | `/api/v1/auth/logout` | Logout. |
| POST | `/api/v1/auth/forgot-password` | Forgot password (body: { email }). |
| POST | `/api/v1/auth/google` | Google OAuth (body: idToken, etc.). |
| POST | `/api/v1/auth/refresh` | Refresh token (used by interceptor). |

---

## 4. Types & Schemas

**SignUpData:** fullName, username, email, password, termsAccepted?.

**SignInData:** email, password.

**VerifyOTPData:** email, otp.

**AuthResponse:** message, token?, user?, email?.

**UserType:** _id, fullName, username?, email, profilePic?, bio?, etc. (types/user.ts).

---

## 5. Technical Logic (Summary)

- **Web vs mobile:** Web: auth via httpOnly cookies + CSRF header (X-CSRF-Token from cookie); no token in AsyncStorage. Mobile: Bearer token in AsyncStorage; added by api interceptor.
- **Session persistence:** On app load, layout/auth logic calls getCurrentUser(); if null redirect to auth; if user show tabs.
- **Error handling:** parseError(error) for user-facing messages; rate limit handled in getCurrentUser (return 'network-error').
- **Last auth error:** lastAuthError stored for optional display (e.g. “Session expired”).

---

## 6. File Map

| File | Role |
|------|------|
| `app/(auth)/signin.tsx` | Sign-in form. |
| `app/(auth)/signup.tsx` | Sign-up form. |
| `app/(auth)/verifyOtp.tsx` | OTP verification. |
| `app/(auth)/forgot.tsx` | Forgot password. |
| `app/(auth)/reset-password.tsx` | Reset password form. |
| `services/auth.ts` | signUp, signIn, verifyOTP, resendOTP, getCurrentUser, getUserFromStorage, logout, forgotPassword, checkUsernameAvailability. |
| `services/googleAuth.ts` | Google OAuth flow and backend exchange. |
| `services/api.ts` | Interceptor: attach token / refresh on 401. |
| `types/user.ts` | UserType. |

---

## 7. Token & cookie behaviour (technical)

- **Mobile:** After signIn/signUp/verifyOTP, backend returns token; frontend stores in AsyncStorage under 'authToken'. Every API request (api.ts interceptor) attaches header Authorization: Bearer ${token}. Logout: POST /api/v1/auth/logout and remove 'authToken' and 'userData' from AsyncStorage.
- **Web:** Backend sets httpOnly cookie on sign-in; withCredentials: true so cookie sent automatically. No token in localStorage/sessionStorage (XSS-safe). For CSRF, read cookie csrf-token and send header X-CSRF-Token on state-changing requests. getCurrentUser() does not read token; backend uses cookie.

---

## 8. getCurrentUser – return values (technical)

- **Success:** Returns user object (UserType); stored in AsyncStorage as 'userData'; lastAuthError set to null.
- **401/403:** Token invalid or forbidden; return null (caller should redirect to sign-in).
- **Rate limit (429):** handleRateLimitError; return 'network-error' so caller can show "try again" without signing out.
- **Network/other error:** Return 'network-error'; lastAuthError set to message. Caller should not clear session; may show banner "Connection issue" and retry.

---

## 9. Sign-up flow (step-by-step)

1. User fills fullName, username, email, password; optionally terms accepted.
2. Optional: checkUsernameAvailability(username) for live feedback.
3. signUp(data) → POST /api/v1/auth/signup. On success backend may return { email } and expect OTP; redirect to verifyOtp with email in state/params.
4. verifyOtp({ email, otp }) → POST /api/v1/auth/verify-otp; response includes token, user; store token (mobile) and userData; redirect to (tabs) or onboarding.
5. Resend: resendOTP(email) if user didn't receive code.

---

## 10. Forgot password flow (functional)

1. User enters email on forgot.tsx; submit → forgotPassword(email) → POST /api/v1/auth/forgot-password.
2. Backend sends email with link or code. Frontend may show "Check your email" and link to reset-password (with token in URL or code input).
3. reset-password: user enters new password; backend endpoint (e.g. POST /api/v1/auth/reset-password with token/code and new password); on success redirect to sign-in with showSuccess.

---

## 11. Google sign-in (technical)

- googleAuth() uses expo-auth-session or similar to get idToken from Google; then POST /api/v1/auth/google with { idToken } (or credential). Backend validates and returns token/user; same storage and redirect as sign-in.

---

## 12. API interceptor (refresh token)

- On 401 response, api.ts interceptor may attempt POST /api/v1/auth/refresh (with cookie or refresh token); on success retry original request with new token; on failure redirect to sign-in or reject.

---

*API reference: [11-BACKEND-API-REFERENCE.md](./11-BACKEND-API-REFERENCE.md).*
