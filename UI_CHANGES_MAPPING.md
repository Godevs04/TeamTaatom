# UI Changes Mapping & Code Locations

This document provides a highly detailed mapping of the UI/UX changes requested by the client. For each of the modifications, we specify the visual screen location (e.g., top-right corner, bottom nav bar, etc.), the target source file path, exact line numbers, current code snippets, and the planned code changes.

---

## 1. Global UI, Theming & Visual Effects

### Item 1: Frosted Glass Bottom Navigation Bar
* **Visual Screen Location**: Floating Navigation Bar island at the bottom center of all main screens (Home, Shorts, Plus, Locale, Profile).
* **Target File**: [FloatingTabBar.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/ui/FloatingTabBar.tsx)
* **Code Coordinates**: Lines 137–164 (JSX rendering) and Lines 188–195 (style rules).
* **Current Implementation**:
  ```typescript
  pillDark: {
    backgroundColor: 'rgba(15, 20, 30, 0.35)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pillLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  ```
* **Planned Modification**: Adjust the opacity/background color values to enhance the frosted blur contrast:
  ```typescript
  pillDark: {
    backgroundColor: 'rgba(10, 15, 25, 0.70)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pillLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderColor: 'rgba(255, 255, 255, 0.45)',
  }
  ```

---

### Item 2: Shorts Overlay Caption Glass Background
* **Visual Screen Location**: Overlay caption text card positioned at the bottom-left of each Shorts/Reels video cell.
* **Target File**: [ShortsOverlay.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/shorts/ShortsOverlay.tsx)
* **Code Coordinates**: Lines 225–240 (JSX block) and Line 397 (styles).
* **Current Implementation**:
  ```tsx
  {post.caption && (
    <View style={[styles.captionCard, { backgroundColor: theme.colors.glassSurface, borderColor: theme.colors.glassBorder }]}>
      ...
    </View>
  )}
  ```
* **Planned Modification**: Import `BlurView` from `expo-blur` and wrap the caption layout block in a `<BlurView>` container with a low opacity background border to create a frosted glass visual integration with the background video.

---

### Item 3: "Recent" Feed Tab Gradient
* **Visual Screen Location**: Feed mode segment selector tab located at the top center of the Home feed.
* **Target File**: [CloudSegmentedControl.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/cloud/CloudSegmentedControl.tsx)
* **Code Coordinates**: Lines 44–79.
* **Planned Modification**: Check if the segment item `seg.key === 'recents'` is active, and if so, render a `LinearGradient` container (using the brand blue-green colors `['#1C73B4', '#50C878']`) inside the active item background.

---

### Item 4: Profile Picture DP Border Circle Gradient
* **Visual Screen Location**: Circular border framing the user's Profile Picture (DP) on:
  1. Main Profile Screen DP: [ProfilePremiumView.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/profile/ProfilePremiumView.tsx) (Lines 110–124 and Line 285 styles)
  2. Visitor Profile Screen DP: [[id].tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/profile/[id].tsx) (Lines 690–702 and Line 1302 styles)
* **Current Implementation**:
  ```typescript
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#1C73B4',
    overflow: 'hidden',
  }
  ```
* **Planned Modification**: Replace the solid blue border width and color on the avatar container with a `LinearGradient` wrapper container of size 74x74, holding a 70x70 image view, leaving a 2px boundary serving as a green-blue gradient ring.

---

### Item 5: Notification Bell Icon Gradient
* **Visual Screen Location**: Header bar top-right corner bell button on the Profile page.
* **Target File**: [profile.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/(tabs)/profile.tsx)
* **Code Coordinates**: Lines 1315–1319.
* **Current Implementation**:
  ```tsx
  <Ionicons
    name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
    size={22}
    color={isDark ? '#38BDF8' : '#1C73B4'}
  />
  ```
* **Planned Modification**: Import `MaskedView` from `@react-native-masked-view/masked-view` and apply `LinearGradient` (colors `['#1C73B4', '#50C878']`) as the background fill of the bell icon when there are unread notifications.

---

### Item 6: "Save" Action Icon Gradient
* **Visual Screen Location**: Bookmark action icon displayed below every feed post card.
* **Target File**: [PostActions.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/post/PostActions.tsx)
* **Code Coordinates**: Lines 153–161.
* **Current Implementation**:
  Already implements a custom `<GradientIcon>` using colors `['#1C73B4', '#50C878']` when `isSaved` is active. No structural adjustments are needed; will double-check visual completeness.

---

### Item 7: "Locale" Tab/Filter Gradient
* **Visual Screen Location**: Segmented control tab bar at the top of the Locale screen.
* **Target File**: [CloudSegmentedControl.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/cloud/CloudSegmentedControl.tsx)
* **Code Coordinates**: Lines 44–79.
* **Planned Modification**: When segment tab `seg.key === 'locale'` is active, render a brand gradient (`['#1C73B4', '#50C878']`) background under the selected tab pill.

---

### Item 8: Selected Posts Blue Tint to Gradient
* **Visual Screen Location**: Frame borders and circular checkmark overlay on selected items in Profile grid edit/selection mode.
* **Target File**: [profile.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/(tabs)/profile.tsx)
* **Code Coordinates**: Lines 1520, 1547, 1628, 1649.
* **Current Implementation**:
  ```tsx
  <View style={[styles.checkmarkCircle, { backgroundColor: theme.colors.primary }]}>
  ```
* **Planned Modification**: Replace the solid `theme.colors.primary` plain blue background inside `checkmarkCircle` with a brand `LinearGradient` (`['#1C73B4', '#50C878']`).

---

### Item 9: Dark vs. Light Theme Box Visibility
* **Visual Screen Location**: Card boxes, input containers, and boundaries in Dark Mode across all feed screens.
* **Target File**: [colors.ts](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/constants/colors.ts)
* **Code Coordinates**: Lines 22–25.
* **Current Tones**:
  ```typescript
  background: '#000000',
  surface: '#000000',
  ```
* **Planned Modification**: Shift surface colors from absolute black to slate/navy to make text boxes, dividers, and card items stand out clearly on dark layouts:
  ```typescript
  background: '#000000',
  surface: '#0A1220', // Slate Dark Navy
  surfaceSecondary: 'rgba(255, 255, 255, 0.06)',
  surfaceTertiary: 'rgba(255, 255, 255, 0.10)',
  ```

---

### Item 10: Native Alert Popups Redesign
* **Visual Screen Location**: Sharing dialogs and completion confirm prompt screens.
* **Target Files & Lines**:
  1. Post Sharing: [post.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/(tabs)/post.tsx) (Lines 2080, 2470, 2656)
  2. End Journey: [all-locations.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/map/all-locations.tsx) (Line 577), [index.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/navigate/index.tsx) (Line 129), [tracking.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/navigate/tracking.tsx) (Line 187).
* **Planned Modification**: Replace all raw native `Alert.alert(...)` instances with custom `showSuccess`, `showConfirm`, or `showOptions` calls provided by the `useAlert` context hook, triggering elegant custom bottom sheet dialog overlays.

---

## 2. Shorts & Reels UI

### Item 11: Shorts Loading Screen Removal
* **Visual Screen Location**: Initial block overlay screen displayed when tapping the Shorts tab.
* **Target File**: [shorts.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/(tabs)/shorts.tsx)
* **Code Coordinates**: Lines 3105–3120.
* **Current Implementation**:
  ```tsx
  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingGlobe size="large" ... />
      </View>
    );
  }
  ```
* **Planned Modification**: Remove the `if (loading)` guard block entirely. Change the empty feed block guard on Line 3122 to `if (!loading && shorts.length === 0)` so it falls straight through to the list container rendering immediately instead of locking the UI with a splash screen.

---

### Item 12: Shorts Full-Screen Layout
* **Visual Screen Location**: Shorts item card vertical sizing.
* **Target File**: [shorts.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/(tabs)/shorts.tsx)
* **Code Coordinates**: Line 78.
* **Current Sizing**:
  ```typescript
  const SHORTS_ITEM_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT;
  ```
* **Planned Modification**: Change the height equation to fill the viewport completely:
  ```typescript
  const SHORTS_ITEM_HEIGHT = SCREEN_HEIGHT;
  ```

---

### Item 13: Shorts Option Rail Menu
* **Visual Screen Location**: Action buttons rail aligned on the bottom-right side of the Shorts overlay.
* **Target Files**: [ShortsActions.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/shorts/ShortsActions.tsx), [ShortsOverlay.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/shorts/ShortsOverlay.tsx)
* **Code Coordinates**: `ShortsActions.tsx` lines 116–142, `ShortsOverlay.tsx` lines 282–299.
* **Planned Modification**: Remove separate Save (bookmark) and Share (paper plane) buttons. Render a single three-dot icon button (`ellipsis-horizontal`) that calls a custom options bottom sheet using `showOptions` from `useAlert` offering "Save/Unsave", "Share", and "Report" actions.

---

### Item 14: Shorts Caption Text Truncation
* **Visual Screen Location**: Caption block overlays at the bottom of the Shorts screen.
* **Target File**: [ShortsOverlay.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/shorts/ShortsOverlay.tsx)
* **Code Coordinates**: Lines 235–237.
* **Current Implementation**:
  ```tsx
  <Text style={styles.captionText} numberOfLines={isExpanded ? undefined : 2}>
    {post.caption}
  </Text>
  ```
* **Planned Modification**:
  1. Set `numberOfLines` to 1 when `isExpanded` is false, and append a pressable inline `...More` button that toggles `isExpanded`.
  2. Hide the entire `tagsRow` (hashtags block) when `isExpanded` is false, and render it only when the text is expanded (i.e. `isExpanded === true`).


---

## 3. Profile Page

### Item 15: Bio Truncation (Max 3 lines & Read More)
* **Visual Screen Location**: Bio text section under the profile statistics banner.
* **Target Files**: [BioDisplay.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/BioDisplay.tsx), [ProfilePremiumView.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/profile/ProfilePremiumView.tsx)
* **Code Coordinates**: `BioDisplay.tsx` line 12; `ProfilePremiumView.tsx` line 180.
* **Current Implementation**:
  `ProfilePremiumView.tsx` renders a raw `<Text>` block for bio instead of the truncated component:
  ```tsx
  {bio ? (
    <Text style={[styles.bioText, { color: textSecondary, ... }]}>
      {bio}
    </Text>
  ) : null}
  ```
* **Planned Modification**: Modify default `maxLines` in `BioDisplay.tsx` to 3. In `ProfilePremiumView.tsx`, replace the raw `<Text>` block with the `<BioDisplay>` component with `maxLines={3}` and `fontSize={15}`.

---

### Item 16: Profile Globe Spacing
* **Visual Screen Location**: Margin gap between the "Connect" button pill and the rotating travel Globe on the Profile page.
* **Target File**: [ProfilePremiumView.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/profile/ProfilePremiumView.tsx)
* **Code Coordinates**: Lines 205 and 370.
* **Current Styles**:
  ```typescript
  globeWrapper: {
    height: 200,
    marginVertical: 4,
  }
  ```
* **Planned Modification**: Reduce wrapper height and vertical margins, bringing the button closer to the globe:
  ```typescript
  globeWrapper: {
    height: 160,
    marginVertical: 0,
  }
  ```

---

### Item 17: Profile Terminology ("Journeys") & Tabs Alignment
* **Visual Screen Location**: List rows and sub-tabs (Posts/Shorts) layout on the visitor profile screen.
* **Target File**: [[id].tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/profile/[id].tsx)
* **Code Coordinates**: Line 844 (row title) and Line 1561 (`pillTab` style).
* **Planned Modification**:
  1. Change row title `"Travels"` on Line 844 to `"Journeys"`.
  2. Add `flex: 1` to `pillTab` styling (Line 1561) in `[id].tsx` so sub-tabs stretch evenly to fill the container width and align correctly (matching the look of `profile.tsx`).

---

## 4. Search & Notifications

### Item 18: Search Bar Cleanup
* **Visual Screen Location**: Header area of the Search results screen.
* **Target File**: [search.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/search.tsx)
* **Code Coordinates**: Lines 431–445 (tab container).
* **Current Implementation**:
  An redundant header row that renders only a single "Users" text label segment.
* **Planned Modification**: Remove the `tabContainer` view completely (lines 431–445). This shifts the search history and result list upwards, resolving the layout spacing issue.

---

### Item 19: Notification UI Badges & Auto-Clear
* **Visual Screen Locations**:
  1. Bell badge text layout: Top right corner of the Profile page.
  2. Mount clear behavior: Notifications screen.
* **Target Files**: [profile.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/(tabs)/profile.tsx) (Line 2046 styles), [notifications.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/notifications.tsx) (Line 169 mount effect).
* **Planned Modification**:
  1. Shrink `headerNotificationBadge` dimensions and font size to prevent layout overflows.
  2. In `notifications.tsx`, invoke `handleMarkAllAsRead()` within the screen mount `useEffect` so unread counts clear immediately when the user opens the notifications list.
  3. Reduce row height and padding of notification items (change `avatar` size from 48 to 40, vertical padding from 12 to 8).

---

## 5. Post Creation & Display

### Item 20: Strict Aspect Ratios
* **Visual Screen Location**: Sizing chips/options on the Post Creator screen.
* **Target Files**: [post.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/(tabs)/post.tsx) (Line 404), [ImageEditModal.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/ImageEditModal.tsx) (Line 27).
* **Planned Modification**: Modify `ASPECT_OPTIONS` in `ImageEditModal.tsx` to strictly include `'1:1'` (Square) and `'1.91:1'` (Landscape). Remove `'9:16'` from post creation options. Set the default creation aspect ratio state in `post.tsx` to `'1:1'`.

---

### Item 21: Caption Text Brightness & Swipe Prompts
* **Visual Screen Location**: Caption texts and image list headers on feed post cards.
* **Target Files**: [PostCaption.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/post/PostCaption.tsx) (Lines 85–95), [colors.ts](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/constants/colors.ts).
* **Planned Modification**:
  1. Tone down secondary/muted text colors inside `colors.ts` and `colors.light.ts` (e.g., set `textSecondary`/`textPassive` to slate gray instead of bright sky blue).
  2. In `PostCaption.tsx`, delete the `multipleImagesHint` View block (lines 85–95) that displays the "Swipe to see photos" prompt.

---

## 6. Map & Location Details

### Item 22: Map Theme Colors
* **Visual Screen Location**: Google/Apple Map component on Light Theme screens.
* **Target File**: [mapStyles.ts](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/constants/mapStyles.ts)
* **Code Coordinates**: Lines 34–62 (`calmMorningMapStyle`).
* **Planned Modification**: Change the water styling geometry color to a deeper slate blue (`#7EAADB`) and add park/natural landscape forest styles:
  ```typescript
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#A3D9A5' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#D2F1D2' }] }
  ```

---

### Item 23: Location Detail Styling & Locale Filter Visibility
* **Visual Screen Location**: Details sheet of Locale pages, and Search filter icon on the main Locale feed.
* **Target Files**: [[location].tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/tripscore/countries/[country]/locations/[location].tsx) (Line 1593), [CloudSearchDock.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/cloud/CloudSearchDock.tsx) (Line 82).
* **Planned Modification**:
  1. In `[location].tsx`, wrap the "About This Place" card container inside a `<LinearGradient>` (with text set to black `#000000`). Wrap the other 4 quick info cards inside `<BlurView>` containers to achieve a frosted glass effect.
  2. In `CloudSearchDock.tsx`, set the filter button icon color to white (`#FFFFFF`) in dark mode, preventing it from blending into the background.

---

## 7. Connect Page (Website, Subscription, Paid Items)

### Item 24: Uniform Outer Appearance
* **Visual Screen Location**: Core feed of the Connect channel page.
* **Target File**: [[id].tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/connect/page/[id].tsx)
* **Code Coordinates**: Lines 1004–1111 (Website) and Lines 1141–1324 (Subscription/Paid Items).
* **Planned Modification**: Replace the full content preview cards of Website, Subscription, and Buy Items with simple list rows exactly like the "Group Chat" cell layout (simple title text, icon, and right chevron arrow), ensuring no raw content shows on the main list.

---

### Item 25: Website Flow
* **Visual Screen Location**: Connect website preview layout screen.
* **Target File**: [preview.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/connect/preview.tsx)
* **Code Coordinates**: Lines 505–512 (header badges) and Lines 519–529 (empty states).
* **Planned Modification**:
  1. If empty (`sorted.length === 0`), render a solid white screen displaying the text "No content yet" centered in black font.
  2. If the user is the owner (`isOwner === true`), replace the "Preview" header badge with a pressable "Edit" button that navigates directly to `editContent.tsx`.

---

### Item 26: Subscription & Paid Items Blur
* **Visual Screen Location**: Document block listings inside the Premium Preview screen.
* **Target File**: [preview.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/connect/preview.tsx)
* **Code Coordinates**: Lines 366–480 (`renderBlock`).
* **Planned Modification**: Wrap content elements inside a frosted `<BlurView>` overlay if the page section is Subscription/Paid and the viewer is a visitor who has not subscribed or purchased yet. Once they complete the checkout/subscription payment flow, remove the blur view to reveal the full content.

---

## 8. New Client Adjustments (Added May 27)

### Item 27: Map Pinpoint Marker & Details
* **Visual Screen Location**: Active map marker overlay card on the Map.
* **Target File**: [current-location.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/map/current-location.tsx)
* **Code Coordinates**: Line 699.
* **Planned Modification**: Pass the `label`, `activeTitle`, `activeSubtitle`, and `photo` parameters to the `<PremiumMapMarker>` component and change the icon to `'location'` so the card displays full destination info and the pinpoint marker is correctly rendered on the map.

---

### Item 28: Post Autosave Draft Race Condition
* **Visual Screen Location**: Draft Restore Prompt in the Post tab.
* **Target File**: [post.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/(tabs)/post.tsx)
* **Code Coordinates**: Lines 705–744 (`saveDraft` inside `useEffect`).
* **Planned Modification**: Add a `hasPostedRef = useRef(false)` block. In `clearDraft`, set it to `true` to block any subsequent debounced auto-saves from overwriting the deleted draft. Reset it to `false` in `resetFormState`.

---

### Item 29: Multiple Image Swipe Pinch-to-Zoom
* **Visual Screen Location**: Media player for posts with multiple swipeable photos in the feeds.
* **Target File**: [PostImage.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/post/PostImage.tsx)
* **Code Coordinates**: Lines 312–361 (`renderItem` of the horizontal image FlatList).
* **Planned Modification**: Keep track of a `scrollEnabled` state for the FlatList. Bind it to `pinchGesture` onUpdate and onEnd to disable scrolling while zooming (`scale.value > 1.05`), and wrap each image inside the FlatList in a `GestureDetector` using `composedGesture` and `ReAnimated.View` with `animatedImageStyle` to allow smooth zooming.

---

### Item 30: Connect Page Gradient Headers
* **Visual Screen Location**: Top header titles of Connect Hub and Page Details.
* **Target Files**: [index.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/connect/index.tsx) (Line 999), [[id].tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/app/connect/page/[id].tsx) (Line 783).
* **Planned Modification**: Wrap header titles in `<GradientText>` to display them in the brand blue-green gradient instead of plain text.

---

### Item 31: Segment Active Tab Underline Gradient
* **Visual Screen Location**: Segmented tabs control inside the Connect page.
* **Target File**: [PremiumSegmentedTabs.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/ui/PremiumSegmentedTabs.tsx)
* **Code Coordinates**: Line 76–78 (`underline` render).
* **Planned Modification**: Replace the solid green `<View style={styles.underline} />` with a horizontal `<LinearGradient>` displaying the brand blue-green colors.

---

### Item 32: Chat Search Conversations Gradient Border
* **Visual Screen Location**: Search Conversations input box in Chat/Inbox views.
* **Target File**: [CloudSearchDock.tsx](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/components/cloud/CloudSearchDock.tsx)
* **Code Coordinates**: Lines 43–90.
* **Planned Modification**: Wrap the `searchRow` view in a `<LinearGradient>` with 1.5px padding to serve as a gradient border wrapper.

---

### Item 33: High Resolution Image Upload Quality
* **Visual Screen Location**: Photo preparation function before upload.
* **Target File**: [mediaService.ts](file:///e:/RootedAI%20Client%20Project%20details/Taatom/TeamTaatom/frontend/services/mediaService.ts)
* **Code Coordinates**: Lines 44–74 (`prepareImageForUpload`).
* **Planned Modification**: Increase compression quality to 95% (`compressValue = 0.95`) and upscale the maximum downscaling width from 1200px to 2048px to retain high-fidelity pixel sharpness on standard network connections.
