import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (p) => <h1 className="mb-4 text-2xl font-bold text-foreground" {...p} />,
    h2: (p) => <h2 className="mb-2 mt-8 text-lg font-semibold text-foreground" {...p} />,
    p: (p) => <p className="mb-4" {...p} />,
    ul: (p) => <ul className="mb-4 list-disc space-y-1 pl-5" {...p} />,
    a: (p) => <a className="text-primary underline" {...p} />,
    ...components,
  };
}
