import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { cloudDesign } from '../../constants/cloudDesign';

export interface CloudMetric {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  onPress?: () => void;
}

interface CloudMetricRowProps {
  metrics: CloudMetric[];
  /** Single strip inside a parent card — no per-metric boxes */
  embedded?: boolean;
}

export default function CloudMetricRow({ metrics, embedded = false }: CloudMetricRowProps) {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark' || theme.colors.background === '#0B1A2B';

  const textPrimary = isDark ? theme.colors.text : cloudDesign.textDark;
  const textMuted = isDark ? theme.colors.textSecondary : cloudDesign.textMuted;
  const iconColor = isDark ? theme.colors.primary : '#121212';

  if (embedded) {
    const stripBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.55)';
    const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0, 0, 0, 0.04)';
    const stripBorder = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.90)';

    return (
      <View
        style={[
          styles.embeddedStrip,
          { backgroundColor: stripBg, borderColor: stripBorder },
        ]}
      >
        {metrics.map((m, index) => {
          const cell = (
            <View style={styles.embeddedCell}>
              <Ionicons name={m.icon} size={20} color={iconColor} style={styles.icon} />
              <Text style={[styles.val, { color: textPrimary }]}>{m.value}</Text>
              <Text style={[styles.lbl, { color: textMuted }]}>{m.label}</Text>
            </View>
          );
          const wrapped = m.onPress ? (
            <Pressable key={m.label} style={styles.flex} onPress={m.onPress}>
              {cell}
            </Pressable>
          ) : (
            <View key={m.label} style={styles.flex}>
              {cell}
            </View>
          );
          return (
            <React.Fragment key={m.label}>
              {index > 0 ? (
                <View style={[styles.vertDivider, { backgroundColor: dividerColor }]} />
              ) : null}
              {wrapped}
            </React.Fragment>
          );
        })}
      </View>
    );
  }

  const cardBg = isDark ? theme.colors.glassStrong : 'rgba(255, 255, 255, 0.55)';
  const cardBorder = isDark ? theme.colors.glassBorder : 'rgba(255, 255, 255, 0.90)';
  const shadowColor = isDark ? (theme.colors.glowBlue || theme.colors.primary) : 'rgba(0, 0, 0, 0.04)';

  return (
    <View style={styles.row}>
      {metrics.map((m) => {
        const Card = (
          <View
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
                shadowColor,
              },
              isDark ? styles.cardDark : cloudDesign.shadowCard,
            ]}
          >
            <Ionicons name={m.icon} size={22} color={iconColor} style={styles.icon} />
            <Text style={[styles.val, { color: textPrimary }]}>{m.value}</Text>
            <Text style={[styles.lbl, { color: textMuted }]}>{m.label}</Text>
          </View>
        );
        if (m.onPress) {
          return (
            <Pressable key={m.label} style={styles.flex} onPress={m.onPress}>
              {Card}
            </Pressable>
          );
        }
        return (
          <View key={m.label} style={styles.flex}>
            {Card}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  embeddedStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  embeddedCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  vertDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  flex: {
    flex: 1,
  },
  card: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cardDark: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },
  icon: {
    marginBottom: 4,
  },
  val: {
    fontSize: 15,
    fontWeight: '900',
  },
  lbl: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
});
