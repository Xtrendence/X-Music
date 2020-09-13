document.addEventListener("DOMContentLoaded", () => {
	const electron = require("electron");
	const { ipcRenderer } = electron;

	let ipAddress = "127.0.0.1";
	let localPort = 1999;
	let appPort = 1998;
	let libraryDirectory = "";
	let loop = "none";

	let currentSong = "";

	let songs = [];
	let albums = {};
	let artists = {};
	let playlists = {};

	let body = document.getElementsByTagName("body")[0];

	let buttonDiagnostics = document.getElementsByClassName("title-button diagnostics")[0];
	let buttonRefresh = document.getElementsByClassName("title-button refresh")[0];
	let buttonMinimize = document.getElementsByClassName("title-button minimize")[0];
	let buttonMaximize = document.getElementsByClassName("title-button maximize")[0];
	let buttonQuit = document.getElementsByClassName("title-button quit")[0];

	let buttonSongs = document.getElementsByClassName("sidebar-button songs")[0];
	let buttonAlbums = document.getElementsByClassName("sidebar-button albums")[0];
	let buttonArtists = document.getElementsByClassName("sidebar-button artists")[0];
	let buttonPlaylists = document.getElementsByClassName("sidebar-button playlists")[0];
	let buttonSettings = document.getElementsByClassName("sidebar-button settings")[0];

	let buttonBrowse = document.getElementsByClassName("input-button browse")[0];
	let buttonEnableRemote = document.getElementsByClassName("input-choice enable-remote")[0];
	let buttonDisableRemote = document.getElementsByClassName("input-choice disable-remote")[0];
	let buttonResetSettings = document.getElementsByClassName("input-button reset-settings")[0];

	let buttonMoreClose = document.getElementsByClassName("more-button close-menu")[0];
	let buttonMorePlaySong = document.getElementsByClassName("more-button play-song")[0];
	let buttonMoreAddToPlaylist = document.getElementsByClassName("more-button add-to-playlist")[0];
	let buttonMoreRemoveFromPlaylist = document.getElementsByClassName("more-button remove-from-playlist")[0];
	let buttonMoreOpenFileLocation = document.getElementsByClassName("more-button open-file-location")[0];

	let inputSearch = document.getElementsByClassName("sidebar-search")[0];
	let inputSlider = document.getElementsByClassName("audio-slider")[0];
	let inputLibraryDirectory = document.getElementsByClassName("input-field library-directory")[0];

	let divListview = document.getElementsByClassName("listview")[0];
	let divAudioPlayer = document.getElementsByClassName("audio-player")[0];
	let divSettingsWrapper = document.getElementsByClassName("settings-wrapper")[0];
	let divMoreMenu = document.getElementsByClassName("more-menu")[0];

	let audioFile = document.getElementsByClassName("audio-file")[0];

	let svgPlay = divAudioPlayer.getElementsByClassName("play-icon")[0];
	let svgPause = divAudioPlayer.getElementsByClassName("pause-icon")[0];
	let svgLoop = divAudioPlayer.getElementsByClassName("loop-icon")[0];
	let svgPrevious = divAudioPlayer.getElementsByClassName("previous-icon")[0];
	let svgNext = divAudioPlayer.getElementsByClassName("next-icon")[0];

	let spanAudioBanner = document.getElementsByClassName("audio-banner")[0];
	let spanTimePassed = document.getElementsByClassName("audio-duration time-passed")[0];
	let spanTimeTotal = document.getElementsByClassName("audio-duration time-total")[0];
	let spanLoopIndicator = document.getElementsByClassName("loop-indicator")[0];
	let spanAudioFileCounter = document.getElementsByClassName("audio-file-counter")[0];
	let spanRemoteIP = document.getElementsByClassName("remote-ip")[0];

	if(detectMobile()) {
		body.id = "mobile";
	}
	else {
		body.id = "desktop";
	}

	getInfo();

	document.addEventListener("click", (e) => {
		let target = e.target;
		let moreMenuExceptions = ["more-menu", "more-button", "more-icon", "more-path"];
		let exception = false;
		for(let i = 0; i < moreMenuExceptions.length; i++) {
			if(target.classList.contains(moreMenuExceptions[i])) {
				exception = true;
			}
		}
		if(!exception) {
			hideMoreMenu();
		}
	});

	buttonDiagnostics.addEventListener("click", () => {

	});

	buttonRefresh.addEventListener("click", () => {
		getSongs();
	});

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

	buttonArtists.addEventListener("click", () => {
		showPage("artists");
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

	buttonEnableRemote.addEventListener("click", () => {
		ipcRenderer.send("allowRemote", true);
	});

	buttonDisableRemote.addEventListener("click", () => {
		ipcRenderer.send("allowRemote", false);
	});

	buttonResetSettings.addEventListener("click", () => {
		ipcRenderer.send("resetSettings");
	});

	buttonMoreClose.addEventListener("click", () => {
		hideMoreMenu();
	});

	buttonMorePlaySong.addEventListener("click", () => {
		let index = divMoreMenu.getAttribute("data-index");
		let song = songs[index];
		let file = song.file;
		playSong(file, song);
	});

	buttonMoreAddToPlaylist.addEventListener("click", () => {

	});

	buttonMoreRemoveFromPlaylist.addEventListener("click", () => {

	});

	buttonMoreOpenFileLocation.addEventListener("click", () => {
		let index = divMoreMenu.getAttribute("data-index");
		let song = songs[index];
		let file = song.file;
		ipcRenderer.send("openFileLocation", file);
	});

	inputSearch.addEventListener("keydown", () => {
		searchSong(inputSearch.value);
	});

	inputSearch.addEventListener("keyup", () => {
		searchSong(inputSearch.value);
	});

	svgPlay.addEventListener("click", () => {
		if(audioFile.src !== "" && typeof audioFile.src !== "undefined") {
			audioFile.play();
			showPause();
		}
	});

	svgPause.addEventListener("click", () => {
		if(audioFile.src !== "" && typeof audioFile.src !== "undefined") {
			audioFile.pause();
			showPlay();
		}
	});

	svgLoop.addEventListener("click", () => {
		if(svgLoop.classList.contains("loop-list")) {
			ipcRenderer.send("loopSetting", "song");
		}
		else if(svgLoop.classList.contains("loop-song")) {
			ipcRenderer.send("loopSetting", "none");
		}
		else {
			ipcRenderer.send("loopSetting", "list");
		}
	});

	svgPrevious.addEventListener("click", () => {
		playPreviousSong();
	});

	svgNext.addEventListener("click", () => {
		playNextSong();
	});

	audioFile.addEventListener("timeupdate", () => {
		inputSlider.value = audioFile.currentTime;
		inputSlider.setAttribute("value", audioFile.currentTime);
		spanTimePassed.textContent = formatSeconds(audioFile.currentTime);
		if(inputSlider.getAttribute("value") >= audioFile.duration) {
			inputSlider.setAttribute("value", Math.floor(audioFile.duration));
			inputSlider.setAttribute("max", Math.floor(audioFile.duration));
			spanTimePassed.textContent = spanTimeTotal.textContent;
			showPlay();
		}
	});

	inputSlider.addEventListener("change", () => {
		audioFile.currentTime = inputSlider.value;
	});

	ipcRenderer.on("getInfo", (error, res) => {
		ipAddress = res.ip;
		localPort = res.localPort;
		appPort = res.appPort;
		buttonEnableRemote.classList.remove("active");
		buttonDisableRemote.classList.remove("active");
		if(validJSON(res.settings)) {
			let settings = JSON.parse(res.settings);
			inputLibraryDirectory.value = settings.libraryDirectory;
			if(libraryDirectory !== settings.libraryDirectory || res.forceUpdate) {
				hideAudioPlayer();
				libraryDirectory = settings.libraryDirectory;
				getSongs();
			}
			loop = settings.loop;
			svgLoop.setAttribute("class", "loop-icon");
			svgLoop.classList.add("loop-" + settings.loop);
			if(settings.loop === "song") {
				spanLoopIndicator.classList.remove("hidden");
			}
			else {
				spanLoopIndicator.classList.add("hidden");
			}
			if(settings.allowRemote) {
				buttonEnableRemote.classList.add("active");
				spanRemoteIP.textContent = "http://" + ipAddress + ":" + appPort;
				spanRemoteIP.classList.remove("hidden");
			}
			else {
				buttonDisableRemote.classList.add("active");
				spanRemoteIP.textContent = "";
				spanRemoteIP.classList.add("hidden");
			}
		}
	});

	ipcRenderer.on("getSongs", (error, res) => {
		songs = res;
		sortSongs();
		spanAudioFileCounter.textContent = "Files Found: " + Object.keys(songs).length;
		showPage("songs");
	});

	ipcRenderer.on("playSong", (error, res) => {
		audioFile.src = "data:" + res.mime + ";base64," + res.base64;
		audioFile.load();
		audioFile.play();
		divListview.classList.add("active");
		spanAudioBanner.classList.remove("hidden");
		divAudioPlayer.classList.remove("hidden");
		showPause();
	});

	ipcRenderer.on("resumeSong", () => {
		if(audioFile.src !== "" && typeof audioFile.src !== "undefined") {
			audioFile.play();
			showPause();
		}
	});

	ipcRenderer.on("pauseSong", () => {
		if(audioFile.src !== "" && typeof audioFile.src !== "undefined") {
			audioFile.pause();
			showPlay();
		}
	});

	function getInfo() {
		ipcRenderer.send("getInfo");
	}

	function getSongs() {
		ipcRenderer.send("getSongs");
		divListview.innerHTML = "";
	}

	function listSongs(songs) {
		let keys = Object.keys(songs);
		for(let i = 0; i < keys.length; i++) {
			let index = keys[i];
			let song = songs[index];

			let artist = "Unknown Artist";
			if(typeof song.artist !== "undefined") {
				artist = song.artist.trim();
			}

			if(artist in artists) {
				artists[artist]["songs"].push(index);
			}
			else {
				artists[artist] = { songs:[index] };
			}

			let album = "Unknown Album";
			if(typeof song.album !== "undefined") {
				album = song.album.trim();
			}

			if(album in albums) {
				albums[album]["songs"].push(index);
				if(albums[album].artist !== artist) {
					albums[album].artist = "Multiple Artists";
				}
			}
			else {
				albums[album] = { artist:song.artist, songs:[index] };
			}

			let element = document.createElement("div");
			element.classList.add("list-item");
			element.classList.add("song");
			element.id = song.file;
			element.innerHTML = '<svg class="play-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7 60.1 72.4 41.3l352-208c31.4-18.5 31.5-64.1 0-82.6z"/></svg><span class="title">' + song.title + '</span><span class="album">' + song.album + '</span><span class="artist">' + song.artist + '</span><span class="duration">' + formatSeconds(song.duration) + '</span><svg class="more-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 512"><path class="more-path" d="M96 184c39.8 0 72 32.2 72 72s-32.2 72-72 72-72-32.2-72-72 32.2-72 72-72zM24 80c0 39.8 32.2 72 72 72s72-32.2 72-72S135.8 8 96 8 24 40.2 24 80zm0 352c0 39.8 32.2 72 72 72s72-32.2 72-72-32.2-72-72-72-72 32.2-72 72z"/></svg>';
			divListview.appendChild(element);

			let playIcon = element.getElementsByClassName("play-icon")[0];
			let moreIcon = element.getElementsByClassName("more-icon")[0];

			playIcon.addEventListener("click", () => {
				playSong(song.file, song);
			});

			moreIcon.addEventListener("click", () => {
				showMoreMenu(element, index);
			});
		}

		if(keys.length === 0) {
			let element = document.createElement("div");
			element.classList.add("list-item");
			element.classList.add("error");
			element.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zm-248 50c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z"/></svg><span class="title">No Songs Found...</span>';
			divListview.appendChild(element);
		}
	}

	function sortSongs() {
		songs.sort((a, b) => a.title.localeCompare(b.title));
	}

	function sortPlaylists() {

	}

	function listAlbums() {
		let keys = Object.keys(albums).sort((a, b) => a.localeCompare(b));
		for(let i = 0; i < keys.length; i ++) {
			let name = keys[i];
			let album = albums[keys[i]];
			let element = document.createElement("div");
			element.id = name;
			element.classList.add("block-item");
			element.classList.add("album");
			element.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 152a104 104 0 1 0 104 104 104 104 0 0 0-104-104zm0 128a24 24 0 1 1 24-24 24 24 0 0 1-24 24zm0-272C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm0 376a128 128 0 1 1 128-128 128 128 0 0 1-128 128z"/></svg><span class="title">' + name + '</span><span class="artist">' + album.artist + '</span>';
			divListview.appendChild(element);

			element.addEventListener("click", () => {
				let albumSongs = {};
				for(let i = 0; i < album.songs.length; i++) {
					albumSongs[album.songs[i]] = songs[album.songs[i]];
				}
				showPage("songs", { songs:albumSongs });
			});
		}

		if(Object.keys(albums).length === 0) {
			let element = document.createElement("div");
			element.classList.add("list-item");
			element.classList.add("error");
			element.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zm-248 50c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z"/></svg><span class="title">No Albums Found...</span>';
			divListview.appendChild(element);
		}
	}

	function listArtists() {
		let keys = Object.keys(artists).sort((a, b) => a.localeCompare(b));
		for(let i = 0; i < keys.length; i ++) {
			let name = keys[i];
			let artist = artists[keys[i]];
			let element = document.createElement("div");
			element.id = name;
			element.classList.add("block-item");
			element.classList.add("artist");
			element.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 352 512"><path d="M336 192h-16c-8.84 0-16 7.16-16 16v48c0 74.8-64.49 134.82-140.79 127.38C96.71 376.89 48 317.11 48 250.3V208c0-8.84-7.16-16-16-16H16c-8.84 0-16 7.16-16 16v40.16c0 89.64 63.97 169.55 152 181.69V464H96c-8.84 0-16 7.16-16 16v16c0 8.84 7.16 16 16 16h160c8.84 0 16-7.16 16-16v-16c0-8.84-7.16-16-16-16h-56v-33.77C285.71 418.47 352 344.9 352 256v-48c0-8.84-7.16-16-16-16zM176 352c53.02 0 96-42.98 96-96h-85.33c-5.89 0-10.67-3.58-10.67-8v-16c0-4.42 4.78-8 10.67-8H272v-32h-85.33c-5.89 0-10.67-3.58-10.67-8v-16c0-4.42 4.78-8 10.67-8H272v-32h-85.33c-5.89 0-10.67-3.58-10.67-8v-16c0-4.42 4.78-8 10.67-8H272c0-53.02-42.98-96-96-96S80 42.98 80 96v160c0 53.02 42.98 96 96 96z"/></svg><span class="title">' + name + '</span>';
			divListview.appendChild(element);

			element.addEventListener("click", () => {
				let artistSongs = {};
				for(let i = 0; i < artist.songs.length; i++) {
					artistSongs[artist.songs[i]] = songs[artist.songs[i]];
				}
				showPage("songs", { songs:artistSongs });
			});
		}

		if(Object.keys(artists).length === 0) {
			let element = document.createElement("div");
			element.classList.add("list-item");
			element.classList.add("error");
			element.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zm-248 50c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z"/></svg><span class="title">No Artists Found...</span>';
			divListview.appendChild(element);
		}
	}

	function listPlaylists() {
		if(Object.keys(playlists).length === 0) {
			let element = document.createElement("div");
			element.classList.add("list-item");
			element.classList.add("error");
			element.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zm-248 50c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z"/></svg><span class="title">No Playlists Found...</span>';
			divListview.appendChild(element);
		}
	}

	function showMoreMenu(element, index) {
		divMoreMenu.style.top = element.offsetTop + 49 + "px";
		divMoreMenu.classList.remove("hidden");
		divMoreMenu.setAttribute("data-index", index);
	}

	function hideMoreMenu() {
		divMoreMenu.classList.add("hidden");
		divMoreMenu.removeAttribute("data-index");
		divMoreMenu.removeAttribute("style");
	}

	function hideAudioPlayer() {
		currentSong = "";
		audioFile.pause();
		audioFile.src = "";
		divListview.classList.remove("active");
		spanAudioBanner.classList.add("hidden");
		divAudioPlayer.classList.add("hidden");
		showPlay();
	}

	function playSong(file, song) {
		ipcRenderer.send("playSong", file);
		currentSong = file;
		spanAudioBanner.textContent = song.title + " - " + song.artist + " - " + song.album;
		inputSlider.setAttribute("max", song.duration);
		spanTimeTotal.textContent = formatSeconds(song.duration);
	}

	function playPreviousSong() {
		let listedSongs = document.getElementsByClassName("list-item song");
		let previous = listedSongs[listedSongs.length - 1];
		if(document.getElementById(currentSong).previousSibling !== null) {
			previous = document.getElementById(currentSong).previousSibling;
		}
		playSong(previous.id, songs[previous.id]);
	}

	function playNextSong() {
		let listedSongs = document.getElementsByClassName("list-item song");
		let next = listedSongs[0];
		if(document.getElementById(currentSong).nextSibling !== null) {
			next = document.getElementById(currentSong).nextSibling;
		}
		playSong(next.id, songs[next.id]);
	}

	function searchSong(query) {
		if(query !== "" && query.trim() !== "") {
			showAll();
			query = query.toLowerCase();
			let activePage = document.getElementsByClassName("sidebar-button active")[0];
			if(activePage.classList.contains("songs")) {
				let elements = document.getElementsByClassName("list-item song");
				for(let i = 0; i < elements.length; i++) {
					let element = elements[i];
					let title = element.getElementsByClassName("title")[0].textContent.toLowerCase();
					let album = element.getElementsByClassName("album")[0].textContent.toLowerCase();
					let artist = element.getElementsByClassName("artist")[0].textContent.toLowerCase();
					if(!title.includes(query) && !album.includes(query) && !artist.includes(query)) {
						element.style.display = "none";
					}
				}
			}
			else if(activePage.classList.contains("albums")) {
				let elements = document.getElementsByClassName("block-item album");
				for(let i = 0; i < elements.length; i++) {
					let element = elements[i];
					let title = element.getElementsByClassName("title")[0].textContent.toLowerCase();
					let artist = element.getElementsByClassName("artist")[0].textContent.toLowerCase();
					if(!title.includes(query) && !artist.includes(query)) {
						element.style.display = "none";
					}
				}
			}
			else if(activePage.classList.contains("artists")) {
				let elements = document.getElementsByClassName("block-item artist");
				for(let i = 0; i < elements.length; i++) {
					let element = elements[i];
					let title = element.getElementsByClassName("title")[0].textContent.toLowerCase();
					if(!title.includes(query)) {
						element.style.display = "none";
					}
				}
			}
			else if(activePage.classList.contains("playlists")) {

			}
		}
		else {
			showAll();
		}

		function showAll() {
			let listElements = document.getElementsByClassName("list-item");
			let blockElements = document.getElementsByClassName("block-item");
			for(let i = 0; i < listElements.length; i++) {
				listElements[i].style.display = "block";
			}
			for(let i = 0; i < blockElements.length; i++) {
				blockElements[i].style.display = "inline-block";
			}
		}
	}

	function showPause() {
		svgPlay.classList.add("hidden");
		svgPause.classList.remove("hidden");
	}
	function showPlay() {
		svgPause.classList.add("hidden");
		svgPlay.classList.remove("hidden");
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

	function showPage(page, args) {
		buttonSongs.classList.remove("active");
		buttonAlbums.classList.remove("active");
		buttonArtists.classList.remove("active");
		buttonPlaylists.classList.remove("active");
		buttonSettings.classList.remove("active");

		divListview.style.display = "none";
		divSettingsWrapper.style.display = "none";

		if(page === "songs" || page === "albums" || page === "artists" || page === "playlists") {
			divListview.style.display = "block";
			divListview.innerHTML = "";
			inputSearch.classList.remove("hidden");

			switch(page) {
				case "songs":
					(typeof args !== "undefined" && typeof args.songs !== "undefined") ? listSongs(args.songs) : listSongs(songs);
					break;
				case "albums":
					listAlbums();
					break;
				case "artists":
					listArtists();
					break;
				case "playlists":
					listPlaylists();
					break;
			}
		}
		else {
			divSettingsWrapper.style.display = "block";
			inputSearch.classList.add("hidden");
		}

		divListview.scrollTop = 0;
		divListview.scrollTo(0, 0);

		document.getElementsByClassName("sidebar-button " + page)[0].classList.add("active");
	}
});

function formatSeconds(seconds) {
	return moment.utc(seconds * 1000).format("HH:mm:ss").replace("Invalid date", "-");
}

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