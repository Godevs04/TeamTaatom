import type { Metadata } from "next";
import { API_V1_ABS } from "../../../../lib/constants";
import { createMetadata } from "../../../../lib/seo";

type LocaleMeta = {
  name?: string;
  description?: string;
  city?: string;
  stateProvince?: string;
  country?: string;
  countryCode?: string;
  spotTypes?: string[];
  imageUrl?: string;
  imageUrls?: string[];
};

/** Public (logged-out) lookup — the locale endpoints need no auth. */
async function getLocaleForMeta(id: string): Promise<LocaleMeta | null> {
  try {
    const res = await fetch(`${API_V1_ABS}/locales/${encodeURIComponent(id)}`, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { locale?: LocaleMeta };
    return data.locale ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const locale = await getLocaleForMeta(params.id);
  if (!locale?.name) {
    return createMetadata({ title: "Place", path: `/locale/${params.id}` });
  }
  const where = [locale.city, locale.stateProvince, locale.country || locale.countryCode].filter(Boolean).join(", ");
  const spots = locale.spotTypes?.filter(Boolean).join(", ");
  const description =
    locale.description?.trim().slice(0, 300) ||
    `${locale.name}${where ? ` in ${where}` : ""}${spots ? ` — ${spots}` : ""}. Photos, travel info and directions on Taatom.`;
  return createMetadata({
    title: where ? `${locale.name}, ${where}` : locale.name,
    description,
    image: locale.imageUrls?.[0] || locale.imageUrl || null,
    path: `/locale/${params.id}`,
    openGraphType: "article",
    ogImageSize: { width: 1200, height: 630 },
    ogImageAlt: locale.name,
  });
}

export default function LocaleDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
