"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import ModePickerDialog from "@/components/ModePickerDialog";

/**
 * A button that asks the mode question instead of navigating to the page that
 * answers it in prose.
 *
 * Inside the game, every "other modes" used to be a link to /modi/, so a player
 * who wanted to play something else got an article to read. /modi/ is the
 * durable, crawlable version of the catalogue and stays exactly one click away,
 * from the link at the foot of the dialog. Everything else opens the dialog.
 *
 * The dialog lives here rather than in a provider: it renders nothing while
 * closed, only one of them is ever open, and a context for a single boolean
 * would be more machinery than the thing it carries.
 */
export default function ModesDialogButton({
  children,
  variant = "outline",
  className,
}: {
  children: ReactNode;
  variant?: "default" | "outline" | "secondary";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <ModePickerDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
