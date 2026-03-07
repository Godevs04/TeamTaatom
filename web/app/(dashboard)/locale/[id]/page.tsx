"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getLocaleById } from "../../../../lib/api";
import { Button } from "../../../../components/ui/button";
import { MapPin, ArrowLeft } from "lucide-react";
import { Skeleton } from "../../../../components/ui/skeleton";

export default function LocaleDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["locale", id],
    queryFn: () => getLocaleById(id),
    enabled: !!id,
  });

  const locale = data?.locale;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !locale) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-premium">
        <p className="text-slate-600">Locale not found.</p>
        <Button asChild variant="outline" className="mt-4 rounded-xl">
          <Link href="/locale">Back to Locales</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link href="/locale">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{locale.name}</h1>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-premium">
        <div className="aspect-[4/3] w-full bg-slate-100">
          {locale.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={locale.imageUrl} alt={locale.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <MapPin className="h-16 w-16" />
            </div>
          )}
        </div>
        <div className="p-6">
          <p className="text-sm font-medium text-slate-500">
            {[locale.stateProvince, locale.stateCode, locale.countryCode].filter(Boolean).join(" · ") || locale.countryCode}
            {locale.city ? ` · ${locale.city}` : ""}
          </p>
          {locale.description && <p className="mt-3 text-[15px] leading-6 text-slate-700">{locale.description}</p>}
          <Link href={`/search?q=${encodeURIComponent(locale.name)}`} className="mt-4 inline-block">
            <Button className="rounded-xl">Find posts at this place</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
