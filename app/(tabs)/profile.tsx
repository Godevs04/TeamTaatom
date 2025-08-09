import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
// import { NavBar } from '../../components/NavBar';
import NavBar from '../../components/NavBar';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getAuth } from 'firebase/auth';
import { theme } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface PostItem {
  postId: string;
  location?: { lat: number; lng: number };
  likes?: string[];
  placeName?: string;
}

export default function ProfileScreen() {
  const user = getAuth().currentUser;
  const uid = user?.uid;

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [followers, setFollowers] = useState<number>(0);
  const [following, setFollowing] = useState<number>(0);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'posts'), where('uid', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      const list: PostItem[] = [];
      snap.forEach((doc) => list.push({ postId: doc.id, ...(doc.data() as any) }));
      setPosts(list);
    });
    return unsub;
  }, [uid]);

  const totalLikes = useMemo(() => posts.reduce((acc, p) => acc + (p.likes?.length || 0), 0), [posts]);

  const globePoints = useMemo(() => {
    return posts
      .filter((p) => p.location)
      .map((p, i) => ({ id: p.postId, idx: i }));
  }, [posts]);

  return (
    <View style={styles.screen}>
      <NavBar title="Profile" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar} />
          </View>
          <Text style={styles.name}>{user?.email?.split('@')[0] || 'User'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{posts.length}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{totalLikes}</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Ionicons name="earth" size={18} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Your World</Text>
        </View>
        <View style={styles.globeWrapper}>
          <View style={styles.globe}>
            {globePoints.length === 0 ? (
              <Text style={styles.emptyWorld}>No locations yet</Text>
            ) : (
              globePoints.map((p) => {
                const angle = (p.idx / globePoints.length) * Math.PI * 2;
                const radius = 90;
                const left = 110 + Math.cos(angle) * radius;
                const top = 110 + Math.sin(angle) * radius;
                return <View key={p.id} style={[styles.dot, { left, top }]} />;
              })
            )}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Ionicons name="images" size={18} color={theme.colors.secondary} />
          <Text style={styles.sectionTitle}>Recent Posts</Text>
        </View>
        {posts.slice(0, 5).map((p) => (
          <View key={p.postId} style={styles.postCard}>
            <Text style={styles.postTitle}>{p.placeName || 'Unknown place'}</Text>
            <Text style={styles.postMeta}>{(p.likes?.length || 0)} likes</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.spacing.md, marginTop: 0 },

  headerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.secondary,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  name: { color: theme.colors.text, fontSize: 20, fontWeight: '700', marginTop: theme.spacing.sm },
  email: { color: theme.colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.secondary,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  statNum: { color: theme.colors.primary, fontSize: 18, fontWeight: '700' },
  statLabel: { color: theme.colors.textSecondary, marginTop: 2 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.sm },
  sectionTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },

  globeWrapper: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  globe: {
    width: 240,
    height: 240,
    alignSelf: 'center',
    borderRadius: 120,
    backgroundColor: theme.colors.surfaceSecondary,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.secondary,
  },
  emptyWorld: { color: theme.colors.textSecondary },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.error },

  postCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  postTitle: { color: theme.colors.text, fontWeight: '600' },
  postMeta: { color: theme.colors.textSecondary, marginTop: 4 },
});
