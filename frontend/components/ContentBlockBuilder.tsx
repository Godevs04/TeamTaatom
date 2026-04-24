import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { theme as themeConstants } from '../constants/theme';
import { ContentBlock } from '../services/connect';
import logger from '../utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

interface ContentBlockBuilderProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  maxBlocks?: number;
}

export default function ContentBlockBuilder({
  blocks,
  onChange,
  maxBlocks = 20,
}: ContentBlockBuilderProps) {
  const { theme } = useTheme();
  const [editingTextIndex, setEditingTextIndex] = useState<number | null>(null);

  const addBlock = (type: ContentBlock['type']) => {
    if (blocks.length >= maxBlocks) {
      Alert.alert('Limit Reached', `You can add up to ${maxBlocks} content blocks.`);
      return;
    }

    if (type === 'heading' || type === 'text') {
      const newBlock: ContentBlock = {
        type,
        content: '',
        order: blocks.length,
      };
      onChange([...blocks, newBlock]);
      setEditingTextIndex(blocks.length);
    } else if (type === 'image') {
      pickImage();
    } else if (type === 'video') {
      pickVideo();
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need photo library access to add images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newBlock: ContentBlock = {
          type: 'image',
          content: result.assets[0].uri,
          order: blocks.length,
        };
        onChange([...blocks, newBlock]);
      }
    } catch (error) {
      logger.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need photo library access to add videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.7,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        const newBlock: ContentBlock = {
          type: 'video',
          content: result.assets[0].uri,
          order: blocks.length,
        };
        onChange([...blocks, newBlock]);
      }
    } catch (error) {
      logger.error('Video picker error:', error);
      Alert.alert('Error', 'Failed to select video.');
    }
  };

  const removeBlock = (index: number) => {
    Alert.alert('Remove Block', 'Are you sure you want to remove this block?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const updated = blocks
            .filter((_, i) => i !== index)
            .map((b, i) => ({ ...b, order: i }));
          onChange(updated);
          if (editingTextIndex === index) setEditingTextIndex(null);
        },
      },
    ]);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const updated = [...blocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    // Recalculate order
    onChange(updated.map((b, i) => ({ ...b, order: i })));
  };

  const updateTextContent = (index: number, text: string) => {
    const updated = blocks.map((b, i) => (i === index ? { ...b, content: text } : b));
    onChange(updated);
  };

  const renderBlock = (block: ContentBlock, index: number) => {
    return (
      <View
        key={block._id || `block-${index}`}
        style={[styles.blockContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      >
        {/* Block Controls */}
        <View style={styles.blockControls}>
          <View style={styles.blockTypeLabel}>
            <Ionicons
              name={
                block.type === 'heading'
                  ? 'text-outline'
                  : block.type === 'text'
                  ? 'document-text-outline'
                  : block.type === 'image'
                  ? 'image-outline'
                  : 'videocam-outline'
              }
              size={16}
              color={theme.colors.textSecondary}
            />
            <Text style={[styles.blockTypeText, { color: theme.colors.textSecondary }]}>
              {block.type === 'heading' ? 'Heading' : block.type.charAt(0).toUpperCase() + block.type.slice(1)}
            </Text>
          </View>
          <View style={styles.blockActions}>
            <TouchableOpacity
              onPress={() => moveBlock(index, 'up')}
              disabled={index === 0}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={[styles.actionIcon, index === 0 && styles.actionDisabled]}
            >
              <Ionicons
                name="chevron-up"
                size={20}
                color={index === 0 ? theme.colors.border : theme.colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => moveBlock(index, 'down')}
              disabled={index === blocks.length - 1}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={[styles.actionIcon, index === blocks.length - 1 && styles.actionDisabled]}
            >
              <Ionicons
                name="chevron-down"
                size={20}
                color={index === blocks.length - 1 ? theme.colors.border : theme.colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => removeBlock(index)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={styles.actionIcon}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Block Content */}
        {block.type === 'heading' && (
          <TextInput
            style={[styles.headingBlockInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            value={block.content}
            onChangeText={(text) => updateTextContent(index, text)}
            placeholder="Enter heading..."
            placeholderTextColor={theme.colors.textSecondary}
            textAlign="center"
            autoFocus={editingTextIndex === index}
            onFocus={() => setEditingTextIndex(index)}
            onBlur={() => setEditingTextIndex(null)}
          />
        )}

        {block.type === 'text' && (
          <TextInput
            style={[styles.textBlockInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
            value={block.content}
            onChangeText={(text) => updateTextContent(index, text)}
            placeholder="Enter text..."
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            textAlignVertical="top"
            autoFocus={editingTextIndex === index}
            onFocus={() => setEditingTextIndex(index)}
            onBlur={() => setEditingTextIndex(null)}
          />
        )}

        {block.type === 'image' && (
          <Image
            source={{ uri: block.content }}
            style={styles.imagePreview}
            resizeMode="cover"
          />
        )}

        {block.type === 'video' && (
          <View style={[styles.videoPreview, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="play-circle" size={40} color={theme.colors.textSecondary} />
            <Text style={[styles.videoPreviewText, { color: theme.colors.textSecondary }]}>
              Video selected
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Existing Blocks */}
      {blocks.map((block, index) => renderBlock(block, index))}

      {/* Add Block Buttons */}
      {blocks.length < maxBlocks && (
        <View style={[styles.addRow, { borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            onPress={() => addBlock('heading')}
            activeOpacity={0.7}
          >
            <Ionicons name="text-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.addButtonText, { color: theme.colors.primary }]}>Heading</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            onPress={() => addBlock('text')}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.addButtonText, { color: theme.colors.primary }]}>Text</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            onPress={() => addBlock('image')}
            activeOpacity={0.7}
          >
            <Ionicons name="image-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.addButtonText, { color: theme.colors.primary }]}>Image</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            onPress={() => addBlock('video')}
            activeOpacity={0.7}
          >
            <Ionicons name="videocam-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.addButtonText, { color: theme.colors.primary }]}>Video</Text>
          </TouchableOpacity>
        </View>
      )}

      {blocks.length === 0 && (
        <View style={styles.emptyHint}>
          <Ionicons name="add-circle-outline" size={32} color={theme.colors.textSecondary + '60'} />
          <Text style={[styles.emptyHintText, { color: theme.colors.textSecondary }]}>
            Add text, images, or videos using the buttons above
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: isTablet ? 14 : 10,
  },
  blockContainer: {
    borderWidth: 1,
    borderRadius: themeConstants.borderRadius.sm,
    overflow: 'hidden',
  },
  blockControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  blockTypeLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockTypeText: {
    fontSize: 12,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  blockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIcon: {
    padding: 4,
  },
  actionDisabled: {
    opacity: 0.3,
  },
  headingBlockInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: isTablet ? 22 : 20,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    textAlign: 'center',
    minHeight: 44,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
    } as any),
  },
  textBlockInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingTop: 0,
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('400'),
    lineHeight: isTablet ? 22 : 20,
    minHeight: 60,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      outlineStyle: 'none',
    } as any),
  },
  imagePreview: {
    width: '100%',
    height: 180,
  },
  videoPreview: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  videoPreviewText: {
    fontSize: 13,
    fontWeight: '500',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: isTablet ? 12 : 10,
    borderRadius: themeConstants.borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  emptyHint: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyHintText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 250,
  },
});
