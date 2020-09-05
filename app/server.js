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
const glob = require("glob");
const metadata = require("music-metadata");
const body_parser = require("body-parser");

const dataDirectory = path.join(__dirname, "./data/");
const settingsFile = dataDirectory + "settings.json";
const playlistsFile = dataDirectory + "playlists.json";

let defaultSettings = JSON.stringify({
	libraryDirectory:"",
	showArt:false,
	allowRemote:true
});

if(!fs.existsSync(dataDirectory)) {
	fs.mkdirSync(dataDirectory);
}
if(!fs.existsSync(settingsFile)) {
	fs.writeFileSync(settingsFile, defaultSettings);
}
if(!fs.existsSync(playlistsFile)) {
	fs.writeFileSync(playlistsFile, "");
}

const { app, BrowserWindow, screen, ipcMain, dialog, shell } = electron;

app.requestSingleInstanceLock();
app.name = "X:/Music";

app.on("ready", function() {
	if(fs.existsSync(settingsFile) && fs.existsSync(playlistsFile)) {
		let theme = "light";
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
			transparent:false,
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
			if(electron.nativeTheme.shouldUseDarkColors) {
				theme = "dark";
			}
			let info = { ip:ip.address(), localPort:localPort, appPort:appPort, theme:theme, settings:settings, playlists:playlists };
			localWindow.webContents.send("getInfo", info);
		});

		ipcMain.on("getSongs", function(error, req) {
			if(validJSON(settings)) {
				let libraryDirectory = JSON.parse(settings).libraryDirectory;
				glob(libraryDirectory + "/**/*.{mp3, wav, ogg}", (error, files) => {
					if(error) {
						console.log(error);
					}
					else {
						let songs = {};
						let count = 0;
						files.map(file => {
							metadata.parseFile(file).then(data => {
								let title = data.common.title;
								let artist = "";
								let album = "";
								let duration = data.format.duration;
								if(typeof data.common.title === "undefined") {
									title = path.basename(file).split(".").slice(0, -1).join(".");
								}
								if(typeof data.common.artist === "undefined") {
									artist = "Unknown Artist";
								}
								if(typeof data.common.artist === "undefined") {
									album = "Unknown Album";
								}
								songs[file] = { title:title, artist:artist, album:album, duration:duration };
								count++;
								if(count === files.length) {
									localWindow.webContents.send("getSongs", songs);
								}
							}).catch(error => {
								console.log(error);
							});
						});
					}
				});
			}
		});

		ipcMain.on("browseFiles",function(error, req) {
			let directory = dialog.showOpenDialogSync(localWindow, { title:"Select Music Library Directory", message:"Select the directory that contains your MP3, WAV, or OGG files.", properties:["openDirectory"] });
			changeSettings("libraryDirectory", directory[0]);
		});

		ipcMain.on("resetSettings", function(error, req) {
			fs.writeFile(settingsFile, defaultSettings, function(error) {
				if(error) {
					console.log(error);
				}
				else {
					settings = defaultSettings;
					let info = { ip:ip.address(), localPort:localPort, appPort:appPort, theme:theme, settings:settings, playlists:playlists };
					localWindow.webContents.send("getInfo", info);
				}
			});
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

		function changeSettings(key, value) {
			let currentSettings = fs.readFileSync(settingsFile, { encoding:"utf-8" });
			if(validJSON(currentSettings)) {
				let current = JSON.parse(currentSettings);
				current[key] = value;
				fs.writeFile(settingsFile, JSON.stringify(current), function(error) {
					if(error) {
						console.log(error);
					}
					else {
						settings = JSON.stringify(current);
						let info = { ip:ip.address(), localPort:localPort, appPort:appPort, theme:theme, settings:settings, playlists:playlists };
						localWindow.webContents.send("getInfo", info);
					}
				});
			}
		}
	}
	else {
		dialog.showMessageBoxSync({ title:"Error", message:"Could not create the required user files." });
		app.quit();
	}
});

function validJSON(json) {
	try {
		let object = JSON.parse(json);
		if(object && typeof object === "object") {
			return object;
		}
	}
	catch(e) { }
	return false;
}