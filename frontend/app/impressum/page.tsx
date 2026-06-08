import TextPage from "@/components/seo/LegalLayout";
import { buildMetadata } from "@/lib/seo";
import { legal } from "@/lib/legal";

export const metadata = buildMetadata({
  path: "/impressum/",
  title: "Impressum",
  description: "Impressum und Anbieterkennzeichnung für Kontexto gemäß § 5 DDG.",
});

export default function ImpressumPage() {
  const address = [legal.name, legal.careOf, legal.street, legal.city, legal.country].filter(Boolean);
  return (
    <TextPage title="Impressum" breadcrumbName="Impressum" path="/impressum/">
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Angaben gemäß § 5 DDG</h2>
        {address.length ? (
          address.map((line) => <p key={line}>{line}</p>)
        ) : (
          <p>Die Anbieterangaben werden vor Veröffentlichung ergänzt.</p>
        )}
      </section>

      {(legal.email || legal.contactFormUrl) && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Kontakt</h2>
          {legal.email && (
            <p>
              E-Mail:{" "}
              <a href={`mailto:${legal.email}`} className="underline underline-offset-2 hover:text-foreground">
                {legal.email}
              </a>
            </p>
          )}
          {legal.contactFormUrl && (
            <p>
              Zweiter Kontaktweg:{" "}
              <a
                href={legal.contactFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Kontaktformular
              </a>
            </p>
          )}
        </section>
      )}

      {legal.supervisoryAuthority && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Zuständige Aufsichtsbehörde</h2>
          <p>{legal.supervisoryAuthority}</p>
        </section>
      )}
    </TextPage>
  );
}
