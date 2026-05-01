import { api } from "./axios";
import type { Journey, JourneyCoord } from "@/types/journey";

export async function journeyStart(payload: {
  startCoords: { lat: number; lng: number };
  title?: string;
}) {
  const res = await api.post("/journey/start", payload);
  const d = res.data as { journey?: Journey };
  return d.journey as Journey;
}

export async function journeyPause(journeyId: string) {
  const res = await api.post(`/journey/${journeyId}/pause`);
  const d = res.data as { journey?: Journey };
  return d.journey as Journey;
}

export async function journeyResume(journeyId: string) {
  const res = await api.post(`/journey/${journeyId}/resume`);
  const d = res.data as { journey?: Journey };
  return d.journey as Journey;
}

export async function journeyUpdateLocation(journeyId: string, coordinates: JourneyCoord[]) {
  const res = await api.put(`/journey/${journeyId}/location`, { coordinates });
  const d = res.data as { journey?: Journey };
  return d.journey as Journey;
}

export async function journeyComplete(journeyId: string) {
  const res = await api.post(`/journey/${journeyId}/complete`);
  const d = res.data as { journey?: Journey };
  return d.journey as Journey;
}

export async function journeyGetActive() {
  const res = await api.get("/journey/active");
  const d = res.data as { journey?: Journey | null };
  return d.journey ?? null;
}

export async function journeyGetDetail(journeyId: string) {
  const res = await api.get(`/journey/${journeyId}`);
  const d = res.data as { journey?: Journey };
  return d.journey as Journey;
}

export async function journeyListForUser(userId: string, page = 1, limit = 20) {
  const res = await api.get(`/journey/user/${userId}`, {
    params: { page, limit },
  });
  const d = res.data as {
    journeys?: Journey[];
    pagination?: { currentPage?: number; totalPages?: number; totalJourneys?: number };
  };
  return {
    journeys: d.journeys ?? [],
    pagination: d.pagination,
  };
}
