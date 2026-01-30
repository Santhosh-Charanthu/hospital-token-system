const { contextBridge, ipcRenderer } = require("electron");

console.log("✅ PRELOAD FILE LOADED");

contextBridge.exposeInMainWorld("printer", {
  printToken: (tokenNumber) => ipcRenderer.invoke("print-token", tokenNumber),
});
