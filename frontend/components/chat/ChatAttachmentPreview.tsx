import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { ChatAttachment } from '../../services/chat';

interface ChatAttachmentPreviewProps {
  attachments: ChatAttachment[];
  onRemove: (index: number) => void;
}

const ChatAttachmentPreview: React.FC<ChatAttachmentPreviewProps> = ({
  attachments,
  onRemove,
}) => {
  const { theme } = useTheme();

  if (!attachments || attachments.length === 0) return null;

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return 'document-outline';
    if (mimeType.includes('pdf')) return 'document-text-outline';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document-outline';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'grid-outline';
    return 'document-outline';
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {attachments.map((attachment, index) => (
          <View key={index} style={styles.previewItem}>
            {attachment.type === 'image' && attachment.url ? (
              <Image source={{ uri: attachment.url }} style={styles.imagePreview} />
            ) : attachment.type === 'video' ? (
              <View style={[styles.videoPreview, { backgroundColor: theme.colors.background }]}>
                <Ionicons name="videocam" size={24} color={theme.colors.textSecondary} />
              </View>
            ) : (
              <View style={[styles.filePreview, { backgroundColor: theme.colors.background }]}>
                <Ionicons
                  name={getFileIcon(attachment.mimeType) as any}
                  size={20}
                  color={theme.colors.textSecondary}
                />
                <Text
                  style={[styles.fileName, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {attachment.fileName || 'File'}
                </Text>
                {attachment.fileSize ? (
                  <Text style={[styles.fileSize, { color: theme.colors.textSecondary }]}>
                    {formatFileSize(attachment.fileSize)}
                  </Text>
                ) : null}
              </View>
            )}

            {/* Remove button */}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onRemove(index)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color="#FF5252" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  scrollContent: {
    gap: 8,
    alignItems: 'center',
  },
  previewItem: {
    position: 'relative',
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  videoPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filePreview: {
    width: 100,
    height: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  fileName: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  fileSize: {
    fontSize: 9,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
});

export default ChatAttachmentPreview;
