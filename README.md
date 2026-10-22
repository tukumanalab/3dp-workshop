# 3DP Workshop

Layerling（3D CAD）のデザイン（`.lyl`）を、ワークショップ単位でサーバに保存・共有・リミックスするための Web サービスです。
xcratch-workshop の Layerling 版で、Next.js 15 (App Router) + Prisma (SQLite) で構成されています。

- 開催者: Google OAuth でログインし、ワークショップ・セッション・参加コードを管理
- 参加者: 参加コード + 表示名で参加（ログイン ID はサーバが発行、PIN は任意）
- 作品: エディタ（iframe 埋め込み）から保存 API 経由でサーバに保存。ギャラリーで共有・ダウンロード・リミックス
- ライセンス: MIT（`LICENSE` 参照）。Layerling のコード・CSS・ロゴは含みません。エディタとは HTTP API / postMessage / iframe のみで連携する別プログラムです。

## 構成

| パス | 内容 |
|---|---|
| `src/app/` | 画面 (`/`, `/login`, `/dashboard`, `/account`, `/[slug]`, `/[slug]/join`, `/[slug]/mypage`, `/[slug]/admin`, `/[slug]/projects/...`) と API (`/api/...`) |
| `src/lib/access.ts` | 閲覧・編集権限の判定（単一情報源。見えない作品は 404） |
| `src/lib/lyl.ts` | `.lyl` 検証（fflate。project.json のみ展開、zip bomb ガード） |
| `src/lib/strings.ts` | 日本語 UI 文言 |
| `src/app/globals.css` / `src/lib/ui.ts` | Tailwind CSS v4 のデザイントークンと共通ユーティリティ（独自デザイン） |
| `prisma/` | スキーマ・マイグレーション・シード |
| `deploy/`, `scripts/deploy.sh` | Nginx 設定例、PM2 設定、デプロイスクリプト、バックアップ cron 例 |

`basePath` は `/3dp-workshop` 固定です（`next.config.ts`）。

## セットアップ（開発）

```bash
npm install
cp .env.example .env          # 値を編集（SESSION_SECRET は必ず変更）
npx prisma migrate dev        # SQLite を作成
npm run db:seed               # デモ開催者 + デモワークショップ
npm run dev                   # http://localhost:3010/3dp-workshop
```

シードで作られるもの:

- 開催者 `demo@example.com`（開発用パスワードログインで使用。パスワードは `prisma/seed.ts` を参照）
- ワークショップ `/demo`（参加コード `DEMO01`、セッション 2 つ）

追加の管理者は `npx tsx scripts/create-admin.ts <email> <name> [password]` で作成できます。

### 環境変数

| 変数 | 既定 | 説明 |
|---|---|---|
| `APP_ORIGIN` | `http://localhost:3010` | 公開 origin（OAuth リダイレクト用） |
| `DATABASE_URL` | - | 例 `file:./dev.db`、本番 `file:/var/lib/3dp-workshop/app.db` |
| `STORAGE_DIR` | `./data/storage` | 作品ファイル (`projects/<uid>/<ts>.lyl`, `thumbnails/<ts>.png`) |
| `SESSION_SECRET` | - | JWT 署名鍵（32 文字以上。本番必須） |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | - | 開催者 Google ログイン |
| `ALLOWED_EMAIL_DOMAINS` | 空 | 許可ドメイン（カンマ区切り。空なら制限なし） |
| `PASSWORD_LOGIN_ENABLED` | 非 production で `true` | 開発用パスワードログイン。本番は `false` 推奨 |
| `MAX_PROJECT_BYTES` / `MAX_THUMBNAIL_BYTES` | 50MB / 5MB | 上限（超過は 413） |
| `KEEP_VERSIONS` | 20 | 作品ごとに保持する版数 |
| `EDITOR_BASE_URL` | `/3dp-workshop/editor/` | iframe が読むエディタの URL |
| `EDITOR_DEV_URL` | 空 | 開発時のみ。エディタ dev サーバの URL（下記） |

### エディタを同一オリジンで開発する

エディタ（tukumana-layerling の workshop-mode ブランチ）を別ポートで起動し、`EDITOR_DEV_URL` に指定すると、
dev サーバが `/3dp-workshop/editor/*` をそこへリライトして同一オリジンに見せます（cookie がそのまま使えます）。

```bash
# エディタ側（例）
cd ../tukumana-layerling/apps/web && npm run dev -- -p 3000
# このリポジトリ側
EDITOR_DEV_URL=http://localhost:3000 npm run dev
```

エディタの static export（`LAYERLING_BASE_PATH=/3dp-workshop/editor npm run export` → `apps/web/.next-export/`、
終了後 `npm run guide` で非 basePath 版ガイドを戻す）を配信する場合は、同梱の静的サーバを使います
（wasm の MIME 付き。export 内のアセットは `/3dp-workshop/editor/...` 付きでも無しでも解決します）。

```bash
node scripts/serve-editor-dev.mjs [exportDir] [port]   # 既定: ../tukumana-layerling-workshop-mode/apps/web/.next-export, 3020
EDITOR_DEV_URL=http://localhost:3020 npm run dev
```

エディタは `/3dp-workshop/editor/`（末尾スラッシュあり）で開く前提です（相対パスでアセットを参照するため）。
`next.config.ts` の `skipTrailingSlashRedirect: true` で、dev のリライト経由でも 308 でスラッシュが外れないようにしています。
`EDITOR_DEV_URL` 未設定の開発環境では、エディタページにヒントが表示されます。
連携確認時のスクリーンショットは `docs/screenshots/` にあります。

## エディタ連携（iframe + 保存 API）

iframe の URL:
`{EDITOR_BASE_URL}?workshop=1&api=<origin>/3dp-workshop&slug=&project_id=&session_id=&mode=remix&readonly=1`（該当するものだけ）

保存 API（実 URL は `/3dp-workshop/api/store/...`、cookie 認証）:

- `GET  /api/store/projects/[id]` → `.lyl`（`application/vnd.layerling.project+zip`）
- `POST /api/store/workshops/[slug]/projects?sessionId=&originalId=&title=` multipart `project`(.lyl) / `thumbnail`(png, 任意) → `{ id, versionTimestamp }`
  - `originalId` が閲覧可能なら親のセッションに置き、リミックス元として記録
- `PUT  /api/store/projects/[id]` 同上。内容（sha256）が最新版と同一なら版を作らず既存の timestamp を返す
- エラー: 400 不正な `.lyl`/PNG、401 未ログイン、403 閲覧可だが編集不可、404 見えない、413 サイズ超過（JSON `{error}`）

postMessage（同一オリジン検証付き）:

- editor → 親 `{type:'3dp-workshop:project-id-updated', projectId}`
- 親 → editor `{type:'3dp-workshop:save-request', requestId}` / editor → 親 `save-ack`（5 秒）、`save-result {ok, saved}`（30 秒）
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

1. サーバ準備（初回のみ）: `/opt/3dp-workshop`、`/var/lib/3dp-workshop`（DB と `storage/`）、`/var/www/3dp-workshop-editor`（エディタ）を作成し、
   `/opt/3dp-workshop/.env` に本番の環境変数を置く（`DATABASE_URL=file:/var/lib/3dp-workshop/app.db`、`STORAGE_DIR=/var/lib/3dp-workshop/storage`、`APP_ORIGIN=https://tukumana.si.aoyama.ac.jp`、`PASSWORD_LOGIN_ENABLED=false` など）。
2. Nginx: `deploy/nginx-3dp-workshop.conf` を既存の server ブロックに追加（`client_max_body_size 60m`、エディタは alias 配信）。
3. Google OAuth: リダイレクト URI に `https://tukumana.si.aoyama.ac.jp/3dp-workshop/api/auth/google/callback` を登録。
4. 実行:
   ```bash
   DEPLOY_HOST=tukumana.si.aoyama.ac.jp DEPLOY_USER=<user> \
   EDITOR_DIST=../tukumana-layerling/apps/web/out \
   ./scripts/deploy.sh
   ```
   ローカルビルド → rsync → `prisma migrate deploy` → PM2 再起動 → health check（`/3dp-workshop/api/health`）。PM2 は `deploy/ecosystem.config.cjs`（PORT 8010、他サービスと衝突しないか確認）。
5. バックアップ: `deploy/backup-cron.example`（SQLite と storage を日次で退避）。

### アカウント設定

サイト管理者・開催者は `/3dp-workshop/account`（ヘッダーの人型アイコン）で自分の表示名とパスワードを変更できます。

- 表示名: `PATCH /api/account` `{name}`（1〜100 文字。権限やメールは変更不可）
- パスワード: `POST /api/account/password` `{currentPassword, newPassword}`（8〜200 文字）。パスワード設定済みなら現在のパスワードが必要。Google ログインのみでパスワード未設定のユーザーは、現在のパスワードなしで新規設定できる。`PASSWORD_LOGIN_ENABLED` が無効なら 404 で、画面にも入力欄は出ない。ユーザーごとに 1 分 10 回までのレート制限あり

### サイト管理（admin）

最初の管理者はサーバ上で `npm run create-admin`（`scripts/create-admin.ts <email> <name> [password]`）で作成します。以降は、サイト管理画面 `/3dp-workshop/admin`（ヘッダーの「サイト管理」リンク。admin 以外には 404）から次の操作ができます。

- 統計 / ユーザー管理（検索、事前登録、権限・状態の変更、名前とメールの編集、削除）/ ワークショップの横断管理（公開範囲・受付の切替、開催者の付け替え、削除）/ サイト設定（サイト名、説明、フッター文言、運営者名・連絡先）
- admin になる方法: `create-admin`、管理画面での事前登録（同じメールで Google ログインすると紐付く）、既存 admin による昇格
- 新規の Google ユーザーは `organizer` / `APPROVED` で作られます（承認制ではありません）
- admin はワークショップの staff ではなく、閲覧・管理画面への到達特権だけを持ちます
- 権限は毎リクエスト DB から読むため、降格・停止はすぐ反映されます

安全策:
- 自分自身の権限・状態の変更と、自分自身の削除は 400
- 最後の有効な admin（停止中を除く）の降格・停止・削除は 409
- ワークショップを所有しているユーザー、作品があるユーザーの削除は 409（先に開催者を付け替えるか、停止にする）

API は `/api/admin/{stats,users,workshops,site-settings}` です（未ログイン 401、admin 以外 404）。サイト設定が空欄の項目は既定値を使い、ヘッダーのブランド表記（3DP Workshop）と MIT の表記は設定に関わらず表示されます。
