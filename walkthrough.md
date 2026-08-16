# QA Verification & Walkthrough: Profile, Post, Feed, Chat & UX Systems (Bugs 1–18)

This document provides complete end-to-end verification and evidence across all implemented bug fixes and enhancements.

---

## 📊 Complete Feature & Bug Status Matrix

| ID | Issue Description | Status | Evidence / Verification |
|:---|:---|:---:|:---|
| **1** | **Profile Page — Edit Profile Button**<br>Visible on own profile, strictly hidden on other users' profiles. | **PASS** | UI check & responsive tests verify `isOwnProfile` check (`qa_01_own_profile_desktop.png`, `qa_03_other_profile_desktop.png`). |
| **2** | **Profile Content & Text Overflow**<br>Missing bio/links populated, long text clamped with clickable `...more` toggles. | **PASS** | Rendered populated metadata with non-breaking truncation and expandable bio/captions. |
| **3** | **Post Detailed-View UI**<br>Redesigned post view matching standard layout with action bar, owner menu, and comment tray. | **PASS** | Verified on desktop and mobile (`qa_02_post_detail_desktop.png`, `qa_06_own_post_detail.png`, `qa_11_mobile_post_detail.png`). |
| **4** | **Post Image Alignment & Aspect Ratios**<br>Zero layout shifts, letterboxing for portrait/landscape with backdrop blur. | **PASS** | Verified square, 9:16 portrait, and 16:9 landscape aspect ratios without overflow. |
| **5** | **Post Options Menu & Report User Flow**<br>Own post: Edit/Delete/Archive; Other post: Report/Mute/Block/Copy link. | **PASS** | Verified dropdown menus (`qa_07_own_post_menu.png`, `qa_09_other_post_menu.png`, `qa_05_report_user_modal.png`). |
| **6** | **Real-Time Dynamic Likes Sync**<br>Account A likes post $\rightarrow$ Account B sees live count & state update without refresh. | **PASS** | Verified WebSocket `post:stats_updated` event broadcasting and React Query cache invalidation (`qa_13_post_liked_state.png`). |
| **7** | **Post Detail Zero-Count Bug Fix**<br>Fix `0 likes · 0 comments` display by removing destructive aggregation overrides and hydrating `isLiked`. | **PASS** | Verified post detail returns real counts from MongoDB (`qa_12_post_detail_counts.png`). |
| **8** | **Hashtag Post Grid Rendering**<br>Render all tagged posts when count $> 0$, each post clickable to detail view. | **PASS** | Verified tag search regex with post grid cards (`qa_14_hashtag_page.png`). |
| **9** | **Chat Media & File URL Security**<br>Raw cloud storage bucket URLs never exposed directly; dynamic signed ephemeral URLs with 1h TTL. | **PASS** | Verified signed Cloudflare R2 URLs on messages API with preserved `storageKey`. |
| **10** | **New Message Live Highlighting**<br>Incoming messages highlight the relevant conversation card in the chat list. | **PASS** | Verified active highlight card styling and socket subscription in chat inbox (`qa_15_chat_list_view.png`). |
| **11** | **Unread Message Badges**<br>Show `1, 2, 3...` unread badge chips per thread; auto-reset upon reading thread. | **PASS** | Verified per-conversation unread count computation in `listChats` and reset on view. |
| **12** | **Message Edit & Soft Delete**<br>Sender can edit message text or soft-delete message (`This message was deleted`) with socket sync. | **PASS** | Verified `PATCH` and `DELETE` endpoints with permission guards and live socket broadcasts (`qa_16_chat_thread_view.png`). |
| **13** | **Delivered & Read Receipts**<br>Sent `✓`, Delivered `✓✓` (gray), and Read `✓✓` (accent colored) status receipts. | **PASS** | Verified receipt icon rendering and live `message:status_changed` socket events (`qa_17_chat_message_sent.png`). |
| **14** | **Global Confirmation Dialog**<br>Replaced `window.confirm()` globally with an accessible, high-performance `ConfirmDialog` modal. | **PASS** | Verified across Delete Post, Archive, Hide, Block User, Clear Chat, Delete Journey, Delete Collection, Delete Account. |
| **15** | **Real-Time Typing Indicator**<br>Show `typing...` in real time; debounced/throttled socket emission (1500ms throttle, 2500ms idle stop, blur/clear stop). | **PASS** | Verified typing debouncing lifecycle and animated 3-dot typing bubble in chat thread. |
| **16** | **Responsive Chat UX**<br>Full usability across desktop, tablet, and mobile; mobile viewport dynamic height, no menu overflow or clipping. | **PASS** | Verified layout on 375px mobile viewport with accessible header back-button and composer controls. |
| **17** | **Blocked-User Behavior & Privacy**<br>Blocked users cannot message (403), view profile, or see posts in feeds/explore. | **PASS** | Backend filters `blockedUsers` in `chat.controller.js`, `postController.js`, and `profileController.js`. |
| **18** | **PWA Compliance & Offline Support**<br>Audited manifest (`display: standalone`, maskable icons, theme color), safe-area cover, and service worker cache. | **PASS** | Verified `GET /manifest.webmanifest` returns standalone manifest, `/sw.js` caches static shell for offline use. |

---

## 🛠️ Summary of Changed Files

1. **Confirmation Dialog System (Bug 14):**
   - [web/components/ui/confirm-dialog.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/components/ui/confirm-dialog.tsx): Accessible modal dialog with focus management, backdrop blur, and `destructive`/`warning`/`default` variants.
   - [web/context/confirm-context.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/context/confirm-context.tsx): `ConfirmProvider` and `useConfirm()` promise-based hook.
   - [web/providers/app-providers.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/providers/app-providers.tsx): Wrapped root with `<ConfirmProvider>`.
   - [web/components/trip/post-card.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/components/trip/post-card.tsx): Replaced `window.confirm` for delete, archive, and hide.
   - [web/components/trip/post-detail-menu.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/components/trip/post-detail-menu.tsx): Replaced `window.confirm` for delete, archive, and block.
   - [web/components/profile/profile-actions.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/components/profile/profile-actions.tsx): Replaced `window.confirm` for block/unblock.
   - [web/components/settings/account-security-section.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/components/settings/account-security-section.tsx): Replaced `window.confirm` for account deletion.
   - [web/app/(dashboard)/journeys/[id]/journey-detail-client.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/app/(dashboard)/journeys/[id]/journey-detail-client.tsx): Replaced `window.confirm` for journey deletion.
   - [web/app/(dashboard)/journeys/page.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/app/(dashboard)/journeys/page.tsx): Replaced `window.confirm` for list item deletion.
   - [web/app/(dashboard)/collections/[id]/page.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/app/(dashboard)/collections/[id]/page.tsx): Replaced `window.confirm` for collection deletion.
   - [web/app/(dashboard)/chat/[userId]/page.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/app/(dashboard)/chat/[userId]/page.tsx): Replaced `window.confirm` for clear chat and message deletion.

2. **Typing Indicators & Responsive Chat (Bugs 15–16):**
   - [web/components/chat/chat-composer.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/components/chat/chat-composer.tsx): Added 1500ms keystroke throttle, 2500ms idle stop debounce, explicit `onStopTyping` on blur/submit/empty.
   - [web/app/(dashboard)/chat/[userId]/page.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/app/(dashboard)/chat/[userId]/page.tsx): Animated 3-dot typing bubble, `h-[calc(100dvh-4rem)]` dynamic height, mobile options menu positioning.

3. **Blocked-User Privacy (Bug 17):**
   - [backend/src/controllers/chat.controller.js](file:///c:/Users/sukes/Downloads/TeamTaatom/backend/src/controllers/chat.controller.js): `canChat` mutual block check (blocks message send if either user is blocked).
   - [backend/src/controllers/profileController.js](file:///c:/Users/sukes/Downloads/TeamTaatom/backend/src/controllers/profileController.js): Blocked users cannot view profile or posts.
   - [backend/src/controllers/postController.js](file:///c:/Users/sukes/Downloads/TeamTaatom/backend/src/controllers/postController.js): Feed queries filter out posts from blocked users.

4. **PWA & Offline Support (Bug 18):**
   - [web/app/manifest.ts](file:///c:/Users/sukes/Downloads/TeamTaatom/web/app/manifest.ts): Configured `standalone`, categories, theme color `#2563eb`, and maskable/any icons.
   - [web/app/layout.tsx](file:///c:/Users/sukes/Downloads/TeamTaatom/web/app/layout.tsx): Configured `viewportFit: "cover"` and `appleWebApp` metadata.
   - [web/public/sw.js](file:///c:/Users/sukes/Downloads/TeamTaatom/web/public/sw.js): Configured cache-first static shell and network-first navigation with fallback.

---

## 🔍 Validation Results
- **TypeScript (`npm run typecheck`):** `0 errors`
- **ESLint (`npm run lint`):** `0 warnings, 0 errors`
- **QA Automation Suite (`scratch/qa_suite_bugs_14_18.py`):** `6/6 PASSED`
