# PlayAlong Spec

## Overview

PlayAlong is a single-page HTML5 + JavaScript web app that helps a user find and practice chords for a song while playing along with a YouTube video.

The app combines:

- an embedded YouTube player
- a loopable video section selector
- a browser-based piano/chord engine
- keyboard shortcuts for instant chord playback

## App Structure

The app is implemented as a static frontend with these main files:

- `index.html`: page structure and controls
- `styles.css`: visual styling and layout
- `youtube.js`: YouTube URL loading, embedded player behavior, and video looping features
- `piano.js`: piano audio engine, keyboard chord handling, sustain logic, and piano volume control

## Video Features

### YouTube Input

- The app must provide a URL input box for a YouTube URL.
- When the user submits a valid YouTube URL, the app must load that video in the embedded player.
- Supported YouTube URL formats must include:
  - standard watch URLs
  - short `youtu.be` URLs
  - embed URLs
  - shorts URLs

### Embedded Player

- The video must play inside the page using an embedded YouTube player.
- The player implementation must support reading the current playback time and seeking to a specific time.

### Loop Selection

- The app must allow the user to mark a loop start time from the current video playback position.
- The app must allow the user to mark a loop end time from the current video playback position.
- The app must provide controls to:
  - set loop start
  - set loop end
  - enable or disable looping
  - clear the current loop
- The UI must display:
  - loop start
  - loop end
  - loop status
- When looping is enabled and both markers are valid, playback must jump back to the loop start when the player reaches the loop end.
- Loading a new video must clear any existing loop markers and loop state.
- Invalid loop states must be prevented:
  - loop end cannot be before or equal to loop start
  - looping cannot be enabled until both loop markers are valid

## Piano Features

### Piano Engine

- The app must include a JavaScript piano/chord engine that produces sound in the browser.
- The app must provide a visible on-screen piano keyboard.
- Clicking a visible piano key should play a preview chord based on that note.
- Audio may require an initial user interaction before it becomes available.

### Volume Control

- The app must provide a piano volume slider.
- The volume slider must update the piano output level live.
- The UI must display the current volume percentage.

### Status Display

- The app must display:
  - current chord
  - played notes
  - audio status

## Keyboard Chord Input

The app must listen for keyboard input and convert key combinations into chords immediately.

Here `X` is a root key from:

- `C`
- `D`
- `E`
- `F`
- `G`
- `A`
- `B`

Sharp roots must be available for:

- `Shift + C` -> `C#`
- `Shift + D` -> `D#`
- `Shift + F` -> `F#`
- `Shift + G` -> `G#`
- `Shift + A` -> `A#`

### Chord Mappings

- `X`: major triad
- `X + m`: minor triad
- `X + 2`: sus2 triad
- `X + 4`: sus4 triad
- `X + 5`: power chord
- `X + ,`: dominant 7 chord
- `X + .`: major 7 chord
- `X + /`: minor 7 chord
- `X + ;`: augmented triad
- `X + '`: diminished triad

### Shifted Modifier Support

When `Shift` is held, shifted punctuation must still map correctly to the same chord modifiers:

- `<` must behave like `,`
- `>` must behave like `.`
- `?` must behave like `/`
- `:` must behave like `;`
- `"` must behave like `'`

This is required so combinations like `Shift + C + <` correctly produce `C#7`.

## Chord Playback Behavior

### Immediate Playback

- A chord must play as soon as the relevant keystroke combination is recognized.

### Sustain

- A keyboard-triggered chord must sustain for as long as the relevant chord keys remain held.
- Releasing keys must release or update the currently sounding chord.

### Live Re-evaluation

- Any time the currently held keystroke combination changes, the active chord must be recalculated from the keys that are physically held at that moment.
- The app must not rely on stale key history alone.
- If a modifier is released, the chord must update immediately.
- If `Shift` is pressed or released while a supported root is held, the chord must update immediately between natural and sharp roots.

### Clean Combo Reset

- When all chord-related keys are released, the chord combo state must reset completely.
- A new chord must start from a clean state and must not inherit the previous root or modifier.

## UX Expectations

- The page should clearly separate video controls from piano controls.
- Feedback messages should be shown for invalid YouTube URLs, loop actions, and player initialization failures.
- The chord shortcuts should be visible in the UI so the user can learn the controls without reading source code.
