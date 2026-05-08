import { api } from "./axios";
import type {
  ConnectPage,
  ContentBlock,
  ConnectPagination,
  SubscriptionStatusPayload,
  PageAnalytics,
  PayoutPreview,
} from "@/types/connect";

function unwrapPagesPayload(data: Record<string, unknown>): {
  pages: ConnectPage[];
  pagination?: ConnectPagination;
} {
  return {
    pages: (data.pages as ConnectPage[]) ?? [],
    pagination: data.pagination as ConnectPagination | undefined,
  };
}

export async function connectGetCommunities(page = 1, limit = 20) {
  const res = await api.get("/connect/communities", { params: { page, limit } });
  return unwrapPagesPayload(res.data as Record<string, unknown>);
}

export async function connectGetConnectPages(page = 1, limit = 20) {
  const res = await api.get("/connect/connect-pages", { params: { page, limit } });
  return unwrapPagesPayload(res.data as Record<string, unknown>);
}

export async function connectSearchByName(q: string, page = 1, limit = 20) {
  const res = await api.get("/connect/search-by-name", {
    params: { q, page, limit },
  });
  return unwrapPagesPayload(res.data as Record<string, unknown>);
}

export async function connectGetMyPages() {
  const res = await api.get("/connect/my-pages");
  const d = res.data as { pages?: ConnectPage[] };
  return { pages: d.pages ?? [] };
}

export async function connectGetPageDetail(pageId: string) {
  const res = await api.get(`/connect/page/${pageId}`);
  const d = res.data as {
    page: ConnectPage;
    isOwner?: boolean;
    isFollowing?: boolean;
  };
  return d;
}

export async function connectFollowPage(connectPageId: string) {
  await api.post("/connect/follow", { connectPageId });
}

export async function connectUnfollowPage(connectPageId: string) {
  await api.post("/connect/unfollow", { connectPageId });
}

export async function connectRecordView(pageId: string) {
  try {
    await api.post(`/connect/page/${pageId}/view`);
  } catch {
    /* non-critical */
  }
}

export async function connectGetFollowing(page = 1, limit = 20) {
  const res = await api.get("/connect/following", { params: { page, limit } });
  return unwrapPagesPayload(res.data as Record<string, unknown>);
}

export async function connectGetArchived(page = 1, limit = 20) {
  const res = await api.get("/connect/archived", { params: { page, limit } });
  return unwrapPagesPayload(res.data as Record<string, unknown>);
}

export async function connectCreatePage(form: FormData) {
  const res = await api.post("/connect/create", form, {
    headers: { "Content-Type": undefined } as unknown as Record<string, string>,
  });
  const d = res.data as { page?: ConnectPage };
  return d.page as ConnectPage;
}

export async function connectDeletePage(pageId: string) {
  await api.delete(`/connect/page/${pageId}`);
}

export async function connectSubscribe(connectPageId: string) {
  const res = await api.post("/connect/subscribe", { connectPageId });
  return res.data as {
    subscriptionId?: string;
    cashfreeSubscriptionId?: string;
    paymentSessionId?: string;
    amount?: number;
    currency?: string;
  };
}

export async function connectGetSubscriptionStatus(connectPageId: string) {
  const res = await api.get(`/connect/subscription/status/${connectPageId}`);
  return res.data as SubscriptionStatusPayload;
}

export async function connectGetPayoutPreview(connectPageId: string): Promise<{
  preview: PayoutPreview | null;
}> {
  const res = await api.get(`/connect/subscription/payout-preview/${connectPageId}`);
  const d = res.data as { preview?: PayoutPreview | null };
  return { preview: d.preview ?? null };
}

export async function connectCancelSubscription(subscriptionId: string) {
  await api.post("/connect/subscription/cancel", { subscriptionId });
}

export async function connectGetMySubscriptions() {
  const res = await api.get("/connect/my-subscriptions");
  const d = res.data as { subscriptions?: unknown[] };
  return { subscriptions: d.subscriptions ?? [] };
}

export async function connectGetPageSubscribers(pageId: string) {
  const res = await api.get(`/connect/page/${pageId}/subscribers`);
  return res.data as {
    subscribers?: unknown[];
    totalActiveSubscribers?: number;
    monthlyRevenue?: number;
  };
}

export type ConnectFollower = {
  _id: string;
  username?: string;
  fullName?: string;
  profilePic?: string;
  role: "admin" | "member";
};

export async function connectGetPageFollowers(pageId: string, page = 1, limit = 20) {
  const res = await api.get(`/connect/page/${pageId}/followers`, { params: { page, limit } });
  const d = res.data as {
    followers?: ConnectFollower[];
    pagination?: { page: number; limit: number; total: number; totalPages: number };
  };
  return { followers: d.followers ?? [], pagination: d.pagination };
}

export async function connectGetPageAnalytics(pageId: string) {
  const res = await api.get(`/connect/page/${pageId}/analytics`);
  return res.data as PageAnalytics;
}

export async function connectFetchCurrencyConfig() {
  const res = await api.get("/connect/currency-config");
  const body = res.data as { success?: boolean; data?: unknown };
  if (body?.data && typeof body.data === "object") return body.data as Record<string, unknown>;
  return res.data as Record<string, unknown>;
}

/** Order checkout only (`payment_session_id` from pay/orders). Not for subscription `sub_session_*` — use `openCashfreeSubscriptionCheckout`. */
export function cashfreeCheckoutUrl(paymentSessionId: string): string {
  const prod =
    process.env.NEXT_PUBLIC_APP_ENV === "production" ||
    process.env.NODE_ENV === "production";
  return prod
    ? `https://payments.cashfree.com/pg/view/sessions/${paymentSessionId}`
    : `https://sandbox.cashfree.com/pg/view/sessions/${paymentSessionId}`;
}

export async function connectUpdateWebsiteContent(pageId: string, content: ContentBlock[]) {
  const res = await api.put(`/connect/page/${pageId}/website`, { content });
  const d = res.data as { websiteContent?: ContentBlock[] };
  return d.websiteContent ?? content;
}

export async function connectUpdateSubscriptionContent(pageId: string, content: ContentBlock[]) {
  const res = await api.put(`/connect/page/${pageId}/subscription`, { content });
  const d = res.data as { subscriptionContent?: ContentBlock[] };
  return d.subscriptionContent ?? content;
}
