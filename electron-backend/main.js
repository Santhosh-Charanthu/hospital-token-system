const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const printToken = require("./printToken");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL("http://localhost:3000");
}

// 🔥 IPC handler (THIS is how renderer talks to backend)
ipcMain.handle("print-token", async (_, tokenNumber) => {
  try {
    return await printToken(tokenNumber);
  } catch (err) {
    console.error("Print failed:", err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(createWindow);
