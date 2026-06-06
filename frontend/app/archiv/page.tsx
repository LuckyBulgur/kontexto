import Link from "next/link";
import TextPage from "@/components/seo/LegalLayout";
import StructuredData from "@/components/StructuredData";
import { archiveListSchema } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo";
import { getArchiveEntries } from "@/lib/archive";

export const metadata = buildMetadata({
  path: "/archiv/",
  title: "Archiv – Alle vergangenen Kontexto-Rätsel & Lösungen",
  description:
    "Das Kontexto-Archiv: alle bisherigen Wort-Rätsel mit Lösung und Datum. Spiele vergangene Tage erneut oder sieh dir die Antworten an.",
});

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default async function ArchivPage() {
  const entries = await getArchiveEntries();

  return (
    <TextPage title="Rätsel-Archiv" breadcrumbName="Archiv" path="/archiv/">
      <StructuredData data={archiveListSchema(entries)} />
      <p>
        Alle vergangenen Kontexto-Rätsel mit Datum und Lösung. Das heutige Wort
        ist absichtlich nicht enthalten.
      </p>
      {entries.length === 0 ? (
        <p>Es sind noch keine vergangenen Rätsel verfügbar.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.date}>
              <Link
                href={`/archiv/${e.date}/`}
                className="text-primary underline"
              >
                {fmt(e.date)} – Rätsel #{e.gameNumber}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </TextPage>
  );
}
