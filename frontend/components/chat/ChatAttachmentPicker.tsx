import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { uploadChatMedia, ChatAttachment } from '../../services/chat';
import logger from '../../utils/logger';

interface ChatAttachmentPickerProps {
  visible: boolean;
  onClose: () => void;
  onAttachmentsReady: (attachments: ChatAttachment[]) => void;
  onSharePost?: () => void;
}

const ChatAttachmentPicker: React.FC<ChatAttachmentPickerProps> = ({
  visible,
  onClose,
  onAttachmentsReady,
  onSharePost,
}) => {
  const { theme } = useTheme();
  const [uploading, setUploading] = useState(false);

  const requestPermissions = async (type: 'camera' | 'gallery') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos/videos.');
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Gallery permission is required to pick media.');
        return false;
      }
    }
    return true;
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestPermissions('gallery');
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets.length > 0) {
        await handleUpload(result.assets);
      }
    } catch (error) {
      logger.error('Error picking from gallery:', error);
      Alert.alert('Error', 'Failed to pick media from gallery.');
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions('camera');
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets.length > 0) {
        await handleUpload(result.assets);
      }
    } catch (error) {
      logger.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture media.');
    }
  };

  const pickDocument = async () => {
    try {
      // Dynamic import to handle case where expo-document-picker might not be installed
      const DocumentPicker = await import('expo-document-picker').catch(() => null);
      if (!DocumentPicker) {
        Alert.alert('Not Available', 'Document picker is not available. Please install expo-document-picker.');
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
        ],
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const files = result.assets.map((asset: any) => ({
          uri: asset.uri,
          name: asset.name || 'document',
          type: asset.mimeType || 'application/octet-stream',
        }));
        await uploadFiles(files);
      }
    } catch (error) {
      logger.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document.');
    }
  };

  const handleUpload = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const files = assets.map((asset) => ({
      uri: asset.uri,
      name: asset.fileName || `media_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
      type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    }));

    await uploadFiles(files);
  };

  const uploadFiles = async (files: Array<{ uri: string; name: string; type: string }>) => {
    setUploading(true);
    onClose();

    try {
      const result = await uploadChatMedia(files);
      if (result?.attachments && result.attachments.length > 0) {
        onAttachmentsReady(result.attachments);
      }
    } catch (error: any) {
      logger.error('Error uploading chat media:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload files. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const options = [
    {
      icon: 'images-outline' as const,
      label: 'Gallery',
      onPress: pickFromGallery,
      color: '#4CAF50',
    },
    {
      icon: 'camera-outline' as const,
      label: 'Camera',
      onPress: takePhoto,
      color: '#2196F3',
    },
    {
      icon: 'document-outline' as const,
      label: 'File',
      onPress: pickDocument,
      color: '#FF9800',
    },
    ...(onSharePost
      ? [
          {
            icon: 'paper-plane-outline' as const,
            label: 'Post',
            onPress: () => {
              onClose();
              onSharePost();
            },
            color: '#9C27B0',
          },
        ]
      : []),
  ];

  if (uploading) {
    return (
      <View style={[styles.uploadingOverlay, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={[styles.uploadingText, { color: theme.colors.textSecondary }]}>
          Uploading...
        </Text>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.pickerContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.optionsRow}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.optionItem}
                onPress={option.onPress}
              >
                <View style={[styles.optionIcon, { backgroundColor: option.color + '20' }]}>
                  <Ionicons name={option.icon} size={24} color={option.color} />
                </View>
                <Text style={[styles.optionLabel, { color: theme.colors.text }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  optionItem: {
    alignItems: 'center',
    gap: 8,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  uploadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  uploadingText: {
    fontSize: 13,
  },
});

export default ChatAttachmentPicker;
