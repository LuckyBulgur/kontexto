import Image from "next/image";
import { BRAND_LOGOS } from "@/lib/brand-logos";
import { LivePlatform, PLATFORM_NAMES } from "@/lib/live-types";
import { cn } from "@/lib/utils";

/**
 * The small platform logo next to a chat name. The logo is decoration for the
 * eye; a screen reader gets the platform as words. A caller that puts the logo
 * in front of the name passes `spoken={false}` and says the platform after
 * the name itself, so it is read as "Mara auf Twitch" and not the reverse.
 */
export default function PlatformMark({
  platform,
  className,
  spoken = true,
}: {
  platform: LivePlatform;
  className?: string;
  spoken?: boolean;
}) {
  return (
    <>
      <Image
        src={BRAND_LOGOS[platform]}
        alt=""
        width={14}
        height={14}
        unoptimized
        aria-hidden="true"
        className={cn("size-3.5 shrink-0 object-contain", className)}
      />
      {spoken && <span className="sr-only">{` auf ${PLATFORM_NAMES[platform]}`}</span>}
    </>
  );
}
