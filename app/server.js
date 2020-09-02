const localPort = 1999;
const appPort = 1998;
const scriptPath = process.cwd() + "\\server.js";

const electron = require("electron");

const express = require("express");
const localExpress = express();
const appExpress = express();
const localServer = localExpress.listen(localPort, "localhost");
const appServer = appExpress.listen(appPort);

const fs = require("fs");
const path = require("path");
const body_parser = require("body-parser");

const dataDirectory = path.join(__dirname, "./data/");
const settingsFile = dataDirectory + "settings.json";
const playlistsFile = dataDirectory + "playlists.json";

const { app, BrowserWindow, screen, ipcMain } = electron;

app.on("ready", function() {
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;
	
	let windowWidth = 1280;
	let windowHeight = 720;

	if(width <= 1080 || height <= 620) {
		windowWidth = width - 100;
		windowHeight = height - 100;
	}

	const localWindow = new BrowserWindow({
		width:windowWidth,
		height:windowHeight,
		resizable:true,
		frame:false,
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

	});
});