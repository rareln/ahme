# Fcitx5 向け最小構成への修正計画

Fcitx5 + Mozc 環境において、Monaco Editor でのインライン入力（直接入力）を確実に発動させるための修正を行います。

## Proposed Changes

### 依存関係の追加
- `npm install @monaco-editor/react` を実行し、Monaco Editor を再導入します。

### [Component] [Editor.tsx](file:///mnt/SSD4TB/projects/ahme/components/Editor.tsx)
- [MODIFY] `textarea` ベースの実装から Monaco Editor (`@monaco-editor/react`) に戻します。
- [NEW] エディタオプションに `accessibilitySupport: "on"` を設定します。
- [NEW] プロパティとして受け取る `language` を Monaco の `language` オプションに渡し、シンタックスハイライトを復元します。
- [NEW] エディタマウント時に `editor.focus()` を実行し、さらに 100ms 後に再度 `editor.focus()` を呼び出すように実装します。
- [NEW] コンポーネント内に `<style>` タグを追加し、`.monaco-editor .inputarea` に対する最小サイズと極低不透明度のスタイルを適用します。

### [Style] [globals.css](file:///mnt/SSD4TB/projects/ahme/app/globals.css)
- [MODIFY] 既存の IME 関連などの余計なスタイルをクリアし、指定された `.monaco-editor .inputarea` のスタイルのみを残す（または追加する）ように調整します。

### [Page] [page.tsx](file:///mnt/SSD4TB/projects/ahme/app/page.tsx)
- [MODIFY] `main` 要素にある `overflow-hidden` クラスを削除し、Fcitx5 による座標計算の誤りを防止します。

## Verification Plan

### Manual Verification
1. `npm run tauri dev` でアプリを起動（tauri.conf.json に従いポート 3002 を使用）。
2. エディタにフォーカスが自動的に当たることを確認（マウント直後と 100ms 後）。
3. 言語モード（Markdown等）に応じたシンタックスハイライトが効いていることを確認。
4. Fcitx5 + Mozc で日本語を入力し、変換中の文字がフローティング窓ではなく、カーソル位置に直接表示されることを確認する。
5. `globals.css` や `Editor.tsx` のスタイルが指示通り最小限になっていることを確認する。
