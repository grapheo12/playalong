(function setupPianoFeatures() {
  const currentChord = document.querySelector("#current-chord");
  const currentNotes = document.querySelector("#current-notes");
  const audioStatus = document.querySelector("#audio-status");
  const volumeSlider = document.querySelector("#volume-slider");
  const volumeValue = document.querySelector("#volume-value");
  const piano = document.querySelector("#piano");

  const NATURAL_KEY_ROOTS = new Set(["c", "d", "e", "f", "g", "a", "b"]);
  const SHARP_KEY_ROOTS = {
    c: "C#",
    d: "D#",
    f: "F#",
    g: "G#",
    a: "A#",
  };
  const ROOT_TO_MIDI = {
    C: 60,
    "C#": 61,
    D: 62,
    "D#": 63,
    E: 64,
    F: 65,
    "F#": 66,
    G: 67,
    "G#": 68,
    A: 69,
    "A#": 70,
    B: 71,
  };
  const CHORD_TYPES = {
    major: { label: "", intervals: [0, 4, 7] },
    minor: { label: "m", intervals: [0, 3, 7] },
    sus2: { label: "sus2", intervals: [0, 2, 7] },
    sus4: { label: "sus4", intervals: [0, 5, 7] },
    dom7: { label: "7", intervals: [0, 4, 7, 10] },
    maj7: { label: "maj7", intervals: [0, 4, 7, 11] },
    min7: { label: "min7", intervals: [0, 3, 7, 10] },
    aug: { label: "aug", intervals: [0, 4, 8] },
    dim: { label: "dim", intervals: [0, 3, 6] },
    power: { label: "5", intervals: [0, 7] },
  };
  const MODIFIER_KEYS = {
    m: "minor",
    "2": "sus2",
    "4": "sus4",
    "5": "power",
    ",": "dom7",
    ".": "maj7",
    "/": "min7",
    ";": "aug",
    "'": "dim",
  };
  const SHIFTED_MODIFIER_ALIASES = {
    "<": ",",
    ">": ".",
    "?": "/",
    ":": ";",
    "\"": "'",
  };
  const PIANO_LAYOUT = [
    { note: "C4", kind: "white" },
    { note: "C#4", kind: "black" },
    { note: "D4", kind: "white" },
    { note: "D#4", kind: "black" },
    { note: "E4", kind: "white" },
    { note: "F4", kind: "white" },
    { note: "F#4", kind: "black" },
    { note: "G4", kind: "white" },
    { note: "G#4", kind: "black" },
    { note: "A4", kind: "white" },
    { note: "A#4", kind: "black" },
    { note: "B4", kind: "white" },
    { note: "C5", kind: "white" },
    { note: "C#5", kind: "black" },
    { note: "D5", kind: "white" },
    { note: "D#5", kind: "black" },
    { note: "E5", kind: "white" },
    { note: "F5", kind: "white" },
    { note: "F#5", kind: "black" },
    { note: "G5", kind: "white" },
    { note: "G#5", kind: "black" },
    { note: "A5", kind: "white" },
    { note: "A#5", kind: "black" },
    { note: "B5", kind: "white" },
  ];

  let audioContext = null;
  let masterGain = null;
  let activeChordSignature = "";
  let activeChordVoices = [];
  let pianoVolume = Number(volumeSlider.value) / 100;
  const pressedRoots = [];
  const pressedModifiers = [];
  const heldKeys = new Set();
  const pianoKeyMap = new Map();

  function normalizeKey(value) {
    const normalized = value.toLowerCase();
    return SHIFTED_MODIFIER_ALIASES[normalized] || normalized;
  }

  function canHandleKeyboardInput() {
    const activeElement = document.activeElement;

    if (!activeElement) {
      return true;
    }

    const tagName = activeElement.tagName;
    return (
      tagName !== "INPUT" &&
      tagName !== "TEXTAREA" &&
      !activeElement.isContentEditable
    );
  }

  function initAudio() {
    if (audioContext) {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = pianoVolume;
    masterGain.connect(audioContext.destination);
  }

  function setPianoVolume(nextVolume) {
    pianoVolume = nextVolume;
    volumeValue.textContent = `${Math.round(nextVolume * 100)}%`;

    if (masterGain && audioContext) {
      masterGain.gain.setValueAtTime(pianoVolume, audioContext.currentTime);
    }
  }

  async function unlockAudio() {
    initAudio();

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    audioStatus.textContent = "Ready";
  }

  function noteNameFromMidi(midi) {
    const pitchClasses = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const pitchClass = pitchClasses[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${pitchClass}${octave}`;
  }

  function midiFromNoteName(noteName) {
    const match = noteName.match(/^([A-G]#?)(\d)$/);
    if (!match) {
      return null;
    }

    const [, pitchClass, octaveText] = match;
    const octave = Number(octaveText);
    const pitchClasses = {
      C: 0,
      "C#": 1,
      D: 2,
      "D#": 3,
      E: 4,
      F: 5,
      "F#": 6,
      G: 7,
      "G#": 8,
      A: 9,
      "A#": 10,
      B: 11,
    };

    return pitchClasses[pitchClass] + (octave + 1) * 12;
  }

  function buildChord(root, chordType, rootMidi = ROOT_TO_MIDI[root]) {
    const definition = CHORD_TYPES[chordType];
    const chordName = `${root}${definition.label}`;
    const midiNotes = definition.intervals.map((interval) => rootMidi + interval);
    const noteNames = midiNotes.map(noteNameFromMidi);

    return { chordName, midiNotes, noteNames };
  }

  function midiToFrequency(midi) {
    return 440 * (2 ** ((midi - 69) / 12));
  }

  function highlightKeys(midiNotes) {
    for (const button of pianoKeyMap.values()) {
      button.classList.remove("active");
    }

    midiNotes.forEach((midi) => {
      const note = noteNameFromMidi(midi);
      const key = pianoKeyMap.get(note);
      if (key) {
        key.classList.add("active");
      }
    });
  }

  function clearChordDisplay() {
    currentChord.textContent = "Waiting for input";
    currentNotes.textContent = "-";
  }

  function createChordVoice(midi, startTime) {
    const frequency = midiToFrequency(midi);
    const voiceGain = audioContext.createGain();
    const voiceFilter = audioContext.createBiquadFilter();
    const oscillatorA = audioContext.createOscillator();
    const oscillatorB = audioContext.createOscillator();

    voiceFilter.type = "lowpass";
    voiceFilter.frequency.value = 2400;
    voiceFilter.Q.value = 2;

    oscillatorA.type = "triangle";
    oscillatorB.type = "sine";
    oscillatorA.frequency.setValueAtTime(frequency, startTime);
    oscillatorB.frequency.setValueAtTime(frequency * 2, startTime);

    voiceGain.gain.setValueAtTime(0.0001, startTime);
    voiceGain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.02);

    oscillatorA.connect(voiceGain);
    oscillatorB.connect(voiceGain);
    voiceGain.connect(voiceFilter);
    voiceFilter.connect(masterGain);

    oscillatorA.start(startTime);
    oscillatorB.start(startTime);

    return { oscillatorA, oscillatorB, voiceGain };
  }

  function releaseVoice(voice, releaseAt, duration = 0.18) {
    if (typeof voice.voiceGain.gain.cancelAndHoldAtTime === "function") {
      voice.voiceGain.gain.cancelAndHoldAtTime(releaseAt);
    } else {
      voice.voiceGain.gain.cancelScheduledValues(releaseAt);
      voice.voiceGain.gain.setValueAtTime(
        Math.max(voice.voiceGain.gain.value, 0.0001),
        releaseAt
      );
    }

    voice.voiceGain.gain.exponentialRampToValueAtTime(0.0001, releaseAt + duration);
    voice.oscillatorA.stop(releaseAt + duration + 0.03);
    voice.oscillatorB.stop(releaseAt + duration + 0.03);
  }

  function stopActiveChord(clearDisplay = false) {
    if (!audioContext || activeChordVoices.length === 0) {
      if (clearDisplay) {
        highlightKeys([]);
        clearChordDisplay();
      }
      activeChordSignature = "";
      activeChordVoices = [];
      return;
    }

    const releaseAt = audioContext.currentTime;
    activeChordVoices.forEach((voice) => releaseVoice(voice, releaseAt));
    activeChordVoices = [];
    activeChordSignature = "";
    highlightKeys([]);

    if (clearDisplay) {
      clearChordDisplay();
    }
  }

  function playSustainedChord(midiNotes) {
    if (!audioContext || !masterGain) {
      return;
    }

    const now = audioContext.currentTime;
    activeChordVoices = midiNotes.map((midi, index) =>
      createChordVoice(midi, now + index * 0.015)
    );
    highlightKeys(midiNotes);
  }

  function playChordPreview(midiNotes) {
    if (!audioContext || !masterGain) {
      return;
    }

    const now = audioContext.currentTime;

    midiNotes.forEach((midi, index) => {
      const startTime = now + index * 0.015;
      const releaseTime = startTime + 1.4;
      const voice = createChordVoice(midi, startTime);
      releaseVoice(voice, releaseTime);
    });

    highlightKeys(midiNotes);
    window.clearTimeout(playChordPreview.timeoutId);
    playChordPreview.timeoutId = window.setTimeout(() => {
      if (activeChordVoices.length === 0) {
        highlightKeys([]);
      }
    }, 900);
  }

  function updateChordDisplay(chordName, noteNames) {
    currentChord.textContent = chordName;
    currentNotes.textContent = noteNames.join(" - ");
  }

  function getLastHeldKey(history) {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const key = history[index];
      if (heldKeys.has(key)) {
        return key;
      }
    }

    return null;
  }

  function getActiveRoot() {
    const lastRootKey = getLastHeldKey(pressedRoots);

    if (!lastRootKey) {
      return null;
    }

    if (heldKeys.has("shift") && SHARP_KEY_ROOTS[lastRootKey]) {
      return SHARP_KEY_ROOTS[lastRootKey];
    }

    return lastRootKey.toUpperCase();
  }

  function getActiveChordType() {
    const modifier = getLastHeldKey(pressedModifiers);
    return modifier ? MODIFIER_KEYS[modifier] : "major";
  }

  async function triggerFromCurrentState() {
    const root = getActiveRoot();

    if (!root) {
      stopActiveChord(true);
      return;
    }

    await unlockAudio();

    const chordType = getActiveChordType();
    const signature = `${root}:${chordType}`;
    if (signature === activeChordSignature) {
      return;
    }

    stopActiveChord(false);
    activeChordSignature = signature;
    const chord = buildChord(root, chordType);
    playSustainedChord(chord.midiNotes);
    updateChordDisplay(chord.chordName, chord.noteNames);
  }

  function removeFromList(list, value) {
    const index = list.indexOf(value);
    if (index >= 0) {
      list.splice(index, 1);
    }
  }

  function resetComboState() {
    pressedRoots.length = 0;
    pressedModifiers.length = 0;
  }

  function hasActiveChordKeysHeld() {
    if (heldKeys.has("shift")) {
      return true;
    }

    for (const key of heldKeys) {
      if (NATURAL_KEY_ROOTS.has(key) || MODIFIER_KEYS[key]) {
        return true;
      }
    }

    return false;
  }

  function buildPiano() {
    const fragment = document.createDocumentFragment();

    PIANO_LAYOUT.forEach(({ note, kind }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `key ${kind}`;
      button.dataset.note = note;
      button.innerHTML = `<span class="key-label">${note}</span>`;
      button.addEventListener("click", async () => {
        await unlockAudio();

        const root = note.replace(/[0-9]/g, "");
        const chord = buildChord(root, "major", midiFromNoteName(note));
        playChordPreview(chord.midiNotes);
        updateChordDisplay(chord.chordName, chord.noteNames);
      });

      pianoKeyMap.set(note, button);
      fragment.appendChild(button);
    });

    piano.appendChild(fragment);
  }

  window.addEventListener("pointerdown", () => {
    unlockAudio().catch(() => {
      audioStatus.textContent = "Unavailable";
    });
  });

  volumeSlider.addEventListener("input", (event) => {
    setPianoVolume(Number(event.target.value) / 100);
  });

  window.addEventListener("keydown", async (event) => {
    if (!canHandleKeyboardInput()) {
      return;
    }

    const key = normalizeKey(event.key);

    if (event.repeat && (NATURAL_KEY_ROOTS.has(key) || MODIFIER_KEYS[key])) {
      return;
    }

    if (key === "shift") {
      heldKeys.add("shift");
      await triggerFromCurrentState();
      return;
    }

    if (NATURAL_KEY_ROOTS.has(key)) {
      heldKeys.add(key);
      removeFromList(pressedRoots, key);
      pressedRoots.push(key);
      await triggerFromCurrentState();
      return;
    }

    if (MODIFIER_KEYS[key]) {
      heldKeys.add(key);
      removeFromList(pressedModifiers, key);
      pressedModifiers.push(key);
      await triggerFromCurrentState();
    }
  });

  window.addEventListener("keyup", async (event) => {
    const key = normalizeKey(event.key);
    heldKeys.delete(key);

    if (NATURAL_KEY_ROOTS.has(key)) {
      removeFromList(pressedRoots, key);
    }

    if (MODIFIER_KEYS[key]) {
      removeFromList(pressedModifiers, key);
    }

    if (!hasActiveChordKeysHeld()) {
      resetComboState();
    }

    if (key === "shift" || NATURAL_KEY_ROOTS.has(key) || MODIFIER_KEYS[key]) {
      await triggerFromCurrentState();
    }
  });

  buildPiano();
  setPianoVolume(pianoVolume);
})();
