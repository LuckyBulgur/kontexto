import LiveOverlay from "@/components/live/LiveOverlay";
import { buildMetadata } from "@/lib/seo";

// noindex: this page is a browser source for OBS, not a page anybody reads. It
// carries a token in the query and shows a single room's board, so indexing it
// would be both useless and a small leak. (Also kept out of app/sitemap.ts.)
export const metadata = buildMetadata({
  path: "/live/overlay/",
  title: "Kontexto-Einblendung für den Stream",
  description:
    "Die Einblendung für OBS: die letzten Wörter einer Stream-Chat-Runde mit ihrem Rang, auf transparentem Hintergrund.",
  noindex: true,
});

/**
 * A browser source, not a page.
 *
 * The root layout gives every route the site chrome: footer, feedback bubble,
 * toaster, ad rails, event backdrop. On a page laid over a video none of that
 * belongs there, and the first version showed the whole site footer under the
 * word list in OBS. The style below runs from the static HTML, before any
 * script, so the source never flashes the site before hiding it; a useEffect
 * would paint the footer for a frame and OBS would capture that frame.
 *
 * It hides every direct child of body except the overlay's own, which is what
 * `data-obs` marks, and makes the page itself transparent so the video shows
 * through.
 */
const BARE_PAGE = `
html, body { background: transparent !important; }
body > *:not([data-obs]) { display: none !important; }
`;

export default function LiveOverlayPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BARE_PAGE }} />
      <LiveOverlay />
    </>
  );
}
