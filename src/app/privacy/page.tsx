import type { Metadata } from "next";
import { Footer, Topbar } from "@/components/Topbar";
import { getSiteSettings } from "@/lib/siteSettings";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: S.privacy.title };

export default async function PrivacyPage() {
  const site = await getSiteSettings();
  const operator = [site.operatorName || S.privacy.operatorFallback, site.operatorContact].filter(Boolean).join(" / ");
  return (
    <main className={ui.shell}>
      <Topbar />
      <div className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-8 sm:py-12">
        <div>
          <h1 className={ui.h1}>{S.privacy.title}</h1>
          <span className={ui.subtitle}>{site.effectiveName}</span>
        </div>
        <p className={ui.muted}>{S.privacy.lead}</p>
        {S.privacy.sections.map((section) => (
          <section key={section.heading} className={ui.card}>
            <h2>{section.heading}</h2>
            <ul className="grid list-disc gap-2 pl-5 text-sm leading-relaxed">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <section className={ui.card}>
          <h2>{S.privacy.contactHeading}</h2>
          <p className="text-sm">{operator}</p>
        </section>
        <p className={ui.muted}>{S.privacy.enacted}</p>
        <Footer />
      </div>
    </main>
  );
}
