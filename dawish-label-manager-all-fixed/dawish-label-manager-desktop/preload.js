const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('DawishDesktop', {
  getInfo: () => ipcRenderer.invoke('app:getInfo'),
  getPrinters: () => ipcRenderer.invoke('printer:list'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  saveBackup: (payload) => ipcRenderer.invoke('backup:save', payload),
  loadBackup: () => ipcRenderer.invoke('backup:load'),
  addActivity: (entry) => ipcRenderer.invoke('activity:add', entry),
  listActivity: () => ipcRenderer.invoke('activity:list'),
  clearActivity: () => ipcRenderer.invoke('activity:clear'),
  runMaintenance: () => ipcRenderer.invoke('maintenance:run'),
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onReady: (cb) => ipcRenderer.on('desktop:ready', (_e, data) => cb(data)),
  onOpenControlCenter: (cb) => ipcRenderer.on('desktop:open-control-center', (_e, tab) => cb(tab)),
  onUpdateAvailable: (cb) => ipcRenderer.on('update:available', (_e, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update:downloaded', (_e, info) => cb(info)),
  onUpdateError: (cb) => ipcRenderer.on('update:error', (_e, error) => cb(error))
});
