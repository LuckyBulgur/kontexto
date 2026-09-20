import ArticleLayout from "@/components/content/ArticleLayout";
import ModesSeo from "@/components/seo/ModesSeo";
import StructuredData from "@/components/StructuredData";
import { buildMetadata } from "@/lib/seo";
import { faqSchema } from "@/lib/structured-data";
import { modesFaqs } from "@/lib/faqs";

export const metadata = buildMetadata({
  path: "/modi/",
  title: "Alle Kontexto-Spielmodi - Duell, Koop, Battle Royale und mehr",
  description:
    "Jeder Kontexto-Modus auf einen Blick: Duell, Koop, Wördle-Duell, Battle Royale, Blitz-Duell, Zeitbonus-Jagd und vier Solo-Modi. Mit Einladungslink oder gegen zufällige Mitspieler.",
});

const toc = [
  { id: "mehrspieler", label: "Zu zweit oder zu acht" },
  { id: "solo", label: "Allein, aber anders" },
  { id: "auswahl", label: "Womit anfangen" },
  { id: "fragen", label: "Häufige Fragen" },
];

export default function ModesPage() {
  return (
    <>
      <StructuredData data={faqSchema(modesFaqs)} />
      <ArticleLayout
        title="Alle Spielmodi von Kontexto"
        lead="Kontexto ist mehr als das tägliche Rätsel: Runden gegen die Uhr, Runden gegen andere und Runden mit einer einzigen Regel mehr, die alles verändert. Alle sind kostenlos, brauchen kein Konto, und keine verrät das Wort des heutigen Tages."
        breadcrumbName="Spielmodi"
        path="/modi/"
        toc={toc}
      >
        <ModesSeo />
      </ArticleLayout>
    </>
  );
}
