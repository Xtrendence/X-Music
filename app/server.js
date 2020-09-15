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
const mime = require("mime-types");
const glob = require("glob");
const metadata = require("music-metadata");
const body_parser = require("body-parser");

const dataDirectory = path.join(__dirname, "./data/");
const settingsFile = dataDirectory + "settings.json";
const playlistsFile = dataDirectory + "playlists.json";

let defaultSettings = JSON.stringify({
	libraryDirectory:"",
	loop:"none",
	volume:100,
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
			x:100,
			y:100,
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

		ipcMain.on("getInfo", (error, req) => {
			let info = { ip:ip.address(), localPort:localPort, appPort:appPort, settings:settings, playlists:playlists, forceUpdate:false };
			localWindow.webContents.send("getInfo", info);
		});

		ipcMain.on("getSongs", (error, req) => {
			if(validJSON(settings)) {
				let libraryDirectory = JSON.parse(settings).libraryDirectory;
				if(libraryDirectory !== "") {
					let watch = fs.watch(libraryDirectory, { recursive:true, persistent:true }, () => {
						let info = { ip:ip.address(), localPort:localPort, appPort:appPort, settings:settings, playlists:playlists, forceUpdate:true };
						localWindow.webContents.send("getInfo", info);
						localWindow.webContents.send("notify", { title:"Refreshing", description:"Your music library is being updated.", color:"rgb(40,40,40)", duration:5000})
					});
					glob(libraryDirectory + "/**/*.{mp3, wav, ogg}", (error, files) => {
						if(error) {
							console.log(error);
							localWindow.webContents.send("notify", { title:"Error", description:"Couldn't fetch songs.", color:"rgb(40,40,40)", duration:5000})
						}
						else {
							let songs = [];
							let count = 0;
							files.map(file => {
								metadata.parseFile(file).then(data => {
									let title = data.common.title;
									let artist = data.common.artist;
									let album = data.common.album;
									let duration = data.format.duration;
									if(typeof data.common.title === "undefined" || data.common.title.trim() === "") {
										title = path.basename(file).split(".").slice(0, -1).join(".");
									}
									if(typeof data.common.album === "undefined" || data.common.album.trim() === "") {
										album = "Unknown Album";
									}
									if(typeof data.common.artist === "undefined" || data.common.artist.trim() === "") {
										artist = "Unknown Artist";
									}
									songs.push({ file:file, title:title, artist:artist, album:album, duration:duration });
									count++;
									if(count === files.length) {
										localWindow.webContents.send("getSongs", songs);
									}
								}).catch(error => {
									console.log(error);
									localWindow.webContents.send("notify", { title:"Error", description:"Couldn't parse the metadata.", color:"rgb(40,40,40)", duration:5000})
								});
							});
						}
					});
				}
				else {
					localWindow.webContents.send("getSongs", "");
				}
			}
		});

		ipcMain.on("playSong", (error, req) => {
			let type = mime.lookup(req).toLowerCase();
			if(type === "audio/mpeg" || type === "audio/x-wav" || type === "audio/ogg" || type === "application/ogg") {
				fs.readFile(req, function(error, file) {
					let base64 = Buffer.from(file).toString("base64");
					localWindow.webContents.send("playSong", { base64:base64, mime:type });
					if(error) {
						localWindow.webContents.send("notify", { title:"Error", description:"Couldn't read the audio file.", color:"rgb(40,40,40)", duration:5000})
					}
				});
			}
			else {
				localWindow.webContents.send("notify", { title:"Error", description:"Invalid file type.", color:"rgb(40,40,40)", duration:5000})
			}
		});

		ipcMain.on("browseFiles",(error, req) => {
			let directory = dialog.showOpenDialogSync(localWindow, { title:"Select Music Library Directory", message:"Select the directory that contains your MP3, WAV, or OGG files.", properties:["openDirectory"] });
			if(typeof directory !== "undefined") {
				changeSettings("libraryDirectory", directory[0]);
			}
			else {
				localWindow.webContents.send("notify", { title:"Error", description:"Invalid library directory.", color:"rgb(40,40,40)", duration:5000})
			}
		});

		ipcMain.on("loopSetting", (error, req) => {
			if(["none", "list", "song"].includes(req)) {
				changeSettings("loop", req);
			}
		});

		ipcMain.on("allowRemote", (error, req) => {
			if(typeof req === "boolean") {
				changeSettings("allowRemote", req);
			}
			else {
				localWindow.webContents.send("notify", { title:"Error", description:"Boolean data type only.", color:"rgb(40,40,40)", duration:5000})
			}
		});

		ipcMain.on("setVolume", (error, req) => {
			try {
				let volume = parseInt(req);
				if(volume >= 0 && volume <= 100) {
					changeSettings("volume", volume);
				}
			}
			catch(e) {
				console.log(e);
				localWindow.webContents.send("notify", { title:"Error", description:"Volume value wasn't an integer.", color:"rgb(40,40,40)", duration:5000})
			}
		});

		ipcMain.on("addPlaylist", (error, req) => {

		});

		ipcMain.on("removePlaylist", (error, req) => {

		});

		ipcMain.on("playlistAddSong", (error, req) => {

		});

		ipcMain.on("playlistRemoveSong", (error, req) => {

		});

		ipcMain.on("resetSettings", (error, req) => {
			fs.writeFile(settingsFile, defaultSettings, function(error) {
				if(error) {
					console.log(error);
					localWindow.webContents.send("notify", { title:"Error", description:"Couldn't write to settings file.", color:"rgb(40,40,40)", duration:5000})
				}
				else {
					settings = defaultSettings;
					let info = { ip:ip.address(), localPort:localPort, appPort:appPort, settings:settings, playlists:playlists, forceUpdate:false };
					localWindow.webContents.send("getInfo", info);
					localWindow.webContents.send("notify", { title:"Reset", description:"Your settings have been reset.", color:"rgb(40,40,40)", duration:5000})
				}
			});
		});

		ipcMain.on("openFileLocation", (error, req) => {
			if(validJSON(settings)) {
				let libraryDirectory = JSON.parse(settings).libraryDirectory;
				if(req.replaceAll("/", "\\").includes(libraryDirectory)) {
					shell.showItemInFolder(path.resolve(req));
				}
				else {
					localWindow.webContents.send("notify", { title:"Error", description:"Access not authorized.", color:"rgb(40,40,40)", duration:5000})
				}
			}
			else {
				localWindow.webContents.send("notify", { title:"Error", description:"Invalid settings. Try resetting them.", color:"rgb(40,40,40)", duration:5000})
			}
		});

		ipcMain.on("minimizeApp", (error, req) => {
			localWindow.minimize();
		});

		ipcMain.on("maximizeApp", (error, req) => {
			if(process.platform === "darwin") {
				localWindow.isFullScreen() ? localWindow.setFullScreen(false) : localWindow.setFullScreen(true);
			}
			else {
				localWindow.isMaximized() ? localWindow.restore() : localWindow.maximize();
			}
		});

		ipcMain.on("quitApp", (error, req) => {
			(process.platform === "darwin") ? app.hide() : app.quit();
		});

		appExpress.set("view engine", "ejs");
		appExpress.use("/assets", express.static("assets"));
		appExpress.use(body_parser.urlencoded({ extended:true }));
		appExpress.use(body_parser.json({ limit:"1mb" }));

		appExpress.get("/", (req, res) => {
			if(remoteCheck()) {
				res.render("remote");
			}
		});

		appExpress.post("/playSong", (req, res) => {

		});

		appExpress.get("/resumeSong", (req, res) => {
			localWindow.webContents.send("resumeSong");
		});

		appExpress.get("/pauseSong", (req, res) => {
			localWindow.webContents.send("pauseSong");
		});

		function remoteCheck() {
			if(validJSON(settings)) {
				return JSON.parse(settings).allowRemote;
			}
			else {
				return true;
			}
		}

		function changeSettings(key, value) {
			let currentSettings = fs.readFileSync(settingsFile, { encoding:"utf-8" }).toString();
			if(validJSON(currentSettings)) {
				let current = JSON.parse(currentSettings);
				current[key] = value;
				fs.writeFile(settingsFile, JSON.stringify(current), function(error) {
					if(error) {
						console.log(error);
						localWindow.webContents.send("notify", { title:"Error", description:"Couldn't write to settings file.", color:"rgb(40,40,40)", duration:5000})
					}
					else {
						settings = JSON.stringify(current);
						let info = { ip:ip.address(), localPort:localPort, appPort:appPort, settings:settings, playlists:playlists, forceUpdate:false };
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

String.prototype.replaceAll = function(str1, str2, ignore) {
	return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
}

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