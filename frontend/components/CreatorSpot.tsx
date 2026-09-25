"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Music2, Radio, Video, ArrowUpRight } from "lucide-react";
import { getCreatorSpot, type CreatorPlatform, type CreatorSpot as Spot } from "@/lib/api";

const names: Record<CreatorPlatform, string> = {
  tiktok: "TikTok", youtube: "YouTube", twitch: "Twitch", instagram: "Instagram",
};

const icons = { tiktok: Music2, youtube: Video, twitch: Radio, instagram: Camera };

export default function CreatorSpot() {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getCreatorSpot().then((value) => { setSpot(value); setLoaded(true); }).catch(() => setLoaded(false));
  }, []);

  if (!loaded) return null;
  if (!spot) {
    return (
      <Link href="/mitmachen/" className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-primary/35 bg-primary/5 px-3 py-2 text-small leading-snug hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary">
        <span className="font-medium text-muted-foreground">Heute präsentiert von</span>
        <span className="font-semibold text-primary">noch niemandem · Dein Clip hier? <ArrowUpRight className="inline size-4" aria-hidden="true" /></span>
      </Link>
    );
  }
  const Icon = icons[spot.platform];
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-3 py-2 text-small leading-snug">
      <span className="font-medium text-muted-foreground">Heute präsentiert von</span>
      <a href={spot.channel_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-primary underline underline-offset-2 hover:no-underline" aria-label={`${spot.channel_name} auf ${names[spot.platform]} öffnen`}>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="text-muted-foreground">{names[spot.platform]}</span>
        <span className="break-all">{spot.channel_name}</span>
        <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
      </a>
    </div>
  );
}
