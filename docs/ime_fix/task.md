# textarea ベースのシンプルエディタへの移行 (IME最終対策)

- [x] 準備
    - [x] 実増プランの作成
    - [x] 依存関係の整理 (CodeMirror 関連の削除)
- [x] 実装
    - [x] `Editor.tsx` を `<textarea>` ベースに完全刷新
    - [x] `SettingsDialog.tsx` 等の関連箇所の整合性確認
- [/] 検証
    - [ ] `npm run tauri dev` による動作確認
    - [ ] 日本語インライン入力が `gedit` 等と同様に動作することを確認
