import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { S } from "@/lib/strings";
import { ui } from "@/lib/ui";

export default async function NotFound() {
  return (
    <main className={ui.shell}>
      <Topbar />
      <div>
        <div className={ui.narrow}>
          <h1 className={ui.h1}>{S.errors.notFound}</h1>
          <p className={ui.muted}>{S.errors.notFoundLead}</p>
          <Link className={ui.primary} href="/">
            {S.errors.toHome}
          </Link>
        </div>
      </div>
    </main>
  );
}
