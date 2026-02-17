const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    getSavePath: (defaultPath) => ipcRenderer.invoke('dialog:getSavePath', { defaultPath }),
    saveFile: (content, filePath) => ipcRenderer.invoke('dialog:saveFile', { content, filePath }),
    saveAsFile: (content, defaultPath) => ipcRenderer.invoke('dialog:saveAsFile', { content, defaultPath }),
    readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', { path, content }),
    on: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args)),
});
