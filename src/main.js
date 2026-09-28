import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/400-italic.css";
import "./style.css";

const THEME_KEY = "kt-theme";
const root = document.documentElement;
const toggle = document.getElementById("theme-toggle");
const themeLabel = document.getElementById("theme-label");
const themeColor = document.getElementById("theme-color");
const colorSchemeMeta = document.getElementById("color-scheme");
const supportedColorSchemes = document.getElementById("supported-color-schemes");
const clock = document.getElementById("nav-clock");

document.getElementById("year").textContent = String(new Date().getFullYear());

function applyTheme(theme) {
  const dark = theme === "dark";
  root.dataset.theme = theme;
  root.style.colorScheme = dark ? "only dark" : "only light";
  themeColor?.setAttribute("content", dark ? "#0A0A0A" : "#F7E7E8");
  colorSchemeMeta?.setAttribute("content", dark ? "dark" : "light");
  supportedColorSchemes?.setAttribute("content", dark ? "dark" : "light");
  if (themeLabel) themeLabel.textContent = dark ? "night" : "day";
  toggle?.setAttribute("aria-label", dark ? "Switch to day" : "Switch to night");
}

applyTheme(root.dataset.theme === "dark" ? "dark" : "light");

toggle?.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
  applyTheme(next);
});

const pad = (n) => String(n).padStart(2, "0");
function tick() {
  const now = new Date();
  clock.dateTime = now.toISOString();
  clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
tick();
setInterval(tick, 1000);

// Opens the visitor's mail app. No server, no form service.
const MEMORY_TO = "welcome2hills@gmail.com";
const form = document.getElementById("memory-form");
const sent = document.getElementById("memory-sent");
form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const year = String(data.year || "").trim();
  const subject = `Memory — ${data.song}${year ? ` (${year})` : ""}`;
  const body = `${data.memory}\n\nSong: ${data.song}${year ? `\nYear: ${year}` : ""}`;
  window.location.href = `mailto:${MEMORY_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (sent) sent.hidden = false;
});
