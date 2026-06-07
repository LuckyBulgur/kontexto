import type { MDXComponents } from "mdx/types";
import { slugify } from "@/lib/slug";
import Callout from "@/components/content/Callout";

/**
 * Shared MDX rendering for blog posts. Adds anchor ids to headings (deep-links
 * + table-of-contents), styled tables, and renders Markdown blockquotes as
 * highlighted tip callouts. Blog posts may also import React components (e.g.
 * diagrams) directly for richer, non-text content.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (p) => (
      <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground" {...p} />
    ),
    h2: ({ children, ...p }) => {
      const id = typeof children === "string" ? slugify(children) : undefined;
      return (
        <h2
          id={id}
          className="mt-10 mb-3 scroll-mt-24 text-xl font-semibold text-foreground"
          {...p}
        >
          {children}
        </h2>
      );
    },
    h3: ({ children, ...p }) => {
      const id = typeof children === "string" ? slugify(children) : undefined;
      return (
        <h3
          id={id}
          className="mt-6 mb-2 scroll-mt-24 text-lg font-semibold text-foreground"
          {...p}
        >
          {children}
        </h3>
      );
    },
    p: (p) => <p className="mb-4 leading-7" {...p} />,
    ul: (p) => <ul className="mb-4 list-disc space-y-1.5 pl-5" {...p} />,
    ol: (p) => <ol className="mb-4 list-decimal space-y-1.5 pl-5" {...p} />,
    li: (p) => <li className="leading-7" {...p} />,
    a: (p) => <a className="text-primary underline underline-offset-2" {...p} />,
    strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
    blockquote: ({ children }) => <Callout variant="tip">{children}</Callout>,
    hr: () => <hr className="my-8 border-border" />,
    table: (p) => (
      <div className="my-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm" {...p} />
      </div>
    ),
    thead: (p) => <thead className="bg-muted/50" {...p} />,
    th: (p) => <th className="px-3 py-2 text-left font-semibold text-foreground" {...p} />,
    td: (p) => (
      <td className="border-t border-border px-3 py-2 align-top text-muted-foreground" {...p} />
    ),
    ...components,
  };
}
