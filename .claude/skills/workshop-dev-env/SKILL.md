---
name: workshop-dev-env
description: layerling-workshop のローカル開発環境（ワークショップ dev サーバ :3010 + エディタ配信 :3020）の起動・再起動・復旧手順。「ボタンを押しても何も起きない」「ログインできない」「500 になる」「Unexpected end of JSON input」「エディタが 404 / 真っ白」「ローカルで確認したい」「dev サーバを起動して」といったときに使う。
---

# ローカル開発環境の起動と復旧

## 構成
| 役割 | 起動 | ポート | 出力/配信元 |
|---|---|---|---|
| ワークショップ (Next dev) | `.claude/launch.json` の `workshop`（`EDITOR_DEV_URL=http://localhost:3020 npm run dev`） | 3010 | `.next-dev/` |
| エディタ static export 配信 | `.claude/launch.json` の `editor`（`node scripts/serve-editor-dev.mjs`） | 3020 | `../tukumana-layerling-workshop-mode/apps/web/.next-export/` |

- 入口は http://localhost:3010/layerling-workshop/ 。エディタは dev のリライトで同一オリジンの `/layerling-workshop/editor/` に見える。
- Claude Desktop では `preview_start`（name: `editor`、次に `workshop`）で起動する。Bash の `&` で起動しない。
- 初回のみ: `npm i`、`cp .env.example .env`、`npx prisma migrate dev`、`npm run db:seed`。

## 起動手順
1. エディタの export があるか確認する: `ls ../tukumana-layerling-workshop-mode/apps/web/.next-export/index.html`
   - 無いか古い場合は、スキル `layerling-editor-integration` の手順でビルドする。
2. `editor` を起動し、続けて `workshop` を起動する。
3. ヘルスチェックを行う: `curl -s localhost:3010/layerling-workshop/api/health` と `curl -sI localhost:3010/layerling-workshop/editor/`（どちらも 200 になること）。
4. dev サーバのログにエラーが無いか確認する（`preview_logs` で level=error）。

## 症状と対処
| 症状 | 原因 | 対処 |
|---|---|---|
| ログに `SyntaxError: Unexpected end of JSON input` が出る。ログイン API が 500 になる。ログインしたのに「主催者ログイン」のまま、または「新しく作る」が出ない・押せない | dev のキャッシュが壊れている。dev 実行中に build を走らせたときなどに起きる | dev を停止 → `rm -rf .next-dev` → 再起動。ブラウザも再読み込みする |
| `next build` 後に dev がおかしくなる | `distDir` の分離が消えている | `next.config.ts` に `distDir: isDev ? ".next-dev" : ".next"` があるか確認する |
| エディタ iframe でアセットが 404 になる、または真っ白 | `/editor/` の末尾スラッシュが 308 で外れている | `next.config.ts` の `skipTrailingSlashRedirect: true` を確認する |
| エディタページに「開発ヒント」が出る | `EDITOR_DEV_URL` が未設定 | `workshop` 構成で起動し直す（env 付き） |
| `/layerling-workshop/editor/` が 502 / ECONNREFUSED | :3020 が起動していない | `editor` を先に起動する |
| `.wasm` の読み込みエラー | MIME が違う | `scripts/serve-editor-dev.mjs` 経由で配信する（`application/wasm`） |
| ポート 3010 / 3020 が使用中 | 古いプロセスが残っている | `lsof -i :3010` で確認し、自分が起動したものだけ止める |
| Prisma のエラー（テーブルが無い） | マイグレーションが未適用 | `npx prisma migrate dev`、必要なら `npm run db:seed` |

## 守ること
- **dev 実行中に `npm run build` を走らせない。**ビルドの確認が必要なら dev を止めるか、dev と build の出力先が分離されていることを確認してから実行する。
- 「何も起きない」系の報告を受けたら、UI のコードを疑う前に、まず dev のログとネットワーク応答（ステータスコード）を確認する。画面が表示されていても API が 500 のことがある。
- `.next-dev` / `.next` を消してよいのは dev を止めた後だけ。DB（`prisma/dev.db`）と `data/` は消さない（ユーザーの確認用データが入っている）。
