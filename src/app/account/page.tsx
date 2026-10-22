import { redirect } from "next/navigation";
import { Footer, Topbar } from "@/components/Topbar";
import { PasswordForm, ProfileForm } from "@/components/AccountForms";
import { prisma } from "@/lib/db";
import { config } from "@/lib/env";
import { S } from "@/lib/strings";
import { currentViewer } from "@/lib/viewer";
import { ui } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const viewer = await currentViewer();
  if (!viewer.user) redirect("/login?next=/account");
  const user = await prisma.user.findUnique({
    where: { id: viewer.user.userId },
    select: { name: true, email: true, role: true, passwordHash: true },
  });
  if (!user) redirect("/login?next=/account");
  return (
    <main className={ui.shell}>
      <Topbar />
      <div>
        <div className={ui.narrow}>
          <div>
            <h1 className={ui.h1}>{S.account.title}</h1>
            <span className={ui.subtitle}>{S.siteAdmin.roles[user.role] ?? user.role}</span>
          </div>
          <ProfileForm name={user.name} email={user.email} />
          {config.passwordLoginEnabled ? (
            <PasswordForm email={user.email} hasPassword={!!user.passwordHash} />
          ) : (
            <section className={ui.card}>
              <h2>{S.account.password}</h2>
              <p className={ui.muted}>{S.account.passwordDisabled}</p>
            </section>
          )}
          <Footer />
        </div>
      </div>
    </main>
  );
}
