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
                { type: 'separator' },
                { label: '終了', role: 'quit' }
            ]
        },
        {
            label: '編集',
            submenu: [
                { label: '元に戻す', role: 'undo' },
                { label: 'やり直し', role: 'redo' },
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

// IPC ハンドラの設定
ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'テキストファイル', extensions: ['txt', 'md', 'json', 'html', 'css', 'js', 'ts', 'tsx', 'py', 'rs', 'toml', 'yaml', 'yml', 'xml', 'csv'] },
            { name: 'すべてのファイル', extensions: ['*'] }
        ]
    });
    if (canceled) return null;
    return filePaths[0];
});

ipcMain.handle('dialog:getSavePath', async (event, { defaultPath }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: defaultPath,
        filters: [
            { name: 'テキストファイル', extensions: ['txt', 'md', 'json', 'html', 'css', 'js', 'ts', 'tsx'] },
            { name: 'すべてのファイル', extensions: ['*'] }
        ]
    });
    return canceled ? null : filePath;
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
    const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: defaultPath,
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
