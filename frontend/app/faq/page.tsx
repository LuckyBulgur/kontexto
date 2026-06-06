import TextPage from "@/components/seo/LegalLayout";
import StructuredData from "@/components/StructuredData";
import { faqSchema } from "@/lib/structured-data";
import { faqs } from "@/lib/faqs";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/faq/",
  title: "FAQ – Häufige Fragen zu Kontexto",
  description: "Antworten auf häufige Fragen zu Kontexto: Spielprinzip, Berechnung der Ähnlichkeit, neues Wort pro Tag, Farben, Kosten und der Unterschied zu Contexto.",
});

export default function FaqPage() {
  return (
    <TextPage title="Häufige Fragen (FAQ)" breadcrumbName="FAQ" path="/faq/">
      <StructuredData data={faqSchema()} />
      {faqs.map((f) => (
        <section key={f.q} className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">{f.q}</h2>
          <p>{f.a}</p>
        </section>
      ))}
    </TextPage>
  );
}
