import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import createMDX from "@next/mdx";

// The app ships as a static export (`output: "export"`); dynamic duel URLs like
// `/duel/<id>/` are resolved to the single `/duel` page client-side (the page
// reads the id from window.location.pathname). In production nginx performs the
// fallback (`try_files $uri $uri/ /duel/index.html`, see nginx.conf), so Next's
// `rewrites()` are neither used nor applied there, and Next warns about that
// during the export build. We therefore enable `rewrites()` ONLY for the dev
// server, where they let a direct hit/refresh on `/duel/<id>/` resolve to the
// `/duel` page instead of 404'ing. Keeping them out of the export build makes
// the production build warning-free and the config honest about what applies.
const config = (phase: string): NextConfig => {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    output: "export",
    trailingSlash: true,
    pageExtensions: ["ts", "tsx", "mdx"],
    ...(isDevServer && {
      async rewrites() {
        return [
          { source: "/arena/:id*/", destination: "/arena/" },
          { source: "/duel/:id*/", destination: "/duel/" },
          { source: "/koop/:id*/", destination: "/koop/" },
          // /live/overlay/ is a real page, so it must not be swallowed here; the
          // negative lookahead does for the dev server what the longer nginx
          // prefix does in production.
          { source: "/live/:id((?!overlay)[^/]+)/", destination: "/live/" },
          { source: "/wordle/duel/:id*/", destination: "/wordle/duel/" },
        ];
      },
    }),
  };
};

const withMDX = createMDX({
  options: {
    // Turbopack serialisiert die Loader-Optionen. Eine Plugin-Referenz als
    // Paketname wird erst im MDX-Loader aufgelöst und bleibt damit kompatibel.
    remarkPlugins: ["remark-gfm"],
  },
});

export default (phase: string) => withMDX(config(phase));
