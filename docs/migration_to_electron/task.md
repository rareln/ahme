# TauriからElectronへの移行タスク

## [ ] 1. 計画と準備
- [x] 現状の調査（package.json, Editor.tsx, Tauri構成）
- [/] `task.md` と `implementation_plan.md` の作成
- [ ] ユーザーへの計画承認依頼

## [ ] 2. プロジェクト構成の変更
- [ ] 依存関係の追加 (`electron`, `electron-builder`, `concurrently`, `wait-on`)
- [ ] `main.js` (Electronメインプロセス) の作成
- [ ] `package.json` の更新 (`main` フィールド、`scripts`)

## [ ] 3. コンポーネントの調整
- [ ] `Editor.tsx` からTauri/Fcitx5向けのハックを削除
- [ ] `Editor.tsx` のMonaco設定を標準構成に戻す（`accessibilitySupport: "on"`, `cursorBlinking: "smooth"` 等）

## [ ] 4. Tauri資産の整理
- [ ] `src-tauri` フォルダの削除
- [ ] Tauri関連の依存関係の削除（`package.json` から）

## [ ] 5. 検証と完了
- [ ] `npm run dev:all` による起動確認
- [ ] 日本語入力の快適さの確認
- [ ] `walkthrough.md` の作成
