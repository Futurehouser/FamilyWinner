// FamilyWinner - proceso principal de Electron (Windows portable)
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    title: 'FamilyWinner',
    icon: path.join(__dirname, '..', 'www', 'icon.png'),
    backgroundColor: '#0f5132',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Descarga siguiendo redirecciones (GitHub redirige a su CDN)
function download(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 10) return reject(new Error('Demasiadas redirecciones'));
    https.get(url, { headers: { 'User-Agent': 'FamilyWinner-Updater' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(download(res.headers.location, dest, onProgress, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let got = 0;
      const out = fs.createWriteStream(dest);
      res.on('data', chunk => { got += chunk.length; if (total) onProgress(got / total); });
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve()));
      out.on('error', reject);
      res.on('error', reject);
    }).on('error', reject);
  });
}

ipcMain.handle('fw:download-and-install', async (event, url) => {
  // Ruta del .exe portable original (electron-builder la expone en esta variable)
  const target = process.env.PORTABLE_EXECUTABLE_FILE;
  if (!target) {
    shell.openExternal('https://github.com/Futurehouser/FamilyWinner/releases/latest');
    return { mode: 'browser' };
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'familywinner-update-'));
  const newExe = path.join(tmpDir, 'FamilyWinner-Portable.exe');
  await download(url, newExe, p => event.sender.send('fw:progress', p));

  // Script que espera a que se cierre la app, sustituye el .exe y la vuelve a abrir
  const script = path.join(tmpDir, 'update.cmd');
  fs.writeFileSync(script, [
    '@echo off',
    'set /a tries=0',
    ':retry',
    'timeout /t 1 /nobreak >nul',
    `move /y "${newExe}" "${target}" >nul 2>&1`,
    'if errorlevel 1 (',
    '  set /a tries+=1',
    '  if %tries% lss 60 goto retry',
    '  exit /b 1',
    ')',
    `start "" "${target}"`,
    'exit /b 0'
  ].join('\r\n'));
  spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  setTimeout(() => app.quit(), 300);
  return { mode: 'replace' };
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
