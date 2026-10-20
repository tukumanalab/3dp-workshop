import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const editorDevUrl = process.env.EDITOR_DEV_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  basePath: "/layerling-workshop",
  // dev 実行中に next build すると .next が壊れるため、dev の出力先を分ける
  distDir: isDev ? ".next-dev" : ".next",
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // エディタは末尾スラッシュ前提(相対パス参照)のため、/editor/ を /editor に 308 させない
  skipTrailingSlashRedirect: true,
  serverExternalPackages: ["@prisma/client"],
  async rewrites() {
    // 開発時のみ: エディタ(別 dev サーバ)を同一オリジンで見せる。basePath を自動付与しない。
    if (isDev && editorDevUrl) {
      return [
        {
          source: "/editor/:path*",
          destination: `${editorDevUrl}/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
