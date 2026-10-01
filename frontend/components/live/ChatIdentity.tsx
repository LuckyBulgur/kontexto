import { Crown, Gem, Gift, Heart, Shield, Star, Video, type LucideIcon } from "lucide-react";
import PlatformMark from "@/components/live/PlatformMark";
import { type BadgeIcon, type BadgeView, visibleBadges } from "@/lib/live-badges";
import {
  type LiveBadge,
  type LiveBadgeCatalog,
  type LivePlatform,
  PLATFORM_NAMES,
} from "@/lib/live-types";
import { cn } from "@/lib/utils";

/** The icon for a role Twitch has no picture for, and for every TikTok role. */
const ICONS: Record<BadgeIcon, LucideIcon> = {
  streamer: Video,
  moderator: Shield,
  vip: Gem,
  subscriber: Star,
  founder: Crown,
  fan: Heart,
  supporter: Gift,
};

/**
 * One badge: Twitch's own picture when the server has it, otherwise an icon
 * that inherits the text colour. The title is the tooltip and, for a screen
 * reader, the badge itself.
 */
export function ChatBadge({ view, size = "sm" }: { view: BadgeView; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "size-5" : "size-3.5";
  if (view.picture) {
    return (
      // Twitch's CDN serves fixed sizes (18, 36, 72 px) that need no
      // optimisation, and a static export has no image optimiser to run.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={view.picture.image}
        srcSet={`${view.picture.image} 1x, ${view.picture.image_2x} 2x`}
        alt={view.title}
        title={view.title}
        width={18}
        height={18}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn(box, "shrink-0 rounded-sm")}
      />
    );
  }
  if (!view.icon) return null;
  const Icon = ICONS[view.icon];
  return (
    <span title={view.title} className="inline-flex shrink-0">
      <Icon className={box} aria-hidden="true" />
      <span className="sr-only">{view.title}</span>
    </span>
  );
}

/**
 * Who a chat line came from: the platform logo, the badges the platform
 * showed in front of the name, and the name. The logo is always there, also
 * with one chat, because the streamer reads the board next to the chat and
 * the logo says which of their chats a name is in.
 */
export default function ChatIdentity({
  name,
  platform,
  badges,
  catalog,
  size = "sm",
  className,
  nameClassName,
}: {
  name: string;
  platform: LivePlatform | null | undefined;
  badges?: readonly LiveBadge[];
  catalog: LiveBadgeCatalog;
  size?: "sm" | "lg";
  className?: string;
  nameClassName?: string;
}) {
  const views = visibleBadges(badges, catalog);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      {platform && (
        <PlatformMark
          platform={platform}
          spoken={false}
          className={size === "lg" ? "size-5" : undefined}
        />
      )}
      {views.map((view) => (
        <ChatBadge key={view.code} view={view} size={size} />
      ))}
      <span className={cn("min-w-0 truncate", nameClassName)}>{name}</span>
      {platform && <span className="sr-only">{` auf ${PLATFORM_NAMES[platform]}`}</span>}
    </span>
  );
}
