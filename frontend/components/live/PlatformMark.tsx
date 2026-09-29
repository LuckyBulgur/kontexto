import Image from "next/image";
import { BRAND_LOGOS } from "@/lib/brand-logos";
import { LivePlatform, PLATFORM_NAMES } from "@/lib/live-types";
import { cn } from "@/lib/utils";

/**
 * The small platform logo next to a chat name, shown once a room plays with
 * two chats (see `showsPlatformMarks`). The logo is decoration for the eye; a
 * screen reader gets the platform as words after the name.
 */
export default function PlatformMark({
  platform,
  className,
}: {
  platform: LivePlatform;
  className?: string;
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
      <span className="sr-only">{` auf ${PLATFORM_NAMES[platform]}`}</span>
    </>
  );
}
