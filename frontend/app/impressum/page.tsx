import TextPage from "@/components/seo/LegalLayout";
import { buildMetadata } from "@/lib/seo";
import { legal } from "@/lib/legal";

export const metadata = buildMetadata({
  path: "/impressum/",
  title: "Impressum",
  description: "Impressum und Anbieterkennzeichnung für Kontexto gemäß § 5 DDG.",
});

export default function ImpressumPage() {
  const lines = [legal.provider, legal.name, legal.street, legal.city, legal.country].filter(Boolean);
  return (
    <TextPage title="Impressum" breadcrumbName="Impressum" path="/impressum/">
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Angaben gemäß § 5 DDG</h2>
        {lines.length ? lines.map((l) => <p key={l}>{l}</p>) : <p>Die Anbieterangaben werden vor Veröffentlichung ergänzt.</p>}
        {legal.email && <p>E-Mail: {legal.email}</p>}
        {legal.represented && <p>Vertreten durch: {legal.represented}</p>}
      </section>
    </TextPage>
  );
}
