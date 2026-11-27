import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import DateTimeField from '../ui/DateTimeField';
import { getUserFromStorage } from '../../services/auth';
import { getUserPosts } from '../../services/posts';
import {
  AllowedEntryMedia,
  CommunityEvent,
  CommunityGroupChat,
  CommunityRole,
  createCommunityEvent,
  createEventTeam,
  createGroupChat,
  getCompetitionLeaderboard,
  inviteToGroupChat,
  joinGroupChat,
  listCommunityEvents,
  listGroupChats,
  listGroupJoinRequests,
  openEventHostDm,
  registerForCommunityEvent,
  leaveCommunityEvent,
  reviewGroupJoinRequest,
  revokeCommunityRole,
  searchCommunityMembers,
  upsertEventCompetition,
  updateCommunityEvent,
  assignCommunityRole,
  listCommunityRoles,
  submitCompetitionEntry,
  removeCompetitionSubmission,
  scoreCompetitionSubmission,
  publishCompetitionShowcase,
  getCompetitionShowcase,
  EventTemplateKey,
  LeaderboardRow,
} from '../../services/community';

const ALL_ENTRY_MEDIA: AllowedEntryMedia[] = ['post', 'short', 'long_video'];

const EVENT_TEMPLATES: Array<{
  key: EventTemplateKey;
  label: string;
  titleHint: string;
  media: AllowedEntryMedia[];
  mode: 'individual' | 'group' | 'both';
  rankBy: 'likes' | 'views';
}> = [
  {
    key: 'best_short',
    label: 'Best short',
    titleHint: 'Best Short Challenge',
    media: ['short'],
    mode: 'individual',
    rankBy: 'likes',
  },
  {
    key: 'photo_dump',
    label: 'Photo dump',
    titleHint: 'Photo Dump Challenge',
    media: ['post'],
    mode: 'individual',
    rankBy: 'likes',
  },
  {
    key: 'long_story',
    label: 'Long story',
    titleHint: 'Long Story Challenge',
    media: ['long_video'],
    mode: 'individual',
    rankBy: 'views',
  },
  {
    key: 'open_media',
    label: 'Open media',
    titleHint: 'Open Media Challenge',
    media: ['post', 'short', 'long_video'],
    mode: 'individual',
    rankBy: 'likes',
  },
  {
    key: 'team_challenge',
    label: 'Team challenge',
    titleHint: 'Team Challenge',
    media: ['post', 'short', 'long_video'],
    mode: 'group',
    rankBy: 'likes',
  },
];

function formatEventCountdown(startsAt: string | Date): string | null {
  const start = new Date(startsAt).getTime();
  if (!Number.isFinite(start)) return null;
  const diff = start - Date.now();
  if (diff <= 0) return 'Started';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `Starts in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Starts in ${hours}h`;
  const days = Math.round(hours / 24);
  return `Starts in ${days}d`;
}

function normalizeAllowedMedia(
  value?: string | string[] | null
): AllowedEntryMedia[] {
  if (value == null || value === '' || value === 'all' || value === 'both') {
    return [...ALL_ENTRY_MEDIA];
  }
  if (Array.isArray(value)) {
    if (
      value.length === 0 ||
      value.every((v) => v === 'both' || v === 'all' || v == null || v === '')
    ) {
      return [...ALL_ENTRY_MEDIA];
    }
    const set = new Set(
      value.filter((v): v is AllowedEntryMedia =>
        v === 'post' || v === 'short' || v === 'long_video'
      )
    );
    const resolved = ALL_ENTRY_MEDIA.filter((k) => set.has(k));
    return resolved.length ? resolved : [...ALL_ENTRY_MEDIA];
  }
  if (value === 'post' || value === 'short' || value === 'long_video') {
    return [value];
  }
  return [...ALL_ENTRY_MEDIA];
}

function postTypeToEntryKind(postType: string | undefined): AllowedEntryMedia {
  if (postType === 'short') return 'short';
  if (postType === 'long_video') return 'long_video';
  return 'post';
}

function postMatchesAllowedMedia(
  postType: string | undefined,
  allowed: AllowedEntryMedia[]
): boolean {
  const kinds = allowed.length ? allowed : ALL_ENTRY_MEDIA;
  return kinds.includes(postTypeToEntryKind(postType));
}

function mediaThumbUri(media: {
  thumbnailUrl?: string;
  imageUrl?: string;
  mediaUrl?: string;
  images?: Array<{ url?: string } | string>;
  post?: {
    thumbnailUrl?: string;
    imageUrl?: string;
    images?: Array<{ url?: string } | string>;
  } | null;
} | null | undefined): string {
  if (!media) return '';
  const nested = media.post;
  const pickImages = (images?: Array<{ url?: string } | string>) =>
    Array.isArray(images)
      ? typeof images[0] === 'string'
        ? images[0]
        : images[0]?.url || ''
      : '';
  return String(
    media.thumbnailUrl ||
      media.imageUrl ||
      pickImages(media.images) ||
      media.mediaUrl ||
      nested?.thumbnailUrl ||
      nested?.imageUrl ||
      pickImages(nested?.images) ||
      ''
  );
}

function friendlyCompetitionError(raw?: string): string {
  const msg = (raw || '').trim();
  const lower = msg.toLowerCase();
  if (!msg || lower === 'this action is not allowed' || lower === 'invalid operation') {
    return 'This competition is locked for new scores or entries. Open Manage event → turn submissions back on, or score before publishing winners.';
  }
  if (lower.includes('frozen') || lower.includes('showcase')) {
    return 'Winners were already published. You can still update judge scores — then publish the showcase again if ranks change.';
  }
  if (lower.includes('submissions are closed')) {
    return 'Submissions are closed. Hosts can reopen them under Manage event → Competition.';
  }
  if (lower.includes('not allowed for this event') || lower.includes('media type')) {
    return 'That content type isn’t allowed for this challenge. Pick a matching post, short, or video — or ask the host to update allowed media.';
  }
  if (lower.includes('already') && (lower.includes('submit') || lower.includes('entr'))) {
    return 'You already have an entry on the board. Remove it (or ask a host) before submitting a new one.';
  }
  if (lower.includes('permission') || lower.includes("don't have permission")) {
    return 'Only event hosts or assigned judges can score entries.';
  }
  return msg;
}

const MEDIA_KIND_LABEL: Record<AllowedEntryMedia, string> = {
  post: 'Posts',
  short: 'Shorts',
  long_video: 'Videos',
};

function formatAllowedMediaLabel(allowed: AllowedEntryMedia[]): string {
  if (allowed.length === ALL_ENTRY_MEDIA.length) return 'All';
  if (!allowed.length) return 'None';
  return allowed.map((k) => MEDIA_KIND_LABEL[k]).join(' · ');
}

function defaultEventStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 0, 0, 0);
  d.setSeconds(0, 0);
  return d;
}

type TabKey = 'chats' | 'events' | 'find';

type Props = {
  pageId: string;
  canManage: boolean;
  isMember: boolean;
  isCommunity: boolean;
};

type StaffRow = {
  userId: string;
  role: 'admin' | 'moderator';
  user?: { _id?: string; fullName?: string; username?: string } | null;
};

const PRIVACY_LABEL: Record<string, string> = {
  public: 'Open to members',
  request: 'Request to join',
  invite: 'Invite only',
};

const MODE_LABEL: Record<string, string> = {
  individual: 'Individual',
  group: 'Team',
  both: 'Individual or team',
};

function privacyIcon(privacy: string): keyof typeof Ionicons.glyphMap {
  if (privacy === 'invite') return 'lock-closed-outline';
  if (privacy === 'request') return 'shield-checkmark-outline';
  return 'globe-outline';
}

export default function CommunityHub({ pageId, canManage, isMember, isCommunity }: Props) {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('chats');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<CommunityRole>(canManage ? 'owner' : null);
  const canManageStaff = canManage || myRole === 'owner' || myRole === 'admin';
  const canModerate = canManageStaff || myRole === 'moderator';

  const [groupChats, setGroupChats] = useState<CommunityGroupChat[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [findQuery, setFindQuery] = useState('');

  const [createChatOpen, setCreateChatOpen] = useState(false);
  const [chatName, setChatName] = useState('');
  const [chatPrivacy, setChatPrivacy] = useState<'public' | 'request' | 'invite'>('public');
  const [chatProof, setChatProof] = useState(false);
  const [chatProofPrompt, setChatProofPrompt] = useState('');

  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventStarts, setEventStarts] = useState<Date>(defaultEventStart());
  const [eventEnds, setEventEnds] = useState<Date | null>(null);
  const [eventLocation, setEventLocation] = useState('');
  const [eventMaxParticipants, setEventMaxParticipants] = useState('');
  const [eventVisibility, setEventVisibility] = useState<'public' | 'members' | 'private'>('members');
  const [eventMode, setEventMode] = useState<'individual' | 'group' | 'both'>('individual');
  const [eventAllowedMedia, setEventAllowedMedia] = useState<AllowedEntryMedia[]>([...ALL_ENTRY_MEDIA]);
  const [eventTemplateKey, setEventTemplateKey] = useState<EventTemplateKey | null>(null);
  const [eventRegistrationOpen, setEventRegistrationOpen] = useState(true);
  const [showcaseByEvent, setShowcaseByEvent] = useState<
    Record<string, NonNullable<CommunityEvent['competition']>['showcase']>
  >({});

  const [eventDetailId, setEventDetailId] = useState<string | null>(null);
  const [manageEventId, setManageEventId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [myContent, setMyContent] = useState<any[]>([]);
  const [myContentLoading, setMyContentLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [competitionFeedback, setCompetitionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [manageFeedback, setManageFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [competitionSubmitting, setCompetitionSubmitting] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [requestsGroupId, setRequestsGroupId] = useState<string | null>(null);
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteCandidates, setInviteCandidates] = useState<any[]>([]);
  const [teamEventId, setTeamEventId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('My Team');
  const [teamSize, setTeamSize] = useState('2');
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamCandidates, setTeamCandidates] = useState<any[]>([]);

  const surface = isDark ? 'rgba(22, 28, 38, 0.92)' : 'rgba(255, 255, 255, 0.92)';
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15, 23, 42, 0.08)';
  const muted = theme.colors.textSecondary;
  const ink = theme.colors.text;
  const accent = theme.colors.primary;

  const loadTab = useCallback(async () => {
    if (!isCommunity) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'chats') {
        const res = await listGroupChats(pageId);
        setGroupChats(res.groupChats || []);
      } else if (tab === 'events') {
        const res = await listCommunityEvents(pageId);
        setEvents(res.events || []);
      } else {
        const res = await searchCommunityMembers(pageId, findQuery.trim());
        setMembers(res.members || []);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [isCommunity, pageId, tab, findQuery]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  const refreshRoles = useCallback(async () => {
    if (!isCommunity) return;
    try {
      const res = await listCommunityRoles(pageId);
      setMyRole((res.myRole as CommunityRole) || (canManage ? 'owner' : null));
      setStaff(
        (res.staff || []).map((s: any) => ({
          userId: String(s.userId?._id || s.userId),
          role: s.role,
          user: s.user,
        }))
      );
    } catch {
      /* keep prior role */
    }
  }, [isCommunity, pageId, canManage]);

  useEffect(() => {
    void refreshRoles();
  }, [refreshRoles]);

  if (!isCommunity) return null;

  const tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'chats', label: 'Chats', icon: 'chatbubbles-outline' },
    { key: 'events', label: 'Events', icon: 'calendar-outline' },
    { key: 'find', label: 'Find', icon: 'people-outline' },
  ];

  const openChat = (chatId: string) => {
    router.push(`/chat/thread?chatId=${chatId}` as any);
  };

  const handleJoinChat = async (g: CommunityGroupChat) => {
    try {
      setLoading(true);
      const res: any = await joinGroupChat(g._id, {
        proofText: g.requireJoinProof ? 'Membership proof provided' : '',
      });
      if (res?.groupChat?.chatId) openChat(res.groupChat.chatId);
      else if (g.chatId && res?.groupChat?.isMember !== false && !res?.joinRequestPending) {
        openChat(g.chatId);
      }
      await loadTab();
    } catch (e: any) {
      setError(e?.message || 'Failed to join');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChat = async () => {
    if (!chatName.trim()) return;
    try {
      setLoading(true);
      await createGroupChat(pageId, {
        name: chatName.trim(),
        privacy: chatPrivacy,
        requireJoinProof: chatPrivacy === 'request' ? chatProof : false,
        proofPrompt: chatProofPrompt,
      });
      setCreateChatOpen(false);
      setChatName('');
      await loadTab();
    } catch (e: any) {
      setError(e?.message || 'Failed to create chat');
    } finally {
      setLoading(false);
    }
  };

  const resetEventForm = () => {
    setEditingEventId(null);
    setEventTitle('');
    setEventDescription('');
    setEventStarts(defaultEventStart());
    setEventEnds(null);
    setEventLocation('');
    setEventMaxParticipants('');
    setEventVisibility('members');
    setEventMode('individual');
    setEventAllowedMedia([...ALL_ENTRY_MEDIA]);
    setEventTemplateKey(null);
    setEventRegistrationOpen(true);
  };

  const openCreateEvent = () => {
    resetEventForm();
    setCreateEventOpen(true);
  };

  const openEditEvent = (ev: CommunityEvent) => {
    setEditingEventId(ev._id);
    setEventTitle(ev.title || '');
    setEventDescription(ev.description || '');
    setEventStarts(ev.startsAt ? new Date(ev.startsAt) : defaultEventStart());
    setEventEnds(ev.endsAt ? new Date(ev.endsAt) : null);
    setEventLocation(ev.location?.address || '');
    setEventMaxParticipants(ev.maxParticipants != null ? String(ev.maxParticipants) : '');
    setEventVisibility((ev.visibility as 'public' | 'members' | 'private') || 'members');
    setEventMode(ev.participationMode || 'individual');
    setEventAllowedMedia(
      normalizeAllowedMedia(ev.competition?.allowedMedia || ev.allowedEntryMedia)
    );
    setEventTemplateKey((ev.templateKey as EventTemplateKey) || null);
    setEventRegistrationOpen(ev.registrationOpen !== false);
    setCreateEventOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!eventTitle.trim() || !eventStarts || Number.isNaN(eventStarts.getTime())) {
      setError('Pick a start date and time');
      return;
    }
    if (eventAllowedMedia.length === 0) {
      setError('Select at least one allowed entry type');
      return;
    }
    try {
      setLoading(true);
      if (eventEnds && eventEnds.getTime() < eventStarts.getTime()) {
        setError('End time must be after the start time');
        return;
      }
      const payload: Record<string, unknown> = {
        title: eventTitle.trim(),
        description: eventDescription.trim(),
        startsAt: eventStarts.toISOString(),
        endsAt: eventEnds ? eventEnds.toISOString() : null,
        location: { address: eventLocation.trim() },
        maxParticipants: eventMaxParticipants.trim()
          ? Number(eventMaxParticipants.trim())
          : null,
        visibility: eventVisibility,
        participationMode: eventMode,
        allowedEntryMedia: eventAllowedMedia,
        templateKey: eventTemplateKey,
        registrationOpen: eventRegistrationOpen,
      };
      let createdId = editingEventId;
      if (editingEventId) {
        await updateCommunityEvent(editingEventId, payload);
      } else {
        const created = await createCommunityEvent(pageId, payload);
        createdId = created?.event?._id || null;
        // Auto-enable competition for challenge templates
        if (createdId && eventTemplateKey) {
          const tpl = EVENT_TEMPLATES.find((t) => t.key === eventTemplateKey);
          try {
            await upsertEventCompetition(createdId, {
              enabled: true,
              rankBy: tpl?.rankBy || 'likes',
              rankMode: 'engagement',
              allowedMedia: eventAllowedMedia,
              submissionsOpen: true,
              rulesText: `Challenge: ${tpl?.label || 'Open'}. Allowed: ${formatAllowedMediaLabel(eventAllowedMedia)}.`,
            });
          } catch {
            /* non-fatal — host can enable later */
          }
        }
      }
      setCreateEventOpen(false);
      resetEventForm();
      await loadTab();
    } catch (e: any) {
      setError(e?.message || (editingEventId ? 'Failed to update event' : 'Failed to create event'));
    } finally {
      setLoading(false);
    }
  };

  const loadMyContentForCompetition = useCallback(async () => {
    setMyContentLoading(true);
    try {
      const user = await getUserFromStorage();
      if (!user?._id) {
        setMyContent([]);
        return;
      }
      const res: any = await getUserPosts(String(user._id), 1, 40);
      const posts = res?.posts || res?.data?.posts || [];
      setMyContent(Array.isArray(posts) ? posts : []);
    } catch {
      setMyContent([]);
    } finally {
      setMyContentLoading(false);
    }
  }, []);

  const refreshCompetitionBoard = useCallback(async (eventId: string) => {
    try {
      const res = await getCompetitionLeaderboard(eventId);
      setLeaderboard(res.leaderboard || []);
    } catch {
      setLeaderboard([]);
    }
  }, []);

  const openEventCompetition = async (eventId: string) => {
    setEventDetailId(eventId);
    setSelectedPostId(null);
    setCompetitionFeedback(null);
    setCompetitionSubmitting(false);
    setManageEventId(null);
    await refreshCompetitionBoard(eventId);
    void loadMyContentForCompetition();
    try {
      const res = await getCompetitionShowcase(eventId);
      setShowcaseByEvent((prev) => ({ ...prev, [eventId]: res.showcase }));
    } catch {
      /* no showcase yet */
    }
  };

  const manageEvent = events.find((e) => e._id === manageEventId) || null;

  const enableCompetition = async (
    eventId: string,
    rankBy: 'likes' | 'views',
    rankMode: 'engagement' | 'judges' | 'hybrid' = 'engagement'
  ) => {
    try {
      const ev = events.find((e) => e._id === eventId);
      const allowedMedia = normalizeAllowedMedia(
        ev?.allowedEntryMedia || ev?.competition?.allowedMedia
      );
      await upsertEventCompetition(eventId, {
        enabled: true,
        rankBy,
        rankMode,
        judgeWeight: 50,
        allowedMedia,
        submissionsOpen: true,
        rulesText: `Ranked by ${rankBy} (${rankMode}). Allowed: ${formatAllowedMediaLabel(allowedMedia)}.`,
      });
      setManageEventId(null);
      await loadTab();
      await openEventCompetition(eventId);
    } catch (e: any) {
      setError(e?.message || 'Failed to enable competition');
    }
  };

  const loadJoinRequests = async (groupChatId: string) => {
    try {
      const res = await listGroupJoinRequests(groupChatId);
      setJoinRequests(res.requests || []);
      setRequestsGroupId(groupChatId);
    } catch (e: any) {
      setError(e?.message || 'Failed to load requests');
    }
  };

  const EmptyState = ({
    icon,
    title,
    subtitle,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
  }) => (
    <View style={[styles.empty, { backgroundColor: surface, borderColor: hairline }]}>
      <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(56,189,248,0.12)' : 'rgba(28,115,180,0.08)' }]}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: ink }]}>{title}</Text>
      <Text style={[styles.emptySub, { color: muted }]}>{subtitle}</Text>
    </View>
  );

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.shell,
          {
            backgroundColor: surface,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.85)',
            ...Platform.select({
              ios: {
                shadowColor: isDark ? '#000' : '#1C73B4',
                shadowOpacity: isDark ? 0.35 : 0.1,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 10 },
              },
              android: { elevation: 3 },
            }),
          },
        ]}
      >
        <LinearGradient
          colors={
            isDark
              ? ['rgba(56,189,248,0.08)', 'transparent']
              : ['rgba(28,115,180,0.06)', 'rgba(80,200,120,0.03)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.shellHeader}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.shellEyebrow, { color: accent }]}>Event</Text>
            <Text style={[styles.shellTitle, { color: ink }]}>Spaces</Text>
            <Text style={[styles.shellSubtitle, { color: muted }]}>
              Chats, events, and people — all in one place
            </Text>
          </View>
          {canManageStaff && tab === 'chats' ? (
            <TouchableOpacity onPress={() => setCreateChatOpen(true)} activeOpacity={0.88}>
              <LinearGradient
                colors={isDark ? ['#14B8A6', '#38BDF8'] : ['#50C878', '#1C73B4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.headerAction}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.headerActionText}>New chat</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
          {canManageStaff && tab === 'events' ? (
            <TouchableOpacity onPress={openCreateEvent} activeOpacity={0.88}>
              <LinearGradient
                colors={isDark ? ['#F59E0B', '#EA580C'] : ['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.headerAction}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.headerActionText}>New event</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </View>

        <View
          style={[
            styles.tabTrack,
            {
              backgroundColor: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(15,23,42,0.05)',
              borderColor: hairline,
            },
          ]}
        >
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.tabPill,
                  active && {
                    backgroundColor: isDark ? 'rgba(56,189,248,0.18)' : '#FFFFFF',
                    ...Platform.select({
                      ios: {
                        shadowColor: '#0f172a',
                        shadowOpacity: 0.1,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 3 },
                      },
                      android: { elevation: 2 },
                    }),
                  },
                ]}
                onPress={() => setTab(t.key)}
                activeOpacity={0.8}
              >
                <Ionicons name={t.icon} size={15} color={active ? accent : muted} />
                <Text
                  style={{
                    color: active ? accent : muted,
                    fontWeight: active ? '700' : '500',
                    fontSize: 13,
                  }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 28 }} color={accent} />
        ) : null}

        {!loading && tab === 'chats' ? (
          <View style={styles.list}>
            {groupChats.length === 0 ? (
              <EmptyState
                icon="chatbubbles-outline"
                title="No chats yet"
                subtitle={
                  canManageStaff
                    ? 'Create a space for planning, updates, or hangouts.'
                    : 'Chats will appear here when the host opens them.'
                }
              />
            ) : (
              groupChats.map((g, index) => {
                const canOpen = !!g.isMember;
                const onPress = () => {
                  if (canOpen) openChat(g.chatId);
                  else if (isMember && g.privacy !== 'invite') void handleJoinChat(g);
                };
                return (
                  <TouchableOpacity
                    key={g._id}
                    style={[
                      styles.row,
                      index < groupChats.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: hairline },
                    ]}
                    onPress={onPress}
                    activeOpacity={0.7}
                    disabled={!canOpen && !(isMember && g.privacy !== 'invite')}
                  >
                    <View
                      style={[
                        styles.rowIcon,
                        {
                          backgroundColor: g.isDefault
                            ? isDark
                              ? 'rgba(80,200,120,0.16)'
                              : 'rgba(16,124,65,0.1)'
                            : isDark
                              ? 'rgba(56,189,248,0.14)'
                              : 'rgba(28,115,180,0.1)',
                        },
                      ]}
                    >
                      <Ionicons
                        name={g.isDefault ? 'home-outline' : privacyIcon(g.privacy)}
                        size={18}
                        color={g.isDefault ? (isDark ? '#50C878' : '#107C41') : accent}
                      />
                    </View>
                    <View style={styles.rowBody}>
                      <View style={styles.rowTitleLine}>
                        <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={1}>
                          {g.name}
                        </Text>
                        {g.isDefault ? (
                          <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(80,200,120,0.18)' : 'rgba(16,124,65,0.1)' }]}>
                            <Text style={{ color: isDark ? '#7DDEA3' : '#107C41', fontSize: 10, fontWeight: '700' }}>
                              MAIN
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.rowMeta, { color: muted }]} numberOfLines={1}>
                        {PRIVACY_LABEL[g.privacy] || g.privacy}
                        {g.requireJoinProof ? ' · proof' : ''} · {g.memberCount || 0} members
                      </Text>
                    </View>
                    <View style={styles.rowActions}>
                      {canModerate && g.privacy === 'request' ? (
                        <TouchableOpacity
                          onPress={() => loadJoinRequests(g._id)}
                          hitSlop={8}
                          style={[styles.ghostChip, { borderColor: hairline }]}
                        >
                          <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>Requests</Text>
                        </TouchableOpacity>
                      ) : null}
                      {canModerate && g.privacy === 'invite' ? (
                        <TouchableOpacity
                          onPress={() => {
                            setInviteGroupId(g._id);
                            setInviteQuery('');
                            setInviteCandidates([]);
                          }}
                          hitSlop={8}
                          style={[styles.ghostChip, { borderColor: hairline }]}
                        >
                          <Text style={{ color: accent, fontSize: 11, fontWeight: '700' }}>Invite</Text>
                        </TouchableOpacity>
                      ) : null}
                      {canOpen ? (
                        <View style={[styles.openChip, { backgroundColor: isDark ? 'rgba(56,189,248,0.16)' : 'rgba(28,115,180,0.1)' }]}>
                          <Text style={{ color: accent, fontSize: 12, fontWeight: '700' }}>Open</Text>
                          <Ionicons name="chevron-forward" size={14} color={accent} />
                        </View>
                      ) : isMember ? (
                        <View style={[styles.openChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)' }]}>
                          <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>
                            {g.joinRequestPending ? 'Pending' : g.privacy === 'invite' ? 'Invite only' : 'Join'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : null}

        {!loading && tab === 'events' ? (
          <View style={styles.list}>
            {events.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No events yet"
                subtitle={
                  canManageStaff
                    ? 'Schedule a meet-up, trip, or competition for members.'
                    : 'Upcoming community events will show up here.'
                }
              />
            ) : (
              events.map((ev) => {
                const starts = new Date(ev.startsAt);
                const dayNum = starts.toLocaleDateString(undefined, { day: 'numeric' });
                const monthShort = starts.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
                const timeLabel = starts.toLocaleString(undefined, {
                  weekday: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                });
                const competitionOn = !!ev.competition?.enabled;
                const regOpen = ev.registrationOpen !== false && ev.status !== 'cancelled';
                const isWaitlisted = !!ev.isWaitlisted;
                const countdown = formatEventCountdown(ev.startsAt);
                const canRegisterSolo =
                  !ev.isRegistered &&
                  !isWaitlisted &&
                  isMember &&
                  regOpen &&
                  ev.participationMode !== 'group';
                const canCreateTeam =
                  !ev.isRegistered &&
                  !isWaitlisted &&
                  isMember &&
                  regOpen &&
                  ev.participationMode !== 'individual';
                const showChat = !!(ev.chatId && (ev.isRegistered || ev.canManage));
                const showAnnounce = !!(ev.announcementChatId && (ev.isRegistered || ev.canManage));
                const showTeam = !!ev.myTeam?.chatId;
                const iconRailBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)';
                const iconRailBorder = hairline;

                return (
                  <View
                    key={ev._id}
                    style={[
                      styles.eventCardPremium,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.035)' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.07)',
                        ...Platform.select({
                          ios: {
                            shadowColor: '#0f172a',
                            shadowOpacity: isDark ? 0.25 : 0.07,
                            shadowRadius: 16,
                            shadowOffset: { width: 0, height: 6 },
                          },
                          android: { elevation: 2 },
                        }),
                      },
                    ]}
                  >
                    <View style={styles.eventHero}>
                      <LinearGradient
                        colors={
                          isDark
                            ? ['rgba(245,158,11,0.22)', 'rgba(234,88,12,0.1)']
                            : ['rgba(254,243,199,0.95)', 'rgba(253,230,138,0.55)']
                        }
                        style={styles.dateBlock}
                      >
                        <Text style={[styles.dateDay, { color: isDark ? '#FDE68A' : '#92400E' }]}>
                          {dayNum}
                        </Text>
                        <Text style={[styles.dateMonth, { color: isDark ? '#FBBF24' : '#B45309' }]}>
                          {monthShort}
                        </Text>
                      </LinearGradient>

                      <View style={styles.eventHeroBody}>
                        <View style={styles.eventTitleRow}>
                          <Text style={[styles.eventTitle, { color: ink }]} numberOfLines={2}>
                            {ev.title}
                          </Text>
                          {ev.canManage ? (
                            <TouchableOpacity
                              onPress={() => {
                                setManageFeedback(null);
                                setManageEventId(ev._id);
                              }}
                              hitSlop={10}
                              style={[
                                styles.eventOverflowBtn,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.06)'
                                    : 'rgba(15,23,42,0.05)',
                                },
                              ]}
                            >
                              <Ionicons name="ellipsis-horizontal" size={16} color={muted} />
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        <Text style={[styles.eventWhen, { color: muted }]} numberOfLines={1}>
                          {timeLabel}
                          {'  ·  '}
                          {MODE_LABEL[ev.participationMode] || ev.participationMode}
                          {countdown ? `  ·  ${countdown}` : ''}
                          {ev.waitlistCount ? `  ·  ${ev.waitlistCount} waitlisted` : ''}
                        </Text>

                        {ev.location?.address ? (
                          <View style={styles.eventLocRow}>
                            <Ionicons name="location-outline" size={13} color={muted} />
                            <Text style={[styles.eventWhen, { color: muted, marginTop: 0 }]} numberOfLines={1}>
                              {ev.location.address}
                            </Text>
                          </View>
                        ) : null}

                        <View style={styles.eventBadgeRow}>
                          {ev.isRegistered ? (
                            <View
                              style={[
                                styles.miniBadge,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(80,200,120,0.18)'
                                    : 'rgba(16,124,65,0.1)',
                                },
                              ]}
                            >
                              <Ionicons
                                name="checkmark-circle"
                                size={11}
                                color={isDark ? '#7DDEA3' : '#107C41'}
                              />
                              <Text
                                style={{
                                  color: isDark ? '#7DDEA3' : '#107C41',
                                  fontSize: 10,
                                  fontWeight: '700',
                                }}
                              >
                                You’re in
                              </Text>
                            </View>
                          ) : null}
                          {isWaitlisted ? (
                            <View
                              style={[
                                styles.miniBadge,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(245,158,11,0.18)'
                                    : 'rgba(245,158,11,0.12)',
                                },
                              ]}
                            >
                              <Ionicons
                                name="hourglass-outline"
                                size={11}
                                color={isDark ? '#FBBF24' : '#D97706'}
                              />
                              <Text
                                style={{
                                  color: isDark ? '#FBBF24' : '#B45309',
                                  fontSize: 10,
                                  fontWeight: '700',
                                }}
                              >
                                Waitlisted
                              </Text>
                            </View>
                          ) : null}
                          {competitionOn ? (
                            <View
                              style={[
                                styles.miniBadge,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(251,191,36,0.16)'
                                    : 'rgba(245,158,11,0.12)',
                                },
                              ]}
                            >
                              <Ionicons
                                name="trophy"
                                size={10}
                                color={isDark ? '#FBBF24' : '#D97706'}
                              />
                              <Text
                                style={{
                                  color: isDark ? '#FBBF24' : '#B45309',
                                  fontSize: 10,
                                  fontWeight: '700',
                                }}
                              >
                                {ev.competition?.rankBy === 'views' ? 'By views' : 'By likes'}
                              </Text>
                            </View>
                          ) : null}
                          {!regOpen ? (
                            <View
                              style={[
                                styles.miniBadge,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.08)'
                                    : 'rgba(15,23,42,0.06)',
                                },
                              ]}
                            >
                              <Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>
                                {ev.status === 'cancelled' ? 'Cancelled' : 'Closed'}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    {(canRegisterSolo || canCreateTeam || ev.isRegistered || isWaitlisted) && (
                      <View style={styles.eventCtaRow}>
                        {canRegisterSolo ? (
                          <TouchableOpacity
                            style={styles.eventPrimaryCta}
                            activeOpacity={0.88}
                            onPress={async () => {
                              try {
                                const res = await registerForCommunityEvent(ev._id);
                                await loadTab();
                                if (res?.isWaitlisted) {
                                  setError(null);
                                }
                              } catch (e: any) {
                                setError(e?.message || 'Register failed');
                              }
                            }}
                          >
                            <LinearGradient
                              colors={isDark ? ['#14B8A6', '#38BDF8'] : ['#0F766E', '#1C73B4']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.eventPrimaryCtaInner}
                            >
                              <Ionicons name="ticket-outline" size={16} color="#fff" />
                              <Text style={styles.eventPrimaryCtaText}>
                                {ev.isFull ? 'Join waitlist' : 'Register'}
                              </Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        ) : null}
                        {canCreateTeam ? (
                          <TouchableOpacity
                            style={[
                              styles.eventSecondaryCta,
                              { borderColor: hairline, flex: canRegisterSolo ? 0 : 1 },
                            ]}
                            onPress={() => {
                              setTeamEventId(ev._id);
                              setTeamName('My Team');
                              setTeamSize('2');
                              setTeamMemberIds([]);
                              setTeamSearch('');
                              setTeamCandidates([]);
                            }}
                          >
                            <Ionicons name="people-outline" size={15} color={accent} />
                            <Text style={[styles.eventSecondaryCtaText, { color: accent }]}>
                              Create team
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        {(ev.isRegistered || isWaitlisted) && !canRegisterSolo && !canCreateTeam ? (
                          <View
                            style={[
                              styles.eventRegisteredBar,
                              {
                                backgroundColor: isDark
                                  ? isWaitlisted
                                    ? 'rgba(245,158,11,0.12)'
                                    : 'rgba(80,200,120,0.12)'
                                  : isWaitlisted
                                    ? 'rgba(245,158,11,0.1)'
                                    : 'rgba(16,124,65,0.08)',
                                borderColor: isDark
                                  ? isWaitlisted
                                    ? 'rgba(251,191,36,0.22)'
                                    : 'rgba(125,222,163,0.22)'
                                  : isWaitlisted
                                    ? 'rgba(217,119,6,0.18)'
                                    : 'rgba(16,124,65,0.16)',
                              },
                            ]}
                          >
                            <View style={styles.eventRegisteredStatus}>
                              <Ionicons 
                                name={isWaitlisted ? 'hourglass-outline' : 'checkmark-circle'}
                                size={16}
                                color={
                                  isWaitlisted
                                    ? isDark
                                      ? '#FBBF24'
                                      : '#D97706'
                                    : isDark
                                      ? '#7DDEA3'
                                      : '#107C41'
                                }
                              />
                              <Text
                                style={[
                                  styles.eventRegisteredLabel,
                                  {
                                    color: isWaitlisted
                                      ? isDark
                                        ? '#FBBF24'
                                        : '#B45309'
                                      : isDark
                                        ? '#7DDEA3'
                                        : '#107C41',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {isWaitlisted ? 'On waitlist' : "You're registered"}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[
                                styles.eventLeaveBtn,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(255,255,255,0.08)'
                                    : 'rgba(15,23,42,0.06)',
                                },
                              ]}
                              onPress={async () => {
                                try {
                                  await leaveCommunityEvent(ev._id);
                                  await loadTab();
                                } catch (e: any) {
                                  setError(e?.message || 'Failed to leave');
                                }
                              }}
                              activeOpacity={0.75}
                              hitSlop={6}
                              accessibilityLabel={isWaitlisted ? 'Leave waitlist' : 'Leave event'}
                            >
                              <Text style={[styles.eventLeaveBtnText, { color: muted }]}>
                                Leave
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </View>
                    )}

                    <View
                      style={[
                        styles.eventIconRail,
                        { backgroundColor: iconRailBg, borderColor: iconRailBorder },
                      ]}
                    >
                      {showChat ? (
                        <TouchableOpacity
                          style={styles.eventIconBtn}
                          onPress={() => openChat(ev.chatId!)}
                          accessibilityLabel="Event chat"
                        >
                          <Ionicons name="chatbubble-ellipses-outline" size={18} color={accent} />
                          <Text style={[styles.eventIconLabel, { color: muted }]}>Chat</Text>
                        </TouchableOpacity>
                      ) : null}
                      {showTeam ? (
                        <TouchableOpacity
                          style={styles.eventIconBtn}
                          onPress={() => openChat(String(ev.myTeam!.chatId))}
                          accessibilityLabel="Team chat"
                        >
                          <Ionicons name="people-outline" size={18} color={accent} />
                          <Text style={[styles.eventIconLabel, { color: muted }]}>Team</Text>
                        </TouchableOpacity>
                      ) : null}
                      {showAnnounce ? (
                        <TouchableOpacity
                          style={styles.eventIconBtn}
                          onPress={() => openChat(ev.announcementChatId!)}
                          accessibilityLabel="Announcements"
                        >
                          <Ionicons name="megaphone-outline" size={18} color={accent} />
                          <Text style={[styles.eventIconLabel, { color: muted }]}>Announce</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        style={styles.eventIconBtn}
                        onPress={() => openEventCompetition(ev._id)}
                        accessibilityLabel="Competition"
                      >
                        <Ionicons
                          name={competitionOn ? 'trophy' : 'trophy-outline'}
                          size={18}
                          color={isDark ? '#FBBF24' : '#D97706'}
                        />
                        <Text style={[styles.eventIconLabel, { color: muted }]}>
                          {competitionOn ? 'Enter' : 'Compete'}
                        </Text>
                      </TouchableOpacity>
                      {ev.canManage ? (
                        <TouchableOpacity
                          style={styles.eventIconBtn}
                          onPress={() => setManageEventId(ev._id)}
                          accessibilityLabel="Manage event"
                        >
                          <Ionicons name="settings-outline" size={18} color={muted} />
                          <Text style={[styles.eventIconLabel, { color: muted }]}>Manage</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        {!loading && tab === 'find' ? (
          <View style={styles.list}>
            {canManageStaff && staff.length > 0 ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.rowMeta, { color: muted, marginBottom: 6, fontWeight: '700' }]}>
                  Staff · unlimited admins & moderators
                </Text>
                {staff.map((s) => (
                  <View key={s.userId} style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: hairline }]}>
                    <View style={[styles.avatar, { backgroundColor: isDark ? 'rgba(56,189,248,0.16)' : 'rgba(28,115,180,0.12)' }]}>
                      <Text style={{ color: accent, fontWeight: '700', fontSize: 14 }}>
                        {(s.user?.fullName || s.user?.username || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={1}>
                        {s.user?.fullName || s.user?.username || 'Staff'}
                      </Text>
                      <Text style={[styles.rowMeta, { color: muted }]}>{s.role}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          await revokeCommunityRole(pageId, s.userId);
                          await refreshRoles();
                          await loadTab();
                        } catch (e: any) {
                          setError(e?.message || 'Failed to revoke');
                        }
                      }}
                      style={[styles.ghostChip, { borderColor: hairline }]}
                    >
                      <Text style={{ color: theme.colors.error, fontSize: 11, fontWeight: '700' }}>Revoke</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={[styles.searchBar, { borderColor: hairline, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)' }]}>
              <Ionicons name="search" size={16} color={muted} />
              <TextInput
                value={findQuery}
                onChangeText={setFindQuery}
                placeholder="Search members by name"
                placeholderTextColor={muted}
                style={[styles.searchInput, { color: ink }]}
                onSubmitEditing={loadTab}
                returnKeyType="search"
              />
              <TouchableOpacity onPress={loadTab} hitSlop={8}>
                <Text style={{ color: accent, fontWeight: '700', fontSize: 13 }}>Search</Text>
              </TouchableOpacity>
            </View>
            {members.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="Find members"
                subtitle="Search the community to connect with people here."
              />
            ) : (
              members.map((item, index) => {
                const role = item.communityRole || 'member';
                const isStaff = role === 'admin' || role === 'moderator';
                return (
                  <View
                    key={item._id}
                    style={[
                      styles.row,
                      index < members.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: hairline },
                    ]}
                  >
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
                      onPress={() => router.push(`/profile/${item._id}` as any)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.avatar, { backgroundColor: isDark ? 'rgba(56,189,248,0.16)' : 'rgba(28,115,180,0.12)' }]}>
                        <Text style={{ color: accent, fontWeight: '700', fontSize: 14 }}>
                          {(item.fullName || item.username || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.rowBody}>
                        <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={1}>
                          {item.fullName || item.username}
                        </Text>
                        <Text style={[styles.rowMeta, { color: muted }]}>
                          @{item.username} · {role}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {canManageStaff && role === 'member' ? (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              await assignCommunityRole(pageId, item._id, 'admin');
                              await refreshRoles();
                              await loadTab();
                            } catch (e: any) {
                              setError(e?.message || 'Failed');
                            }
                          }}
                          style={[styles.ghostChip, { borderColor: hairline }]}
                        >
                          <Text style={{ color: accent, fontSize: 11, fontWeight: '700' }}>Admin</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={async () => {
                            try {
                              await assignCommunityRole(pageId, item._id, 'moderator');
                              await refreshRoles();
                              await loadTab();
                            } catch (e: any) {
                              setError(e?.message || 'Failed');
                            }
                          }}
                          style={[styles.ghostChip, { borderColor: hairline }]}
                        >
                          <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>Mod</Text>
                        </TouchableOpacity>
                      </View>
                    ) : canManageStaff && isStaff ? (
                      <TouchableOpacity
                        onPress={async () => {
                          try {
                            await revokeCommunityRole(pageId, item._id);
                            await refreshRoles();
                            await loadTab();
                          } catch (e: any) {
                            setError(e?.message || 'Failed');
                          }
                        }}
                        style={[styles.ghostChip, { borderColor: hairline }]}
                      >
                        <Text style={{ color: theme.colors.error, fontSize: 11, fontWeight: '700' }}>Revoke</Text>
                      </TouchableOpacity>
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={muted} />
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : null}
      </View>

      {/* Create chat modal */}
      <Modal visible={createChatOpen} transparent animationType="fade" onRequestClose={() => setCreateChatOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCreateChatOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: ink, marginBottom: 0, flex: 1 }]}>New group chat</Text>
              <TouchableOpacity
                onPress={() => setCreateChatOpen(false)}
                hitSlop={10}
                style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalHint, { color: muted }]}>
              Name the space and choose who can join.
            </Text>
            <TextInput
              value={chatName}
              onChangeText={setChatName}
              placeholder="Chat name"
              placeholderTextColor={muted}
              style={[styles.input, { color: ink, borderColor: hairline, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)' }]}
            />
            <View style={styles.rowWrap}>
              {(['public', 'request', 'invite'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setChatPrivacy(p)}
                  style={[
                    styles.chip,
                    { borderColor: hairline },
                    chatPrivacy === p && { backgroundColor: accent, borderColor: accent },
                  ]}
                >
                  <Text style={{ color: chatPrivacy === p ? '#fff' : ink, fontSize: 12, fontWeight: '600' }}>
                    {PRIVACY_LABEL[p]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {chatPrivacy === 'request' ? (
              <>
                <TouchableOpacity onPress={() => setChatProof((v) => !v)} style={styles.rowWrap}>
                  <Ionicons name={chatProof ? 'checkbox' : 'square-outline'} size={18} color={accent} />
                  <Text style={{ color: ink, marginLeft: 8 }}>Require proof</Text>
                </TouchableOpacity>
                {chatProof ? (
                  <TextInput
                    value={chatProofPrompt}
                    onChangeText={setChatProofPrompt}
                    placeholder="Proof prompt (e.g. upload student ID)"
                    placeholderTextColor={muted}
                    style={[styles.input, { color: ink, borderColor: hairline }]}
                  />
                ) : null}
              </>
            ) : null}
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accent }]} onPress={handleCreateChat}>
              <Text style={styles.primaryBtnText}>Create chat</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create / edit event modal */}
      <Modal
        visible={createEventOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setCreateEventOpen(false);
          resetEventForm();
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setCreateEventOpen(false);
            resetEventForm();
          }}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.colors.surface, maxHeight: '88%' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <LinearGradient
                  colors={isDark ? ['rgba(245,158,11,0.28)', 'rgba(234,88,12,0.16)'] : ['#FEF3C7', '#FDE68A']}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="calendar" size={20} color={isDark ? '#FBBF24' : '#B45309'} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: ink, marginBottom: 0 }]}>
                    {editingEventId ? 'Edit event' : 'New event'}
                  </Text>
                  <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                    Tap to pick times — no typing dates
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setCreateEventOpen(false);
                    resetEventForm();
                  }}
                  hitSlop={10}
                  style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={18} color={muted} />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.formSection,
                  {
                    borderColor: hairline,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)',
                  },
                ]}
              >
                <Text style={[styles.formSectionTitle, { color: muted }]}>Challenge template</Text>
                <Text style={{ color: muted, fontSize: 11, marginBottom: 8, lineHeight: 15 }}>
                  Optional preset — fills media, mode, and enables a competition
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
                >
                  {EVENT_TEMPLATES.map((tpl) => {
                    const active = eventTemplateKey === tpl.key;
                    return (
                      <TouchableOpacity
                        key={tpl.key}
                        onPress={() => {
                          if (active) {
                            setEventTemplateKey(null);
                            return;
                          }
                          setEventTemplateKey(tpl.key);
                          if (!eventTitle.trim()) setEventTitle(tpl.titleHint);
                          setEventAllowedMedia([...tpl.media]);
                          setEventMode(tpl.mode);
                        }}
                        style={[
                          styles.miniBadge,
                          {
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: active ? accent : hairline,
                            backgroundColor: active
                              ? isDark
                                ? 'rgba(56,189,248,0.16)'
                                : 'rgba(28,115,180,0.1)'
                              : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? accent : ink,
                            fontSize: 12,
                            fontWeight: '700',
                          }}
                        >
                          {tpl.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.formSectionTitle, { color: muted }]}>Basics</Text>
                <TextInput
                  value={eventTitle}
                  onChangeText={setEventTitle}
                  placeholder="Event title"
                  placeholderTextColor={muted}
                  style={[styles.input, { color: ink, borderColor: hairline, marginBottom: 8 }]}
                />
                <TextInput
                  value={eventDescription}
                  onChangeText={setEventDescription}
                  placeholder="Description for members (optional)"
                  placeholderTextColor={muted}
                  multiline
                  style={[
                    styles.input,
                    {
                      color: ink,
                      borderColor: hairline,
                      minHeight: 72,
                      textAlignVertical: 'top',
                      marginBottom: 0,
                    },
                  ]}
                />
              </View>

              <View
                style={[
                  styles.formSection,
                  {
                    borderColor: hairline,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)',
                  },
                ]}
              >
                <Text style={[styles.formSectionTitle, { color: muted }]}>When & where</Text>
                <DateTimeField
                  label="Starts"
                  mode="datetime"
                  value={eventStarts}
                  onChange={(next) => {
                    if (next) setEventStarts(next);
                  }}
                  minimumDate={new Date()}
                />
                <DateTimeField
                  label="Ends"
                  mode="datetime"
                  value={eventEnds}
                  onChange={setEventEnds}
                  optional
                  minimumDate={eventStarts}
                  placeholder="Select end date & time"
                />
                <TextInput
                  value={eventLocation}
                  onChangeText={setEventLocation}
                  placeholder="Venue or address (optional)"
                  placeholderTextColor={muted}
                  style={[styles.input, { color: ink, borderColor: hairline, marginBottom: 0 }]}
                />
              </View>

              <View
                style={[
                  styles.formSection,
                  {
                    borderColor: hairline,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)',
                  },
                ]}
              >
                <Text style={[styles.formSectionTitle, { color: muted }]}>Capacity</Text>
                <View style={styles.capacityRow}>
                  <TouchableOpacity
                    style={[styles.capacityBtn, { borderColor: hairline }]}
                    onPress={() => {
                      const n = Math.max(0, (Number(eventMaxParticipants) || 0) - 1);
                      setEventMaxParticipants(n > 0 ? String(n) : '');
                    }}
                  >
                    <Ionicons name="remove" size={18} color={ink} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ color: ink, fontWeight: '800', fontSize: 18 }}>
                      {eventMaxParticipants.trim()
                        ? eventMaxParticipants.trim()
                        : 'Unlimited'}
                    </Text>
                    <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>
                      Max participants
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.capacityBtn, { borderColor: hairline }]}
                    onPress={() => {
                      const n = Math.max(1, (Number(eventMaxParticipants) || 0) + 1);
                      setEventMaxParticipants(String(n));
                    }}
                  >
                    <Ionicons name="add" size={18} color={ink} />
                  </TouchableOpacity>
                </View>
              </View>

              <View
                style={[
                  styles.formSection,
                  {
                    borderColor: hairline,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)',
                  },
                ]}
              >
                <Text style={[styles.formSectionTitle, { color: muted }]}>Who can see it</Text>
                <View style={styles.choiceGrid}>
                  {(
                    [
                      { key: 'members' as const, label: 'Members', hint: 'Community only', icon: 'people-outline' as const },
                      { key: 'public' as const, label: 'Public', hint: 'Anyone can view', icon: 'globe-outline' as const },
                      { key: 'private' as const, label: 'Request', hint: 'Request to join', icon: 'hand-left-outline' as const },
                    ] as const
                  ).map((opt) => {
                    const active = eventVisibility === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => setEventVisibility(opt.key)}
                        style={[
                          styles.choiceCard,
                          {
                            borderColor: active ? accent : hairline,
                            backgroundColor: active
                              ? isDark
                                ? 'rgba(56,189,248,0.14)'
                                : 'rgba(28,115,180,0.08)'
                              : 'transparent',
                          },
                        ]}
                      >
                        <Ionicons name={opt.icon} size={16} color={active ? accent : muted} />
                        <Text style={{ color: active ? accent : ink, fontWeight: '700', fontSize: 12 }}>
                          {opt.label}
                        </Text>
                        <Text style={{ color: muted, fontSize: 10 }}>{opt.hint}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.formSectionTitle, { color: muted, marginTop: 12 }]}>
                  Allowed entries
                </Text>
                <Text style={{ color: muted, fontSize: 11, marginBottom: 8, lineHeight: 15 }}>
                  Tap to allow any mix — posts, shorts, and/or long videos
                </Text>
                <View style={[styles.choiceGrid, { flexWrap: 'wrap' }]}>
                  {(
                    [
                      { key: 'post' as const, label: 'Posts', hint: 'Feed photos', icon: 'image-outline' as const },
                      { key: 'short' as const, label: 'Shorts', hint: 'Short videos', icon: 'flash-outline' as const },
                      { key: 'long_video' as const, label: 'Videos', hint: 'Long videos', icon: 'videocam-outline' as const },
                    ] as const
                  ).map((opt) => {
                    const active = eventAllowedMedia.includes(opt.key);
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => {
                          setEventAllowedMedia((prev) => {
                            if (prev.includes(opt.key)) {
                              return prev.filter((k) => k !== opt.key);
                            }
                            return ALL_ENTRY_MEDIA.filter(
                              (k) => k === opt.key || prev.includes(k)
                            );
                          });
                        }}
                        style={[
                          styles.choiceCard,
                          {
                            flexBasis: '30%',
                            flexGrow: 1,
                            borderColor: active ? accent : hairline,
                            backgroundColor: active
                              ? isDark
                                ? 'rgba(56,189,248,0.14)'
                                : 'rgba(28,115,180,0.08)'
                              : 'transparent',
                          },
                        ]}
                      >
                        <Ionicons name={opt.icon} size={16} color={active ? accent : muted} />
                        <Text style={{ color: active ? accent : ink, fontWeight: '700', fontSize: 12 }}>
                          {opt.label}
                        </Text>
                        <Text style={{ color: muted, fontSize: 10 }}>{opt.hint}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.formSectionTitle, { color: muted, marginTop: 12 }]}>
                  Who can join
                </Text>
                <View style={styles.choiceGrid}>
                  {(
                    [
                      { key: 'individual' as const, label: 'Individual', hint: 'Solo signup', icon: 'person-outline' as const },
                      { key: 'group' as const, label: 'Team', hint: 'Teams only', icon: 'people-outline' as const },
                      { key: 'both' as const, label: 'Both', hint: 'Solo or team', icon: 'git-merge-outline' as const },
                    ] as const
                  ).map((opt) => {
                    const active = eventMode === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => setEventMode(opt.key)}
                        style={[
                          styles.choiceCard,
                          {
                            borderColor: active ? accent : hairline,
                            backgroundColor: active
                              ? isDark
                                ? 'rgba(56,189,248,0.14)'
                                : 'rgba(28,115,180,0.08)'
                              : 'transparent',
                          },
                        ]}
                      >
                        <Ionicons name={opt.icon} size={16} color={active ? accent : muted} />
                        <Text style={{ color: active ? accent : ink, fontWeight: '700', fontSize: 12 }}>
                          {opt.label}
                        </Text>
                        <Text style={{ color: muted, fontSize: 10 }}>{opt.hint}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  onPress={() => setEventRegistrationOpen((v) => !v)}
                  style={[
                    styles.regToggle,
                    {
                      borderColor: hairline,
                      backgroundColor: eventRegistrationOpen
                        ? isDark
                          ? 'rgba(80,200,120,0.12)'
                          : 'rgba(16,124,65,0.08)'
                        : 'transparent',
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: ink, fontWeight: '700', fontSize: 13 }}>
                      Registration open
                    </Text>
                    <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>
                      Members can sign up now
                    </Text>
                  </View>
                  <Ionicons
                    name={eventRegistrationOpen ? 'toggle' : 'toggle-outline'}
                    size={34}
                    color={eventRegistrationOpen ? (isDark ? '#7DDEA3' : '#107C41') : muted}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={handleSaveEvent} activeOpacity={0.88} style={{ marginTop: 4 }}>
                <LinearGradient
                  colors={isDark ? ['#F59E0B', '#EA580C'] : ['#F59E0B', '#D97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}
                >
                  <Text style={styles.primaryBtnText}>
                    {editingEventId ? 'Save changes' : 'Create event'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create team modal */}
      <Modal
        visible={!!teamEventId}
        transparent
        animationType="fade"
        onRequestClose={() => setTeamEventId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setTeamEventId(null)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.colors.surface, maxHeight: '88%' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: ink, marginBottom: 0, flex: 1 }]}>Create team</Text>
              <TouchableOpacity
                onPress={() => setTeamEventId(null)}
                hitSlop={10}
                style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalHint, { color: muted }]}>
              Invite teammates from this community. Everyone must accept before the team is complete.
            </Text>
            <TextInput
              value={teamName}
              onChangeText={setTeamName}
              placeholder="Team name"
              placeholderTextColor={muted}
              style={[styles.input, { color: ink, borderColor: hairline }]}
            />
            <TextInput
              value={teamSize}
              onChangeText={setTeamSize}
              placeholder="Expected team size"
              placeholderTextColor={muted}
              keyboardType="number-pad"
              style={[styles.input, { color: ink, borderColor: hairline }]}
            />
            <View style={[styles.searchBar, { borderColor: hairline, marginBottom: 10 }]}>
              <Ionicons name="search" size={16} color={muted} />
              <TextInput
                value={teamSearch}
                onChangeText={setTeamSearch}
                placeholder="Search members to invite"
                placeholderTextColor={muted}
                style={[styles.searchInput, { color: ink }]}
                onSubmitEditing={async () => {
                  try {
                    const res = await searchCommunityMembers(pageId, teamSearch.trim());
                    setTeamCandidates(res.members || []);
                  } catch (e: any) {
                    setError(e?.message || 'Search failed');
                  }
                }}
                returnKeyType="search"
              />
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const res = await searchCommunityMembers(pageId, teamSearch.trim());
                    setTeamCandidates(res.members || []);
                  } catch (e: any) {
                    setError(e?.message || 'Search failed');
                  }
                }}
                hitSlop={8}
              >
                <Text style={{ color: accent, fontWeight: '700', fontSize: 13 }}>Search</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 220 }}>
              {teamCandidates.map((m) => {
                const selected = teamMemberIds.includes(m._id);
                return (
                  <TouchableOpacity
                    key={m._id}
                    style={[styles.requestRow, { borderColor: hairline }]}
                    onPress={() => {
                      setTeamMemberIds((prev) =>
                        selected ? prev.filter((id) => id !== m._id) : [...prev, m._id]
                      );
                    }}
                  >
                    <Text style={{ color: ink, flex: 1, fontWeight: '600' }} numberOfLines={1}>
                      {m.fullName || m.username}
                    </Text>
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={selected ? accent : muted}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={[styles.rowMeta, { color: muted, marginVertical: 8 }]}>
              {teamMemberIds.length} teammate{teamMemberIds.length === 1 ? '' : 's'} selected
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: accent }]}
              onPress={async () => {
                if (!teamEventId || !teamName.trim()) return;
                try {
                  const size = Math.max(2, Number(teamSize) || 2);
                  await createEventTeam(teamEventId, {
                    name: teamName.trim(),
                    expectedSize: size,
                    memberIds: teamMemberIds,
                  });
                  setTeamEventId(null);
                  await loadTab();
                } catch (e: any) {
                  setError(e?.message || 'Team create failed');
                }
              }}
            >
              <Text style={styles.primaryBtnText}>Create & invite</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Invite to invite-only chat */}
      <Modal
        visible={!!inviteGroupId}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteGroupId(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setInviteGroupId(null)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: ink, marginBottom: 0, flex: 1 }]}>Invite member</Text>
              <TouchableOpacity
                onPress={() => setInviteGroupId(null)}
                hitSlop={10}
                style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalHint, { color: muted }]}>
              Search community members to invite into this invite-only chat.
            </Text>
            <View style={[styles.searchBar, { borderColor: hairline, marginBottom: 10 }]}>
              <Ionicons name="search" size={16} color={muted} />
              <TextInput
                value={inviteQuery}
                onChangeText={setInviteQuery}
                placeholder="Search members"
                placeholderTextColor={muted}
                style={[styles.searchInput, { color: ink }]}
                onSubmitEditing={async () => {
                  try {
                    const res = await searchCommunityMembers(pageId, inviteQuery.trim());
                    setInviteCandidates(res.members || []);
                  } catch (e: any) {
                    setError(e?.message || 'Search failed');
                  }
                }}
                returnKeyType="search"
              />
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const res = await searchCommunityMembers(pageId, inviteQuery.trim());
                    setInviteCandidates(res.members || []);
                  } catch (e: any) {
                    setError(e?.message || 'Search failed');
                  }
                }}
                hitSlop={8}
              >
                <Text style={{ color: accent, fontWeight: '700', fontSize: 13 }}>Search</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 280 }}>
              {inviteCandidates.map((m) => (
                <View key={m._id} style={[styles.requestRow, { borderColor: hairline }]}>
                  <Text style={{ color: ink, flex: 1, fontWeight: '600' }} numberOfLines={1}>
                    {m.fullName || m.username}
                  </Text>
                  <TouchableOpacity
                    onPress={async () => {
                      if (!inviteGroupId) return;
                      try {
                        await inviteToGroupChat(inviteGroupId, m._id);
                        setInviteGroupId(null);
                        await loadTab();
                      } catch (e: any) {
                        setError(e?.message || 'Invite failed');
                      }
                    }}
                  >
                    <Text style={{ color: accent, fontWeight: '700' }}>Invite</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {inviteCandidates.length === 0 ? (
                <Text style={{ color: muted, textAlign: 'center', paddingVertical: 16 }}>
                  Search to find members
                </Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Join requests */}
      <Modal visible={!!requestsGroupId} transparent animationType="fade" onRequestClose={() => setRequestsGroupId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRequestsGroupId(null)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: ink, marginBottom: 0, flex: 1 }]}>Join requests</Text>
              <TouchableOpacity
                onPress={() => setRequestsGroupId(null)}
                hitSlop={10}
                style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {joinRequests.map((r) => (
                <View key={r._id} style={[styles.requestRow, { borderColor: hairline }]}>
                  <Text style={{ color: ink, flex: 1, fontWeight: '600' }}>
                    {r.userId?.fullName || r.userId?.username || 'User'}
                  </Text>
                  <TouchableOpacity
                    onPress={async () => {
                      await reviewGroupJoinRequest(r._id, 'accept');
                      if (requestsGroupId) await loadJoinRequests(requestsGroupId);
                      await loadTab();
                    }}
                  >
                    <Text style={{ color: accent, fontWeight: '700' }}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      await reviewGroupJoinRequest(r._id, 'reject');
                      if (requestsGroupId) await loadJoinRequests(requestsGroupId);
                    }}
                  >
                    <Text style={{ color: theme.colors.error, marginLeft: 14, fontWeight: '600' }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {joinRequests.length === 0 ? (
                <Text style={{ color: muted, textAlign: 'center', paddingVertical: 16 }}>No pending requests</Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Host manage sheet */}
      <Modal visible={!!manageEvent} transparent animationType="fade" onRequestClose={() => setManageEventId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setManageEventId(null)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: ink, marginBottom: 0, flex: 1 }]}>Manage event</Text>
              <TouchableOpacity
                onPress={() => {
                  setManageFeedback(null);
                  setManageEventId(null);
                }}
                hitSlop={10}
                style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalHint, { color: muted }]}>
              {manageEvent?.title || 'Event'} — edit details, open a competition ranking, or close registration.
            </Text>
            {manageFeedback ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor:
                    manageFeedback.type === 'success'
                      ? isDark
                        ? 'rgba(80,200,120,0.35)'
                        : 'rgba(16,124,65,0.25)'
                      : isDark
                        ? 'rgba(248,113,113,0.4)'
                        : 'rgba(220,38,38,0.25)',
                  backgroundColor:
                    manageFeedback.type === 'success'
                      ? isDark
                        ? 'rgba(80,200,120,0.12)'
                        : 'rgba(16,124,65,0.08)'
                      : isDark
                        ? 'rgba(248,113,113,0.12)'
                        : 'rgba(254,226,226,0.9)',
                }}
              >
                <Ionicons
                  name={manageFeedback.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={
                    manageFeedback.type === 'success'
                      ? isDark
                        ? '#7DDEA3'
                        : '#107C41'
                      : theme.colors.error
                  }
                />
                <Text
                  style={{
                    flex: 1,
                    color:
                      manageFeedback.type === 'success'
                        ? isDark
                          ? '#7DDEA3'
                          : '#107C41'
                        : theme.colors.error,
                    fontSize: 13,
                    fontWeight: '600',
                    lineHeight: 18,
                  }}
                >
                  {manageFeedback.text}
                </Text>
                <TouchableOpacity onPress={() => setManageFeedback(null)} hitSlop={10}>
                  <Ionicons name="close" size={16} color={muted} />
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                style={[styles.manageRow, { borderColor: hairline }]}
                onPress={() => {
                  if (!manageEvent) return;
                  openEditEvent(manageEvent);
                  setManageEventId(null);
                }}
              >
                <Ionicons name="create-outline" size={18} color={accent} />
                <Text style={[styles.manageRowText, { color: ink }]}>Edit details</Text>
              </TouchableOpacity>
              {manageEvent?.announcementChatId ? (
                <TouchableOpacity
                  style={[styles.manageRow, { borderColor: hairline }]}
                  onPress={() => {
                    openChat(manageEvent.announcementChatId!);
                    setManageEventId(null);
                  }}
                >
                  <Ionicons name="megaphone-outline" size={18} color={accent} />
                  <Text style={[styles.manageRowText, { color: ink }]}>Announcement chat</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.manageRow, { borderColor: hairline }]}
                onPress={async () => {
                  if (!manageEvent) return;
                  setManageFeedback(null);
                  try {
                    await enableCompetition(manageEvent._id, 'likes');
                    setManageFeedback(null);
                    setManageEventId(null);
                    await loadTab();
                    await openEventCompetition(manageEvent._id);
                  } catch (e: any) {
                    const msg = e?.userMessage || e?.message || 'Could not open competition. Try again.';
                    setManageFeedback({ type: 'error', text: msg });
                    Alert.alert('Competition', msg);
                  }
                }}
              >
                <Ionicons name="heart-outline" size={18} color={accent} />
                <Text style={[styles.manageRowText, { color: ink }]}>Open competition · rank by likes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.manageRow, { borderColor: hairline }]}
                onPress={async () => {
                  if (!manageEvent) return;
                  setManageFeedback(null);
                  try {
                    await enableCompetition(manageEvent._id, 'views');
                    setManageEventId(null);
                    await loadTab();
                    await openEventCompetition(manageEvent._id);
                  } catch (e: any) {
                    const msg = e?.userMessage || e?.message || 'Could not open competition. Try again.';
                    setManageFeedback({ type: 'error', text: msg });
                    Alert.alert('Competition', msg);
                  }
                }}
              >
                <Ionicons name="eye-outline" size={18} color={accent} />
                <Text style={[styles.manageRowText, { color: ink }]}>Open competition · rank by views</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.manageRow, { borderColor: hairline }]}
                onPress={async () => {
                  if (!manageEvent) return;
                  setManageFeedback(null);
                  try {
                    await enableCompetition(manageEvent._id, 'likes', 'hybrid');
                    setManageEventId(null);
                    await loadTab();
                    await openEventCompetition(manageEvent._id);
                  } catch (e: any) {
                    const msg = e?.userMessage || e?.message || 'Could not open competition. Try again.';
                    setManageFeedback({ type: 'error', text: msg });
                    Alert.alert('Competition', msg);
                  }
                }}
              >
                <Ionicons name="git-merge-outline" size={18} color={accent} />
                <Text style={[styles.manageRowText, { color: ink }]}>
                  Open competition · hybrid (likes + judges)
                </Text>
              </TouchableOpacity>
              {manageEvent?.competition?.enabled ? (
                <TouchableOpacity
                  style={[styles.manageRow, { borderColor: hairline }]}
                  onPress={async () => {
                    if (!manageEvent) return;
                    setManageFeedback(null);
                    try {
                      const res = await publishCompetitionShowcase(manageEvent._id, 5);
                      setShowcaseByEvent((prev) => ({
                        ...prev,
                        [manageEvent._id]: res.showcase,
                      }));
                      setManageFeedback({
                        type: 'success',
                        text: 'Winner showcase published. Members can see the top entries on the competition screen.',
                      });
                      await loadTab();
                    } catch (e: any) {
                      const msg =
                        e?.userMessage ||
                        e?.message ||
                        'Could not publish winners. Add competition entries first, then try again.';
                      setManageFeedback({ type: 'error', text: msg });
                      Alert.alert('Couldn’t publish winners', msg);
                    }
                  }}
                >
                  <Ionicons name="ribbon-outline" size={18} color={accent} />
                  <Text style={[styles.manageRowText, { color: ink }]}>Publish winner showcase</Text>
                </TouchableOpacity>
              ) : null}
              {manageEvent?.registrationOpen !== false ? (
                <TouchableOpacity
                  style={[styles.manageRow, { borderColor: hairline }]}
                  onPress={async () => {
                    if (!manageEvent) return;
                    try {
                      await updateCommunityEvent(manageEvent._id, { registrationOpen: false });
                      setManageEventId(null);
                      await loadTab();
                    } catch (e: any) {
                      setError(e?.message || 'Failed');
                    }
                  }}
                >
                  <Ionicons name="lock-closed-outline" size={18} color={muted} />
                  <Text style={[styles.manageRowText, { color: ink }]}>Close registration</Text>
                </TouchableOpacity>
              ) : null}
              {manageEvent?.competition?.enabled && manageEvent?.competition?.submissionsOpen !== false ? (
                <TouchableOpacity
                  style={[styles.manageRow, { borderColor: hairline }]}
                  onPress={async () => {
                    if (!manageEvent) return;
                    try {
                      await upsertEventCompetition(manageEvent._id, { submissionsOpen: false });
                      setManageEventId(null);
                      await loadTab();
                    } catch (e: any) {
                      setError(e?.message || 'Failed');
                    }
                  }}
                >
                  <Ionicons name="pause-circle-outline" size={18} color={muted} />
                  <Text style={[styles.manageRowText, { color: ink }]}>Close competition entries</Text>
                </TouchableOpacity>
              ) : null}
              {manageEvent?.status !== 'cancelled' ? (
                <TouchableOpacity
                  style={[styles.manageRow, { borderColor: hairline }]}
                  onPress={async () => {
                    if (!manageEvent) return;
                    try {
                      await updateCommunityEvent(manageEvent._id, { status: 'cancelled' });
                      setManageEventId(null);
                      await loadTab();
                    } catch (e: any) {
                      setError(e?.message || 'Failed');
                    }
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                  <Text style={[styles.manageRowText, { color: theme.colors.error }]}>Cancel event</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Competition — pick from your posts/shorts */}
      <Modal visible={!!eventDetailId} transparent animationType="fade" onRequestClose={() => setEventDetailId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEventDetailId(null)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.colors.surface, maxHeight: '90%' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <LinearGradient
                  colors={isDark ? ['rgba(251,191,36,0.28)', 'rgba(234,88,12,0.18)'] : ['#FEF3C7', '#FDE68A']}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="trophy" size={20} color={isDark ? '#FBBF24' : '#B45309'} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: ink, marginBottom: 0 }]}>Competition</Text>
                  <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                    Pick your content — no IDs
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEventDetailId(null)}
                  hitSlop={10}
                  style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={18} color={muted} />
                </TouchableOpacity>
              </View>
              {(() => {
                const detailEv = events.find((e) => e._id === eventDetailId);
                const allowed = normalizeAllowedMedia(
                  detailEv?.competition?.allowedMedia || detailEv?.allowedEntryMedia
                );
                const mode = detailEv?.competition?.rankMode || 'engagement';
                return (
                  <Text style={[styles.modalHint, { color: muted }]}>
                    Allowed: {formatAllowedMediaLabel(allowed)}. Ranking: {mode}. If a host removes your entry, upload a new one — counts start fresh.
                  </Text>
                );
              })()}

              {eventDetailId &&
              showcaseByEvent[eventDetailId]?.publishedAt &&
              (showcaseByEvent[eventDetailId]?.entries?.length || 0) > 0 ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.rowMeta, { color: muted, fontWeight: '700', marginBottom: 10 }]}>
                    Winner showcase
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
                    {(showcaseByEvent[eventDetailId]?.entries || []).map((entry) => {
                      const thumb = mediaThumbUri(entry.post || entry);
                      const kind =
                        entry.post?.type === 'short'
                          ? 'Short'
                          : entry.post?.type === 'long_video'
                            ? 'Video'
                            : 'Post';
                      return (
                        <View
                          key={String(entry.submissionId || entry.postId || entry.rank)}
                          style={{
                            width: 148,
                            borderRadius: 16,
                            overflow: 'hidden',
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: hairline,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                          }}
                        >
                          <View style={{ height: 168, backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                            {thumb ? (
                              <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons
                                  name={
                                    kind === 'Short'
                                      ? 'flash-outline'
                                      : kind === 'Video'
                                        ? 'videocam-outline'
                                        : 'image-outline'
                                  }
                                  size={28}
                                  color={muted}
                                />
                              </View>
                            )}
                            <LinearGradient
                              colors={['transparent', 'rgba(15,23,42,0.78)']}
                              style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: 0,
                                paddingHorizontal: 10,
                                paddingBottom: 10,
                                paddingTop: 28,
                              }}
                            >
                              <Text style={{ color: '#FDE68A', fontWeight: '800', fontSize: 12 }}>
                                #{entry.rank} · {kind}
                              </Text>
                              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                                {entry.user?.fullName || entry.user?.username || 'Winner'}
                              </Text>
                            </LinearGradient>
                          </View>
                          {entry.post?.caption ? (
                            <Text
                              style={{ color: muted, fontSize: 11, paddingHorizontal: 10, paddingVertical: 8 }}
                              numberOfLines={2}
                            >
                              {entry.post.caption}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              <Text style={[styles.rowMeta, { color: muted, fontWeight: '700', marginBottom: 8 }]}>
                Your content
              </Text>
              {myContentLoading ? (
                <ActivityIndicator color={accent} style={{ marginVertical: 16 }} />
              ) : myContent.length === 0 ? (
                <Text style={{ color: muted, marginBottom: 12, lineHeight: 20 }}>
                  No content yet. Create a post, short, or long video in Taatom, then come back to enter.
                </Text>
              ) : (
                <View style={{ gap: 8, marginBottom: 12 }}>
                  {(() => {
                    const detailEv = events.find((e) => e._id === eventDetailId);
                    const allowed = normalizeAllowedMedia(
                      detailEv?.competition?.allowedMedia || detailEv?.allowedEntryMedia
                    );
                    const filtered = myContent.filter((p) =>
                      postMatchesAllowedMedia(p.type, allowed)
                    );
                    if (filtered.length === 0) {
                      return (
                        <Text style={{ color: muted, marginBottom: 12, lineHeight: 20 }}>
                          None of your content matches this event’s allowed types ({formatAllowedMediaLabel(allowed)}).
                        </Text>
                      );
                    }
                    return (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                        {filtered.map((p) => {
                          const id = String(p._id);
                          const selected = selectedPostId === id;
                          const thumb = mediaThumbUri(p);
                          const kind =
                            p.type === 'short'
                              ? 'Short'
                              : p.type === 'long_video'
                                ? 'Video'
                                : 'Post';
                          return (
                            <TouchableOpacity
                              key={id}
                              style={{
                                width: '47%',
                                flexGrow: 1,
                                maxWidth: '48%',
                                borderRadius: 16,
                                overflow: 'hidden',
                                borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                                borderColor: selected ? accent : hairline,
                                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                              }}
                              onPress={() => {
                                setSelectedPostId(id);
                                setCompetitionFeedback((prev) =>
                                  prev?.type === 'error' ? null : prev
                                );
                              }}
                              activeOpacity={0.85}
                            >
                              <View style={{ height: 132, backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                                {thumb ? (
                                  <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons
                                      name={
                                        kind === 'Short'
                                          ? 'flash-outline'
                                          : kind === 'Video'
                                            ? 'videocam-outline'
                                            : 'image-outline'
                                      }
                                      size={26}
                                      color={muted}
                                    />
                                  </View>
                                )}
                                {(kind === 'Short' || kind === 'Video') && (
                                  <View
                                    style={{
                                      position: 'absolute',
                                      right: 8,
                                      bottom: 8,
                                      width: 28,
                                      height: 28,
                                      borderRadius: 14,
                                      backgroundColor: 'rgba(15,23,42,0.55)',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Ionicons name="play" size={14} color="#fff" />
                                  </View>
                                )}
                                {selected ? (
                                  <View
                                    style={{
                                      position: 'absolute',
                                      top: 8,
                                      right: 8,
                                      width: 24,
                                      height: 24,
                                      borderRadius: 12,
                                      backgroundColor: accent,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Ionicons name="checkmark" size={14} color="#fff" />
                                  </View>
                                ) : null}
                              </View>
                              <View style={{ padding: 10, gap: 2 }}>
                                <Text style={{ color: accent, fontSize: 10, fontWeight: '800' }}>
                                  {kind}
                                </Text>
                                <Text style={{ color: ink, fontWeight: '600', fontSize: 12 }} numberOfLines={2}>
                                  {p.caption || p.title || `${kind} entry`}
                                </Text>
                                <Text style={{ color: muted, fontSize: 10 }}>
                                  {typeof p.likesCount === 'number' ? `${p.likesCount} likes` : ''}
                                  {typeof p.viewsCount === 'number'
                                    ? `${typeof p.likesCount === 'number' ? ' · ' : ''}${p.viewsCount} views`
                                    : ''}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })()}
                </View>
              )}

              {competitionFeedback ? (
                <View
                  style={[
                    styles.feedbackBanner,
                    {
                      backgroundColor:
                        competitionFeedback.type === 'success'
                          ? isDark
                            ? 'rgba(80,200,120,0.16)'
                            : 'rgba(16,124,65,0.1)'
                          : isDark
                            ? 'rgba(248,113,113,0.16)'
                            : 'rgba(220,38,38,0.1)',
                      borderColor:
                        competitionFeedback.type === 'success'
                          ? isDark
                            ? 'rgba(80,200,120,0.35)'
                            : 'rgba(16,124,65,0.25)'
                          : isDark
                            ? 'rgba(248,113,113,0.35)'
                            : 'rgba(220,38,38,0.25)',
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      competitionFeedback.type === 'success'
                        ? 'checkmark-circle'
                        : 'alert-circle'
                    }
                    size={18}
                    color={
                      competitionFeedback.type === 'success'
                        ? isDark
                          ? '#7DDEA3'
                          : '#107C41'
                        : theme.colors.error
                    }
                  />
                  <Text
                    style={{
                      flex: 1,
                      color:
                        competitionFeedback.type === 'success'
                          ? isDark
                            ? '#7DDEA3'
                            : '#107C41'
                          : theme.colors.error,
                      fontSize: 13,
                      fontWeight: '600',
                      lineHeight: 18,
                    }}
                  >
                    {competitionFeedback.text}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setCompetitionFeedback(null)}
                    hitSlop={10}
                    accessibilityLabel="Dismiss message"
                  >
                    <Ionicons name="close" size={16} color={muted} />
                  </TouchableOpacity>
                </View>
              ) : null}

              {eventDetailId ? (
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor: accent,
                      opacity: selectedPostId && !competitionSubmitting ? 1 : 0.45,
                    },
                  ]}
                  disabled={!selectedPostId || competitionSubmitting}
                  onPress={async () => {
                    if (!selectedPostId || !eventDetailId) return;
                    setCompetitionFeedback(null);
                    setCompetitionSubmitting(true);
                    try {
                      await submitCompetitionEntry(eventDetailId, selectedPostId);
                      setSelectedPostId(null);
                      setCompetitionFeedback({
                        type: 'success',
                        text: 'Entry submitted — you’re on the leaderboard.',
                      });
                      await refreshCompetitionBoard(eventDetailId);
                      await loadTab();
                    } catch (e: any) {
                      setCompetitionFeedback({
                        type: 'error',
                        text: friendlyCompetitionError(
                          e?.message || e?.userMessage || 'Could not submit entry. Try again.'
                        ),
                      });
                    } finally {
                      setCompetitionSubmitting(false);
                    }
                  }}
                >
                  <Text style={styles.primaryBtnText}>
                    {competitionSubmitting ? 'Submitting…' : 'Submit selected entry'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <Text style={[styles.rowMeta, { color: muted, fontWeight: '700', marginTop: 16, marginBottom: 8 }]}>
                Leaderboard
              </Text>
              {leaderboard.map((row) => {
                const thumb = mediaThumbUri(row.post);
                const kind =
                  row.post?.type === 'short'
                    ? 'Short'
                    : row.post?.type === 'long_video'
                      ? 'Video'
                      : row.mode === 'team'
                        ? 'Team'
                        : 'Post';
                return (
                <View
                  key={`${row.rank}-${row.submissionId || row.team?._id}`}
                  style={[
                    styles.requestRow,
                    {
                      borderColor: hairline,
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 10,
                    },
                  ]}
                >
                  <Text style={{ color: ink, fontWeight: '800', width: 28 }}>#{row.rank}</Text>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      overflow: 'hidden',
                      backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                    }}
                  >
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons
                          name={
                            kind === 'Short'
                              ? 'flash-outline'
                              : kind === 'Video'
                                ? 'videocam-outline'
                                : 'image-outline'
                          }
                          size={18}
                          color={muted}
                        />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: ink, fontWeight: '700' }} numberOfLines={1}>
                      {row.mode === 'team'
                        ? row.team?.name || 'Team'
                        : row.user?.fullName || row.user?.username || 'Entrant'}
                    </Text>
                    <Text style={{ color: muted, fontSize: 11 }} numberOfLines={1}>
                      {kind}
                      {row.post?.caption ? ` · ${row.post.caption}` : ''}
                    </Text>
                    {row.judgeScore != null ? (
                      <Text style={{ color: accent, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                        Judge {Number(row.judgeScore).toFixed(1)}/10
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ color: muted, fontWeight: '700' }}>
                    {typeof row.metric === 'number' ? Math.round(row.metric * 10) / 10 : row.metric}
                  </Text>
                  {!!events.find((e) => e._id === eventDetailId)?.canManage &&
                  row.submissionId &&
                  eventDetailId ? (
                    <TouchableOpacity
                      onPress={() => {
                        const sid = row.submissionId!;
                        const eid = eventDetailId;
                        Alert.alert('Judge score', 'Pick a score from 1–10', [
                          ...[10, 8, 6, 4, 2].map((score) => ({
                            text: String(score),
                            onPress: async () => {
                              try {
                                await scoreCompetitionSubmission(eid, sid, score);
                                await refreshCompetitionBoard(eid);
                                setCompetitionFeedback({
                                  type: 'success',
                                  text: `Judge score saved (${score}/10). Republish winners if you want the showcase updated.`,
                                });
                              } catch (e: any) {
                                setCompetitionFeedback({
                                  type: 'error',
                                  text: friendlyCompetitionError(e?.message),
                                });
                              }
                            },
                          })),
                          { text: 'Cancel', style: 'cancel' as const },
                        ]);
                      }}
                      style={{ marginLeft: 2 }}
                    >
                      <Ionicons name="star-outline" size={16} color={accent} />
                    </TouchableOpacity>
                  ) : null}
                  {canModerate && row.submissionId && eventDetailId ? (
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          await removeCompetitionSubmission(
                            eventDetailId,
                            row.submissionId!,
                            'Removed by host'
                          );
                          setCompetitionFeedback({
                            type: 'success',
                            text: 'Entry removed. They can submit a new post.',
                          });
                          await refreshCompetitionBoard(eventDetailId);
                        } catch (e: any) {
                          setCompetitionFeedback({
                            type: 'error',
                            text: friendlyCompetitionError(
                              e?.message || e?.userMessage || 'Could not remove that entry.'
                            ),
                          });
                        }
                      }}
                    >
                      <Text style={{ color: theme.colors.error, marginLeft: 10, fontSize: 12, fontWeight: '600' }}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                );
              })}
              {leaderboard.length === 0 ? (
                <Text style={{ color: muted, textAlign: 'center', paddingVertical: 12 }}>No submissions yet</Text>
              ) : null}
              {eventDetailId ? (
                <TouchableOpacity
                  style={{ marginTop: 8, alignSelf: 'center' }}
                  onPress={() => void refreshCompetitionBoard(eventDetailId)}
                >
                  <Text style={{ color: accent, fontWeight: '600' }}>Refresh</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16, marginBottom: 10 },
  shell: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
  },
  shellHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  shellEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  shellTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  shellSubtitle: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  headerActionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  tabTrack: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    marginBottom: 10,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  list: { marginTop: 6, gap: 14 },
  eventCardPremium: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    overflow: 'hidden',
  },
  eventHero: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  dateBlock: {
    width: 56,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 26,
  },
  dateMonth: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  eventHeroBody: { flex: 1, minWidth: 0 },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  eventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  eventOverflowBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventWhen: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  eventLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  eventBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  miniBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventPrimaryCta: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  eventPrimaryCtaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
  },
  eventPrimaryCtaText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: -0.1,
  },
  eventSecondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  eventSecondaryCtaText: {
    fontWeight: '700',
    fontSize: 13,
  },
  eventRegisteredBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  eventRegisteredStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minWidth: 0,
  },
  eventRegisteredLabel: {
    flexShrink: 1,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  eventLeaveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  eventLeaveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    includeFontPadding: false,
    textAlignVertical: 'center' as const,
  },
  eventIconRail: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  eventIconBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
  },
  eventIconLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  manageRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  contentPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
  },
  contentThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1 },
  rowMeta: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  openChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ghostChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  empty: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  formSection: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  formSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  capacityBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  choiceCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  regToggle: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    fontSize: 14,
  },
  error: { marginVertical: 8, fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { borderRadius: 22, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4, letterSpacing: -0.2 },
  modalHint: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'center' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
});
