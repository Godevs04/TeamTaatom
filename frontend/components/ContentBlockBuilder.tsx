import React, { useState, useMemo } from 'react';
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
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { theme as themeConstants } from '../constants/theme';
import { ContentBlock, uploadContentImage } from '../services/connect';
import logger from '../utils/logger';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

// ─── Row packing (mirrors page/[id].tsx & preview.tsx) ───
type RowCell = { col: number; blocks: ContentBlock[]; indices: number[] };

function packBlocksIntoRows(blocks: ContentBlock[]): RowCell[][] {
  const rows: RowCell[][] = [];
  let current: RowCell[] = [];
  let used = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.stacked && rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      lastRow[lastRow.length - 1].blocks.push(block);
      lastRow[lastRow.length - 1].indices.push(i);
      continue;
    }
    const w = Math.max(1, Math.min(12, Number(block.col) || 12));
    if (used + w > 12 && current.length > 0) {
      rows.push(current);
      current = [];
      used = 0;
    }
    current.push({ col: w, blocks: [block], indices: [i] });
    used += w;
    if (used >= 12) {
      rows.push(current);
      current = [];
      used = 0;
    }
  }
  if (current.length > 0) rows.push(current);
  return rows;
}

// ─── Grid layout definitions ───
interface GridLayout {
  label: string;
  cols: number[];       // column widths, e.g. [6,6] for two halves
  visual: number[];     // same as cols, used to render the thumbnail
}

const GRID_LAYOUTS: GridLayout[] = [
  { label: 'Full',        cols: [12],           visual: [12] },
  { label: '2 Equal',     cols: [6, 6],         visual: [6, 6] },
  { label: '3 Equal',     cols: [4, 4, 4],      visual: [4, 4, 4] },
];

// ─── Content type options for filling empty cells ───
const CONTENT_TYPES: { type: ContentBlock['type']; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'text',    label: 'Text',    icon: 'document-text-outline' },
  { type: 'image',   label: 'Image',   icon: 'image-outline' },
  { type: 'video',   label: 'Video',   icon: 'videocam-outline' },
  { type: 'button',  label: 'Button',  icon: 'link-outline' },
  { type: 'divider', label: 'Divider', icon: 'remove-outline' },
  { type: 'embed',   label: 'Embed',   icon: 'code-outline' },
];

// ─── Block type icon map ───
const BLOCK_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  heading: 'text-outline',
  text: 'document-text-outline',
  image: 'image-outline',
  video: 'videocam-outline',
  button: 'link-outline',
  divider: 'remove-outline',
  embed: 'code-outline',
};

interface ContentBlockBuilderProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  maxBlocks?: number;
  pageId?: string;
}

export default function ContentBlockBuilder({
  blocks,
  onChange,
  maxBlocks = 20,
  pageId,
}: ContentBlockBuilderProps) {
  const { theme } = useTheme();
  const [editingTextIndex, setEditingTextIndex] = useState<number | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // When user picks a grid but cells are empty, this tracks which cell needs a type
  const [typePickerIndex, setTypePickerIndex] = useState<number | null>(null);

  const rows = useMemo(() => packBlocksIntoRows(blocks), [blocks]);

  // ─── Helpers ───
  const getWidthLabel = (col: number) => {
    switch (col) {
      case 12: return 'Full';
      case 9: return '3/4';
      case 8: return '2/3';
      case 6: return 'Half';
      case 4: return '1/3';
      case 3: return '1/4';
      default: return `${col}`;
    }
  };

  // ─── Add grid layout (creates empty placeholder cells) ───
  const addGridLayout = (layout: GridLayout) => {
    const remaining = maxBlocks - blocks.length;
    if (remaining < layout.cols.length) {
      Alert.alert('Limit Reached', `Need ${layout.cols.length} slots but only ${remaining} left.`);
      return;
    }
    const newBlocks: ContentBlock[] = layout.cols.map((col, i) => ({
      type: 'text' as const,  // placeholder — user picks real type by tapping
      content: '',
      order: blocks.length + i,
      col,
    }));
    onChange([...blocks, ...newBlocks]);
    setShowAddPanel(false);
    // Auto-open type picker for the first new empty cell
    setTypePickerIndex(blocks.length);
  };

  // ─── Add single block ───
  const addSingleBlock = (type: ContentBlock['type']) => {
    if (blocks.length >= maxBlocks) {
      Alert.alert('Limit Reached', `You can add up to ${maxBlocks} content blocks.`);
      return;
    }
    setShowAddPanel(false);
    if (type === 'image') {
      pickImage();
    } else if (type === 'video') {
      pickVideo();
    } else {
      const defaults: Partial<ContentBlock> = {};
      if (type === 'text') { defaults.align = 'left'; defaults.fontSize = 'normal'; }
      if (type === 'button') { defaults.url = ''; }
      if (type === 'divider') { defaults.content = '---'; }
      if (type === 'embed') { defaults.embedType = 'youtube'; }
      const newBlock: ContentBlock = { type, content: defaults.content || '', order: blocks.length, ...defaults };
      onChange([...blocks, newBlock]);
      setSelectedBlock(blocks.length);
      if (type === 'text') setEditingTextIndex(blocks.length);
    }
  };

  // ─── Set type for an empty placeholder cell ───
  const setCellType = async (index: number, type: ContentBlock['type']) => {
    setTypePickerIndex(null);
    if (type === 'image') {
      await pickImageForIndex(index);
    } else if (type === 'video') {
      await pickVideoForIndex(index);
    } else {
      const defaults: Partial<ContentBlock> = {};
      if (type === 'text') { defaults.align = 'left'; defaults.fontSize = 'normal'; }
      if (type === 'button') { defaults.url = ''; }
      if (type === 'divider') { defaults.content = '---'; }
      if (type === 'embed') { defaults.embedType = 'youtube'; }
      const updated = blocks.map((b, i) => i === index ? { ...b, type, content: defaults.content || '', ...defaults } : b);
      onChange(updated);
      setSelectedBlock(index);
      if (type === 'text') setEditingTextIndex(index);
    }
  };

  // ─── Image/video pickers ───
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Denied', 'We need photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        const localUri = result.assets[0].uri;
        if (pageId) {
          try {
            const up = await uploadContentImage(pageId, localUri);
            onChange([...blocks, { type: 'image', content: up.signedUrl, order: blocks.length, _storageKey: up.storageKey } as any]);
          } catch (e) { logger.error('Upload failed:', e); Alert.alert('Error', 'Failed to upload image.'); }
        } else {
          onChange([...blocks, { type: 'image', content: localUri, order: blocks.length }]);
        }
      }
    } catch (e) { logger.error('Image picker error:', e); Alert.alert('Error', 'Failed to select image.'); }
  };

  const pickImageForIndex = async (index: number) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Denied', 'We need photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        const localUri = result.assets[0].uri;
        if (pageId) {
          try {
            const up = await uploadContentImage(pageId, localUri);
            const updated = blocks.map((b, i) => i === index ? { ...b, type: 'image' as const, content: up.signedUrl, _storageKey: up.storageKey } : b);
            onChange(updated);
          } catch (e) { logger.error('Upload failed:', e); Alert.alert('Error', 'Failed to upload image.'); }
        } else {
          const updated = blocks.map((b, i) => i === index ? { ...b, type: 'image' as const, content: localUri } : b);
          onChange(updated);
        }
      }
    } catch (e) { logger.error('Image picker error:', e); Alert.alert('Error', 'Failed to select image.'); }
  };

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Denied', 'We need photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: true, quality: 0.7, videoMaxDuration: 60 });
      if (!result.canceled && result.assets[0]) {
        onChange([...blocks, { type: 'video', content: result.assets[0].uri, order: blocks.length }]);
      }
    } catch (e) { logger.error('Video picker error:', e); Alert.alert('Error', 'Failed to select video.'); }
  };

  const pickVideoForIndex = async (index: number) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Denied', 'We need photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: true, quality: 0.7, videoMaxDuration: 60 });
      if (!result.canceled && result.assets[0]) {
        const updated = blocks.map((b, i) => i === index ? { ...b, type: 'video' as const, content: result.assets[0].uri } : b);
        onChange(updated);
      }
    } catch (e) { logger.error('Video picker error:', e); Alert.alert('Error', 'Failed to select video.'); }
  };

  // ─── Block operations ───
  const removeBlock = (index: number) => {
    Alert.alert('Remove Block', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => {
          const updated = blocks.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i }));
          onChange(updated);
          if (selectedBlock === index) setSelectedBlock(null);
          if (editingTextIndex === index) setEditingTextIndex(null);
        },
      },
    ]);
  };

  const duplicateBlock = (index: number) => {
    if (blocks.length >= maxBlocks) { Alert.alert('Limit Reached', `Max ${maxBlocks} blocks.`); return; }
    const copy = { ...blocks[index], _id: undefined, order: index + 1 };
    const updated = [...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)].map((b, i) => ({ ...b, order: i }));
    onChange(updated);
  };

  const moveBlock = (index: number, dir: 'up' | 'down') => {
    const t = dir === 'up' ? index - 1 : index + 1;
    if (t < 0 || t >= blocks.length) return;
    const updated = [...blocks];
    [updated[index], updated[t]] = [updated[t], updated[index]];
    onChange(updated.map((b, i) => ({ ...b, order: i })));
    if (selectedBlock === index) setSelectedBlock(t);
    else if (selectedBlock === t) setSelectedBlock(index);
  };

  const updateBlockField = (index: number, fields: Partial<ContentBlock>) => {
    onChange(blocks.map((b, i) => (i === index ? { ...b, ...fields } : b)));
  };

  const updateTextContent = (index: number, text: string) => {
    onChange(blocks.map((b, i) => (i === index ? { ...b, content: text } : b)));
  };

  // ─── Is this block an empty placeholder? ───
  const isEmpty = (block: ContentBlock) => block.type === 'text' && !block.content && !block.bold && !block.backgroundColor && !block.fontSize;

  // ═══════════════════════════════════════════
  // RENDER: Row block card (mini preview in grid)
  // ═══════════════════════════════════════════
  const renderBlockCard = (block: ContentBlock, blockIndex: number) => {
    const isSelected = selectedBlock === blockIndex;
    const empty = isEmpty(block);

    return (
      <TouchableOpacity
        key={block._id || `b-${blockIndex}`}
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: isSelected ? theme.colors.primary : theme.colors.border },
          isSelected && { borderWidth: 2 },
        ]}
        onPress={() => {
          if (empty) {
            setTypePickerIndex(blockIndex);
          } else {
            setSelectedBlock(isSelected ? null : blockIndex);
          }
        }}
        activeOpacity={0.7}
      >
        {empty ? (
          // Empty placeholder
          <View style={[styles.cardEmpty, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="add-circle-outline" size={24} color={theme.colors.textSecondary + '80'} />
            <Text style={[styles.cardEmptyText, { color: theme.colors.textSecondary }]}>Tap to add</Text>
          </View>
        ) : block.type === 'image' && block.content ? (
          <Image source={{ uri: block.content }} style={styles.cardImage} resizeMode="cover" />
        ) : block.type === 'video' ? (
          <View style={[styles.cardPlaceholder, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="videocam" size={20} color={theme.colors.textSecondary} />
          </View>
        ) : block.type === 'divider' ? (
          <View style={[styles.cardPlaceholder, { backgroundColor: theme.colors.background }]}>
            <View style={{ width: '60%', height: 2, backgroundColor: theme.colors.border }} />
          </View>
        ) : (
          <View style={[styles.cardPlaceholder, { backgroundColor: block.backgroundColor || theme.colors.background }]}>
            <Text
              style={[styles.cardText, { color: block.color || theme.colors.text }, block.type === 'heading' && { fontWeight: '700', fontSize: 13 }]}
              numberOfLines={2}
            >
              {block.content || (block.type === 'button' ? 'Button' : block.type === 'embed' ? 'Embed' : `${block.type}...`)}
            </Text>
          </View>
        )}
        {/* Type label */}
        {!empty && (
          <View style={[styles.cardLabel, { borderTopColor: theme.colors.border }]}>
            <Ionicons name={BLOCK_ICON[block.type] || 'help-outline'} size={10} color={theme.colors.textSecondary} />
            <Text style={[styles.cardLabelText, { color: theme.colors.textSecondary }]}>
              {getWidthLabel(block.col ?? 12)}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ═══════════════════════════════════════════
  // RENDER: Editing panel for selected block
  // ═══════════════════════════════════════════
  const renderEditor = (block: ContentBlock, index: number) => {
    return (
      <View style={[styles.editor, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary }]}>
        {/* Header */}
        <View style={styles.editorHeader}>
          <View style={styles.editorTypeLabel}>
            <Ionicons name={BLOCK_ICON[block.type] || 'help-outline'} size={16} color={theme.colors.primary} />
            <Text style={[styles.editorTypeName, { color: theme.colors.text }]}>
              {block.type === 'heading' ? 'Text (Heading)' : block.type.charAt(0).toUpperCase() + block.type.slice(1)}
            </Text>
          </View>
          <View style={styles.editorActions}>
            <TouchableOpacity onPress={() => moveBlock(index, 'up')} disabled={index === 0} style={[styles.editorBtn, index === 0 && { opacity: 0.3 }]}>
              <Ionicons name="chevron-up" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1} style={[styles.editorBtn, index === blocks.length - 1 && { opacity: 0.3 }]}>
              <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => duplicateBlock(index)} style={styles.editorBtn}>
              <Ionicons name="copy-outline" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeBlock(index)} style={styles.editorBtn}>
              <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedBlock(null)} style={styles.editorBtn}>
              <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─ Basic controls: Width + Colors ─ */}
        {block.type !== 'divider' && (
          <View style={styles.controlRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
              {([
                { col: 12, label: 'Full' }, { col: 6, label: 'Half' },
              ] as const).map(({ col, label }) => {
                const active = (block.col ?? 12) === col;
                return (
                  <TouchableOpacity
                    key={col}
                    style={[styles.chip, { borderColor: theme.colors.border }, active && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]}
                    onPress={() => updateBlockField(index, { col })}
                  >
                    <Text style={[styles.chipText, { color: active ? theme.colors.primary : theme.colors.textSecondary }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <ColorPickerButton label="BG" value={block.backgroundColor || ''} onChange={(c) => updateBlockField(index, { backgroundColor: c })} theme={theme} />
              {(block.type === 'heading' || block.type === 'text' || block.type === 'button') && (
                <ColorPickerButton label="A" value={block.color || ''} onChange={(c) => updateBlockField(index, { color: c })} theme={theme} />
              )}
            </View>
          </View>
        )}

        {/* ─ Text format: bold + alignment + size (heading/text only) ─ */}
        {(block.type === 'heading' || block.type === 'text') && (
          <View style={[styles.controlRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }]}>
            <TouchableOpacity
              style={[styles.chip, { borderColor: block.type === 'heading' ? theme.colors.primary : theme.colors.border, backgroundColor: block.type === 'heading' ? theme.colors.primary + '15' : 'transparent', paddingHorizontal: 8, paddingVertical: 3 }]}
              onPress={() => {
                const newType = block.type === 'heading' ? 'text' : 'heading';
                updateBlockField(index, { type: newType, align: newType === 'heading' ? 'center' : (block.align || 'left') } as any);
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: block.type === 'heading' ? theme.colors.primary : theme.colors.textSecondary }}>H</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fmtChip, { borderColor: theme.colors.border }, block.bold && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]}
              onPress={() => updateBlockField(index, { bold: !block.bold })}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: block.bold ? theme.colors.primary : theme.colors.textSecondary }}>B</Text>
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            {(['left', 'center', 'right'] as const).map((a) => {
              const active = (block.align || (block.type === 'heading' ? 'center' : 'left')) === a;
              return (
                <TouchableOpacity key={a} style={[styles.fmtChip, { borderColor: theme.colors.border }, active && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]} onPress={() => updateBlockField(index, { align: a })}>
                  <Ionicons name={a === 'left' ? 'menu-outline' : a === 'center' ? 'reorder-three-outline' : 'menu-outline'} size={13} color={active ? theme.colors.primary : theme.colors.textSecondary} style={a === 'right' ? { transform: [{ scaleX: -1 }] } : undefined} />
                </TouchableOpacity>
              );
            })}
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            {(['small', 'normal', 'large'] as const).map((s) => {
              const active = (block.fontSize || 'normal') === s;
              return (
                <TouchableOpacity key={s} style={[styles.fmtChip, { borderColor: theme.colors.border }, active && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]} onPress={() => updateBlockField(index, { fontSize: s })}>
                  <Text style={[{ fontSize: 11, fontWeight: '700', color: active ? theme.colors.primary : theme.colors.textSecondary }, s === 'small' && { fontSize: 9 }, s === 'large' && { fontSize: 14 }]}>{s === 'small' ? 'S' : s === 'normal' ? 'M' : 'L'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ─ Advanced toggle ─ */}
        {block.type !== 'divider' && (
          <TouchableOpacity
            style={[styles.advancedToggle, { borderTopColor: theme.colors.border }]}
            onPress={() => setShowAdvanced(!showAdvanced)}
            activeOpacity={0.7}
          >
            <Text style={[styles.advancedToggleText, { color: theme.colors.textSecondary }]}>
              {showAdvanced ? 'Hide options' : 'More options'}
            </Text>
            <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* ─ Advanced controls ─ */}
        {showAdvanced && block.type !== 'divider' && (
          <View style={[styles.advancedPanel, { borderTopColor: theme.colors.border }]}>
            {/* Image aspect ratio */}
            {block.type === 'image' && (
              <View style={styles.advRow}>
                <Text style={[styles.advLabel, { color: theme.colors.textSecondary }]}>Ratio</Text>
                {(['original', 'square', 'landscape', 'portrait'] as const).map((ar) => {
                  const active = (block.aspectRatio || 'original') === ar;
                  return (
                    <TouchableOpacity key={ar} style={[styles.chip, { borderColor: theme.colors.border }, active && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]} onPress={() => updateBlockField(index, { aspectRatio: ar })}>
                      <Text style={[styles.chipText, { color: active ? theme.colors.primary : theme.colors.textSecondary }]}>
                        {ar === 'original' ? 'Auto' : ar === 'square' ? '1:1' : ar === 'landscape' ? '16:9' : '3:4'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {/* Vertical align */}
            <View style={styles.advRow}>
              <Text style={[styles.advLabel, { color: theme.colors.textSecondary }]}>V-Align</Text>
              {(['top', 'center', 'bottom'] as const).map((va) => {
                const active = (block.verticalAlign || 'top') === va;
                return (
                  <TouchableOpacity key={va} style={[styles.fmtChip, { borderColor: theme.colors.border }, active && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]} onPress={() => updateBlockField(index, { verticalAlign: va })}>
                    <Ionicons name={va === 'top' ? 'arrow-up-outline' : va === 'center' ? 'remove-outline' : 'arrow-down-outline'} size={13} color={active ? theme.colors.primary : theme.colors.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Padding */}
            <View style={styles.advRow}>
              <Text style={[styles.advLabel, { color: theme.colors.textSecondary }]}>Padding</Text>
              {(['none', 'small', 'medium', 'large'] as const).map((p) => {
                const active = (block.padding || '') === p || (!block.padding && p === 'none');
                return (
                  <TouchableOpacity key={p} style={[styles.fmtChip, { borderColor: theme.colors.border }, active && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]} onPress={() => updateBlockField(index, { padding: p })}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: active ? theme.colors.primary : theme.colors.textSecondary }}>{p === 'none' ? '0' : p === 'small' ? 'S' : p === 'medium' ? 'M' : 'L'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Border radius */}
            <View style={styles.advRow}>
              <Text style={[styles.advLabel, { color: theme.colors.textSecondary }]}>Corners</Text>
              {(['none', 'small', 'medium', 'large'] as const).map((r) => {
                const active = (block.borderRadius || '') === r || (!block.borderRadius && r === 'none');
                return (
                  <TouchableOpacity key={r} style={[styles.fmtChip, { borderColor: theme.colors.border }, active && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]} onPress={() => updateBlockField(index, { borderRadius: r })}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: active ? theme.colors.primary : theme.colors.textSecondary }}>{r === 'none' ? '0' : r === 'small' ? 'S' : r === 'medium' ? 'M' : 'L'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Stack toggle */}
            {index > 0 && (
              <View style={styles.advRow}>
                <Text style={[styles.advLabel, { color: theme.colors.textSecondary }]}>Stack</Text>
                <TouchableOpacity
                  style={[styles.chip, { borderColor: theme.colors.border }, block.stacked && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]}
                  onPress={() => updateBlockField(index, { stacked: !block.stacked })}
                >
                  <Ionicons name="layers-outline" size={13} color={block.stacked ? theme.colors.primary : theme.colors.textSecondary} />
                  <Text style={[styles.chipText, { color: block.stacked ? theme.colors.primary : theme.colors.textSecondary, marginLeft: 4 }]}>{block.stacked ? 'On' : 'Off'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ─ Content area ─ */}
        {(block.type === 'heading' || block.type === 'text') && (() => {
          const isHeading = block.type === 'heading';
          const sz = isHeading
            ? (block.fontSize === 'small' ? (isTablet ? 18 : 16) : block.fontSize === 'large' ? (isTablet ? 26 : 24) : (isTablet ? 22 : 20))
            : (block.fontSize === 'small' ? (isTablet ? 13 : 12) : block.fontSize === 'large' ? (isTablet ? 18 : 17) : (isTablet ? 15 : 14));
          return (
            <TextInput
              style={[isHeading ? styles.headingInput : styles.textInput, { color: theme.colors.text, borderColor: theme.colors.border, fontSize: sz }, block.bold && { fontWeight: isHeading ? '800' : '700' } as any]}
              value={block.content}
              onChangeText={(t) => updateTextContent(index, t)}
              placeholder={isHeading ? 'Enter heading...' : 'Enter text...'}
              placeholderTextColor={theme.colors.textSecondary}
              multiline={!isHeading}
              textAlign={(block.align as any) || (isHeading ? 'center' : 'left')}
              {...(!isHeading && { textAlignVertical: 'top' as const })}
              autoFocus={editingTextIndex === index}
              onFocus={() => setEditingTextIndex(index)}
              onBlur={() => setEditingTextIndex(null)}
            />
          );
        })()}
        {block.type === 'image' && block.content ? (
          <Image source={{ uri: block.content }} style={styles.imagePreview} resizeMode="cover" />
        ) : block.type === 'image' ? (
          <TouchableOpacity style={[styles.imagePlaceholder, { backgroundColor: theme.colors.background }]} onPress={() => pickImageForIndex(index)}>
            <Ionicons name="image-outline" size={32} color={theme.colors.textSecondary + '80'} />
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Tap to select image</Text>
          </TouchableOpacity>
        ) : null}
        {block.type === 'video' && (
          <View style={[styles.videoPreview, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="play-circle" size={40} color={theme.colors.textSecondary} />
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '500' }}>Video selected</Text>
          </View>
        )}
        {block.type === 'button' && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
            <TextInput style={[styles.btnLabelInput, { color: theme.colors.text, borderColor: theme.colors.border }]} value={block.content} onChangeText={(t) => updateTextContent(index, t)} placeholder="Button label..." placeholderTextColor={theme.colors.textSecondary} />
            <View style={[styles.btnUrlRow, { borderColor: theme.colors.border }]}>
              <Ionicons name="link-outline" size={16} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput style={[styles.btnUrlInput, { color: theme.colors.text }]} value={block.url || ''} onChangeText={(t) => updateBlockField(index, { url: t })} placeholder="https://..." placeholderTextColor={theme.colors.textSecondary} keyboardType="url" autoCapitalize="none" />
            </View>
          </View>
        )}
        {block.type === 'divider' && <View style={[styles.dividerLine, { borderTopColor: theme.colors.border }]} />}
        {block.type === 'embed' && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['youtube', 'map', 'custom'] as const).map((et) => (
                <TouchableOpacity key={et} style={[styles.chip, { borderColor: theme.colors.border }, block.embedType === et && { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]} onPress={() => updateBlockField(index, { embedType: et })}>
                  <Text style={[styles.chipText, { color: block.embedType === et ? theme.colors.primary : theme.colors.textSecondary }]}>{et === 'youtube' ? 'YouTube' : et === 'map' ? 'Map' : 'Custom'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.embedInput, { color: theme.colors.text, borderColor: theme.colors.border }]} value={block.content} onChangeText={(t) => updateTextContent(index, t)} placeholder={block.embedType === 'youtube' ? 'YouTube URL...' : block.embedType === 'map' ? 'Google Maps URL...' : 'Embed URL...'} placeholderTextColor={theme.colors.textSecondary} keyboardType="url" autoCapitalize="none" />
          </View>
        )}
      </View>
    );
  };

  // ═══════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════
  return (
    <View style={styles.container}>
      {/* ── Live layout grid ── */}
      {rows.length > 0 && (
        <View style={[styles.gridPreview, { borderColor: theme.colors.border }]}>
          <Text style={[styles.gridTitle, { color: theme.colors.textSecondary }]}>Layout</Text>
          {rows.map((row, ri) => (
            <View key={`r-${ri}`} style={styles.gridRow}>
              {row.map((cell, ci) => (
                <View key={`c-${ri}-${ci}`} style={{ flex: cell.col, flexDirection: cell.blocks.length > 1 ? 'column' : 'row', gap: 4 }}>
                  {cell.blocks.map((block, bi) => renderBlockCard(block, cell.indices[bi]))}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* ── Selected block editor ── */}
      {selectedBlock !== null && selectedBlock < blocks.length && !isEmpty(blocks[selectedBlock]) && (
        renderEditor(blocks[selectedBlock], selectedBlock)
      )}

      {/* ── Type picker modal (for empty cells) ── */}
      {typePickerIndex !== null && (
        <Modal transparent animationType="fade" onRequestClose={() => setTypePickerIndex(null)}>
          <TouchableOpacity style={styles.typePickerOverlay} activeOpacity={1} onPress={() => setTypePickerIndex(null)}>
            <View style={[styles.typePickerPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.typePickerTitle, { color: theme.colors.text }]}>Choose content type</Text>
              <View style={styles.typePickerGrid}>
                {CONTENT_TYPES.map(({ type, label, icon }) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typePickerItem, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                    onPress={() => setCellType(typePickerIndex, type)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={icon} size={24} color={theme.colors.primary} />
                    <Text style={[styles.typePickerItemText, { color: theme.colors.text }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ── Add panel (grid layouts + single blocks) ── */}
      {showAddPanel && blocks.length < maxBlocks && (
        <View style={[styles.addPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {/* Grid layouts */}
          <Text style={[styles.addPanelSection, { color: theme.colors.text }]}>Row Layouts</Text>
          <View style={styles.gridLayoutPicker}>
            {GRID_LAYOUTS.map((layout, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.gridLayoutOption, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                onPress={() => addGridLayout(layout)}
                activeOpacity={0.7}
              >
                {/* Visual thumbnail */}
                <View style={styles.gridLayoutThumb}>
                  {layout.visual.map((v, vi) => (
                    <View key={vi} style={[styles.gridLayoutBlock, { flex: v, backgroundColor: theme.colors.primary + '20' }]} />
                  ))}
                </View>
                <Text style={[styles.gridLayoutLabel, { color: theme.colors.textSecondary }]}>{layout.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Single blocks */}
          <Text style={[styles.addPanelSection, { color: theme.colors.text, marginTop: 12 }]}>Single Block</Text>
          <View style={styles.singleBlockPicker}>
            {CONTENT_TYPES.map(({ type, label, icon }) => (
              <TouchableOpacity
                key={type}
                style={[styles.singleBlockOption, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => addSingleBlock(type)}
                activeOpacity={0.7}
              >
                <Ionicons name={icon} size={20} color={theme.colors.primary} />
                <Text style={[styles.singleBlockLabel, { color: theme.colors.primary }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── + Button ── */}
      {blocks.length < maxBlocks && (
        <TouchableOpacity
          style={[styles.addButton, { overflow: 'hidden', borderWidth: 0 }]}
          onPress={() => setShowAddPanel(!showAddPanel)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#50C878', '#1C73B4']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Ionicons name={showAddPanel ? 'close' : 'add'} size={24} color="#fff" />
          {!showAddPanel && <Text style={styles.addButtonText}>Add Content</Text>}
        </TouchableOpacity>
      )}

      {/* Empty state */}
      {blocks.length === 0 && !showAddPanel && (
        <View style={styles.emptyHint}>
          <Ionicons name="add-circle-outline" size={32} color={theme.colors.textSecondary + '60'} />
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            Tap the + button to start building your page
          </Text>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const styles = StyleSheet.create({
  container: { gap: isTablet ? 14 : 10 },

  // Grid preview
  gridPreview: { borderWidth: 1, borderRadius: themeConstants.borderRadius.sm, padding: 8, gap: 4 },
  gridTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  gridRow: { flexDirection: 'row', gap: 4 },

  // Block cards (inside grid)
  card: { flex: 1, borderWidth: 1, borderRadius: 8, overflow: 'hidden', minHeight: 56 },
  cardEmpty: { flex: 1, minHeight: 56, justifyContent: 'center', alignItems: 'center', gap: 2 },
  cardEmptyText: { fontSize: 9, fontWeight: '600' },
  cardImage: { width: '100%', height: 52 },
  cardPlaceholder: { flex: 1, minHeight: 40, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  cardText: { fontSize: 10, textAlign: 'center' },
  cardLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2, borderTopWidth: StyleSheet.hairlineWidth },
  cardLabelText: { fontSize: 8, fontWeight: '600' },

  // Editor panel
  editor: { borderWidth: 2, borderRadius: themeConstants.borderRadius.sm, overflow: 'hidden' },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  editorTypeLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editorTypeName: { fontSize: 14, fontWeight: '600' },
  editorActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  editorBtn: { padding: 5 },

  // Controls
  controlRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: '600' },
  fmtChip: { width: 28, height: 26, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  divider: { width: 1, height: 16, marginHorizontal: 1 },

  // Advanced
  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  advancedToggleText: { fontSize: 11, fontWeight: '600' },
  advancedPanel: { paddingHorizontal: 8, paddingBottom: 8, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
  advRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
  advLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, width: 42 },

  // Content inputs
  headingInput: { paddingHorizontal: 12, paddingVertical: 10, fontSize: isTablet ? 22 : 20, fontFamily: getFontFamily('700'), fontWeight: '700', textAlign: 'center', minHeight: 44, ...(isWeb && { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', outlineStyle: 'none' } as any) },
  textInput: { paddingHorizontal: 12, paddingVertical: 10, paddingTop: 0, fontSize: isTablet ? 15 : 14, fontFamily: getFontFamily('400'), lineHeight: isTablet ? 22 : 20, minHeight: 60, ...(isWeb && { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', outlineStyle: 'none' } as any) },
  imagePreview: { width: '100%', height: 180 },
  imagePlaceholder: { width: '100%', height: 100, justifyContent: 'center', alignItems: 'center', gap: 6 },
  videoPreview: { width: '100%', height: 100, justifyContent: 'center', alignItems: 'center', gap: 6 },
  btnLabelInput: { fontSize: isTablet ? 15 : 14, borderWidth: 1, borderRadius: themeConstants.borderRadius.sm, paddingHorizontal: 12, paddingVertical: isTablet ? 10 : 8, ...(isWeb && { outlineStyle: 'none' } as any) },
  btnUrlRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: themeConstants.borderRadius.sm, paddingHorizontal: 12, paddingVertical: isTablet ? 10 : 8 },
  btnUrlInput: { flex: 1, fontSize: isTablet ? 14 : 13, paddingVertical: 0, ...(isWeb && { outlineStyle: 'none' } as any) },
  dividerLine: { borderTopWidth: 2, marginHorizontal: 12, marginVertical: 8 },
  embedInput: { fontSize: isTablet ? 14 : 13, borderWidth: 1, borderRadius: themeConstants.borderRadius.sm, paddingHorizontal: 12, paddingVertical: isTablet ? 10 : 8, ...(isWeb && { outlineStyle: 'none' } as any) },

  // Type picker modal
  typePickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  typePickerPanel: { width: '85%', maxWidth: 340, borderRadius: 16, borderWidth: 1, padding: 20 },
  typePickerTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  typePickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  typePickerItem: { width: 90, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  typePickerItemText: { fontSize: 12, fontWeight: '600' },

  // Add panel
  addPanel: { borderWidth: 1, borderRadius: themeConstants.borderRadius.sm, padding: 12 },
  addPanelSection: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  gridLayoutPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridLayoutOption: { width: '47%', borderWidth: 1, borderRadius: 10, padding: 10, alignItems: 'center', gap: 6 },
  gridLayoutThumb: { flexDirection: 'row', gap: 3, width: '100%', height: 24 },
  gridLayoutBlock: { borderRadius: 4 },
  gridLayoutLabel: { fontSize: 10, fontWeight: '600' },
  singleBlockPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  singleBlockOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  singleBlockLabel: { fontSize: 12, fontWeight: '600' },

  // + Button
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: themeConstants.borderRadius.sm, borderWidth: 1 },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Empty
  emptyHint: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', maxWidth: 250 },

  // Color picker
  colorSwatchBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  colorSwatchLabel: { fontSize: 10, fontWeight: '700' },
  colorPopover: { position: 'absolute', top: 32, right: 0, width: 220, padding: 10, borderRadius: 10, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6, zIndex: 100, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
  swatchOption: { width: 28, height: 28, borderRadius: 14, borderWidth: 1 },
  clearSwatch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
});

const PRESET_COLORS = [
  '#FFFFFF', '#000000', '#F5F5F5', '#1E1E1E',
  '#4A90E2', '#5856D6', '#9A1750', '#FF3B30',
  '#FF6B35', '#FFD700', '#E8C547', '#34C759',
  '#2C5530', '#0F4C5C', '#6B4F8A', '#D4A373',
];

function ColorPickerButton({ label, value, onChange, theme }: { label: string; value: string; onChange: (c: string) => void; theme: any }) {
  const [open, setOpen] = useState(false);
  const isSet = !!value;
  return (
    <View>
      <TouchableOpacity style={[styles.colorSwatchBtn, { borderColor: theme.colors.border, backgroundColor: isSet ? value : 'transparent' }]} onPress={() => setOpen((o) => !o)} activeOpacity={0.7}>
        {!isSet && <Text style={[styles.colorSwatchLabel, { color: theme.colors.textSecondary }]}>{label}</Text>}
      </TouchableOpacity>
      {open && (
        <View style={[styles.colorPopover, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {PRESET_COLORS.map((c) => (
            <TouchableOpacity key={c} style={[styles.swatchOption, { backgroundColor: c, borderColor: value.toLowerCase() === c.toLowerCase() ? theme.colors.primary : theme.colors.border }]} onPress={() => { onChange(c); setOpen(false); }} activeOpacity={0.7} />
          ))}
          <TouchableOpacity style={[styles.swatchOption, styles.clearSwatch, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]} onPress={() => { onChange(''); setOpen(false); }} activeOpacity={0.7}>
            <Ionicons name="close" size={14} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
