import type { Metadata } from "next";
import { API_V1_ABS } from "../../../../lib/constants";
import { fetchWithAuth } from "../../../../lib/server-fetch";
import { createMetadata } from "../../../../lib/seo";
import JourneyDetailClient from "./journey-detail-client";

import type { Journey } from "../../../../types/journey";

interface JourneyWaypoint {
  post?: {
    imageUrl?: string;
    thumbnailUrl?: string;
    mediaUrl?: string;
  };
}

interface ServerJourney extends Journey {
  waypoints?: JourneyWaypoint[];
}

async function fetchJourney(id: string): Promise<ServerJourney | null> {
  const res = await fetchWithAuth(`${API_V1_ABS}/journey/${id}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { journey?: ServerJourney };
  return data.journey ?? null;
}

export async function generateMetadata({ params }: { params: { id?: string } }): Promise<Metadata> {
  const id = typeof params?.id === "string" ? params.id : "";
  if (!id) return createMetadata({ title: "Journey", path: "/journeys" });
  
  const journey = await fetchJourney(id);
  const title = journey?.title || "Journey";
  
  const dist = journey?.distanceTraveled
    ? journey.distanceTraveled >= 1000
      ? `${(journey.distanceTraveled / 1000).toFixed(1)} km`
      : `${Math.round(journey.distanceTraveled)} m`
    : "";
  
  const description = `Check out this journey on Taatom.${dist ? ` Distance traveled: ${dist}.` : ""}`;
  
  let image = null;
  if (journey?.waypoints && journey.waypoints.length > 0) {
    for (const wp of journey.waypoints) {
      if (wp?.post && (wp.post.imageUrl || wp.post.thumbnailUrl || wp.post.mediaUrl)) {
        image = wp.post.imageUrl || wp.post.thumbnailUrl || wp.post.mediaUrl;
        break;
      }
    }
  }

  return createMetadata({
    title,
    description,
    image: image ?? null,
    path: `/journeys/${id}`,
    openGraphType: "article",
    ogImageSize: { width: 1200, height: 630 },
    ogImageAlt: title,
  });
}

export default async function JourneyDetailPage({ params }: { params: { id: string } }) {
  return <JourneyDetailClient id={params.id} />;
}
