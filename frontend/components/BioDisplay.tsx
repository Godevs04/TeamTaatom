import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface BioDisplayProps {
  bio: string;
  maxLines?: number;
  fontSize?: number;
  leftAlign?: boolean;
}

export default function BioDisplay({ bio, maxLines = 3, fontSize, leftAlign = false }: BioDisplayProps) {
  const { theme } = useTheme();
  const [showFullBio, setShowFullBio] = useState(false);

  if (!bio || bio.trim() === '') {
    return null;
  }

  const isLongBio = bio.length > 120 || bio.split('\n').length > maxLines;

  return (
    <View style={styles.container}>
      <Text 
        style={[
          styles.bioText, 
          { color: theme.colors.textSecondary, textAlign: leftAlign ? 'left' : 'center' }, 
          fontSize ? { fontSize, lineHeight: fontSize * 1.4 } : null
        ]}
        numberOfLines={showFullBio ? undefined : (isLongBio ? maxLines : undefined)}
      >
        {bio}
      </Text>
      {isLongBio && (
        <TouchableOpacity 
          style={[styles.moreButton, leftAlign && { alignSelf: 'flex-start' }]} 
          onPress={() => setShowFullBio(!showFullBio)}
        >
          <Text style={[styles.moreText, { color: theme.colors.primary }]}>
            {showFullBio ? 'show less' : 'read more'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  moreButton: {
    marginTop: 4,
    alignSelf: 'center',
  },
  moreText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
