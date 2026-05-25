export interface Attachment {
  type: 'image' | 'video' | 'file' | 'post' | 'short';
  url?: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  width?: number;
  height?: number;
  storageKey?: string;
  postId?: string;
  postPreview?: {
    caption: string;
    imageUrl: string;
    authorName: string;
    authorProfilePic: string;
  };
  metadata?: {
    originalAuthorDp?: string;
    originalAuthorUsername?: string;
    thumbnailUrl?: string;
    contentId?: string;
  };
}

export interface Message {
  _id: string;
  sender: string;
  text: string;
  attachments?: Attachment[];
  timestamp: string;
  seen: boolean;
  seenBy?: string[];
  senderName?: string;
  senderProfilePic?: string;
}
