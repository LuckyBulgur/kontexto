import LivePageClient from "@/components/live/LivePageClient";
import LiveSeo from "@/components/seo/LiveSeo";
import StructuredData from "@/components/StructuredData";
import { faqSchema } from "@/lib/structured-data";
import { buildMetadata } from "@/lib/seo";
import { liveFaqs } from "@/lib/faqs";

export const metadata = buildMetadata({
  path: "/live/",
  title: "Kontexto mit dem Twitch-Chat spielen",
  description:
    "Lass deinen Twitch-Chat Kontexto raten: Kanal eintragen, Chat wird mitgelesen, jedes einzelne Wort ist ein Versuch. Mit Einblendung für OBS, kostenlos und ohne Anmeldung.",
});

/**
 * One route for the whole mode.
 *
 * /live/ is the create form, /live/<id>/ is the host's board, and nginx falls
 * back to this page for both (the export writes one HTML file per route). The
 * client decides which of the two it is from the path, exactly as the koop and
 * duel routes do.
 */
export default function LivePage() {
  return (
    <>
      <StructuredData data={faqSchema(liveFaqs)} />
      <main>
        <div id="spielbereich" className="scroll-mt-4">
          <LivePageClient />
        </div>
        <LiveSeo />
      </main>
    </>
  );
}
