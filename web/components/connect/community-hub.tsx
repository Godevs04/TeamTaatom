"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Calendar,
  MessageCircle,
  Search,
  Plus,
  ChevronRight,
  Globe2,
  Lock,
  ShieldCheck,
  Home,
  Users,
  Loader2,
  Trophy,
  Settings2,
  MapPin,
  Megaphone,
  Ticket,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { getFriendlyErrorMessage } from "../../lib/auth-errors";
import { useAuth } from "../../context/auth-context";
import { getUserPosts } from "../../lib/api";
import {
  assignCommunityRole,
  createCommunityEvent,
  createEventTeam,
  createGroupChat,
  getCompetitionLeaderboard,
  inviteToGroupChat,
  joinGroupChat,
  listCommunityEvents,
  listCommunityRoles,
  listGroupChats,
  listGroupJoinRequests,
  openEventHostDm,
  registerForCommunityEvent,
  removeCompetitionSubmission,
  reviewGroupJoinRequest,
  revokeCommunityRole,
  searchCommunityMembers,
  submitCompetitionEntry,
  updateCommunityEvent,
  upsertEventCompetition,
  type AllowedEntryMedia,
  type CommunityEvent,
  type CommunityGroupChat,
  type CommunityJoinRequest,
  type CommunityMember,
  type CommunityStaffMember,
  type LeaderboardRow,
} from "../../lib/community-api";
import type { Post } from "../../types/post";

type Tab = "chats" | "events" | "find";

const ALL_ENTRY_MEDIA: AllowedEntryMedia[] = ["post", "short", "long_video"];

function normalizeAllowedMedia(
  value?: string | string[] | null
): AllowedEntryMedia[] {
  if (value == null || value === "" || value === "all" || value === "both") {
    return [...ALL_ENTRY_MEDIA];
  }
  if (Array.isArray(value)) {
    const set = new Set(
      value.filter(
        (v): v is AllowedEntryMedia =>
          v === "post" || v === "short" || v === "long_video"
      )
    );
    return ALL_ENTRY_MEDIA.filter((k) => set.has(k));
  }
  if (value === "post" || value === "short" || value === "long_video") {
    return [value];
  }
  return [...ALL_ENTRY_MEDIA];
}

function postTypeToEntryKind(postType: string | undefined): AllowedEntryMedia {
  if (postType === "short") return "short";
  if (postType === "long_video") return "long_video";
  return "post";
}

function postMatchesAllowedMedia(
  postType: string | undefined,
  allowed: AllowedEntryMedia[]
): boolean {
  if (!allowed.length) return false;
  return allowed.includes(postTypeToEntryKind(postType));
}

function formatAllowedMediaLabel(allowed: AllowedEntryMedia[]): string {
  if (allowed.length === ALL_ENTRY_MEDIA.length) return "All";
  if (!allowed.length) return "None";
  const labels: Record<AllowedEntryMedia, string> = {
    post: "Posts",
    short: "Shorts",
    long_video: "Videos",
  };
  return allowed.map((k) => labels[k]).join(" · ");
}

const PRIVACY_LABEL: Record<string, string> = {
  public: "Open to members",
  request: "Request to join",
  invite: "Invite only",
};

const MODE_LABEL: Record<string, string> = {
  individual: "Individual",
  group: "Team",
  both: "Individual or team",
};

function PrivacyIcon({ privacy, isDefault }: { privacy: string; isDefault?: boolean }) {
  if (isDefault) return <Home className="h-4 w-4" />;
  if (privacy === "invite") return <Lock className="h-4 w-4" />;
  if (privacy === "request") return <ShieldCheck className="h-4 w-4" />;
  return <Globe2 className="h-4 w-4" />;
}

export function CommunityHub({
  pageId,
  canManage,
  isMember,
  enabled,
}: {
  pageId: string;
  canManage: boolean;
  isMember: boolean;
  enabled: boolean;
}) {
  const { user } = useAuth();
  const [tab, setTab] = React.useState<Tab>("chats");
  const [loading, setLoading] = React.useState(false);
  const [myContent, setMyContent] = React.useState<Post[]>([]);
  const [myContentLoading, setMyContentLoading] = React.useState(false);
  const [selectedPostId, setSelectedPostId] = React.useState<string | null>(null);
  const [manageEventId, setManageEventId] = React.useState<string | null>(null);
  const [groupChats, setGroupChats] = React.useState<CommunityGroupChat[]>([]);
  const [events, setEvents] = React.useState<CommunityEvent[]>([]);
  const [members, setMembers] = React.useState<CommunityMember[]>([]);
  const [q, setQ] = React.useState("");
  const [chatName, setChatName] = React.useState("");
  const [chatPrivacy, setChatPrivacy] = React.useState<"public" | "request" | "invite">("public");
  const [showCreateChat, setShowCreateChat] = React.useState(false);
  const [eventTitle, setEventTitle] = React.useState("");
  const [eventDescription, setEventDescription] = React.useState("");
  const [eventStarts, setEventStarts] = React.useState("");
  const [eventEnds, setEventEnds] = React.useState("");
  const [eventLocation, setEventLocation] = React.useState("");
  const [eventMax, setEventMax] = React.useState("");
  const [eventVisibility, setEventVisibility] = React.useState<"public" | "members" | "private">("members");
  const [eventMode, setEventMode] = React.useState<"individual" | "group" | "both">("individual");
  const [eventAllowedMedia, setEventAllowedMedia] = React.useState<AllowedEntryMedia[]>([
    ...ALL_ENTRY_MEDIA,
  ]);
  const [eventRegistrationOpen, setEventRegistrationOpen] = React.useState(true);
  const [showCreateEvent, setShowCreateEvent] = React.useState(false);
  const [editingEventId, setEditingEventId] = React.useState<string | null>(null);
  const [teamEventId, setTeamEventId] = React.useState<string | null>(null);
  const [teamName, setTeamName] = React.useState("My Team");
  const [teamSize, setTeamSize] = React.useState("2");
  const [teamMemberIds, setTeamMemberIds] = React.useState<string[]>([]);
  const [teamQ, setTeamQ] = React.useState("");
  const [teamCandidates, setTeamCandidates] = React.useState<CommunityMember[]>([]);
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardRow[]>([]);
  const [activeEventId, setActiveEventId] = React.useState<string | null>(null);
  const [requests, setRequests] = React.useState<CommunityJoinRequest[]>([]);
  const [myRole, setMyRole] = React.useState<string | null>(canManage ? "owner" : null);
  const [staff, setStaff] = React.useState<CommunityStaffMember[]>([]);
  const [inviteGroupId, setInviteGroupId] = React.useState<string | null>(null);
  const [inviteQ, setInviteQ] = React.useState("");
  const [inviteCandidates, setInviteCandidates] = React.useState<CommunityMember[]>([]);
  const canManageStaff = canManage || myRole === "owner" || myRole === "admin";
  const canModerate = canManageStaff || myRole === "moderator";

  const refreshRoles = React.useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await listCommunityRoles(pageId);
      setMyRole(res.myRole || (canManage ? "owner" : null));
      setStaff(res.staff || []);
    } catch {
      /* keep prior */
    }
  }, [enabled, pageId, canManage]);

  React.useEffect(() => {
    void refreshRoles();
  }, [refreshRoles]);

  const load = React.useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      if (tab === "chats") {
        const res = await listGroupChats(pageId);
        setGroupChats(res.groupChats || []);
      } else if (tab === "events") {
        const res = await listCommunityEvents(pageId);
        setEvents(res.events || []);
      } else {
        const res = await searchCommunityMembers(pageId, q.trim());
        setMembers(res.members || []);
      }
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [enabled, pageId, tab, q]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!enabled) return null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "chats", label: "Chats", icon: <MessageCircle className="h-3.5 w-3.5" /> },
    { key: "events", label: "Events", icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: "find", label: "Find", icon: <Users className="h-3.5 w-3.5" /> },
  ];

  return (
    <section className="relative mt-6 overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br from-white via-slate-50/80 to-sky-50/40 shadow-[0_12px_40px_rgba(28,115,180,0.08)] dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900/90 dark:shadow-none">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100/80 px-4 py-4 dark:border-zinc-800/80 sm:px-5">
        <div className="min-w-0 pr-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">Community</p>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
            Spaces
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Chats, events, and people — all in one place
          </p>
        </div>
        {canManageStaff && tab === "chats" ? (
          <Button
            size="sm"
            className="h-9 shrink-0 rounded-full bg-gradient-to-r from-emerald-500 to-sky-600 px-3.5 text-xs font-semibold text-white shadow-sm"
            onClick={() => setShowCreateChat((v) => !v)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            New chat
          </Button>
        ) : null}
        {canManageStaff && tab === "events" ? (
          <Button
            size="sm"
            className="h-9 shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-3.5 text-xs font-semibold text-white shadow-sm"
            onClick={() => setShowCreateEvent((v) => !v)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            New event
          </Button>
        ) : null}
      </div>

      <div className="px-3 pt-3 sm:px-4">
        <div className="flex gap-1 rounded-xl bg-slate-100/90 p-1 dark:bg-zinc-800/70">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                tab === t.key
                  ? "bg-white text-primary shadow-sm dark:bg-zinc-900 dark:text-primary"
                  : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : null}

        {!loading && tab === "chats" ? (
          <div className="space-y-3">
            {showCreateChat && canManageStaff ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Create a chat space
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    value={chatName}
                    onChange={(e) => setChatName(e.target.value)}
                    placeholder="Chat name"
                    className="max-w-xs bg-white dark:bg-zinc-900"
                  />
                  <select
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    value={chatPrivacy}
                    onChange={(e) => setChatPrivacy(e.target.value as "public" | "request" | "invite")}
                  >
                    <option value="public">Open to members</option>
                    <option value="request">Request to join</option>
                    <option value="invite">Invite only</option>
                  </select>
                  <Button
                    size="sm"
                    className="h-10"
                    onClick={async () => {
                      try {
                        await createGroupChat(pageId, {
                          name: chatName.trim(),
                          privacy: chatPrivacy,
                          requireJoinProof: chatPrivacy === "request",
                          proofPrompt:
                            chatPrivacy === "request" ? "Please provide membership proof" : "",
                        });
                        setChatName("");
                        setShowCreateChat(false);
                        toast.success("Group chat created");
                        await load();
                      } catch (e) {
                        toast.error(getFriendlyErrorMessage(e));
                      }
                    }}
                  >
                    Create
                  </Button>
                </div>
              </div>
            ) : null}

            {groupChats.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-10 text-center dark:border-zinc-800 dark:bg-zinc-800/30">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <p className="font-semibold text-slate-900 dark:text-zinc-50">No chats yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  {canManageStaff
                    ? "Create a space for planning, updates, or hangouts."
                    : "Chats will appear here when the host opens them."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 dark:divide-zinc-800 dark:border-zinc-800">
                {groupChats.map((g) => (
                  <li
                    key={g._id}
                    className="flex flex-wrap items-center gap-3 px-3 py-3.5 transition hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 sm:px-4"
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        g.isDefault
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      <PrivacyIcon privacy={g.privacy} isDefault={g.isDefault} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-slate-900 dark:text-zinc-50">
                          {g.name}
                        </p>
                        {g.isDefault ? (
                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                            Main
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                        {PRIVACY_LABEL[g.privacy] || g.privacy}
                        {g.requireJoinProof ? " · proof" : ""} · {g.memberCount || 0} members
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {canModerate && g.privacy === "request" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs"
                          onClick={async () => {
                            try {
                              const res = await listGroupJoinRequests(g._id);
                              setRequests(res.requests || []);
                            } catch (e) {
                              toast.error(getFriendlyErrorMessage(e));
                            }
                          }}
                        >
                          Requests
                        </Button>
                      ) : null}
                      {canModerate && g.privacy === "invite" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs font-semibold text-primary"
                          onClick={() => {
                            setInviteGroupId(g._id);
                            setInviteQ("");
                            setInviteCandidates([]);
                          }}
                        >
                          Invite
                        </Button>
                      ) : null}
                      {g.isMember ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full border-primary/20 bg-primary/5 px-3 text-xs font-semibold text-primary hover:bg-primary/10"
                          asChild
                        >
                          <Link href={`/chat/room/${g.chatId}`}>
                            Open
                            <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      ) : isMember ? (
                        <Button
                          size="sm"
                          className="h-8 rounded-full px-3 text-xs"
                          disabled={g.privacy === "invite" || !!g.joinRequestPending}
                          onClick={async () => {
                            try {
                              await joinGroupChat(g._id, {
                                proofText: g.requireJoinProof ? "Membership proof" : "",
                              });
                              toast.success(g.privacy === "request" ? "Request sent" : "Joined");
                              await load();
                            } catch (e) {
                              toast.error(getFriendlyErrorMessage(e));
                            }
                          }}
                        >
                          {g.joinRequestPending
                            ? "Pending"
                            : g.privacy === "invite"
                              ? "Invite only"
                              : "Join"}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {requests.length > 0 ? (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-zinc-700">
                <p className="mb-2 text-sm font-semibold">Pending join requests</p>
                {requests.map((r) => (
                  <div key={r._id} className="mb-2 flex items-center justify-between gap-2 text-sm">
                    <span>{r.userId?.fullName || r.userId?.username || "User"}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          await reviewGroupJoinRequest(r._id, "accept");
                          setRequests((prev) => prev.filter((x) => x._id !== r._id));
                          await load();
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await reviewGroupJoinRequest(r._id, "reject");
                          setRequests((prev) => prev.filter((x) => x._id !== r._id));
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {inviteGroupId ? (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-zinc-700">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Invite to chat</p>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setInviteGroupId(null)}>
                    Close
                  </Button>
                </div>
                <div className="mb-2 flex gap-2">
                  <Input
                    value={inviteQ}
                    onChange={(e) => setInviteQ(e.target.value)}
                    placeholder="Search members"
                    className="max-w-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void searchCommunityMembers(pageId, inviteQ.trim())
                          .then((res) => setInviteCandidates(res.members || []))
                          .catch((err) => toast.error(getFriendlyErrorMessage(err)));
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await searchCommunityMembers(pageId, inviteQ.trim());
                        setInviteCandidates(res.members || []);
                      } catch (e) {
                        toast.error(getFriendlyErrorMessage(e));
                      }
                    }}
                  >
                    Search
                  </Button>
                </div>
                {inviteCandidates.map((m) => (
                  <div key={m._id} className="mb-2 flex items-center justify-between gap-2 text-sm">
                    <span>{m.fullName || m.username}</span>
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await inviteToGroupChat(inviteGroupId, m._id);
                          toast.success("Invited");
                          setInviteGroupId(null);
                          await load();
                        } catch (e) {
                          toast.error(getFriendlyErrorMessage(e));
                        }
                      }}
                    >
                      Invite
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {!loading && tab === "events" ? (
          <div className="space-y-3">
            {showCreateEvent && canManageStaff ? (
              <div className="rounded-2xl border border-dashed border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-orange-50/40 p-4 dark:border-amber-900/40 dark:from-amber-950/20 dark:to-zinc-900/40">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  {editingEventId ? "Edit event" : "Schedule an event"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Title
                    </span>
                    <Input
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      placeholder="Event title"
                      className="bg-white dark:bg-zinc-900"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Description
                    </span>
                    <Input
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      placeholder="Optional details for members"
                      className="bg-white dark:bg-zinc-900"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Starts
                    </span>
                    <Input
                      type="datetime-local"
                      value={eventStarts}
                      onChange={(e) => setEventStarts(e.target.value)}
                      className="bg-white dark:bg-zinc-900"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Ends (optional)
                    </span>
                    <Input
                      type="datetime-local"
                      value={eventEnds}
                      onChange={(e) => setEventEnds(e.target.value)}
                      className="bg-white dark:bg-zinc-900"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Location
                    </span>
                    <Input
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      placeholder="Venue or address (optional)"
                      className="bg-white dark:bg-zinc-900"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Max participants
                    </span>
                    <Input
                      type="number"
                      min={1}
                      value={eventMax}
                      onChange={(e) => setEventMax(e.target.value)}
                      placeholder="Unlimited if empty"
                      className="bg-white dark:bg-zinc-900"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Visibility
                    </span>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      value={eventVisibility}
                      onChange={(e) =>
                        setEventVisibility(e.target.value as "public" | "members" | "private")
                      }
                    >
                      <option value="members">Members only</option>
                      <option value="public">Public</option>
                      <option value="private">Request</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Who can join
                    </span>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      value={eventMode}
                      onChange={(e) =>
                        setEventMode(e.target.value as "individual" | "group" | "both")
                      }
                    >
                      <option value="individual">Individual</option>
                      <option value="group">Team</option>
                      <option value="both">Both</option>
                    </select>
                  </label>
                  <div className="sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Allowed entries
                    </span>
                    <p className="mb-2 text-xs text-slate-500">
                      Choose any mix — posts, shorts, and/or long videos
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {(
                        [
                          { key: "post" as const, label: "Posts" },
                          { key: "short" as const, label: "Shorts" },
                          { key: "long_video" as const, label: "Videos" },
                        ] as const
                      ).map((opt) => (
                        <label
                          key={opt.key}
                          className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300"
                            checked={eventAllowedMedia.includes(opt.key)}
                            onChange={() => {
                              setEventAllowedMedia((prev) => {
                                if (prev.includes(opt.key)) {
                                  return prev.filter((k) => k !== opt.key);
                                }
                                return ALL_ENTRY_MEDIA.filter(
                                  (k) => k === opt.key || prev.includes(k)
                                );
                              });
                            }}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-zinc-300 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={eventRegistrationOpen}
                      onChange={(e) => setEventRegistrationOpen(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Registration open
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <Button
                      size="sm"
                      className="h-10"
                      onClick={async () => {
                        try {
                          if (!eventStarts.trim()) throw new Error("Pick a start date and time");
                          const startsAt = new Date(eventStarts);
                          if (Number.isNaN(startsAt.getTime())) throw new Error("Invalid start time");
                          const endsRaw = eventEnds.trim();
                          const endsAt = endsRaw ? new Date(endsRaw) : null;
                          if (endsRaw && (!endsAt || Number.isNaN(endsAt.getTime()))) {
                            throw new Error("Invalid end time");
                          }
                          if (endsAt && endsAt.getTime() < startsAt.getTime()) {
                            throw new Error("End time must be after the start time");
                          }
                          if (eventAllowedMedia.length === 0) {
                            throw new Error("Select at least one allowed entry type");
                          }
                          const payload = {
                            title: eventTitle.trim(),
                            description: eventDescription.trim(),
                            startsAt: startsAt.toISOString(),
                            endsAt: endsAt ? endsAt.toISOString() : null,
                            location: { address: eventLocation.trim() },
                            maxParticipants: eventMax.trim() ? Number(eventMax.trim()) : null,
                            visibility: eventVisibility,
                            participationMode: eventMode,
                            allowedEntryMedia: eventAllowedMedia,
                            registrationOpen: eventRegistrationOpen,
                          };
                          if (editingEventId) {
                            await updateCommunityEvent(editingEventId, payload);
                            toast.success("Event updated");
                          } else {
                            await createCommunityEvent(pageId, payload);
                            toast.success("Event created");
                          }
                          setEventTitle("");
                          setEventDescription("");
                          setEventStarts("");
                          setEventEnds("");
                          setEventLocation("");
                          setEventMax("");
                          setEventAllowedMedia([...ALL_ENTRY_MEDIA]);
                          setEventRegistrationOpen(true);
                          setEditingEventId(null);
                          setShowCreateEvent(false);
                          await load();
                        } catch (e) {
                          toast.error(getFriendlyErrorMessage(e));
                        }
                      }}
                    >
                      {editingEventId ? "Save changes" : "Create event"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-10"
                      onClick={() => {
                        setShowCreateEvent(false);
                        setEditingEventId(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {events.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-10 text-center dark:border-zinc-800 dark:bg-zinc-800/30">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  <Calendar className="h-5 w-5" />
                </div>
                <p className="font-semibold text-slate-900 dark:text-zinc-50">No events yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  {canManageStaff
                    ? "Schedule a meet-up, trip, or competition for members."
                    : "Upcoming community events will show up here."}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {events.map((ev) => {
                  const starts = new Date(ev.startsAt);
                  const dayNum = starts.toLocaleDateString(undefined, { day: "numeric" });
                  const monthShort = starts
                    .toLocaleDateString(undefined, { month: "short" })
                    .toUpperCase();
                  const timeLabel = starts.toLocaleString(undefined, {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  const competitionOn = !!ev.competition?.enabled;
                  const regOpen = ev.registrationOpen !== false && ev.status !== "cancelled";
                  const canRegisterSolo =
                    !ev.isRegistered && isMember && regOpen && ev.participationMode !== "group";
                  const canCreateTeam =
                    !ev.isRegistered &&
                    isMember &&
                    regOpen &&
                    ev.participationMode !== "individual";

                  const openCompetition = async () => {
                    try {
                      setActiveEventId(ev._id);
                      setSelectedPostId(null);
                      setManageEventId(null);
                      const res = await getCompetitionLeaderboard(ev._id);
                      setLeaderboard(res.leaderboard || []);
                      if (user?._id) {
                        setMyContentLoading(true);
                        try {
                          const mine = await getUserPosts(String(user._id), 1, 40);
                          setMyContent(mine.posts || []);
                        } finally {
                          setMyContentLoading(false);
                        }
                      }
                    } catch (e) {
                      toast.error(getFriendlyErrorMessage(e));
                      setLeaderboard([]);
                    }
                  };

                  return (
                    <li
                      key={ev._id}
                      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-zinc-700/80 dark:bg-zinc-900/70 dark:shadow-none sm:p-4"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-[3.6rem] w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-amber-100 to-amber-50 dark:from-amber-500/25 dark:to-orange-500/10">
                          <span className="text-xl font-extrabold leading-none tracking-tight text-amber-900 dark:text-amber-200">
                            {dayNum}
                          </span>
                          <span className="mt-0.5 text-[10px] font-extrabold tracking-wider text-amber-700 dark:text-amber-400">
                            {monthShort}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <p className="min-w-0 flex-1 text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
                              {ev.title}
                            </p>
                            {ev.canManage ? (
                              <button
                                type="button"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                                onClick={() =>
                                  setManageEventId((id) => (id === ev._id ? null : ev._id))
                                }
                                aria-label="Manage event"
                              >
                                <Settings2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {timeLabel}
                            {"  ·  "}
                            {MODE_LABEL[ev.participationMode] || ev.participationMode}
                          </p>
                          {ev.location?.address ? (
                            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{ev.location.address}</span>
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {ev.isRegistered ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                You’re in
                              </span>
                            ) : null}
                            {competitionOn ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                                <Trophy className="h-3 w-3" />
                                {ev.competition?.rankBy === "views" ? "By views" : "By likes"}
                              </span>
                            ) : null}
                            {!regOpen ? (
                              <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                {ev.status === "cancelled" ? "Cancelled" : "Closed"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {(canRegisterSolo || canCreateTeam || ev.isRegistered) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {canRegisterSolo ? (
                            <Button
                              size="sm"
                              className="h-10 flex-1 rounded-xl bg-gradient-to-r from-teal-600 to-sky-600 text-sm font-bold text-white shadow-sm"
                              onClick={async () => {
                                try {
                                  await registerForCommunityEvent(ev._id);
                                  toast.success("Registered");
                                  await load();
                                } catch (e) {
                                  toast.error(getFriendlyErrorMessage(e));
                                }
                              }}
                            >
                              <Ticket className="mr-1.5 h-4 w-4" />
                              Register
                            </Button>
                          ) : null}
                          {canCreateTeam ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className={cn(
                                "h-10 rounded-xl text-sm font-semibold",
                                canRegisterSolo ? "px-4" : "flex-1"
                              )}
                              onClick={() => {
                                setTeamEventId(ev._id);
                                setTeamName("My Team");
                                setTeamSize("2");
                                setTeamMemberIds([]);
                                setTeamQ("");
                                setTeamCandidates([]);
                              }}
                            >
                              <Users className="mr-1.5 h-4 w-4" />
                              Create team
                            </Button>
                          ) : null}
                          {ev.isRegistered && !canRegisterSolo && !canCreateTeam ? (
                            <div className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500/10 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" />
                              You’re registered
                            </div>
                          ) : null}
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-slate-100 bg-slate-50/70 p-1 dark:border-zinc-800 dark:bg-zinc-800/40 sm:grid-cols-4">
                        {ev.chatId && (ev.isRegistered || ev.canManage) ? (
                          <Link
                            href={`/chat/room/${ev.chatId}`}
                            className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900"
                          >
                            <MessageCircle className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                            Chat
                          </Link>
                        ) : null}
                        {ev.myTeam?.chatId ? (
                          <Link
                            href={`/chat/room/${ev.myTeam.chatId}`}
                            className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900"
                          >
                            <Users className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                            Team
                          </Link>
                        ) : null}
                        {ev.announcementChatId && (ev.isRegistered || ev.canManage) ? (
                          <Link
                            href={`/chat/room/${ev.announcementChatId}`}
                            className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900"
                          >
                            <Megaphone className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                            Announce
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void openCompetition()}
                          className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900"
                        >
                          <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          {competitionOn ? "Enter" : "Compete"}
                        </button>
                        {ev.isRegistered && Array.isArray(ev.hostIds) && ev.hostIds.length > 0 ? (
                          <button
                            type="button"
                            className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900"
                            onClick={async () => {
                              try {
                                const res = await openEventHostDm(ev._id, String(ev.hostIds![0]));
                                if (res?.chatId) {
                                  window.location.href = `/chat/room/${res.chatId}`;
                                }
                              } catch (e) {
                                toast.error(getFriendlyErrorMessage(e));
                              }
                            }}
                          >
                            <MessageCircle className="h-4 w-4 text-slate-500" />
                            Host DM
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {teamEventId ? (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-zinc-700">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Create team</p>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setTeamEventId(null)}>
                    Close
                  </Button>
                </div>
                <div className="mb-2 grid gap-2 sm:grid-cols-2">
                  <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team name" />
                  <Input value={teamSize} onChange={(e) => setTeamSize(e.target.value)} placeholder="Expected size" />
                </div>
                <div className="mb-2 flex gap-2">
                  <Input
                    value={teamQ}
                    onChange={(e) => setTeamQ(e.target.value)}
                    placeholder="Search members to invite"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void searchCommunityMembers(pageId, teamQ.trim())
                          .then((res) => setTeamCandidates(res.members || []))
                          .catch((err) => toast.error(getFriendlyErrorMessage(err)));
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await searchCommunityMembers(pageId, teamQ.trim());
                        setTeamCandidates(res.members || []);
                      } catch (e) {
                        toast.error(getFriendlyErrorMessage(e));
                      }
                    }}
                  >
                    Search
                  </Button>
                </div>
                <div className="mb-3 space-y-1">
                  {teamCandidates.map((m) => {
                    const selected = teamMemberIds.includes(m._id);
                    return (
                      <button
                        key={m._id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-zinc-800"
                        onClick={() =>
                          setTeamMemberIds((prev) =>
                            selected ? prev.filter((id) => id !== m._id) : [...prev, m._id]
                          )
                        }
                      >
                        <span>{m.fullName || m.username}</span>
                        <span className="text-xs text-slate-500">{selected ? "Selected" : "Add"}</span>
                      </button>
                    );
                  })}
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await createEventTeam(teamEventId, {
                        name: teamName.trim() || "My Team",
                        expectedSize: Math.max(2, Number(teamSize) || 2),
                        memberIds: teamMemberIds,
                      });
                      toast.success("Team created — invites sent");
                      setTeamEventId(null);
                      await load();
                    } catch (e) {
                      toast.error(getFriendlyErrorMessage(e));
                    }
                  }}
                >
                  Create & invite
                </Button>
              </div>
            ) : null}

            {manageEventId ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Manage event</p>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setManageEventId(null)}>
                    Close
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-xs"
                    onClick={() => {
                      const ev = events.find((e) => e._id === manageEventId);
                      if (!ev) return;
                      setEditingEventId(ev._id);
                      setEventTitle(ev.title || "");
                      setEventDescription(ev.description || "");
                      setEventStarts(
                        ev.startsAt
                          ? (() => {
                              const d = new Date(ev.startsAt);
                              const pad = (n: number) => String(n).padStart(2, "0");
                              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                            })()
                          : ""
                      );
                      setEventEnds(
                        ev.endsAt
                          ? (() => {
                              const d = new Date(ev.endsAt);
                              const pad = (n: number) => String(n).padStart(2, "0");
                              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                            })()
                          : ""
                      );
                      setEventLocation(ev.location?.address || "");
                      setEventMax(ev.maxParticipants != null ? String(ev.maxParticipants) : "");
                      setEventVisibility(
                        (ev.visibility as "public" | "members" | "private") || "members"
                      );
                      setEventMode(ev.participationMode || "individual");
                      setEventAllowedMedia(
                        normalizeAllowedMedia(
                          ev.allowedEntryMedia || ev.competition?.allowedMedia
                        )
                      );
                      setEventRegistrationOpen(ev.registrationOpen !== false);
                      setManageEventId(null);
                      setShowCreateEvent(true);
                    }}
                  >
                    Edit details
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-xs"
                    onClick={async () => {
                      try {
                        const ev = events.find((e) => e._id === manageEventId);
                        const allowedMedia = normalizeAllowedMedia(
                          ev?.allowedEntryMedia || ev?.competition?.allowedMedia
                        );
                        await upsertEventCompetition(manageEventId, {
                          enabled: true,
                          rankBy: "likes",
                          allowedMedia,
                          submissionsOpen: true,
                        });
                        toast.success("Competition on — ranked by likes");
                        await load();
                      } catch (e) {
                        toast.error(getFriendlyErrorMessage(e));
                      }
                    }}
                  >
                    Rank by likes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-xs"
                    onClick={async () => {
                      try {
                        const ev = events.find((e) => e._id === manageEventId);
                        const allowedMedia = normalizeAllowedMedia(
                          ev?.allowedEntryMedia || ev?.competition?.allowedMedia
                        );
                        await upsertEventCompetition(manageEventId, {
                          enabled: true,
                          rankBy: "views",
                          allowedMedia,
                          submissionsOpen: true,
                        });
                        toast.success("Competition on — ranked by views");
                        await load();
                      } catch (e) {
                        toast.error(getFriendlyErrorMessage(e));
                      }
                    }}
                  >
                    Rank by views
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-xs"
                    onClick={async () => {
                      try {
                        await updateCommunityEvent(manageEventId, { registrationOpen: false });
                        toast.success("Registration closed");
                        await load();
                      } catch (e) {
                        toast.error(getFriendlyErrorMessage(e));
                      }
                    }}
                  >
                    Close entries
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-xs text-red-600"
                    onClick={async () => {
                      try {
                        await updateCommunityEvent(manageEventId, { status: "cancelled" });
                        toast.success("Event cancelled");
                        setManageEventId(null);
                        await load();
                      } catch (e) {
                        toast.error(getFriendlyErrorMessage(e));
                      }
                    }}
                  >
                    Cancel event
                  </Button>
                </div>
              </div>
            ) : null}

            {activeEventId ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Competition</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setActiveEventId(null);
                      setSelectedPostId(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
                {(() => {
                  const activeEv = events.find((e) => e._id === activeEventId);
                  const allowed = normalizeAllowedMedia(
                    activeEv?.competition?.allowedMedia || activeEv?.allowedEntryMedia
                  );
                  return (
                    <p className="mb-3 text-xs text-slate-500">
                      Allowed: {formatAllowedMediaLabel(allowed)}. Pick your content — no IDs needed.
                    </p>
                  );
                })()}
                {myContentLoading ? (
                  <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading your content…
                  </div>
                ) : myContent.length === 0 ? (
                  <p className="mb-3 text-sm text-slate-500">
                    You don’t have posts, shorts, or videos yet. Create one, then come back to enter.
                  </p>
                ) : (
                  <div className="mb-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1 dark:border-zinc-800">
                    {(() => {
                      const activeEv = events.find((e) => e._id === activeEventId);
                      const allowed = normalizeAllowedMedia(
                        activeEv?.competition?.allowedMedia || activeEv?.allowedEntryMedia
                      );
                      const filtered = myContent.filter((p) =>
                        postMatchesAllowedMedia(p.type, allowed)
                      );
                      if (filtered.length === 0) {
                        return (
                          <p className="px-2 py-3 text-sm text-slate-500">
                            None of your content matches allowed types (
                            {formatAllowedMediaLabel(allowed)}).
                          </p>
                        );
                      }
                      return filtered.map((p) => {
                      const id = String(p._id);
                      const selected = selectedPostId === id;
                      const kind =
                        p.type === "short"
                          ? "Short"
                          : p.type === "long_video"
                            ? "Video"
                            : "Post";
                      const thumb =
                        p.thumbnailUrl ||
                        p.imageUrl ||
                        (Array.isArray(p.images) ? p.images[0] : undefined) ||
                        p.mediaUrl ||
                        "";
                      const label = p.caption?.trim() || kind;
                      return (
                        <button
                          key={id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                            selected
                              ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                              : "hover:bg-slate-50 dark:hover:bg-zinc-800"
                          )}
                          onClick={() => setSelectedPostId(id)}
                        >
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-md object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs dark:bg-zinc-800">
                              {kind === "Short" ? "▶" : kind === "Video" ? "🎬" : "▣"}
                            </div>
                          )}
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          <span className="shrink-0 text-[10px] opacity-70">{kind}</span>
                        </button>
                      );
                    });
                    })()}
                  </div>
                )}
                <Button
                  size="sm"
                  className="mb-4"
                  disabled={!selectedPostId}
                  onClick={async () => {
                    if (!selectedPostId || !activeEventId) return;
                    try {
                      await submitCompetitionEntry(activeEventId, selectedPostId);
                      setSelectedPostId(null);
                      const res = await getCompetitionLeaderboard(activeEventId);
                      setLeaderboard(res.leaderboard || []);
                      toast.success("Entry submitted");
                    } catch (e) {
                      toast.error(getFriendlyErrorMessage(e));
                    }
                  }}
                >
                  Submit selected
                </Button>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Leaderboard
                </p>
                {leaderboard.length === 0 ? (
                  <p className="text-sm text-slate-500">No submissions yet</p>
                ) : (
                  leaderboard.map((row) => (
                    <div
                      key={`${row.rank}-${row.submissionId || row.team?._id}`}
                      className="flex items-center justify-between gap-2 border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-zinc-800"
                    >
                      <span className="min-w-0 truncate">
                        <span className="mr-2 font-bold text-slate-400">#{row.rank}</span>
                        {row.mode === "team"
                          ? row.team?.name || "Team"
                          : row.user?.fullName || row.user?.username || "Entrant"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{row.metric}</span>
                        {canModerate && row.submissionId ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-600"
                            onClick={async () => {
                              try {
                                await removeCompetitionSubmission(
                                  activeEventId,
                                  row.submissionId!,
                                  "Removed by host"
                                );
                                const res = await getCompetitionLeaderboard(activeEventId);
                                setLeaderboard(res.leaderboard || []);
                                toast.success("Submission removed — entrant may resubmit");
                              } catch (e) {
                                toast.error(getFriendlyErrorMessage(e));
                              }
                            }}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {!loading && tab === "find" ? (
          <div className="space-y-3">
            {canManageStaff && staff.length > 0 ? (
              <div className="rounded-xl border border-slate-100 p-3 dark:border-zinc-800">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Staff · unlimited admins & moderators
                </p>
                <ul className="space-y-2">
                  {staff.map((s) => {
                    const rawUserId = s.userId;
                    const uid = String(
                      typeof rawUserId === "object" && rawUserId
                        ? rawUserId._id || ""
                        : rawUserId || ""
                    );
                    const name = s.user?.fullName || s.user?.username || "Staff";
                    return (
                      <li key={uid} className="flex items-center justify-between gap-2 text-sm">
                        <span>
                          {name} · {s.role}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-600"
                          onClick={async () => {
                            try {
                              await revokeCommunityRole(pageId, uid);
                              toast.success("Role revoked");
                              await refreshRoles();
                              await load();
                            } catch (e) {
                              toast.error(getFriendlyErrorMessage(e));
                            }
                          }}
                        >
                          Revoke
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search members by name"
                  className="pl-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void load();
                  }}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => void load()}>
                Search
              </Button>
            </div>

            {members.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-10 text-center dark:border-zinc-800 dark:bg-zinc-800/30">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <p className="font-semibold text-slate-900 dark:text-zinc-50">Find members</p>
                <p className="mt-1 text-sm text-slate-500">
                  Search the community to connect with people here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 dark:divide-zinc-800 dark:border-zinc-800">
                {members.map((m) => {
                  const role = m.communityRole || "member";
                  const isStaff = role === "admin" || role === "moderator";
                  return (
                    <li
                      key={m._id}
                      className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4"
                    >
                      <Link
                        href={`/profile/${m._id}`}
                        className="flex min-w-0 items-center gap-3 hover:opacity-90"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {(m.fullName || m.username || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-zinc-50">
                            {m.fullName || m.username}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            @{m.username} · {role}
                          </p>
                        </div>
                      </Link>
                      {canManageStaff && role === "member" ? (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full text-xs"
                            onClick={async () => {
                              try {
                                await assignCommunityRole(pageId, m._id, "admin");
                                toast.success("Admin assigned");
                                await refreshRoles();
                                await load();
                              } catch (e) {
                                toast.error(getFriendlyErrorMessage(e));
                              }
                            }}
                          >
                            Admin
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 rounded-full text-xs"
                            onClick={async () => {
                              try {
                                await assignCommunityRole(pageId, m._id, "moderator");
                                toast.success("Moderator assigned");
                                await refreshRoles();
                                await load();
                              } catch (e) {
                                toast.error(getFriendlyErrorMessage(e));
                              }
                            }}
                          >
                            Mod
                          </Button>
                        </div>
                      ) : canManageStaff && isStaff ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 shrink-0 rounded-full text-xs text-red-600"
                          onClick={async () => {
                            try {
                              await revokeCommunityRole(pageId, m._id);
                              toast.success("Role revoked");
                              await refreshRoles();
                              await load();
                            } catch (e) {
                              toast.error(getFriendlyErrorMessage(e));
                            }
                          }}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
