import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * The card every link to the site unfurls into.
 *
 * It is the wordmark, not a heading that happens to say the same thing: the
 * name is set in Bricolage Grotesque and its final o is the drawn ring, exactly
 * as components/design/Wordmark.tsx builds it in the page, down to the 0.52em
 * box and the 0.16em stroke. A share card is the one surface where a reader
 * meets the brand before the site, so it shows the same mark the tab icon and
 * the header show.
 *
 * Dark ground on purpose. The card is pasted into feeds and chat windows that
 * are dark far more often than not, and an ink-blue ring on near-black holds
 * its edge in both.
 *
 * Satori cannot reach the faces next/font/google resolves for the browser, so
 * the two files come from assets/fonts. The reason they are committed is in the
 * README next to them.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Kontexto: das tägliche deutsche Wort-Ratespiel";
export const dynamic = "force-static";

/** The wordmark's size here. Every measure below is a fraction of it. */
const NAME_SIZE = 128;

/** Token literals: an image has no stylesheet, see app/globals.css. */
const BACKGROUND = "#0e131c"; // --background, dark
const FOREGROUND = "#eff2f5"; // --foreground, dark
const MUTED = "#98a1ad"; // --muted-foreground, dark
const PRIMARY = "#2e62c9"; // --primary, dark

const round = (factor: number) => Math.round(NAME_SIZE * factor);

export default async function OgImage() {
  const fonts = join(process.cwd(), "assets", "fonts");
  const [display, sans] = await Promise.all([
    readFile(join(fonts, "BricolageGrotesque-ExtraBold.ttf")),
    readFile(join(fonts, "Figtree-Regular.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BACKGROUND,
        }}
      >
        <div
          style={{
            display: "flex",
            // The ring sits on the text baseline, not centred on the cap
            // height, which is why it is aligned to the bottom of the row and
            // then lifted by the descender.
            alignItems: "flex-end",
            fontFamily: "Bricolage Grotesque",
            fontSize: NAME_SIZE,
            letterSpacing: -4,
            color: FOREGROUND,
          }}
        >
          <div style={{ display: "flex" }}>Kontext</div>
          <div
            style={{
              width: round(0.52),
              height: round(0.52),
              marginLeft: round(0.06),
              marginBottom: round(0.2),
              borderRadius: "50%",
              border: `${round(0.16)}px solid ${PRIMARY}`,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontFamily: "Figtree",
            fontSize: 38,
            color: MUTED,
          }}
        >
          Das tägliche deutsche Wort-Ratespiel
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bricolage Grotesque", data: display, weight: 800, style: "normal" },
        { name: "Figtree", data: sans, weight: 400, style: "normal" },
      ],
    },
  );
}
