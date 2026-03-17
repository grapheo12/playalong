(function setupYouTubeFeatures() {
  const videoForm = document.querySelector("#video-form");
  const youtubeInput = document.querySelector("#youtube-url");
  const youtubePlayerMount = document.querySelector("#youtube-player");
  const videoFeedback = document.querySelector("#video-feedback");
  const loopStartValue = document.querySelector("#loop-start-value");
  const loopEndValue = document.querySelector("#loop-end-value");
  const loopStatus = document.querySelector("#loop-status");
  const loopFeedback = document.querySelector("#loop-feedback");
  const setLoopStartButton = document.querySelector("#set-loop-start");
  const setLoopEndButton = document.querySelector("#set-loop-end");
  const toggleLoopButton = document.querySelector("#toggle-loop");
  const clearLoopButton = document.querySelector("#clear-loop");

  const DEFAULT_VIDEO_ID = "jfKfPfyJRdk";
  const LOOP_POLL_INTERVAL_MS = 150;

  let youtubePlayer = null;
  let youtubeApiPromise = null;
  let youtubePlayerReadyPromise = null;
  let currentVideoId = DEFAULT_VIDEO_ID;
  let loopStartTime = null;
  let loopEndTime = null;
  let loopEnabled = false;
  let loopMonitorId = null;

  function parseYoutubeId(urlLike) {
    let parsedUrl;

    try {
      parsedUrl = new URL(urlLike);
    } catch (error) {
      return null;
    }

    const host = parsedUrl.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsedUrl.pathname.slice(1) || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsedUrl.pathname === "/watch") {
        return parsedUrl.searchParams.get("v");
      }

      if (parsedUrl.pathname.startsWith("/embed/")) {
        return parsedUrl.pathname.split("/")[2] || null;
      }

      if (parsedUrl.pathname.startsWith("/shorts/")) {
        return parsedUrl.pathname.split("/")[2] || null;
      }
    }

    return null;
  }

  function setVideoFeedback(message, type) {
    videoFeedback.textContent = message;
    videoFeedback.className = `feedback ${type}`;
  }

  function setLoopFeedback(message, type = "") {
    loopFeedback.textContent = message;
    loopFeedback.className = type ? `feedback ${type}` : "feedback";
  }

  function formatTimestamp(totalSeconds) {
    if (!Number.isFinite(totalSeconds)) {
      return "Not set";
    }

    const roundedSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(roundedSeconds / 3600);
    const minutes = Math.floor((roundedSeconds % 3600) / 60);
    const seconds = roundedSeconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function hasValidLoopSelection() {
    return (
      Number.isFinite(loopStartTime) &&
      Number.isFinite(loopEndTime) &&
      loopEndTime > loopStartTime
    );
  }

  function updateLoopUi() {
    loopStartValue.textContent = formatTimestamp(loopStartTime);
    loopEndValue.textContent = formatTimestamp(loopEndTime);

    if (loopEnabled && hasValidLoopSelection()) {
      loopStatus.textContent = `Looping ${formatTimestamp(loopStartTime)} - ${formatTimestamp(loopEndTime)}`;
    } else if (hasValidLoopSelection()) {
      loopStatus.textContent = "Ready";
    } else if (Number.isFinite(loopStartTime) || Number.isFinite(loopEndTime)) {
      loopStatus.textContent = "Incomplete";
    } else {
      loopStatus.textContent = "Off";
    }

    toggleLoopButton.disabled = !hasValidLoopSelection();
    toggleLoopButton.textContent = loopEnabled ? "Disable Loop" : "Enable Loop";
    toggleLoopButton.classList.toggle("active", loopEnabled);
  }

  function resetLoopSelection() {
    loopStartTime = null;
    loopEndTime = null;
    loopEnabled = false;
    updateLoopUi();
  }

  function loadYouTubeApi() {
    if (window.YT && typeof window.YT.Player === "function") {
      return Promise.resolve(window.YT);
    }

    if (youtubeApiPromise) {
      return youtubeApiPromise;
    }

    youtubeApiPromise = new Promise((resolve, reject) => {
      const existingReadyHandler = window.onYouTubeIframeAPIReady;
      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );

      window.onYouTubeIframeAPIReady = () => {
        if (typeof existingReadyHandler === "function") {
          existingReadyHandler();
        }
        resolve(window.YT);
      };

      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.onerror = () => {
          reject(new Error("Unable to load the YouTube player API."));
        };
        document.head.appendChild(script);
      }
    });

    return youtubeApiPromise;
  }

  function handleYouTubeStateChange(event) {
    if (
      loopEnabled &&
      hasValidLoopSelection() &&
      window.YT &&
      event.data === window.YT.PlayerState.ENDED
    ) {
      youtubePlayer.seekTo(loopStartTime, true);
      youtubePlayer.playVideo();
    }
  }

  async function ensureYouTubePlayer() {
    if (youtubePlayerReadyPromise) {
      await youtubePlayerReadyPromise;
      return youtubePlayer;
    }

    await loadYouTubeApi();

    youtubePlayerReadyPromise = new Promise((resolve) => {
      youtubePlayer = new window.YT.Player(youtubePlayerMount, {
        videoId: currentVideoId,
        playerVars: {
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => resolve(youtubePlayer),
          onStateChange: handleYouTubeStateChange,
        },
      });
    });

    await youtubePlayerReadyPromise;

    if (!loopMonitorId) {
      loopMonitorId = window.setInterval(() => {
        if (!loopEnabled || !hasValidLoopSelection() || !youtubePlayer || !window.YT) {
          return;
        }

        const playerState = youtubePlayer.getPlayerState();
        if (
          playerState !== window.YT.PlayerState.PLAYING &&
          playerState !== window.YT.PlayerState.BUFFERING
        ) {
          return;
        }

        const currentTime = youtubePlayer.getCurrentTime();
        if (
          Number.isFinite(currentTime) &&
          (currentTime < loopStartTime || currentTime >= loopEndTime - 0.05)
        ) {
          youtubePlayer.seekTo(loopStartTime, true);
        }
      }, LOOP_POLL_INTERVAL_MS);
    }

    return youtubePlayer;
  }

  async function loadVideo(videoId) {
    currentVideoId = videoId;
    const player = await ensureYouTubePlayer();
    player.cueVideoById(videoId);
    resetLoopSelection();
    setLoopFeedback("Loop markers cleared for the new video.", "success");
  }

  async function readPlayerTime() {
    const player = await ensureYouTubePlayer();
    const currentTime = player.getCurrentTime();

    if (!Number.isFinite(currentTime)) {
      throw new Error("Video playback time is not available yet.");
    }

    return currentTime;
  }

  videoForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const videoId = parseYoutubeId(youtubeInput.value.trim());

    if (!videoId) {
      setVideoFeedback("Please enter a valid YouTube URL.", "error");
      return;
    }

    loadVideo(videoId)
      .then(() => {
        setVideoFeedback("Video loaded into the embedded player.", "success");
      })
      .catch(() => {
        setVideoFeedback("Could not load the YouTube player.", "error");
      });
  });

  setLoopStartButton.addEventListener("click", () => {
    readPlayerTime()
      .then((currentTime) => {
        loopStartTime = currentTime;

        if (Number.isFinite(loopEndTime) && loopEndTime <= loopStartTime) {
          loopEndTime = null;
          loopEnabled = false;
          setLoopFeedback(
            "Loop start set. End marker was cleared because it must be after the start.",
            "success"
          );
        } else {
          setLoopFeedback("Loop start set.", "success");
        }

        updateLoopUi();
      })
      .catch((error) => {
        setLoopFeedback(error.message, "error");
      });
  });

  setLoopEndButton.addEventListener("click", () => {
    readPlayerTime()
      .then((currentTime) => {
        if (!Number.isFinite(loopStartTime)) {
          setLoopFeedback("Set a loop start before setting the end.", "error");
          return;
        }

        if (currentTime <= loopStartTime + 0.05) {
          setLoopFeedback("Loop end must be after the start marker.", "error");
          return;
        }

        loopEndTime = currentTime;
        setLoopFeedback("Loop end set.", "success");
        updateLoopUi();
      })
      .catch((error) => {
        setLoopFeedback(error.message, "error");
      });
  });

  toggleLoopButton.addEventListener("click", async () => {
    if (!hasValidLoopSelection()) {
      setLoopFeedback("Set both loop markers before enabling the loop.", "error");
      updateLoopUi();
      return;
    }

    loopEnabled = !loopEnabled;
    updateLoopUi();
    setLoopFeedback(loopEnabled ? "Loop enabled." : "Loop disabled.", "success");

    if (!loopEnabled) {
      return;
    }

    try {
      const player = await ensureYouTubePlayer();
      const currentTime = player.getCurrentTime();
      if (currentTime < loopStartTime || currentTime >= loopEndTime) {
        player.seekTo(loopStartTime, true);
      }
    } catch (error) {
      setLoopFeedback("Could not enable looping on the player.", "error");
    }
  });

  clearLoopButton.addEventListener("click", () => {
    resetLoopSelection();
    setLoopFeedback("Loop cleared.", "success");
  });

  updateLoopUi();
  ensureYouTubePlayer().catch(() => {
    setVideoFeedback("Could not initialize the YouTube player.", "error");
  });
})();
