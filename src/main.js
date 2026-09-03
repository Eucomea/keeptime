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
const pointer = { x: 0, y: 0, active: false };
const scrollLock = { active: false, x: 0, y: 0, releaseTimer: 0 };

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
  tilt.tx = 0;
  tilt.ty = 0;
  tilt.ease = 0.1;
  orbit?.classList.remove("is-tilting");
}

function updateTiltTarget() {
  if (!pointer.active) {
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
  if (reduced || !orbit || !stage) return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
  orbit.classList.add("is-tilting");
}

window.addEventListener("pointermove", onPointer, { passive: true });
window.addEventListener("pointerrawupdate", onPointer, { passive: true });
window.addEventListener("pointerout", (event) => {
  if (!event.relatedTarget) resetTilt();
});
window.addEventListener("blur", resetTilt);
measureSeat();
window.addEventListener("resize", measureSeat);
window.addEventListener("scroll", measureSeat, true);

function frame() {
  renderClock(new Date());

  if (
    scrollLock.active &&
    (window.scrollX !== scrollLock.x || window.scrollY !== scrollLock.y)
  ) {
    window.scrollTo(scrollLock.x, scrollLock.y);
  }

  const elapsed = player.playing ? performance.now() - player.stamp : 0;
  const pos = Math.min(player.position + elapsed, player.duration);
  const progress = pos / player.duration;
  trackProgress.style.strokeDashoffset = String(RING * (1 - progress));
  timeNow.textContent = formatPlay(pos);
  timeEnd.textContent = formatPlay(player.duration);

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
    if (!pointer.active && Math.hypot(tilt.x, tilt.y) < 0.15) {
      orbit.classList.remove("is-tilting");
    }
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

const jump = new URLSearchParams(location.search).get("s") || location.hash.replace("#", "");
if (jump) {
  const el = document.getElementById(jump);
  if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
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
  pendingPlay: false,
  playing: false,
  position: 0,
  duration: 1,
  stamp: 0,
  uri: "",
  wanted: "",
  queue: TRACKS.map((track) => track.uri),
  index: 0,
  advancing: false,
};

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
let titleFade = 0;

function setTitle(label) {
  const loop = `${label}  ·  `.repeat(6);
  if (titleText.textContent === loop) return;
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
  player.position = Number(data.position) || 0;
  player.duration = Math.max(Number(data.duration) || 1, 1);
  player.stamp = performance.now();
  orbit.classList.toggle("is-playing", player.playing || player.advancing);

  if (uri && uri !== player.uri) {
    player.uri = uri;
    rememberTrack(uri);
    resolveTitle(uri);
  }

  if (player.wanted && uri === player.wanted && player.playing) {
    if (player.pendingPlay) {
      player.pendingPlay = false;
      releaseScroll();
    }
    if (player.position < player.duration - 1000) player.advancing = false;
  }

  if (player.advancing) return;
  if (player.duration <= 2000 || player.position < player.duration - 250) return;
  if (!data.isPaused && player.playing) return;
  skip(1);
}

function lockScroll() {
  window.clearTimeout(scrollLock.releaseTimer);
  scrollLock.x = window.scrollX;
  scrollLock.y = window.scrollY;
  scrollLock.active = true;
  scrollLock.releaseTimer = window.setTimeout(() => {
    window.scrollTo(scrollLock.x, scrollLock.y);
    scrollLock.active = false;
    measureSeat();
  }, 6000);
}

function releaseScroll() {
  window.clearTimeout(scrollLock.releaseTimer);
  scrollLock.releaseTimer = window.setTimeout(() => {
    window.scrollTo(scrollLock.x, scrollLock.y);
    scrollLock.active = false;
    measureSeat();
  }, 800);
}

function skip(step) {
  if (!player.controller || !player.queue.length) return;
  lockScroll();
  player.index = (player.index + step + player.queue.length) % player.queue.length;
  const uri = player.queue[player.index];
  player.wanted = uri;
  player.uri = uri;
  player.position = 0;
  player.duration = 1;
  player.advancing = true;
  player.pendingPlay = true;
  player.stamp = performance.now();
  resolveTitle(uri);
  orbit.classList.add("is-playing");
  if (typeof player.controller.loadEntity === "function") {
    player.controller.loadEntity(uri);
  } else {
    player.controller.loadUri(uri);
  }
  player.controller.play();
}

function playEmbed() {
  stage.classList.add("is-live");
  if (player.controller) {
    player.controller.togglePlay();
    return;
  }
  player.queued = true;
}

let press = null;
orbit.addEventListener("pointerdown", (event) => {
  orbit.setPointerCapture(event.pointerId);
  press = { id: event.pointerId, x: event.clientX, y: event.clientY };
});

orbit.addEventListener("pointerup", (event) => {
  if (!press || press.id !== event.pointerId) return;
  const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
  if (orbit.hasPointerCapture(event.pointerId)) {
    orbit.releasePointerCapture(event.pointerId);
  }
  press = null;
  if (moved > 12) return;
  playEmbed();
});

orbit.addEventListener("pointercancel", () => {
  press = null;
});

skipPrev.addEventListener("click", (event) => {
  event.stopPropagation();
  stage.classList.add("is-live");
  skip(-1);
});

skipNext.addEventListener("click", (event) => {
  event.stopPropagation();
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
      controller.addListener("ready", () => {
        if (player.pendingPlay && !player.playing) player.controller.play();
      });
      controller.addListener("playback_started", (event) => {
        const uri = event?.data?.playingURI || "";
        if (player.wanted && uri && uri !== player.wanted) return;
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

const spotifyApi = document.createElement("script");
spotifyApi.src = "https://open.spotify.com/embed/iframe-api/v1";
spotifyApi.async = true;
document.body.appendChild(spotifyApi);
