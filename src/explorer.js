import { globe, chapters, setPlaying, selectChapter } from "./civilization.js";
import {
  b as Vector3,
  B as BufferGeometry,
  F as Float32BufferAttribute,
  K as Line,
  L as LineBasicMaterial,
} from "../vendor/three.js";
import {
  prepareCountries,
  countryAt,
  distanceKm,
  cityVisible,
  isPlaceClick,
  raySphere,
  CITY_ZOOM,
} from "./geo.js";
import "./explorer.css";
const shell = document.querySelector(".world-shell"),
  canvas = document.querySelector("#earth-canvas");
shell.insertAdjacentHTML(
  "beforeend",
  `
  <div class="place-labels" aria-label="Places on the globe"></div>
  <div class="explore-hint"><span class="hint-dot"></span><span id="map-instruction">Scroll to zoom · Click a country to explore its history</span></div>
  <div class="place-tooltip" hidden></div>
  <aside class="history-panel" aria-labelledby="history-title" hidden>
    <header class="history-panel-top"><span class="eyebrow">THE HUMAN ATLAS</span><button class="history-close" aria-label="Close history panel">✕</button></header>
    <div class="history-heading"><p class="place-kind">EXPLORE A PLACE</p><h2 id="history-title" tabindex="-1">Every place<br>has a past.</h2><p class="place-context"></p></div>
    <div class="place-picker"><label for="place-search" class="sr-only">Find a country or city</label><input id="place-search" type="search" placeholder="Find a country or city" autocomplete="off" aria-controls="place-results"><div id="place-results"></div></div>
    <div class="history-content" aria-live="polite"></div>
  </aside>`,
);
const panel = document.querySelector(".history-panel"),
  title = document.querySelector("#history-title"),
  content = document.querySelector(".history-content"),
  tooltip = document.querySelector(".place-tooltip"),
  labels = document.querySelector(".place-labels"),
  search = document.querySelector("#place-search"),
  results = document.querySelector("#place-results");
const exploreButton = document.createElement("button");
exploreButton.className = "record-button";
exploreButton.id = "explore-places";
exploreButton.textContent = "Explore places ↗";
document.querySelector(".hero-actions").append(exploreButton);
const resetButton = document.createElement("button");
resetButton.id = "globe-reset";
resetButton.setAttribute("aria-label", "Reset globe view");
resetButton.title = "Reset globe view";
resetButton.textContent = "↺";
document.querySelector(".zoom-controls").append(resetButton);
let countries = [],
  cities = [],
  places = [],
  selected = null,
  layer,
  lastFocus,
  request,
  searchTimer,
  detailLoaded = false;
const cachedHistory = new Map(),
  labelButtons = new Map();
const text = (tag, value, className) => {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
};
const coordinate = (value) => Math.abs(value).toFixed(2);
function openPanel() {
  lastFocus = panel.hidden ? document.activeElement : lastFocus;
  panel.hidden = false;
  shell.classList.add("history-open");
  setPlaying(false);
  globe.setRotation(false);
}
function closePanel() {
  request?.abort();
  panel.hidden = true;
  shell.classList.remove("history-open");
  results.replaceChildren();
  search.value = "";
  lastFocus?.focus?.();
}
document.querySelector(".history-close").onclick = closePanel;
exploreButton.onclick = () => {
  openPanel();
  if (!selected) {
    content.replaceChildren(
      text(
        "p",
        "Choose a country on the globe, or zoom in to reveal cities.",
        "history-intro",
      ),
    );
  }
  search.focus();
};
resetButton.onclick = () => {
  closePanel();
  globe.home();
  globe.setClouds(true);
  layer?.select(null);
  selected = null;
  shell.classList.remove("map-zoomed");
};
canvas.setAttribute(
  "aria-label",
  "Interactive Earth. Drag to rotate, scroll or use plus and minus to zoom. Click a country or a visible city to read its history. Press Enter to find a place.",
);
canvas.addEventListener("keydown", (event) => {
  if (["+", "=", "-", "_"].includes(event.key)) {
    event.preventDefault();
    globe.zoom(["+", "="].includes(event.key) ? 0.06 : -0.06);
  }
  if (event.key === "Enter") {
    event.preventDefault();
    exploreButton.click();
  }
});
document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      event.stopImmediatePropagation();
      closePanel();
    }
  },
  true,
);
panel.addEventListener("keydown", (event) => event.stopPropagation());
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    globe.setRotation(false);
    globe.zoom(
      -Math.sign(event.deltaY) *
        Math.min(0.065, Math.abs(event.deltaY) * 0.001),
    );
  },
  { passive: false },
);
function bundledStories(place) {
  return chapters.filter((chapter) => {
    if (chapter.id === "today") return false;
    if (place.kind === "city") return distanceKm(place, chapter) < 90;
    return chapter.points.some(
      ([lat, lon]) => countryAt(countries, lon, lat)?.id === place.id,
    );
  });
}
function renderStories(place) {
  const stories = bundledStories(place);
  if (!stories.length) return;
  const block = text("section", "", "local-stories");
  block.append(text("h3", "In the journey"));
  for (const chapter of stories) {
    const item = document.createElement("details");
    const summary = text("summary", `${chapter.date} · ${chapter.region}`);
    item.append(summary, text("p", chapter.body));
    const jump = text("button", "Visit this chapter ↗");
    jump.onclick = () => {
      closePanel();
      selectChapter(chapters.indexOf(chapter), false);
    };
    item.append(jump);
    block.append(item);
  }
  content.append(block);
}
async function selectPlace(place, { fly = false } = {}) {
  request?.abort();
  request = new AbortController();
  const signal = request.signal;
  selected = place;
  openPanel();
  layer?.select(place);
  search.value = "";
  results.replaceChildren();
  title.textContent = place.name;
  document.querySelector(".place-kind").textContent =
    place.kind === "city" ? "CITY HISTORY" : "COUNTRY HISTORY";
  document.querySelector(".place-context").textContent = [
    place.kind === "city" ? place.country : null,
    `${coordinate(place.lat)}° ${place.lat >= 0 ? "N" : "S"} · ${coordinate(place.lon)}° ${place.lon >= 0 ? "E" : "W"}`,
  ]
    .filter(Boolean)
    .join(" / ");
  if (fly)
    globe.flyTo(place.lat, place.lon, place.kind === "city" ? 1.09 : 0.7, 1200);
  content.replaceChildren(
    text("p", "Gathering the history of this place…", "history-loading"),
  );
  content.setAttribute("aria-busy", "true");
  title.focus({ preventScroll: true });
  try {
    let data = cachedHistory.get(place.id);
    if (!data) {
      const response = await fetch(
        "/api/history?id=" + encodeURIComponent(place.id),
        { signal },
      );
      data = await response.json();
      if (!response.ok)
        throw Error(data.error || "History is temporarily unavailable.");
      cachedHistory.set(place.id, data);
    }
    if (signal.aborted || selected?.id !== place.id) return;
    content.replaceChildren();
    if (data.sections.length) {
      content.append(
        text("p", `${data.sections.length} history sections`, "history-count"),
      );
      const full = text("a", "Read full history ↗", "history-article");
      full.href = data.url;
      full.target = "_blank";
      full.rel = "noopener noreferrer";
      content.append(full);
      data.sections.forEach((section, index) => {
        const detail = document.createElement("details");
        detail.className = "history-section";
        detail.open = index === 0;
        const summary = document.createElement("summary");
        summary.append(
          text("span", String(index + 1).padStart(2, "0"), "section-number"),
          text("span", section.title),
          text("span", "+", "section-toggle"),
        );
        detail.append(summary);
        const body = text("div", "", "section-body");
        for (const paragraph of section.paragraphs)
          body.append(text("p", paragraph));
        detail.append(body);
        content.append(detail);
      });
    } else
      content.append(
        text(
          "p",
          "No dedicated history section is available for this place yet.",
          "history-intro",
        ),
      );
    renderStories(place);
  } catch (error) {
    if (signal.aborted) return;
    content.replaceChildren(
      text(
        "p",
        "The live history could not be loaded. Check your connection and try again.",
        "history-intro",
      ),
    );
    const retry = text("button", "Try again", "history-retry");
    retry.onclick = () => selectPlace(place);
    content.append(retry);
    renderStories(place);
  } finally {
    if (!signal.aborted) content.removeAttribute("aria-busy");
  }
}
search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const query = search.value.trim().toLocaleLowerCase();
    results.replaceChildren();
    if (query.length < 2) return;
    const matches = places
      .filter((p) =>
        `${p.name} ${p.country || ""} ${p.region || ""}`
          .toLocaleLowerCase()
          .includes(query),
      )
      .sort(
        (a, b) =>
          Number(b.name.toLowerCase() === query) -
            Number(a.name.toLowerCase() === query) ||
          Number(a.kind === "city") - Number(b.kind === "city") ||
          (b.population || 0) - (a.population || 0),
      )
      .slice(0, 24);
    if (!matches.length) {
      results.append(text("p", "No matching places."));
      return;
    }
    for (const place of matches) {
      const button = text("button", place.name);
      button.append(
        text(
          "small",
          place.kind === "city"
            ? `${place.region ? place.region + ", " : ""}${place.country}`
            : "Country",
        ),
      );
      button.onclick = () => selectPlace(place, { fly: true });
      results.append(button);
    }
  }, 120);
});
function createLayer({ group, camera, radius, geographic }) {
  let selectedPlace = null,
    selectionLine = null,
    pointerStart = null,
    touchCount = 0,
    lastUpdate = 0,
    lastHover = 0;
  const worldCamera = new Vector3(),
    localCamera = new Vector3();
  const borderMaterial = new LineBasicMaterial({
    color: 0xcdb88f,
    transparent: true,
    opacity: 0.17,
    depthWrite: false,
  });
  function lines(features, material) {
    const vertices = [];
    for (const country of features)
      for (const poly of country.geometry.coordinates)
        for (const ring of poly)
          for (let i = 1; i < ring.length; i++) {
            const a = ring[i - 1],
              b = ring[i],
              steps = Math.max(
                1,
                Math.ceil(
                  Math.max(
                    Math.abs(b[1] - a[1]),
                    Math.abs(((b[0] - a[0] + 540) % 360) - 180),
                  ) / 1.5,
                ),
              );
            for (let step = 0; step < steps; step++)
              for (const t of [step / steps, (step + 1) / steps]) {
                const lon = a[0] + (((b[0] - a[0] + 540) % 360) - 180) * t,
                  lat = a[1] + (b[1] - a[1]) * t;
                const point = geographic(lat, lon, radius + 0.002);
                vertices.push(point.x, point.y, point.z);
              }
          }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    const line = new Line(geometry, material);
    line.isLineSegments = true;
    line.frustumCulled = false;
    group.add(line);
    return line;
  }
  lines(countries, borderMaterial);
  const positions = new Map(
    places.map((place) => [
      place.id,
      geographic(place.lat, place.lon, radius + 0.006),
    ]),
  );
  function project(place) {
    const local = positions.get(place.id);
    if (local.dot(localCamera) <= local.lengthSq()) return { visible: false };
    const p = group.localToWorld(local.clone()).project(camera);
    return {
      x: (p.x * 0.5 + 0.5) * innerWidth,
      y: (-0.5 * p.y + 0.5) * innerHeight,
      visible: p.z > -1 && p.z < 1,
    };
  }
  function hit(event) {
    const rect = canvas.getBoundingClientRect(),
      screen = new Vector3(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        0.5,
      ).unproject(camera);
    const origin = group.worldToLocal(camera.position.clone()),
      destination = group.worldToLocal(screen),
      direction = destination.sub(origin).normalize(),
      distance = raySphere(origin, direction, radius);
    if (distance === null) return null;
    const p = origin.addScaledVector(direction, distance);
    return {
      lat: (Math.asin(p.y / radius) * 180) / Math.PI,
      lon: (Math.atan2(-p.z, p.x) * 180) / Math.PI,
    };
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    pointerStart = {
      x: event.clientX,
      y: event.clientY,
      multitouch: touchCount > 1,
    };
    tooltip.hidden = true;
  });
  canvas.addEventListener(
    "touchstart",
    (event) => {
      touchCount = event.touches.length;
      if (touchCount > 1 && pointerStart) pointerStart.multitouch = true;
    },
    { passive: true },
  );
  canvas.addEventListener(
    "touchend",
    (event) => {
      touchCount = event.touches.length;
    },
    { passive: true },
  );
  canvas.addEventListener("pointercancel", () => {
    pointerStart = null;
    tooltip.hidden = true;
  });
  canvas.addEventListener("pointerup", (event) => {
    if (isPlaceClick(pointerStart, { x: event.clientX, y: event.clientY })) {
      const point = hit(event);
      const country = point && countryAt(countries, point.lon, point.lat);
      if (country) selectPlace(country);
    }
    pointerStart = null;
  });
  canvas.addEventListener("pointermove", (event) => {
    if (pointerStart || performance.now() - lastHover < 65) return;
    lastHover = performance.now();
    const point = hit(event),
      country = point && countryAt(countries, point.lon, point.lat);
    tooltip.hidden = !country;
    if (country) {
      tooltip.textContent = country.name;
      tooltip.style.left =
        Math.min(innerWidth - 180, event.clientX + 16) + "px";
      tooltip.style.top = Math.max(80, event.clientY - 35) + "px";
    }
    canvas.classList.toggle("over-country", !!country);
  });
  canvas.addEventListener("pointerleave", () => {
    tooltip.hidden = true;
  });
  return {
    select(place) {
      selectedPlace = place;
      if (selectionLine) {
        group.remove(selectionLine);
        selectionLine.geometry.dispose();
        selectionLine.material.dispose();
        selectionLine = null;
      }
      const country =
        place &&
        (place.kind === "country"
          ? place
          : countries.find((c) => c.id === place.countryId));
      if (country)
        selectionLine = lines(
          [country],
          new LineBasicMaterial({
            color: 0xf4d99d,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
          }),
        );
    },
    update(time) {
      if (time - lastUpdate < 70) return;
      lastUpdate = time;
      camera.getWorldPosition(worldCamera);
      localCamera.copy(group.worldToLocal(worldCamera.clone()));
      const zoom = globe.getState().zoom;
      shell.classList.toggle("map-zoomed", zoom > 0.62);
      document.querySelector("#map-instruction").textContent =
        zoom >= CITY_ZOOM
          ? "Click a city to open its history · Drag to explore"
          : "Scroll to zoom · Click a country to explore its history";
      if (zoom > 0.6 && !detailLoaded) {
        detailLoaded = true;
        globe.loadDetail().catch(() => {
          detailLoaded = false;
        });
        globe.setClouds(false);
      }
      const candidates = (
        zoom >= CITY_ZOOM
          ? cities.filter((city) => cityVisible(city, zoom))
          : countries
      )
        .slice()
        .sort(
          (a, b) =>
            Number(b.id === selectedPlace?.id) -
              Number(a.id === selectedPlace?.id) ||
            (b.population || 0) - (a.population || 0),
        );
      const used = [],
        visibleIds = new Set();
      for (const place of candidates) {
        const p = project(place);
        if (
          !p.visible ||
          p.x < 25 ||
          p.x > innerWidth - 35 ||
          p.y < 95 ||
          p.y > innerHeight - 180
        )
          continue;
        if (
          !panel.hidden &&
          p.x < panel.getBoundingClientRect().right + 12 &&
          p.y > panel.offsetTop
        )
          continue;
        const width = Math.min(160, place.name.length * 7 + 20);
        if (
          used.some(
            (other) =>
              Math.abs(other.x - p.x) < (other.width + width) / 2 &&
              Math.abs(other.y - p.y) < 24,
          )
        )
          continue;
        used.push({ ...p, width });
        visibleIds.add(place.id);
        let button = labelButtons.get(place.id);
        if (!button) {
          button = text(
            "button",
            place.name,
            place.kind === "city"
              ? "map-place city-place"
              : "map-place country-place",
          );
          button.setAttribute(
            "aria-label",
            `Read the history of ${place.name}${place.kind === "city" ? ", " + place.country : ""}`,
          );
          button.onclick = () => selectPlace(place);
          labels.append(button);
          labelButtons.set(place.id, button);
        }
        button.hidden = false;
        button.classList.toggle("selected", place.id === selectedPlace?.id);
        button.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
        if (used.length >= 120) break;
      }
      for (const [id, button] of labelButtons)
        if (!visibleIds.has(id)) button.hidden = true;
    },
  };
}
export const ready = Promise.all([
  fetch("/data/countries.json").then((r) => r.json()),
  fetch("/data/cities.json").then((r) => r.json()),
])
  .then(([countryData, cityData]) => {
    countries = prepareCountries(countryData);
    cities = cityData;
    places = [...countries, ...cities];
    layer = globe.attachLayer(createLayer);
    const context = document.modelContext;
    if (context?.registerTool) {
      const controller = new AbortController();
      addEventListener("pagehide", () => controller.abort(), { once: true });
      for (const tool of [
        {
          name: "find_places",
          description: "Find available countries and cities by name.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string", minLength: 2 } },
            required: ["query"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute({ query }) {
            if (typeof query !== "string" || query.trim().length < 2)
              throw Error("Enter at least two characters.");
            return places
              .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 25)
              .map((p) => ({
                id: p.id,
                name: p.name,
                kind: p.kind,
                country: p.country,
              }));
          },
        },
        {
          name: "open_place_history",
          description:
            "Select a country or city, move the globe to it, and open its history panel.",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          async execute({ id }) {
            const place = places.find((p) => p.id === id);
            if (!place) throw Error("Unknown place.");
            await selectPlace(place, { fly: true });
            return { id: place.id, name: place.name, opened: !panel.hidden };
          },
        },
      ])
        try {
          Promise.resolve(
            context.registerTool(tool, { signal: controller.signal }),
          ).catch(() => {});
        } catch {}
    }
  })
  .catch(() => {
    document.querySelector("#map-instruction").textContent =
      "Place map could not load. Refresh to try again.";
  });
