const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

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

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
