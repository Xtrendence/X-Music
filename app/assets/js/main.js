document.addEventListener("DOMContentLoaded", () => {
	const electron = require("electron");
	const { ipcRenderer } = electron;

	let ipAddress = "127.0.0.1";
	let localPort = 1999;
	let appPort = 1998;
	let appTheme = "light";
	let libraryDirectory = "";
	let songs = {};

	let body = document.getElementsByTagName("body")[0];
	let cssTheme = document.getElementsByClassName("css-theme")[0];

	let buttonMinimize = document.getElementsByClassName("title-button minimize")[0];
	let buttonMaximize = document.getElementsByClassName("title-button maximize")[0];
	let buttonQuit = document.getElementsByClassName("title-button quit")[0];

	let buttonSongs = document.getElementsByClassName("sidebar-button songs")[0];
	let buttonAlbums = document.getElementsByClassName("sidebar-button albums")[0];
	let buttonPlaylists = document.getElementsByClassName("sidebar-button playlists")[0];
	let buttonSettings = document.getElementsByClassName("sidebar-button settings")[0];

	let buttonBrowse = document.getElementsByClassName("input-button browse")[0];
	let buttonEnableArtwork = document.getElementsByClassName("input-choice enable-artwork")[0];
	let buttonDisableArtwork = document.getElementsByClassName("input-choice disable-artwork")[0];
	let buttonEnableRemote = document.getElementsByClassName("input-choice enable-remote")[0];
	let buttonDisableRemote = document.getElementsByClassName("input-choice disable-remote")[0];
	let buttonResetSettings = document.getElementsByClassName("input-button reset-settings")[0];

	let inputLibraryDirectory = document.getElementsByClassName("input-field library-directory")[0];

	let audioFile = document.getElementsByClassName("audio-file")[0];

	let divListview = document.getElementsByClassName("listview")[0];
	let divSettingsWrapper = document.getElementsByClassName("settings-wrapper")[0];

	if(detectMobile()) {
		body.id = "mobile";
	}
	else {
		body.id = "desktop";
	}

	getInfo();
	getSongs();

	buttonMinimize.addEventListener("click", () => {
		minimizeApp();
	});

	buttonMaximize.addEventListener("click", () => {
		maximizeApp();
	});

	buttonQuit.addEventListener("click", () => {
		quitApp();
	});

	buttonSongs.addEventListener("click", () => {
		showPage("songs");
	});

	buttonAlbums.addEventListener("click", () => {
		showPage("albums");
	});

	buttonPlaylists.addEventListener("click", () => {
		showPage("playlists");
	});

	buttonSettings.addEventListener("click", () => {
		showPage("settings");
	});

	buttonBrowse.addEventListener("click", () => {
		ipcRenderer.send("browseFiles");
	});

	buttonEnableArtwork.addEventListener("click", () => {

	});

	buttonDisableArtwork.addEventListener("click", () => {

	});

	buttonEnableRemote.addEventListener("click", () => {

	});

	buttonDisableRemote.addEventListener("click", () => {

	});

	buttonResetSettings.addEventListener("click", () => {
		ipcRenderer.send("resetSettings");
	});

	ipcRenderer.on("getInfo", (error, res) => {
		ipAddress = res.ip;
		localPort = res.localPort;
		appPort = res.appPort;
		appTheme = res.theme;
		if(validJSON(res.settings)) {
			let settings = JSON.parse(res.settings);
			inputLibraryDirectory.value = settings.libraryDirectory;
			console.log(settings);
		}
		setTheme(appTheme);
	});

	ipcRenderer.on("getSongs", (error, res) => {
		songs = res;
		divListview.innerHTML = "";
		let files = Object.keys(songs);
		for(let i = 0; i < files.length; i++) {
			let file = files[i];
			let song = songs[file];
			let element = document.createElement("div");
			element.classList.add("list-item");
			element.id = file;
			element.innerHTML = '<svg class="play-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7 60.1 72.4 41.3l352-208c31.4-18.5 31.5-64.1 0-82.6z"/></svg><span class="title">' + song.title + '</span><span class="album">' + song.album + '</span><span class="artist">' + song.artist + '</span><span class="duration">' + moment.utc(song.duration * 1000).format("HH:mm:ss").replace("Invalid date", "-") + '</span><svg class="more-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512"><path d="M96 184c39.8 0 72 32.2 72 72s-32.2 72-72 72-72-32.2-72-72 32.2-72 72-72zM24 80c0 39.8 32.2 72 72 72s72-32.2 72-72S135.8 8 96 8 24 40.2 24 80zm0 352c0 39.8 32.2 72 72 72s72-32.2 72-72-32.2-72-72-72-72 32.2-72 72z"/></svg>';
			divListview.appendChild(element);
			let playIcon = element.getElementsByClassName("play-icon")[0];
			let moreIcon = element.getElementsByClassName("more-icon")[0];
			playIcon.addEventListener("click", () => {
				playSong(file, song);
			});
		}
	});

	ipcRenderer.on("playSong", (error, res) => {
		audioFile.src = "data:" + res.mime + ";base64," + res.base64;
		audioFile.load();
		audioFile.play();
	});

	function setTheme(theme) {
		if(theme === "light") {
			cssTheme.setAttribute("href", "../assets/css/light.css");
		}
		else {
			cssTheme.setAttribute("href", "../assets/css/dark.css");
		}
	}

	function getInfo() {
		ipcRenderer.send("getInfo");
	}

	function getSongs() {
		ipcRenderer.send("getSongs");
	}

	function playSong(file, song) {
		ipcRenderer.send("playSong", file);
	}

	function minimizeApp() {
		ipcRenderer.send("minimizeApp");
	}

	function maximizeApp() {
		ipcRenderer.send("maximizeApp");
	}

	function quitApp() {
		ipcRenderer.send("quitApp");
	}

	function showPage(page) {
		buttonSongs.classList.remove("active");
		buttonAlbums.classList.remove("active");
		buttonPlaylists.classList.remove("active");
		buttonSettings.classList.remove("active");

		divListview.style.display = "none";
		divSettingsWrapper.style.display = "none";

		if(page === "songs" || page === "albums" || page === "playlists") {
			divListview.style.display = "block";
		}
		else {
			divSettingsWrapper.style.display = "block";
		}

		document.getElementsByClassName("sidebar-button " + page)[0].classList.add("active");
	}
});

// Replace all occurrences in a string.
String.prototype.replaceAll = function(str1, str2, ignore) {
	return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
}

function empty(string) {
	if(string !== null && typeof string !== "undefined" && string.toString().trim() !== "" && JSON.stringify(string) !== "" && JSON.stringify(string) !== "{}") {
		return false;
	}
	return true;
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

// Detect whether or not the user is on a mobile browser.
function detectMobile() {
	var check = false;
	(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
	return check;
}