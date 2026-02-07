# Music Trim UI – UX & Interaction Review

## Context
We have a mobile music selection screen (`frontend/components/SongSelector.tsx`) where users can trim a portion of an audio track using draggable handles on a waveform. While functional, users find it difficult to precisely select a segment.

This feature is intended for short-form content creation (reels / shorts), similar to Instagram Reels or CapCut.

## Current Implementation Analysis

### What Exists Today
- **Waveform Visualization**: Simple bar-based waveform (3px bars, 50 bars total)
- **Draggable Handles**: 64x64px circular handles with gradient styling
- **Timeline Track**: 12px height track with selected region highlighting
- **PanResponder Gestures**: Custom drag handlers for start/end handles and selection region
- **Haptic Feedback**: Light/medium haptics on drag start/release
- **Time Labels**: Start time, duration, and end time displayed below handles
- **Real-time Audio Seeking**: Audio position updates while dragging handles
- **Minimum Duration**: 0.5s gap enforced between start and end
- **Hit Slop**: 40px extended touch area around handles

### Technical Details
- **Handle Size**: 64x64px (32px radius)
- **Timeline Height**: 12px
- **Waveform Height**: 50px
- **Padding**: 28px horizontal padding on timeline wrapper
- **Position Calculation**: Uses `locationX` with fallback to `pageX` calculations
- **Snapping**: `snapToPrecision()` function rounds to 0.1s increments
- **Drag Delta**: `MIN_DRAG_DELTA` threshold to prevent micro-movements

## Current Issues (Observed Problems)

### 1. Visual Clarity
- **Waveform doesn't clearly show selected vs unselected region**
  - Selected portion uses `timelineSelection` style but waveform bars don't visually differentiate
  - Unselected portions look identical to selected portions
  - No visual distinction between "active" and "inactive" waveform areas

- **Trim handles feel disconnected from waveform**
  - Handles are positioned above the timeline track, not integrated with waveform
  - Visual hierarchy unclear: waveform → timeline → handles (three separate layers)
  - No clear visual connection between handle position and waveform position

### 2. Precision & Feedback
- **No live timestamp feedback while dragging**
  - Time labels are static below handles, don't update during drag
  - User can't see exact timestamp at cursor position
  - No duration preview while dragging

- **No snap indicators or haptic feedback at boundaries**
  - Handles don't provide haptic feedback when hitting min/max limits
  - No visual snap indicators (e.g., beat markers, grid lines)
  - No feedback when reaching minimum 0.5s duration limit

- **Position calculation complexity**
  - Uses `locationX` with fallback to `pageX` calculations
  - Potential precision issues on different screen sizes
  - `timelinePaddingRef` calculations may cause offset errors

### 3. Interaction Design
- **Trim handles may be too large for precise control**
  - 64x64px handles with 40px hit slop = 144px total touch area
  - Large touch area can make fine adjustments difficult
  - No distinction between "grab" area and "fine-adjust" area

- **No zoom or fine-tuning mechanism**
  - Entire waveform always visible at same scale
  - Cannot zoom in for precise trimming
  - Long songs (>60s) compressed into same width as short songs

- **Gesture conflicts on small screens**
  - PanResponder may conflict with scroll gestures
  - No clear gesture priority (drag vs scroll)
  - Hit slop extends beyond visible handle area

### 4. UX Flow Issues
- **No visual feedback for invalid selections**
  - Minimum duration (0.5s) enforced silently
  - No error message or visual indicator when limit reached
  - No maximum duration warning (60s limit)

- **Playhead disconnected from trim handles**
  - Playhead (progress indicator) separate from trim handles
  - No clear relationship between playback position and selection
  - Playhead can move outside selected region

- **Audio preview behavior unclear**
  - Audio seeks while dragging (real-time preview)
  - May be disorienting for users expecting silent drag
  - No option to disable real-time audio feedback

### 5. Creator-Friendly Features Missing
- **No beat snapping**
  - Cannot snap to musical beats
  - No visual beat markers on waveform
  - Manual precision required for musical timing

- **No waveform detail levels**
  - Single waveform representation
  - Cannot see fine detail for precise trimming
  - No multi-resolution waveform (overview + detail)

- **Help text is minimal**
  - "Drag the handles to select your favorite part" is generic
  - No hints about precision controls
  - No indication of available features

## Goals
- Make trimming intuitive for non-technical users
- Improve precision without adding complexity
- Match UX expectations of Instagram Reels / CapCut-like apps
- Keep implementation practical for a real production app
- Maintain performance on mobile devices

## Cursor-Ready Questions

### 🎯 Core UX Question
The current music selection UI allows trimming audio via draggable handles on a waveform, but users find it hard to precisely select a segment. The handles are 64x64px with 40px hit slop, positioned above a 12px timeline track, with a 50px waveform below. Time labels are static below handles.

**How can we redesign the trimming interaction to be more intuitive, precise, and creator-friendly, similar to Instagram Reels or CapCut?**

### 🎯 Interaction & Gesture Design
Currently, trim handles use PanResponder with `locationX`/`pageX` calculations, 40px hit slop, and real-time audio seeking during drag. The waveform doesn't visually distinguish selected vs unselected regions.

**How should the trim handles, playhead, and waveform be aligned so users clearly understand:**
- what part is selected
- where playback starts
- how long the selected segment is

**Suggest exact UI patterns (handle size, spacing, hit area, snap behavior) that work for mobile touch interfaces.**

### 🎯 Visual Feedback
The current implementation has static time labels below handles and real-time audio seeking while dragging. There's no visual feedback during drag (no timestamp above handle, no duration preview).

**What visual cues should be added while dragging trim handles?**
- live timestamp above handles?
- shaded inactive waveform?
- animated playhead?
- duration badge that follows the handle?

**Provide concrete UI recommendations with specific measurements (e.g., "48px timestamp badge, 16px font size, positioned 8px above handle").**

### 🎯 Precision Trimming
The current implementation has no zoom functionality. All songs are displayed at the same scale regardless of duration. Long songs (>60s) are compressed into the same width as short songs.

**How can we support both coarse and fine trimming on mobile?**
- zoomed waveform view?
- long-press to magnify?
- secondary fine-adjust slider?
- pinch-to-zoom gesture?

**Recommend a production-proven approach that doesn't add significant complexity to the codebase.**

### 🎯 Mobile UX Constraints
The current implementation uses PanResponder with 40px hit slop. On small screens, drag gestures may conflict with scrolling the song list.

**How should the gesture system be designed so trimming feels stable and intentional on both iOS and Android?**
- Should we disable scrolling when touching the timeline area?
- How do we prevent accidental drags when user intends to scroll?
- What's the optimal hit slop size for mobile?

### 🎯 Real-time Feedback Logic
Currently, audio seeks in real-time while dragging handles (`soundRef.current.setPositionAsync(newStart * 1000)`). This happens on every drag movement.

**While dragging trim handles, how should audio preview behave?**
- silent drag (no audio) until release?
- short audio preview on release?
- scrub-to-preview (audio plays at handle position)?
- configurable option?

**Suggest what works best for real creator apps (Instagram Reels, TikTok, CapCut) and explain the trade-offs.**

### 🎯 Waveform Visual Design
The current waveform uses 3px bars with 1px spacing, 50 bars total, displayed at 50px height. Selected vs unselected regions are not visually distinct in the waveform itself.

**How should the waveform visually communicate:**
- selected region (between handles)
- unselected regions (before start, after end)
- playback position (playhead)
- handle positions

**Provide specific color/opacity/styling recommendations that work with both light and dark themes.**

### 🎯 Accessibility & Error Prevention
The current implementation enforces a minimum 0.5s gap and maximum 60s duration, but provides no visual feedback when limits are reached.

**How can we prevent invalid selections (too short / too long)?**
- Should the UI enforce minimum duration with visual feedback?
- Should we add snapping to beats or time intervals?
- Should haptic feedback indicate when limits are reached?
- What visual indicators show when a selection is invalid?

### 🎯 Position Calculation & Precision
The current implementation uses `locationX` with fallback to `pageX`, includes `timelinePaddingRef` calculations, and has a `MIN_DRAG_DELTA` threshold.

**How can we improve position calculation accuracy?**
- Is `locationX` vs `pageX` the right approach?
- How do we handle different screen sizes and pixel densities?
- Should we use a different coordinate system?
- How do we ensure consistent precision across devices?

### 🎯 Implementation Reality Check
The current codebase uses React Native, PanResponder, Animated API, and Expo Audio. The component is already ~1500 lines.

**Based on real production apps, what is the simplest UX improvement that gives the biggest usability win without rebuilding the entire waveform component?**

**Prioritize:**
1. Quick wins (can implement in <2 hours)
2. Medium effort (can implement in <1 day)
3. Larger improvements (require more refactoring)

## Constraints
- **Mobile first**: iOS & Android support required
- **Small screen support**: Must work on iPhone SE (smallest common screen)
- **Performance sensitive**: Must maintain 60fps during drag interactions
- **Existing codebase**: Component is already complex (~1500 lines), prefer incremental improvements
- **Theme support**: Must work with light/dark themes
- **Accessibility**: Should support screen readers and assistive technologies

## Reference Implementations
- **Instagram Reels**: Large handles, clear selected region, beat snapping
- **TikTok**: Waveform zoom, precise trimming, visual feedback
- **CapCut**: Multi-resolution waveform, fine-tuning controls, creator-friendly UX
- **YouTube Shorts**: Simple timeline, clear selection, intuitive controls

## Technical Notes
- Current handle size: 64x64px (may be too large for precision)
- Current hit slop: 40px (may cause gesture conflicts)
- Current timeline height: 12px (may be too small for easy dragging)
- Current waveform height: 50px (may need more detail)
- Current padding: 28px horizontal (may need adjustment for edge cases)
- Current snapping: 0.1s increments (may need finer control)
- Current audio feedback: Real-time seeking (may be disorienting)

## Next Steps
1. Review this document with UX/design team
2. Prioritize improvements based on user feedback
3. Implement quick wins first (visual feedback, better labels)
4. Test on real devices (especially small screens)
5. Gather user feedback on improvements
6. Iterate based on findings
