# Fonts for the Open Graph image

`app/opengraph-image.tsx` renders through Satori, which cannot reach the fonts
`next/font/google` loads for the browser: those are resolved by the bundler into
client CSS, not into a file a build step can read. Satori needs a TTF, OTF or
WOFF buffer handed to it, so the two families the product uses are kept here as
files.

They are the same two faces the pages use, pulled from the Google Fonts API at
the weights the wordmark and the subtitle are set in:

| File | Family | Weight | Used for |
|-|-|-|-|
| `BricolageGrotesque-ExtraBold.ttf` | Bricolage Grotesque | 800 | the wordmark |
| `Figtree-Regular.ttf` | Figtree | 400 | the subtitle |

They are committed rather than downloaded during the build. The Docker image
builds the frontend in its own stage, and an Open Graph image that depends on
a third party being reachable is an image that is sometimes missing.

Both are licensed under the SIL Open Font License 1.1. The repository is
public, so committing the files is redistribution, and clause 2 of the licence
asks every copy to carry the copyright notice and the licence text. The copies
served by the Google Fonts API carry the copyright in the name table but not the
licence, so `OFL.txt` next to them supplies both. Do not remove it, and add a
copyright line to it whenever a face is added here.

To refresh a face, take the `src` URL out of the stylesheet the API returns and
download it, for example:

    curl -A Mozilla "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800"

The API answers a plain user agent with TrueType, which is what Satori wants;
a browser user agent gets WOFF2, which it cannot read.
