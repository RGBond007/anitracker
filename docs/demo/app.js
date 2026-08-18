const STORAGE_KEY = "anitracker-demo-library-v1";

const catalog = [
  { id: 1, title: "Frieren: Beyond Journey's End", year: 2023, format: "TV", total: 28, summary: "An elf mage retraces the journey that changed her, long after the adventure ended.", colors: ["#48656a", "#b6b8a5"] },
  { id: 2, title: "Vinland Saga", year: 2019, format: "TV", total: 24, summary: "A young warrior searches for meaning beyond revenge in an age of conquest.", colors: ["#713d2e", "#c89a66"] },
  { id: 3, title: "Dungeon Meshi", year: 2024, format: "TV", total: 24, summary: "A hungry adventuring party cooks its way through a dangerous living dungeon.", colors: ["#446246", "#d0b96f"] },
  { id: 4, title: "Pluto", year: 2023, format: "ONA", total: 8, summary: "A detective follows a chain of murders connecting the world's greatest robots.", colors: ["#374963", "#ab766a"] },
  { id: 5, title: "Mob Psycho 100", year: 2016, format: "TV", total: 12, summary: "A quiet psychic learns that growing up takes more than overwhelming power.", colors: ["#614b78", "#cf8ca1"] },
  { id: 6, title: "Keep Your Hands Off Eizouken!", year: 2020, format: "TV", total: 12, summary: "Three students turn wild imagination into the hard work of making animation.", colors: ["#397277", "#d59d55"] },
  { id: 7, title: "Blue Period", year: 2021, format: "TV", total: 12, summary: "A restless student discovers painting and commits himself to an uncertain path.", colors: ["#36537a", "#e1cbb1"] },
  { id: 8, title: "Odd Taxi", year: 2021, format: "TV", total: 13, summary: "A quiet taxi driver becomes entangled in the disappearance of a schoolgirl.", colors: ["#455261", "#b48555"] },
];

const defaultLibrary = [
  { id: 2, status: "watching", progress: 7 },
  { id: 3, status: "watching", progress: 14 },
  { id: 4, status: "completed", progress: 8 },
];

const state = {
  view: "dashboard",
  query: "",
  filter: "all",
  justAdded: null,
  library: loadLibrary(),
};

const root = document.getElementById("content");
const toast = document.querySelector(".toast");
let toastTimer;

function loadLibrary() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(value) ? value : structuredClone(defaultLibrary);
  } catch {
    return structuredClone(defaultLibrary);
  }
}

function saveLibrary() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.library));
  } catch {
    // The demo remains usable when a privacy mode blocks browser storage.
  }
  document.querySelectorAll("[data-library-count]").forEach((node) => {
    node.textContent = String(state.library.length);
  });
}

function escapeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function mediaFor(entry) {
  return { ...catalog.find((item) => item.id === entry.id), ...entry };
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function setView(view) {
  state.view = view;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function poster(item, index) {
  return `<div class="poster" style="--poster-a:${item.colors[0]};--poster-b:${item.colors[1]}">
    <span class="format-tag">${item.format}</span>
    <span class="poster-index">${String(index + 1).padStart(2, "0")}</span>
    <span class="watch-stamp">Added<br>to list</span>
  </div>`;
}

function searchCard(item, index) {
  const inLibrary = state.library.some((entry) => entry.id === item.id);
  return `<article class="media-card ${state.justAdded === item.id ? "just-added" : ""}">
    ${poster(item, index)}
    <div class="card-body">
      <p class="card-kicker">${item.year} · ${item.total} episodes</p>
      <h3>${item.title}</h3>
      <p class="card-summary">${item.summary}</p>
      <button class="card-action ${inLibrary ? "added" : ""}" type="button" data-add="${item.id}" ${inLibrary ? "disabled" : ""}>${inLibrary ? "In your library" : "+ Add to library"}</button>
    </div>
  </article>`;
}

function libraryCard(entry, index) {
  const item = mediaFor(entry);
  const percentage = Math.round((item.progress / item.total) * 100);
  return `<article class="media-card">
    ${poster(item, index)}
    <div class="card-body">
      <p class="card-kicker">${item.year} · ${item.format}</p>
      <h3>${item.title}</h3>
      <div class="progress-meta"><span>Progress</span><strong>${item.progress} / ${item.total}</strong></div>
      <div class="progress-track" aria-hidden="true"><span style="width:${percentage}%"></span></div>
      <div class="progress-controls">
        <button type="button" data-progress="-1" data-id="${item.id}" aria-label="Decrease ${item.title} progress">−</button>
        <select data-status data-id="${item.id}" aria-label="Status for ${item.title}">
          ${statusOptions(item.status)}
        </select>
        <button type="button" data-progress="1" data-id="${item.id}" aria-label="Increase ${item.title} progress">+</button>
      </div>
      <button class="remove-button" type="button" data-remove="${item.id}">Remove from demo library</button>
    </div>
  </article>`;
}

function statusOptions(selected) {
  return [
    ["watching", "Watching"],
    ["completed", "Completed"],
    ["on_hold", "On hold"],
    ["dropped", "Dropped"],
    ["planning", "Plan to watch"],
  ].map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
}

function pageHeading(kicker, title, copy) {
  return `<header class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1></div><p>${copy}</p></header>`;
}

function renderDashboard() {
  const items = state.library.map(mediaFor);
  const watching = items.filter((item) => item.status === "watching");
  const completed = items.filter((item) => item.status === "completed").length;
  const episodes = items.reduce((sum, item) => sum + item.progress, 0);

  return `${pageHeading("Your demo dashboard", "Welcome back.", "This is a browser-only copy. Add something, change its progress, then return here to see the dashboard react.")}
    <section class="stats" aria-label="Library statistics">
      <div class="stat"><span>In library</span><strong>${items.length}</strong><small>titles</small></div>
      <div class="stat"><span>Watching</span><strong>${watching.length}</strong><small>right now</small></div>
      <div class="stat"><span>Completed</span><strong>${completed}</strong><small>finished</small></div>
      <div class="stat"><span>Episodes</span><strong>${episodes}</strong><small>watched</small></div>
    </section>
    <div class="section-bar"><h2>Continue watching</h2><button class="text-button" type="button" data-jump="library">Open library →</button></div>
    ${watching.length ? `<section class="media-grid">${watching.map(libraryCard).join("")}</section>` : emptyState("Nothing in progress", "Add a title or change its status to Watching.")}
    <div class="section-bar"><h2>Recent activity</h2><p>Stored locally</p></div>
    <section class="activity-list">
      ${items.slice(0, 4).map((item) => `<div class="activity"><span class="activity-mark">${item.progress}</span><div><strong>${item.title}</strong><small>${item.status === "completed" ? "Marked completed" : `Progress is now ${item.progress} of ${item.total}`}</small></div><time>DEMO</time></div>`).join("") || `<div class="activity"><span class="activity-mark">—</span><div><strong>No activity yet</strong><small>Your changes will appear here.</small></div><time>DEMO</time></div>`}
    </section>`;
}

function renderSearch() {
  const query = state.query.trim().toLowerCase();
  const results = catalog.filter((item) => item.title.toLowerCase().includes(query) || item.format.toLowerCase().includes(query));
  return `${pageHeading("Discover a title", "Search the catalogue.", "Add a title to the demo library. The card and your dashboard update immediately.")}
    <label class="search-box"><span class="skip-link">Search titles</span><input type="search" data-search value="${escapeAttribute(state.query)}" placeholder="Try “Frieren” or “TV”" autocomplete="off"></label>
    <div class="section-bar"><h2>${query ? "Matches" : "Popular in the demo"}</h2><p>${results.length} results</p></div>
    ${results.length ? `<section class="media-grid">${results.map(searchCard).join("")}</section>` : emptyState("No matching titles", "Try another title or clear your search.", "Clear search", "clear-search")}`;
}

function renderLibrary() {
  const entries = state.library.map(mediaFor);
  const filtered = state.filter === "all" ? entries : entries.filter((item) => item.status === state.filter);
  return `${pageHeading("Your demo library", "The list is yours.", "Change progress and status directly on a card. Your choices stay after a refresh until you reset the demo.")}
    <div class="filter-row" aria-label="Filter library">
      ${[["all", "All"], ["watching", "Watching"], ["completed", "Completed"], ["planning", "Plan to watch"]].map(([value, label]) => `<button type="button" data-filter="${value}" class="${state.filter === value ? "active" : ""}">${label}</button>`).join("")}
    </div>
    ${filtered.length ? `<section class="media-grid">${filtered.map(libraryCard).join("")}</section>` : emptyState(entries.length ? "Nothing in this section" : "Your library is empty", entries.length ? "Choose another filter to see your titles." : "Search the demo catalogue and add your first title.", entries.length ? "Show everything" : "Find a title", entries.length ? "show-all" : "search")}`;
}

function emptyState(title, copy, action = "Find something to watch", target = "search") {
  return `<section class="empty-state"><div><span class="empty-state-mark" aria-hidden="true">A</span><h2>${title}</h2><p>${copy}</p><button type="button" data-empty-action="${target}">${action}</button></div></section>`;
}

function render() {
  const views = { dashboard: renderDashboard, search: renderSearch, library: renderLibrary };
  root.innerHTML = `<div class="view-enter">${views[state.view]()}</div>`;
  saveLibrary();

  const search = root.querySelector("[data-search]");
  if (search && state.view === "search" && state.query) {
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.view) setView(button.dataset.view);
  if (button.dataset.jump) setView(button.dataset.jump);

  if (button.dataset.add) {
    const id = Number(button.dataset.add);
    const item = catalog.find((candidate) => candidate.id === id);
    state.library.unshift({ id, status: "watching", progress: 0 });
    state.justAdded = id;
    saveLibrary();
    render();
    showToast(`${item.title} added to your demo library.`);
    window.setTimeout(() => { state.justAdded = null; }, 600);
  }

  if (button.dataset.progress) {
    const entry = state.library.find((item) => item.id === Number(button.dataset.id));
    const media = mediaFor(entry);
    entry.progress = Math.max(0, Math.min(media.total, entry.progress + Number(button.dataset.progress)));
    if (entry.progress === media.total) entry.status = "completed";
    if (entry.progress < media.total && entry.status === "completed") entry.status = "watching";
    saveLibrary();
    render();
    showToast(`${media.title}: ${entry.progress} of ${media.total} episodes.`);
  }

  if (button.dataset.remove) {
    const id = Number(button.dataset.remove);
    const item = catalog.find((candidate) => candidate.id === id);
    state.library = state.library.filter((entry) => entry.id !== id);
    saveLibrary();
    render();
    showToast(`${item.title} removed from the demo library.`);
  }

  if (button.dataset.filter) { state.filter = button.dataset.filter; render(); }
  if (button.dataset.emptyAction === "search") setView("search");
  if (button.dataset.emptyAction === "clear-search") { state.query = ""; render(); }
  if (button.dataset.emptyAction === "show-all") { state.filter = "all"; render(); }

  if (button.hasAttribute("data-reset")) {
    state.library = structuredClone(defaultLibrary);
    state.filter = "all";
    state.query = "";
    saveLibrary();
    render();
    showToast("Demo library reset to its starting state.");
  }
});

document.addEventListener("input", (event) => {
  if (!event.target.matches("[data-search]")) return;
  state.query = event.target.value;
  render();
});

document.addEventListener("change", (event) => {
  if (!event.target.matches("[data-status]")) return;
  const entry = state.library.find((item) => item.id === Number(event.target.dataset.id));
  const statusLabel = event.target.options[event.target.selectedIndex].text;
  entry.status = event.target.value;
  if (entry.status === "completed") entry.progress = mediaFor(entry).total;
  saveLibrary();
  render();
  showToast(`${mediaFor(entry).title} moved to ${statusLabel}.`);
});

document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
render();
