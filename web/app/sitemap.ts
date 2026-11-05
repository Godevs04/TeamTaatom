import type { MetadataRoute } from "next";
import { config } from "../lib/config";
import { API_V1_ABS } from "../lib/constants";

/** Rebuild the sitemap at most hourly. */
export const revalidate = 3600;

const LOCALE_PAGE_SIZE = 100;
const MAX_LOCALE_PAGES = 50;
const POST_PAGE_SIZE = 50;
const MAX_POST_PAGES = 20;
const FETCH_TIMEOUT_MS = 10_000;

type SitemapLocale = { _id: string; updatedAt?: string; createdAt?: string };
type SitemapPost = {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  user?: { _id?: string } | string;
};

/** Anonymous (logged-out) GET — the sitemap lists only what a public visitor can read. */
async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_V1_ABS}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchAllLocales(): Promise<SitemapLocale[]> {
  const all: SitemapLocale[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_LOCALE_PAGES; page += 1) {
    const qs = new URLSearchParams({ limit: String(LOCALE_PAGE_SIZE) });
    if (cursor) qs.set("cursor", cursor);
    const data = await getJson<{
      locales?: SitemapLocale[];
      pagination?: { hasMore?: boolean; nextCursor?: string | null };
    }>(`/locales?${qs.toString()}`);
    all.push(...(data?.locales ?? []));
    cursor = data?.pagination?.hasMore ? data.pagination.nextCursor ?? null : null;
    if (!cursor) break;
  }
  return all;
}

/** Recent photo posts from public profiles (the backend applies privacy for anonymous viewers). */
async function fetchPublicPosts(): Promise<SitemapPost[]> {
  const all: SitemapPost[] = [];
  for (let page = 1; page <= MAX_POST_PAGES; page += 1) {
    const data = await getJson<{ posts?: SitemapPost[] }>(`/posts?page=${page}&limit=${POST_PAGE_SIZE}`);
    const posts = data?.posts ?? [];
    all.push(...posts);
    if (posts.length < POST_PAGE_SIZE) break;
  }
  return all;
}

function toDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = config.webUrl;
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/locale`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/download`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/copyrights`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/child-safety`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const [locales, posts] = await Promise.all([fetchAllLocales(), fetchPublicPosts()]);

  const localeEntries: MetadataRoute.Sitemap = locales
    .filter((l) => typeof l._id === "string" && l._id)
    .map((l) => ({
      url: `${base}/locale/${l._id}`,
      lastModified: toDate(l.updatedAt) ?? toDate(l.createdAt) ?? now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  const tripEntries: MetadataRoute.Sitemap = posts
    .filter((p) => typeof p._id === "string" && p._id)
    .map((p) => ({
      url: `${base}/trip/${p._id}`,
      lastModified: toDate(p.updatedAt) ?? toDate(p.createdAt) ?? now,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

  // Public profiles = authors of the public posts above (most recent activity wins).
  const profileLastActive = new Map<string, Date>();
  for (const p of posts) {
    const userId = typeof p.user === "string" ? p.user : p.user?._id;
    if (!userId) continue;
    const when = toDate(p.createdAt) ?? now;
    const prev = profileLastActive.get(userId);
    if (!prev || when > prev) profileLastActive.set(userId, when);
  }
  const profileEntries: MetadataRoute.Sitemap = Array.from(profileLastActive, ([userId, lastModified]) => ({
    url: `${base}/profile/${userId}`,
    lastModified,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...localeEntries, ...tripEntries, ...profileEntries];
}
