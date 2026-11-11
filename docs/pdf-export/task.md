# Markdown PDF出力機能（書籍・論文スタイル装丁 & 拡張）タスク一覧

- [x] `preload.js` に `exportPdf: (data) => ipcRenderer.invoke('export-pdf', data)` を公開
- [x] `main.js` に `ipcMain.handle('export-pdf', ...)` を実装
- [x] `main.js` のメニューバーに「PDFエクスポート (Ctrl+Shift+P)」を追加
- [x] `components/Header.tsx` と `app/page.tsx` に「PDF出力」ボタンと完了通知を実装
- [x] 表紙の自動生成（先頭〜最初の `---` を `.cover-page` として抽出し縦方向中央配置・直後で `break-after: page`）
- [x] 自動目次（TOC）の生成と本文の改ページ制御
- [x] 各ページのフッターにページ番号 (`pageNumber / totalPages`) を表示（`displayHeaderFooter: true`, `headerTemplate`, `footerTemplate`, 余白調整）
- [x] 目次（TOC）の見出しページ番号を JavaScript 実測により自動算出・挿入し、アンカーリンク (`<a href="#id">`) と右揃えレイアウトを整備
- [x] KaTeX CDN 読み込みと `renderMathInElement(document.body)` による LaTeX 数式 (`$...$`, `$$...$$`) レンダリング対応
- [x] `@page :first { margin-bottom: 0; }` により表紙（1ページ目）のみフッターのページ番号を非表示化
