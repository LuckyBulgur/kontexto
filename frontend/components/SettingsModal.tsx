"use client";
import { Difficulty, SortMode } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEventTheme } from "@/lib/use-event-theme";
import PalettePicker from "@/components/PalettePicker";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  theme: "light" | "dark";
  onThemeChange: (t: "light" | "dark") => void;
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  sortMode: SortMode;
  onSortModeChange: (s: SortMode) => void;
}

export default function SettingsModal({
  open,
  onClose,
  theme,
  onThemeChange,
  difficulty,
  onDifficultyChange,
  sortMode,
  onSortModeChange,
}: SettingsModalProps) {
  const { available: eventAvailable, enabled: eventEnabled, setEnabled: setEventEnabled } = useEventTheme();
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-h3">Einstellungen</DialogTitle>
          <DialogDescription className="sr-only">Design und Schwierigkeitsgrad anpassen</DialogDescription>
        </DialogHeader>

        {/* The about section made this dialog longer than a phone screen, so
            the body scrolls rather than the page behind it. */}
        <div className="scrollbar-thin max-h-[70vh] space-y-8 overflow-y-auto pt-4">
          {/* Darstellung */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-micro font-medium text-muted-foreground">Darstellung</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <Label className="text-small font-medium">Design</Label>
              <p className="text-micro text-muted-foreground">Wechsle zwischen hellem und dunklem Design</p>
              <Select value={theme} onValueChange={(v) => onThemeChange(v as "light" | "dark")}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Hell</SelectItem>
                  <SelectItem value="dark">Dunkel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-small font-medium">Farbwelt</Label>
              <p className="text-micro text-muted-foreground">
                Die Akzentfarbe der Seite. Gr&uuml;n, Gelb und Rot der Ratebalken bleiben in jeder
                Farbwelt gleich, damit ein geteiltes Ergebnis lesbar bleibt.
              </p>
              <PalettePicker />
            </div>
          </section>

          {/* Spieloptionen */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-micro font-medium text-muted-foreground">Spieloptionen</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <Label className="text-small font-medium">Sortierung</Label>
              <p className="text-micro text-muted-foreground">Reihenfolge der geratenen W&ouml;rter in der Liste</p>
              <Select value={sortMode} onValueChange={(v) => onSortModeChange(v as SortMode)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rank">&Auml;hnlichkeit</SelectItem>
                  <SelectItem value="chronological">Reihenfolge</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-small font-medium">Schwierigkeitsgrad</Label>
              <p className="text-micro text-muted-foreground">Bestimmt wie nah die Tipps am Zielwort sind</p>
              <Select value={difficulty} onValueChange={(v) => onDifficultyChange(v as Difficulty)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Einfach</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="hard">Schwer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* Zeitlich begrenztes WM-2026-Event */}
          {eventAvailable && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-micro font-medium text-muted-foreground">Limited-Time-Event</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <Label className="text-small font-medium">WM-Design</Label>
                  <p className="text-micro text-muted-foreground">Fu&szlig;ball-WM-Look mit B&auml;llen im Hintergrund (zeitlich begrenzt)</p>
                </div>
                <Switch checked={eventEnabled} onCheckedChange={setEventEnabled} aria-label="WM-Design" />
              </div>
            </section>
          )}
          {/* Was its own menu entry and its own dialog. It is read once, so it
              sits at the end of the settings rather than in the menu every
              player passes several times a day. */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-micro font-medium text-muted-foreground">Über Kontexto</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-4 text-small text-muted-foreground">
              <p>
                <strong className="text-foreground">Kontexto</strong> ist ein deutschsprachiges Wortratespiel, inspiriert von{" "}
                <a href="https://contexto.me" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                  Contexto
                </a>.
              </p>

              <div className="space-y-1">
                <h3 className="font-medium text-foreground">Technologie</h3>
                <p>
                  Die Wortähnlichkeiten werden mit{" "}
                  <a href="https://fasttext.cc" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                    fastText
                  </a>
                  -Worteinbettungen berechnet, die auf deutschen Texten trainiert wurden.
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="font-medium text-foreground">Entwicklung</h3>
                <p>Entwickelt mit Next.js, FastAPI und viel Liebe zur deutschen Sprache.</p>
                <p>
                  Von Ugur Aydogan,{" "}
                  <a href="https://github.com/LuckyBulgur" target="_blank" rel="me noopener noreferrer" className="underline hover:text-foreground">
                    GitHub
                  </a>
                  {", "}
                  <a href="https://www.linkedin.com/in/ugur-aydogan-15453224a/" target="_blank" rel="me noopener noreferrer" className="underline hover:text-foreground">
                    LinkedIn
                  </a>
                </p>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
