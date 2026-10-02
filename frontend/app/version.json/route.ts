import { BUILD_ID } from "@/lib/update-check";

// Written into the static export at build time as out/version.json. An open
// tab compares it with the id it was built with (components/UpdateWatcher.tsx).
export const dynamic = "force-static";

export function GET() {
  return Response.json({ build: BUILD_ID });
}
