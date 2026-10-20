import { redirect } from "next/navigation";
import { Footer, Topbar } from "@/components/Topbar";
import { LoginForm } from "@/components/LoginForm";
import { googleClient, safeNext } from "@/lib/auth";
import { config } from "@/lib/env";
import { S } from "@/lib/strings";
import { currentViewer } from "@/lib/viewer";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  const viewer = await currentViewer();
  const next = safeNext(sp.next);
  if (viewer.user) redirect(next);
  return (
    <main className={ui.shell}>
      <Topbar />
      <div>
        <div className={ui.narrow}>
          <h1 className={ui.h1}>{S.auth.loginTitle}</h1>
          <p className={ui.muted}>{S.auth.loginLead}</p>
          {sp.error ? <p className={ui.error}>{S.auth.errors[sp.error] ?? S.common.failed}</p> : null}
          <LoginForm
            googleEnabled={!!googleClient()}
            passwordEnabled={config.passwordLoginEnabled}
            next={next}
          />
          <Footer />
        </div>
      </div>
    </main>
  );
}
