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
			sendInfo(false);
		});

		ipcMain.on("getSongs", (error, req) => {
			if(validJSON(settings)) {
				let libraryDirectory = JSON.parse(settings).libraryDirectory;
				if(libraryDirectory !== "") {
					let watch = fs.watch(libraryDirectory, { recursive:true, persistent:true }, () => {
						sendInfo(true);
						localWindow.webContents.send("notify", { title:"Refreshing", description:"Your music library is being updated.", color:"rgb(40,40,40)", duration:5000})
					});
					glob(libraryDirectory + "/**/*.{mp3, wav, ogg}", (error, files) => {
						if(error) {
							console.log(error);
							localWindow.webContents.send("notify", { title:"Error", description:"Couldn't fetch songs.", color:"rgb(40,40,40)", duration:5000 });
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
									localWindow.webContents.send("notify", { title:"Error", description:"Couldn't parse the metadata.", color:"rgb(40,40,40)", duration:5000 });
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
						localWindow.webContents.send("notify", { title:"Error", description:"Couldn't read the audio file.", color:"rgb(40,40,40)", duration:5000 });
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
				localWindow.webContents.send("notify", { title:"Error", description:"Invalid library directory.", color:"rgb(40,40,40)", duration:5000 });
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
				localWindow.webContents.send("notify", { title:"Error", description:"Boolean data type only.", color:"rgb(40,40,40)", duration:5000 });
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
				localWindow.webContents.send("notify", { title:"Error", description:"Volume value wasn't an integer.", color:"rgb(40,40,40)", duration:5000 });
			}
		});

		ipcMain.on("addPlaylist", (error, req) => {
			if(typeof req !== "undefined" && req.toString().trim() !== "") {
				let name = req.toString().trim();
				if(validJSON(playlists) || playlists.toString().trim() === "") {
					let currentPlaylists = {};

					if(playlists.toString().trim() !== "") {
						currentPlaylists = JSON.parse(playlists.toString());
					}

					if(name in currentPlaylists) {
						localWindow.webContents.send("notify", { title:"Error", description:"A playlist with that name already exists.", color:"rgb(40,40,40)", duration:5000 });
					}
					else {
						currentPlaylists[name] = { songs:[] };
						fs.writeFile(playlistsFile, JSON.stringify(currentPlaylists), (error) => {
							if(error) {
								console.log(error);
								localWindow.webContents.send("notify", { title:"Error", description:"Could not write to playlists file.", color:"rgb(40,40,40)", duration:5000 });
							}
							else {
								playlists = JSON.stringify(currentPlaylists);
								sendInfo(false);
								localWindow.webContents.send("notify", { title:"Playlist Created", description:"The playlist has been created.", color:"rgb(40,40,40)", duration:5000 });
							}
						});
					}
				}
			}
			else {
				localWindow.webContents.send("notify", { title:"Error", description:"Invalid playlist name.", color:"rgb(40,40,40)", duration:5000 });
			}
		});

		ipcMain.on("removePlaylist", (error, req) => {
			if(typeof req !== "undefined" && req.toString().trim() !== "") {
				let name = req.toString().trim();
				if(validJSON(playlists) || playlists.toString().trim() === "") {
					let currentPlaylists = {};

					if(playlists.toString().trim() !== "") {
						currentPlaylists = JSON.parse(playlists.toString());
					}

					if(name in currentPlaylists) {
						delete currentPlaylists[name];
						fs.writeFile(playlistsFile, JSON.stringify(currentPlaylists), (error) => {
							if(error) {
								console.log(error);
								localWindow.webContents.send("notify", { title:"Error", description:"Could not write to playlists file.", color:"rgb(40,40,40)", duration:5000 });
							}
							else {
								playlists = JSON.stringify(currentPlaylists);
								sendInfo(false);
								localWindow.webContents.send("notify", { title:"Playlist Deleted", description:"The playlist has been deleted.", color:"rgb(40,40,40)", duration:5000 });
							}
						});
					}
					else {
						localWindow.webContents.send("notify", { title:"Error", description:"That playlist doesn't exist.", color:"rgb(40,40,40)", duration:5000 });
					}
				}
			}
			else {
				localWindow.webContents.send("notify", { title:"Error", description:"Invalid playlist name.", color:"rgb(40,40,40)", duration:5000 });
			}
		});

		ipcMain.on("renamePlaylist", (error, req) => {
			if(typeof req.current !== "undefined" && req.current.toString().trim() && typeof req.new !== "undefined" && req.new.toString().trim()) {
				let currentName = req.current.toString().trim();
				let newName = req.new.toString().trim();
				if(validJSON(playlists)) {
					let currentPlaylists = JSON.parse(playlists);
					if(currentName in currentPlaylists) {
						if(!(newName in currentPlaylists)) {
							let playlist = currentPlaylists[currentName];
							delete currentPlaylists[currentName];
							currentPlaylists[newName] = playlist;
							fs.writeFile(playlistsFile, JSON.stringify(currentPlaylists), (error) => {
								if(error) {
									localWindow.webContents.send("notify", { title:"Error", description:"Couldn't write to playlist file...", color:"rgb(40,40,40)", duration:5000 });
								}
								else {
									playlists = JSON.stringify(currentPlaylists);
									sendInfo(true);
									localWindow.webContents.send("notify", { title:"Playlist Renamed", description:"The playlist has been renamed.", color:"rgb(40,40,40)", duration:5000 });
								}
							});
						}
						else {
							localWindow.webContents.send("notify", { title:"Error", description:"A playlist with that name already exists.", color:"rgb(40,40,40)", duration:5000 });
						}
					}
					else{
						localWindow.webContents.send("notify", { title:"Error", description:"A playlist with that name doesn't exist.", color:"rgb(40,40,40)", duration:5000 });
					}
				}
				else {
					localWindow.webContents.send("notify", { title:"Error", description:"Invalid playlist JSON data.", color:"rgb(40,40,40)", duration:5000 });
				}
			}
			else {
				localWindow.webContents.send("notify", { title:"Error", description:"Invalid playlist name.", color:"rgb(40,40,40)", duration:5000 });
			}
		});

		ipcMain.on("playlistAddSong", (error, req) => {
			if(validJSON(settings)) {
				let libraryDirectory = JSON.parse(settings).libraryDirectory;
				if(typeof req.playlist !== "undefined" && req.playlist.toString().trim() !== "" && typeof req.file !== "undefined" && req.file.toString().trim() !== "") {
					let name = req.playlist.toString().trim();
					let file = req.file.toString().trim().replace(libraryDirectory.replaceAll("\\", "/"), "");
					if(validJSON(playlists)) {
						let currentPlaylists = JSON.parse(playlists);
						let playlist = currentPlaylists[name];
						let playlistSongs = playlist.songs;
						if(!playlistSongs.includes(file)) {
							currentPlaylists[name].songs.push(file);
							fs.writeFile(playlistsFile, JSON.stringify(currentPlaylists), (error) => {
								if(error) {
									localWindow.webContents.send("notify", { title:"Error", description:"Couldn't write to playlist file...", color:"rgb(40,40,40)", duration:5000 });
								}
								else {
									playlists = JSON.stringify(currentPlaylists);
									sendInfo(true);
									localWindow.webContents.send("notify", { title:"Song Added", description:"The song has been added to the playlist.", color:"rgb(40,40,40)", duration:5000 });
								}
							});
						}
						else {
							localWindow.webContents.send("notify", { title:"Error", description:"That playlist already has that song.", color:"rgb(40,40,40)", duration:5000 });
						}
					}
					else {
						localWindow.webContents.send("notify", { title:"Error", description:"Invalid playlist JSON data.", color:"rgb(40,40,40)", duration:5000 });
					}
				}
				else {
					localWindow.webContents.send("notify", { title:"Error", description:"Invalid playlist name or audio file.", color:"rgb(40,40,40)", duration:5000 });
				}
			}
			else {
				localWindow.webContents.send("notify", { title:"Error", description:"Invalid settings. Try resetting them.", color:"rgb(40,40,40)", duration:5000 });
			}
		});

		ipcMain.on("playlistRemoveSong", (error, req) => {
			if(typeof req.playlist !== "undefined" && req.playlist.toString().trim() !== "" && typeof req.file !== "undefined" && req.file.toString().trim() !== "") {
				let name = req.playlist.toString().trim();
				let file = req.file.toString().trim();
				if(validJSON(playlists)) {
					let currentPlaylists = JSON.parse(playlists);
					let index = currentPlaylists[name].songs.indexOf(file);
					if(index > -1) {
						currentPlaylists[name].songs.splice(index, 1);
						fs.writeFile(playlistsFile, JSON.stringify(currentPlaylists), (error) => {
							if(error) {
								localWindow.webContents.send("notify", { title:"Error", description:"Couldn't write to playlist file...", color:"rgb(40,40,40)", duration:5000 });
							}
							else {
								playlists = JSON.stringify(currentPlaylists);
								sendInfo(true);
								localWindow.webContents.send("notify", { title:"Song Removed", description:"The song has been removed from the playlist.", color:"rgb(40,40,40)", duration:5000 });
							}
						});
					}
					else {
						localWindow.webContents.send("notify", { title:"Error", description:"Could not find that song in that playlist.", color:"rgb(40,40,40)", duration:5000 });
					}
				}
			}
			else {
				localWindow.webContents.send("notify", { title:"Error", description:"Invalid playlist name or audio file.", color:"rgb(40,40,40)", duration:5000 });
			}
		});

		ipcMain.on("resetSettings", (error, req) => {
			fs.writeFile(settingsFile, defaultSettings, (error) => {
				if(error) {
					console.log(error);
					localWindow.webContents.send("notify", { title:"Error", description:"Couldn't write to settings file.", color:"rgb(40,40,40)", duration:5000 });
				}
				else {
					settings = defaultSettings;
					sendInfo(false);
					localWindow.webContents.send("notify", { title:"Reset", description:"Your settings have been reset.", color:"rgb(40,40,40)", duration:5000 });
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
					localWindow.webContents.send("notify", { title:"Error", description:"Access not authorized.", color:"rgb(40,40,40)", duration:5000 });
				}
			}
			else {
				localWindow.webContents.send("notify", { title:"Error", description:"Invalid settings. Try resetting them.", color:"rgb(40,40,40)", duration:5000 });
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

		appExpress.post("/remotePlaySong", (req, res) => {
			localWindow.webContents.send("remotePlaySong", JSON.stringify(req.body));
		});

		appExpress.post("/playSong", (req, res) => {

		});

		appExpress.get("/resumeSong", (req, res) => {
			localWindow.webContents.send("resumeSong");
		});

		appExpress.get("/pauseSong", (req, res) => {
			localWindow.webContents.send("pauseSong");
		});

		appExpress.get("/getSongs", (req, res) => {
			if(validJSON(settings)) {
				let libraryDirectory = JSON.parse(settings).libraryDirectory;
				if(libraryDirectory !== "") {
					glob(libraryDirectory + "/**/*.{mp3, wav, ogg}", (error, files) => {
						if(error) {
							console.log(error);
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
										res.send(songs);
									}
								}).catch(error => {
									console.log(error);
								});
							});
						}
					});
				}
				else {
					res.send("");
				}
			}
		});

		appExpress.get("/getInfo", (req, res) => {
			let info = { ip:ip.address(), localPort:localPort, appPort:appPort, settings:settings, playlists:playlists, forceUpdate:true };
			res.send(info);
		});

		function sendInfo(forced) {
			let info = { ip:ip.address(), localPort:localPort, appPort:appPort, settings:settings, playlists:playlists, forceUpdate:forced };
			localWindow.webContents.send("getInfo", info);
		}

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
						localWindow.webContents.send("notify", { title:"Error", description:"Couldn't write to settings file.", color:"rgb(40,40,40)", duration:5000 });
					}
					else {
						settings = JSON.stringify(current);
						sendInfo(false);
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