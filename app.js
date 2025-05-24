document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const fileListDisplay = document.getElementById('fileList');
    const currentSongTitle = document.getElementById('current-song-title');
    const musicDisplay = document.getElementById('music-display'); // Where OSMD or similar would render
    const partsListContainer = document.getElementById('parts-list-container');

    const masterVolumeSlider = document.getElementById('masterVolume');
    const masterCentsSlider = document.getElementById('masterCents');
    const centsValueDisplay = document.getElementById('centsValue');
    const playPauseButton = document.getElementById('playPauseButton');
    const stopButton = document.getElementById('stopButton');

    let selectedFile = null;
    let musicFiles = [];
    let audioContext; // For Web Audio API
    let scorePlayer; // This would be an instance of your MusicXML playback library object

    // --- Initialize Web Audio API (important for audio manipulation) ---
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        alert('Web Audio API is not supported in this browser');
        console.error("Web Audio API not supported", e);
    }

    // --- File Handling ---
    fileInput.addEventListener('change', handleFileSelect);
    function handleFileSelection(event) {
        fileListDisplay.innerHTML = ''; // Clear previous list
        musicFiles = Array.from(event.target.files).filter(file =>
            file.name.toLowerCase().endsWith('.xml') || file.name.toLowerCase().endsWith('.musicxml')
        );

        if (musicFiles.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No MusicXML files selected.'; // <-- Updated message
            fileListDisplay.appendChild(li);
            currentSongTitle.textContent = 'No MusicXML files found.';
            resetPlayer();
            return;
        }

        musicFiles.forEach((file, index) => {
            const li = document.createElement('li');
            li.textContent = file.name;
            li.dataset.fileIndex = index;
            li.addEventListener('click', () => loadAndDisplayFile(file, li));
            fileListDisplay.appendChild(li);
        });
    }

    async function loadAndDisplayFile(file, listItem) {
        if (selectedFile === file) return; // Avoid reloading the same file

        selectedFile = file;

        // Update active item in the list
        document.querySelectorAll('#fileList li').forEach(li => li.classList.remove('active'));
        if (listItem) listItem.classList.add('active');

        currentSongTitle.textContent = `Playing: ${file.name}`;
        musicDisplay.innerHTML = `<p>Loading ${file.name}...</p>`; // Placeholder
        partsListContainer.innerHTML = '<p>Loading parts...</p>';

        try {
            const fileContent = await readFileAsText(file);

            // --- THIS IS WHERE YOUR MUSICXML LIBRARY COMES IN ---
            // Example with a hypothetical library:
            // if (scorePlayer) {
            //     scorePlayer.stop(); // Stop previous playback
            //     scorePlayer.destroy(); // Clean up previous instance
            // }
            // scorePlayer = new YourMusicXMLLibrary(musicDisplay, audioContext); // Initialize with display element and audio context
            // await scorePlayer.load(fileContent); // Load the XML content
            // renderScore(scorePlayer); // Visually render the score
            // setupPartControls(scorePlayer.getParts()); // Get parts from the library
            // setupPlayerControls(scorePlayer);

            // Placeholder for actual library integration:
            musicDisplay.innerHTML = `<p>Visual representation of "${file.name}" would be here.</p><p><pre>${escapeHtml(fileContent.substring(0, 1000))}...</pre></p><p style="color:red;">(Full rendering and playback requires a MusicXML library integration)</p>`;
            partsListContainer.innerHTML = '<p>Part controls would appear here after loading the score with a MusicXML library.</p>';
            // Simulate part loading for demonstration
            const simulatedParts = [
                { id: 'P1', name: 'Soprano' },
                { id: 'P2', name: 'Alto' },
                { id: 'P3', name: 'Tenor' },
                { id: 'P4', name: 'Bass' }
            ];
            setupPartControls(simulatedParts);


        } catch (error) {
            console.error('Error loading or parsing MusicXML:', error);
            musicDisplay.innerHTML = `<p>Error loading ${file.name}. Check console.</p>`;
            currentSongTitle.textContent = `Error loading file.`;
            partsListContainer.innerHTML = '';
        }
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = error => reject(error);
            reader.readAsText(file);
        });
    }

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
     }

    // --- Score Rendering (dependent on library) ---
    // function renderScore(playerInstance) {
    //     playerInstance.render(); // Or whatever method your library uses
    //     musicDisplay.innerHTML = ''; // Clear loading message
    //     musicDisplay.appendChild(playerInstance.getDisplayElement()); // Append the canvas/svg
    // }

    // --- Part Controls ---
    function setupPartControls(parts) { // parts would be an array of objects like { id: 'P1', name: 'Part 1' }
        partsListContainer.innerHTML = ''; // Clear previous part controls

        if (!parts || parts.length === 0) {
            partsListContainer.innerHTML = '<p>No parts found in this score.</p>';
            return;
        }

        parts.forEach(part => {
            const partDiv = document.createElement('div');
            partDiv.classList.add('part-controls-item');
            partDiv.dataset.partId = part.id;

            const title = document.createElement('h4');
            title.textContent = part.name || part.id; // Use part name if available
            partDiv.appendChild(title);

            // Mute button
            const muteButton = document.createElement('button');
            muteButton.textContent = 'Mute';
            muteButton.classList.add('mute-button');
            muteButton.addEventListener('click', () => toggleMutePart(part.id, muteButton));
            partDiv.appendChild(muteButton);

            // Highlight button
            const highlightButton = document.createElement('button');
            highlightButton.textContent = 'Highlight';
            highlightButton.classList.add('highlight-button');
            highlightButton.addEventListener('click', () => toggleHighlightPart(part.id, partDiv));
            partDiv.appendChild(highlightButton);

            // Volume slider
            const volumeLabel = document.createElement('label');
            volumeLabel.textContent = 'Volume:';
            volumeLabel.htmlFor = `volume-${part.id}`;
            const volumeSlider = document.createElement('input');
            volumeSlider.type = 'range';
            volumeSlider.id = `volume-${part.id}`;
            volumeSlider.min = '0';
            volumeSlider.max = '1';
            volumeSlider.step = '0.01';
            volumeSlider.value = '0.75'; // Default part volume
            volumeSlider.addEventListener('input', () => setPartVolume(part.id, volumeSlider.value));

            partDiv.appendChild(volumeLabel);
            partDiv.appendChild(volumeSlider);

            partsListContainer.appendChild(partDiv);
        });
    }

    function toggleMutePart(partId, button) {
        // Logic to mute/unmute the part using your MusicXML library
        // e.g., scorePlayer.mutePart(partId, !scorePlayer.isPartMuted(partId));
        const isMuted = button.textContent === 'Unmute'; // Hypothetical
        if (isMuted) {
            button.textContent = 'Mute';
            // scorePlayer.unmutePart(partId);
            console.log(`Part ${partId} unmuted (simulated)`);
        } else {
            button.textContent = 'Unmute';
            // scorePlayer.mutePart(partId);
            console.log(`Part ${partId} muted (simulated)`);
        }
        // Update visual state if needed
    }

    let highlightedPartId = null;
    function toggleHighlightPart(partId, partDiv) {
        // Logic to highlight/unhighlight the part visually in the score display
        // e.g., scorePlayer.highlightPart(partId); or scorePlayer.unhighlightPart(partId);
        // This also needs to manage removing highlight from previously highlighted part

        const isHighlighted = partDiv.classList.contains('part-highlighted-control');

        // Remove highlight from any currently highlighted part's controls
        document.querySelectorAll('.part-controls-item.part-highlighted-control').forEach(div => {
            div.classList.remove('part-highlighted-control');
            // scorePlayer.unhighlightVisualPart(div.dataset.partId); // Command to library to remove visual highlight
        });
        // Remove highlight from the score display itself (using library)
        if (highlightedPartId && highlightedPartId !== partId) {
            // scorePlayer.unhighlightVisualScorePart(highlightedPartId);
             console.log(`Visual score part ${highlightedPartId} unhighlighted (simulated)`);
        }


        if (isHighlighted) {
            partDiv.classList.remove('part-highlighted-control');
            // scorePlayer.unhighlightVisualScorePart(partId); // Command to library
            console.log(`Part ${partId} unhighlighted visually (simulated)`);
            highlightedPartId = null;
        } else {
            partDiv.classList.add('part-highlighted-control');
            // scorePlayer.highlightVisualScorePart(partId); // Command to library
            console.log(`Part ${partId} highlighted visually (simulated)`);
            highlightedPartId = partId;
        }
    }


    function setPartVolume(partId, volume) {
        // Logic to set volume for the part using your MusicXML library
        // e.g., scorePlayer.setPartVolume(partId, parseFloat(volume));
        console.log(`Part ${partId} volume set to ${volume} (simulated)`);
    }

    // --- Master Controls ---
    masterVolumeSlider.addEventListener('input', (event) => {
        const volume = parseFloat(event.target.value);
        // Logic to set master volume using your MusicXML library or Web Audio API GainNode
        // e.g., if (scorePlayer) scorePlayer.setMasterVolume(volume);
        // Or if using a master gain node: masterGainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        console.log(`Master Volume set to ${volume} (simulated)`);
    });

    masterCentsSlider.addEventListener('input', (event) => {
        const cents = parseInt(event.target.value);
        centsValueDisplay.textContent = `${cents} cents`;
        // Logic to adjust pitch (cents) using your MusicXML library or Web Audio API
        // This is more complex, might involve DetuneNode for each part or global detune if library supports
        // e.g., if (scorePlayer) scorePlayer.setDetune(cents);
        console.log(`Master pitch shift set to ${cents} cents (simulated)`);
    });

    playPauseButton.addEventListener('click', () => {
        if (!selectedFile || !scorePlayer) { // Check if scorePlayer is initialized
            alert("Please load a MusicXML file first.");
            return;
        }
        // Logic to play/pause using your MusicXML library
        // if (scorePlayer.isPlaying()) {
        //     scorePlayer.pause();
        //     playPauseButton.textContent = 'Play';
        // } else {
        //     scorePlayer.play();
        //     playPauseButton.textContent = 'Pause';
        // }
        if (playPauseButton.textContent === 'Play') {
            console.log('Playback started (simulated)');
            playPauseButton.textContent = 'Pause';
        } else {
            console.log('Playback paused (simulated)');
            playPauseButton.textContent = 'Play';
        }
    });

    stopButton.addEventListener('click', () => {
        if (!selectedFile || !scorePlayer) return;
        // Logic to stop playback and reset cursor using your MusicXML library
        // scorePlayer.stop();
        // playPauseButton.textContent = 'Play';
        console.log('Playback stopped (simulated)');
        playPauseButton.textContent = 'Play';
    });

    // --- Helper function to initialize player controls (call after loading a score) ---
    // function setupPlayerControls(player) {
    //     playPauseButton.onclick = () => {
    //         if (player.isPlaying) {
    //             player.pause();
    //             playPauseButton.textContent = 'Play';
    //         } else {
    //             player.play();
    //             playPauseButton.textContent = 'Pause';
    //         }
    //     };
    //     stopButton.onclick = () => {
    //         player.stop();
    //         playPauseButton.textContent = 'Play';
    //     };
    //     masterVolumeSlider.oninput = (e) => player.setMasterVolume(parseFloat(e.target.value));
    //     masterCentsSlider.oninput = (e) => {
    //         const cents = parseInt(e.target.value);
    //         centsValueDisplay.textContent = `${cents} cents`;
    //         player.setGlobalDetune(cents); // Example method
    //     };
    // }

    // Initial message
    partsListContainer.innerHTML = '<p>Select a MusicXML file or folder to begin.</p>';
});
