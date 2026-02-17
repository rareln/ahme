# TauriからElectronへの移行プラン

Tauri (WebKit2GTK) における日本語入力（IME）の技術的制約を解消するため、ランタイムを Electron (Chromium) へ移行します。

## 変更内容

### 依存関係の追加
- `electron`: ランタイム本体
- `electron-builder`: ビルドツール
- `concurrently`: Next.jsとElectronの同時起動用
- `wait-on`: Next.jsの起動待ち用

### メインプロセスの作成
- `main.js`: Electronのエントリポイント
  - `localhost:3002` をロード
  - ウィンドウサイズ: 1200x800
  - 開発者ツールのオプション対応

### package.json の更新
- `"main": "main.js"` の追加
- スクリプトの追加:
  - `"electron": "electron ."`
  - `"dev:all": "concurrently \"next dev -p 3002\" \"wait-on http://localhost:3002 && electron .\""`

### Editor.tsx の調整
- Fcitx5向けの特殊なCSS（opacity操作等）を削除
- `visibilitySupport: "on"`, `cursorBlinking: "smooth"` 等の標準設定を適用
- `setTimeout` による二重フォーカスハックを削除（Electron/Chromiumでは不要なはず）

### Tauri 資産の整理
- `src-tauri` フォルダの削除（安全のため、まずは名前変更または削除の提案のみを行い、実行する）

## 検証プラン

### 自動テスト
- 現時点ではUIテストが構築されていないため、手動検証を主とする。

### 手動検証
1. `npm run dev:all` を実行し、Electronウィンドウが正常に立ち上がることを確認。
2. Monaco Editor 内で日本語入力（IBus/Mozc）を行い、インライン入力が正常に動作することを確認。
3. 開発者ツール（Ctrl+Shift+I）が開けることを確認。
