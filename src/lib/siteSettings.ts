import { prisma } from "./db";
import { S } from "./strings";
import { SITE_SETTING_LIMITS } from "./siteSettingsLimits";

export const SITE_DESCRIPTION_DEFAULT = "Layerling のデザインをワークショップで保存・共有・リミックスするためのサービス";

export { SITE_SETTING_LIMITS };

export type SiteSettingKey = keyof typeof SITE_SETTING_LIMITS;
export const SITE_SETTING_KEYS = Object.keys(SITE_SETTING_LIMITS) as SiteSettingKey[];

export type SiteSettingsRaw = Record<SiteSettingKey, string>;
export type SiteSettings = SiteSettingsRaw & {
  /** 空欄を既定値で埋めた値（title / description 用） */
  effectiveName: string;
  effectiveDescription: string;
};

const EMPTY: SiteSettingsRaw = { siteName: "", siteDescription: "", footerText: "", operatorName: "", operatorContact: "" };

export async function getSiteSettings(): Promise<SiteSettings> {
  let row: SiteSettingsRaw = EMPTY;
  try {
    const r = await prisma.siteSetting.findUnique({ where: { id: 1 } });
    if (r) row = { siteName: r.siteName, siteDescription: r.siteDescription, footerText: r.footerText, operatorName: r.operatorName, operatorContact: r.operatorContact };
  } catch {
    // テーブルが無い等の場合でも画面は既定値で表示する
  }
  return {
    ...row,
    effectiveName: row.siteName || `${S.brand.name} ${S.brand.tagline}`,
    effectiveDescription: row.siteDescription || SITE_DESCRIPTION_DEFAULT,
  };
}

/** 文字列項目だけを検証して upsert する。不正なら { error } を返す。 */
export async function updateSiteSettings(input: Record<string, unknown>): Promise<{ settings: SiteSettings } | { error: string }> {
  const data: Partial<SiteSettingsRaw> = {};
  for (const key of SITE_SETTING_KEYS) {
    const v = input[key];
    if (v === undefined) continue;
    if (typeof v !== "string") return { error: S.siteAdmin.errors.invalidSettings };
    const t = v.trim();
    if (t.length > SITE_SETTING_LIMITS[key]) return { error: S.siteAdmin.errors.tooLong };
    data[key] = t;
  }
  await prisma.siteSetting.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  return { settings: await getSiteSettings() };
}
