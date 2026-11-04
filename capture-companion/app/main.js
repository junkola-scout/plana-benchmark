// Junkola Capture — always-on-top capture companion for Junkola Hyperspace.
// Main process: owns the floating window, global hotkeys, tray, native screen
// capture, and the local session ledger. Nothing leaves the machine yet —
// Hyperspace sync is a stub (see README).
'use strict';
const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain, desktopCapturer, screen, dialog, shell, systemPreferences, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

const IS_MAC = process.platform === 'darwin';
const SMOKE = !!process.env.JUNKOLA_SMOKE;          // headless self-test (see README)
const USER = process.env.JUNKOLA_USER || require('os').userInfo().username;
const DEVICE = require('os').hostname();

// ------------------------------------------------------------------ storage
const ROOT = path.join(app.getPath('userData'), 'sessions');
const STATE_FILE = path.join(app.getPath('userData'), 'state.json');
fs.mkdirSync(ROOT, { recursive: true });

let state = { current: null, nextSerial: 1 };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch {}
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

function sessionDir(serial) { return path.join(ROOT, serial); }
function readLedger(serial) {
  try { return JSON.parse(fs.readFileSync(path.join(sessionDir(serial), 'ledger.json'), 'utf8')); } catch { return null; }
}
function writeLedger(l) {
  fs.mkdirSync(sessionDir(l.serial), { recursive: true });
  fs.writeFileSync(path.join(sessionDir(l.serial), 'ledger.json'), JSON.stringify(l, null, 2));
}
function current() { return state.current ? readLedger(state.current) : null; }
function pad(n, w = 2) { return String(n).padStart(w, '0'); }
function offsetOf(startedAt, at = Date.now()) {
  const s = Math.max(0, Math.floor((at - startedAt) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function wall(at = Date.now()) { const d = new Date(at); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

function startSession(title) {
  const serial = `S-${pad(state.nextSerial++, 4)}`;
  const l = { serial, title: title || 'Untitled session', startedAt: Date.now(), endedAt: null, by: USER, device: DEVICE, items: [], synced: false };
  writeLedger(l); state.current = serial; saveState();
  broadcast(); return l;
}
function endSession() {
  const l = current(); if (!l) return null;
  l.endedAt = Date.now(); writeLedger(l); state.current = null; saveState();
  broadcast(); return l;
}
function addItem(partial) {
  let l = current();
  if (!l) l = startSession('Quick capture');              // capturing with no session starts one
  const at = Date.now();
  const item = { id: `A-${l.serial.slice(2)}-${pad(l.items.length + 1, 2)}`, at, wall: wall(at), offset: offsetOf(l.startedAt, at), by: USER, device: DEVICE, synced: false, ...partial };
  l.items.unshift(item); writeLedger(l); broadcast(); return item;
}
function snapshot() {
  const l = current();
  return { session: l, now: Date.now(), offset: l ? offsetOf(l.startedAt) : null, user: USER, device: DEVICE, onTop: mini ? mini.isAlwaysOnTop() : true, screenPerm: IS_MAC ? systemPreferences.getMediaAccessStatus('screen') : 'granted', root: ROOT };
}
function broadcast() { for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('state', snapshot()); }

// ------------------------------------------------------------------ windows
let mini = null, overlay = null, big = null, tray = null;

function createMini() {
  const { workArea } = screen.getPrimaryDisplay();
  const W = 352, H = 600;
  mini = new BrowserWindow({
    width: W, height: H, minWidth: 300, minHeight: 320,
    x: workArea.x + workArea.width - W - 24, y: workArea.y + 24,
    frame: false, transparent: false, resizable: true, hasShadow: true, show: false,
    alwaysOnTop: true, skipTaskbar: false, fullscreenable: false, minimizable: false,
    backgroundColor: '#10182A', title: 'Junkola Capture',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  // The whole point: float above every app, on every Space, including other apps' fullscreen.
  mini.setAlwaysOnTop(true, 'screen-saver');
  mini.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Keep the companion itself out of its own screen grabs.
  mini.setContentProtection(true);
  mini.loadFile(path.join(__dirname, 'renderer', 'mini.html'));
  mini.once('ready-to-show', () => mini.show());
  mini.on('closed', () => { mini = null; });
}

function toggleMini() {
  if (!mini) return createMini();
  if (mini.isVisible() && mini.isFocused()) mini.hide(); else { mini.show(); mini.focus(); }
}

function openBig() {
  // The full desktop companion (prep / live / record views). Today this is the
  // clickable prototype; it becomes the real thing once Hyperspace sync exists.
  if (big && !big.isDestroyed()) return big.focus();
  big = new BrowserWindow({ width: 1380, height: 900, backgroundColor: '#10182A', title: 'Junkola Capture — Companion', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true } });
  big.loadFile(path.join(__dirname, 'renderer', 'companion.html'), { hash: 'live' });
  big.on('closed', () => { big = null; });
}

// ------------------------------------------------------------------ capture
async function grabScreenImage(display) {
  const size = { width: Math.round(display.size.width * display.scaleFactor), height: Math.round(display.size.height * display.scaleFactor) };
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size });
  const src = sources.find(s => String(s.display_id) === String(display.id)) || sources[0];
  return src ? src.thumbnail : null;
}

async function grab(mode = 'region') {
  if (overlay) return overlay.focus();
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  if (mode === 'window') return grabWindowPicker();
  const img = await grabScreenImage(display);
  if (!img || img.isEmpty()) return notify('Screen capture is blocked', IS_MAC ? 'Grant Screen Recording to Junkola Capture in System Settings › Privacy & Security.' : 'Screen capture returned nothing.');
  if (mode === 'screen') return saveGrab(img, { title: `Screen — ${display.label || 'display ' + display.id}`, display });
  const l = current();
  overlay = new BrowserWindow({
    x: display.bounds.x, y: display.bounds.y, width: display.bounds.width, height: display.bounds.height,
    frame: false, transparent: true, alwaysOnTop: true, resizable: false, movable: false, hasShadow: false, enableLargerThanScreen: true, fullscreenable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  overlay.setAlwaysOnTop(true, 'screen-saver'); overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.loadFile(path.join(__dirname, 'renderer', 'grab.html'));
  overlay.webContents.once('did-finish-load', () => {
    overlay.webContents.send('grab:init', { image: img.toDataURL(), scale: display.scaleFactor, peg: l ? { serial: l.serial, title: l.title, offset: offsetOf(l.startedAt) } : null });
    overlay.focus();
  });
  overlay.on('closed', () => { overlay = null; });
  ipcMain.once('grab:done', (_e, rect) => {
    if (overlay) overlay.close();
    if (!rect) return;
    const s = display.scaleFactor;
    const cropped = img.crop({ x: Math.round(rect.x * s), y: Math.round(rect.y * s), width: Math.max(1, Math.round(rect.w * s)), height: Math.max(1, Math.round(rect.h * s)) });
    saveGrab(cropped, { title: `Region — ${Math.round(rect.w * s)} × ${Math.round(rect.h * s)}`, display });
  });
}

async function grabWindowPicker() {
  const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 480, height: 300 }, fetchWindowIcons: true });
  const list = sources.filter(s => s.name && !/Junkola Capture/i.test(s.name)).map(s => ({ id: s.id, name: s.name, thumb: s.thumbnail.toDataURL() }));
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  overlay = new BrowserWindow({ x: display.bounds.x, y: display.bounds.y, width: display.bounds.width, height: display.bounds.height, frame: false, transparent: true, alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true } });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.loadFile(path.join(__dirname, 'renderer', 'grab.html'), { hash: 'window' });
  overlay.webContents.once('did-finish-load', () => overlay.webContents.send('grab:windows', list));
  overlay.on('closed', () => { overlay = null; });
  ipcMain.once('grab:window', async (_e, id) => {
    if (overlay) overlay.close();
    if (!id) return;
    const full = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 4096, height: 4096 } });
    const src = full.find(s => s.id === id); if (!src) return;
    saveGrab(src.thumbnail, { title: `Window — ${src.name}` });
  });
}

function saveGrab(img, meta) {
  const l = current() || startSession('Quick capture');
  const n = pad(l.items.length + 1, 2);
  const file = path.join(sessionDir(l.serial), `${l.serial}-${n}-grab.png`);
  fs.writeFileSync(file, img.toPNG());
  const size = img.getSize();
  const item = addItem({ kind: 'grab', title: meta.title, path: file, w: size.width, h: size.height, bytes: fs.statSync(file).size });
  clipboard.writeImage(img);                         // also on the clipboard, like any screenshot tool
  notify(`Pinned at ${item.offset}`, `${meta.title} → ${l.serial} · ${l.title}`);
}

function addFiles(paths) {
  const l = current() || startSession('Quick capture');
  for (const p of paths) {
    try {
      const dest = path.join(sessionDir(l.serial), `${l.serial}-${pad(l.items.length + 1, 2)}-${path.basename(p)}`);
      fs.copyFileSync(p, dest);
      addItem({ kind: 'file', title: path.basename(p), path: dest, bytes: fs.statSync(dest).size, ext: path.extname(p).slice(1).toLowerCase() });
    } catch (e) { notify('Could not attach', `${path.basename(p)}: ${e.message}`); }
  }
}

function notify(title, body) {
  try { const { Notification } = require('electron'); if (Notification.isSupported()) new Notification({ title, body, silent: true }).show(); } catch {}
  if (mini && !mini.isDestroyed()) mini.webContents.send('toast', { title, body });
}

// ------------------------------------------------------------------ tray + shortcuts
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', IS_MAC ? 'trayTemplate.png' : 'tray.png'));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('Junkola Capture');
  const rebuild = () => {
    const l = current();
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: l ? `● ${l.serial} · ${l.title}` : 'No session', enabled: false },
      { label: l ? 'End session' : 'Start session…', click: () => l ? endSession() : (toggleMini(), mini && mini.webContents.send('focus:start')) },
      { type: 'separator' },
      { label: 'Show / hide companion', accelerator: (IS_MAC ? 'Alt+Shift+' : 'Ctrl+Shift+') + 'C', click: toggleMini },
      { label: 'Grab region', accelerator: (IS_MAC ? 'Alt+Shift+' : 'Ctrl+Shift+') + '4', click: () => grab('region') },
      { label: 'Grab window', accelerator: (IS_MAC ? 'Alt+Shift+' : 'Ctrl+Shift+') + '5', click: () => grab('window') },
      { label: 'Grab full screen', accelerator: (IS_MAC ? 'Alt+Shift+' : 'Ctrl+Shift+') + '3', click: () => grab('screen') },
      { type: 'separator' },
      { label: 'Open full companion', click: openBig },
      { label: 'Open sessions folder', click: () => shell.openPath(ROOT) },
      { type: 'separator' },
      { label: 'Quit Junkola Capture', role: 'quit' }
    ]));
  };
  rebuild(); ipcMain.on('state-changed', rebuild); tray.on('click', toggleMini);
  const _b = broadcast; module.exports._rebuildTray = rebuild;
}

function registerShortcuts() {
  const ok = [];
  const M = IS_MAC ? 'Alt+Shift' : 'Ctrl+Shift';
  ok.push(globalShortcut.register(`${M}+C`, toggleMini));
  ok.push(globalShortcut.register(`${M}+4`, () => grab('region')));
  ok.push(globalShortcut.register(`${M}+5`, () => grab('window')));
  ok.push(globalShortcut.register(`${M}+3`, () => grab('screen')));
  if (ok.includes(false)) console.warn('[junkola] some global shortcuts could not be registered (another app owns them)');
}

// ------------------------------------------------------------------ ipc
ipcMain.handle('state', () => snapshot());
ipcMain.handle('session:start', (_e, title) => startSession(title));
ipcMain.handle('session:end', () => endSession());
ipcMain.handle('note', (_e, text) => addItem({ kind: 'note', title: text.trim().slice(0, 140), text: text.trim() }));
ipcMain.handle('link', (_e, url) => addItem({ kind: 'link', title: url.replace(/^https?:\/\//, '').slice(0, 120), url }));
ipcMain.handle('files', (_e, paths) => addFiles(paths));
ipcMain.handle('attach', async () => {
  const r = await dialog.showOpenDialog(mini, { properties: ['openFile', 'multiSelections'] });
  if (!r.canceled) addFiles(r.filePaths);
});
ipcMain.handle('grab', (_e, mode) => grab(mode));
ipcMain.handle('ontop', () => { if (!mini) return; const v = !mini.isAlwaysOnTop(); mini.setAlwaysOnTop(v, 'screen-saver'); broadcast(); return v; });
ipcMain.handle('expand', () => openBig());
ipcMain.handle('open-folder', () => { const l = current(); shell.openPath(l ? sessionDir(l.serial) : ROOT); });
ipcMain.handle('open-item', (_e, p) => shell.openPath(p));
ipcMain.handle('hide', () => mini && mini.hide());
ipcMain.handle('ledger', (_e, serial) => readLedger(serial));
ipcMain.handle('sync', () => {
  // TODO(hyperspace): POST ledger + files to the Hyperspace ingestion endpoint.
  // For now we only mark items as queued so the UI can show the state.
  const l = current(); if (!l) return null;
  l.items.forEach(i => { i.synced = 'queued'; }); writeLedger(l); broadcast(); return l;
});

// ------------------------------------------------------------------ lifecycle
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => toggleMini());
app.whenReady().then(async () => {
  if (IS_MAC) app.dock.hide();                 // tray app; the floating panel is the UI
  createMini(); createTray(); registerShortcuts();
  setInterval(() => { if (state.current) broadcast(); }, 1000);   // drives the session clock
  if (SMOKE) {
    // Headless self-test: start a session, add a note, screenshot the panel, quit.
    startSession('Smoke test — Rivera supplier review'); addItem({ kind: 'note', title: 'Ask legal re: indemnity cap', text: 'Ask legal re: indemnity cap' });
    setTimeout(async () => {
      await grab('screen');                               // exercises desktopCapturer + saveGrab
      const png = await mini.webContents.capturePage();
      fs.writeFileSync(process.env.JUNKOLA_SMOKE, png.toPNG());
      console.log('[smoke] wrote', process.env.JUNKOLA_SMOKE, 'session dir', sessionDir(state.current));
      endSession(); app.quit();
    }, 1500);
  }
});
app.on('window-all-closed', () => { /* tray app: keep running */ });
app.on('will-quit', () => globalShortcut.unregisterAll());
