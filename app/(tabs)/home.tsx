import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { onSnapshot, collection, orderBy, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { theme } from '../../constants/theme';

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
      <View style={styles.center}> 
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No photos found</Text>
        <Text style={styles.emptySubtitle}>Share your first photo from the Post tab.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.postId}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          {/* Lightweight preview without image component to avoid layout overhead here */}
          <Text style={styles.place}>{item.placeName || 'Unknown place'}</Text>
          <Text style={styles.comment}>{item.comment}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.h2.fontSize,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  emptySubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    textAlign: 'center',
  },
  list: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  place: {
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  comment: {
    color: theme.colors.text,
  },
});
