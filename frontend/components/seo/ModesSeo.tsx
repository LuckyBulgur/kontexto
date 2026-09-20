import Link from "next/link";
import {
  Clock,
  Flame,
  Layers,
  Shuffle,
  Swords,
  Target,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";
import Prose from "@/components/content/Prose";
import Reveal from "@/components/motion/Reveal";
import SeoFaq from "@/components/seo/SeoFaq";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import { modesFaqs } from "@/lib/faqs";
import { MULTIPLAYER_MODES, MULTIPLAYER_MODE_ORDER } from "@/lib/multiplayer-modes";
import { SOLO_MODES, SOLO_MODE_ORDER } from "@/lib/solo-modes";

/**
 * The body of /modi/, rendered inside the normal content layout so the page has
 * the site navigation, breadcrumbs and heading that every other content page
 * has. It used to be built from SeoSection, which is the band that sits *below*
 * a game and therefore brings no navigation of its own; as a whole page it
 * looked like a fragment that had lost its header, because it was one.
 *
 * Every word is server-rendered from the mode catalogues, so the page is
 * complete in the static export and readable without JavaScript. Reveal only
 * fades a section in on scroll, and only below the fold.
 */
export default function ModesSeo() {
  return (
    <>
      <Prose>
        <h2 id="mehrspieler">{"Zu zweit oder zu acht"}</h2>
        <p>
          {`Jeder Mehrspielermodus geht auf zwei Wegen. Mit einem Einladungslink, wenn du
          weißt, mit wem du spielen willst. Oder über die Mitspielersuche, die dich mit
          Fremden zusammenstellt, ohne dass du jemanden fragen musst.`}
        </p>
      </Prose>

      <Reveal as="div">
        <ul className="grid list-none gap-4 sm:grid-cols-2">
          {MULTIPLAYER_MODE_ORDER.map((id) => {
            const mode = MULTIPLAYER_MODES[id];
            return (
              <ModeCard
                key={id}
                icon={MULTIPLAYER_ICONS[id]}
                name={mode.name}
                tagline={mode.tagline}
                rules={mode.rules}
                actions={[
                  ...(mode.createHref
                    ? [{ href: mode.createHref, label: "Mit Freunden spielen" }]
                    : []),
                  { href: `/suche/?modus=${mode.id}`, label: "Gegen Fremde spielen" },
                ]}
              />
            );
          })}
        </ul>
      </Reveal>

      <Prose>
        <h2 id="solo">{"Allein, aber anders"}</h2>
        <p>
          {`Die Solo-Modi nehmen dem täglichen Spiel jeweils eine Selbstverständlichkeit
          weg. Mal die unbegrenzten Versuche, mal das eine Ziel, mal die Möglichkeit, sich
          wieder zu entfernen. Was übrig bleibt, spielt sich jedes Mal deutlich anders.`}
        </p>
      </Prose>

      <Reveal as="div">
        <ul className="grid list-none gap-4 sm:grid-cols-2">
          {SOLO_MODE_ORDER.map((id) => {
            const mode = SOLO_MODES[id];
            return (
              <ModeCard
                key={id}
                icon={SOLO_ICONS[id]}
                name={mode.name}
                tagline={mode.tagline}
                rules={mode.rules}
                actions={[{ href: `/solo/${mode.slug}/`, label: `${mode.name} spielen` }]}
              />
            );
          })}
        </ul>
      </Reveal>

      <Prose>
        <h2 id="auswahl">{"Womit anfangen"}</h2>
        <ul>
          <li>
            <strong>{"Zum Kennenlernen:"}</strong>{" "}
            {`das tägliche Spiel. Kein Zeitdruck, keine Begrenzung, und jeden Tag reden
            alle über dasselbe Wort.`}
          </li>
          <li>
            <strong>{"Zu zweit auf der Couch:"}</strong>{" "}
            {`Koop. Eine geteilte Liste, kein Sieger, und man sieht, wie die andere Person
            denkt.`}
          </li>
          <li>
            <strong>{"Für zwischendurch:"}</strong>{" "}
            {"Sudden Death oder Blitz-Duell. Beide sind in unter zwei Minuten vorbei."}
          </li>
          <li>
            <strong>{"Wenn es wehtun soll:"}</strong>{" "}
            {`Battle Royale oder die Zeitbonus-Jagd. Hier verliert man nicht durch ein
            falsches Wort, sondern durch Zögern.`}
          </li>
        </ul>
      </Prose>

      <Prose>
        <h2 id="fragen">{"Häufige Fragen zu den Modi"}</h2>
      </Prose>
      <SeoFaq items={modesFaqs} />

      <RelatedLinks
        label="Weiterführende Seiten zu den Spielmodi"
        heading="Mehr zum Spiel"
        links={[
          { href: "/", label: "Das tägliche Kontexto spielen" },
          { href: "/arena/", label: "Die Arena-Modi im Überblick" },
          { href: "/anleitung/", label: "Spielanleitung" },
          { href: "/strategie/", label: "Strategien und Startwörter" },
          { href: "/wordle/", label: "Wördle, das deutsche Wordle" },
          { href: "/faq/", label: "Alle häufigen Fragen" },
        ]}
      />
    </>
  );
}

const MULTIPLAYER_ICONS: Record<string, LucideIcon> = {
  duel: Swords,
  koop: Users,
  wordle_duel: Layers,
  royale: Flame,
  blitz: Timer,
  timerush: Clock,
};

const SOLO_ICONS: Record<string, LucideIcon> = {
  leiter: Target,
  limit: Timer,
  doppel: Shuffle,
  suddendeath: Flame,
};

function ModeCard({
  icon: Icon,
  name,
  tagline,
  rules,
  actions,
}: {
  icon: LucideIcon;
  name: string;
  tagline: string;
  rules: string[];
  /** The first one is the primary button; a mode without an invite form has one. */
  actions: { href: string; label: string }[];
}) {
  return (
    <li className="flex flex-col rounded-xl border bg-card p-5">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-foreground">{name}</h3>
      <p className="mb-3 text-sm text-muted-foreground">{tagline}</p>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap gap-2">
        {actions.map((action, index) => (
          <Link
            key={action.href}
            href={action.href}
            className={
              index === 0
                ? "rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                : "rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            }
          >
            {action.label}
          </Link>
        ))}
      </div>
    </li>
  );
}
