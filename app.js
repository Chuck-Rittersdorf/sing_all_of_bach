document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing app.js...");

    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        try {
            // Display time in CEST (Utrecht's timezone)
            const now = new Date();
            timeElement.textContent = new Intl.DateTimeFormat('en-GB', {
                dateStyle: 'full',
                timeStyle: 'long',
                timeZone: 'Europe/Amsterdam' // Utrecht is in this timezone (CEST/CET)
            }).format(now);
        } catch (e) {
            timeElement.textContent = new Date().toString(); // Fallback
            console.warn("Could not display time in CEST, using browser default.", e);
        }
    }

    if (typeof alphaTab === 'undefined') {
        console.error("AlphaTab library is NOT loaded! Check the script tag in your HTML and network tab for AlphaTab JS file.");
        alert("Error: AlphaTab library could not be loaded. The player will not work. Please check browser console (F12) -> Network tab for errors loading 'alphaTab.js' from CDN.");
        return; 
    } else {
        console.log("AlphaTab library object found. Version (if available via API):", alphaTab.version || "Not exposed in this version object");
    }

    const fileInput = document.getElementById('fileInput');
    const fileListDisplay = document.getElementById('fileList');
    const currentSongTitle = document.getElementById('current-song-title');
    const alphaTabSurface = document.getElementById('alphaTabSurface');
    const musicDisplayFallback = document.getElementById('music-display-fallback');
    const partsListContainer = document.getElementById('parts-list-container');

    const masterVolumeSlider = document.getElementById('masterVolume');
    const masterCentsSlider = document.getElementById('masterCents');
    const centsValueDisplay = document.getElementById('centsValue');
    const setA440Button = document.getElementById('setA440');
    const setA415Button = document.getElementById('setA415');
    const playPauseButton = document.getElementById('playPauseButton');
    const stopButton = document.getElementById('stopButton');
    const loadTestFileButton = document.getElementById('loadTestFileButton');

    let alphaTabApi = null;
    let musicFilesFromInput = [];

    fileInput.addEventListener('change', handleFileSelection);
    console.log("File input event listener attached.");

    if (loadTestFileButton) {
        loadTestFileButton.addEventListener('click', () => {
            const testFilePath = 'examples/Jesu_nun_sei.mxl'; 
            const testFileName = 'Jesu, nun sei (Test File)';
            console.log(`"Load Test File" button clicked. Attempting to load: ${testFilePath}`);
            loadAndProcessFileFromPath(testFilePath, testFileName);
        });
        console.log("Test file button event listener attached.");
    } else {
        console.warn("Test file button not found in HTML.");
    }

    function handleFileSelection(event) {
        console.log("handleFileSelection triggered.");
        fileListDisplay.innerHTML = '';
        const allSelectedFiles = Array.from(event.target.files);
        console.log(`User selected ${allSelectedFiles.length} file(s) in dialog.`);

        musicFilesFromInput = allSelectedFiles.filter(file =>
            file.name.toLowerCase().endsWith('.xml') || file.name.toLowerCase().endsWith('.musicxml') || file.name.toLowerCase().endsWith('.mxl')
        );
        console.log(`Found ${musicFilesFromInput.length} compatible file(s) among selected.`);

        if (musicFilesFromInput.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No compatible files selected (XML, MusicXML, MXL).';
            fileListDisplay.appendChild(li);
            currentSongTitle.textContent = 'No compatible files found.';
            resetPlayerUiOnly();
            return;
        }

        if (musicFilesFromInput.length === 1) {
            console.log("One file selected, attempting to load automatically:", musicFilesFromInput[0].name);
            const li = document.createElement('li');
            li.textContent = musicFilesFromInput[0].name;
            fileListDisplay.appendChild(li);
            readFileObjectAndProcess(musicFilesFromInput[0], li);
        } else {
            console.log("Multiple files selected, listing them. User needs to click to load.");
            musicFilesFromInput.forEach((file) => {
                const li = document.createElement('li');
                li.textContent = file..name;
                li.addEventListener('click', () => {
                    console.log(`List item clicked for file: ${file.name}`);
                    readFileObjectAndProcess(file, li);
                });
                fileListDisplay.appendChild(li);
            });
        }
    }

    async function readFileObjectAndProcess(fileObject, listItem) {
        console.log(`readFileObjectAndProcess called for: ${fileObject.name}`);
        document.querySelectorAll('#fileList li').forEach(li => li.classList.remove('active'));
        if (listItem) {
            listItem.classList.add('active');
        } else {
             const items = Array.from(fileListDisplay.children);
             const itemToActivate = items.find(item => item.textContent === fileObject.name);
             if (itemToActivate) itemToActivate.classList.add('active');
        }

        try {
            const fileBuffer = await readFileAsArrayBuffer(fileObject);
            await processAndDisplayScore(fileBuffer, fileObject.name);
        } catch (error) {
            console.error(`Error reading file object ${fileObject.name}:`, error);
            currentSongTitle.textContent = `Error reading file: ${error.message}. See console.`;
            alert(`Error reading file ${fileObject.name}: ${error.message}`);
            musicDisplayFallback.innerHTML = `<p>Error reading ${fileObject.name}.</p>`;
            musicDisplayFallback.style.display = 'block';
            alphaTabSurface.style.display = 'none';
        }
    }

    async function loadAndProcessFileFromPath(filePath, displayFileName) {
        console.log(`loadAndProcessFileFromPath: Fetching ${filePath}`);
        fileListDisplay.innerHTML = '';
        document.querySelectorAll('#fileList li').forEach(li => li.classList.remove('active'));
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} while fetching ${filePath}`);
            }
            const fileBuffer = await response.arrayBuffer();
            console.log(`Workspaceed ${filePath} successfully. Buffer size: ${fileBuffer.byteLength}`);
            await processAndDisplayScore(fileBuffer, displayFileName);
        } catch (error) {
            console.error(`Error fetching or processing file from path ${filePath}:`, error);
            currentSongTitle.textContent = `Error loading test file: ${error.message}. See console.`;
            alert(`Error loading test file: ${error.message}`);
            musicDisplayFallback.innerHTML = `<p>Could not load test file: ${filePath}. Ensure it exists and the path is correct. Check console for errors (like 404 Not Found).</p>`;
            musicDisplayFallback.style.display = 'block';
            alphaTabSurface.style.display = 'none';
            resetPlayerUiOnly();
        }
    }

    async function processAndDisplayScore(fileBuffer, fileNameToDisplay) {
        console.log(`processAndDisplayScore called for: ${fileNameToDisplay}`);
        currentSongTitle.textContent = `Loading: ${fileNameToDisplay}...`;
        partsListContainer.innerHTML = '<p>Loading score data...</p>';
        playPauseButton.disabled = true;
        stopButton.disabled = true;
        musicDisplayFallback.style.display = 'none';
        alphaTabSurface.style.display = 'block';
        console.log("UI prepared for loading score.");

        try {
            if (alphaTabApi) {
                console.log("Existing AlphaTab API instance found, cleaning up...");
                if (typeof alphaTabApi.destroy === 'function') { 
                    alphaTabApi.destroy();
                    console.log("Called alphaTabApi.destroy()");
                }
                alphaTabApi = null;
                alphaTabSurface.innerHTML = ''; 
                console.log("Previous AlphaTab instance artifacts cleared.");
            }

            const settings = {
                file: fileBuffer,
                player: {
                    enablePlayer: true,
                    enableUserInteraction: true,
                    // Updated to specific version 1.5.0
                    soundFont: "https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.5.0/dist/soundfont/sonivox.sf2", 
                    scrollElement: alphaTabSurface.parentElement, 
                },
            };
            console.log("AlphaTab settings prepared:", settings);

            alphaTabSurface.innerHTML = ''; 
            console.log("Initializing new AlphaTab API instance...");
            alphaTabApi = new alphaTab.AlphaTabApi(alphaTabSurface, settings);
            console.log("AlphaTab API instance created.");

            alphaTabApi.error.on((e) => {
                console.error("AlphaTab reported an error:", e);
                let errorMessage = "An error occurred with AlphaTab.";
                if (e && e.message) {
                    errorMessage = e.message;
                } else if (typeof e === 'string') {
                    errorMessage = e;
                }
                if (e && e.type === 'SoundFontLoad') {
                    errorMessage = "Error loading SoundFont. Check network and SoundFont URL.";
                } else if (e && e.type === 'ScoreLoad') {
                    errorMessage = `Error loading the score data for: ${fileNameToDisplay}. It might be corrupted or not a supported format.`;
                }
                currentSongTitle.textContent = `AlphaTab Error: ${errorMessage}`;
                alert(`AlphaTab Error: ${errorMessage}`);
                resetPlayerUiOnly();
                alphaTabSurface.style.display = 'none';
                musicDisplayFallback.innerHTML = `<p>AlphaTab Error: ${errorMessage}</p>`;
                musicDisplayFallback.style.display = 'block';
            });

            alphaTabApi.scoreLoaded.on(score => {
                console.log("AlphaTab event: scoreLoaded", score);
                if (score) {
                    currentSongTitle.textContent = `${score.title || fileNameToDisplay} - ${score.artist || 'Unknown Artist'}`;
                    setupAlphaTabPartControls(score.tracks);
                    setupAlphaTabPlayerControls();
                    playPauseButton.disabled = false;
                    stopButton.disabled = false;
                    if (alphaTabApi && alphaTabApi.player) {
                         alphaTabApi.player.masterVolume = parseFloat(masterVolumeSlider.value);
                         alphaTabApi.player.masterTune = parseInt(masterCentsSlider.value);
                    }
                } else {
                    console.error("AlphaTab event: scoreLoaded - but score object is null/undefined!");
                    currentSongTitle.textContent = `Error: Failed to properly parse score data from ${fileNameToDisplay}.`;
                    resetPlayerUiOnly();
                }
            });

            alphaTabApi.playerStateChanged.on(e => {
                console.log("AlphaTab event: playerStateChanged, New state:", e.state);
                playPauseButton.textContent = e.state === alphaTab.model.PlayerState.Playing ? 'Pause' : 'Play';
            });

            alphaTabApi.renderFinished.on(() => {
                console.log("AlphaTab event: renderFinished. Score should be visible.");
            });

            alphaTabApi.playerFinished.on(() => {
                console.log("AlphaTab event: playerFinished.");
                playPauseButton.textContent = 'Play';
            });

        } catch (error) {
            console.error(`Critical error in processAndDisplayScore for ${fileNameToDisplay}:`, error);
            currentSongTitle.textContent = `Error processing score: ${error.message}. See console.`;
            alert(`Error processing score ${fileNameToDisplay}: ${error.message}.`);
            alphaTabSurface.style.display = 'none';
            musicDisplayFallback.style.display = 'block';
            musicDisplayFallback.innerHTML = `<p>Error processing ${fileNameToDisplay}.</p>`;
            resetPlayerUiOnly();
        }
    }

    function readFileAsArrayBuffer(fileObject) {
        console.log(`readFileAsArrayBuffer called for ${fileObject.name}`);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => {
                console.log(`File ${fileObject.name} read successfully into ArrayBuffer.`);
                resolve(event.target.result);
            };
            reader.onerror = error => {
                console.error(`FileReader error for ${fileObject.name}:`, error);
                reject(error);
            };
            reader.readAsArrayBuffer(fileObject);
        });
    }

    function resetPlayerUiOnly() {
        console.log("resetPlayerUiOnly called.");
        alphaTabSurface.innerHTML = ''; 
        alphaTabSurface.style.display = 'none';
        musicDisplayFallback.style.display = 'block';
        musicDisplayFallback.innerHTML = '<p>Select a file or load test file.</p>';
        partsListContainer.innerHTML = '<p>Load a score to see individual parts.</p>';
        playPauseButton.disabled = true;
        playPauseButton.textContent = 'Play';
        stopButton.disabled = true;
        currentSongTitle.textContent = 'No file loaded';
    }
    
    resetPlayerUiOnly(); 
    console.log("Initial player UI reset complete.");

    function setupAlphaTabPartControls(tracks) {
        partsListContainer.innerHTML = '';
        if (!tracks || tracks.length === 0) {
            partsListContainer.innerHTML = '<p>No parts (tracks) found in this score.</p>';
            return;
        }
        tracks.forEach((track, index) => {
            const partDiv = document.createElement('div');
            partDiv.classList.add('part-controls-item');
            partDiv.dataset.trackIndex = index;
            const title = document.createElement('h4');
            title.textContent = track.name || `Track ${index + 1}`;
            partDiv.appendChild(title);
            const muteButton = document.createElement('button');
            muteButton.textContent = track.playbackInfo.isMute ? 'Unmute' : 'Mute';
            muteButton.addEventListener('click', () => toggleMuteTrack(track, muteButton));
            partDiv.appendChild(muteButton);
            const highlightButton = document.createElement('button');
            highlightButton.textContent = 'Highlight';
            highlightButton.addEventListener('click', () => toggleHighlightPartControl(partDiv, track));
            partDiv.appendChild(highlightButton);
            const volumeLabel = document.createElement('label');
            volumeLabel.textContent = 'Volume:';
            volumeLabel.htmlFor = `volume-track-${index}`;
            const volumeSlider = document.createElement('input');
            volumeSlider.type = 'range';
            volumeSlider.id = `volume-track-${index}`;
            volumeSlider.min = '0';
            volumeSlider.max = '1';
            volumeSlider.step = '0.01';
            volumeSlider.value = track.playbackInfo.volume;
            volumeSlider.addEventListener('input', (e) => setTrackVolume(track, parseFloat(e.target.value)));
            partDiv.appendChild(volumeLabel);
            partDiv.appendChild(volumeSlider);
            partsListContainer.appendChild(partDiv);
        });
    }

    function toggleMuteTrack(track, button) {
        if (!alphaTabApi || !track || !track.playbackInfo) return;
        track.playbackInfo.isMute = !track.playbackInfo.isMute;
        button.textContent = track.playbackInfo.isMute ? 'Unmute' : 'Mute';
    }

    let highlightedPartControlDiv = null;
    function toggleHighlightPartControl(partDiv, track) {
        if (highlightedPartControlDiv === partDiv) { 
            partDiv.classList.remove('part-control-highlighted');
            highlightedPartControlDiv = null;
        } else { 
            if (highlightedPartControlDiv) {
                highlightedPartControlDiv.classList.remove('part-control-highlighted');
            }
            partDiv.classList.add('part-control-highlighted');
            highlightedPartControlDiv = partDiv;
        }
    }

    function setTrackVolume(track, volume) {
        if (!alphaTabApi || !track || !track.playbackInfo) return;
        track.playbackInfo.volume = volume;
    }

    function setupAlphaTabPlayerControls() {
        if (!alphaTabApi || !alphaTabApi.player) {
            console.error("Cannot setup player controls: AlphaTab API or player not ready.");
            playPauseButton.disabled = true;
            stopButton.disabled = true;
            return;
        }
        playPauseButton.disabled = false;
        stopButton.disabled = false;

        masterVolumeSlider.oninput = (event) => {
            if (alphaTabApi && alphaTabApi.player) {
                alphaTabApi.player.masterVolume = parseFloat(event.target.value);
            }
        };
        if (alphaTabApi.player) alphaTabApi.player.masterVolume = parseFloat(masterVolumeSlider.value);

        masterCentsSlider.oninput = (event) => {
            if (alphaTabApi && alphaTabApi.player) {
                const cents = parseInt(event.target.value);
                alphaTabApi.player.masterTune = cents;
                centsValueDisplay.textContent = `${cents} cents`;
            }
        };
        const initialCents = parseInt(masterCentsSlider.value);
        if (alphaTabApi.player) {
            alphaTabApi.player.masterTune = initialCents;
            centsValueDisplay.textContent = `${initialCents} cents`;
        }

        setA440Button.onclick = () => {
            if (alphaTabApi && alphaTabApi.player) {
                masterCentsSlider.value = 0;
                alphaTabApi.player.masterTune = 0;
                centsValueDisplay.textContent = `0 cents`;
            }
        };

        setA415Button.onclick = () => {
            if (alphaTabApi && alphaTabApi.player) {
                const a415cents = -101;
                masterCentsSlider.value = a415cents;
                alphaTabApi.player.masterTune = a415cents;
                centsValueDisplay.textContent = `${a415cents} cents`;
            }
        };

        playPauseButton.onclick = () => {
            if (alphaTabApi && alphaTabApi.player) alphaTabApi.player.playPause();
        };

        stopButton.onclick = () => {
            if (alphaTabApi && alphaTabApi.player) alphaTabApi.player.stop();
        };
    }
});
