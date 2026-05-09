import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { theme as themeConstants } from '../../constants/theme';
import {
  getCanvasContent,
  updateCanvasContent,
  uploadContentImage,
  uploadContentVideo,
  CanvasElement,
} from '../../services/connect';
import CanvasElementView from '../../components/CanvasElementView';
import { optimizeImageForUpload } from '../../utils/imageOptimization';
import logger from '../../utils/logger';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const HEADER_H = 56;
const TOOLBAR_H = 88;
const VERTICAL_PADDING = 24;

// Compute a 9:16 frame that fits the available area.
const computeFrame = () => {
  const availableW = screenWidth - 32;
  const availableH = screenHeight - HEADER_H - TOOLBAR_H - VERTICAL_PADDING * 2;
  const byWidth = { w: availableW, h: (availableW * 16) / 9 };
  const byHeight = { w: (availableH * 9) / 16, h: availableH };
  return byWidth.h <= availableH ? byWidth : byHeight;
};

const newId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const PRESET_BG_COLORS = [
  '#000000', '#FFFFFF', '#1E1E1E', '#FAF7F2',
  '#0F4C5C', '#9A1750', '#E8C547', '#2C5530',
  '#4A90E2', '#FF6B35', '#6B4F8A', '#D4A373',
];

const PRESET_TEXT_COLORS = [
  '#FFFFFF', '#000000', '#FFD700', '#FF6B35',
  '#4A90E2', '#9A1750', '#2C5530', '#0F4C5C',
  '#E8C547', '#FF3B30', '#6B4F8A', '#D4A373',
];

export default function CanvasEditorScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { pageId } = useLocalSearchParams<{ pageId: string }>();

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [background, setBackground] = useState<string>('#000000');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  // Tracks elements created in this edit session so we can auto-delete them
  // if the user cancels their first text entry without typing anything.
  const [pendingNewTextId, setPendingNewTextId] = useState<string | null>(null);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const frame = useMemo(() => computeFrame(), []);

  // Full-screen preview frame: 9:16 fit-to-screen with letterboxing.
  const previewFrame = useMemo(() => {
    const targetRatio = 9 / 16;
    const screenRatio = screenWidth / screenHeight;
    if (screenRatio > targetRatio) {
      const h = screenHeight;
      return { w: h * targetRatio, h };
    }
    const w = screenWidth;
    return { w, h: w / targetRatio };
  }, []);

  useEffect(() => {
    if (pageId) loadCanvas();
  }, [pageId]);

  const loadCanvas = async () => {
    if (!pageId) return;
    try {
      setLoading(true);
      const data = await getCanvasContent(pageId);
      // Server elements may not have _id locally yet — use _id when present, else generate.
      const withIds = (data.canvasContent || []).map((el, idx) => ({
        ...el,
        _id: el._id || newId(),
        zIndex: el.zIndex ?? idx,
      }));
      setElements(withIds);
      setBackground(data.canvasBackground || '#000000');
    } catch (error) {
      logger.error('Error loading canvas:', error);
      Alert.alert('Error', 'Failed to load canvas.');
    } finally {
      setLoading(false);
    }
  };

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setElements((prev) =>
      prev.map((el) => (el._id === id ? ({ ...el, ...updates } as CanvasElement) : el))
    );
    setHasChanges(true);
  }, []);

  const deleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el._id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
    setHasChanges(true);
  }, []);

  const addText = useCallback(() => {
    const id = newId();
    const defaultColor = background.toUpperCase() === '#FFFFFF' ? '#000000' : '#FFFFFF';
    setElements((prev) => [
      ...prev,
      {
        _id: id,
        type: 'text',
        content: '',
        x: 0.5,
        y: 0.5,
        w: 0.6,
        h: 0.12,
        rotation: 0,
        zIndex: prev.length,
        fontSize: 24,
        color: defaultColor,
        fontWeight: '600',
        backgroundColor: 'transparent',
      },
    ]);
    setSelectedId(id);
    setEditingId(id);
    setEditingText('');
    setPendingNewTextId(id);
    setHasChanges(true);
  }, [background]);

  const addImage = useCallback(async () => {
    if (!pageId) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need photo library access to add images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      // iOS hardening: re-encode through ImageManipulator before upload. Photos
      // gallery picks return HEIC at full sensor size on iOS — uploading those
      // raw is the leading cause of crashes / OOMs / unrenderable downstream
      // assets. The optimizer caps dimensions and forces JPEG bytes that match
      // the 'image/jpeg' MIME we send to the backend.
      const optimized = await optimizeImageForUpload(asset.uri, {
        maxWidth: 2048,
        maxHeight: 2048,
        quality: 0.9,
        format: 'jpeg',
      });
      const upload = await uploadContentImage(pageId, optimized.uri);
      // Use optimized dimensions (post-resize) so the element box aspect-matches
      // exactly what gets rendered.
      const aspect = (optimized.width || asset.width || 1) / (optimized.height || asset.height || 1);
      const frameAspect = frame.w / frame.h;
      let elW = 0.6;
      let elH = elW * (frameAspect / aspect);
      if (elH > 0.8) {
        elH = 0.8;
        elW = elH * (aspect / frameAspect);
      }
      const id = newId();
      setElements((prev) => [
        ...prev,
        {
          _id: id,
          type: 'image',
          content: upload.signedUrl,
          x: 0.5,
          y: 0.5,
          w: elW,
          h: elH,
          rotation: 0,
          zIndex: prev.length,
        },
      ]);
      setSelectedId(id);
      setHasChanges(true);
    } catch (error: any) {
      logger.error('Image add error:', error);
      Alert.alert('Error', error?.message || 'Failed to add image.');
    }
  }, [pageId, frame.w, frame.h]);

  const addVideo = useCallback(async () => {
    if (!pageId) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need photo library access to add videos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 60,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const upload = await uploadContentVideo(pageId, asset.uri);
      const aspect = (asset.width || 9) / (asset.height || 16);
      const frameAspect = frame.w / frame.h;
      let elW = 0.7;
      let elH = elW * (frameAspect / aspect);
      if (elH > 0.85) {
        elH = 0.85;
        elW = elH * (aspect / frameAspect);
      }
      const id = newId();
      setElements((prev) => [
        ...prev,
        {
          _id: id,
          type: 'video',
          content: upload.signedUrl,
          x: 0.5,
          y: 0.5,
          w: elW,
          h: elH,
          rotation: 0,
          zIndex: prev.length,
        },
      ]);
      setSelectedId(id);
      setHasChanges(true);
    } catch (error: any) {
      logger.error('Video add error:', error);
      Alert.alert('Error', error?.message || 'Failed to add video.');
    }
  }, [pageId]);

  const onSave = async () => {
    if (!pageId) return;
    try {
      setSaving(true);
      // Strip local _id (server assigns its own subdoc _id) — but keep for client matching after reload.
      const payload = elements.map(({ _id, ...rest }) => rest as CanvasElement);
      await updateCanvasContent(pageId, payload, background);
      setHasChanges(false);
      Alert.alert('Saved', 'Canvas saved.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      logger.error('Save canvas error:', error);
      Alert.alert('Error', error?.message || 'Failed to save canvas.');
    } finally {
      setSaving(false);
    }
  };

  const onBack = () => {
    if (hasChanges) {
      Alert.alert('Unsaved Changes', 'Discard your edits?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  const openTextEdit = useCallback((id: string) => {
    const el = elements.find((e) => e._id === id);
    if (!el || el.type !== 'text') return;
    setEditingId(id);
    setEditingText(el.content);
  }, [elements]);

  const commitTextEdit = () => {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (!trimmed) {
      // Empty content — drop the element entirely rather than leaving an
      // invisible placeholder on the canvas.
      deleteElement(editingId);
    } else {
      updateElement(editingId, { content: trimmed });
    }
    setEditingId(null);
    setEditingText('');
    setPendingNewTextId(null);
  };

  const cancelTextEdit = () => {
    // If the user cancels editing a brand-new text element without typing
    // anything, drop it so we don't leave invisible placeholders behind.
    if (pendingNewTextId && editingId === pendingNewTextId) {
      deleteElement(pendingNewTextId);
    }
    setEditingId(null);
    setEditingText('');
    setPendingNewTextId(null);
  };

  const selectedTextElement =
    selectedId != null
      ? elements.find((e) => e._id === selectedId && e.type === 'text')
      : undefined;

  const setBgColor = (color: string) => {
    setBackground(color);
    setShowBgPicker(false);
    setHasChanges(true);
  };

  const setSelectedTextColor = (color: string) => {
    if (!selectedTextElement?._id) return;
    updateElement(selectedTextElement._id, { color });
    setShowTextColorPicker(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Canvas</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Canvas</Text>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowPreview(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="eye-outline" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.colors.primary }, (!hasChanges || saving) && { opacity: 0.5 }]}
            onPress={onSave}
            disabled={!hasChanges || saving}
          >
            {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveText}>Save</Text>}
          </TouchableOpacity>
        </View>

        {/* Frame */}
        <View style={styles.frameOuter}>
          <View
            style={[styles.frame, { width: frame.w, height: frame.h, backgroundColor: background }]}
          >
            {elements
              .slice()
              .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
              .map((el) => (
                <CanvasElementView
                  key={el._id}
                  element={el}
                  isSelected={selectedId === el._id}
                  editable
                  frameWidth={frame.w}
                  frameHeight={frame.h}
                  onSelect={() => setSelectedId(el._id || null)}
                  onChange={(updates) => updateElement(el._id!, updates)}
                  onDelete={() => deleteElement(el._id!)}
                  onRequestEdit={() => openTextEdit(el._id!)}
                />
              ))}
          </View>
        </View>

        {/* Toolbar */}
        <View style={[styles.toolbar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.toolBtn} onPress={addText}>
            <Ionicons name="text" size={22} color={theme.colors.text} />
            <Text style={[styles.toolLabel, { color: theme.colors.text }]}>Text</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={addImage}>
            <Ionicons name="image" size={22} color={theme.colors.text} />
            <Text style={[styles.toolLabel, { color: theme.colors.text }]}>Image</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={addVideo}>
            <Ionicons name="videocam" size={22} color={theme.colors.text} />
            <Text style={[styles.toolLabel, { color: theme.colors.text }]}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => setShowBgPicker(true)}>
            <View style={[styles.bgSwatchPreview, { backgroundColor: background, borderColor: theme.colors.border }]} />
            <Text style={[styles.toolLabel, { color: theme.colors.text }]}>BG</Text>
          </TouchableOpacity>
          {selectedTextElement && (
            <TouchableOpacity style={styles.toolBtn} onPress={() => setShowTextColorPicker(true)}>
              <View style={[styles.bgSwatchPreview, { backgroundColor: selectedTextElement.color || '#FFFFFF', borderColor: theme.colors.border }]} />
              <Text style={[styles.toolLabel, { color: theme.colors.text }]}>Color</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Text edit modal */}
        <Modal visible={!!editingId} transparent animationType="fade" onRequestClose={cancelTextEdit}>
          <KeyboardAvoidingView
            behavior={isIOS ? 'padding' : 'height'}
            style={styles.modalRoot}
          >
            <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit text</Text>
              <TextInput
                style={[styles.modalInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                value={editingText}
                onChangeText={setEditingText}
                multiline
                autoFocus
                placeholder="Type something..."
                placeholderTextColor={theme.colors.textSecondary}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalBtn} onPress={cancelTextEdit}>
                  <Text style={[styles.modalBtnText, { color: theme.colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}
                  onPress={commitTextEdit}
                >
                  <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Background color picker */}
        <Modal visible={showBgPicker} transparent animationType="fade" onRequestClose={() => setShowBgPicker(false)}>
          <TouchableOpacity
            style={styles.modalRoot}
            activeOpacity={1}
            onPress={() => setShowBgPicker(false)}
          >
            <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]} onStartShouldSetResponder={() => true}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Background color</Text>
              <View style={styles.swatchGrid}>
                {PRESET_BG_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setBgColor(c)}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      background.toUpperCase() === c.toUpperCase() && { borderColor: theme.colors.primary, borderWidth: 3 },
                    ]}
                    activeOpacity={0.8}
                  />
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Full-screen preview */}
        <Modal
          visible={showPreview}
          animationType="fade"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowPreview(false)}
          statusBarTranslucent
        >
          <View style={styles.previewRoot}>
            <View
              style={{
                width: previewFrame.w,
                height: previewFrame.h,
                backgroundColor: background,
                overflow: 'hidden',
              }}
            >
              {elements
                .slice()
                .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                .map((el) => (
                  <CanvasElementView
                    key={el._id}
                    element={el}
                    isSelected={false}
                    editable={false}
                    frameWidth={previewFrame.w}
                    frameHeight={previewFrame.h}
                  />
                ))}
            </View>
            <TouchableOpacity
              style={styles.previewClose}
              onPress={() => setShowPreview(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Modal>

        {/* Text color picker */}
        <Modal visible={showTextColorPicker} transparent animationType="fade" onRequestClose={() => setShowTextColorPicker(false)}>
          <TouchableOpacity
            style={styles.modalRoot}
            activeOpacity={1}
            onPress={() => setShowTextColorPicker(false)}
          >
            <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]} onStartShouldSetResponder={() => true}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Text color</Text>
              <View style={styles.swatchGrid}>
                {PRESET_TEXT_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setSelectedTextColor(c)}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      selectedTextElement?.color?.toUpperCase() === c.toUpperCase() && { borderColor: theme.colors.primary, borderWidth: 3 },
                    ]}
                    activeOpacity={0.8}
                  />
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: HEADER_H,
    paddingHorizontal: themeConstants.spacing.md,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frameOuter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: VERTICAL_PADDING },
  frame: {
    overflow: 'hidden',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  toolbar: {
    flexDirection: 'row',
    height: TOOLBAR_H,
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  toolBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  toolLabel: { fontSize: 11, fontWeight: '500' },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    minHeight: 80,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalBtnText: { fontWeight: '600', fontSize: 14 },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 4,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  bgSwatchPreview: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
  },
  previewRoot: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: isIOS ? 50 : 20,
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
