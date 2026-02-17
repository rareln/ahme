## 更新内容

### 1. 起動エラー（Sandbox）の修正
Ubuntu 24.04 等の Linux 環境で発生する「SUID sandbox helper」エラーを回避するため、起動コマンドに `--no-sandbox` フラグを追加しました。
- `npm run dev:all` で正常にアプリが立ち上がるようになります。

### 2. ファイル操作機能（開く・保存・別名保存）の復旧
Tauri API に依存していた箇所を Electron の IPC (Inter-Process Communication) に差し替えました。
- **メインプロセス (`main.js`)**: `dialog` や `fs` を制御するハンドラを実装。
- **プリロードスクリプト (`preload.js`)**: 安全に API をフロントエンドへ公開。
- **フロントエンド (`page.tsx`)**: `window.electronAPI` を通じてファイル操作を行うよう修正。

これにより、アプリ上の「開く」「保存」「名前を付けて保存」ボタンが正常に動作するようになりました。

## 起動方法
改めて以下のコマンドを実行してください。

```bash
npm run dev:all
```

## 注意事項
- 初回起動時に Linux の権限エラーが出る場合は、ターミナルのログをご確認ください（現在は `--no-sandbox` で回避されています）。
- 開発者ツールは `Ctrl+Shift+I` で開くことができます。
