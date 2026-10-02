"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROOM_UNREACHABLE_MESSAGE } from "@/lib/room-load";

/**
 * A room page whose first load never reached the server (`lib/room-load.ts`).
 * Not "this room does not exist": the round most likely still runs, so the way
 * on is a reload, not a new room.
 */
export default function RoomUnreachable() {
  return (
    <div role="alert" className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
      <p className="text-destructive">{ROOM_UNREACHABLE_MESSAGE}</p>
      <Button type="button" onClick={() => window.location.reload()}>
        <RotateCw aria-hidden="true" />
        Neu laden
      </Button>
    </div>
  );
}
