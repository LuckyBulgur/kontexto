import RoomCreateClient from "@/components/rooms/RoomCreateClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  path: "/arena/create/",
  title: "Arena-Runde erstellen",
  description: "Erstelle eine Kontexto-Arena und lade Freunde per Link ein.",
  noindex: true,
});

export default function ArenaCreatePage() {
  return (
    <main>
      <RoomCreateClient preselect="royale" />
    </main>
  );
}
