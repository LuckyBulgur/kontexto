import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin: Statistiken | Kontexto",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
