# Layerling Workshop

Layerling（3D CAD）のデザイン（`.lyl`）を、ワークショップ単位でサーバに保存・共有・リミックスするための Web サービスです。
xcratch-workshop の Layerling 版で、Next.js 15 (App Router) + Prisma (SQLite) で構成されています。

- 主催者: Google OAuth でログインし、ワークショップ・セッション・参加コードを管理
- 参加者: 参加コード + 表示名で参加（ログイン ID はサーバが発行、PIN は任意）
- 作品: エディタ（iframe 埋め込み）から保存 API 経由でサーバに保存。ギャラリーで共有・ダウンロード・リミックス
- ライセンス: MIT（`LICENSE` 参照）。Layerling のコード・CSS・ロゴは含みません。エディタとは HTTP API / postMessage / iframe のみで連携する別プログラムです。
- Layerling は henmedia の作品です。本サービスは非公式です。

## 構成

| パス | 内容 |
|---|---|
| `src/app/` | 画面 (`/`, `/login`, `/dashboard`, `/[slug]`, `/[slug]/join`, `/[slug]/mypage`, `/[slug]/admin`, `/[slug]/projects/...`) と API (`/api/...`) |
| `src/lib/access.ts` | 閲覧・編集権限の判定（単一情報源。見えない作品は 404） |
| `src/lib/lyl.ts` | `.lyl` 検証（fflate。project.json のみ展開、zip bomb ガード） |
| `src/lib/strings.ts` | 日本語 UI 文言 |
| `src/app/globals.css` / `src/lib/ui.ts` | Tailwind CSS v4 のデザイントークンと共通ユーティリティ（独自デザイン） |
| `prisma/` | スキーマ・マイグレーション・シード |
| `deploy/`, `scripts/deploy.sh` | Nginx 設定例、PM2 設定、デプロイスクリプト、バックアップ cron 例 |

`basePath` は `/layerling-workshop` 固定です（`next.config.ts`）。

## セットアップ（開発）

```bash
npm install
cp .env.example .env          # 値を編集（SESSION_SECRET は必ず変更）
npx prisma migrate dev        # SQLite を作成
npm run db:seed               # デモ主催者 + デモワークショップ
npm run dev                   # http://localhost:3010/layerling-workshop
```

シードで作られるもの:

- 主催者 `demo@example.com`（開発用パスワードログインで使用。パスワードは `prisma/seed.ts` を参照）
- ワークショップ `/demo`（参加コード `DEMO01`、セッション 2 つ）

追加の管理者は `npx tsx scripts/create-admin.ts <email> <name> [password]` で作成できます。

### 環境変数

| 変数 | 既定 | 説明 |
|---|---|---|
| `APP_ORIGIN` | `http://localhost:3010` | 公開 origin（OAuth リダイレクト用） |
| `DATABASE_URL` | - | 例 `file:./dev.db`、本番 `file:/var/lib/layerling-workshop/app.db` |
| `STORAGE_DIR` | `./data/storage` | 作品ファイル (`projects/<uid>/<ts>.lyl`, `thumbnails/<ts>.png`) |
| `SESSION_SECRET` | - | JWT 署名鍵（32 文字以上。本番必須） |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | - | 主催者 Google ログイン |
| `ALLOWED_EMAIL_DOMAINS` | 空 | 許可ドメイン（カンマ区切り。空なら制限なし） |
| `PASSWORD_LOGIN_ENABLED` | 非 production で `true` | 開発用パスワードログイン。本番は `false` 推奨 |
| `MAX_PROJECT_BYTES` / `MAX_THUMBNAIL_BYTES` | 50MB / 5MB | 上限（超過は 413） |
| `KEEP_VERSIONS` | 20 | 作品ごとに保持する版数 |
| `EDITOR_BASE_URL` | `/layerling-workshop/editor/` | iframe が読むエディタの URL |
| `EDITOR_DEV_URL` | 空 | 開発時のみ。エディタ dev サーバの URL（下記） |

### エディタを同一オリジンで開発する

エディタ（tukumana-layerling の workshop-mode ブランチ）を別ポートで起動し、`EDITOR_DEV_URL` に指定すると、
dev サーバが `/layerling-workshop/editor/*` をそこへリライトして同一オリジンに見せます（cookie がそのまま使えます）。

```bash
# エディタ側（例）
cd ../tukumana-layerling/apps/web && npm run dev -- -p 3000
# このリポジトリ側
EDITOR_DEV_URL=http://localhost:3000 npm run dev
```

エディタの static export（`LAYERLING_BASE_PATH=/layerling-workshop/editor npm run export` → `apps/web/.next-export/`、
終了後 `npm run guide` で非 basePath 版ガイドを戻す）を配信する場合は、同梱の静的サーバを使います
（wasm の MIME 付き。export 内のアセットは `/layerling-workshop/editor/...` 付きでも無しでも解決します）。

```bash
node scripts/serve-editor-dev.mjs [exportDir] [port]   # 既定: ../tukumana-layerling-workshop-mode/apps/web/.next-export, 3020
EDITOR_DEV_URL=http://localhost:3020 npm run dev
```

エディタは `/layerling-workshop/editor/`（末尾スラッシュあり）で開く前提です（相対パスでアセットを参照するため）。
`next.config.ts` の `skipTrailingSlashRedirect: true` で、dev のリライト経由でも 308 でスラッシュが外れないようにしています。
`EDITOR_DEV_URL` 未設定の開発環境では、エディタページにヒントが表示されます。
連携確認時のスクリーンショットは `docs/screenshots/` にあります。

## エディタ連携（iframe + 保存 API）

iframe の URL:
`{EDITOR_BASE_URL}?workshop=1&api=<origin>/layerling-workshop&slug=&project_id=&session_id=&mode=remix&readonly=1`（該当するものだけ）

保存 API（実 URL は `/layerling-workshop/api/store/...`、cookie 認証）:

- `GET  /api/store/projects/[id]` → `.lyl`（`application/vnd.layerling.project+zip`）
- `POST /api/store/workshops/[slug]/projects?sessionId=&originalId=&title=` multipart `project`(.lyl) / `thumbnail`(png, 任意) → `{ id, versionTimestamp }`
  - `originalId` が閲覧可能なら親のセッションに置き、リミックス元として記録
- `PUT  /api/store/projects/[id]` 同上。内容（sha256）が最新版と同一なら版を作らず既存の timestamp を返す
- エラー: 400 不正な `.lyl`/PNG、401 未ログイン、403 閲覧可だが編集不可、404 見えない、413 サイズ超過（JSON `{error}`）

postMessage（同一オリジン検証付き）:

- editor → 親 `{type:'layerling-workshop:project-id-updated', projectId}`
- 親 → editor `{type:'layerling-workshop:save-request', requestId}` / editor → 親 `save-ack`（5 秒）、`save-result {ok, saved}`（30 秒）
- 親はタブ非表示時と「戻る」ボタンで保存を依頼

## テスト

```bash
npm test          # vitest（一時 SQLite + 一時ストレージ）
npm run typecheck
npm run lint
npm run build
```

## デプロイ（tukumana.si.aoyama.ac.jp）

サーバは 2GB RAM のため、**ビルドはローカル**で行い成果物を rsync します。

1. サーバ準備（初回のみ）: `/opt/layerling-workshop`、`/var/lib/layerling-workshop`（DB と `storage/`）、`/var/www/layerling-workshop-editor`（エディタ）を作成し、
   `/opt/layerling-workshop/.env` に本番の環境変数を置く（`DATABASE_URL=file:/var/lib/layerling-workshop/app.db`、`STORAGE_DIR=/var/lib/layerling-workshop/storage`、`APP_ORIGIN=https://tukumana.si.aoyama.ac.jp`、`PASSWORD_LOGIN_ENABLED=false` など）。
2. Nginx: `deploy/nginx-layerling-workshop.conf` を既存の server ブロックに追加（`client_max_body_size 60m`、エディタは alias 配信）。
3. Google OAuth: リダイレクト URI に `https://tukumana.si.aoyama.ac.jp/layerling-workshop/api/auth/google/callback` を登録。
4. 実行:
   ```bash
   DEPLOY_HOST=tukumana.si.aoyama.ac.jp DEPLOY_USER=<user> \
   EDITOR_DIST=../tukumana-layerling/apps/web/out \
   ./scripts/deploy.sh
   ```
   ローカルビルド → rsync → `prisma migrate deploy` → PM2 再起動 → health check（`/layerling-workshop/api/health`）。PM2 は `deploy/ecosystem.config.cjs`（PORT 8010、他サービスと衝突しないか確認）。
5. バックアップ: `deploy/backup-cron.example`（SQLite と storage を日次で退避）。

最初の管理者はサーバ上で `create-admin` を実行するか、Google ログインで作成されたユーザーの `role` を更新してください。
