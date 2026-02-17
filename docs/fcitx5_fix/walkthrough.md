# Fcitx5 向け最小構成の実装完了

Linux (Fcitx5 + Mozc) 環境において、Monaco Editor での日本語インライン入力を確実に発動させるための「最小構成」を実装しました。

## 実施した変更

### 1. Monaco Editor の再構築 ([Editor.tsx](file:///mnt/SSD4TB/projects/ahme/components/Editor.tsx))
- **二段階フォーカス**: Fcitx5 がエディタの座標を正確に取得できるよう、マウント直後と 100ms 後の二回 `editor.focus()` を実行するようにしました。
- **アクセシビリティ**: `accessibilitySupport: "on"` を設定し、OS レベルでの IME 認識を強化しました。
- **言語モードの復元**: 渡された `language` プロパティを接続し、Markdown 等のシンタックスハイライトが効くように戻しました。
- **特定 CSS**: エディタ内の `.inputarea` に対し、Fcitx5 が存在を検知できる最小サイズ (1px) とごく僅かな不透明度 (0.01) を適用しました。

### 2. スタイルのクリーンアップ ([globals.css](file:///mnt/SSD4TB/projects/ahme/app/globals.css))
- 不要な CSS レイヤーをクリアし、指示された `.monaco-editor .inputarea` のスタイル定義を残して、OS の座標計算を妨げないようにしました。

### 3. レイアウトの調整 ([page.tsx](file:///mnt/SSD4TB/projects/ahme/app/page.tsx))
- `main` 要素から `overflow-hidden` を削除しました。これにより、Fcitx5 が親要素によるクリッピングで座標を誤認する問題を回避します。

### 4. 開発環境 ([tauri.conf.json](file:///mnt/SSD4TB/projects/ahme/src-tauri/tauri.conf.json), [package.json](file:///mnt/SSD4TB/projects/ahme/package.json))
- 開発サーバーのポートを **3002** に統一しました。

## 検証手順

1. `npm run tauri:dev` を実行してアプリを起動してください。
2. エディタに自動的にフォーカスが当たることを確認してください。
3. 日本語入力を開始し、**「変換中の文字がカーソル位置に直接表示され、フローティング窓が出ないこと」**を確認してください。
4. 言語に応じてハイライト（例：Markdown なら `#` 等）が反映されていることを確認してください。
