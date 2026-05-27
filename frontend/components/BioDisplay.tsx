import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface BioDisplayProps {
  bio: string;
  maxLines?: number;
  fontSize?: number;
  leftAlign?: boolean;
}

export default function BioDisplay({ bio, maxLines = 2, fontSize, leftAlign = false }: BioDisplayProps) {
  const { theme } = useTheme();
  const [showFullBio, setShowFullBio] = useState(false);

  if (!bio || bio.trim() === '') {
    return null;
  }

  // Split bio into lines
  const bioLines = bio.split('\n').filter(line => line.trim() !== '');
  
  if (bioLines.length <= maxLines) {
    // Show full bio if it's within the limit
    return (
      <View style={styles.container}>
        <Text style={[
          styles.bioText, 
          { color: theme.colors.textSecondary, textAlign: leftAlign ? 'left' : 'center' }, 
          fontSize ? { fontSize, lineHeight: fontSize * 1.4 } : null
        ]}>
          {bio}
        </Text>
      </View>
    );
  }

  // Show truncated bio with "more" option
  const truncatedBio = bioLines.slice(0, maxLines).join('\n');
  const remainingLines = bioLines.slice(maxLines);

  return (
    <View style={styles.container}>
      <Text style={[
        styles.bioText, 
        { color: theme.colors.textSecondary, textAlign: leftAlign ? 'left' : 'center' }, 
        fontSize ? { fontSize, lineHeight: fontSize * 1.4 } : null
      ]}>
        {showFullBio ? bio : truncatedBio}
      </Text>
      
      {bioLines.length > maxLines && (
        <TouchableOpacity 
          onPress={() => setShowFullBio(!showFullBio)}
          style={[styles.moreButton, leftAlign && { alignSelf: 'flex-start' }]}
        >
          <Text style={[styles.moreText, { color: theme.colors.textSecondary }]}>
            {showFullBio ? 'Show less' : `Show more (${remainingLines.length} more line${remainingLines.length > 1 ? 's' : ''})`}
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
