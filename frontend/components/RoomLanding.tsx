"use client";

import Link from "next/link";

import ModesDialogButton from "@/components/ModesDialogButton";
import { Panel, ResultHero } from "@/components/design";
import { Button } from "@/components/ui/button";

/**
 * What a room URL shows when it names no room.
 *
 * Reached by opening `/duel/` instead of `/duel/<id>/`, usually from a stale
 * bookmark or a link that lost its id. Arena already answered this with a
 * panel and two ways out; duel and koop answered it with one grey sentence and
 * a bare link in the middle of an empty viewport, which reads as a broken page
 * rather than as a dead end with an exit. One component, so all four agree.
 */
export default function RoomLanding({
  title,
  description,
  createHref,
  createLabel,
}: {
  title: string;
  description: string;
  createHref: string;
  createLabel: string;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4">
      <Panel className="w-full">
        <ResultHero headline={title} support={description} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" asChild>
            <Link href={createHref}>{createLabel}</Link>
          </Button>
          <ModesDialogButton className="flex-1">Alle Modi ansehen</ModesDialogButton>
        </div>
      </Panel>
    </div>
  );
}
