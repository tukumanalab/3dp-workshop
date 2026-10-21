// 文字数の上限（client / server 共通。prisma を import しない）。
export const SITE_SETTING_LIMITS = {
  siteName: 60,
  siteDescription: 300,
  footerText: 300,
  operatorName: 100,
  operatorContact: 200,
} as const;
