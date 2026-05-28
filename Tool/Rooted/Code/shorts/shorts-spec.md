# Shorts Menu - Product & Technical Specification

## 1. Overview

The Shorts menu provides a TikTok-style vertical video feed where users watch short-form videos with vertical scrolling, autoplay, and swipe gestures. 

To ensure optimal system performance, prevent hardware decoder stutters, and avoid out-of-memory (OOM) crashes on low-end mobile devices, the system uses a decoupled, virtualized architecture for rendering and a cursor-based pagination pipeline for backend query delivery.

---

## 2. Layer 1: UI/Memory Neutralization (React Native/Expo)

### 2.1 Virtualization (`FlashList` Integration)

The vertical video feed is migrated from a standard `FlatList` to `@shopify/flash-list`'s `FlashList` to utilize aggressive layout recycling and cell virtualization.

- **虚拟化参数 (Virtualization Parameters)**:
  - `windowSize={3}`: Restricts the viewport window to prevent heavy memory footprints.
  - `maxToRenderPerBatch={2}`: Minimizes batch render size.
  - `estimatedItemSize`: Set dynamically to the calculated height of a single short card (`dynamicItemHeight`).
  - `overrideItemLayout`: Enforces fixed layout measurements per cell to optimize RecycleListView's internal measurements:
    ```typescript
    const overrideItemLayout = useCallback((layout: { size?: number; offset?: number }, item: ShortsItem, index: number) => {
      layout.size = dynamicItemHeight;
      layout.offset = dynamicItemHeight * index;
    }, [dynamicItemHeight]);
    ```

- **Dependency Status**:
  - `@shopify/flash-list` is installed in `package.json`. No external dependency changes are required.

### 2.2 State Architecture (Recoil Decoupling)

To eliminate the performance costs of prop drilling (where a parent state change causes all visible cells to re-render), the screen uses a local Recoil state tree. `ShortsScreen` must NOT pass `isPlaying` or `buffering` as props down to `ShortsCell` or `ShortsVideo`.

- **Atoms & Families**:
  - `activeShortIndexAtom`: Stores the active visible short's index.
    ```typescript
    export const activeShortIndexAtom = atom<number>({
      key: 'activeShortIndexAtom',
      default: 0,
    });
    ```
  - `videoPlayingFamily`: Tracks individual playback state per short ID.
    ```typescript
    export const videoPlayingFamily = atomFamily<boolean, string>({
      key: 'videoPlayingFamily',
      default: false,
    });
    ```
  - `videoReadyFamily`: Tracks frame-decoded status per short ID.
    ```typescript
    export const videoReadyFamily = atomFamily<boolean, string>({
      key: 'videoReadyFamily',
      default: false,
    });
    ```
  - `videoBufferingFamily`: Tracks buffering status per short ID.
    ```typescript
    export const videoBufferingFamily = atomFamily<boolean, string>({
      key: 'videoBufferingFamily',
      default: false,
    });
    ```

- **Subscriber Isolation**:
  - Cells and videos subscribe *only* to their respective `atomFamily` keys. When cell A starts or stops playing, only cell A re-renders.

### 2.3 Hardware Decoder Lifecycle

Mobile GPUs are constrained by the number of hardware decoder slots. If too many native video streams remain loaded, the device runs out of decoders, causing micro-stutters or heap crashes.

- **Resource Disposal threshold**:
  - Active index, previous, and next indices (distance <= 1) are preloaded/mounted for seamless transition.
  - Any video component beyond a distance of 2 from the active index must be aggressively unloaded from the native player using `unloadAsync()`:
    ```typescript
    useEffect(() => {
      if (Math.abs(index - activeIndex) > 2) {
        videoRef.current?.unloadAsync().catch(() => {});
      }
    }, [index, activeIndex]);
    ```

---

## 3. Layer 2: Data Delivery & Backend Algorithms

### 3.1 Cursor-Based Pagination

Traditional `skip`/`limit` pagination is deprecated because it is prone to duplicate items or missing slots when new posts are uploaded during active feed reading. Instead, a compound cursor-based pagination model is used.

- **Query Format**:
  - Cursors are generated as a base64-encoded string of the compound string `${createdAt.getTime()},${_id}`.
  - The query uses an `$or` condition to handle equal timestamps (preventing dropped records when multiple shorts are created at the same millisecond):
    ```javascript
    const matchQuery = {
      $or: [
        { createdAt: { $lt: cursorDate } },
        { createdAt: cursorDate, _id: { $lt: cursorId } }
      ]
    };
    ```
  - Aggregation sorts on `{ createdAt: -1, _id: -1 }` and limits to `pageSize + 1` to compute pagination status.
  - A compound database index `createdAt: -1, _id: -1` is defined on the `Post` schema to ensure this query is fully index-covered.

### 3.2 HLS Video Pipeline & Task Worker

- **MongoDB-Backed Task Worker**:
  - Uploading shorts returns a `202 Accepted` status immediately.
  - Offloads heavy re-encoding and HLS segmenting to an asynchronous background worker polling `TranscodeJob` documents from MongoDB.
  - ffmpeg is invoked within the worker to segment the video into 2-second chunks (`-hls_time 2`).
  - Auto-extracts thumbnails at 1.0s using screenshots if no custom thumbnail is uploaded.
- **Express-based HLS Streaming Proxy**:
  - Solves pre-signed URL segment access issues for private S3 storage.
  - The client requests `/api/v1/shorts?hls=master&postId={postId}`. Express downloads the `.m3u8` playlist, rewrites segment filenames to fully-qualified proxy URLs pointing to `?hls=segment&postId={postId}&file=segment_xxx.ts`, and serves it to the client.
  - The segment requests privately download `.ts` chunks from S3 and stream them to the player.

---

## 4. Screen & Navigation Map (Frontend)

- **Entry Point**: Bottom tab navigation (`/(tabs)/shorts`) or nested profile lists (`/user-shorts/[userId]`).
- **Initial Snapping**: If opened with `shortId` query parameter, scrolls to that item and starts playing.

---

## 5. UI Preservation & Performance Guardrails

- **Maximum Concurrent Mounted Decoders**: <= 3
- **Memory Growth (after 50 videos)**: < 20%
- **Feed API Response Time (p95)**: < 150ms
- **JS Thread Frame Time**: < 8ms
- **Scroll Frame Rate**: >= 60 FPS
