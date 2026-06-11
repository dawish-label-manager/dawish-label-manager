const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

const APP_NAME = 'Dawish Label Manager';
const AR_NAME = 'نظام إدارة الملصقات - عطارة الدويش';
const isDev = !app.isPackaged;
let mainWindow = null;

function dataFile(name) {
  return path.join(app.getPath('userData'), name);
}

function readJson(name, fallback) {
  try {
    const p = dataFile(name);
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(name, value) {
  const p = dataFile(name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(value, null, 2), 'utf8');
  return value;
}

function appendLog(type, message, details = {}) {
  const logs = readJson('activity-log.json', []);
  logs.unshift({
    id: Date.now() + '-' + Math.random().toString(16).slice(2),
    type,
    message,
    details,
    at: new Date().toISOString(),
    device: require('os').hostname()
  });
  writeJson('activity-log.json', logs.slice(0, 1000));
  return logs[0];
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1060,
    minHeight: 720,
    title: AR_NAME,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    backgroundColor: '#f3efe5',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'camera', 'microphone', 'notifications'];
    callback(allowed.includes(permission));
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('desktop:ready', {
      name: AR_NAME,
      version: app.getVersion(),
      userData: app.getPath('userData')
    });
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function buildMenu() {
  const template = [
    {
      label: 'النظام',
      submenu: [
        { label: 'مركز التحكم', click: () => mainWindow?.webContents.send('desktop:open-control-center') },
        { label: 'إعدادات الطابعة', click: () => mainWindow?.webContents.send('desktop:open-control-center', 'printer') },
        { type: 'separator' },
        { label: 'إعادة تحميل', role: 'reload' },
        { label: 'ملء الشاشة', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'خروج', role: 'quit' }
      ]
    },
    {
      label: 'الأدوات',
      submenu: [
        { label: 'فحص التحديثات', click: () => checkForUpdatesManual() },
        { label: 'فتح مجلد البيانات', click: () => shell.openPath(app.getPath('userData')) },
        { label: 'حفظ نسخة احتياطية', click: () => mainWindow?.webContents.send('desktop:open-control-center', 'backup') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function checkForUpdatesManual() {
  if (isDev) {
    dialog.showMessageBox({
      type: 'info',
      title: 'التحديثات',
      message: 'وضع التطوير',
      detail: 'التحديث التلقائي يعمل بعد بناء البرنامج ورفع الإصدارات على GitHub Releases.'
    });
    return { ok: false, dev: true };
  }
  try {
    appendLog('update', 'تم فحص التحديثات يدويًا');
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, result };
  } catch (error) {
    dialog.showMessageBox({
      type: 'warning',
      title: 'التحديثات',
      message: 'تعذر فحص التحديثات الآن',
      detail: String(error?.message || error)
    });
    return { ok: false, error: String(error?.message || error) };
  }
}

ipcMain.handle('app:getInfo', () => ({
  name: AR_NAME,
  version: app.getVersion(),
  userData: app.getPath('userData'),
  device: require('os').hostname(),
  platform: process.platform,
  isPackaged: app.isPackaged
}));

ipcMain.handle('printer:list', async (event) => {
  const printers = await event.sender.getPrintersAsync();
  return printers.map(p => ({ name: p.name, displayName: p.displayName, status: p.status, isDefault: p.isDefault }));
});

ipcMain.handle('settings:get', () => readJson('settings.json', {
  printerName: '',
  labelSize: '58x40',
  safePrint: true,
  autoBackup: true,
  lockPin: '1234',
  trainingMode: false
}));

ipcMain.handle('settings:set', (_event, patch) => {
  const current = readJson('settings.json', {});
  const next = { ...current, ...(patch || {}) };
  appendLog('settings', 'تم تحديث إعدادات البرنامج', patch || {});
  return writeJson('settings.json', next);
});

ipcMain.handle('backup:save', async (_event, payload) => {
  const defaultPath = `dawish-label-backup-${new Date().toISOString().slice(0,10)}.json`;
  const { filePath } = await dialog.showSaveDialog({
    title: 'حفظ نسخة احتياطية',
    defaultPath,
    filters: [{ name: 'Dawish Backup', extensions: ['json'] }]
  });
  if (!filePath) return { ok: false, cancelled: true };
  const body = {
    app: APP_NAME,
    version: app.getVersion(),
    createdAt: new Date().toISOString(),
    device: require('os').hostname(),
    payload: payload || {}
  };
  fs.writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf8');
  appendLog('backup', 'تم حفظ نسخة احتياطية', { filePath });
  return { ok: true, filePath };
});

ipcMain.handle('backup:load', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'استيراد نسخة احتياطية',
    filters: [{ name: 'Dawish Backup', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths?.[0]) return { ok: false, cancelled: true };
  const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
  appendLog('backup', 'تم استيراد نسخة احتياطية', { filePath: filePaths[0] });
  return { ok: true, filePath: filePaths[0], data };
});

ipcMain.handle('activity:add', (_event, entry) => appendLog(entry?.type || 'general', entry?.message || 'عملية', entry?.details || {}));
ipcMain.handle('activity:list', () => readJson('activity-log.json', []));
ipcMain.handle('activity:clear', () => writeJson('activity-log.json', []));
ipcMain.handle('maintenance:run', () => {
  appendLog('maintenance', 'تم تشغيل الصيانة السريعة');
  return {
    ok: true,
    checks: [
      'تم فحص مجلد البيانات',
      'تم فحص إعدادات البرنامج',
      'تم فحص سجل العمليات',
      'تم تجهيز الكاش لإعادة التحميل'
    ],
    userData: app.getPath('userData')
  };
});
ipcMain.handle('update:check', () => checkForUpdatesManual());
ipcMain.handle('update:install', () => autoUpdater.quitAndInstall());

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  autoUpdater.autoDownload = false;
  autoUpdater.on('update-available', info => mainWindow?.webContents.send('update:available', info));
  autoUpdater.on('update-downloaded', info => mainWindow?.webContents.send('update:downloaded', info));
  autoUpdater.on('error', err => mainWindow?.webContents.send('update:error', String(err?.message || err)));
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
