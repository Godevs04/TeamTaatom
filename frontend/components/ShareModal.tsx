import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Share,
  Linking,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import Constants from 'expo-constants';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  post?: {
    _id: string;
    caption?: string;
    imageUrl?: string;
    user?: {
      fullName: string;
    };
  };
  shareUrl?: string;
}

export default function ShareModal({
  visible,
  onClose,
  post,
  shareUrl,
}: ShareModalProps) {
  const { theme } = useTheme();

  // Generate share URL
  const getShareUrl = () => {
    if (shareUrl) return shareUrl;
    if (post?._id) {
      const baseUrl = Constants.expoConfig?.extra?.API_BASE_URL || 'https://taatom.app';
      return `${baseUrl}/post/${post._id}`;
    }
    return '';
  };

  // Generate share text
  const getShareText = () => {
    if (post?.caption) {
      return `${post.caption}\n\n${getShareUrl()}`;
    }
    return getShareUrl();
  };

  // Share to native share sheet
  const handleNativeShare = async () => {
    try {
      const result = await Share.share({
        message: getShareText(),
        url: post?.imageUrl || getShareUrl(),
        title: post?.caption || 'Check out this post on Taatom',
      });

      if (result.action === Share.sharedAction) {
        onClose();
      }
    } catch (error: any) {
      console.error('Error sharing:', error);
    }
  };

  // Share to Instagram
  const handleInstagramShare = async () => {
    try {
      const url = `instagram://library?AssetPath=${encodeURIComponent(post?.imageUrl || '')}`;
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback to web
        await Linking.openURL('https://www.instagram.com/');
      }
      onClose();
    } catch (error: any) {
      console.error('Error sharing to Instagram:', error);
    }
  };

  // Share to Facebook
  const handleFacebookShare = async () => {
    try {
      const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`;
      await Linking.openURL(url);
      onClose();
    } catch (error: any) {
      console.error('Error sharing to Facebook:', error);
    }
  };

  // Share to Twitter
  const handleTwitterShare = async () => {
    try {
      const text = post?.caption ? encodeURIComponent(post.caption.substring(0, 200)) : '';
      const url = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(getShareUrl())}`;
      await Linking.openURL(url);
      onClose();
    } catch (error: any) {
      console.error('Error sharing to Twitter:', error);
    }
  };

  // Copy link
  const handleCopyLink = async () => {
    try {
      const url = getShareUrl();
      
      if (Platform.OS === 'web') {
        // Web: Use navigator.clipboard API
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = url;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
      } else {
        // Mobile: Try to use expo-clipboard if available, otherwise use Share API
        try {
          // Try expo-clipboard first (if installed)
          const Clipboard = require('expo-clipboard').default;
          await Clipboard.setStringAsync(url);
        } catch (expoClipboardError) {
          // Fallback: Use Share API (will show share sheet)
          await Share.share({
            message: url,
            title: 'Copy Link',
          });
        }
      }
      onClose();
    } catch (error: any) {
      console.error('Error copying link:', error);
      // Fallback: show the URL in an alert so user can manually copy
      Alert.alert('Copy Link', `Link: ${getShareUrl()}`, [
        { text: 'OK', onPress: onClose }
      ]);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          
          <Text style={[styles.title, { color: theme.colors.text }]}>Share Post</Text>

          {/* Post Preview Card */}
          {post && (
            <View style={[styles.previewCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              {post.imageUrl && (
                <Image
                  source={{ uri: post.imageUrl }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.previewContent}>
                {post.user && (
                  <Text style={[styles.previewAuthor, { color: theme.colors.text }]}>
                    {post.user.fullName}
                  </Text>
                )}
                {post.caption && (
                  <Text
                    style={[styles.previewCaption, { color: theme.colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {post.caption}
                  </Text>
                )}
                <Text style={[styles.previewUrl, { color: theme.colors.primary }]} numberOfLines={1}>
                  {getShareUrl()}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.shareOptions}>
            {/* Native Share */}
            <TouchableOpacity
              style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
              onPress={handleNativeShare}
            >
              <Ionicons name="share-outline" size={32} color={theme.colors.primary} />
              <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                {Platform.OS === 'ios' ? 'Share' : 'Share'}
              </Text>
            </TouchableOpacity>

            {/* Instagram */}
            <TouchableOpacity
              style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
              onPress={handleInstagramShare}
            >
              <Ionicons name="logo-instagram" size={32} color="#E4405F" />
              <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                Instagram
              </Text>
            </TouchableOpacity>

            {/* Facebook */}
            <TouchableOpacity
              style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
              onPress={handleFacebookShare}
            >
              <Ionicons name="logo-facebook" size={32} color="#1877F2" />
              <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                Facebook
              </Text>
            </TouchableOpacity>

            {/* Twitter */}
            <TouchableOpacity
              style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
              onPress={handleTwitterShare}
            >
              <Ionicons name="logo-twitter" size={32} color="#1DA1F2" />
              <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                Twitter
              </Text>
            </TouchableOpacity>

            {/* Copy Link */}
            <TouchableOpacity
              style={[styles.shareOption, { backgroundColor: theme.colors.background }]}
              onPress={handleCopyLink}
            >
              <Ionicons name="link-outline" size={32} color={theme.colors.primary} />
              <Text style={[styles.shareOptionText, { color: theme.colors.text }]}>
                Copy Link
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.colors.background }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  shareOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  shareOption: {
    width: '30%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  shareOptionText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  previewImage: {
    width: 80,
    height: 80,
  },
  previewContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  previewAuthor: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewCaption: {
    fontSize: 12,
    marginBottom: 4,
  },
  previewUrl: {
    fontSize: 10,
  },
});

