import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { ErrorBoundary } from '../../utils/errorBoundary';
import Shorts from '../(tabs)/shorts';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';

export default function SavedShortsScreen() {
  const { shortId } = useLocalSearchParams();
  const { theme } = useTheme();
  const router = useRouter();
  const [isMuted, setIsMuted] = useState(false);

  const sid = typeof shortId === 'string' ? shortId : Array.isArray(shortId) ? shortId[0] : undefined;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
      ...(isWeb && {
        maxWidth: isTablet ? 600 : 500,
        alignSelf: 'center',
        width: '100%',
      } as object),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: '#000000',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
      zIndex: 10,
    },
    backButton: {
      padding: theme.spacing.xs,
      marginRight: theme.spacing.sm,
    },
    headerTitle: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: '600',
      color: '#ffffff',
      flex: 1,
    },
    muteButton: {
      padding: theme.spacing.xs,
      marginLeft: theme.spacing.sm,
    },
    shortsFlex: {
      flex: 1,
    },
  });

  return (
    <ErrorBoundary level="route">
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Saved Shorts
          </Text>
          <TouchableOpacity
            style={styles.muteButton}
            onPress={() => setIsMuted(prev => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <View style={styles.shortsFlex}>
          <Shorts 
            isSavedShorts={true} 
            initialShortId={sid} 
            isMuted={isMuted}
            onMuteToggle={() => setIsMuted(prev => !prev)}
          />
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}
