const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    getSavePath: (defaultPath) => ipcRenderer.invoke('dialog:getSavePath', { defaultPath }),
    saveFile: (content, filePath) => ipcRenderer.invoke('dialog:saveFile', { content, filePath }),
    saveAsFile: (content, defaultPath) => ipcRenderer.invoke('dialog:saveAsFile', { content, defaultPath }),
    readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', { path, content }),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
    showContextMenu: () => ipcRenderer.send('show-context-menu'),
    uiReady: () => ipcRenderer.send('ui-ready'),
    on: (channel, callback) => {
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
    },
    removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
});
