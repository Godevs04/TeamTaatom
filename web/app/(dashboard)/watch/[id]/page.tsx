import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WatchDetailClient } from "../../../../components/watch/watch-detail-client";
import { createMetadata } from "../../../../lib/seo";
import { API_V1_ABS } from "../../../../lib/constants";
import { fetchWithAuth } from "../../../../lib/server-fetch";
import type { Post } from "../../../../types/post";

async function fetchLongVideo(id: string): Promise<Post | null> {
  try {
    const res = await fetchWithAuth(`${API_V1_ABS}/long-videos/${id}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { video?: Post; post?: Post };
    return data.video ?? data.post ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id?: string };
}): Promise<Metadata> {
  const id = typeof params?.id === "string" ? params.id : "";
  if (!id) return createMetadata({ title: "Watch", path: "/watch" });
  const post = await fetchLongVideo(id);
  const title = post?.caption ? post.caption.slice(0, 60) : "Now playing";
  const image = post?.thumbnailUrl || post?.imageUrl;
  return createMetadata({
    title,
    description: "Long-form video on Taatom Videos",
    image: image ?? null,
    path: `/watch/${id}`,
    openGraphType: "article",
    ogImageSize: { width: 1200, height: 630 },
    ogImageAlt: title,
  });
}

export default async function WatchPage({ params }: { params: { id: string } }) {
  const id = typeof params.id === "string" ? params.id : "";
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
    redirect("/feed?tab=watch");
  }
  return <WatchDetailClient id={id} />;
}
