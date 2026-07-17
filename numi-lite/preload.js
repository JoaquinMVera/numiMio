const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
	onMenu: (callback) => ipcRenderer.on("menu", (event, action) => callback(action)),
	openFile: () => ipcRenderer.invoke("dialog-open"),
	saveFile: (payload) => ipcRenderer.invoke("dialog-save", payload),
});
