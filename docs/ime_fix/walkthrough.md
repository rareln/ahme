# textarea ベースのシンプルエディタへの移行完了

Linux 環境での IME 問題を確実に解決するため、エディタエンジンとして外部ライブラリ（Monaco, CodeMirror）を使用することを中止し、React 標準の `<textarea>` 要素を使用した構成に刷新しました。

## 変更内容

### 1. Editor.tsx の刷新 ([Editor.tsx](file:///mnt/SSD4TB/projects/ahme/components/Editor.tsx))
- **標準要素の採用**: 外部ライブラリを全廃し、`<textarea>` を直接使用することで、WebKit2GTK 環境における IME の座標計算問題を根本から排除しました。
- **機能の維持**:
    - フォントサイズ、タブサイズ、折り返し設定（`pre-wrap` / `pre`）を正しく反映します。
    - カーソル位置（行・列）の計算ロジックを自前で実装し、既存の `onCursorChange` との互換性を維持しました。
    - 透明な背景と継承されたテキストカラーにより、アプリのデザインに溶け込むように調整しました。

### 2. 依存関係の整理 ([package.json](file:///mnt/SSD4TB/projects/ahme/package.json))
- `codemirror` および `@uiw/react-codemirror` 関連のパッケージを削除しました。

## 検証手順

1. `npm run tauri dev` でアプリケーションを起動してください。
2. エディタ部分をクリックし、日本語入力を行ってください。
3. **「gedit や他の標準テキストエディタと同様に、下線付きの文字がカーソル位置に直接表示される」**ことを確認してください。

render_diffs(file:///mnt/SSD4TB/projects/ahme/components/Editor.tsx)
