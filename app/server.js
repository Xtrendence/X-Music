const localPort = 1999;
const appPort = 1998;
const scriptPath = process.cwd() + "\\server.js";

const electron = require("electron");

const express = require("express");
const localExpress = express();
const appExpress = express();
const localServer = localExpress.listen(localPort, "localhost");
const appServer = appExpress.listen(appPort);

const ip = require("ip");
const os = require("os");
const fs = require("fs");
const path = require("path");
const body_parser = require("body-parser");

const dataDirectory = path.join(__dirname, "./data/");
const settingsFile = dataDirectory + "settings.json";
const playlistsFile = dataDirectory + "playlists.json";

if(!fs.existsSync(dataDirectory)) {
	fs.mkdirSync(dataDirectory);
}
if(!fs.existsSync(settingsFile)) {
	let defaultSettings = JSON.stringify({
		libraryDirectory:"",
		showArt:false,
		allowRemote:true
	});
	fs.writeFileSync(settingsFile, defaultSettings);
}
if(!fs.existsSync(playlistsFile)) {
	fs.writeFileSync(playlistsFile, "");
}

const { app, BrowserWindow, screen, ipcMain, dialog } = electron;

app.requestSingleInstanceLock();
app.name = "X:/Music";

app.on("ready", function() {
	if(fs.existsSync(settingsFile) && fs.existsSync(playlistsFile)) {
		let settings = fs.readFileSync(settingsFile, { encoding:"utf-8" });
		let playlists = fs.readFileSync(playlistsFile, { encoding:"utf-8" });

		const { width, height } = screen.getPrimaryDisplay().workAreaSize;

		let windowWidth = 1280;
		let windowHeight = 720;

		if(width <= 1080 || height <= 620) {
			windowWidth = width - 100;
			windowHeight = height - 100;
		}

		const localWindow = new BrowserWindow({
			width:windowWidth,
			minWidth:1000,
			height:windowHeight,
			minHeight:550,
			resizable:true,
			frame:false,
			transparent:true,
			webPreferences: {
				nodeIntegration:true
			}
		});

		localWindow.loadURL("http://127.0.0.1:" + localPort);

		localExpress.set("view engine", "ejs");
		localExpress.use("/assets", express.static("assets"));
		localExpress.use(body_parser.urlencoded({ extended:true }));
		localExpress.use(body_parser.json({ limit:"512mb" }));

		localExpress.get("/", (req, res) => {
			res.render("index");
		});

		ipcMain.on("getInfo", function(error, req) {
			let theme = "light";
			if(electron.nativeTheme.shouldUseDarkColors) {
				theme = "dark";
			}
			let info = { ip:ip.address(), localPort:localPort, appPort:appPort, theme:theme, settings:settings, playlists:playlists };
			localWindow.webContents.send("getInfo", info);
		});

		ipcMain.on("minimizeApp", function(error, req) {
			localWindow.minimize();
		});

		ipcMain.on("maximizeApp", function(error, req) {
			if(process.platform === "darwin") {
				localWindow.isFullScreen() ? localWindow.setFullScreen(false) : localWindow.setFullScreen(true);
			}
			else {
				localWindow.isMaximized() ? localWindow.restore() : localWindow.maximize();
			}

		});

		ipcMain.on("quitApp", function(error, req) {
			(process.platform === "darwin") ? app.hide() : app.quit();
		});
	}
	else {
		dialog.showMessageBoxSync({ title:"Error", message:"Could not create the required user files." });
		app.quit();
	}
});