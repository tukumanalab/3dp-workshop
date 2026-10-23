import Link from "next/link";
import { LogIn, LogOut, LayoutDashboard, ShieldCheck, UserCog } from "lucide-react";
import { prisma } from "@/lib/db";
import { currentViewer } from "@/lib/viewer";
import { S } from "@/lib/strings";
import { canAdministerSite } from "@/lib/access";
import { getSiteSettings } from "@/lib/siteSettings";
import { ThemeSwitch } from "./ThemeSwitch";
import { ApiButton } from "./ApiButton";
import { ui } from "@/lib/ui";

export async function Topbar({ center }: { center?: React.ReactNode }) {
  const viewer = await currentViewer();
  const site = await getSiteSettings();
  const user = viewer.user
    ? await prisma.user.findUnique({ where: { id: viewer.user.userId }, select: { name: true } })
    : null;
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
        <Link className="flex shrink-0 items-center gap-2.5 text-ink no-underline" href="/" aria-label={S.brand.home}>
          <img src="/3dp/logo.svg" alt="" className="size-9" />
          {site.siteName ? (
            <span className="hidden max-w-48 truncate text-base font-extrabold min-[420px]:block lg:max-w-72">{site.siteName}</span>
          ) : (
            <span className="hidden flex-col leading-tight min-[420px]:flex">
              <span className="text-base font-extrabold">{S.brand.name}</span>
              <span className="text-xs font-semibold text-muted">{S.brand.tagline}</span>
            </span>
          )}
        </Link>
        <div className="hidden min-w-0 flex-1 truncate text-center font-bold text-muted md:block">{center}</div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeSwitch />
          {user ? (
            <>
              {canAdministerSite(viewer) ? (
                <Link className={ui.secondary} href="/admin" aria-label={S.siteAdmin.link}>
                  <ShieldCheck size={16} />
                  <span className="hidden md:inline">{S.siteAdmin.link}</span>
                </Link>
              ) : null}
              <Link className={ui.secondary} href="/dashboard" aria-label={S.dashboard.title}>
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">{S.dashboard.title}</span>
              </Link>
              <Link className={ui.secondary} href="/account" aria-label={`${S.account.link}（${user.name}）`} title={S.account.link}>
                <UserCog size={16} />
                <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
              </Link>
              <ApiButton url="/3dp/api/auth/logout" redirectTo="/">
                <LogOut size={16} />
                <span className="hidden sm:inline">{S.auth.logout}</span>
              </ApiButton>
            </>
          ) : (
            <Link className={ui.secondary} href="/login">
              <LogIn size={16} />
              <span>{S.auth.login}</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export async function Footer() {
  const site = await getSiteSettings();
  const operator = [site.operatorName, site.operatorContact].filter(Boolean).join(" / ");
  return (
    <footer className="mt-12 grid gap-1 border-t border-line pt-6 text-sm text-muted">
      <span className="font-semibold">{site.effectiveName}</span>
      {site.footerText ? <span className="whitespace-pre-line">{site.footerText}</span> : null}
      {operator ? <span>{operator}</span> : null}
      <span>{S.legal.license}</span>
    </footer>
  );
}
