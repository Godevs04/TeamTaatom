import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { ChatAttachment } from '../../services/chat';

interface MessageAttachmentProps {
  attachment: ChatAttachment;
  isOwnMessage: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_IMAGE_WIDTH = SCREEN_WIDTH * 0.55;
const MAX_IMAGE_HEIGHT = 250;

const MessageAttachment: React.FC<MessageAttachmentProps> = ({ attachment, isOwnMessage }) => {
  const { theme } = useTheme();
  const router = useRouter();
  const [imageLoading, setImageLoading] = useState(true);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Image attachment
  if (attachment.type === 'image' && attachment.url) {
    return (
      <>
        <TouchableOpacity
          onPress={() => setLightboxVisible(true)}
          activeOpacity={0.9}
        >
          <View style={styles.imageContainer}>
            {imageLoading && (
              <View style={[styles.imagePlaceholder, { backgroundColor: theme.colors.surface }]}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
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

        {/* Image Lightbox */}
        <Modal visible={lightboxVisible} transparent animationType="fade">
          <TouchableOpacity
            style={styles.lightbox}
            activeOpacity={1}
            onPress={() => setLightboxVisible(false)}
          >
            <TouchableOpacity
              style={styles.lightboxClose}
              onPress={() => setLightboxVisible(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Image
              source={{ uri: attachment.url }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  // Video attachment
  if (attachment.type === 'video') {
    return (
      <TouchableOpacity
        style={[styles.videoContainer, { backgroundColor: theme.colors.surface }]}
        onPress={() => {
          if (attachment.url) {
            Linking.openURL(attachment.url);
          }
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
        {attachment.duration ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {Math.floor(attachment.duration / 60)}:{String(Math.floor(attachment.duration % 60)).padStart(2, '0')}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  // File attachment
  if (attachment.type === 'file') {
    const getFileIcon = () => {
      const mime = attachment.mimeType || '';
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
          if (attachment.url) {
            Linking.openURL(attachment.url);
          }
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

  // Post attachment (shared post)
  if (attachment.type === 'post' && attachment.postPreview) {
    const { postPreview } = attachment;

    return (
      <TouchableOpacity
        style={[styles.postContainer, { backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : theme.colors.surface, borderColor: theme.colors.border }]}
        onPress={() => {
          if (attachment.postId) {
            router.push(`/post/${attachment.postId}`);
          }
        }}
      >
        {postPreview.imageUrl ? (
          <Image source={{ uri: postPreview.imageUrl }} style={styles.postImage} />
        ) : null}
        <View style={styles.postInfo}>
          <View style={styles.postAuthor}>
            {postPreview.authorProfilePic ? (
              <Image source={{ uri: postPreview.authorProfilePic }} style={styles.postAuthorPic} />
            ) : (
              <View style={[styles.postAuthorPic, { backgroundColor: theme.colors.surface }]}>
                <Ionicons name="person" size={12} color={theme.colors.textSecondary} />
              </View>
            )}
            <Text
              style={[styles.postAuthorName, { color: isOwnMessage ? '#fff' : theme.colors.text }]}
              numberOfLines={1}
            >
              {postPreview.authorName}
            </Text>
          </View>
          {postPreview.caption ? (
            <Text
              style={[styles.postCaption, { color: isOwnMessage ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary }]}
              numberOfLines={2}
            >
              {postPreview.caption}
            </Text>
          ) : null}
        </View>
        <View style={styles.postBadge}>
          <Ionicons name="open-outline" size={14} color={theme.colors.primary} />
          <Text style={[styles.postBadgeText, { color: theme.colors.primary }]}>View Post</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  // Image styles
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
  lightbox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  lightboxImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  // Video styles
  videoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    width: MAX_IMAGE_WIDTH,
    height: 160,
    marginVertical: 2,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  // File styles
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
  // Post styles
  postContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    marginVertical: 2,
    width: MAX_IMAGE_WIDTH,
  },
  postImage: {
    width: '100%',
    height: 120,
  },
  postInfo: {
    padding: 10,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  postAuthorPic: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  postAuthorName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  postCaption: {
    fontSize: 12,
    lineHeight: 16,
  },
  postBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  postBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default MessageAttachment;
