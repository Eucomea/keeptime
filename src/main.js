const orbit = document.getElementById("orbit");
const orbitScene = document.getElementById("orbit-scene");
const stage = document.getElementById("stage");
const ticks = document.getElementById("ticks");
const navClock = document.getElementById("nav-clock");
const year = document.getElementById("year");
const hourHand = document.getElementById("hand-hour");
const minuteHand = document.getElementById("hand-minute");
const secondHand = document.getElementById("hand-second");

year.textContent = String(new Date().getFullYear());

for (let i = 0; i < 60; i += 1) {
  const tick = document.createElement("span");
  tick.className = i % 5 === 0 ? "tick hour" : "tick";
  tick.style.transform = `rotate(${i * 6}deg)`;
  ticks.appendChild(tick);
}

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const hasDeviceOrientation = typeof window.DeviceOrientationEvent === "function";
const needsMotionPermission =
  hasDeviceOrientation &&
  typeof window.DeviceOrientationEvent.requestPermission === "function";

requestAnimationFrame(() => {
  document.documentElement.classList.add("is-ready");
});

const THEME_KEY = "kt-theme";
const themeToggle = document.getElementById("theme-toggle");
const themeColorMeta = document.getElementById("theme-color");
const colorSchemeMeta = document.getElementById("color-scheme");
const supportedColorSchemesMeta = document.getElementById(
  "supported-color-schemes",
);
const logoSource = document.getElementById("logo-source");
const logoImg = document.getElementById("logo-img");
const worldLogoSource = document.getElementById("world-logo-source");
const worldLogoImg = document.getElementById("world-logo-img");
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function systemPrefersDark() {
  return darkQuery.matches;
}

function storedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function resolveTheme() {
  // Manual choice wins, including real light mode while the OS is dark.
  return storedTheme() || (systemPrefersDark() ? "dark" : "light");
}

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyLogoTheme(theme) {
  const dark = theme === "dark";
  if (logoSource) logoSource.srcset = dark ? "/logo-dark.webp" : "/logo.webp";
  if (logoImg) logoImg.src = dark ? "/logo-dark.png" : "/logo.jpg";
  if (worldLogoSource) worldLogoSource.srcset = dark ? "/logo-dark.webp" : "/logo.webp";
  if (worldLogoImg) worldLogoImg.src = dark ? "/logo-dark.png" : "/logo.jpg";
}

function applyColorScheme(theme) {
  const dark = theme === "dark";
  // Chromium / Samsung: announce a single scheme so Auto Dark won't invert us.
  document.documentElement.style.colorScheme = dark ? "dark" : "only light";
  colorSchemeMeta?.setAttribute("content", dark ? "dark" : "light");
  supportedColorSchemesMeta?.setAttribute("content", dark ? "dark" : "light");
  themeColorMeta?.setAttribute("content", dark ? "#0A0A0A" : "#F7E7E8");
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  applyColorScheme(theme);
  applyLogoTheme(theme);
  if (themeToggle) {
    themeToggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );
  }
}

applyTheme(resolveTheme());

themeToggle?.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* private mode */
  }
  applyTheme(next);
});

const onSystemThemeChange = () => {
  // Only auto-follow the OS when the user hasn't chosen manually.
  if (storedTheme()) return;
  applyTheme(resolveTheme());
};
if (typeof darkQuery.addEventListener === "function") {
  darkQuery.addEventListener("change", onSystemThemeChange);
} else if (typeof darkQuery.addListener === "function") {
  darkQuery.addListener(onSystemThemeChange);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatPlay(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

function renderClock(now) {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ms = now.getMilliseconds();
  const s = seconds + ms / 1000;
  const m = minutes + s / 60;
  const h = (hours % 12) + m / 60;

  navClock.dateTime = now.toISOString();
  navClock.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  hourHand.style.transform = `rotate(${h * 30}deg)`;
  minuteHand.style.transform = `rotate(${m * 6}deg)`;
  secondHand.style.transform = `rotate(${s * 6}deg)`;
}

const tilt = { x: 0, y: 0, tx: 0, ty: 0, ease: 0.14 };
const seat = { cx: 0, cy: 0, r: 1 };
const pointer = { x: 0, y: 0, active: false, dragging: false };
const motion = {
  enabled: false,
  pending: false,
  live: false,
  calibrated: false,
  beta0: 0,
  gamma0: 0,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function measureSeat() {
  const el = orbitScene || orbit;
  if (!el) return;
  const disc = el.getBoundingClientRect();
  seat.cx = disc.left + disc.width / 2;
  seat.cy = disc.top + disc.height / 2;
  seat.r = disc.width / 2;
}

function resetTilt() {
  pointer.active = false;
  pointer.dragging = false;
  if (coarsePointer) return;
  tilt.tx = 0;
  tilt.ty = 0;
  tilt.ease = 0.1;
  orbit?.classList.remove("is-tilting");
}

function applyIdleTilt() {
  const t = performance.now() / 1000;
  tilt.tx = Math.sin(t * 0.52) * 16 + Math.sin(t * 0.19) * 6;
  tilt.ty = Math.cos(t * 0.41) * 12 + Math.cos(t * 0.23) * 5;
  tilt.ease = 0.08;
  orbit?.classList.add("is-tilting");
}

function updateTiltTarget() {
  if (motion.live) return;
  if (!pointer.active) {
    if (coarsePointer) {
      applyIdleTilt();
      return;
    }
    tilt.tx = 0;
    tilt.ty = 0;
    tilt.ease = 0.1;
    return;
  }

  const dx = pointer.x - seat.cx;
  const dy = pointer.y - seat.cy;
  const radius = seat.r || 1;
  const distance = Math.hypot(dx, dy) / radius;
  const ux = distance > 0 ? dx / (distance * radius) : 0;
  const uy = distance > 0 ? dy / (distance * radius) : 0;
  const amount =
    distance <= 1
      ? distance
      : Math.max(0.5, 1 - (distance - 1) * 1.5);

  tilt.tx = ux * 40 * amount;
  tilt.ty = uy * -40 * amount;
  tilt.ease = 0.12;
}

function onPointer(event) {
  if (reduced || !orbit || !stage || motion.live) return;
  if (coarsePointer && !pointer.dragging) return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
  orbit.classList.add("is-tilting");
}

function onOrientation(event) {
  if (reduced || !orbit || !stage) return;
  const beta = Number(event?.beta);
  const gamma = Number(event?.gamma);
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;

  if (!motion.calibrated) {
    motion.beta0 = beta;
    motion.gamma0 = gamma;
    motion.calibrated = true;
  }

  const dBeta = beta - motion.beta0;
  const dGamma = gamma - motion.gamma0;
  tilt.tx = clamp(dGamma * 1.4, -40, 40);
  tilt.ty = clamp(-dBeta * 1.4, -40, 40);
  tilt.ease = 0.12;
  pointer.active = false;
  motion.live = true;
  orbit.classList.add("is-tilting");
}

function startMotion() {
  if (motion.enabled || reduced || !hasDeviceOrientation) return;
  window.addEventListener("deviceorientation", onOrientation, { passive: true });
  motion.enabled = true;
}

async function requestMotionAccess() {
  if (motion.enabled || motion.pending || reduced || !coarsePointer || !hasDeviceOrientation) {
    return;
  }
  motion.pending = true;
  try {
    if (needsMotionPermission) {
      const state = await window.DeviceOrientationEvent.requestPermission();
      if (state !== "granted") return;
    }
    startMotion();
  } catch {
    /* user denied or unsupported browser behavior */
  } finally {
    motion.pending = false;
  }
}

window.addEventListener("pointermove", onPointer, { passive: true });
window.addEventListener("pointerrawupdate", onPointer, { passive: true });
window.addEventListener("pointerout", (event) => {
  if (!event.relatedTarget) resetTilt();
});
window.addEventListener("blur", resetTilt);
if (coarsePointer && !needsMotionPermission) startMotion();
window.addEventListener(
  "pointerdown",
  () => {
    requestMotionAccess();
  },
  { passive: true },
);
measureSeat();
window.addEventListener("resize", measureSeat);
window.addEventListener("scroll", measureSeat, true);

function frame() {
  renderClock(new Date());

  const elapsed = player.playing ? performance.now() - player.stamp : 0;
  const pos = Math.min(player.position + elapsed, player.duration);
  const progress = pos / player.duration;
  trackProgress.style.strokeDashoffset = String(RING * (1 - progress));
  timeNow.textContent = formatPlay(pos);
  timeEnd.textContent = formatPlay(player.duration);

  if (
    player.playing &&
    !player.advancing &&
    player.duration > 2000 &&
    pos >= player.duration - 80
  ) {
    skip(1);
  }

  if (player.playing && !reduced) {
    const t = pos / 1000;
    waveBars.forEach((bar, i) => {
      const amp = 0.22 + hashWave(i, t) * 1.15;
      bar.style.transform = `scaleY(${amp})`;
    });
  }

  if (!reduced) {
    updateTiltTarget();
    tilt.x += (tilt.tx - tilt.x) * tilt.ease;
    tilt.y += (tilt.ty - tilt.y) * tilt.ease;
    orbit.style.transform = `rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`;
    if (
      !coarsePointer &&
      !pointer.active &&
      !motion.live &&
      Math.hypot(tilt.x, tilt.y) < 0.15
    ) {
      orbit.classList.remove("is-tilting");
    }
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const jump =
  new URLSearchParams(location.search).get("s") ||
  location.hash.replace(/^#/, "");
const sectionJump = jump && jump !== "top";

function pinTop() {
  if (sectionJump) return;
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

if (sectionJump) {
  const el = document.getElementById(jump);
  if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
} else {
  pinTop();
  requestAnimationFrame(pinTop);
  window.addEventListener("load", pinTop, { once: true });
  window.addEventListener("pageshow", pinTop);
}

const wave = document.getElementById("wave");
const trackProgress = document.getElementById("track-progress");
const titleText = document.getElementById("title-text");
const RING = 304;
const WAVE_COUNT = 64;

for (let i = 0; i < WAVE_COUNT; i += 1) {
  const bar = document.createElement("span");
  bar.className = "wave-bar";
  bar.style.transform = `rotate(${(i * 360) / WAVE_COUNT}deg)`;
  bar.innerHTML = "<i></i>";
  wave.appendChild(bar);
}

const waveBars = [...wave.querySelectorAll("i")];

const skipPrev = document.getElementById("skip-prev");
const skipNext = document.getElementById("skip-next");
const timeNow = document.getElementById("time-now");
const timeEnd = document.getElementById("time-end");

const TRACKS = [
  { uri: "spotify:track:6ZXiVlnnmkOPZ90cW6ga8U", title: "Handlebars" },
  { uri: "spotify:track:1GNDWFpxTNtdQPanMtqkC5", title: "Fingerprints" },
  { uri: "spotify:track:4gVg0HDiADxoncedPIUajX", title: "Into The Night" },
  { uri: "spotify:track:1XpRZiCQrNGLwFJBpiNIz0", title: "Off Limits" },
  { uri: "spotify:track:5uG6ANfQeDLSTtJTAZUiPr", title: "Paradise" },
  { uri: "spotify:track:67LvRZ7jgyPemFvX7hPhYh", title: "Sun's Coming" },
  { uri: "spotify:track:34cyNBqw6cPNlSNNYixX59", title: "Runaway" },
  { uri: "spotify:track:1knkae5sDqqnjfAsKey0qy", title: "Talk It Out" },
  { uri: "spotify:track:0Yc2wZ55F3qrWyrtvqFi9m", title: "Sunny Day" },
  { uri: "spotify:track:6OdywwGVRMGnX3X1PeWCok", title: "This Time" },
];

const player = {
  controller: null,
  queued: false,
  playing: false,
  position: 0,
  duration: 1,
  stamp: 0,
  uri: "",
  wanted: "",
  queue: TRACKS.map((track) => track.uri),
  index: 0,
  advancing: false,
  pauseRequested: false,
  visualUntil: 0,
};

let spotifyLoading = false;

function loadSpotifyApi() {
  if (player.controller || spotifyLoading) return;
  spotifyLoading = true;
  const spotifyApi = document.createElement("script");
  spotifyApi.src = "https://open.spotify.com/embed/iframe-api/v1";
  spotifyApi.async = true;
  document.body.appendChild(spotifyApi);
}

function rememberTrack(uri) {
  if (!uri || !String(uri).includes("track:")) return;
  const i = player.queue.indexOf(uri);
  if (i === -1) {
    player.queue.push(uri);
    player.index = player.queue.length - 1;
    return;
  }
  player.index = i;
}

function titleFor(uri) {
  return TRACKS.find((track) => track.uri === uri)?.title || "";
}

function hashWave(i, t) {
  return 0.5 + 0.5 * Math.sin(t * (1.7 + (i % 7) * 0.23) + i * 0.41);
}

const titleRing = titleText.closest(".track-title");
const progressRing = trackProgress.closest(".track-ring");
let titleFade = 0;

function setTitle(label) {
  const loop = `${label}  ·  `.repeat(6);
  if (titleText.textContent === loop) return;
  if (titleRing.classList.contains("is-fading")) {
    titleText.textContent = loop;
    requestAnimationFrame(() => titleRing.classList.remove("is-fading"));
    return;
  }
  if (!orbit.classList.contains("is-playing") || !titleText.textContent.trim()) {
    titleText.textContent = loop;
    return;
  }
  const token = ++titleFade;
  titleRing.classList.add("is-fading");
  window.setTimeout(() => {
    if (token !== titleFade) return;
    titleText.textContent = loop;
    titleRing.classList.remove("is-fading");
  }, 280);
}

setTitle("KEEP TIME");

async function resolveTitle(uri) {
  if (player.wanted && uri !== player.wanted) return;
  const known = titleFor(uri);
  if (known) {
    setTitle(known);
    return;
  }
  if (!uri || !uri.includes("track:")) return;
  const id = uri.split(":").pop();
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${id}`);
    if (!res.ok || (player.wanted && uri !== player.wanted)) return;
    const data = await res.json();
    if (data.title) setTitle(data.title.replace(/\s+[-–].*$/, "").trim());
  } catch {
    /* keep current title */
  }
}

function applyPlayback(data) {
  const uri = data.playingURI || "";
  if (player.wanted && uri && uri !== player.wanted) return;

  player.playing = !data.isPaused && !data.isBuffering;
  if (player.playing) player.pauseRequested = false;
  player.position = Number(data.position) || 0;
  player.duration = Math.max(Number(data.duration) || 1, 1);
  player.stamp = performance.now();
  const keepTransition =
    !player.pauseRequested && performance.now() < player.visualUntil;
  const isActive =
    player.playing ||
    player.advancing ||
    (!player.pauseRequested && data.isBuffering) ||
    keepTransition;
  orbit.classList.toggle("is-playing", isActive);
  stage.classList.toggle("is-playing", isActive);

  if (uri && uri !== player.uri) {
    player.uri = uri;
    rememberTrack(uri);
    resolveTitle(uri);
  }

  if (player.wanted && uri === player.wanted && player.playing) {
    if (player.position < player.duration - 1000) player.advancing = false;
  }

  if (player.advancing) return;
  if (player.duration <= 2000 || player.position < player.duration - 250) return;
  if (!data.isPaused && player.playing) return;
  skip(1);
}

function skip(step) {
  loadSpotifyApi();
  if (!player.controller || !player.queue.length) {
    player.queued = true;
    return;
  }
  player.index = (player.index + step + player.queue.length) % player.queue.length;
  const uri = player.queue[player.index];
  player.wanted = uri;
  player.uri = uri;
  player.playing = false;
  player.position = 0;
  player.duration = 1;
  player.advancing = true;
  player.pauseRequested = false;
  player.visualUntil = performance.now() + 2000;
  player.stamp = performance.now();
  titleRing.classList.add("is-fading");
  progressRing.classList.add("is-resetting");
  orbit.classList.add("is-playing");
  stage.classList.add("is-playing");
  let loading;
  if (typeof player.controller.loadEntity === "function") {
    loading = player.controller.loadEntity(uri);
  } else {
    loading = player.controller.loadUri(uri);
  }
  const playLoaded = () => {
    if (player.wanted !== uri || player.playing) return;
    player.controller.play();
  };
  if (loading && typeof loading.then === "function") {
    loading.then(playLoaded, playLoaded);
  } else {
    window.setTimeout(playLoaded, 120);
  }
}

function playEmbed() {
  requestMotionAccess();
  stage.classList.add("is-live");
  loadSpotifyApi();
  if (player.controller) {
    if (player.playing) {
      player.pauseRequested = true;
    } else {
      player.pauseRequested = false;
      player.visualUntil = performance.now() + 2000;
      orbit.classList.add("is-playing");
      stage.classList.add("is-playing");
    }
    player.controller.togglePlay();
    return;
  }
  player.queued = true;
}

document.getElementById("hero-listen")?.addEventListener("click", () => {
  playEmbed();
});

let press = null;
orbit.addEventListener("pointerdown", (event) => {
  requestMotionAccess();
  orbit.setPointerCapture(event.pointerId);
  press = { id: event.pointerId, x: event.clientX, y: event.clientY };
  if (coarsePointer) {
    pointer.dragging = true;
    onPointer(event);
  }
});

orbit.addEventListener("pointerup", (event) => {
  if (!press || press.id !== event.pointerId) return;
  const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
  if (orbit.hasPointerCapture(event.pointerId)) {
    orbit.releasePointerCapture(event.pointerId);
  }
  press = null;
  pointer.dragging = false;
  pointer.active = false;
  if (moved > 12) return;
  requestMotionAccess();
  playEmbed();
});

orbit.addEventListener("pointercancel", () => {
  press = null;
  pointer.dragging = false;
  pointer.active = false;
});

skipPrev.addEventListener("click", (event) => {
  event.stopPropagation();
  requestMotionAccess();
  stage.classList.add("is-live");
  skip(-1);
});

skipNext.addEventListener("click", (event) => {
  event.stopPropagation();
  requestMotionAccess();
  stage.classList.add("is-live");
  skip(1);
});

orbit.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    playEmbed();
  }
});

window.onSpotifyIframeApiReady = (IFrameAPI) => {
  const element = document.getElementById("embed-iframe");
  if (!element) return;
  IFrameAPI.createController(
    element,
    {
      uri: "spotify:artist:7xCL2844XqfWaBLZtVDAmz",
      width: "100%",
      height: "352",
    },
    (controller) => {
      player.controller = controller;
      controller.addListener("playback_started", (event) => {
        const uri = event?.data?.playingURI || "";
        if (player.wanted && uri && uri !== player.wanted) return;
        if (uri) resolveTitle(uri);
        requestAnimationFrame(() => progressRing.classList.remove("is-resetting"));
        if (event?.data) {
          applyPlayback({
            ...event.data,
            isPaused: false,
            isBuffering: false,
            position: 0,
            duration: Number(event.data.duration) || player.duration,
          });
        }
      });
      controller.addListener("playback_update", (event) => {
        if (event?.data) applyPlayback(event.data);
      });
      if (player.queued) {
        player.queued = false;
        stage.classList.add("is-live");
        controller.togglePlay();
      }
    },
  );
};

/* Reveal panels on scroll */
const revealPanels = document.querySelectorAll(".panel.reveal");
if (reduced) {
  revealPanels.forEach((panel) => panel.classList.add("is-in"));
} else if ("IntersectionObserver" in window) {
  const revealIo = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        revealIo.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
  );
  revealPanels.forEach((panel) => revealIo.observe(panel));
} else {
  revealPanels.forEach((panel) => panel.classList.add("is-in"));
}

/* Load Spotify shortly before its visible section enters the viewport. */
const listenSection = document.getElementById("listen");
if (listenSection && "IntersectionObserver" in window) {
  const listenIo = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      loadSpotifyApi();
      listenIo.disconnect();
    },
    { rootMargin: "200px 0px" },
  );
  listenIo.observe(listenSection);
}

/* Nav active section */
const navLinks = [...document.querySelectorAll(".nav-links a")];
const sections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function updateActiveNav() {
  const y = window.scrollY + 120;
  let current = sections[0];
  for (const section of sections) {
    if (section.offsetTop <= y) current = section;
  }
  navLinks.forEach((link) => {
    const match = link.getAttribute("href") === `#${current?.id}`;
    link.classList.toggle("is-active", match);
  });
}

window.addEventListener("scroll", updateActiveNav, { passive: true });
updateActiveNav();

/* World visual tilt */
const worldVisual = document.getElementById("world-visual");
if (worldVisual && !reduced && window.matchMedia("(pointer: fine)").matches) {
  worldVisual.addEventListener(
    "pointermove",
    (event) => {
      const rect = worldVisual.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      worldVisual.style.transform = `rotateY(${px * 8}deg) rotateX(${py * -6}deg) scale(1.01)`;
    },
    { passive: true },
  );
  worldVisual.addEventListener("pointerleave", () => {
    worldVisual.style.transform = "";
  });
}
