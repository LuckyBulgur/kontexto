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
} from "lucide-react";
import {
  FeatureCard,
  FeatureGrid,
  RelatedLinks,
  SeoHeading,
  SeoSection,
} from "@/components/seo/SeoPrimitives";
import SeoFaq from "@/components/seo/SeoFaq";
import Reveal from "@/components/motion/Reveal";
import { modesFaqs } from "@/lib/faqs";
import { MULTIPLAYER_MODES, MULTIPLAYER_MODE_ORDER } from "@/lib/multiplayer-modes";
import { SOLO_MODES, SOLO_MODE_ORDER } from "@/lib/solo-modes";
import type { QueueModeId } from "@/lib/matchmaking-types";

/**
 * The mode overview. Every word of it is server-rendered: the cards are plain
 * markup fed from the mode catalogues, so the page is complete in the static
 * HTML and readable without JavaScript. Reveal only fades a section in on
 * scroll, and only below the fold, so removing Motion would cost the animation
 * and nothing else.
 */
export default function ModesSeo() {
  return (
    <SeoSection label="Alle Spielmodi">
      <h1 className="mb-3 text-2xl font-bold text-foreground">
        {"Alle Spielmodi von Kontexto"}
      </h1>
      <p className="max-w-prose">
        {`Kontexto hat mehr als das tägliche Rätsel. Es gibt Runden gegen die Uhr, Runden
        gegen andere und Runden mit einer einzigen Regel mehr, die alles verändert. Diese
        Seite zeigt, was es gibt, wofür sich welcher Modus eignet und wo er anfängt.`}
      </p>
      <p className="mt-3 max-w-prose">
        {`Alle Modi sind kostenlos und brauchen kein Konto. Keiner von ihnen verrät das Wort
        des heutigen Tages: jede Runde zieht ein eigenes Wort aus dem Vorrat.`}
      </p>

      <SeoHeading>{"Zu zweit oder zu acht"}</SeoHeading>
      <p className="mb-4 max-w-prose">
        {`Jeder Mehrspielermodus geht auf zwei Wegen: mit einem Einladungslink, wenn du weißt,
        mit wem du spielen willst, oder über die Mitspielersuche, wenn nicht. Die Suche
        stellt dich mit Fremden zusammen, und dafür brauchst du nichts weiter als einen
        Klick.`}
      </p>
      <p className="mb-6">
        <Link
          href="/suche/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          {"Mitspieler suchen"}
        </Link>
      </p>

      <Reveal as="div">
        <ul className="grid list-none gap-4 sm:grid-cols-2">
          {MULTIPLAYER_MODE_ORDER.map((id) => (
            <ModeCard key={id} id={id} />
          ))}
        </ul>
      </Reveal>

      <SeoHeading>{"Allein, aber anders"}</SeoHeading>
      <p className="mb-4 max-w-prose">
        {`Die Solo-Modi nehmen dem täglichen Spiel jeweils eine Selbstverständlichkeit weg.
        Mal die unbegrenzten Versuche, mal das eine Ziel, mal die Möglichkeit, sich wieder
        zu entfernen. Was übrig bleibt, spielt sich jedes Mal deutlich anders.`}
      </p>

      <Reveal as="div">
        <ul className="grid list-none gap-4 sm:grid-cols-2">
          {SOLO_MODE_ORDER.map((id) => {
            const meta = SOLO_MODES[id];
            return (
              <li key={id} className="rounded-xl border bg-card p-5">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-foreground">
                  <SoloIcon id={id} />
                </div>
                <h3 className="mb-1 text-sm font-semibold text-foreground">{meta.name}</h3>
                <p className="mb-3 text-sm text-muted-foreground">{meta.tagline}</p>
                <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {meta.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
                <Link
                  href={`/solo/${meta.slug}/`}
                  className="text-sm font-medium text-primary underline underline-offset-2 hover:no-underline"
                >
                  {meta.name} spielen
                </Link>
              </li>
            );
          })}
        </ul>
      </Reveal>

      <SeoHeading>{"Womit anfangen"}</SeoHeading>
      <FeatureGrid>
        <FeatureCard icon={Target} title="Zum Kennenlernen">
          {`Das tägliche Spiel. Kein Zeitdruck, keine Begrenzung, und jeden Tag reden alle
          über dasselbe Wort.`}
        </FeatureCard>
        <FeatureCard icon={Users} title="Zu zweit auf der Couch">
          {`Koop. Eine geteilte Liste, kein Sieger, und man sieht, wie die andere Person
          denkt.`}
        </FeatureCard>
        <FeatureCard icon={Clock} title="Für zwischendurch">
          {`Sudden Death oder Blitz-Duell. Beide sind in unter zwei Minuten vorbei.`}
        </FeatureCard>
        <FeatureCard icon={Flame} title="Wenn es wehtun soll">
          {`Battle Royale oder die Zeitbonus-Jagd. Hier verliert man nicht durch ein falsches
          Wort, sondern durch Zögern.`}
        </FeatureCard>
      </FeatureGrid>

      <SeoHeading>{"Häufige Fragen zu den Modi"}</SeoHeading>
      <SeoFaq items={modesFaqs} />

      <div className="mt-10">
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
      </div>
    </SeoSection>
  );
}

const MULTIPLAYER_ICONS = {
  duel: Swords,
  koop: Users,
  wordle_duel: Layers,
  royale: Flame,
  blitz: Timer,
  timerush: Clock,
} as const;

function ModeCard({ id }: { id: QueueModeId }) {
  const meta = MULTIPLAYER_MODES[id];
  const Icon = MULTIPLAYER_ICONS[id];

  return (
    <li className="rounded-xl border bg-card p-5">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-foreground">{meta.name}</h3>
      <p className="mb-3 text-sm text-muted-foreground">{meta.tagline}</p>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {meta.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {meta.createHref && (
          <Link
            href={meta.createHref}
            className="font-medium text-primary underline underline-offset-2 hover:no-underline"
          >
            Runde erstellen
          </Link>
        )}
        <Link
          href={`/suche/?modus=${meta.id}`}
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Mitspieler suchen
        </Link>
      </div>
    </li>
  );
}

const SOLO_ICONS = {
  leiter: Target,
  limit: Timer,
  doppel: Shuffle,
  suddendeath: Flame,
} as const;

function SoloIcon({ id }: { id: keyof typeof SOLO_ICONS }) {
  const Icon = SOLO_ICONS[id];
  return <Icon className="h-5 w-5" aria-hidden="true" />;
}
