import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { cloudDesign } from '../../constants/cloudDesign';

interface CloudInputDockProps {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onAttach?: () => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  bottomInset?: number;
  /** Allow send when attachments are staged without text */
  canSend?: boolean;
}

export default function CloudInputDock({
  value,
  onChangeText,
  onSend,
  onAttach,
  placeholder = 'Message…',
  style,
  bottomInset = 12,
  canSend: canSendProp,
}: CloudInputDockProps) {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';
  const canSend = canSendProp ?? Boolean(value.trim());

  return (
    <View style={[styles.outer, { paddingBottom: bottomInset }, style]}>
      <View
        style={[
          styles.dock,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0, 0, 0, 0.08)',
          },
          cloudDesign.shadowCard,
        ]}
      >
        {onAttach && (
          <TouchableOpacity onPress={onAttach} activeOpacity={0.8}>
            <LinearGradient colors={cloudDesign.buttonGradient} style={styles.attach}>
              <Ionicons name="add" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
        <TextInput
          style={[
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0, 0, 0, 0.03)',
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={isDark ? theme.colors.textSecondary : cloudDesign.textMuted}
          value={value}
          onChangeText={onChangeText}
          multiline
        />
        <TouchableOpacity onPress={onSend} disabled={!canSend} style={{ opacity: canSend ? 1 : 0.45 }}>
          <LinearGradient colors={cloudDesign.buttonGradient} style={styles.send}>
            <Ionicons name="send" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    borderRadius: cloudDesign.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attach: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.16)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
