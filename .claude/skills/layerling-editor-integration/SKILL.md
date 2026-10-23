---
name: layerling-editor-integration
description: Layerling エディタ（tukumana-layerling の workshop-mode ブランチ）側の変更・static export のビルド・保存 API と postMessage 契約の変更を安全に行う手順。「エディタ側を直す」「エディタを再ビルド」「保存できない」「iframe 連携」「API 契約を変える」ときに使う。
---

# エディタ連携の作業手順

## リポジトリの扱い
- 作業するのは worktree `/Users/ky/Documents/workspace/layerling/tukumana-layerling-workshop-mode`（ブランチ `workshop-mode`）だけ。
- `/Users/ky/Documents/workspace/layerling/tukumana-layerling`（元の checkout）にはユーザーの未コミット変更（`.claude/launch.json`、`apps/web/public/guide-ja/`、`pr-screenshots/`）がある。**checkout・stash・commit・ビルドをしない。**
- エディタ側は Layerling の fork なので AGPL-3.0 のまま。エディタのコードを 3dp-workshop（MIT）にコピーしない。逆向きのコピーも同様にしない。
- 差分は小さく保つ。変更は `apps/web/src/lib/workshopBridge.ts` に集約し、`app/page.tsx` と `LayerlingEditor.tsx` にはフックだけを置く。workshop 以外のモードの挙動は変えない。

## static export のビルド
```bash
cd /Users/ky/Documents/workspace/layerling/tukumana-layerling-workshop-mode
LAYERLING_BASE_PATH=/3dp/editor npm run export   # → apps/web/.next-export/
npm run guide   # 必ず実行: base path 付きで生成されたガイドを元に戻す（戻さないと guideSearch のテストが落ちる）
```
- ビルド後は `serve-editor-dev.mjs`（:3020）を再起動しなくても新しいファイルが配信される。ただし、ブラウザは強制再読み込みする（service worker は workshop モードでは登録されない）。
- エディタ側のテスト: `npx vitest run --config tests/vitest.config.ts tests/unit/workshopBridge.test.ts`

## 契約（両側で一致させること）
| 項目 | 内容 |
|---|---|
| iframe URL | `/3dp/editor/?workshop=1&api=<origin>/3dp&slug=&project_id=&session_id=&mode=remix&readonly=1` |
| 読み込み | `GET {api}/api/store/projects/{id}` → `.lyl` の生バイト |
| 新規 | `POST {api}/api/store/workshops/{slug}/projects?sessionId=&originalId=&title=` |
| 更新 | `PUT {api}/api/store/projects/{id}` |
| body | multipart。`project`（`application/vnd.layerling.project+zip`）、`thumbnail`（png、任意） |
| 応答 | `{id, versionTimestamp}`。エラーは `{error}`（400/401/403/404/413） |
| postMessage | `3dp-workshop:project-id-updated` / `save-request` / `save-ack` / `save-result {ok, saved}`。同一 origin のみ受け付ける |

契約を変えるときの手順:
1. 両リポジトリを同じ作業の中で直す。
2. workshop の README「エディタ連携」と、両側のテスト（workshop: `tests/` の store 系、editor: `workshopBridge.test.ts`）を更新する。
3. スキル `workshop-verify` の 3-4（保存して戻る）をブラウザで確認する。

## よくある落とし穴
- export を `LAYERLING_BASE_PATH` なしでビルドすると、`/3dp/editor/` 配下でアセットが解決しない。
- workshop 側の `skipTrailingSlashRedirect` が消えると、iframe 内のアセットが 404 になる。
- コミットは worktree のブランチに対して行う。push はユーザーの許可を得てから。
