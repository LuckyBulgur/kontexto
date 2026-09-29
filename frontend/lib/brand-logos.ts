/**
 * The platform logos under public/brands/, one place for every view that
 * names a platform (the creator spot, the stream-chat room and its overlay).
 * Instagram has a light variant as well, which only the creator spot shows.
 */
export type BrandPlatform = "tiktok" | "youtube" | "twitch" | "instagram";

export const BRAND_LOGOS: Record<BrandPlatform, string> = {
  tiktok: "/brands/tiktok.png",
  youtube: "/brands/youtube.png",
  twitch: "/brands/twitch.svg",
  instagram: "/brands/instagram-black.svg",
};
