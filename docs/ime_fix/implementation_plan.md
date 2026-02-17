# IMEフォーカス強化の実装プラン

エディタへのフォーカスをより確実にし、OS/ブラウザエンジンに正しくIME入力位置を認識させるための最終調整を行います。

## 提案される変更

### [Editor.tsx](file:///mnt/SSD4TB/projects/ahme/components/Editor.tsx)

#### `handleEditorDidMount` の修正
- `editor.focus()` の直後に `setTimeout(() => editor.focus(), 0)` を追加します。
- `.inputarea` 要素を取得し、`tabIndex` を `0` に設定します。
- `accessibilitySupport` オプションを `"on"` に変更します（現在は `"off"` になっています）。

## 検証プラン

### 手動確認
1. アプリケーションを起動し、エディタがマウントされた直後に自動的にフォーカスが当たるか確認します。
2. 日本語入力を行い、インライン入力が正常に動作するか確認します。
