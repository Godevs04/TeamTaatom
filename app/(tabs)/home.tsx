import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { onSnapshot, collection, orderBy, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

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
        <View style={{ alignItems: 'center', marginBottom: theme.spacing.xl, width: '100%' }}>
          <View style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.xl,
            padding: theme.spacing.md,
            shadowColor: theme.colors.shadow,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 8,
            marginBottom: theme.spacing.lg,
            alignItems: 'center',
            width: 260,
            alignSelf: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <Image
              source={require('../../assets/images/home_post.png')}
              style={{ width: 180, height: 180, borderRadius: 32, opacity: 0.92 }}
              resizeMode="cover"
            />
            <View style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 0,
              borderBottomLeftRadius: 32,
              borderBottomRightRadius: 32,
              backgroundColor: theme.colors.background + 'E6', // more subtle fade overlay
              zIndex: 2,
            }} />
          </View>
          <Text style={{ color: theme.colors.text, fontSize: theme.typography.h2.fontSize, fontWeight: '800', marginBottom: theme.spacing.sm, textAlign: 'center', letterSpacing: 0.2 }}>
            No Posts Yet
          </Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize + 1, textAlign: 'center', marginBottom: theme.spacing.lg, lineHeight: 22, maxWidth: 280, alignSelf: 'center' }}>
            Share your first photo from the <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Post</Text> tab and inspire the community!
          </Text>
        </View>
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
