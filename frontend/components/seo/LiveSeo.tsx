import Link from "next/link";
import { Radio, MessagesSquare, MonitorPlay, ShieldCheck } from "lucide-react";
import {
  SeoSection,
  SeoHeading,
  FeatureGrid,
  FeatureCard,
  StepList,
  Step,
  RelatedLinks,
} from "@/components/seo/SeoPrimitives";
import SeoFaq from "@/components/seo/SeoFaq";
import { liveFaqs } from "@/lib/faqs";

/**
 * The content band under the stream-chat page.
 *
 * Built from the JS-free SEO primitives like every other content surface, so it
 * is complete in the static HTML: a streamer looking for a chat game finds this
 * page through search, not through the app.
 */
export default function LiveSeo() {
  return (
    <SeoSection>
      <h1 className="mb-3 text-h2 font-bold text-foreground">
        {"Kontexto mit dem Twitch-Chat spielen"}
      </h1>
      <p className="max-w-prose">
        {`Dein Chat rät mit, ohne Konto, ohne Link und ohne dass jemand die Seite öffnen muss. Du
        trägst deinen Kanalnamen ein, der Server liest den Chat mit, und jede Nachricht aus einem
        einzigen Wort landet als Versuch auf einer gemeinsamen Rateliste. Für OBS gibt es eine
        eigene Einblendung mit den letzten Treffern.`}{" "}
        <Link
          href="/modi/"
          className="font-medium text-primary underline underline-offset-2 hover:no-underline"
        >
          {"Alle Spielmodi ansehen"}
        </Link>
        {"."}
      </p>

      <SeoHeading>{"Was den Modus ausmacht"}</SeoHeading>
      <FeatureGrid>
        <FeatureCard icon={MessagesSquare} title="Raten ohne Umweg">
          {`Wer mitspielen will, tippt ein Wort in den Chat. Keine Anmeldung, kein zweiter Tab,
          kein Bot, den jemand einladen muss.`}
        </FeatureCard>
        <FeatureCard icon={Radio} title="Nur gelesen, nie geschrieben">
          {`Der Server liest anonym mit, so wie jeder Zuschauer. Er schreibt nichts in deinen Chat
          und braucht keine Rechte an deinem Kanal.`}
        </FeatureCard>
        <FeatureCard icon={MonitorPlay} title="Einblendung für OBS">
          {`Eine eigene Seite mit transparentem Hintergrund zeigt die letzten Wörter, ihre Ränge
          und wer gelöst hat. Als Browserquelle einfügen, fertig.`}
        </FeatureCard>
        <FeatureCard icon={ShieldCheck} title="Gegen Spam gebaut">
          {`Jeder Zuschauer rät höchstens alle zwei Sekunden, und ein Raum nimmt nicht mehr an,
          als auf dem Bildschirm lesbar bleibt. Beleidigende Namen werden entschärft angezeigt.`}
        </FeatureCard>
      </FeatureGrid>

      <SeoHeading>{"In drei Schritten starten"}</SeoHeading>
      <StepList>
        <Step index={1} title="Kanal eintragen">
          {`Der Kanalname oder die ganze URL, beides geht. Ein zufälliges Spiel ist voreingestellt,
          damit du das heutige Rätsel nicht vor laufender Kamera verrätst.`}
        </Step>
        <Step index={2} title="Einblendung einbinden">
          {`Den Link kopieren und in OBS als Browserquelle einfügen. Der Hintergrund bleibt
          transparent, du siehst nur die Liste.`}
        </Step>
        <Step index={3} title="Raten lassen">
          {`Sag deinem Chat Bescheid. Ein Wort pro Nachricht zählt. Wenn es zu voll wird, schaltest
          du auf Nachrichten mit dem Kürzel !k um.`}
        </Step>
      </StepList>

      <SeoHeading>{"Wenn der Chat das Wort findet"}</SeoHeading>
      <p className="max-w-prose">
        {`Sobald jemand Rang 1 trifft, ist die Runde für alle vorbei, und der Name aus dem Chat
        steht neben dem Wort. Die nächste Runde startest du selbst, damit der Stream nicht
        weiterläuft, während du gerade etwas erklärst. Dabei wechselt nur das gesuchte Wort: die
        Rangliste im Chat zählt über den ganzen Abend weiter, damit am Ende sichtbar ist, wer die
        meisten Treffer beigesteuert hat.`}
      </p>
      <p className="max-w-prose">
        {`Die Runde läuft weiter, solange dein Chat rät, auch wenn du den Tab zwischendurch
        schließt. Erst wenn eine Stunde lang niemand mehr etwas eintippt, räumt der Server sie
        ab, und dein Kanal ist wieder frei für eine neue.`}
      </p>

      <SeoHeading>{"Häufige Fragen"}</SeoHeading>
      <SeoFaq items={liveFaqs} />

      <RelatedLinks
        heading="Weiterspielen"
        label="Weitere Spielmodi und Hintergründe"
        links={[
          { href: "/koop/", label: "Koop-Modus" },
          { href: "/modi/", label: "Alle Spielmodi" },
          { href: "/anleitung/", label: "Anleitung" },
        ]}
      />
    </SeoSection>
  );
}
