document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing app.js...");

    // Check if AlphaTab library is loaded
    if (typeof alphaTab === 'undefined') {
        console.error("AlphaTab library is NOT loaded! Check the script tag in your HTML.");
        alert("Error: AlphaTab library could not be loaded. The player will not work.");
        return; // Stop initialization if AlphaTab is missing
    } else {
        console.log("AlphaTab library found.");
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

    let alphaTabApi = null;
    let musicFiles = []; // This will store the File objects from the input
    let selectedFileObject = null; // The actual File object being processed

    // --- File Handling ---
    fileInput.addEventListener('change', handleFileSelection);
    console.log("File input event listener attached.");

    function handleFileSelection(event) {
        console.log("handleFileSelection triggered.");
        fileListDisplay.innerHTML = ''; // Clear previous list
        const allSelectedFiles = Array.from(event.target.files);
        console.log(`User selected ${allSelectedFiles.length} file(s) in dialog.`);

        musicFiles = allSelectedFiles.filter(file =>
            file.name.toLowerCase().endsWith('.xml') || file.name.toLowerCase().endsWith('.musicxml')
        );
        console.log(`Found ${musicFiles.length} MusicXML file(s) among selected.`);

        if (musicFiles.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No MusicXML files selected.';
            fileListDisplay.appendChild(li);
            currentSongTitle.textContent = 'No MusicXML files found.';
            resetPlayer();
            console.log("No MusicXML files found or selected.");
            return;
        }

        // If only one MusicXML file is selected, load it automatically.
        if (musicFiles.length === 1) {
            console.log("One MusicXML file selected, attempting to load automatically:", musicFiles[0].name);
            const li = document.createElement('li'); // Still create list item for visual feedback
            li.textContent = musicFiles[0].name;
            fileListDisplay.appendChild(li);
            loadAndDisplayFile(musicFiles[0], li);
        } else {
            // If multiple MusicXML files, list them and require a click.
            console.log("Multiple MusicXML files selected, listing them. User needs to click to load.");
            musicFiles.forEach((file) => { // No need for index here for dataset.fileIndex if 'file' object is passed directly
                const li = document.createElement('li');
                li.textContent = file.name;
                li.addEventListener('click', () => {
                    console.log(`List item clicked for file: ${file.name}`);
                    loadAndDisplayFile(file, li);
                });
                fileListDisplay.appendChild(li);
            });
        }
    }

    async function loadAndDisplayFile(fileToLoad, listItem) {
        console.log(`loadAndDisplayFile called for: ${fileToLoad ? fileToLoad.name : 'undefined file'}`);
        if (!fileToLoad) {
            console.error("loadAndDisplayFile: fileToLoad is undefined.");
            currentSongTitle.textContent = `Error: No file provided to load.`;
            return;
        }
        selectedFileObject = fileToLoad;

        // Update active item in the list
        document.querySelectorAll('#fileList li').forEach(li => li.classList.remove('active'));
        if (listItem) {
            listItem.classList.add('active');
            console.log(`Set list item "${listItem.textContent}" as active.`);
        } else {
            // If loaded automatically, find the corresponding list item to mark active (if exists)
            const items = Array.from(fileListDisplay.children);
            const itemToActivate = items.find(item => item.textContent === fileToLoad.name);
            if (itemToActivate) {
                itemToActivate.classList.add('active');
                console.log(`Automatically loaded file, set list item "${itemToActivate.textContent}" as active.`);
            }
        }


        currentSongTitle.textContent = `Loading: ${selectedFileObject.name}...`;
        partsListContainer.innerHTML = '<p>Loading score data...</p>';
        playPauseButton.disabled = true;
        stopButton.disabled = true;
        musicDisplayFallback.style.display = 'none';
        alphaTabSurface.style.display = 'block'; // Make sure surface is visible
        console.log("UI prepared for loading.");

        try {
            console.log("Attempting to read file as ArrayBuffer...");
            const fileBuffer = await readFileAsArrayBuffer(selectedFileObject);
            console.log("File read successfully. ArrayBuffer length:", fileBuffer.byteLength);

            if (alphaTabApi) {
                console.log("Existing AlphaTab API instance found, attempting to clean up...");
                // Proper disposal might be needed if AlphaTab provides a `destroy` or `dispose` method.
                // For now, re-initializing is often okay for simpler cases.
                // alphaTabApi.destroy(); // If available
                alphaTabApi = null; // Dereference to allow garbage collection
                alphaTabSurface.innerHTML = ''; // Clear previous score
                console.log("Previous AlphaTab instance cleared.");
            }

            const settings = {
                file: fileBuffer,
                player: {
                    enablePlayer: true,
                    enableUserInteraction: true,
                    soundFont: "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2",
                    scrollElement: alphaTabSurface.parentElement,
                },
                // layout: { layoutMode: 'page' } // Example layout setting
            };
            console.log("AlphaTab settings prepared:", settings);

            alphaTabSurface.innerHTML = ''; // Ensure container is empty before AlphaTab takes over
            console.log("Initializing new AlphaTab API instance...");
            alphaTabApi = new alphaTab.AlphaTabApi(alphaTabSurface, settings);
            console.log("AlphaTab API instance created.");

            alphaTabApi.scoreLoaded.on(score => {
                console.log("AlphaTab event: scoreLoaded", score);
                if (score) {
                    currentScoreTracks = score.tracks;
                    currentSongTitle.textContent = `${score.title || 'Untitled Score'} - ${score.artist || 'Unknown Artist'}`;
                    setupAlphaTabPartControls(score.tracks);
                    setupAlphaTabPlayerControls(); // Re-setup or update player controls
                    playPauseButton.disabled = false;
                    stopButton.disabled = false;
                    // Apply initial master volume and cents from sliders
                    if (alphaTabApi && alphaTabApi.player) {
                         alphaTabApi.player.masterVolume = parseFloat(masterVolumeSlider.value);
                         alphaTabApi.player.masterTune = parseInt(masterCentsSlider.value);
                         console.log(`Initial masterVolume set to ${masterVolumeSlider.value}, masterTune to ${masterCentsSlider.value}`);
                    }
                } else {
                    console.error("AlphaTab event: scoreLoaded - but score object is null/undefined!");
                     currentSongTitle.textContent = `Error: Failed to properly load score data from ${selectedFileObject.name}.`;
                     resetPlayer();
                }
            });

            alphaTabApi.playerStateChanged.on(e => {
                console.log("AlphaTab event: playerStateChanged", e);
                playPauseButton.textContent = e.state === alphaTab.model.PlayerState.Playing ? 'Pause' : 'Play';
            });

            alphaTabApi.renderFinished.on(() => {
                console.log("AlphaTab event: renderFinished. Score should be visible.");
            });

            alphaTabApi.playerFinished.on(() => {
                console.log("AlphaTab event: playerFinished.");
                playPauseButton.textContent = 'Play';
            });

            alphaTabApi.error.on((e) => {
                console.error("AlphaTab reported an error:", e);
                let errorMessage = "An error occurred with AlphaTab.";
                if (e && e.message) {
                    errorMessage = e.message;
                } else if (typeof e === 'string') {
                    errorMessage = e;
                }
                // Attempt to provide more specific info based on error type if possible
                if (e && e.type === 'SoundFontLoad') {
                    errorMessage = "Error loading SoundFont. Check network connection and SoundFont URL.";
                } else if (e && e.type === 'ScoreLoad') {
                    errorMessage = `Error loading the score: ${selectedFileObject.name}. It might be corrupted or not a supported MusicXML format.`;
                }
                currentSongTitle.textContent = `Error: ${errorMessage}`;
                alert(`AlphaTab Error: ${errorMessage}`); // Also show an alert
                resetPlayer();
            });


        } catch (error) {
            console.error('Critical error in loadAndDisplayFile:', error);
            currentSongTitle.textContent = `Error processing file: ${error.message}. See console.`;
            alert(`Error: ${error.message}. Please check the console for more details.`);
            alphaTabSurface.style.display = 'none';
            musicDisplayFallback.style.display = 'block';
            musicDisplayFallback.innerHTML = `<p>Error loading ${selectedFileObject ? selectedFileObject.name : 'file'}. Check console for details.</p>`;
            resetPlayer();
        }
    }

    function readFileAsArrayBuffer(file) {
        console.log(`readFileAsArrayBuffer called for ${file.name}`);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => {
                console.log(`File ${file.name} read successfully into ArrayBuffer.`);
                resolve(event.target.result);
            };
            reader.onerror = error => {
                console.error(`FileReader error for ${file.name}:`, error);
                reject(error);
            };
            reader.readAsArrayBuffer(file);
        });
    }

    function resetPlayer() {
        console.log("resetPlayer called.");
        if (alphaTabApi) {
            console.log("Attempting to clean up existing AlphaTab API in resetPlayer.");
            // If AlphaTab has a dispose/destroy method, call it here.
            // alphaTabApi.dispose(); or alphaTabApi.destroy();
            // For now, just nullify and clear the surface.
            alphaTabApi = null;
        }
        alphaTabSurface.innerHTML = '';
        alphaTabSurface.style.display = 'none';
        musicDisplayFallback.style.display = 'block';
        musicDisplayFallback.innerHTML = '<p>Select a file to display and play.</p>';
        partsListContainer.innerHTML = '<p>Load a score to see individual parts.</p>';
        playPauseButton.disabled = true;
        playPauseButton.textContent = 'Play';
        stopButton.disabled = true;
        currentSongTitle.textContent = 'No file selected';
        currentScoreTracks = [];
        selectedFileObject = null;
         // Clear the file input visually, though this doesn't reset its internal state fully in all browsers.
        // fileInput.value = null; // This can be problematic / have side effects. Optional.
        console.log("Player UI reset.");
    }


    // --- AlphaTab Part Controls ---
    function setupAlphaTabPartControls(tracks) {
        console.log("setupAlphaTabPartControls called with tracks:", tracks);
        partsListContainer.innerHTML = '';

        if (!tracks || tracks.length === 0) {
            partsListContainer.innerHTML = '<p>No parts (tracks) found in this score.</p>';
            console.log("No tracks found to set up controls.");
            return;
        }
        console.log(`Setting up controls for ${tracks.length} tracks.`);

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
        console.log("Part controls UI created.");
    }

    function toggleMuteTrack(track, button) {
        if (!alphaTabApi || !track || !track.playbackInfo) {
            console.error("Cannot toggle mute: AlphaTab API or track/playbackInfo missing.");
            return;
        }
        track.playbackInfo.isMute = !track.playbackInfo.isMute;
        button.textContent = track.playbackInfo.isMute ? 'Unmute' : 'Mute';
        console.log(`Track "${track.name}" mute toggled to: ${track.playbackInfo.isMute}`);
        // AlphaTab usually picks up playbackInfo changes automatically for subsequent playback actions.
        // If real-time update during playback is needed and not happening, an explicit player update might be required.
    }

    let highlightedPartControlDiv = null;
    function toggleHighlightPartControl(partDiv, track) {
        console.log(`toggleHighlightPartControl for track: ${track.name}`);
        if (highlightedPartControlDiv === partDiv) { // If already highlighted, unhighlight it
            partDiv.classList.remove('part-control-highlighted');
            highlightedPartControlDiv = null;
            console.log(`Track "${track.name}" UI highlight removed.`);
            // TODO: Advanced - Remove actual score highlight if implemented
        } else { // Highlight this part, and unhighlight any other
            if (highlightedPartControlDiv) {
                highlightedPartControlDiv.classList.remove('part-control-highlighted');
            }
            partDiv.classList.add('part-control-highlighted');
            highlightedPartControlDiv = partDiv;
            console.log(`Track "${track.name}" UI highlight added.`);
            // TODO: Advanced - Implement actual score highlighting for this track.
        }
    }

    function setTrackVolume(track, volume) {
        if (!alphaTabApi || !track || !track.playbackInfo) {
            console.error("Cannot set track volume: AlphaTab API or track/playbackInfo missing.");
            return;
        }
        track.playbackInfo.volume = volume;
        // console.log(`Track "${track.name}" volume set to: ${volume}`); // Can be noisy
    }


    // --- AlphaTab Master Player Controls ---
    // This function should be called once after AlphaTab is initialized with a score.
    function setupAlphaTabPlayerControls() {
        console.log("setupAlphaTabPlayerControls called.");
        if (!alphaTabApi || !alphaTabApi.player) {
            console.error("Cannot setup player controls: AlphaTab API or player not ready.");
            return;
        }

        // Ensure event listeners are not duplicated if this function is called multiple times
        // A simple way is to reassign onclick, or use removeEventListener before adding.
        // For sliders, 'input' listeners are typically fine to re-add if the element is the same,
        // but good practice is to manage them. For this example, direct assignment is simpler.

        masterVolumeSlider.oninput = (event) => { // Using oninput to replace previous if any
            if (alphaTabApi && alphaTabApi.player) {
                alphaTabApi.player.masterVolume = parseFloat(event.target.value);
            }
        };
        // Set initial value just in case from slider
        alphaTabApi.player.masterVolume = parseFloat(masterVolumeSlider.value);

        masterCentsSlider.oninput = (event) => { // Using oninput
            if (alphaTabApi && alphaTabApi.player) {
                const cents = parseInt(event.target.value);
                alphaTabApi.player.masterTune = cents;
                centsValueDisplay.textContent = `${cents} cents`;
            }
        };
        // Set initial value
        const initialCents = parseInt(masterCentsSlider.value);
        alphaTabApi.player.masterTune = initialCents;
        centsValueDisplay.textContent = `${initialCents} cents`;

        setA440Button.onclick = () => {
            if (alphaTabApi && alphaTabApi.player) {
                masterCentsSlider.value = 0;
                alphaTabApi.player.masterTune = 0;
                centsValueDisplay.textContent = `0 cents`;
                console.log("Tuning set to A=440Hz (0 cents)");
            }
        };

        setA415Button.onclick = () => {
            if (alphaTabApi && alphaTabApi.player) {
                const a415cents = -101;
                masterCentsSlider.value = a415cents; // Update slider
                alphaTabApi.player.masterTune = a415cents;
                centsValueDisplay.textContent = `${a415cents} cents`;
                console.log(`Tuning set to A=415Hz (${a415cents} cents)`);
            }
        };

        playPauseButton.onclick = () => {
            if (alphaTabApi && alphaTabApi.player) {
                console.log("Play/Pause button clicked.");
                alphaTabApi.player.playPause();
            } else {
                console.warn("Play/Pause clicked, but API or player not ready.");
            }
        };

        stopButton.onclick = () => {
            if (alphaTabApi && alphaTabApi.player) {
                console.log("Stop button clicked.");
                alphaTabApi.player.stop();
            } else {
                console.warn("Stop clicked, but API or player not ready.");
            }
        };
        console.log("Master player controls event listeners reassigned/set.");
    }

    // Initial state setup
    resetPlayer();
    console.log("Initial player reset complete.");
});
