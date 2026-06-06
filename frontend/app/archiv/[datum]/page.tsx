import Link from "next/link";
import { notFound } from "next/navigation";
import TextPage from "@/components/seo/LegalLayout";
import { buildMetadata } from "@/lib/seo";
import { getArchiveEntries } from "@/lib/archive";

// Next.js static export (output: "export") requires at least one entry from
// generateStaticParams for any dynamic route. When the backend is unreachable
// (dev/CI build without a live API), getArchiveEntries() returns [] and the build
// would fail with "missing generateStaticParams". To prevent that, we inject a
// sentinel datum "__empty" whose page component calls notFound() immediately, so
// Next.js sees ≥1 entry (satisfying the export constraint) while the rendered
// output is just the 404 shell — noindexed, not linked from anywhere.
const SENTINEL = "__empty";

export async function generateStaticParams() {
  const entries = await getArchiveEntries();
  if (entries.length === 0) {
    return [{ datum: SENTINEL }];
  }
  return entries.map((e) => ({ datum: e.date }));
}

export const dynamicParams = false;

const fmt = (d: string) =>
  new Date(d).toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export async function generateMetadata({
  params,
}: {
  params: Promise<{ datum: string }>;
}) {
  const { datum } = await params;
  const e = (await getArchiveEntries()).find((x) => x.date === datum);
  if (!e) return {};
  return buildMetadata({
    path: `/archiv/${e.date}/`,
    title: `Kontexto Lösung vom ${fmt(e.date)} (#${e.gameNumber})`,
    description: `Die Lösung des Kontexto-Rätsels vom ${fmt(e.date)} (#${e.gameNumber}) und die Möglichkeit, dieses Rätsel erneut zu spielen.`,
  });
}

export default async function ArchivTag({
  params,
}: {
  params: Promise<{ datum: string }>;
}) {
  const { datum } = await params;
  const e = (await getArchiveEntries()).find((x) => x.date === datum);
  if (!e) notFound();

  return (
    <TextPage
      title={`Kontexto vom ${fmt(e.date)}`}
      breadcrumbName="Archiv"
      path={`/archiv/${e.date}/`}
      breadcrumbItems={[
        { name: "Start", path: "/" },
        { name: "Archiv", path: "/archiv/" },
        { name: fmt(e.date), path: `/archiv/${e.date}/` },
      ]}
    >
      <p>
        Rätsel <strong>#{e.gameNumber}</strong> vom {fmt(e.date)}.
      </p>
      <p>
        Die Lösung lautete:{" "}
        <strong className="text-foreground">{e.word}</strong>.
      </p>
      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
        <Link href="/" className="text-primary underline">
          Heutiges Kontexto spielen
        </Link>
        <Link href="/archiv/" className="text-primary underline">
          Zurück zum Archiv
        </Link>
      </nav>
    </TextPage>
  );
}
