import Link from "next/link";

type GameIntroMode = "kontexto" | "wordle" | "duel" | "koop" | "wordle-duel";

type IntroSection = {
  heading: string;
  paragraphs: string[];
};

type IntroCopy = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  details: IntroSection;
  primary: string;
  links: { href: string; label: string }[];
};

const introCopy: Record<GameIntroMode, IntroCopy> = {
  kontexto: {
    eyebrow: "Bedeutung statt Buchstaben",
    title: "Kontexto: das tägliche deutsche Wort-Ratespiel",
    paragraphs: [
      "Bei Kontexto suchst du jeden Tag dasselbe geheime deutsche Wort. Du gibst Begriffe ein und bekommst einen Rang: Je kleiner die Zahl, desto näher liegt dein Tipp im Bedeutungsraum des Zielworts.",
      "Du kannst unbegrenzt oft raten, ohne Konto und ohne Installation. Wenn du das Tagesrätsel gelöst hast, kannst du im Unendlich-Modus weiterforschen oder Freunde zum Duell und Koop einladen.",
    ],
    details: {
      heading: "Was Kontexto misst",
      paragraphs: [
        "Kontexto ist kein Buchstabenrätsel und keine Suche nach einem bestimmten Wortstamm. Ein Tipp kann völlig anders aussehen als die Lösung und trotzdem nah liegen, wenn beide Begriffe in ähnlichen Zusammenhängen verwendet werden. Genau diese semantische Nähe macht aus jedem Rang einen Hinweis für den nächsten Zug.",
        "Im Hintergrund vergleicht ein deutsches fastText-Modell die Worteinbettungen von Tipp und Zielwort. Die Vektoren werden vor der Rangberechnung entzerrt, anschließend wird die Kosinus-Ähnlichkeit über den vorbereiteten Wortschatz sortiert. Die Methode, ihre Grenzen und die Auswertung echter Spielzahlen sind öffentlich dokumentiert, damit du nachvollziehen kannst, was die Zahl auf dem Bildschirm bedeutet.",
        "Der veröffentlichte Snapshot vom 15. August 2026 umfasst 868.000 Rateversuche, 10.200 gelöste Rätsel und einen Benchmark über 2.400 vorbereitete Rätsel. Diese Werte sind keine Hochrechnung und keine persönliche Statistik, sondern aggregierte Projektdaten mit offengelegter Methodik.",
        "Beim Spielen liest du einen Rang deshalb als Richtung und nicht als Schulnote. Nach einem guten Treffer lohnt sich die Suche in demselben Bedeutungsfeld, nach einem schlechten Treffer ein bewusster Wechsel zu einer anderen Kategorie. Die Spielanleitung erklärt diesen Suchprozess an Beispielen; die Daten- und Technikseiten zeigen, warum ein intuitiv naheliegendes Wort trotzdem weit entfernt liegen kann.",
      ],
    },
    primary: "Zum heutigen Rätsel",
    links: [
      { href: "/anleitung/", label: "Spielanleitung" },
      { href: "/strategie/", label: "Strategien" },
      { href: "/zahlen/", label: "Zahlen und Methodik" },
      { href: "/blog/", label: "Blog" },
    ],
  },
  wordle: {
    eyebrow: "Buchstaben statt Bedeutung",
    title: "Wördle: Wordle auf Deutsch",
    paragraphs: [
      "Wördle ist das tägliche deutsche Wortspiel mit fünf Buchstaben und sechs Versuchen. Alle spielen am selben Tag dasselbe Wort und lesen aus den Farben ab, welche Buchstaben bereits an der richtigen Stelle stehen.",
      "Die Runde ist kostenlos, ohne Anmeldung und direkt im Browser spielbar. Nach dem Tagesspiel kannst du eine Zufallsrunde starten oder ein Wördle-Duell mit Freunden erstellen.",
    ],
    details: {
      heading: "Was die Farben aussagen",
      paragraphs: [
        "Jeder Versuch grenzt die möglichen Lösungen ein: Grün markiert den richtigen Buchstaben an der richtigen Stelle, Gelb zeigt einen enthaltenen Buchstaben an einer anderen Stelle, und Grau schließt einen Buchstaben für diese Lösung aus. Dadurch entsteht eine andere Art von Information als bei Kontexto, wo die Bedeutung und nicht die Schreibweise den Hinweis liefert.",
        "Die Wördle-Wortliste ist eine eigene deutsche Auswahl. Ratewörter werden großzügiger behandelt, während Lösungen zusätzliche Filter durchlaufen. Im Blog ist erklärt, warum Umlaute fehlen, wie Zusammensetzungen behandelt werden und welche Fälle bei der Pflege der Liste korrigiert wurden.",
        "Das Tagesspiel verwendet für alle dieselbe Aufgabe und beginnt jeden Tag neu. Deine Eingaben und die persönliche Statistik bleiben lokal in deinem Browser; ein Konto ist nicht erforderlich. Wenn sechs Versuche nicht reichen oder du die Regeln der Wortliste genauer verstehen möchtest, kannst du den Unendlich-Modus nutzen und die dokumentierten Entscheidungen zur deutschen Variante nachlesen.",
        "Ein sinnvoller erster Zug testet mehrere häufige Buchstaben, ohne die späteren Farben zu ignorieren. Im normalen Modus darfst du frei probieren. Der optionale Hard Mode verlangt dagegen, dass bekannte grüne und gelbe Hinweise in folgenden Wörtern berücksichtigt werden. So kannst du dieselbe tägliche Aufgabe entweder offen erkunden oder mit einer zusätzlichen Regel spielen.",
      ],
    },
    primary: "Zum heutigen Wördle",
    links: [
      { href: "/anleitung/", label: "Spielanleitung" },
      { href: "/strategie/", label: "Strategien" },
      { href: "/blog/woerdle-wortliste-deutsch/", label: "Wortlisten erklärt" },
      { href: "/blog/", label: "Blog" },
    ],
  },
  duel: {
    eyebrow: "Kontexto mit Freunden",
    title: "Kontexto-Duell: gegen Freunde spielen",
    paragraphs: [
      "Im Kontexto-Duell sucht ihr dasselbe geheime Wort gegeneinander. Jeder rät für sich, während der beste Rang und der Fortschritt des anderen live sichtbar werden.",
      "Erstelle eine Runde, teile den Link und starte ohne Konto oder Installation. Die ausführliche Erklärung beschreibt, welche Informationen sichtbar sind und wie das Duell endet.",
    ],
    details: {
      heading: "Was im Duell sichtbar ist",
      paragraphs: [
        "Jede Person behält ihre eigene Rateliste und kann unabhängig experimentieren. Sichtbar sind der aktuelle Fortschritt und der beste erreichte Rang, nicht die Wörter, mit denen die andere Person den Weg dorthin gefunden hat. So bleibt der Wettkampf vergleichbar, ohne dass ein Zug die Lösung verrät.",
        "Eine Runde wird über einen geteilten Link geöffnet und läuft nur so lange, wie sie aktiv ist. Es gibt keine dauerhaften Profile und keine Anmeldung. Die Landingpage erklärt den Ablauf, die Datenverarbeitung und den Unterschied zum Koop-Modus, bevor du den Erstellungsdialog öffnest.",
        "Das Duell ist damit eine zweite Nutzung des eigentlichen Kontexto-Prinzips und kein eigener Zufallsgenerator: Alle Teilnehmenden spielen auf dasselbe Zielwort und erhalten dieselbe Ranglogik wie im Einzelspiel. Der Vergleich findet über den Fortschritt statt, nicht über Werbung oder zusätzliche Bezahlschranken. Mehrspieler-Räume und ihre Erstellungsformulare bleiben als funktionale Bereiche von den redaktionellen Seiten getrennt.",
        "Für einen fairen Vergleich zählt jeder eigene Zug sofort, aber ein hoher Rang verrät nicht den konkreten Lösungsweg der anderen Person. Du kannst deshalb Hypothesen testen, die du selbst für sinnvoll hältst, und anschließend anhand deiner Rangfolge weiterarbeiten. Die technischen Details der Runde sind bewusst knapp gehalten, damit der eigentliche Mehrwert des Duells im gemeinsamen Spielen liegt.",
      ],
    },
    primary: "Zum Duell",
    links: [
      { href: "/anleitung/", label: "Spielprinzip" },
      { href: "/blog/duell-und-koop-taktik/", label: "Duell-Taktik" },
      { href: "/faq/", label: "FAQ" },
      { href: "/blog/", label: "Blog" },
    ],
  },
  koop: {
    eyebrow: "Gemeinsam ein Wort finden",
    title: "Kontexto-Koop: gemeinsam spielen",
    paragraphs: [
      "Im Koop-Modus sucht ihr gemeinsam dasselbe geheime Wort und teilt euch eine einzige Rateliste. Jeder Zug erscheint sofort mit seinem Rang bei allen Mitspielenden.",
      "Erstelle eine Runde, teile den Link und rätselt zusammen, ohne Konto oder Installation. Die ausführliche Erklärung zeigt den Unterschied zum Duell und erklärt, wie eure gemeinsame Liste funktioniert.",
    ],
    details: {
      heading: "Was im Koop geteilt wird",
      paragraphs: [
        "Im Koop ist jeder Tipp ein gemeinsamer Messpunkt. Ein guter Rang kann eine neue Richtung öffnen, ein schlechter Rang zeigt der Gruppe, welches Bedeutungsfeld ihr verlassen solltet. Weil die Rateliste geteilt wird, müssen nicht alle dieselben Wörter ausprobieren oder denselben Denkweg verfolgen.",
        "Die Runde braucht kein Benutzerkonto: Ihr öffnet den Link, seht den gemeinsamen Verlauf und könnt euch auf das Zielwort konzentrieren. Die ausführliche Koop-Erklärung beschreibt Lebensdauer, sichtbare Informationen und die technische Trennung von der Duell-Liste.",
        "Der Unterschied zum Duell liegt also nicht nur in der Beschriftung. Im Duell konkurrieren zwei getrennte Suchwege, im Koop baut ihr gemeinsam einen einzigen Suchweg auf. Ein Spitzname ist frei wählbar und wird nur für die laufende Runde gebraucht; dauerhafte Profile oder ein Archiv der Räume entstehen daraus nicht.",
        "Das eignet sich besonders für Gruppen, die ihre Ideen laut sammeln und die Rangliste gemeinsam lesen möchten. Ein Tipp kann dabei eine neue Richtung für alle öffnen, auch wenn die Person, die ihn eingegeben hat, das Zielwort noch nicht kennt. Sobald die Runde beendet ist, gibt es keinen dauerhaften öffentlichen Verlauf, den Suchmaschinen als eigenes Dokument einordnen müssten.",
      ],
    },
    primary: "Zum Koop",
    links: [
      { href: "/anleitung/", label: "Spielprinzip" },
      { href: "/blog/duell-und-koop-taktik/", label: "Koop-Taktik" },
      { href: "/faq/", label: "FAQ" },
      { href: "/blog/", label: "Blog" },
    ],
  },
  "wordle-duel": {
    eyebrow: "Wördle mit Freunden",
    title: "Wördle-Duell: Wordle gegen Freunde",
    paragraphs: [
      "Im Wördle-Duell habt ihr dasselbe Wort, dieselben sechs Versuche und seht den Fortschritt des anderen live. Die Buchstaben bleiben verborgen, damit die eigene Lösung nicht verraten wird.",
      "Erstelle eine Runde, teile den Link und spielt ohne Konto oder Installation. Nach der Partie könnt ihr direkt eine neue Runde starten.",
    ],
    details: {
      heading: "Der Vergleich bleibt fair",
      paragraphs: [
        "Beide Personen erhalten dieselbe Wortaufgabe und dieselben sechs Versuche. Der Fortschritt wird synchronisiert, die eingegebenen Wörter bleiben aber verborgen. Dadurch siehst du, ob du noch im Rennen bist, ohne aus der Lösung der anderen Person einen unerlaubten Hinweis zu bekommen.",
        "Das Wördle-Duell verbindet die Buchstabenlogik des Einzelspiels mit einer gemeinsamen Runde. Die Regeln der Farben stehen auf der Wördle-Seite, die technischen und datenschutzbezogenen Hinweise für geteilte Räume in der ausführlichen Duell-Erklärung.",
        "Für die Fairness zählt daher die gleiche Ausgangslage: Es gibt keine zusätzlichen Versuche für eine Person und keine abweichende Wortliste innerhalb derselben Runde. Der Raum wird über einen Link geteilt und ist für die Partie gedacht, nicht als dauerhaftes öffentliches Dokument. Nach dem Ende kannst du die Wördle-Regeln und die Hintergründe der deutschen Wortauswahl getrennt nachlesen.",
        "Die sichtbare Information bleibt auf den Spielstand begrenzt. Du erkennst, ob die andere Person bereits gelöst hat oder wie viele Versuche noch übrig sind, musst aber aus ihren geheim gehaltenen Wörtern keine Lösung ableiten. Damit bleibt die Entscheidung, welchen Buchstaben du als Nächstes testest, dein eigener Zug. Nach der Partie könnt ihr das Ergebnis direkt teilen oder eine neue Runde beginnen.",
      ],
    },
    primary: "Zum Wördle-Duell",
    links: [
      { href: "/wordle/", label: "Wördle-Regeln" },
      { href: "/blog/duell-und-koop-taktik/", label: "Duell-Taktik" },
      { href: "/faq/", label: "FAQ" },
      { href: "/blog/", label: "Blog" },
    ],
  },
};

/**
 * Compact, server-rendered publisher introduction for the game landing pages.
 * It comes before the client-side widget so a first-time visitor and a crawler
 * immediately see what the page offers, while the full explanation remains
 * below the playable area.
 */
export default function GameIntro({ mode }: { mode: GameIntroMode }) {
  const copy = introCopy[mode];

  return (
    <section
      aria-labelledby={`${mode}-intro-title`}
      className="mx-auto w-full max-w-3xl px-4 pb-2 pt-6 sm:pt-8"
    >
      <div className="rounded-2xl border bg-card px-5 py-5 shadow-sm sm:px-6 sm:py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {copy.eyebrow}
        </p>
        <h1
          id={`${mode}-intro-title`}
          className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          {copy.title}
        </h1>
        <div className="mt-3 max-w-2xl space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {copy.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <nav aria-label="Weiterführende Informationen" className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <a
            href="#spielbereich"
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {copy.primary}
          </a>
          {copy.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className="font-medium text-primary underline underline-offset-2 hover:no-underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-5 space-y-3 border-t border-border/70 pt-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">{copy.details.heading}</h2>
          {copy.details.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
