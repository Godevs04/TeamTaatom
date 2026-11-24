import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { getUserFromStorage } from '../../services/auth';
import {
  demoteGroupAdmin,
  getRoomMuteStatus,
  leaveGroupChat,
  promoteGroupAdmin,
  removeGroupMember,
  toggleMuteRoom,
  updateGroupSendPermission,
  type GroupSendPermission,
} from '../../services/chat';
import { updateConnectPage } from '../../services/connect';
import api from '../../services/api';
import logger from '../../utils/logger';
import { optimizeCloudinaryUrl } from '../../utils/imageCache';
import { sanitizeErrorForDisplay } from '../../utils/errorSanitizer';
import ThreeDotMenu from '../../components/ThreeDotMenu';

type GroupRole = 'owner' | 'admin' | 'member' | 'pending_admin';

type Participant = {
  _id: string;
  fullName?: string;
  username?: string;
  profilePic?: string;
  groupRole?: GroupRole;
};

type GroupChat = {
  _id: string;
  participants: Participant[];
  myGroupRole?: GroupRole;
  sendPermission?: GroupSendPermission;
  canSendMessages?: boolean;
  connectPageId?: {
    _id: string;
    name?: string;
    profileImage?: string;
    bio?: string;
  } | null;
};

const SEND_PERMISSION_OPTIONS: {
  value: GroupSendPermission;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'everyone',
    label: 'Everyone',
    hint: 'All members can send messages',
    icon: 'people-outline',
  },
  {
    value: 'admins',
    label: 'Only admins',
    hint: 'Owner and admins can send messages',
    icon: 'shield-checkmark-outline',
  },
  {
    value: 'owner',
    label: 'Only owner',
    hint: 'Only the page owner can send messages',
    icon: 'person-outline',
  },
];

const ROLE_LABEL: Record<GroupRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  pending_admin: 'Pending',
  member: 'Member',
};

const ROLE_ORDER: Record<GroupRole, number> = {
  owner: 0,
  admin: 1,
  pending_admin: 2,
  member: 3,
};

export default function GroupInfoScreen() {
  const { theme, mode } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ chatId?: string }>();
  const chatId = typeof params.chatId === 'string' ? params.chatId : '';

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chat, setChat] = useState<GroupChat | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);

  const myRole: GroupRole = chat?.myGroupRole || 'member';
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const sendPermission: GroupSendPermission = chat?.sendPermission || 'everyone';
  const page = chat?.connectPageId;
  const pageId = page?._id;

  const members = useMemo(() => {
    const list = (chat?.participants || []).filter((p) => p && p._id);
    return [...list].sort((a, b) => {
      const ra = ROLE_ORDER[(a.groupRole as GroupRole) || 'member'] ?? 3;
      const rb = ROLE_ORDER[(b.groupRole as GroupRole) || 'member'] ?? 3;
      if (ra !== rb) return ra - rb;
      return (a.fullName || '').localeCompare(b.fullName || '');
    });
  }, [chat?.participants]);

  const load = useCallback(async () => {
    if (!chatId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [user, chatRes, muteRes] = await Promise.all([
        getUserFromStorage(),
        api.get(`/chat/room/${chatId}`),
        getRoomMuteStatus(chatId).catch(() => ({ muted: false })),
      ]);
      if (user?._id) setMyUserId(user._id);
      const nextChat = chatRes.data?.chat as GroupChat;
      setChat(nextChat || null);
      setNameDraft(nextChat?.connectPageId?.name || '');
      setIsMuted(!!muteRes?.muted);
    } catch (e: any) {
      logger.error('[GroupInfo] load failed', e);
      Alert.alert('Error', sanitizeErrorForDisplay(e, 'chat.groupInfo'));
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCommunity = () => {
    if (!pageId) return;
    router.push(`/connect/page/${pageId}`);
  };

  const openMemberProfile = (userId: string) => {
    if (!userId || userId === myUserId) return;
    router.push(`/profile/${userId}`);
  };

  const pickAndUploadAvatar = async () => {
    if (!isOwner || !pageId) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to change the group photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setAvatarBusy(true);
      await updateConnectPage(pageId, {
        profileImageFile: {
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg',
          name: asset.fileName || `group_${Date.now()}.jpg`,
        },
      });
      await load();
    } catch (e: any) {
      Alert.alert('Error', sanitizeErrorForDisplay(e, 'connect.updatePage'));
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveName = async () => {
    if (!isOwner || !pageId) return;
    const next = nameDraft.trim();
    if (!next || next.length < 2) {
      Alert.alert('Invalid name', 'Group name must be at least 2 characters.');
      return;
    }
    if (next === page?.name) {
      setEditingName(false);
      return;
    }
    try {
      setBusyId('name');
      await updateConnectPage(pageId, { name: next } as any);
      setEditingName(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', sanitizeErrorForDisplay(e, 'connect.updatePage'));
    } finally {
      setBusyId(null);
    }
  };

  const handlePromote = async (userId: string) => {
    try {
      setBusyId(userId);
      await promoteGroupAdmin(chatId, userId);
      await load();
    } catch (e: any) {
      Alert.alert('Error', sanitizeErrorForDisplay(e, 'chat.promoteAdmin'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDemote = async (userId: string) => {
    try {
      setBusyId(userId);
      await demoteGroupAdmin(chatId, userId);
      await load();
    } catch (e: any) {
      Alert.alert('Error', sanitizeErrorForDisplay(e, 'chat.demoteAdmin'));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = (member: Participant) => {
    const name = member.fullName || member.username || 'this member';
    Alert.alert(
      'Remove member',
      `Remove ${name} from the group? They will also unfollow this community.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusyId(member._id);
              await removeGroupMember(chatId, member._id);
              await load();
            } catch (e: any) {
              Alert.alert('Error', sanitizeErrorForDisplay(e, 'chat.removeMember'));
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave group',
      'You will leave this chat and unfollow the community. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusyId('leave');
              await leaveGroupChat(chatId);
              router.replace('/chat');
            } catch (e: any) {
              Alert.alert('Error', sanitizeErrorForDisplay(e, 'chat.leaveGroup'));
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const handleMuteToggle = async () => {
    try {
      setBusyId('mute');
      const result = await toggleMuteRoom(chatId);
      setIsMuted(!!result.muted);
    } catch (e: any) {
      Alert.alert('Error', sanitizeErrorForDisplay(e, 'chat.toggleMute'));
    } finally {
      setBusyId(null);
    }
  };

  const handleSendPermissionChange = async (next: GroupSendPermission) => {
    if (!isAdmin || next === sendPermission) return;
    try {
      setBusyId('sendPermission');
      const result = await updateGroupSendPermission(chatId, next);
      setChat((prev) =>
        prev
          ? {
              ...prev,
              sendPermission: result.sendPermission || next,
            }
          : prev
      );
    } catch (e: any) {
      Alert.alert('Error', sanitizeErrorForDisplay(e, 'chat.sendPermission'));
    } finally {
      setBusyId(null);
    }
  };

  const showMemberActions = (member: Participant) => {
    const role = (member.groupRole || 'member') as GroupRole;
    const isSelf = member._id === myUserId;
    if (isSelf) return;

    const options: { label: string; destructive?: boolean; onPress: () => void }[] = [
      { label: 'View profile', onPress: () => openMemberProfile(member._id) },
    ];

    if (isOwner && role === 'member') {
      options.push({ label: 'Make group admin', onPress: () => handlePromote(member._id) });
    }
    if (isOwner && (role === 'admin' || role === 'pending_admin')) {
      options.push({ label: 'Dismiss as admin', onPress: () => handleDemote(member._id) });
    }
    if (isAdmin && role !== 'owner') {
      if (!(myRole === 'admin' && (role === 'admin' || role === 'pending_admin'))) {
        options.push({
          label: 'Remove from group',
          destructive: true,
          onPress: () => handleRemove(member),
        });
      }
    }

    if (options.length === 1) {
      options[0].onPress();
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options.map((o) => o.label), 'Cancel'],
          destructiveButtonIndex: options.findIndex((o) => o.destructive),
          cancelButtonIndex: options.length,
        },
        (idx) => {
          if (idx >= 0 && idx < options.length) options[idx].onPress();
        }
      );
      return;
    }

    Alert.alert(
      member.fullName || 'Member',
      undefined,
      [
        ...options.map((o) => ({
          text: o.label,
          style: (o.destructive ? 'destructive' : 'default') as 'destructive' | 'default',
          onPress: o.onPress,
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const avatarUri = page?.profileImage
    ? optimizeCloudinaryUrl(page.profileImage, { width: 240, height: 240 })
    : undefined;

  const textPrimary = theme.colors.text;
  const textSecondary = theme.colors.textSecondary || (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)');
  const surface = theme.colors.surface || theme.colors.card || (isDark ? '#12263A' : '#FFFFFF');
  const border = theme.colors.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)');

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <LinearGradient
            colors={['#1C73B4', '#50C878']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: textPrimary }]} numberOfLines={1}>
          Group info
        </Text>
        <ThreeDotMenu
          iconName="ellipsis-vertical"
          iconColor={textPrimary}
          iconSize={20}
          items={[
            ...(pageId
              ? [
                  {
                    label: 'View community',
                    icon: 'globe-outline',
                    onPress: openCommunity,
                  },
                ]
              : []),
            {
              label: isMuted ? 'Unmute notifications' : 'Mute notifications',
              icon: isMuted ? 'notifications-outline' : 'notifications-off-outline',
              onPress: handleMuteToggle,
            },
            ...(!isOwner
              ? [
                  {
                    label: 'Leave group',
                    icon: 'exit-outline',
                    onPress: handleLeave,
                    destructive: true,
                  },
                ]
              : []),
          ]}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#1C73B4" />
        </View>
      ) : !chat ? (
        <View style={styles.centered}>
          <Text style={{ color: textSecondary }}>Group not found</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <TouchableOpacity
                activeOpacity={isOwner ? 0.75 : 1}
                disabled={!isOwner || avatarBusy}
                onPress={pickAndUploadAvatar}
                style={styles.avatarWrap}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: surface }]}>
                    <Ionicons name="people" size={48} color={textSecondary} />
                  </View>
                )}
                {isOwner ? (
                  <View style={styles.cameraBadge}>
                    {avatarBusy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="camera" size={16} color="#fff" />
                    )}
                  </View>
                ) : null}
              </TouchableOpacity>

              {editingName && isOwner ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    style={[
                      styles.nameInput,
                      {
                        color: textPrimary,
                        borderColor: border,
                        backgroundColor: surface,
                      },
                    ]}
                    autoFocus
                    maxLength={60}
                    placeholder="Group name"
                    placeholderTextColor={textSecondary}
                  />
                  <TouchableOpacity
                    onPress={saveName}
                    style={styles.nameSaveBtn}
                    disabled={busyId === 'name'}
                  >
                    {busyId === 'name' ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.nameSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEditingName(false); setNameDraft(page?.name || ''); }}>
                    <Text style={{ color: textSecondary, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  disabled={!isOwner}
                  onPress={() => isOwner && setEditingName(true)}
                  style={styles.nameRow}
                >
                  <Text style={[styles.groupName, { color: textPrimary }]} numberOfLines={2}>
                    {page?.name || 'Group'}
                  </Text>
                  {isOwner ? (
                    <Ionicons name="pencil" size={16} color={textSecondary} style={{ marginLeft: 8 }} />
                  ) : null}
                </TouchableOpacity>
              )}

              <Text style={[styles.memberCount, { color: textSecondary }]}>
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </Text>

              <View style={[styles.quickActions, { backgroundColor: surface, borderColor: border }]}>
                <TouchableOpacity style={styles.quickAction} onPress={handleMuteToggle} disabled={busyId === 'mute'}>
                  <Ionicons
                    name={isMuted ? 'notifications-off-outline' : 'notifications-outline'}
                    size={22}
                    color="#1C73B4"
                  />
                  <Text style={[styles.quickActionLabel, { color: textPrimary }]}>
                    {isMuted ? 'Unmute' : 'Mute'}
                  </Text>
                </TouchableOpacity>
                {pageId ? (
                  <TouchableOpacity style={styles.quickAction} onPress={openCommunity}>
                    <Ionicons name="globe-outline" size={22} color="#1C73B4" />
                    <Text style={[styles.quickActionLabel, { color: textPrimary }]}>Community</Text>
                  </TouchableOpacity>
                ) : null}
                {!isOwner ? (
                  <TouchableOpacity style={styles.quickAction} onPress={handleLeave} disabled={busyId === 'leave'}>
                    <Ionicons name="exit-outline" size={22} color="#E53935" />
                    <Text style={[styles.quickActionLabel, { color: '#E53935' }]}>Leave</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={[styles.settingsCard, { backgroundColor: surface, borderColor: border }]}>
                <Text style={[styles.settingsTitle, { color: textPrimary }]}>Who can send messages</Text>
                <Text style={[styles.settingsHint, { color: textSecondary }]}>
                  {isAdmin
                    ? 'Choose who is allowed to post in this group chat'
                    : sendPermission === 'owner'
                      ? 'Only the owner can send messages'
                      : sendPermission === 'admins'
                        ? 'Only admins can send messages'
                        : 'Everyone can send messages'}
                </Text>
                {SEND_PERMISSION_OPTIONS.map((opt) => {
                  const selected = sendPermission === opt.value;
                  const locked = !isAdmin;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.permRow,
                        {
                          borderColor: selected ? '#1C73B4' : border,
                          backgroundColor: selected
                            ? isDark
                              ? 'rgba(28,115,180,0.16)'
                              : 'rgba(28,115,180,0.08)'
                            : 'transparent',
                          opacity: locked ? 0.75 : 1,
                        },
                      ]}
                      disabled={locked || busyId === 'sendPermission'}
                      onPress={() => handleSendPermissionChange(opt.value)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.permIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                        <Ionicons name={opt.icon} size={18} color={selected ? '#1C73B4' : textSecondary} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.permLabel, { color: textPrimary }]}>{opt.label}</Text>
                        <Text style={[styles.permHint, { color: textSecondary }]} numberOfLines={2}>
                          {opt.hint}
                        </Text>
                      </View>
                      {busyId === 'sendPermission' && selected ? (
                        <ActivityIndicator size="small" color="#1C73B4" />
                      ) : (
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={selected ? '#1C73B4' : textSecondary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { color: textSecondary }]}>
                {members.length} members
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const role = (item.groupRole || 'member') as GroupRole;
            const pic = item.profilePic
              ? optimizeCloudinaryUrl(item.profilePic, { width: 96, height: 96 })
              : undefined;
            const isSelf = item._id === myUserId;
            const canAct = !isSelf && (isAdmin || true);
            return (
              <TouchableOpacity
                style={[styles.memberRow, { borderBottomColor: border }]}
                onPress={() => (canAct ? showMemberActions(item) : undefined)}
                activeOpacity={isSelf ? 1 : 0.7}
                disabled={busyId === item._id}
              >
                {pic ? (
                  <Image source={{ uri: pic }} style={styles.memberAvatar} />
                ) : (
                  <View style={[styles.memberAvatar, styles.avatarFallback, { backgroundColor: surface }]}>
                    <Ionicons name="person" size={20} color={textSecondary} />
                  </View>
                )}
                <View style={styles.memberMeta}>
                  <Text style={[styles.memberName, { color: textPrimary }]} numberOfLines={1}>
                    {item.fullName || item.username || 'Member'}
                    {isSelf ? ' (You)' : ''}
                  </Text>
                  {item.username ? (
                    <Text style={[styles.memberUser, { color: textSecondary }]} numberOfLines={1}>
                      @{item.username}
                    </Text>
                  ) : null}
                </View>
                {role !== 'member' ? (
                  <View
                    style={[
                      styles.roleChip,
                      role === 'owner'
                        ? styles.roleOwner
                        : role === 'pending_admin'
                          ? styles.rolePending
                          : styles.roleAdmin,
                    ]}
                  >
                    <Text style={styles.roleChipText}>{ROLE_LABEL[role]}</Text>
                  </View>
                ) : null}
                {busyId === item._id ? (
                  <ActivityIndicator size="small" color="#1C73B4" style={{ marginLeft: 8 }} />
                ) : !isSelf && isAdmin ? (
                  <Ionicons name="ellipsis-horizontal" size={18} color={textSecondary} style={{ marginLeft: 6 }} />
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            !isOwner ? (
              <TouchableOpacity
                style={[styles.leaveRow, { backgroundColor: isDark ? 'rgba(229,57,53,0.12)' : 'rgba(229,57,53,0.08)' }]}
                onPress={handleLeave}
                disabled={busyId === 'leave'}
              >
                <Ionicons name="exit-outline" size={20} color="#E53935" />
                <Text style={styles.leaveText}>Leave group</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  topTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBlock: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C73B4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  groupName: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  nameEditRow: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
  },
  nameInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: '600',
  },
  nameSaveBtn: {
    backgroundColor: '#1C73B4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 88,
    alignItems: 'center',
  },
  nameSaveText: {
    color: '#fff',
    fontWeight: '700',
  },
  memberCount: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    marginTop: 18,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    width: '100%',
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  settingsCard: {
    width: '100%',
    marginTop: 18,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  settingsHint: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  permIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  permHint: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    marginTop: 22,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  memberMeta: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 15, fontWeight: '700' },
  memberUser: { fontSize: 12, marginTop: 2 },
  roleChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  roleOwner: { backgroundColor: 'rgba(255,149,0,0.18)' },
  roleAdmin: { backgroundColor: 'rgba(28,115,180,0.16)' },
  rolePending: { backgroundColor: 'rgba(120,120,120,0.18)' },
  roleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1C73B4',
  },
  leaveRow: {
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  leaveText: {
    color: '#E53935',
    fontWeight: '700',
    fontSize: 15,
  },
});
