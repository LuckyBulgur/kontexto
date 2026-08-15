import Link from "next/link";
import ArticleLayout from "@/components/content/ArticleLayout";
import Prose from "@/components/content/Prose";
import { RelatedLinks } from "@/components/seo/SeoPrimitives";
import { buildMetadata } from "@/lib/seo";
import { legal } from "@/lib/legal";
import { AUTHOR_NAME } from "@/lib/author";

export const metadata = buildMetadata({
  path: "/kontakt/",
  title: "Kontakt",
  description:
    "So erreichst du Kontexto: E-Mail und Kontaktformular für Fehlermeldungen, Wortvorschläge, Hinweise auf ungeeignete Lösungswörter, Presseanfragen und Datenschutzauskünfte.",
});

const toc = [
  { id: "wege", label: "Kontaktwege" },
  { id: "wobei", label: "Wobei wir weiterhelfen" },
  { id: "loesungswort", label: "Ein Lösungswort melden" },
  { id: "fehler", label: "Einen Fehler melden" },
  { id: "datenschutz", label: "Datenschutzauskunft" },
];

export default function KontaktPage() {
  return (
    <ArticleLayout
      title="Kontakt"
      lead="Rückmeldungen sind ausdrücklich willkommen. Ein großer Teil dessen, was heute am Spiel funktioniert, geht auf Hinweise von Spielerinnen und Spielern zurück."
      breadcrumbName="Kontakt"
      path="/kontakt/"
      toc={toc}
    >
      <section className="space-y-4">
        <Prose>
          <h2 id="wege">Kontaktwege</h2>
          <p>
            Kontexto wird von {AUTHOR_NAME} als unabhängiges Einzelprojekt betrieben. Es gibt keine
            Hotline und kein Ticketsystem, aber jede E-Mail wird gelesen.
          </p>
          <ul>
            <li>
              <strong>E-Mail:</strong>{" "}
              <a href={`mailto:${legal.email}`}>{legal.email}</a>
            </li>
            <li>
              <strong>Kontaktformular:</strong>{" "}
              <a href={legal.contactFormUrl} target="_blank" rel="noopener noreferrer">
                Formular des Adressdienstes
              </a>{" "}
              (zweiter elektronischer Kontaktweg nach § 5 DDG)
            </li>
            <li>
              <strong>Postanschrift:</strong> im <Link href="/impressum/">Impressum</Link>
            </li>
          </ul>
          <p>
            Auf eine Antwort wartest du in der Regel wenige Tage. In Urlaubszeiten kann es länger
            dauern.
          </p>
        </Prose>
      </section>

      <section className="space-y-4">
        <Prose>
          <h2 id="wobei">Wobei wir weiterhelfen</h2>
          <p>
            Bevor du schreibst, lohnt oft ein Blick in die bestehenden Seiten. Viele Fragen sind
            dort ausführlicher beantwortet, als eine E-Mail es könnte:
          </p>
          <ul>
            <li>
              Regeln und Spielprinzip: <Link href="/anleitung/">Spielanleitung</Link>
            </li>
            <li>
              Häufige Fragen zu Farben, Geräten, Spielstand und Werbung:{" "}
              <Link href="/faq/">FAQ</Link>
            </li>
            <li>
              Ein Wort wird nicht angenommen:{" "}
              <Link href="/blog/woerter-die-kontexto-nicht-kennt/">
                Wörter, die Kontexto nicht kennt
              </Link>
            </li>
            <li>
              Ein Rang wirkt unsinnig:{" "}
              <Link href="/blog/warum-schlechter-rang/">
                Warum hat mein Wort einen schlechten Rang?
              </Link>
            </li>
            <li>
              Begriffe rund um die Technik: <Link href="/glossar/">Glossar</Link>
            </li>
          </ul>
        </Prose>
      </section>

      <section className="space-y-4">
        <Prose>
          <h2 id="loesungswort">Ein Lösungswort melden</h2>
          <p>
            Die Auswahl der Lösungswörter läuft über mehrere automatische Filter und zusätzlich über
            Sperrlisten, die von Hand gepflegt werden. Diese Listen sind ausdrücklich dafür gedacht,
            erweitert zu werden. Wenn dir ein Wort auffällt, das als Tageslösung nicht hätte kommen
            dürfen, etwa ein Eigenname, eine Marke oder ein anstößiger Ausdruck, dann schreib uns die
            Rätselnummer und das Wort.
          </p>
          <p>
            Genau so sind die bestehenden Sperrlisten entstanden. Welche Fälle das im Einzelnen
            waren, steht in{" "}
            <Link href="/blog/warum-keine-namen-mehr-als-loesungswoerter/">
              Warum keine Namen mehr als Lösungswörter auftauchen
            </Link>
            .
          </p>
        </Prose>
      </section>

      <section className="space-y-4">
        <Prose>
          <h2 id="fehler">Einen Fehler melden</h2>
          <p>
            Bei technischen Problemen helfen vier Angaben am meisten weiter, weil sich der Fehler
            damit meist ohne Rückfrage nachstellen lässt:
          </p>
          <ol>
            <li>Was hast du getan, unmittelbar bevor es passierte?</li>
            <li>Was hast du erwartet, was ist stattdessen passiert?</li>
            <li>Gerät und Browser, etwa „iPhone, Safari“ oder „Windows, Firefox“.</li>
            <li>
              Der Spielmodus: tägliches Kontexto, Wördle, Duell oder Koop. Bei Duell und Koop ist die
              sechsstellige Kennung aus der Adresszeile hilfreich.
            </li>
          </ol>
          <p>
            Ein Bildschirmfoto ersetzt die ersten beiden Punkte oft vollständig.
          </p>
        </Prose>
      </section>

      <section className="space-y-4">
        <Prose>
          <h2 id="datenschutz">Datenschutzauskunft</h2>
          <p>
            Anfragen nach der Datenschutz-Grundverordnung gehen an dieselbe Adresse. Ein Hinweis
            vorab, der die meisten Anfragen erübrigt: Kontexto führt keine Nutzerkonten und speichert
            keine personenbezogenen Profile. Dein Spielstand liegt ausschließlich lokal in deinem
            Browser, und die Reichweitenmessung arbeitet mit anonymisierten Summen ohne
            wiedererkennbare Kennung.
          </p>
          <p>
            Es gibt deshalb in aller Regel keine zu dir gespeicherten Daten, über die Auskunft erteilt
            werden könnte. Die vollständigen Angaben stehen in der{" "}
            <Link href="/datenschutz/">Datenschutzerklärung</Link>, die Anbieterkennzeichnung im{" "}
            <Link href="/impressum/">Impressum</Link>.
          </p>
        </Prose>
      </section>

      <RelatedLinks
        heading="Mehr erfahren"
        label="Verwandte Seiten"
        links={[
          { href: "/ueber/", label: "Über Kontexto" },
          { href: "/changelog/", label: "Änderungen am Spiel" },
          { href: "/faq/", label: "Häufige Fragen" },
          { href: "/impressum/", label: "Impressum" },
        ]}
      />
    </ArticleLayout>
  );
}
