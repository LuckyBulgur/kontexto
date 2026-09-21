import Link from "next/link";
import { Clock, Flame, Timer, Users } from "lucide-react";
import {
  FeatureCard,
  FeatureGrid,
  RelatedLinks,
  SeoHeading,
  SeoSection,
  Step,
  StepList,
} from "@/components/seo/SeoPrimitives";
import SeoFaq from "@/components/seo/SeoFaq";
import { arenaFaqs } from "@/lib/faqs";
import {
  BLITZ_SECONDS,
  ROYALE_MAX_PLAYERS,
  ROYALE_PHASE_SECONDS,
  TIMERUSH_BONUS_SECONDS,
  TIMERUSH_START_SECONDS,
} from "@/lib/arena-rules";

/**
 * The content band under the arena page. Same job as DuelSeo and KoopSeo: give
 * the three timed modes a crawlable page of their own instead of leaving
 * /arena/ as thirty words of "no round here right now" in the sitemap.
 */
export default function ArenaSeo() {
  return (
    <SeoSection label="Über die Kontexto-Arena">
      <h1 className="mb-3 text-h2 font-bold text-foreground">
        {"Die Kontexto-Arena: drei Modi mit Uhr"}
      </h1>
      <p className="max-w-prose">
        {`In der Arena läuft eine Uhr mit. Ihr ratet dasselbe geheime Wort wie im normalen
        Kontexto, aber ihr habt nicht unbegrenzt Zeit dafür, und das ändert das Spiel
        vollständig: Es zählt nicht mehr nur, ob du das Wort findest, sondern wann.`}{" "}
        <Link
          href="/suche/?modus=blitz"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          Mitspieler suchen
        </Link>
        {" oder "}
        <Link
          href="/arena/create/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          eigene Runde erstellen
        </Link>
        {". Ohne Konto, ohne Installation."}
      </p>

      <SeoHeading>{"Die drei Modi"}</SeoHeading>
      <FeatureGrid>
        <FeatureCard icon={Flame} title={`Battle Royale, bis ${ROYALE_MAX_PLAYERS} Spieler`}>
          {`Alle raten gleichzeitig. Nach ${ROYALE_PHASE_SECONDS[0]} Sekunden scheidet aus, wer am
          weitesten weg geblieben ist, danach wird die Uhr immer kürzer:
          ${ROYALE_PHASE_SECONDS.slice(1).join(", ")} Sekunden. Der Letzte gewinnt.`}
        </FeatureCard>
        <FeatureCard icon={Timer} title={`Blitz-Duell, ${BLITZ_SECONDS} Sekunden`}>
          {`Eine gemeinsame Uhr für den ganzen Raum. Wenn sie abläuft, gewinnt der beste Rang,
          nicht die meisten Versuche. Rang 1 beendet die Runde sofort.`}
        </FeatureCard>
        <FeatureCard icon={Clock} title="Zeitbonus-Jagd">
          {`Jeder hat eine eigene Uhr mit ${TIMERUSH_START_SECONDS} Sekunden. Nur ein Wort, das
          näher dran ist als dein bisher bestes, legt ${TIMERUSH_BONUS_SECONDS} Sekunden drauf.
          Bestraft wird also das Stehenbleiben, nicht der Fehlgriff.`}
        </FeatureCard>
        <FeatureCard icon={Users} title="Mit Freunden oder gegen Fremde">
          {`Jeder Modus geht auf beiden Wegen. Über einen Einladungslink startet ihr selbst,
          über die Mitspielersuche stellt der Server die Runde zusammen.`}
        </FeatureCard>
      </FeatureGrid>

      <SeoHeading>{"Wer startet die Runde"}</SeoHeading>
      <p className="max-w-prose">
        {`Das ist der Punkt, an dem sich die beiden Wege unterscheiden. In einer Runde über
        Einladungslink drückt ihr selbst auf Start, und zwar jeder von euch, nicht nur wer den
        Link erstellt hat. Eine Lobby, die nur eine Person freigeben kann, ist eine Lobby, die
        nie startet, weil genau diese Person gerade weg ist.`}
      </p>
      <p className="mt-3 max-w-prose">
        {`Bei der Mitspielersuche drückt niemand auf Start. Der Server stellt die Runde
        zusammen, sobald genug Leute warten, und beginnt von selbst. Wie viele das sind und wie
        lange er noch auf mehr wartet, steht im Wartebildschirm, damit das Warten keine
        Ratesache ist.`}
      </p>

      <SeoHeading>{"In drei Schritten starten"}</SeoHeading>
      <StepList>
        <Step index={1} title="Modus wählen">
          {"Battle Royale, Blitz-Duell oder Zeitbonus-Jagd. Jeder spielt sich anders."}
        </Step>
        <Step index={2} title="Mitspieler holen">
          {"Entweder den Link teilen oder die Suche starten und kurz warten."}
        </Step>
        <Step index={3} title="Raten, bevor die Uhr abläuft">
          {`Jedes Wort bekommt seinen Rang wie immer. Nur hast du diesmal nicht ewig Zeit,
          darüber nachzudenken.`}
        </Step>
      </StepList>

      <SeoHeading>{"Was in der Arena anders zählt"}</SeoHeading>
      <p className="max-w-prose">
        {`Im täglichen Kontexto ist ein Wort auf Rang 8000 kein verlorener Zug: Es schließt eine
        Richtung aus, und du hast beliebig viele weitere Versuche. Unter Zeitdruck stimmt das
        nicht mehr. Ein Zug, der nur ausschließt, kostet dich Sekunden, die du nicht hast.`}
      </p>
      <p className="mt-3 max-w-prose">
        {`Deshalb spielt man hier breiter statt tiefer. Statt ein Bedeutungsfeld gründlich
        abzusuchen, springt man zwischen weit auseinanderliegenden Feldern, bis eines
        auffällig gut abschneidet, und geht erst dann in die Tiefe. In der Zeitbonus-Jagd ist
        das sogar die einzige Möglichkeit weiterzuspielen, weil nur ein besseres Wort die Uhr
        zurückdreht.`}
      </p>
      <p className="mt-3 max-w-prose">
        {`Und anders als im täglichen Rätsel verrät keine Arena-Runde das Wort des Tages. Jede
        Runde zieht ein eigenes Wort aus dem Vorrat, du kannst also beliebig oft spielen,
        bevor du das Tagesrätsel angehst.`}
      </p>

      <SeoHeading>{"Häufige Fragen zur Arena"}</SeoHeading>
      <SeoFaq items={arenaFaqs} />

      <div className="mt-10">
        <RelatedLinks
          label="Weiterführende Seiten zur Arena"
          heading="Mehr zum Spiel"
          links={[
            { href: "/modi/", label: "Alle Spielmodi im Überblick" },
            { href: "/duel/", label: "Das klassische Kontexto-Duell" },
            { href: "/koop/", label: "Koop: gemeinsam statt gegeneinander" },
            { href: "/strategie/", label: "Strategien und Startwörter" },
            { href: "/", label: "Das tägliche Kontexto spielen" },
          ]}
        />
      </div>
    </SeoSection>
  );
}
