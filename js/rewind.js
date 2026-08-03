import { likePhoto } from "./data.js";
import { config, escapeHtml, getLikedPhotoIds } from "./utils.js";

const app = document.getElementById("app");
const SLIDE_DURATION = 6500;
const DEFAULT_SETTINGS = {
  fun_stats: [
    { emoji: "🌭", value: "427", label: "hot dogs demolished" },
    { emoji: "🐕", value: "36", label: "dogs in attendance" },
    { emoji: "🟡", value: "1,284", label: "mustard packets sacrificed" }
  ],
  closing_title: "Thanks for making the crawl legendary.",
  closing_body: "Charlotte showed up, passed the hot dogs around, and made one very strange little piece of history together."
};

let slides = [];
let currentIndex = 0;
let timer = null;
let startedAt = 0;
let remaining = SLIDE_DURATION;
let paused = false;
let photosById = new Map();

function headers() {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`
  };
}

async function api(path) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { headers: headers() });
  if (!response.ok) throw new Error(`Could not load the rewind (${response.status}).`);
  return response.json();
}

function imageUrl(path) {
  return `${config.supabaseUrl}/storage/v1/object/public/photos/${path}`;
}

function normalizePhoto(photo) {
  return {
    ...photo,
    like_count: Number(photo.like_count || 0),
    image_url: imageUrl(photo.image_path),
    hotdog_number: photo.hotdogs?.printed_number ?? null,
    hotdog_code: photo.hotdogs?.public_code || null
  };
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function neighborhoodFor(photo) {
  const text = `${photo.place_name || ""} ${photo.location_detail || ""}`.toLowerCase();
  if (text.includes("plaza midwood") || text.includes("the plaza")) return "Plaza Midwood";
  if (text.includes("noda") || text.includes("north davidson")) return "NoDa";
  if (text.includes("uptown") || text.includes("center city")) return "Uptown";
  if (text.includes("south end") || text.includes("southend")) return "South End";
  if (text.includes("loso") || text.includes("lower south end")) return "LoSo";
  return "Other Charlotte";
}

function buildSlides(photos, settings) {
  const randomPhotos = shuffle(photos).slice(0, 8);
  const topPhoto = [...photos].sort((a, b) => b.like_count - a.like_count)[0] || null;
  const places = new Set(photos.map((photo) => `${photo.place_name}|${photo.location_detail || ""}`));
  const dogs = new Set(photos.map((photo) => photo.hotdog_number ?? photo.hotdog_code).filter(Boolean));
  const totalLikes = photos.reduce((sum, photo) => sum + photo.like_count, 0);
  const neighborhoodCounts = new Map();
  photos.forEach((photo) => {
    const name = neighborhoodFor(photo);
    neighborhoodCounts.set(name, (neighborhoodCounts.get(name) || 0) + 1);
  });
  const neighborhoods = [...neighborhoodCounts.entries()].sort((a, b) => b[1] - a[1]);
  const fun = Array.isArray(settings.fun_stats) && settings.fun_stats.length
    ? settings.fun_stats
    : DEFAULT_SETTINGS.fun_stats;

  const result = [
    { type: "opening" },
    { type: "real-stats", photos: photos.length, dogs: dogs.size, places: places.size, likes: totalLikes }
  ];

  randomPhotos.slice(0, 2).forEach((photo) => result.push({ type: "photo", photo }));
  result.push({ type: "fun-stat", stat: fun[0] || DEFAULT_SETTINGS.fun_stats[0] });
  randomPhotos.slice(2, 4).forEach((photo) => result.push({ type: "photo", photo }));
  result.push({ type: "map", neighborhoods, places: places.size });
  randomPhotos.slice(4, 6).forEach((photo) => result.push({ type: "photo", photo }));
  result.push({ type: "fun-stat", stat: fun[1] || fun[0] || DEFAULT_SETTINGS.fun_stats[1] });
  randomPhotos.slice(6, 8).forEach((photo) => result.push({ type: "photo", photo }));
  if (topPhoto) result.push({ type: "favorite", photo: topPhoto });
  result.push({ type: "fun-stat", stat: fun[2] || fun[0] || DEFAULT_SETTINGS.fun_stats[2] });
  result.push({
    type: "closing",
    title: settings.closing_title || DEFAULT_SETTINGS.closing_title,
    body: settings.closing_body || DEFAULT_SETTINGS.closing_body
  });
  return result;
}

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    :root { color-scheme: dark; }
    body { margin: 0; min-width: 320px; background: #160d0b; color: white; overflow: hidden; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    .rewind { position: relative; min-height: 100dvh; background: radial-gradient(circle at top, #8f2f26 0, #3a1713 44%, #160d0b 100%); overflow: hidden; }
    .rewind-progress { position: fixed; z-index: 30; top: max(10px, env(safe-area-inset-top)); left: 12px; right: 58px; display: grid; grid-template-columns: repeat(var(--slide-count), 1fr); gap: 4px; }
    .rewind-progress span { height: 3px; overflow: hidden; border-radius: 99px; background: rgba(255,255,255,.28); }
    .rewind-progress i { display: block; width: 0; height: 100%; background: white; border-radius: inherit; }
    .rewind-close { position: fixed; z-index: 35; top: max(4px, calc(env(safe-area-inset-top) + 1px)); right: 8px; width: 44px; height: 44px; border: 0; border-radius: 50%; background: rgba(0,0,0,.28); color: white; font-size: 28px; }
    .rewind-stage { min-height: 100dvh; display: grid; place-items: center; }
    .rewind-slide { position: absolute; inset: 0; display: grid; align-content: center; justify-items: center; padding: calc(56px + env(safe-area-inset-top)) 24px calc(34px + env(safe-area-inset-bottom)); text-align: center; }
    .rewind-slide h1, .rewind-slide h2 { max-width: 760px; margin: 0; line-height: .98; letter-spacing: -.045em; }
    .rewind-slide h1 { font-size: clamp(42px, 12vw, 92px); }
    .rewind-slide h2 { font-size: clamp(35px, 10vw, 76px); }
    .rewind-slide p { max-width: 620px; margin: 18px auto 0; color: rgba(255,255,255,.84); font-size: clamp(17px, 4.5vw, 23px); line-height: 1.45; }
    .rewind-kicker { margin-bottom: 14px; font-size: 13px; font-weight: 850; letter-spacing: .16em; text-transform: uppercase; color: #ffd76b; }
    .rewind-hotdog { font-size: clamp(90px, 28vw, 190px); filter: drop-shadow(0 18px 30px rgba(0,0,0,.32)); }
    .rewind-stat-grid { width: min(720px, 100%); display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 30px; }
    .rewind-stat { padding: 20px 12px; border: 1px solid rgba(255,255,255,.18); border-radius: 22px; background: rgba(255,255,255,.1); backdrop-filter: blur(12px); }
    .rewind-stat strong { display: block; font-size: clamp(34px, 9vw, 62px); line-height: 1; }
    .rewind-stat span { display: block; margin-top: 7px; color: rgba(255,255,255,.76); font-size: 14px; }
    .rewind-photo-slide { padding-left: 0; padding-right: 0; padding-bottom: 0; align-content: stretch; }
    .rewind-photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .rewind-photo-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.02) 42%, rgba(0,0,0,.88)); }
    .rewind-photo-copy { position: absolute; z-index: 4; left: 20px; right: 20px; bottom: calc(24px + env(safe-area-inset-bottom)); text-align: left; }
    .rewind-photo-copy h2 { font-size: clamp(30px, 8vw, 52px); }
    .rewind-photo-copy p { margin: 8px 0 0; font-size: 16px; }
    .rewind-photo-actions { display: flex; gap: 10px; margin-top: 16px; }
    .rewind-button { min-height: 46px; padding: 11px 16px; border: 1px solid rgba(255,255,255,.28); border-radius: 999px; background: rgba(0,0,0,.38); color: white; font: inherit; font-weight: 800; text-decoration: none; backdrop-filter: blur(10px); }
    .rewind-button.primary { background: white; color: #4b1712; border-color: white; }
    .rewind-button.liked { background: #fff0ee; color: #a12520; }
    .rewind-fun-number { font-size: clamp(74px, 22vw, 160px); line-height: .9; font-weight: 950; letter-spacing: -.06em; }
    .rewind-fun-emoji { font-size: clamp(70px, 21vw, 145px); }
    .rewind-map-list { width: min(640px, 100%); display: grid; gap: 9px; margin-top: 26px; text-align: left; }
    .rewind-map-row { display: flex; justify-content: space-between; gap: 14px; padding: 13px 16px; border-radius: 16px; background: rgba(255,255,255,.1); }
    .rewind-ending-actions { width: min(560px, 100%); display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 24px; }
    .rewind-ending-actions .rewind-button { display: grid; place-items: center; border-radius: 16px; }
    .rewind-ending-actions .wide { grid-column: 1 / -1; }
    .rewind-tap-zone { position: fixed; z-index: 20; top: 52px; bottom: 0; width: 38%; background: transparent; border: 0; }
    .rewind-tap-zone.prev { left: 0; }
    .rewind-tap-zone.next { right: 0; }
    .rewind-error { min-height: 100dvh; display: grid; place-items: center; padding: 28px; text-align: center; }
    @media (min-width: 720px) { .rewind { width: min(480px, 100%); margin: 0 auto; box-shadow: 0 0 80px rgba(0,0,0,.65); } .rewind-progress, .rewind-close { position: absolute; } }
  `;
  document.head.appendChild(style);
}

function photoSlideMarkup(photo, favorite = false) {
  const liked = getLikedPhotoIds().has(photo.id);
  const dog = photo.hotdog_number != null ? `Hot Dog #${photo.hotdog_number}` : "Community memory";
  return `
    <section class="rewind-slide rewind-photo-slide">
      <img class="rewind-photo" src="${escapeHtml(photo.image_url)}" alt="Hot dog crawl memory at ${escapeHtml(photo.place_name)}" />
      <div class="rewind-photo-shade"></div>
      <div class="rewind-photo-copy">
        <div class="rewind-kicker">${favorite ? "Community favorite" : dog}</div>
        <h2>${escapeHtml(photo.place_name)}</h2>
        <p>${escapeHtml(photo.location_detail || "Charlotte")} · <span data-like-count>${photo.like_count}</span> likes</p>
        <div class="rewind-photo-actions">
          <button class="rewind-button ${liked ? "liked" : ""}" type="button" data-like-photo="${escapeHtml(photo.id)}">${liked ? "♥ Liked" : "♡ Like this photo"}</button>
          <a class="rewind-button" href="/#/feed?focus=${encodeURIComponent(photo.id)}">View in feed</a>
        </div>
      </div>
    </section>
  `;
}

function slideMarkup(slide) {
  if (slide.type === "opening") return `
    <section class="rewind-slide">
      <div class="rewind-hotdog" aria-hidden="true">🌭</div>
      <div class="rewind-kicker">Charlotte · August 1, 2026</div>
      <h1>The Hot Dog Bar Crawl Rewind</h1>
      <p>One city. A lot of hot dogs. Even more questionable decisions.</p>
    </section>`;
  if (slide.type === "real-stats") return `
    <section class="rewind-slide">
      <div class="rewind-kicker">The official numbers</div>
      <h2>Charlotte understood the assignment.</h2>
      <div class="rewind-stat-grid">
        <div class="rewind-stat"><strong>${slide.photos}</strong><span>photos shared</span></div>
        <div class="rewind-stat"><strong>${slide.dogs}</strong><span>hot dogs spotted</span></div>
        <div class="rewind-stat"><strong>${slide.places}</strong><span>places visited</span></div>
        <div class="rewind-stat"><strong>${slide.likes}</strong><span>community likes</span></div>
      </div>
    </section>`;
  if (slide.type === "photo") return photoSlideMarkup(slide.photo);
  if (slide.type === "favorite") return photoSlideMarkup(slide.photo, true);
  if (slide.type === "fun-stat") return `
    <section class="rewind-slide">
      <div class="rewind-kicker">Totally unofficial · spiritually accurate</div>
      <div class="rewind-fun-emoji" aria-hidden="true">${escapeHtml(slide.stat.emoji || "🌭")}</div>
      <div class="rewind-fun-number">${escapeHtml(String(slide.stat.value || "A lot"))}</div>
      <h2>${escapeHtml(slide.stat.label || "memories made")}</h2>
    </section>`;
  if (slide.type === "map") return `
    <section class="rewind-slide">
      <div class="rewind-kicker">Across Charlotte</div>
      <h2>${slide.places} stops became part of the story.</h2>
      <div class="rewind-map-list">
        ${slide.neighborhoods.slice(0, 5).map(([name, count]) => `<div class="rewind-map-row"><strong>${escapeHtml(name)}</strong><span>${count} photo${count === 1 ? "" : "s"}</span></div>`).join("")}
      </div>
    </section>`;
  return `
    <section class="rewind-slide">
      <div class="rewind-hotdog" aria-hidden="true">🌭</div>
      <div class="rewind-kicker">That’s a wrap</div>
      <h2>${escapeHtml(slide.title)}</h2>
      <p>${escapeHtml(slide.body)}</p>
      <div class="rewind-ending-actions">
        <button class="rewind-button primary wide" type="button" data-share-rewind>Share the rewind</button>
        <button class="rewind-button" type="button" data-replay>Watch again</button>
        <a class="rewind-button" href="/#/feed">Photo feed</a>
        <a class="rewind-button" href="/#/map">Community map</a>
        <a class="rewind-button" href="/#/event">Event guide</a>
        <a class="rewind-button" href="/#/journey">Dog journeys</a>
        <a class="rewind-button" href="/#/upload">Add a photo</a>
      </div>
    </section>`;
}

function progressMarkup() {
  return `<div class="rewind-progress" style="--slide-count:${slides.length}" aria-label="Rewind progress">${slides.map((_, index) => `<span><i data-progress="${index}"></i></span>`).join("")}</div>`;
}

function render() {
  const slide = slides[currentIndex];
  app.innerHTML = `
    <main class="rewind">
      ${progressMarkup()}
      <button class="rewind-close" type="button" data-close aria-label="Close rewind">×</button>
      <div class="rewind-stage">${slideMarkup(slide)}</div>
      <button class="rewind-tap-zone prev" type="button" data-prev aria-label="Previous slide"></button>
      <button class="rewind-tap-zone next" type="button" data-next aria-label="Next slide"></button>
    </main>`;
  document.querySelectorAll("[data-progress]").forEach((bar) => {
    const index = Number(bar.dataset.progress);
    bar.style.width = index < currentIndex ? "100%" : "0%";
  });
  attachEvents();
  startTimer();
}

function stopTimer() {
  if (timer) cancelAnimationFrame(timer);
  timer = null;
}

function startTimer() {
  stopTimer();
  remaining = currentIndex === slides.length - 1 ? 12000 : SLIDE_DURATION;
  startedAt = performance.now();
  paused = false;
  tick();
}

function tick(now = performance.now()) {
  if (paused) return;
  const elapsed = now - startedAt;
  const percent = Math.min(100, (elapsed / remaining) * 100);
  const bar = document.querySelector(`[data-progress="${currentIndex}"]`);
  if (bar) bar.style.width = `${percent}%`;
  if (percent >= 100) {
    next();
    return;
  }
  timer = requestAnimationFrame(tick);
}

function pause() {
  if (paused) return;
  paused = true;
  remaining -= performance.now() - startedAt;
  stopTimer();
}

function resume() {
  if (!paused) return;
  paused = false;
  startedAt = performance.now();
  tick();
}

function next() {
  stopTimer();
  if (currentIndex >= slides.length - 1) return;
  currentIndex += 1;
  render();
}

function previous() {
  stopTimer();
  currentIndex = Math.max(0, currentIndex - 1);
  render();
}

async function handleLike(button) {
  const photoId = button.dataset.likePhoto;
  if (!photoId || getLikedPhotoIds().has(photoId)) return;
  button.disabled = true;
  pause();
  try {
    const result = await likePhoto(photoId);
    button.classList.add("liked");
    button.textContent = "♥ Liked";
    if (!result.duplicate) {
      const photo = photosById.get(photoId);
      if (photo) photo.like_count += 1;
      const count = button.closest(".rewind-photo-copy")?.querySelector("[data-like-count]");
      if (count) count.textContent = String(Number(count.textContent || 0) + 1);
    }
  } catch {
    button.textContent = "Could not like";
    button.disabled = false;
  } finally {
    window.setTimeout(resume, 350);
  }
}

async function shareRewind() {
  const shareData = {
    title: "2026 CLT Hot Dog Bar Crawl Rewind",
    text: "Relive the hot dogs, photos, and chaos from Charlotte’s 2026 Hot Dog Bar Crawl.",
    url: `${window.location.origin}/rewind`
  };
  if (navigator.share) {
    try { await navigator.share(shareData); return; } catch (error) { if (error?.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(shareData.url);
    const button = document.querySelector("[data-share-rewind]");
    if (button) button.textContent = "Link copied!";
  } catch {
    window.prompt("Copy this rewind link:", shareData.url);
  }
}

function attachEvents() {
  document.querySelector("[data-close]")?.addEventListener("click", () => { window.location.href = "/#/feed"; });
  document.querySelector("[data-next]")?.addEventListener("click", next);
  document.querySelector("[data-prev]")?.addEventListener("click", previous);
  document.querySelector("[data-like-photo]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    handleLike(event.currentTarget);
  });
  document.querySelector("[data-replay]")?.addEventListener("click", () => {
    currentIndex = 0;
    slides = buildSlides([...photosById.values()], window.__rewindSettings || DEFAULT_SETTINGS);
    render();
  });
  document.querySelector("[data-share-rewind]")?.addEventListener("click", shareRewind);
  const stage = document.querySelector(".rewind-stage");
  stage?.addEventListener("pointerdown", pause);
  stage?.addEventListener("pointerup", resume);
  stage?.addEventListener("pointercancel", resume);
}

async function initialize() {
  injectStyles();
  document.title = "2026 CLT Hot Dog Bar Crawl Rewind";
  try {
    const [photoRows, settingRows] = await Promise.all([
      api(`photos?select=${encodeURIComponent("id,image_path,place_name,location_detail,like_count,created_at,status,hotdogs(public_code,printed_number)")}&status=eq.visible&order=created_at.desc&limit=500`),
      api("rewind_settings?select=fun_stats,closing_title,closing_body&id=eq.1&limit=1")
    ]);
    const photos = photoRows.map(normalizePhoto);
    photosById = new Map(photos.map((photo) => [photo.id, photo]));
    const settings = settingRows[0] || DEFAULT_SETTINGS;
    window.__rewindSettings = settings;
    slides = buildSlides(photos, settings);
    render();
  } catch (error) {
    app.innerHTML = `<main class="rewind-error"><div><div class="rewind-hotdog">🌭</div><h1>Could not load the rewind</h1><p>${escapeHtml(error.message)}</p><a class="rewind-button" href="/#/feed">Return to the feed</a></div></main>`;
  }
}

initialize();
