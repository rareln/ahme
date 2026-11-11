# Markdown ドキュメント PDF出力機能 実装計画

## 1. 表紙（1ページ目）のフッター非表示化と2ページ目以降のページ番号表示
- `.cover-page` の無理な `min-height: 262mm` / `padding-bottom: 67mm` 補正を元の `min-height: 240mm` / `padding: 25mm 15mm 45mm 15mm` に戻し、表紙が2ページ目に溢れるのを防止。
- `footerTemplate` 内に `<style>` と `<div class="footer-container">` を定義し、`.page-1 .footer-container, [data-page-number="1"]` に加え、Chromium のヘッダー・フッター描画テンプレートの `#footer` に対する `overflow: hidden !important` および `#footer[style*="height: 0px"]` 非表示ルール・`@page :first { margin-top: 0; margin-bottom: 0; }` を組み合わせ、1ページ目でフッター要素が漏れ出ないように完全に非表示化。

## 2. 目次（TOC）に正しいページ番号を記載・レイアウト調整
- `computeAndFillTocPageNumbers()` で各見出し (`h1`, `h2`) のページ番号を実測・算出し、`<span class="toc-page-num">` に挿入。

## 3. LaTeX数式（`$...$` / `$$...$$`）の正常レンダリング
- KaTeX CDN と `renderMathInElement(document.body)` によりインライン・ブロック数式をレンダリング。
