document.addEventListener("DOMContentLoaded", () => {
	let localPort = 1999;
	let appPort = 1998;
	let libraryDirectory = "";
	let loop = "none";
	let volume = 100;

	// How often the remote checks to ensure its list of songs are the same as the host. Default: 450ms.
	let refreshRateSongs = 450;
	// How often the remote checks to ensure its status (what song is being played, what page is active etc.) is the same as the host. Default: 200ms.
	let refreshRateStatus = 200;

	// Suspend syncing the remote's status with the host so that any changes made on the remote have time to take place on the host. Default suspension time is 1.5s. If the remote is delayed or the host doesn't sync up smoothly with it, try playing around with the suspension time. If you set the suspension time to a higher number, you'll most likely get a smoother experience, but actions will be more delayed. This is because, occasionally, the host will update its status at the same time that a command is being sent from the remote, so the remote's action will be overridden by the host. To fix this, the entire sync feature would have to be changed, and sockets would have to be used as HTTP requests weren't made to actively sync two devices up.
	let suspendSync = false;
	let suspensionTime = 1500;

	let currentSong = "";

	let hostView = "";
	let remoteView = {
		activePage:"songs",
		activeAlbum:"",
		activeArtist:"",
		activePlaylist:""
	};

	let songs = [];
	let albums = {};
	let artists = {};
	let playlists = {};

	let body = document.getElementsByTagName("body")[0];

	let divListview = document.getElementsByClassName("listview")[0];
	let divAudioPlayer = document.getElementsByClassName("audio-player")[0];
	let divAudioBanner = document.getElementsByClassName("audio-banner-wrapper")[0];

	let buttonRefresh = document.getElementsByClassName("title-button refresh")[0];

	let buttonSongs = document.getElementsByClassName("sidebar-button songs")[0];
	let buttonAlbums = document.getElementsByClassName("sidebar-button albums")[0];
	let buttonArtists = document.getElementsByClassName("sidebar-button artists")[0];
	let buttonPlaylists = document.getElementsByClassName("sidebar-button playlists")[0];
	let buttonPassthrough = document.getElementsByClassName("sidebar-button passthrough")[0];

	let inputSearch = document.getElementsByClassName("input-search")[0];
	let inputSlider = document.getElementsByClassName("audio-slider")[0];
	let inputVolume = document.getElementsByClassName("audio-volume-slider")[0];

	let audioFile = document.getElementsByClassName("audio-file")[0];

	let svgNoVolume = divAudioPlayer.getElementsByClassName("no-volume-icon")[0];
	let svgLowVolume = divAudioPlayer.getElementsByClassName("low-volume-icon")[0];
	let svgHighVolume = divAudioPlayer.getElementsByClassName("high-volume-icon")[0];
	let svgPlay = divAudioPlayer.getElementsByClassName("play-icon")[0];
	let svgPause = divAudioPlayer.getElementsByClassName("pause-icon")[0];
	let svgLoop = divAudioPlayer.getElementsByClassName("loop-icon")[0];
	let svgPrevious = divAudioPlayer.getElementsByClassName("previous-icon")[0];
	let svgNext = divAudioPlayer.getElementsByClassName("next-icon")[0];
	let svgCloseAudioPlayer = divAudioBanner.getElementsByClassName("close-audio-player")[0];

	let spanAudioBanner = document.getElementsByClassName("audio-banner")[0];
	let spanTimePassed = document.getElementsByClassName("audio-duration time-passed")[0];
	let spanTimeTotal = document.getElementsByClassName("audio-duration time-total")[0];
	let spanLoopIndicator = document.getElementsByClassName("loop-indicator")[0];

	if(detectMobile()) {
		body.id = "mobile";
	}
	else {
		body.id = "desktop";
	}

	getInfo();
	loopCheck();
	passthroughCheck();
	setView();

	setTimeout(() => {
		let refreshSongs = setInterval(() => {
			getSongs(false, false);
			getPlaylists(false, false);
		}, refreshRateSongs);
	}, refreshRateSongs + 125);

	setTimeout(() => {
		let refreshStatus = setInterval(() => {
			if(!passthroughCheck()) {
				checkStatus();
			}
		}, refreshRateStatus);
	}, refreshRateStatus + 125);

	buttonRefresh.addEventListener("click", () => {
		divListview.innerHTML = "";
		getSongs(true, false);
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

	buttonPassthrough.addEventListener("click", () => {
		if(passthroughCheck()) {
			disablePassthrough();
		}
		else {
			enablePassthrough();
		}
	});

	inputSearch.addEventListener("keydown", () => {
		searchSong(inputSearch.value);
	});

	inputSearch.addEventListener("keyup", () => {
		searchSong(inputSearch.value);
	});

	svgPlay.addEventListener("click", () => {
		if(passthroughCheck()) {
			if(audioFile.src !== "" && typeof audioFile.src !== "undefined") {
				audioFile.play();
				showPause();
			}
		}
		else {
			let xhr = new XMLHttpRequest();
			xhr.open("GET", "/resumeSong", true);
			xhr.send();
		}
	});

	svgPause.addEventListener("click", () => {
		if(passthroughCheck()) {
			if(audioFile.src !== "" && typeof audioFile.src !== "undefined") {
				audioFile.pause();
				showPlay();
			}
		}
		else {
			let xhr = new XMLHttpRequest();
			xhr.open("GET", "/pauseSong", true);
			xhr.send();
		}
	});

	svgLoop.addEventListener("click", () => {
		if(passthroughCheck()) {
			if(svgLoop.classList.contains("loop-list")) {
				window.localStorage.setItem("loop", "song");
			}
			else if(svgLoop.classList.contains("loop-song")) {
				window.localStorage.setItem("loop", "none");
			}
			else {
				window.localStorage.setItem("loop", "list");
			}
			loopCheck();
		}
		else {
			let xhr = new XMLHttpRequest();
			xhr.open("GET", "/setLoop", true);
			xhr.send();
		}
	});

	svgPrevious.addEventListener("click", () => {
		playPreviousSong();
	});

	svgNext.addEventListener("click", () => {
		playNextSong();
	});

	svgCloseAudioPlayer.addEventListener("click", () => {
		if(passthroughCheck()) {
			hideAudioPlayer();
		}
		else {
			stopSong();
		}
	});

	audioFile.addEventListener("timeupdate", () => {
		if(passthroughCheck()) {
			inputSlider.value = audioFile.currentTime;
			inputSlider.setAttribute("value", audioFile.currentTime);
			spanTimePassed.textContent = formatSeconds(audioFile.currentTime);
			if(inputSlider.getAttribute("value") >= audioFile.duration) {
				inputSlider.setAttribute("value", Math.floor(audioFile.duration));
				inputSlider.setAttribute("max", Math.floor(audioFile.duration));
				spanTimePassed.textContent = spanTimeTotal.textContent;
				showPlay();
			}
		}
	});

	audioFile.addEventListener("ended", () => {
		if(passthroughCheck()) {
			switch(loop) {
				case "list":
					playNextSong();
					break;
				case "song":
					repeatSong();
					break;
			}
		}
	});

	inputSlider.addEventListener("input", () => {
		if(passthroughCheck()) {
			audioFile.currentTime = inputSlider.value;
		}
		else {
			let xhr = new XMLHttpRequest();
			xhr.open("POST", "/setSlider", true);
			xhr.setRequestHeader("Content-Type", "application/json");
			xhr.send(JSON.stringify({ slider:inputSlider.value }));
		}
	});

	inputVolume.addEventListener("input", () => {
		if(passthroughCheck()) {
			audioFile.volume = inputVolume.value / 100;
			volume = parseInt(inputVolume.value);
			setVolumeIcon();
		}
		else {
			let xhr = new XMLHttpRequest();
			xhr.open("POST", "/setVolume", true);
			xhr.setRequestHeader("Content-Type", "application/json");
			xhr.send(JSON.stringify({ volume:parseInt(inputVolume.value) }));
		}
	});

	function checkStatus() {
		if(!passthroughCheck()) {
			let xhr = new XMLHttpRequest();
			xhr.addEventListener("readystatechange", () => {
				if(xhr.readyState === XMLHttpRequest.DONE) {
					let res = xhr.responseText;
					if(validJSON(res)) {
						res = JSON.parse(res);
						if(!res.song.playing) {
							showPlay();
						}
						else {
							showPause();
						}
						if(!res.song.audioPlayer) {
							hideAudioPlayer();
						}
						else {
							divListview.classList.add("active");
							divAudioBanner.classList.remove("hidden");
							divAudioPlayer.classList.remove("hidden");
						}
						spanTimePassed.textContent = res.song.timePassed;
						spanTimeTotal.textContent = res.song.timeTotal;
						inputSlider.value = res.song.timeValue;
						inputSlider.setAttribute("max", res.song.duration);
						inputVolume.value = res.song.volume;
						volume = res.song.volume;
						setVolumeIcon();
						if(window.localStorage.getItem("loop") !== res.song.loop) {
							window.localStorage.setItem("loop", res.song.loop);
							loopCheck();
						}
						currentSong = res.song.file;
						spanAudioBanner.textContent = res.song.title + " - " + res.song.artist + " - " + res.song.album;
						hostView = res.view;
						syncView();
					}
				}
			});
			xhr.open("GET", "/checkStatus", true);
			xhr.send();
		}
	}

	function syncView() {
		if(hostView !== "" && Object.keys(remoteView).length !== 0 && !suspendSync && !passthroughCheck()) {
			if(hostView.activePage !== remoteView.activePage && typeof hostView.activePage !== "undefined" && hostView.activeAlbum === "" && hostView.activeArtist === "" && hostView.activePlaylist === "") {
				showPage(hostView.activePage);
			}
			if(hostView.activeAlbum !== remoteView.activeAlbum && typeof hostView.activeAlbum !== "undefined" && hostView.activeAlbum !== "") {
				let item = document.getElementById(hostView.activeAlbum);
				if(typeof item !== "undefined" && item.classList.contains("block-item")) {
					item.click();
				}
			}
			if(hostView.activeArtist !== remoteView.activeArtist && typeof hostView.activeArtist !== "undefined" && hostView.activeArtist !== "") {
				let item = document.getElementById(hostView.activeArtist);
				if(typeof item !== "undefined" && item.classList.contains("block-item")) {
					item.click();
				}
			}
			if(hostView.activePlaylist !== remoteView.activePlaylist && typeof hostView.activePlaylist !== "undefined" && hostView.activePlaylist !== "") {
				let item = document.getElementById(hostView.activePlaylist);
				if(typeof item !== "undefined" && item.classList.contains("block-item")) {
					item.click();
				}
			}
		}
	}

	function setView() {
		if(!passthroughCheck()) {
			suspendSync = true;
			let xhr = new XMLHttpRequest();
			xhr.addEventListener("readystatechange", () => {
				if(xhr.readyState === XMLHttpRequest.DONE) {
					let timeout = suspensionTime;
					if(remoteView.activePage === "songs") {
						timeout += 1000;
					}
					setTimeout(() => {
						suspendSync = false;
					}, timeout);
				}
			});
			xhr.open("POST", "/setView", true);
			xhr.setRequestHeader("Content-Type", "application/json");
			xhr.send(JSON.stringify({ view:remoteView }));
		}
	}

	function loopCheck() {
		loop = window.localStorage.getItem("loop");
		if(loop === null) {
			loop = "none";
		}
		svgLoop.setAttribute("class", "loop-icon");
		svgLoop.classList.add("loop-" + loop);
		if(loop === "song") {
			spanLoopIndicator.classList.remove("hidden");
		}
		else {
			spanLoopIndicator.classList.add("hidden");
		}
	}

	function passthroughCheck() {
		let enabled = window.localStorage.getItem("passthrough");
		if(enabled === null || enabled === "false") {
			buttonPassthrough.getElementsByTagName("svg")[0].classList.remove("hidden");
			buttonPassthrough.getElementsByTagName("svg")[1].classList.add("hidden");
			return false;
		}
		else {
			buttonPassthrough.getElementsByTagName("svg")[0].classList.add("hidden");
			buttonPassthrough.getElementsByTagName("svg")[1].classList.remove("hidden");
			return true;
		}
	}

	function enablePassthrough() {
		window.localStorage.setItem("passthrough", "true");
		hideAudioPlayer();
		passthroughCheck();
		showPage("songs");
	}

	function disablePassthrough() {
		window.localStorage.setItem("passthrough", "false");
		hideAudioPlayer();
		passthroughCheck();
		showPage("songs");
	}

	// Used in "passthrough" mode to play songs based on the base64 string sent by the host.
	function processSong(data) {
		audioFile.src = "data:" + data.mime + ";base64," + data.base64;
		audioFile.volume = volume / 100;
		audioFile.load();
		audioFile.play();
		divListview.classList.add("active");
		divAudioBanner.classList.remove("hidden");
		divAudioPlayer.classList.remove("hidden");
		showPause();
	}

	function getInfo() {
		let xhr = new XMLHttpRequest();
		xhr.addEventListener("readystatechange", () => {
			if(xhr.readyState === XMLHttpRequest.DONE) {
				let res = xhr.responseText;
				if(validJSON(res)) {
					res = JSON.parse(res);
					localPort = res.localPort;
					appPort = res.appPort;
					if(validJSON(res.settings)) {
						let settings = JSON.parse(res.settings);
						if(libraryDirectory !== settings.libraryDirectory || res.forceUpdate) {
							hideAudioPlayer();
							libraryDirectory = settings.libraryDirectory;
							getSongs(true, true);
							getPlaylists(true, true);
						}
						volume = parseInt(settings.volume);
						audioFile.volume = settings.volume / 100;
						inputVolume.value = settings.volume;
						setVolumeIcon();
					}
					if(validJSON(res.playlists)) {
						let activePage = document.getElementsByClassName("sidebar-button active")[0];
						if(playlists !== JSON.parse(res.playlists)) {
							playlists = JSON.parse(res.playlists);
							let playlistNames = Object.keys(playlists);
							for(let i = 0; i < playlistNames.length; i++) {
								playlists[playlistNames[i]].indices = [];
							}
							if(activePage.classList.contains("playlists")) {
								showPage("playlists");
							}
						}
					}
				}
			}
		});
		xhr.open("GET", "/getInfo", true);
		xhr.send();
	}

	function getSongs(force, fromInfo) {
		let xhr = new XMLHttpRequest();
		xhr.addEventListener("readystatechange", () => {
			if(xhr.readyState === XMLHttpRequest.DONE) {
				let res = xhr.responseText;
				if(validJSON(res) && res !== "done") {
					if(force && !fromInfo) {
						getInfo();
					}
					divListview.innerHTML = "";
					songs = JSON.parse(res);
					sortSongs();
					showPage("songs");
				}
			}
		});
		xhr.open("POST", "/getSongs", true);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({ force:force }));
	}

	function getPlaylists(force, fromInfo) {
		let xhr = new XMLHttpRequest();
		xhr.addEventListener("readystatechange", () => {
			if(xhr.readyState === XMLHttpRequest.DONE) {
				let res = xhr.responseText;
				if(validJSON(res) && res !== "done") {
					if(force && !fromInfo) {
						getInfo();
					}
					let activePage = document.getElementsByClassName("sidebar-button active")[0];
					if(playlists !== JSON.parse(res)) {
						playlists = JSON.parse(res);
						let playlistNames = Object.keys(playlists);
						for(let i = 0; i < playlistNames.length; i++) {
							playlists[playlistNames[i]].indices = [];
						}
						if(typeof activePage !== "undefined") {
							if(activePage.classList.contains("playlists")) {
								showPage("playlists");
							}
						}
					}
				}
			}
		});
		xhr.open("GET", "/getPlaylists", true);
		xhr.send(JSON.stringify({ force:force }));
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

			let playlistNames = Object.keys(playlists);
			for(let j = 0; j < playlistNames.length; j++) {
				if(playlists[playlistNames[j]].songs.includes(song.file.replace(libraryDirectory.replaceAll("\\", "/"), ""))) {
					playlists[playlistNames[j]].indices.push(index);
				}
			}

			let element = document.createElement("div");
			element.classList.add("list-item");
			element.classList.add("song");
			element.id = song.file;
			element.setAttribute("data-index", index);
			element.innerHTML = '<svg class="play-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7 60.1 72.4 41.3l352-208c31.4-18.5 31.5-64.1 0-82.6z"/></svg><span class="title">' + song.title + '</span><span class="album">' + song.album + '</span><span class="artist">' + song.artist + '</span><span class="duration">' + formatSeconds(song.duration) + '</span>';
			divListview.appendChild(element);

			let playIcon = element.getElementsByClassName("play-icon")[0];

			playIcon.addEventListener("click", () => {
				playSong(song.file, song);
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
				showPage("songs", { songs:albumSongs, album:name });
				remoteView.activeAlbum = name;
				setView();
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
			let text;
			artist.songs.length === 1 ? text = " Song" : text = " Songs";
			element.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 352 512"><path d="M336 192h-16c-8.84 0-16 7.16-16 16v48c0 74.8-64.49 134.82-140.79 127.38C96.71 376.89 48 317.11 48 250.3V208c0-8.84-7.16-16-16-16H16c-8.84 0-16 7.16-16 16v40.16c0 89.64 63.97 169.55 152 181.69V464H96c-8.84 0-16 7.16-16 16v16c0 8.84 7.16 16 16 16h160c8.84 0 16-7.16 16-16v-16c0-8.84-7.16-16-16-16h-56v-33.77C285.71 418.47 352 344.9 352 256v-48c0-8.84-7.16-16-16-16zM176 352c53.02 0 96-42.98 96-96h-85.33c-5.89 0-10.67-3.58-10.67-8v-16c0-4.42 4.78-8 10.67-8H272v-32h-85.33c-5.89 0-10.67-3.58-10.67-8v-16c0-4.42 4.78-8 10.67-8H272v-32h-85.33c-5.89 0-10.67-3.58-10.67-8v-16c0-4.42 4.78-8 10.67-8H272c0-53.02-42.98-96-96-96S80 42.98 80 96v160c0 53.02 42.98 96 96 96z"/></svg><span class="title">' + name + '</span><span class="songs">' + artist.songs.length + text + '</span>';
			divListview.appendChild(element);

			element.addEventListener("click", () => {
				let artistSongs = {};
				for(let i = 0; i < artist.songs.length; i++) {
					artistSongs[artist.songs[i]] = songs[artist.songs[i]];
				}
				showPage("songs", { songs:artistSongs, artist:name });
				remoteView.activeArtist = name;
				setView();
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

		let keys = Object.keys(playlists).sort((a, b) => a.localeCompare(b));
		for(let i = 0; i < keys.length; i ++) {
			let name = keys[i];
			let playlist = playlists[keys[i]];
			let element = document.createElement("div");
			element.id = name;
			element.classList.add("block-item");
			element.classList.add("playlist");
			let text;
			playlist.songs.length === 1 ? text = " Song" : text = " Songs";
			element.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M48 48a48 48 0 1 0 48 48 48 48 0 0 0-48-48zm0 160a48 48 0 1 0 48 48 48 48 0 0 0-48-48zm0 160a48 48 0 1 0 48 48 48 48 0 0 0-48-48zm448 16H176a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h320a16 16 0 0 0 16-16v-32a16 16 0 0 0-16-16zm0-320H176a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h320a16 16 0 0 0 16-16V80a16 16 0 0 0-16-16zm0 160H176a16 16 0 0 0-16 16v32a16 16 0 0 0 16 16h320a16 16 0 0 0 16-16v-32a16 16 0 0 0-16-16z"/></svg><span class="title">' + name + '</span><span class="songs">' + playlist.songs.length + text + '</span></span>';
			divListview.appendChild(element);

			element.addEventListener("click", (e) => {
				let target = e.target;
				if(!target.classList.contains("more-icon-playlist") && !target.classList.contains("more-path-playlist")) {
					if(playlist.songs.length === 0) {
						notify("Error", "That playlist is empty.", "rgb(40,40,40)", 5000);
					}
					else {
						let playlistSongs = {};
						for(let i = 0; i < playlist.indices.length; i++) {
							playlistSongs[playlist.indices[i]] = songs[playlist.indices[i]];
						}
						showPage("songs", { songs:playlistSongs, playlist:name });
						remoteView.activePlaylist = name;
						setView();
					}
				}
			});
		}
	}

	function hideAudioPlayer() {
		currentSong = "";
		audioFile.pause();
		audioFile.src = "";
		audioFile.currentTime = 0;
		divListview.classList.remove("active");
		divAudioBanner.classList.add("hidden");
		divAudioPlayer.classList.add("hidden");
		showPlay();
	}

	function stopSong() {
		let xhr = new XMLHttpRequest();
		xhr.open("GET", "/stopSong", true);
		xhr.send();
	}

	function playSong(file, song) {
		let xhr = new XMLHttpRequest();
		xhr.addEventListener("readystatechange", () => {
			if(xhr.readyState === XMLHttpRequest.DONE) {
				if(passthroughCheck()) {
					let res = xhr.responseText;
					if(validJSON(res)) {
						res = JSON.parse(res);
						processSong(res);
					}
					currentSong = file;
					spanAudioBanner.textContent = song.title + " - " + song.artist + " - " + song.album;
					inputSlider.setAttribute("max", song.duration);
					spanTimeTotal.textContent = formatSeconds(song.duration);
				}
			}
		});
		if(passthroughCheck()) {
			xhr.open("POST", "/playSong", true);
		}
		else {
			xhr.open("POST", "/remotePlaySong", true);
		}
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({ file:file, song:song }));
	}

	function playPreviousSong() {
		if(passthroughCheck()) {
			let listedSongs = document.getElementsByClassName("list-item song");
			let previous = listedSongs[listedSongs.length - 1];
			if(document.getElementById(currentSong).previousSibling !== null) {
				previous = document.getElementById(currentSong).previousSibling;
			}
			playSong(previous.id, songs[previous.getAttribute("data-index")]);
		}
		else {
			let xhr = new XMLHttpRequest();
			xhr.open("GET", "/playPreviousSong", true);
			xhr.send();
		}
	}

	function playNextSong() {
		if(passthroughCheck()) {
			let listedSongs = document.getElementsByClassName("list-item song");
			let next = listedSongs[0];
			if(document.getElementById(currentSong).nextSibling !== null) {
				next = document.getElementById(currentSong).nextSibling;
			}
			playSong(next.id, songs[next.getAttribute("data-index")]);
		}
		else {
			let xhr = new XMLHttpRequest();
			xhr.open("GET", "/playNextSong", true);
			xhr.send();
		}
	}

	function repeatSong() {
		let current = document.getElementById(currentSong);
		playSong(current.id, songs[current.getAttribute("data-index")]);
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
				let elements = document.getElementsByClassName("block-item playlist");
				for(let i = 0; i < elements.length; i++) {
					let element = elements[i];
					let title = element.getElementsByClassName("title")[0].textContent.toLowerCase();
					if(!title.includes(query)) {
						element.style.display = "none";
					}
				}
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

	function setVolumeIcon() {
		if(volume === 0 && svgNoVolume.classList.contains("hidden")) {
			svgNoVolume.classList.remove("hidden");
			svgLowVolume.classList.add("hidden");
			svgHighVolume.classList.add("hidden");
		}
		else if(volume >= 1 && volume <= 55 && svgLowVolume.classList.contains("hidden")) {
			svgLowVolume.classList.remove("hidden");
			svgNoVolume.classList.add("hidden");
			svgHighVolume.classList.add("hidden");
		}
		else if(volume > 55 && svgHighVolume.classList.contains("hidden")) {
			svgHighVolume.classList.remove("hidden");
			svgLowVolume.classList.add("hidden");
			svgNoVolume.classList.add("hidden");
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

	function showPage(page, args) {
		remoteView.activePage = page;
		remoteView.activeAlbum = (typeof args !== "undefined") ? (typeof args.album !== "undefined") ? args.album : "" : "";
		remoteView.activeArtist = (typeof args !== "undefined") ? (typeof args.artist !== "undefined") ? args.artist : "" : "";
		remoteView.activePlaylist = (typeof args !== "undefined") ? (typeof args.playlist !== "undefined") ? args.playlist : "" : "";
		setView();

		buttonSongs.classList.remove("active");
		buttonAlbums.classList.remove("active");
		buttonArtists.classList.remove("active");
		buttonPlaylists.classList.remove("active");

		divListview.style.display = "none";

		inputSearch.value = "";

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
			inputSearch.classList.add("hidden");
		}

		divListview.scrollTop = 0;
		divListview.scrollTo(0, 0);

		document.getElementsByClassName("sidebar-button " + page)[0].classList.add("active");
	}

	function notify(title, description, color, duration) {
		let area;
		if(document.getElementsByClassName("notification-area").length === 0) {
			area = document.createElement("div");
			area.classList.add("notification-area");
			area.classList.add("noselect");
			document.body.appendChild(area);
		}
		else {
			area = document.getElementsByClassName("notification-area")[0];
		}
		let notification = document.createElement("div");
		notification.classList.add("notification-wrapper");
		notification.innerHTML = '<div class="notification-bubble" style="background:' + color + ';"><div class="notification-title-wrapper"><span class="notification-title">' + title + '</span></div><div class="notification-description-wrapper"><span class="notification-description">' + description + '</span></div></div>';
		area.appendChild(notification);

		notification.style.height = notification.scrollHeight + "px";
		notification.style.visibility = "visible";
		notification.getElementsByClassName("notification-bubble")[0].style.right = "20px";
		setTimeout(function() {
			notification.getElementsByClassName("notification-bubble")[0].style.right = "-600px";
			setTimeout(function() {
				notification.remove();
				if(area.innerHTML === "") {
					area.remove();
				}
			}, 500);
		}, duration);
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