import AsyncStorage from '@react-native-async-storage/async-storage';

type PendingLikeMap = Record<string, boolean>;

const safeParseJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export async function setLocalLikedId(
  likedIdsStorageKey: string,
  postId: string,
  isLiked: boolean
): Promise<void> {
  const raw = await AsyncStorage.getItem(likedIdsStorageKey);
  const ids = safeParseJson<unknown>(raw, []);
  const set = new Set(Array.isArray(ids) ? (ids as string[]) : []);
  if (isLiked) set.add(postId);
  else set.delete(postId);
  await AsyncStorage.setItem(likedIdsStorageKey, JSON.stringify([...set]));
}

export async function enqueuePendingLike(
  pendingStorageKey: string,
  postId: string,
  desiredIsLiked: boolean
): Promise<void> {
  const raw = await AsyncStorage.getItem(pendingStorageKey);
  const map = safeParseJson<PendingLikeMap>(raw, {});
  map[postId] = desiredIsLiked;
  await AsyncStorage.setItem(pendingStorageKey, JSON.stringify(map));
}

export async function clearPendingLike(pendingStorageKey: string, postId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(pendingStorageKey);
  const map = safeParseJson<PendingLikeMap>(raw, {});
  if (!(postId in map)) return;
  delete map[postId];
  await AsyncStorage.setItem(pendingStorageKey, JSON.stringify(map));
}

export async function flushPendingLikes(args: {
  pendingStorageKey: string;
  likedIdsStorageKey: string;
  getPostById: (postId: string) => Promise<any>;
  toggleLike: (postId: string) => Promise<{ isLiked: boolean; likesCount: number }>;
}): Promise<void> {
  const { pendingStorageKey, likedIdsStorageKey, getPostById, toggleLike } = args;
  const raw = await AsyncStorage.getItem(pendingStorageKey);
  const map = safeParseJson<PendingLikeMap>(raw, {});
  const entries = Object.entries(map);
  if (entries.length === 0) return;

  for (const [postId, desiredIsLiked] of entries) {
    try {
      const data = await getPostById(postId);
      const currentIsLiked = Boolean(data?.post?.isLiked ?? data?.isLiked);
      if (currentIsLiked !== desiredIsLiked) {
        const res = await toggleLike(postId);
        await setLocalLikedId(likedIdsStorageKey, postId, res.isLiked);
      } else {
        await setLocalLikedId(likedIdsStorageKey, postId, desiredIsLiked);
      }
      await clearPendingLike(pendingStorageKey, postId);
    } catch {
      // keep pending item for next attempt (offline / server error)
    }
  }
}

