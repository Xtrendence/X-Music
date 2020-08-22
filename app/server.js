const port = 1999;
const scriptPath = process.cwd() + "\\server.js";

const express = require("express");
const app = express();
const server = app.listen(port);

const fs = require("fs");
const path = require("path");
const body_parser = require("body-parser");

const dataDirectory = path.join(__dirname, "./data/");

app.set("view engine", "ejs");
app.use("/assets", express.static("assets"));
app.use(body_parser.urlencoded({ extended:true }));
app.use(body_parser.json({ limit:"512mb" }));

app.get("/", (req, res) => {
	res.render("index");
});