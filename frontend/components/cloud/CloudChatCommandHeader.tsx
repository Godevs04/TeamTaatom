import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { cloudDesign } from '../../constants/cloudDesign';
import CloudSearchDock from './CloudSearchDock';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isAndroid = Platform.OS === 'android';

interface CloudChatCommandHeaderProps {
  title: string;
  search: string;
  onSearchChange: (v: string) => void;
  onBack?: () => void;
  onCompose?: () => void;
  onMarkAllRead?: () => void;
}

export default function CloudChatCommandHeader({
  title,
  search,
  onSearchChange,
  onBack,
  onCompose,
  onMarkAllRead,
}: CloudChatCommandHeaderProps) {
  const { theme, mode } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000';
  const titleColor = isDark ? theme.colors.text : cloudDesign.textDark;
  const iconColor = isDark ? theme.colors.textSecondary : cloudDesign.textMid;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.dock,
          {
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(28, 115, 180, 0.15)',
          }
        ]}
      >
        <BlurView intensity={isDark ? 95 : 80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        <View style={styles.topRow}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={[styles.iconBtn, { overflow: 'hidden', borderRadius: 20 }]} hitSlop={10}>
              <LinearGradient
                colors={['#1C73B4', '#50C878']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="ellipsis-horizontal" size={22} color={iconColor} />
          </TouchableOpacity>
        </View>
        <CloudSearchDock
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search conversations"
          style={styles.searchInDock}
        />
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuCard, cloudDesign.shadowFloat, isDark && { backgroundColor: theme.colors.glassStrong, borderWidth: 1, borderColor: theme.colors.glassBorder }]}>
            {onCompose && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setMenuOpen(false); onCompose(); }}
              >
                <Ionicons name="create-outline" size={20} color={isDark ? theme.colors.primary : cloudDesign.blueDeep} />
                <Text style={[styles.menuText, { color: titleColor }]}>New message</Text>
              </TouchableOpacity>
            )}
            {onMarkAllRead && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setMenuOpen(false); onMarkAllRead(); }}
              >
                <Ionicons name="checkmark-done" size={20} color={isDark ? theme.colors.primary : cloudDesign.blueDeep} />
                <Text style={[styles.menuText, { color: titleColor }]}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: isTablet ? 24 : 14,
    marginTop: isAndroid ? 6 : 4,
    marginBottom: 8,
  },
  dock: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: cloudDesign.textDark,
  },
  searchInDock: {
    marginHorizontal: 8,
    marginTop: 0,
    padding: 6,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26,43,60,0.25)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 20,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 6,
    minWidth: 180,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '600',
    color: cloudDesign.textDark,
  },
});
