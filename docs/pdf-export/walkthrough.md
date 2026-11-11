# Markdown ドキュメント PDF出力機能 ウォークスルー

## 実装・修正内容

1. **表紙（1ページ目）のフッター漏れ修正・非表示化 ([main.js](file:///mnt/SSD4TB/projects/ahme/main.js#L614-L654), [main.js](file:///mnt/SSD4TB/projects/ahme/main.js#L1125-L1153))**
   - `.cover-page` の `min-height: 262mm` / `padding-bottom: 67mm` を元の `min-height: 240mm` / `padding: 25mm 15mm 45mm 15mm` に戻し、2ページ目への溢れを解消しました。
   - `footerTemplate` にご指定の `<style>` + `.footer-container` 構造を適用するとともに、Chromium の印刷テンプレート (`#footer`) に `overflow: hidden` が無いことで高さ 0 時に要素がはみ出す現象を防ぐため、`#footer { overflow: hidden !important; }` と `@page :first { margin-top: 0; margin-bottom: 0; }`（C++ 側の `PrintHeaderAndFooter` スキップ条件）を併用して 1 ページ目のフッターを完全に非表示化しました。
