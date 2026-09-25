import CreatorSubmissionForm from "@/components/CreatorSubmissionForm";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/mitmachen/",
  title: "Dein Clip beim nächsten Kontexto-Spiel",
  description: "Zeig Kontexto in einem Clip oder Video und bewirb deinen Kanal für den Creator-Platz beim täglichen Rätsel.",
  noindex: true,
});

export default function MitmachenPage() {
  return <CreatorSubmissionForm />;
}
