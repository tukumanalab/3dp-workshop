import type { Metadata, Viewport } from "next";
import { getSiteSettings } from "@/lib/siteSettings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    title: { default: site.effectiveName, template: `%s | ${site.effectiveName}` },
    description: site.effectiveDescription,
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// 初回描画前にテーマを適用してちらつきを防ぐ
const THEME_BOOT = `(function(){try{var p=localStorage.getItem("layerling-workshop.theme");var d=p==="dark"||((p===null||p==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
