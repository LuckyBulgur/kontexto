/**
 * Rasterises app/icon.svg into every icon the app ships.
 *
 * The mark exists once, as vector, in app/icon.svg. Everything else is derived
 * from it here, so the favicon, the two manifest icons and the Apple touch icon
 * cannot drift apart the way the previous generation did: a green gradient tile
 * in the browser tab next to an ink-blue ring in the page header.
 *
 * No new dependency. Next already bundles Satori and Resvg for `next/og`, which
 * is the same pair a standalone rasteriser would pull in, so the SVG goes
 * through ImageResponse as a single full-bleed image.
 *
 * Run after any change to app/icon.svg:
 *
 *   pnpm icons
 *
 * The outputs are committed, because the Docker build runs `next build` without
 * this step and the static export copies public/ as it finds it.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// The ".js" is required: "next/og" is an export map entry that Next resolves
// through its bundler, and plain Node does not see it from a script.
import { ImageResponse } from "next/og.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const SOURCE = join(root, "app", "icon.svg");

/** Everything derived from the source, with the reason each one exists. */
const TARGETS = [
  // Referenced by public/manifest.json for the installed web app.
  { path: join(root, "public", "icon-192.png"), size: 192 },
  { path: join(root, "public", "icon-512.png"), size: 512 },
  // Apple ignores the manifest and the SVG icon and wants its own PNG.
  { path: join(root, "app", "apple-icon.png"), size: 180 },
  // Android applies its own mask to a maskable icon, so this one keeps square
  // corners: rounding them here and then letting the launcher round them again
  // leaves a pale seam along the edge. The ring is 320 of 512 wide and the safe
  // zone is 410, so the mark survives every mask shape without being moved.
  { path: join(root, "public", "icon-maskable-512.png"), size: 512, square: true },
];

/**
 * The sizes packed into favicon.ico.
 *
 * A modern browser takes app/icon.svg and never looks at the .ico, so this file
 * is for the clients that do not read SVG favicons and for the Windows and
 * bookmark surfaces that read the file directly. 16 and 32 are the two the
 * browser chrome actually asks for, 48 is what Windows uses in the task bar.
 */
const ICO_SIZES = [16, 32, 48];

/**
 * Renders the source SVG at one square size.
 *
 * Satori has no SVG renderer of its own; it places the file as an image and
 * hands it to Resvg, which is exactly the path we want. The data URI is base64
 * so the quotes and the hash marks in the colours survive intact.
 */
async function render(svgDataUri, size) {
  const response = new ImageResponse(
    {
      type: "div",
      props: {
        style: { display: "flex", width: size, height: size },
        children: {
          type: "img",
          props: { src: svgDataUri, width: size, height: size },
        },
      },
    },
    { width: size, height: size },
  );
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Packs PNG buffers into an ICO container.
 *
 * ICO carries either a BMP or, since Vista, a whole PNG file per entry. PNG is
 * used here: every target client understands it, and it keeps the alpha channel
 * without the inverted-mask quirk of the BMP form. A side of 256 would be
 * written as 0 in the byte, which is why the sizes above stay below it.
 */
function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;

  images.forEach(({ size, data }, index) => {
    const entry = index * 16;
    directory.writeUInt8(size, entry + 0); // width
    directory.writeUInt8(size, entry + 1); // height
    directory.writeUInt8(0, entry + 2); // palette colours, 0 = truecolour
    directory.writeUInt8(0, entry + 3); // reserved
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(data.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });

  return Buffer.concat([header, directory, ...images.map((image) => image.data)]);
}

const toDataUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

async function main() {
  const svg = await readFile(SOURCE, "utf8");
  // Satori reads the element's dimensions off the head of the SVG and renders
  // an empty image when a comment sits in front of the root tag. The comment in
  // app/icon.svg is for whoever opens the file, so it is stripped here rather
  // than left out of the source.
  const stripped = svg.replace(/<!--[\s\S]*?-->/g, "").trim();
  const dataUri = toDataUri(stripped);

  const squareDataUri = toDataUri(stripped.replace(/ rx="\d+"/, ' rx="0"'));

  for (const { path, size, square } of TARGETS) {
    await writeFile(path, await render(square ? squareDataUri : dataUri, size));
    console.log(`${relative(root, path)} (${size}x${size}${square ? ", maskable" : ""})`);
  }

  const icoImages = [];
  for (const size of ICO_SIZES) {
    icoImages.push({ size, data: await render(dataUri, size) });
  }
  const icoPath = join(root, "app", "favicon.ico");
  await writeFile(icoPath, packIco(icoImages));
  console.log(`${relative(root, icoPath)} (${ICO_SIZES.join(", ")})`);
}

await main();
