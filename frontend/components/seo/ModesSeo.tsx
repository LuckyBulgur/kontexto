import Link from "next/link";
import {
  Clock,
  Flame,
  Layers,
  Radio,
  Shuffle,
  Swords,
  Target,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Panel } from "@/components/design";
import { Button } from "@/components/ui/button";
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
          {`Die meisten Mehrspielermodi gehen auf zwei Wegen. Mit einem Einladungslink, wenn
          du weißt, mit wem du spielen willst. Oder über die Mitspielersuche, die dich mit
          Fremden zusammenstellt, ohne dass du jemanden fragen musst. Der Stream-Chat-Modus
          braucht keinen von beiden: dort rät dein Publikum mit, wo es ohnehin schon ist.`}
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
                    ? [
                        {
                          href: mode.createHref,
                          // The stream chat is the one mode whose create link
                          // does not hand out an invite: the audience is
                          // already there, so "with friends" would misname it.
                          label: mode.queueable
                            ? "Mit Freunden spielen"
                            : "Mit deinem Chat spielen",
                        },
                      ]
                    : []),
                  ...(mode.queueHref
                    ? [{ href: mode.queueHref, label: "Gegen Fremde spielen" }]
                    : []),
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
  live: Radio,
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
    <Panel asChild className="gap-4">
      <li>
        <div className="flex items-start gap-3">
          <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h3 className="text-h3 text-foreground">{name}</h3>
            <p className="text-body text-muted-foreground">{tagline}</p>
          </div>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-small text-muted-foreground">
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <div className="mt-auto flex flex-wrap gap-2">
          {actions.map((action, index) => (
            <Button
              key={action.href}
              asChild
              size="sm"
              variant={index === 0 ? "default" : "outline"}
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        </div>
      </li>
    </Panel>
  );
}
