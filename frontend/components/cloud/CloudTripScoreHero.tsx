import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { cloudDesign } from '../../constants/cloudDesign';

interface CloudTripScoreHeroProps {
  score: number;
  subtitle?: string;
  onPress?: () => void;
}

export default function CloudTripScoreHero({ score, subtitle, onPress }: CloudTripScoreHeroProps) {
  const content = (
    <LinearGradient
      colors={['#1C73B4', '#50C878']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, cloudDesign.shadowFloat]}
    >
      <View>
        <Text style={styles.label}>TRIPSCORE</Text>
        <Text style={styles.score}>{score}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${Math.min(100, Math.max(8, score * 8))}%` }]} />
        </View>
      </View>
      <Ionicons name="compass" size={44} color="rgba(255,255,255,0.9)" />
    </LinearGradient>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.wrap}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.wrap}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 14,
  },
  card: {
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
  },
  score: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 36,
  },
  sub: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  barBg: {
    marginTop: 10,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 140,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
