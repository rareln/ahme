process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

async function getWindowState() {
    try {
        const data = await fs.readFile(STATE_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return { width: 1200, height: 800 };
    }
}

async function saveWindowState(win) {
    const bounds = win.getBounds();
    try {
        await fs.writeFile(STATE_FILE, JSON.stringify(bounds), 'utf8');
    } catch (err) {
        console.error('Failed to save window state:', err);
    }
}

async function createWindow() {
    const state = await getWindowState();

    const win = new BrowserWindow({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // リサイズ・移動時に状態を保存
    const saveState = () => saveWindowState(win);
    win.on('resize', saveState);
    win.on('move', saveState);
    win.on('close', saveState);

    // 開発時は localhost:3002 をロード
    const isDev = process.env.NODE_ENV !== 'production';
    const startUrl = isDev
        ? 'http://localhost:3002'
        : `file://${path.join(__dirname, 'out/index.html')}`;

    win.loadURL(startUrl).catch(err => {
        console.error('Failed to load URL:', err);
    });

    // 外部リンク（target="_blank"）をOSのデフォルトブラウザで開く
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    // 開発者ツールをオプションで開く (Ctrl+Shift+I)
    win.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.shift && input.key.toLowerCase() === 'i') {
            win.webContents.openDevTools();
            event.preventDefault();
        }
    });

    // メニューの構築 (日本語化)
    const template = [
        {
            label: 'ファイル',
            submenu: [
                { label: '新規作成', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('menu:new-file') },
                { label: '開く', accelerator: 'CmdOrCtrl+O', click: () => win.webContents.send('menu:open-file') },
                { type: 'separator' },
                { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('menu:save-file') },
                { label: '名前を付けて保存', accelerator: 'CmdOrCtrl+Shift+S', click: () => win.webContents.send('menu:save-as-file') },
                { label: 'PDFエクスポート', accelerator: 'CmdOrCtrl+Shift+P', click: () => win.webContents.send('menu:export-pdf') },
                { type: 'separator' },
                { label: '終了', role: 'quit' }
            ]
        },
        {
            label: '編集',
            submenu: [
                { label: '元に戻す', accelerator: 'CmdOrCtrl+Z', click: () => win.webContents.send('menu:undo') },
                { label: 'やり直し', accelerator: 'CmdOrCtrl+Y', click: () => win.webContents.send('menu:redo') },
                { type: 'separator' },
                { label: '切り取り', role: 'cut' },
                { label: 'コピー', role: 'copy' },
                { label: '貼り付け', role: 'paste' },
                { label: 'すべて選択', role: 'selectAll' },
                { type: 'separator' },
                { label: '検索', accelerator: 'CmdOrCtrl+F', click: () => win.webContents.send('menu:search') },
                { label: '置換', accelerator: 'CmdOrCtrl+H', click: () => win.webContents.send('menu:replace') }
            ]
        },
        {
            label: '表示',
            submenu: [
                { label: '再読み込み', role: 'reload' },
                { label: '開発者ツール', role: 'toggleDevTools' },
                { type: 'separator' },
                { label: '実際のサイズ', role: 'resetZoom' },
                { label: '拡大', role: 'zoomIn' },
                { label: '縮小', role: 'zoomOut' },
                { type: 'separator' },
                { label: 'フルスクリーン', role: 'togglefullscreen' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// 最後に開いた/保存したディレクトリを記憶
let lastOpenDir = null;
let lastSaveDir = null;

ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        defaultPath: lastOpenDir || undefined,
        properties: ['openFile'],
        filters: [
            { name: 'テキストファイル', extensions: ['txt', 'md', 'json', 'html', 'css', 'js', 'ts', 'tsx', 'py', 'rs', 'toml', 'yaml', 'yml', 'xml', 'csv'] },
            { name: 'すべてのファイル', extensions: ['*'] }
        ]
    });
    if (canceled) return null;
    lastOpenDir = path.dirname(filePaths[0]);
    return filePaths[0];
});

ipcMain.handle('dialog:getSavePath', async (event, { defaultPath }) => {
    let resolvedDefault = defaultPath;
    if (defaultPath && !path.isAbsolute(defaultPath) && lastSaveDir) {
        resolvedDefault = path.join(lastSaveDir, defaultPath);
    }
    const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: resolvedDefault || defaultPath,
        filters: [
            { name: 'テキストファイル', extensions: ['txt', 'md', 'json', 'html', 'css', 'js', 'ts', 'tsx'] },
            { name: 'すべてのファイル', extensions: ['*'] }
        ]
    });
    if (canceled) return null;
    lastSaveDir = path.dirname(filePath);
    return filePath;
});

ipcMain.handle('dialog:saveFile', async (event, { content, filePath }) => {
    try {
        console.log(`Saving to: ${filePath}, Content length: ${content.length}`);
        await fs.writeFile(filePath, content, 'utf8');
        return true;
    } catch (error) {
        console.error('Save error in main process:', error);
        throw error;
    }
});

ipcMain.handle('dialog:saveAsFile', async (event, { content, defaultPath }) => {
    let resolvedDefault = defaultPath;
    if (defaultPath && !path.isAbsolute(defaultPath) && lastSaveDir) {
        resolvedDefault = path.join(lastSaveDir, defaultPath);
    }
    const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: resolvedDefault || defaultPath,
        filters: [
            { name: 'テキストファイル', extensions: ['txt', 'md', 'json', 'html', 'css', 'js', 'ts', 'tsx'] },
            { name: 'すべてのファイル', extensions: ['*'] }
        ]
    });
    if (canceled) return false;

    let finalPath = filePath;
    if (!path.basename(finalPath).includes('.')) {
        finalPath += '.txt';
    }

    try {
        await fs.writeFile(finalPath, content, 'utf8');
        lastSaveDir = path.dirname(finalPath);
        return finalPath;
    } catch (error) {
        console.error('Save As error in main process:', error);
        throw error;
    }
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
    try {
        return await fs.readFile(filePath, 'utf8');
    } catch (error) {
        console.error('Read file error:', error);
        throw error;
    }
});

ipcMain.handle('fs:writeFile', async (event, { path: filePath, content }) => {
    try {
        await fs.writeFile(filePath, content, 'utf8');
        return true;
    } catch (error) {
        console.error('Write file error:', error);
        throw error;
    }
});

// 外部URL をOSブラウザで開く IPC ハンドラ（コンテキストメニュー等から使用）
ipcMain.handle('shell:openExternal', async (event, url) => {
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
        await shell.openExternal(url);
        return true;
    }
    return false;
});

// --- Markdown → HTML 変換ヘルパー (PDFエクスポート用) ---
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(text) {
    // インライン数式 ($$...$$, $...$) とインラインコード (`...`) を一時退避して Markdown 記号の誤変換を防ぐ
    const placeholders = [];
    const stash = (rawHtml) => {
        const token = `\u0000PH${placeholders.length}\u0000`;
        placeholders.push(rawHtml);
        return token;
    };

    let working = String(text);

    // 1. インラインコード `...` を退避
    working = working.replace(/`([^`]+)`/g, (_, code) => {
        return stash(`<code>${escapeHtml(code)}</code>`);
    });

    // 2. ディスプレイ数式 $$...$$ (同一行内) を退避
    working = working.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
        return stash(`$$${escapeHtml(math)}$$`);
    });

    // 3. インライン数式 $...$ を退避
    working = working.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
        return stash(`$${escapeHtml(math)}$`);
    });

    let out = escapeHtml(working);
    // 画像
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');
    // リンク
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // 太字 + 斜体
    out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    // 太字
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // 斜体
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    out = out.replace(/_([^_]+)_/g, '<em>$1</em>');
    // 打ち消し線
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // 退避した要素を復元
    out = out.replace(/\u0000PH(\d+)\u0000/g, (_, idx) => placeholders[Number(idx)]);
    return out;
}

function stripMarkdownInline(text) {
    return String(text)
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .trim();
}

/**
 * Markdown先頭から最初の水平線（---）までを表紙用、それ以降を本文用として分割する
 */
function splitCoverAndBodyMarkdown(markdown) {
    if (!markdown || typeof markdown !== 'string') {
        return { coverMarkdown: '', bodyMarkdown: '' };
    }
    const normalized = markdown.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    let inCodeBlock = false;
    let splitIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^```(\w*)\s*$/.test(line)) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        if (!inCodeBlock && /^---\s*$/.test(line.trim())) {
            splitIndex = i;
            break;
        }
    }

    if (splitIndex !== -1) {
        return {
            coverMarkdown: lines.slice(0, splitIndex).join('\n').trim(),
            bodyMarkdown: lines.slice(splitIndex + 1).join('\n').trim(),
        };
    }

    return {
        coverMarkdown: '',
        bodyMarkdown: normalized,
    };
}

function convertMarkdownToHtml(markdown, options = {}) {
    const { collectHeadings = false, idPrefix = 'section' } = options;
    if (!markdown || typeof markdown !== 'string') {
        return collectHeadings ? { html: '', headings: [] } : '';
    }
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const html = [];
    const headings = [];
    let headingCounter = 0;
    let inCodeBlock = false;
    let codeLang = '';
    let codeBuffer = [];
    let inMathBlock = false;
    let mathBuffer = [];
    let inUl = false;
    let inOl = false;
    let inBlockquote = false;
    let inTable = false;
    let paragraphBuffer = [];

    const flushParagraph = () => {
        if (paragraphBuffer.length > 0) {
            html.push(`<p>${paragraphBuffer.map(renderInlineMarkdown).join('<br />')}</p>`);
            paragraphBuffer = [];
        }
    };
    const closeLists = () => {
        if (inUl) { html.push('</ul>'); inUl = false; }
        if (inOl) { html.push('</ol>'); inOl = false; }
    };
    const closeBlockquote = () => {
        if (inBlockquote) { html.push('</blockquote>'); inBlockquote = false; }
    };
    const closeTable = () => {
        if (inTable) { html.push('</tbody></table>'); inTable = false; }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // コードブロック開始/終了
        const fenceMatch = line.match(/^```(\w*)\s*$/);
        if (fenceMatch && !inMathBlock) {
            flushParagraph();
            closeLists();
            closeBlockquote();
            closeTable();
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeLang = fenceMatch[1] || '';
                codeBuffer = [];
            } else {
                const langLabel = codeLang ? `<div class="code-lang">${escapeHtml(codeLang)}</div>` : '';
                html.push(`<div class="code-block">${langLabel}<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre></div>`);
                inCodeBlock = false;
                codeLang = '';
                codeBuffer = [];
            }
            continue;
        }

        if (inCodeBlock) {
            codeBuffer.push(line);
            continue;
        }

        // ブロック数式 ($$ ... $$) の処理
        const trimmedLine = line.trim();
        if (!inMathBlock && trimmedLine.startsWith('$$') && trimmedLine.endsWith('$$') && trimmedLine.length > 4) {
            flushParagraph();
            closeLists();
            closeBlockquote();
            closeTable();
            html.push(`<div class="math-block">${escapeHtml(trimmedLine)}</div>`);
            continue;
        }
        if (trimmedLine === '$$') {
            flushParagraph();
            closeLists();
            closeBlockquote();
            closeTable();
            if (!inMathBlock) {
                inMathBlock = true;
                mathBuffer = [];
            } else {
                html.push(`<div class="math-block">$$\n${escapeHtml(mathBuffer.join('\n'))}\n$$</div>`);
                inMathBlock = false;
                mathBuffer = [];
            }
            continue;
        }
        if (inMathBlock) {
            mathBuffer.push(line);
            continue;
        }

        // 空行
        if (line.trim() === '') {
            flushParagraph();
            closeLists();
            closeBlockquote();
            closeTable();
            continue;
        }

        // 水平線
        if (/^(?:---|\*\*\*|___)\s*$/.test(line.trim())) {
            flushParagraph();
            closeLists();
            closeBlockquote();
            closeTable();
            html.push('<hr />');
            continue;
        }

        // 見出し (# 〜 ######)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            flushParagraph();
            closeLists();
            closeBlockquote();
            closeTable();
            const level = headingMatch[1].length;
            const rawHeadingText = headingMatch[2].trim();
            headingCounter++;
            const headingId = `${idPrefix}-${headingCounter}`;

            if (collectHeadings && (level === 1 || level === 2)) {
                headings.push({
                    id: headingId,
                    level,
                    text: stripMarkdownInline(rawHeadingText),
                    html: renderInlineMarkdown(rawHeadingText),
                });
            }

            html.push(`<h${level} id="${headingId}">${renderInlineMarkdown(rawHeadingText)}</h${level}>`);
            continue;
        }

        // テーブル
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            flushParagraph();
            closeLists();
            closeBlockquote();
            const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
            // 区切り行 (|---|---|) はスキップ
            if (cells.every(c => /^:?-{2,}:?$/.test(c))) {
                continue;
            }
            if (!inTable) {
                const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
                const isHeader = nextLine.startsWith('|') && nextLine.endsWith('|') &&
                    nextLine.slice(1, -1).split('|').every(c => /^:?-{2,}:?$/.test(c.trim()));
                html.push('<table>');
                if (isHeader) {
                    html.push('<thead><tr>' + cells.map(c => `<th>${renderInlineMarkdown(c)}</th>`).join('') + '</tr></thead><tbody>');
                    i++; // 区切り行をスキップ
                } else {
                    html.push('<tbody><tr>' + cells.map(c => `<td>${renderInlineMarkdown(c)}</td>`).join('') + '</tr>');
                }
                inTable = true;
            } else {
                html.push('<tr>' + cells.map(c => `<td>${renderInlineMarkdown(c)}</td>`).join('') + '</tr>');
            }
            continue;
        } else if (inTable) {
            closeTable();
        }

        // 引用 (>)
        const quoteMatch = line.match(/^>\s?(.*)$/);
        if (quoteMatch) {
            flushParagraph();
            closeLists();
            if (!inBlockquote) {
                html.push('<blockquote>');
                inBlockquote = true;
            }
            html.push(`<p>${renderInlineMarkdown(quoteMatch[1])}</p>`);
            continue;
        } else if (inBlockquote) {
            closeBlockquote();
        }

        // 箇条書きリスト (- / * / +) & チェックボックス
        const ulMatch = line.match(/^\s*[-*+]\s+(.+)$/);
        if (ulMatch) {
            flushParagraph();
            if (inOl) { html.push('</ol>'); inOl = false; }
            if (!inUl) { html.push('<ul>'); inUl = true; }
            const itemText = ulMatch[1];
            const taskMatch = itemText.match(/^\[([ xX])\]\s+(.+)$/);
            if (taskMatch) {
                const checked = taskMatch[1].toLowerCase() === 'x';
                html.push(`<li class="task-item"><input type="checkbox" disabled ${checked ? 'checked' : ''} /> ${renderInlineMarkdown(taskMatch[2])}</li>`);
            } else {
                html.push(`<li>${renderInlineMarkdown(itemText)}</li>`);
            }
            continue;
        }

        // 番号付きリスト (1. )
        const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
        if (olMatch) {
            flushParagraph();
            if (inUl) { html.push('</ul>'); inUl = false; }
            if (!inOl) { html.push('<ol>'); inOl = true; }
            html.push(`<li>${renderInlineMarkdown(olMatch[1])}</li>`);
            continue;
        }

        closeLists();
        paragraphBuffer.push(line);
    }

    if (inCodeBlock) {
        html.push(`<div class="code-block"><pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre></div>`);
    }
    if (inMathBlock) {
        html.push(`<div class="math-block">$$\n${escapeHtml(mathBuffer.join('\n'))}\n$$</div>`);
    }
    flushParagraph();
    closeLists();
    closeBlockquote();
    closeTable();

    const joined = html.join('\n');
    return collectHeadings ? { html: joined, headings } : joined;
}

function buildBookStructuredHtml(markdown, fallbackTitle) {
    const { coverMarkdown, bodyMarkdown } = splitCoverAndBodyMarkdown(markdown);

    // 1. 表紙セクション (class="cover-page") の生成
    let coverInnerHtml = '';
    if (coverMarkdown) {
        coverInnerHtml = convertMarkdownToHtml(coverMarkdown, { collectHeadings: false, idPrefix: 'cover' });
    } else {
        coverInnerHtml = `<h1 class="cover-title">${escapeHtml(fallbackTitle || '無題')}</h1>`;
    }
    const coverSectionHtml = `<section class="cover-page">\n  <div class="cover-inner">\n${coverInnerHtml}\n  </div>\n</section>`;

    // 2. 本文セクションの変換と h1, h2 の抽出
    const { html: bodyHtml, headings } = convertMarkdownToHtml(bodyMarkdown, {
        collectHeadings: true,
        idPrefix: 'heading',
    });

    // 3. 自動目次 (class="toc-page") の生成
    const tocItemsHtml = headings.length > 0
        ? headings.map(h => (
            `    <li class="toc-item toc-level-${h.level}">` +
            `<a class="toc-link" href="#${h.id}" data-target-id="${h.id}">` +
            `<span class="toc-text">${h.html}</span>` +
            `<span class="toc-leader" aria-hidden="true"></span>` +
            `<span class="toc-page-num"></span>` +
            `</a></li>`
        )).join('\n')
        : `    <li class="toc-empty">目次項目はありません</li>`;

    const tocSectionHtml = `<nav class="toc-page" aria-label="目次">\n  <h2 class="toc-heading">目次</h2>\n  <ul class="toc-list">\n${tocItemsHtml}\n  </ul>\n</nav>`;

    // 4. 本文ラッパー
    const mainSectionHtml = `<main class="document-body">\n${bodyHtml}\n</main>`;

    return `${coverSectionHtml}\n${tocSectionHtml}\n${mainSectionHtml}`;
}

function buildPrintHtmlDocument({ bodyHtml, title }) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title || 'Document')}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous" />
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
<style>
  @page {
    size: A4;
  }
  @page :first {
    margin-top: 0;
    margin-bottom: 0;
  }
  * {
    box-sizing: border-box;
  }
  html, body {
    margin: 0 auto;
    padding: 0;
    max-width: 174mm;
    background: #ffffff;
    color: #1f2937;
    font-family: "Noto Sans CJK JP", "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Meiryo", system-ui, -apple-system, sans-serif;
    font-size: 10.5pt;
    line-height: 1.8;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  @media print {
    html, body {
      max-width: none;
      margin: 0;
    }
  }

  /* ── 1. 表紙 (Cover Page) ── */
  .cover-page {
    min-height: 240mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 25mm 15mm 45mm 15mm;
    break-after: page;
    page-break-after: always;
  }
  .cover-page .cover-inner {
    width: 100%;
    max-width: 150mm;
    margin: auto 0;
  }
  .cover-page h1 {
    font-size: 26pt;
    font-weight: 700;
    color: #111827;
    line-height: 1.35;
    margin: 0 0 0.6em 0;
    padding-bottom: 0.4em;
    border-bottom: 2px solid #1f2937;
    break-before: auto;
    page-break-before: auto;
    break-after: avoid;
    page-break-after: avoid;
  }
  .cover-page h2 {
    font-size: 15pt;
    font-weight: 500;
    color: #4b5563;
    line-height: 1.5;
    margin: 0.4em 0 1.2em 0;
    border-bottom: none;
    padding-bottom: 0;
    break-after: avoid;
    page-break-after: avoid;
  }
  .cover-page h3,
  .cover-page p {
    font-size: 11.5pt;
    color: #4b5563;
    margin: 0.5em 0;
    line-height: 1.6;
  }

  /* ── 2. 目次 (Table of Contents) ── */
  .toc-page {
    padding: 10mm 4mm 20mm 4mm;
    break-after: page;
    page-break-after: always;
  }
  .toc-page .toc-heading {
    font-size: 18pt;
    font-weight: 700;
    color: #111827;
    text-align: center;
    letter-spacing: 0.15em;
    margin: 0 0 1.6em 0;
    padding-bottom: 0.4em;
    border-bottom: 2px solid #1f2937;
    break-before: auto;
    page-break-before: auto;
    break-after: avoid;
    page-break-after: avoid;
  }
  .toc-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .toc-item {
    margin: 0;
    padding: 0;
    line-height: 1.95;
  }
  .toc-item.toc-level-1 {
    font-size: 11pt;
    font-weight: 700;
    margin-top: 0.65em;
  }
  .toc-item.toc-level-2 {
    font-size: 10pt;
    font-weight: 400;
    padding-left: 1.5em;
    color: #374151;
  }
  .toc-link {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    color: inherit;
    text-decoration: none;
    width: 100%;
    gap: 4px;
  }
  .toc-text {
    flex: 0 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .toc-leader {
    flex: 1 1 auto;
    min-width: 16px;
    border-bottom: 1px dotted #9ca3af;
    margin: 0 6px;
    height: 1px;
    transform: translateY(-3px);
  }
  .toc-page-num {
    flex: 0 0 auto;
    min-width: 2.2em;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #374151;
    font-weight: 600;
    white-space: nowrap;
  }
  .toc-empty {
    color: #6b7280;
    text-align: center;
    padding: 2em 0;
    font-style: italic;
  }

  /* ── 3. 本文・見出し・改ページ制御 ── */
  h1, h2, h3, h4, h5, h6 {
    color: #111827;
    font-weight: 700;
    line-height: 1.35;
    margin-top: 1.4em;
    margin-bottom: 0.6em;
  }
  h1, h2, h3, h4 {
    break-after: avoid;
    page-break-after: avoid;
  }
  .document-body h1 {
    font-size: 20pt;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.3em;
    margin-top: 0;
    break-before: page;
    page-break-before: always;
  }
  .document-body > h1:first-child {
    break-before: page;
    page-break-before: always;
  }
  .document-body h2 {
    font-size: 15.5pt;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.25em;
  }
  .document-body h3 { font-size: 13pt; }
  .document-body h4 { font-size: 11.5pt; }
  .document-body h5,
  .document-body h6 { font-size: 10.5pt; color: #4b5563; }

  p {
    margin: 0 0 0.9em 0;
  }
  ul, ol {
    margin: 0 0 0.9em 0;
    padding-left: 1.8em;
  }
  li {
    margin-bottom: 0.25em;
  }
  li.task-item {
    list-style: none;
    margin-left: -1.4em;
  }

  /* 分割禁止要素 (pre, table, blockquote, math-block) */
  pre,
  table,
  blockquote,
  .code-block,
  .math-block {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .math-block {
    margin: 1em 0;
    overflow-x: auto;
  }

  blockquote {
    margin: 0 0 1em 0;
    padding: 0.5em 1em;
    border-left: 4px solid #6366f1;
    background-color: #f8fafc;
    color: #374151;
    border-radius: 0 4px 4px 0;
  }
  blockquote p:last-child {
    margin-bottom: 0;
  }
  code {
    font-family: "Noto Sans Mono CJK JP", "JetBrains Mono", "Fira Code", "Source Code Pro", monospace;
    font-size: 9.2pt;
    background-color: #f3f4f6;
    color: #db2777;
    padding: 0.15em 0.35em;
    border-radius: 4px;
  }
  .code-block {
    margin: 0 0 1em 0;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background-color: #f9fafb;
    overflow: hidden;
  }
  .code-lang {
    background-color: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
    padding: 4px 12px;
    font-size: 8pt;
    font-family: monospace;
    color: #6b7280;
    text-transform: uppercase;
  }
  pre {
    margin: 0;
    padding: 10px 14px;
    white-space: pre-wrap;
    word-break: break-all;
  }
  pre code {
    background: transparent;
    color: #1f2937;
    padding: 0;
    font-size: 9pt;
    line-height: 1.55;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 1.1em 0;
    font-size: 9.5pt;
  }
  th, td {
    border: 1px solid #d1d5db;
    padding: 6px 10px;
    text-align: left;
  }
  th {
    background-color: #f3f4f6;
    font-weight: 700;
  }
  tr:nth-child(even) td {
    background-color: #f9fafb;
  }
  hr {
    border: none;
    border-top: 1px solid #d1d5db;
    margin: 1.5em 0;
  }
  a {
    color: #2563eb;
    text-decoration: underline;
  }
  .toc-link {
    color: inherit;
    text-decoration: none;
  }
  img {
    max-width: 100%;
    height: auto;
  }
</style>
<script>
  // 見出しの印刷ページ番号を実測・算出して目次（TOC）に埋め込む
  function computeAndFillTocPageNumbers() {
    // A4 縦 (297mm) - 上余白(20mm) - 下余白(22mm) = 255mm の印刷可能高さ (96dpi換算: 255 * 96 / 25.4 ≈ 963.78px)
    const MM_TO_PX = 96 / 25.4;
    const PRINTABLE_PAGE_HEIGHT_PX = (297 - 20 - 22) * MM_TO_PX;

    const coverEl = document.querySelector('.cover-page');
    const tocEl = document.querySelector('.toc-page');
    const bodyEl = document.querySelector('.document-body');

    // 1. 表紙のページ数 (通常 1ページ)
    const coverPages = coverEl ? 1 : 0;

    // 2. 目次のページ数 (目次自身の高さから算出、最低1ページ)
    const tocHeight = tocEl ? tocEl.getBoundingClientRect().height : 0;
    const tocPages = tocEl ? Math.max(1, Math.ceil(tocHeight / PRINTABLE_PAGE_HEIGHT_PX)) : 0;

    // 本文開始ページ番号 (表紙1p + 目次1p なら 3ページ目から開始)
    let currentPage = coverPages + tocPages + 1;

    if (!bodyEl) return;

    const children = Array.from(bodyEl.children);
    const headingPageMap = {};

    // 本文の要素を上から走査し、h1 での強制改ページ (break-before: page) と
    // ページ高さ (PRINTABLE_PAGE_HEIGHT_PX) 及び分割禁止要素を考慮して各見出しのページ番号を算出
    let chapterStartTop = null;
    let pageOffsetInChapter = 0;
    let currentPageTopY = null;

    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      const tag = el.tagName ? el.tagName.toUpperCase() : '';
      const rect = el.getBoundingClientRect();
      const elTop = el.offsetTop;
      const elHeight = rect.height;

      if (tag === 'H1') {
        if (chapterStartTop !== null) {
          // 前の章の最終ページから次の新ページへ強制改ページ
          currentPage += pageOffsetInChapter + 1;
        }
        chapterStartTop = elTop;
        pageOffsetInChapter = 0;
        currentPageTopY = elTop;
      } else {
        if (chapterStartTop === null) {
          chapterStartTop = elTop;
          currentPageTopY = elTop;
        }
        const distFromPageTop = elTop - currentPageTopY;
        const isAvoidBreakInside =
          tag === 'PRE' ||
          tag === 'TABLE' ||
          tag === 'BLOCKQUOTE' ||
          el.classList.contains('code-block') ||
          el.classList.contains('math-block');

        if (distFromPageTop >= PRINTABLE_PAGE_HEIGHT_PX) {
          const pagesAdvanced = Math.floor(distFromPageTop / PRINTABLE_PAGE_HEIGHT_PX);
          pageOffsetInChapter += pagesAdvanced;
          currentPageTopY += pagesAdvanced * PRINTABLE_PAGE_HEIGHT_PX;
        } else if (
          isAvoidBreakInside &&
          distFromPageTop + elHeight > PRINTABLE_PAGE_HEIGHT_PX &&
          elHeight <= PRINTABLE_PAGE_HEIGHT_PX
        ) {
          // break-inside: avoid 要素がページ境界を跨ぐ場合は次ページ先頭に送られる
          pageOffsetInChapter += 1;
          currentPageTopY = elTop;
        }
      }

      if ((tag === 'H1' || tag === 'H2') && el.id) {
        headingPageMap[el.id] = currentPage + pageOffsetInChapter;
      }

      // 要素自体が複数ページに跨る長大要素の場合のページ進行を反映
      const bottomY = elTop + elHeight;
      if (bottomY - currentPageTopY > PRINTABLE_PAGE_HEIGHT_PX) {
        const extraPages = Math.floor((bottomY - currentPageTopY) / PRINTABLE_PAGE_HEIGHT_PX);
        pageOffsetInChapter += extraPages;
        currentPageTopY += extraPages * PRINTABLE_PAGE_HEIGHT_PX;
      }
    }

    // 目次リンクに算出したページ番号を埋め込む
    const tocLinks = document.querySelectorAll('.toc-link');
    tocLinks.forEach((link) => {
      const targetId = link.getAttribute('data-target-id') || (link.getAttribute('href') || '').replace(/^#/, '');
      const pageNumEl = link.querySelector('.toc-page-num');
      if (pageNumEl && targetId && headingPageMap[targetId] != null) {
        pageNumEl.textContent = String(headingPageMap[targetId]);
      }
    });
  }

  function initializePrintDocument() {
    if (window.__pdfRenderReady) return;
    try {
      if (typeof renderMathInElement === 'function') {
        renderMathInElement(document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\\\(', right: '\\\\)', display: false },
            { left: '\\\\[', right: '\\\\]', display: true }
          ],
          throwOnError: false
        });
      }
    } catch (e) {
      console.error('KaTeX render error:', e);
    }

    computeAndFillTocPageNumbers();
    window.__pdfRenderReady = true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof renderMathInElement === 'function') {
      initializePrintDocument();
    } else {
      window.addEventListener('load', initializePrintDocument, { once: true });
      setTimeout(initializePrintDocument, 1500);
    }
  });
</script>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

// --- PDFエクスポート IPC ---
ipcMain.handle('export-pdf', async (event, data) => {
    const rawInput = typeof data === 'string' ? { markdown: data } : (data || {});
    const markdown = rawInput.markdown ?? rawInput.content ?? '';
    const providedHtml = rawInput.html;
    const title = rawInput.title || '無題';
    const rawDefaultPath = rawInput.defaultPath || `${title.replace(/\.(md|txt)$/i, '')}.pdf`;

    let resolvedDefault = rawDefaultPath;
    if (rawDefaultPath && !path.isAbsolute(rawDefaultPath) && lastSaveDir) {
        resolvedDefault = path.join(lastSaveDir, rawDefaultPath);
    }

    const parentWin = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(parentWin || undefined, {
        title: 'PDFとしてエクスポート',
        defaultPath: resolvedDefault,
        filters: [
            { name: 'PDFファイル', extensions: ['pdf'] },
            { name: 'すべてのファイル', extensions: ['*'] }
        ]
    });

    if (canceled || !filePath) {
        return { success: false, canceled: true };
    }

    let finalPath = filePath;
    if (!finalPath.toLowerCase().endsWith('.pdf')) {
        finalPath += '.pdf';
    }

    let printWin = null;
    try {
        const bodyHtml = providedHtml || buildBookStructuredHtml(markdown, title);
        const fullHtml = buildPrintHtmlDocument({ bodyHtml, title });

        printWin = new BrowserWindow({
            show: false,
            width: 658,
            height: 964,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
        });

        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`;
        await printWin.loadURL(dataUrl);

        // KaTeX の数式レンダリングと目次ページ番号計算が完了するまで待機
        await printWin.webContents.executeJavaScript(`
            new Promise((resolve) => {
                const check = () => {
                    if (window.__pdfRenderReady) {
                        if (document.fonts && document.fonts.ready) {
                            document.fonts.ready.then(() => setTimeout(resolve, 100));
                        } else {
                            setTimeout(resolve, 100);
                        }
                    } else {
                        setTimeout(check, 50);
                    }
                };
                check();
                setTimeout(resolve, 3000);
            });
        `);

        const pdfBuffer = await printWin.webContents.printToPDF({
            pageSize: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
              <style>
                #footer {
                  overflow: hidden !important;
                }
                #footer[style*="height: 0px"],
                #footer[style*="height: 0px"] .footer-container {
                  visibility: hidden !important;
                  display: none !important;
                }
                .footer-container {
                  font-size: 9pt;
                  width: 100%;
                  text-align: center;
                  color: #777;
                }
                /* 1ページ目（表紙）のときはフッター全体を非表示 */
                .page-1 .footer-container,
                [data-page-number="1"] {
                  visibility: hidden;
                  display: none !important;
                }
              </style>
              <div class="footer-container">
                <span class="pageNumber"></span> / <span class="totalPages"></span>
              </div>
            `,
            margins: {
                top: 0.79,
                bottom: 0.87,
                left: 0.71,
                right: 0.71,
            },
        });

        fsSync.writeFileSync(finalPath, pdfBuffer);
        lastSaveDir = path.dirname(finalPath);

        return { success: true, filePath: finalPath };
    } catch (error) {
        console.error('PDF export error in main process:', error);
        return { success: false, error: error.message || 'PDF出力に失敗しました。' };
    } finally {
        if (printWin && !printWin.isDestroyed()) {
            printWin.close();
        }
    }
});

// --- Chat History IPC ---
const CHAT_HISTORY_FILE = path.join(app.getPath('userData'), 'chat_history.json');

ipcMain.handle('chat:loadHistory', async () => {
    try {
        const data = await fs.readFile(CHAT_HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return []; // ファイルがない場合は空配列
        }
        console.error('Failed to load chat history:', error);
        return [];
    }
});

ipcMain.handle('chat:saveHistory', async (event, history) => {
    try {
        await fs.writeFile(CHAT_HISTORY_FILE, JSON.stringify(history), 'utf8');
        return true;
    } catch (error) {
        console.error('Failed to save chat history:', error);
        return false;
    }
});

// 環境変数またはadditionalDataからファイルパスを取得（npmラッパー対策）
// process.argv は npm run 経由だと握りつぶされるため使用しない
function getFilePathFromEnvOrData(envFile, additionalData) {
    let filePath = null;

    // 1. 環境変数を優先（初回起動時、または2つ目のインスタンス自身）
    if (envFile && typeof envFile === 'string' && envFile.trim().length > 0) {
        filePath = envFile.trim();
    }
    // 2. additionalData（2つ目のインスタンスから送られてきたデータ）
    else if (additionalData && additionalData.filepath && typeof additionalData.filepath === 'string') {
        filePath = additionalData.filepath;
    }

    if (filePath) {
        try {
            if (fsSync.existsSync(filePath) && fsSync.statSync(filePath).isFile()) {
                return filePath;
            }
        } catch (e) {
            // アクセスエラー等は無視
        }
    }
    return null;
}


let pendingOpenData = null; // レンダラー準備完了までデータを保持するための変数

// ファイルを読み込んでデータオブジェクトを返す（送信はしない）
async function loadFileContent(filePath) {
    if (!filePath) return null;
    try {
        const content = await fs.readFile(filePath, 'utf8');
        const fileName = path.basename(filePath);
        return { fileName, content, filePath };
    } catch (e) {
        console.error('File read error:', e);
        return null;
    }
}

// UIからの準備完了通知を受け取る
ipcMain.on('ui-ready', (event) => {
    if (pendingOpenData) {
        event.sender.send('open-external-file', pendingOpenData);
        pendingOpenData = null; // 送信後はクリア
    }
});

// シングルインスタンスロック
// 2つ目のインスタンスが起動した際、環境変数 (AHME_OPEN_FILE) を1つ目に渡す
const additionalData = { filepath: process.env.AHME_OPEN_FILE };
const gotTheLock = app.requestSingleInstanceLock(additionalData);

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', async (event, commandLine, workingDirectory, additionalData) => {
        // すでにインスタンスがある場合、ウィンドウにフォーカス
        const wins = BrowserWindow.getAllWindows();
        if (wins.length > 0) {
            const win = wins[0];
            if (win.isMinimized()) win.restore();
            win.focus();

            // additionalData からファイルパスを取得して開く
            const filePath = getFilePathFromEnvOrData(null, additionalData);
            if (filePath) {
                const data = await loadFileContent(filePath);
                if (data) {
                    win.webContents.send('open-external-file', data);
                }
            }
        }
    });

    app.whenReady().then(async () => {
        // 初回起動時のファイルチェック（環境変数から）
        const filePath = getFilePathFromEnvOrData(process.env.AHME_OPEN_FILE, null);
        if (filePath) {
            // まだウィンドウもIPCもないため、データを保持しておく
            pendingOpenData = await loadFileContent(filePath);
        }

        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });
}


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- 右クリックメニューの制御 ---
ipcMain.on('show-context-menu', (event) => {
    const template = [
        { role: 'cut', label: '切り取り' },
        { role: 'copy', label: 'コピー' },
        { role: 'paste', label: '貼り付け' }, // ← シンプルにこれだけに戻す
        { type: 'separator' },
        { role: 'selectAll', label: 'すべて選択' }
    ];
    const menu = Menu.buildFromTemplate(template);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        menu.popup({ window: win });
    }
});