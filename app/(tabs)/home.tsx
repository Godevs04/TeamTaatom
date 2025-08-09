import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { onSnapshot, collection, orderBy, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useTheme } from '../../context/ThemeContext';

interface PostItem {
  postId: string;
  photoUrl: string;
  comment: string;
  placeName?: string;
  timestamp?: any;
  likes?: string[];
}

export default function HomeScreen() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: PostItem[] = [];
      snap.forEach((doc) => list.push({ postId: doc.id, ...(doc.data() as any) }));
      setPosts(list);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.text, fontSize: theme.typography.h2.fontSize, fontWeight: '700', marginBottom: theme.spacing.xs }}>No photos found</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize, textAlign: 'center' }}>Share your first photo from the Post tab.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.postId}
      contentContainerStyle={{ backgroundColor: theme.colors.background, padding: theme.spacing.md }}
      renderItem={({ item }) => (
        <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textSecondary, marginBottom: 4 }}>{item.placeName || 'Unknown place'}</Text>
          <Text style={{ color: theme.colors.text }}>{item.comment}</Text>
        </View>
      )}
    />
  );
}

// styles removed, now handled inline with theme context
