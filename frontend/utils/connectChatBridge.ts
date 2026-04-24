/**
 * Simple module-level bridge to pass chatRoomId from Connect page to Chat screen.
 * Uses a JS variable instead of AsyncStorage to avoid async timing issues.
 */
let pendingChatRoomId: string | null = null;

export const setPendingChatRoomId = (id: string) => {
  pendingChatRoomId = id;
};

export const consumePendingChatRoomId = (): string | null => {
  const id = pendingChatRoomId;
  pendingChatRoomId = null;
  return id;
};
