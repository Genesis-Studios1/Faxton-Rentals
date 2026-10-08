// Exposes one tiny, safe function to the Faxton site: turn automatic updates on or off.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("faxtonShell", {
  setAutoUpdate: (on) => ipcRenderer.send("faxton:auto-update", !!on),
});
