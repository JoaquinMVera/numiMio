const { app, BrowserWindow, Menu, dialog, ipcMain } = require("electron");
const fs = require("fs/promises");
const path = require("path");

const FILE_FILTERS = [
	{ name: "Numi Lite", extensions: ["numi", "txt"] },
	{ name: "All Files", extensions: ["*"] },
];

let mainWindow = null;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 900,
		height: 620,
		minWidth: 480,
		minHeight: 320,
		title: "Numi Lite",
		backgroundColor: "#1e1e24",
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
		},
	});
	mainWindow.loadFile("index.html");
}

function sendMenu(action) {
	if (mainWindow) mainWindow.webContents.send("menu", action);
}

function buildMenu() {
	const isMac = process.platform === "darwin";
	const template = [
		...(isMac ? [{ role: "appMenu" }] : []),
		{
			label: "File",
			submenu: [
				{ label: "New", accelerator: "CmdOrCtrl+N", click: () => sendMenu("new") },
				{ label: "Open…", accelerator: "CmdOrCtrl+O", click: () => sendMenu("open") },
				{ type: "separator" },
				{ label: "Save", accelerator: "CmdOrCtrl+S", click: () => sendMenu("save") },
				{ label: "Save As…", accelerator: "CmdOrCtrl+Shift+S", click: () => sendMenu("save-as") },
				{ type: "separator" },
				isMac ? { role: "close" } : { role: "quit" },
			],
		},
		{ role: "editMenu" },
		{
			label: "Text Size",
			submenu: [
				{ label: "Increase", accelerator: "CmdOrCtrl+Plus", click: () => sendMenu("zoom-in") },
				{ label: "Increase", accelerator: "CmdOrCtrl+=", visible: false, click: () => sendMenu("zoom-in") },
				{ label: "Decrease", accelerator: "CmdOrCtrl+-", click: () => sendMenu("zoom-out") },
				{ label: "Reset", accelerator: "CmdOrCtrl+0", click: () => sendMenu("zoom-reset") },
			],
		},
		{ role: "viewMenu" },
	];
	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("dialog-open", async () => {
	const result = await dialog.showOpenDialog(mainWindow, {
		properties: ["openFile"],
		filters: FILE_FILTERS,
	});
	if (result.canceled || result.filePaths.length === 0) return null;
	const filePath = result.filePaths[0];
	const content = await fs.readFile(filePath, "utf8");
	return { path: filePath, content };
});

ipcMain.handle("dialog-save", async (event, { path: filePath, content, forceDialog }) => {
	let target = filePath;
	if (!target || forceDialog) {
		const result = await dialog.showSaveDialog(mainWindow, {
			defaultPath: target || "untitled.numi",
			filters: FILE_FILTERS,
		});
		if (result.canceled || !result.filePath) return null;
		target = result.filePath;
	}
	await fs.writeFile(target, content, "utf8");
	return { path: target };
});

app.whenReady().then(() => {
	buildMenu();
	createWindow();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});
