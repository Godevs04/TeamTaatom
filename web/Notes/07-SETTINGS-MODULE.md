# Settings Module – Developer Guide

Documentation for the **Settings** module and sub-screens.

---

## 1. Purpose & User Flow

- **Entry:** `app/settings/index.tsx` (settings home with sections and banner).
- **Sub-screens:** account, privacy, notifications, appearance, data, about, follow-requests, account-activity, blocked-users, content-policy, terms, contact-support, manage-posts.
- **Purpose:** Central place for account, privacy, notification preferences, theme, data/storage, about/feedback, follow requests, blocked users, and manage (archived/hidden) posts.
- **User flow:** Open Settings → tap section → edit toggles/options → save; reset all settings with confirmation.

---

## 2. Key Functionality

| Feature | Description |
|---------|-------------|
| **Settings home** | List of sections (Account, Privacy & Security, Notifications, Appearance, Data & Storage, Collections, Activity Feed, Manage Posts); user info header; reset button; optional banner image. |
| **Get/update settings** | `getSettings()`, `updateSettings(partial)`, `updateSettingCategory(category, settings)`, `resetSettings()`. |
| **Categories** | privacy | notifications | account; each category has its own shape (see UserSettings). |
| **Connectivity check** | Before update, settings service can call `/api/v1/auth/me` with timeout to detect network. |
| **Theme** | Stored via ThemeContext (light/dark/auto); may sync to backend in account settings. |
| **Follow requests** | Link to follow-requests screen; approve/reject from notifications or profile. |
| **Manage posts** | Archived and hidden posts; restore/unhide. |

---

## 3. Backend API Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/settings` | Get full user settings. |
| PUT | `/api/v1/settings` | Update settings (body: { settings }). |
| PUT | `/api/v1/settings/${category}` | Update single category (privacy \| notifications \| account). |
| POST | `/api/v1/settings/reset` | Reset to defaults. |
| GET | `/api/v1/auth/me` | Used for connectivity check (timeout 5s). |

---

## 4. Types & Schemas

**UserSettings (services/settings.ts):**

- **privacy:** profileVisibility, showEmail, showLocation, allowMessages, requireFollowApproval, allowFollowRequests, shareActivity.
- **notifications:** pushNotifications, emailNotifications, likesNotifications, commentsNotifications, followsNotifications, messagesNotifications, followRequestNotifications, followApprovalNotifications, quietHours.
- **account:** language, theme, dataUsage, wifiOnlyDownloads, autoSync, fontSize.

**SettingsResponse:** { settings: UserSettings }.

---

## 5. File Map

| File | Role |
|------|------|
| `app/settings/index.tsx` | Settings home, sections list, banner, reset. |
| `app/settings/account.tsx` | Account settings. |
| `app/settings/privacy.tsx` | Privacy & security. |
| `app/settings/notifications.tsx` | Notification preferences. |
| `app/settings/appearance.tsx` | Theme, display. |
| `app/settings/data.tsx` | Data & storage. |
| `app/settings/about.tsx` | About, feedback. |
| `app/settings/manage-posts.tsx` | Archived/hidden posts. |
| `services/settings.ts` | getSettings, updateSettings, updateSettingCategory, resetSettings. |
| `context/SettingsContext.tsx` | May hold settings state and sync with backend. |

---

## 6. UserSettings – full schema (technical)

**privacy:** profileVisibility ('public' | 'followers' | 'private'), showEmail (boolean), showLocation (boolean), allowMessages ('everyone' | 'followers' | 'none'), requireFollowApproval (boolean), allowFollowRequests (boolean), shareActivity? (boolean).

**notifications:** pushNotifications, emailNotifications, likesNotifications, commentsNotifications, followsNotifications, messagesNotifications, followRequestNotifications, followApprovalNotifications (all boolean); quietHours? { enabled, startTime, endTime, days[] }.

**account:** language (string), theme ('light' | 'dark' | 'auto'), dataUsage ('low' | 'medium' | 'high'), wifiOnlyDownloads?, autoSync?, fontSize? ('small' | 'medium' | 'large').

---

## 7. Update flow (technical)

- **Full update:** updateSettings(partialSettings) → PUT /api/v1/settings with body { settings: partialSettings }. Backend merges with existing.
- **Category update:** updateSettingCategory('privacy' | 'notifications' | 'account', categoryPayload) → PUT /api/v1/settings/${category}. Used when user changes only one category (e.g. notifications toggles) to avoid sending full object.
- **Connectivity check:** Before update, settings.ts may call GET /api/v1/auth/me with timeout 5000; if fails throw "No internet connection...". Prevents silent fail on offline.

---

## 8. Reset settings (functional)

- User taps "Reset All Settings"; confirmation (showConfirm or CustomAlert): "Are you sure? This will reset all settings to default." On confirm call resetSettings() → POST /api/v1/settings/reset. On success showSuccess and refetch settings (and optionally sync theme to ThemeContext). On error showError.

---

## 9. Settings context (if used)

- SettingsContext may hold current settings in state; on mount fetch getSettings(); when user changes a toggle, call updateSettingCategory and then update context state so UI reflects immediately without full refetch.

---

## 10. Sub-screens (brief)

- **account:** Language, theme, data usage, font size; links to account-activity, blocked-users, verify-email, delete account, export data (userManagement APIs).
- **privacy:** Profile visibility, show email/location, allow messages, follow approval toggles.
- **notifications:** Push, email, per-type toggles (likes, comments, follows, messages, follow requests/approvals); quiet hours if supported.
- **appearance:** Theme (light/dark/auto); may read/write ThemeContext and sync to backend via account settings.
- **data:** Cache clear, storage info, sync options (wifiOnlyDownloads, autoSync).
- **about:** App version, feedback (submit to backend or email), links to terms, privacy, contact.
- **manage-posts:** Lists archived and hidden posts (getArchivedPosts, getHiddenPosts); restore/unhide via unarchivePost, unhidePost.

---

*Notifications flow: [06-NOTIFICATIONS-MODULE.md](./06-NOTIFICATIONS-MODULE.md). Profile: [03-PROFILE-MODULE.md](./03-PROFILE-MODULE.md).*
