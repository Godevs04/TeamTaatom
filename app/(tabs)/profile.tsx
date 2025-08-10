import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Alert, Image, TextInput } from 'react-native';
// import { NavBar } from '../../components/NavBar';
import NavBar from '../../components/NavBar';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getAuth } from 'firebase/auth';
import { getDoc, doc, updateDoc } from 'firebase/firestore';
import { useTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { signOutUser } from '../../services/auth';
import { useRouter } from 'expo-router';

interface PostItem {
  postId: string;
  location?: { lat: number; lng: number };
  likes?: string[];
  placeName?: string;
}

export default function ProfileScreen() {
  const user = getAuth().currentUser;
  const uid = user?.uid;
  const [avatar, setAvatar] = useState<string | null>(null);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const { theme, mode, toggleTheme } = useTheme();

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [followers, setFollowers] = useState<number>(0);
  const [following, setFollowing] = useState<number>(0);

  useEffect(() => {
    if (!uid) return;
    // Fetch posts
    const q = query(collection(db, 'posts'), where('uid', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      const list: PostItem[] = [];
      snap.forEach((doc) => list.push({ postId: doc.id, ...(doc.data() as any) }));
      setPosts(list);
    });
    // Fetch user data (avatar, gender, followers, following)
    (async () => {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.profilePic) setAvatar(data.profilePic);
        if (data.gender === 'female' || data.gender === 'male') setGender(data.gender);
        setFollowers(typeof data.followers === 'number' ? data.followers : 0);
        setFollowing(typeof data.following === 'number' ? data.following : 0);
        setFullName(data.fullName || '');
        setEmail(data.email || '');
      }
    })();
    return unsub;
  }, [uid]);

  const totalLikes = useMemo(() => posts.reduce((acc, p) => acc + (p.likes?.length || 0), 0), [posts]);

  const globePoints = useMemo(() => {
    return posts
      .filter((p) => p.location)
      .map((p, i) => ({ id: p.postId, idx: i }));
  }, [posts]);

  // Handler for sign out
  const handleSignOut = async () => {
    setMenuVisible(false);
    try {
      await signOutUser();
      router.replace('/(auth)/signin');
    } catch (e) {
      Alert.alert('Sign Out Failed', 'An error occurred while signing out.');
    }
  };

  // Three-dot menu button
  const menuButton = (
    <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={10}>
      <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <NavBar title="Profile" rightComponent={menuButton} />
      {/* Edit Profile Modal */}
      <Modal
        visible={editModal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.18)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: theme.colors.surface, borderRadius: 16, padding: 24, width: '85%' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text, marginBottom: 18 }}>Edit Profile</Text>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 6 }}>Full Name</Text>
            <View style={{ backgroundColor: theme.colors.surfaceSecondary, borderRadius: 8, marginBottom: 12 }}>
              <TextInput
                style={{ color: theme.colors.text, fontSize: 16, padding: 10 }}
                value={editName}
                onChangeText={setEditName}
                placeholder="Full Name"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="words"
              />
            </View>
            <Text style={{ color: theme.colors.textSecondary, marginBottom: 6 }}>Email</Text>
            <View style={{ backgroundColor: theme.colors.surfaceSecondary, borderRadius: 8, marginBottom: 18 }}>
              <TextInput
                style={{ color: theme.colors.text, fontSize: 16, padding: 10 }}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="Email"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setEditModal(false)} style={{ padding: 10 }}>
                <Text style={{ color: theme.colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setSaving(true);
                  try {
                    if (!uid) return;
                    const userRef = doc(db, 'users', uid);
                    await updateDoc(userRef, { fullName: editName, email: editEmail });
                    setFullName(editName);
                    setEmail(editEmail);
                    setEditModal(false);
                  } catch (e) {
                    Alert.alert('Error', 'Failed to update profile.');
                  } finally {
                    setSaving(false);
                  }
                }}
                style={{ backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 }}
                disabled={saving}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[
            styles.menuContainer,
            { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow },
          ]}>
            <Pressable style={styles.menuItem} onPress={handleSignOut}>
              <Ionicons
                name="log-out-outline"
                size={18}
                color={mode === 'light' ? '#181A20' : theme.colors.error}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.menuText,
                  { color: mode === 'light' ? '#181A20' : theme.colors.error },
                ]}
              >
                Sign Out
              </Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={() => { toggleTheme(); setMenuVisible(false); }}>
              <Ionicons
                name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={mode === 'light' ? '#181A20' : theme.colors.primary}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.menuText,
                  { color: mode === 'light' ? '#181A20' : theme.colors.primary },
                ]}
              >
                Toggle Theme
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
      <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: theme.spacing.md, marginTop: 0 }}>
        {/* Edit Profile Button */}
        <TouchableOpacity
          style={{ alignSelf: 'flex-end', marginBottom: 10, backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 }}
          onPress={() => {
            setEditName(fullName);
            setEditEmail(email);
            setEditModal(true);
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Edit Profile</Text>
        </TouchableOpacity>
        {/* Profile Card */}
        <View style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          borderWidth: 1,
          borderColor: theme.colors.primary,
          padding: theme.spacing.lg,
          alignItems: 'center',
          marginBottom: theme.spacing.lg,
          ...theme.shadows.medium,
        }}>
          <View style={{
            width: 90,
            height: 90,
            borderRadius: 60,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surfaceSecondary,
            borderWidth: 2,
            borderColor: theme.colors.primary,
            overflow: 'hidden',
          }}>
            <Image
              source={
                avatar === 'avatars/male_avatar.png'
                  ? require('../../assets/avatars/male_avatar.png')
                  : avatar === 'avatars/female_avatar.png'
                  ? require('../../assets/avatars/female_avatar.png')
                  : require('../../assets/avatars/male_avatar.png')
              }
              style={{ width: 102, height: 122, borderRadius: 56 }}
              resizeMode="cover"
            />
              {gender && (
                <Text style={{ color: theme.colors.textSecondary, marginTop: 8, fontSize: 15, fontWeight: '600', position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center' }}>
                  {gender.charAt(0).toUpperCase() + gender.slice(1)}
                </Text>
              )}
          </View>
          <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '700', marginTop: theme.spacing.sm }}>{fullName || user?.email?.split('@')[0] || 'User'}</Text>
          <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>{email || user?.email}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: theme.spacing.lg }}>
          <View style={{
            flex: 1,
            backgroundColor: theme.colors.surfaceSecondary,
            borderRadius: theme.borderRadius.md,
            borderWidth: 1,
            borderColor: theme.colors.secondary,
            paddingVertical: theme.spacing.md,
            alignItems: 'center',
          }}>
            <Text style={{ color: theme.colors.primary, fontSize: 18, fontWeight: '700' }}>{posts.length}</Text>
            <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>Posts</Text>
          </View>
          <View style={{
            flex: 1,
            backgroundColor: theme.colors.surfaceSecondary,
            borderRadius: theme.borderRadius.md,
            borderWidth: 1,
            borderColor: theme.colors.secondary,
            paddingVertical: theme.spacing.md,
            alignItems: 'center',
          }}>
            <Text style={{ color: theme.colors.primary, fontSize: 18, fontWeight: '700' }}>{followers}</Text>
            <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>Followers</Text>
          </View>
          <View style={{
            flex: 1,
            backgroundColor: theme.colors.surfaceSecondary,
            borderRadius: theme.borderRadius.md,
            borderWidth: 1,
            borderColor: theme.colors.secondary,
            paddingVertical: theme.spacing.md,
            alignItems: 'center',
          }}>
            <Text style={{ color: theme.colors.primary, fontSize: 18, fontWeight: '700' }}>{following}</Text>
            <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>Following</Text>
          </View>
          <View style={{
            flex: 1,
            backgroundColor: theme.colors.surfaceSecondary,
            borderRadius: theme.borderRadius.md,
            borderWidth: 1,
            borderColor: theme.colors.secondary,
            paddingVertical: theme.spacing.md,
            alignItems: 'center',
          }}>
            <Text style={{ color: theme.colors.primary, fontSize: 18, fontWeight: '700' }}>{totalLikes}</Text>
            <Text style={{ color: theme.colors.textSecondary, marginTop: 2 }}>Likes</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.sm }}>
          <Ionicons name="earth" size={18} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>Your World</Text>
        </View>
        <View style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.lg,
        }}>
          <View style={{
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
          }}>
            {globePoints.length === 0 ? (
              <Text style={{ color: theme.colors.textSecondary }}>No locations yet</Text>
            ) : (
              globePoints.map((p) => {
                const angle = (p.idx / globePoints.length) * Math.PI * 2;
                const radius = 90;
                const left = 110 + Math.cos(angle) * radius;
                const top = 110 + Math.sin(angle) * radius;
                return <View key={p.id} style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.error, left, top }} />;
              })
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing.sm }}>
          <Ionicons name="images" size={18} color={theme.colors.secondary} />
          <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700' }}>Recent Posts</Text>
        </View>
        {posts.slice(0, 5).map((p) => (
          <View key={p.postId} style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.sm,
          }}>
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{p.placeName || 'Unknown place'}</Text>
            <Text style={{ color: theme.colors.textSecondary, marginTop: 4 }}>{(p.likes?.length || 0)} likes</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuContainer: {
    borderRadius: 10,
    marginTop: 60,
    marginRight: 18,
    paddingVertical: 8,
    minWidth: 160,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  menuText: {
    fontWeight: '600',
    fontSize: 16,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(120,120,120,0.12)',
    marginVertical: 2,
    marginHorizontal: 8,
  },
});
