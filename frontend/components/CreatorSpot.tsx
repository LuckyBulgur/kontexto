"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getCreatorSpot, type CreatorPlatform, type CreatorSpot as Spot } from "@/lib/api";

const names: Record<CreatorPlatform, string> = {
  tiktok: "TikTok", youtube: "YouTube", twitch: "Twitch", instagram: "Instagram",
};

const logos: Record<CreatorPlatform, string> = {
  tiktok: "/brands/tiktok.png", youtube: "/brands/youtube.png",
  twitch: "/brands/twitch.svg", instagram: "/brands/instagram-black.svg",
};

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
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border px-3 py-2 text-small leading-snug sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 font-medium text-muted-foreground">Heute präsentiert von</span>
      <div className="flex min-w-0 items-center gap-3 sm:flex-1">
        <a href={spot.channel_url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-1.5 font-semibold text-primary underline underline-offset-2 hover:no-underline" aria-label={`${spot.channel_name} auf ${names[spot.platform]} öffnen`}>
          <Image src={logos[spot.platform]} alt="" width={18} height={18} unoptimized className={`size-[18px] shrink-0 object-contain ${spot.platform === "instagram" ? "dark:hidden" : ""}`} aria-hidden="true" />
          {spot.platform === "instagram" && <Image src="/brands/instagram-white.svg" alt="" width={18} height={18} unoptimized className="hidden size-[18px] shrink-0 object-contain dark:block" aria-hidden="true" />}
          <span className="min-w-0 truncate">{spot.channel_name}</span>
        </a>
        <Link href="/mitmachen/" className="shrink-0 whitespace-nowrap text-primary underline underline-offset-2 hover:no-underline">Clip einreichen</Link>
      </div>
    </div>
  );
}
