// Bridge between the renderer pages and the main process. Nothing in the
// renderer touches Node directly.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('capture', {
  state: () => ipcRenderer.invoke('state'),
  onState: (cb) => { ipcRenderer.on('state', (_e, s) => cb(s)); },
  onToast: (cb) => { ipcRenderer.on('toast', (_e, t) => cb(t)); },
  onFocusStart: (cb) => { ipcRenderer.on('focus:start', () => cb()); },
  startSession: (title) => ipcRenderer.invoke('session:start', title),
  endSession: () => ipcRenderer.invoke('session:end'),
  note: (text) => ipcRenderer.invoke('note', text),
  link: (url) => ipcRenderer.invoke('link', url),
  files: (paths) => ipcRenderer.invoke('files', paths),
  attach: () => ipcRenderer.invoke('attach'),
  grab: (mode) => ipcRenderer.invoke('grab', mode),
  toggleOnTop: () => ipcRenderer.invoke('ontop'),
  expand: () => ipcRenderer.invoke('expand'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  openItem: (p) => ipcRenderer.invoke('open-item', p),
  hide: () => ipcRenderer.invoke('hide'),
  ledger: (serial) => ipcRenderer.invoke('ledger', serial),
  sync: () => ipcRenderer.invoke('sync'),
  pathFor: (file) => webUtils.getPathForFile(file),
  // grab overlay
  onGrabInit: (cb) => { ipcRenderer.on('grab:init', (_e, d) => cb(d)); },
  onGrabWindows: (cb) => { ipcRenderer.on('grab:windows', (_e, d) => cb(d)); },
  grabDone: (rect) => ipcRenderer.send('grab:done', rect),
  grabWindow: (id) => ipcRenderer.send('grab:window', id)
});
