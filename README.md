# X:/Music

X:/Music is a Node.js based music player for desktop operating systems (Windows, macOS, and Linux).

### How's it different from any other music player?

The default music players of different operating systems are entirely different from one another, whereas X:/Music is identical on all platforms, and also has a web interface for other devices on the same network, so you can control your media from anywhere in your house using your phone or any other device with access to the web.

### Can I import my existing music library?

Yes, you can. Through X:/Music's settings, you can change the location of your music library to wherever your current one is. You won't be able to import playlists (this feature might be added in the future) or any ratings. X:/Music simply searches the entire directory and its subdirectories for MP3, WAV, and OGG files, so you can easily add new songs and move around your library by simply dropping files that have the same type as the three aforementioned ones, and it'll automatically get added to your music library.

### Does X:/Music read and display the metadata of audio files?

The song's title, artist, album, and duration are read and displayed. To keep it lightweight, and to ensure the UI's consistency, album artwork will not be displayed. Due to Node.js' limited number of libraries regarding the reading and writing of metadata, and complications with cross-platform compatibility, the metadata of audio files will not be editable, and will only be read/used in a very limited way.

### What should I do if I encounter a bug?

If you encounter a bug, it'll most likely be due to something being wrong with the data files, which are "settings.json" and "playlists.json", both of which can be safely deleted (though this would reset both your settings in the app, and your playlists). If you manage to get a screenshot of the error, please contact me and include information such as what operating system you were using, what you were doing when you got the error, and if possible, the steps required to reproduce the bug.

### Is this secure?

It should be, yes. On the server-side, there aren't any shell commands or any user input that could be used to gain access to anything X:/Music shouldn't have access to. For security reasons, audio files cannot be deleted or modified in any way through the app. The only files X:/Music writes to are the "settings.json" and "playlists.json" files in the "data" directory. Besides that, X:/Music doesn't write data anywhere else on the OS, and as far as reading is concerned, only MP3, WAV, and OGG files are supported, so it shouldn't be possible to trick it into reading other file types unless the server-side code is modified. 

## Download

|Platform|Download Link|
|-------------|------------------|
|**Mac**|https://github.com/Xtrendence/X-Music/releases/download/V1.0.0/Mac-X-Music-1.0.0.dmg|
|**Linux**|https://github.com/Xtrendence/X-Music/releases/download/V1.0.0/Linux-X-Music-1.0.0.AppImage|
|**Windows**|https://github.com/Xtrendence/X-Music/releases/download/V1.0.0/Windows-X-Music.Setup.1.0.0.exe|

*Please note that on Mac it might say that the application can't be opened because it's from an unidentified developer. To fix this, simply open **System Preferences**, go to **Security & Privacy**, click on the **General** tab, and find the **Open Anyway** button at the bottom of the page.*

![X:/Music](https://i.imgur.com/ZzB0vN3.png)
