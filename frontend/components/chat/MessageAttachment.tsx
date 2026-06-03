import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Pressable,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { Attachment } from '../../types/chat';
import { CHAT_MEDIA_MAX_WIDTH } from '../cloud/cloudChatBubbleStyles';
import ChatMediaViewer from './ChatMediaViewer';
import { getPostById } from '../../services/posts';

interface MessageAttachmentProps {
  attachment: Attachment;
  isOwnMessage: boolean;
}

const MAX_IMAGE_WIDTH = CHAT_MEDIA_MAX_WIDTH;
const MAX_IMAGE_HEIGHT = 200;

const MessageAttachment: React.FC<MessageAttachmentProps> = ({ attachment, isOwnMessage }) => {
  const { theme } = useTheme();
  const router = useRouter();
  const [imageLoading, setImageLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'image' | 'video'>('image');
  const [viewerUri, setViewerUri] = useState('');
  const [postDetails, setPostDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const contentId = attachment.metadata?.contentId || attachment.postId || '';

  useEffect(() => {
    if ((attachment.type === 'post' || attachment.type === 'short') && contentId) {
      let isMounted = true;
      const fetchDetails = async () => {
        try {
          setLoadingDetails(true);
          const response = await getPostById(contentId);
          if (isMounted && response?.success && response?.post) {
            setPostDetails(response.post);
          }
        } catch (err) {
          console.log('Error fetching post/short details in chat bubble:', err);
        } finally {
          if (isMounted) setLoadingDetails(false);
        }
      };
      fetchDetails();
      return () => {
        isMounted = false;
      };
    }
  }, [attachment.type, contentId]);

  const resolveUrl = (url?: string | null): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    try {
      const { getApiUrl } = require('../../utils/config');
      return getApiUrl(url);
    } catch {
      return url;
    }
  };

  const openViewer = (type: 'image' | 'video', uri: string) => {
    setViewerType(type);
    setViewerUri(uri);
    setViewerVisible(true);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (attachment.type === 'image' && attachment.url) {
    return (
      <>
        <TouchableOpacity onPress={() => openViewer('image', attachment.url!)} activeOpacity={0.9}>
          <View style={styles.imageContainer}>
            {imageLoading && (
              <View style={[styles.imagePlaceholder, { backgroundColor: theme.colors.surface }]}>
                <LoadingGlobe size="small" color={theme.colors.primary} />
              </View>
            )}
            <Image
              source={{ uri: attachment.url }}
              style={[
                styles.image,
                {
                  width: Math.min(attachment.width || MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH),
                  height: Math.min(attachment.height || MAX_IMAGE_HEIGHT, MAX_IMAGE_HEIGHT),
                },
              ]}
              resizeMode="cover"
              onLoadEnd={() => setImageLoading(false)}
            />
          </View>
        </TouchableOpacity>
        <ChatMediaViewer
          visible={viewerVisible && viewerType === 'image'}
          type="image"
          uri={viewerUri}
          onClose={() => setViewerVisible(false)}
        />
      </>
    );
  }

  if (attachment.type === 'video') {
    return (
      <>
        <TouchableOpacity
          style={styles.videoContainer}
          onPress={() => {
            if (attachment.url) openViewer('video', attachment.url);
          }}
        >
          {attachment.thumbnailUrl ? (
            <Image source={{ uri: attachment.thumbnailUrl }} style={styles.videoThumbnail} />
          ) : (
            <View style={[styles.videoThumbnail, { backgroundColor: '#000' }]} />
          )}
          <View style={styles.playButtonOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={24} color="#fff" />
            </View>
          </View>
          {attachment.duration != null && attachment.duration > 0 ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {Math.floor(attachment.duration / 60)}:{String(Math.floor(attachment.duration % 60)).padStart(2, '0')}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
        {attachment.url ? (
          <ChatMediaViewer
            visible={viewerVisible && viewerType === 'video'}
            type="video"
            uri={viewerUri}
            onClose={() => setViewerVisible(false)}
          />
        ) : null}
      </>
    );
  }

  if (attachment.type === 'file') {
    const mime = attachment.mimeType || '';
    // Video files shared as generic "file" attachments should play in-app (Android)
    if (attachment.url && mime.startsWith('video/')) {
      return (
        <>
          <TouchableOpacity
            style={styles.videoContainer}
            onPress={() => openViewer('video', attachment.url!)}
          >
            <View style={[styles.videoThumbnail, { backgroundColor: '#000' }]} />
            <View style={styles.playButtonOverlay}>
              <View style={styles.playButton}>
                <Ionicons name="play" size={24} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
          <ChatMediaViewer
            visible={viewerVisible && viewerType === 'video'}
            type="video"
            uri={viewerUri}
            onClose={() => setViewerVisible(false)}
          />
        </>
      );
    }

    const getFileIcon = () => {
      if (mime.includes('pdf')) return 'document-text';
      if (mime.includes('word') || mime.includes('document')) return 'document';
      if (mime.includes('excel') || mime.includes('spreadsheet')) return 'grid';
      if (mime.includes('text')) return 'document-text-outline';
      return 'document-outline';
    };

    return (
      <TouchableOpacity
        style={[styles.fileContainer, { backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.15)' : theme.colors.surface }]}
        onPress={() => {
          if (attachment.url) Linking.openURL(attachment.url);
        }}
      >
        <View style={[styles.fileIcon, { backgroundColor: theme.colors.primary + '20' }]}>
          <Ionicons name={getFileIcon() as any} size={22} color={theme.colors.primary} />
        </View>
        <View style={styles.fileInfo}>
          <Text
            style={[styles.fileName, { color: isOwnMessage ? '#fff' : theme.colors.text }]}
            numberOfLines={1}
          >
            {attachment.fileName || 'File'}
          </Text>
          {attachment.fileSize ? (
            <Text style={[styles.fileSize, { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary }]}>
              {formatFileSize(attachment.fileSize)}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name="download-outline"
          size={20}
          color={isOwnMessage ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary}
        />
      </TouchableOpacity>
    );
  }

  if (attachment.type === 'post' || attachment.type === 'short') {
    const isShort =
      attachment.type === 'short' ||
      postDetails?.type === 'short' ||
      (postDetails?.videoUrl && !postDetails?.imageUrl) ||
      (postDetails?.mediaUrl && postDetails?.type === 'short');

    const resolvedAuthorDp = resolveUrl(
      postDetails?.user?.profilePic ||
      attachment.metadata?.originalAuthorDp ||
      attachment.postPreview?.authorProfilePic
    );
    const resolvedAuthorUsername =
      postDetails?.user?.username ||
      postDetails?.user?.fullName ||
      attachment.metadata?.originalAuthorUsername ||
      attachment.postPreview?.authorName ||
      'user';
    const resolvedCaption =
      postDetails?.caption ||
      attachment.postPreview?.caption ||
      '';
    const resolvedImageUrl = resolveUrl(
      postDetails?.imageUrl ||
      postDetails?.images?.[0] ||
      attachment.metadata?.thumbnailUrl ||
      attachment.postPreview?.imageUrl ||
      attachment.url
    );
    const resolvedThumbnailUrl = resolveUrl(
      postDetails?.imageUrl ||
      postDetails?.images?.[0] ||
      postDetails?.thumbnailUrl ||
      attachment.metadata?.thumbnailUrl ||
      attachment.thumbnailUrl ||
      attachment.url
    );

    const authorId = postDetails?.user?._id || contentId;

    if (isShort) {
      // Render Shared Short: aspect ratio 9:16 vertical card with Play overlay
      return (
        <Pressable
          style={({ pressed }) => [
            styles.shortCardContainer,
            {
              backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.08)' : theme.colors.surface,
              borderColor: isOwnMessage ? 'rgba(255,255,255,0.15)' : theme.colors.border,
              opacity: pressed ? 0.9 : 1,
            }
          ]}
          onPress={() => {
            if (authorId && contentId) {
              router.push(`/user-shorts/${authorId}?shortId=${contentId}`);
            }
          }}
        >
          {resolvedThumbnailUrl ? (
            <Image source={{ uri: resolvedThumbnailUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }]}>
              {loadingDetails ? (
                <LoadingGlobe size="small" color="#fff" />
              ) : (
                <Ionicons name="film-outline" size={40} color="rgba(255,255,255,0.4)" />
              )}
            </View>
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']}
            style={StyleSheet.absoluteFillObject}
          />

          <View style={styles.shortCardHeader}>
            {resolvedAuthorDp ? (
              <Image source={{ uri: resolvedAuthorDp }} style={styles.richCardAvatar} />
            ) : (
              <View style={[styles.richCardAvatar, { backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={10} color="#fff" />
              </View>
            )}
            <Text style={styles.shortCardUsername} numberOfLines={1}>
              {resolvedAuthorUsername}
            </Text>
          </View>

          <View style={styles.shortCardPlayWrapper}>
            <View style={styles.shortCardPlayButton}>
              <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} />
            </View>
          </View>
        </Pressable>
      );
    } else {
      // Render Shared Post: aspect ratio 1:1 square card
      return (
        <Pressable
          style={({ pressed }) => [
            styles.richCardContainer,
            {
              backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.08)' : theme.colors.surface,
              borderColor: isOwnMessage ? 'rgba(255,255,255,0.15)' : theme.colors.border,
              opacity: pressed ? 0.9 : 1,
            }
          ]}
          onPress={() => {
            if (authorId && contentId) {
              router.push({
                pathname: `/user-posts/${authorId}`,
                params: {
                  postId: contentId,
                  postData: postDetails ? JSON.stringify(postDetails) : undefined,
                },
              });
            }
          }}
        >
          {/* Top of Card: Tiny Avatar + Username */}
          <View style={styles.richCardHeader}>
            {resolvedAuthorDp ? (
              <Image source={{ uri: resolvedAuthorDp }} style={styles.richCardAvatar} />
            ) : (
              <View style={[styles.richCardAvatar, { backgroundColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={10} color={theme.colors.textSecondary} />
              </View>
            )}
            <Text style={[styles.richCardUsername, { color: isOwnMessage ? '#fff' : theme.colors.text }]} numberOfLines={1}>
              {resolvedAuthorUsername}
            </Text>
          </View>

          {/* Middle of Card: Image (1:1 aspect ratio) */}
          {resolvedImageUrl ? (
            <View style={styles.richCardImageWrapper}>
              <Image source={{ uri: resolvedImageUrl }} style={styles.richCardImage} resizeMode="cover" />
            </View>
          ) : (
            <View style={[styles.richCardImageWrapper, { backgroundColor: theme.colors.border + '15', alignItems: 'center', justifyContent: 'center' }]}>
              {loadingDetails ? (
                <LoadingGlobe size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="image-outline" size={40} color={theme.colors.textSecondary} />
              )}
            </View>
          )}

          {/* Bottom of Card: Truncated Caption */}
          {resolvedCaption ? (
            <View style={styles.richCardFooter}>
              <Text style={[styles.richCardCaption, { color: isOwnMessage ? 'rgba(255,255,255,0.9)' : theme.colors.text }]} numberOfLines={2}>
                <Text style={styles.richCardCaptionUsername}>{resolvedAuthorUsername} </Text>
                {resolvedCaption}
              </Text>
            </View>
          ) : null}
        </Pressable>
      );
    }
  }

  return null;
};

const styles = StyleSheet.create({
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 2,
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  image: {
    borderRadius: 12,
    minWidth: 150,
    minHeight: 100,
  },
  videoContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    width: MAX_IMAGE_WIDTH,
    height: 140,
    marginVertical: 2,
    backgroundColor: '#1A2B3C',
    alignSelf: 'flex-start',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
    marginVertical: 2,
    minWidth: 180,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 11,
    marginTop: 2,
  },
  richCardContainer: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    width: CHAT_MEDIA_MAX_WIDTH,
    marginVertical: 4,
  },
  richCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },
  richCardAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  richCardUsername: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  richCardImageWrapper: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
  },
  richCardImage: {
    width: '100%',
    height: '100%',
  },
  richCardFooter: {
    padding: 8,
  },
  richCardCaptionUsername: {
    fontWeight: '700',
  },
  richCardCaption: {
    fontSize: 12,
    lineHeight: 16,
  },
  shortCardContainer: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    width: CHAT_MEDIA_MAX_WIDTH,
    aspectRatio: 9 / 16,
    marginVertical: 4,
    position: 'relative',
    justifyContent: 'space-between',
  },
  shortCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
    zIndex: 2,
  },
  shortCardUsername: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  shortCardPlayWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  shortCardPlayButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default MessageAttachment;
