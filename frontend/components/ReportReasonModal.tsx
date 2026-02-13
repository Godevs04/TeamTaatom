/**
 * Report Reason Modal - Apple Guideline 1.2 UGC
 * Reason options: Spam, Abuse, Inappropriate Content, Harassment, Other
 */
import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam', type: 'spam' as const },
  { id: 'abuse', label: 'Abuse', type: 'abuse' as const },
  { id: 'inappropriate_content', label: 'Inappropriate Content', type: 'inappropriate_content' as const },
  { id: 'harassment', label: 'Harassment', type: 'harassment' as const },
  { id: 'other', label: 'Other', type: 'other' as const },
] as const;

export type ReportReasonType = (typeof REPORT_REASONS)[number]['type'];

interface ReportReasonModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (reason: ReportReasonType) => void;
  title?: string;
}

export default function ReportReasonModal({ visible, onClose, onSelect, title = 'Report' }: ReportReasonModalProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]} onStartShouldSetResponder={() => true}>
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Choose a reason for your report
          </Text>
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              style={[styles.reasonRow, { borderBottomColor: theme.colors.border }]}
              onPress={() => {
                onSelect(reason.type);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.reasonText, { color: theme.colors.text }]}>{reason.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '600' },
  subtitle: { fontSize: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  reasonText: { fontSize: 16 },
});
