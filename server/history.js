import { readFile } from "node:fs/promises";
import { load } from "cheerio";
const userAgent = "EarthHistoryExplorer/1.0 (local educational globe)";
const cache = new Map(),
  pending = new Map();
const atlasPromise = Promise.all(
  ["countries", "cities"].map((name) =>
    readFile(
      new URL(`../public/data/${name}.json`, import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ),
).then((arrays) => new Map(arrays.flat().map((place) => [place.id, place])));
const ignoredHeading =
  /^(references|notes|footnotes|citations|bibliography|sources|external links|see also|further reading|publications|gallery)$/i;
async function api(host, params) {
  const url = new URL("/w/api.php", host);
  for (const [key, value] of Object.entries({
    ...params,
    format: "json",
    formatversion: "2",
  }))
    url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
    signal: AbortSignal.timeout(16000),
  });
  if (!response.ok) throw Error(`History service returned ${response.status}`);
  const json = await response.json();
  if (json.error) {
    const error = Error(json.error.info || "History unavailable");
    error.code = json.error.code;
    throw error;
  }
  return json;
}
function cleanText(value) {
  return value
    .replace(/\[\d+(?:[–,]\d+)*\]/g, "")
    .replace(/\[citation needed\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
export function parseHistoryHtml(html, { historyOnly = false } = {}) {
  const $ = load(html);
  $(
    "script,style,table,figure,nav,aside,.mw-editsection,.reference,.reflist,.hatnote,.shortdescription,.metadata,.thumb,.toc,.noprint,.sistersitebox,.sidebar,.navbox,.mw-empty-elt,.locmap",
  ).remove();
  const blocks = $("h2,h3,h4,h5,p,li")
    .toArray()
    .filter((el) => !$(el).parents("li,table,nav,aside,figure").length);
  const sections = [];
  let current = { title: "Overview", paragraphs: [] },
    active = !historyOnly,
    baseLevel = 0,
    skipLevel = 0;
  const flush = () => {
    if (current.paragraphs.length) sections.push(current);
  };
  for (const block of blocks) {
    const tag = block.tagName.toLowerCase(),
      value = cleanText($(block).text());
    if (!value) continue;
    if (/^h[2-5]$/.test(tag)) {
      const level = Number(tag[1]);
      if (
        historyOnly &&
        !active &&
        /history|historical|prehistory/i.test(value)
      ) {
        active = true;
        baseLevel = level;
        current = { title: value, paragraphs: [] };
        continue;
      }
      if (historyOnly && active && level <= baseLevel) {
        flush();
        return sections;
      }
      if (!active) continue;
      if (skipLevel && level > skipLevel) continue;
      skipLevel = ignoredHeading.test(value) ? level : 0;
      flush();
      current = { title: value, paragraphs: [] };
    } else if (active && !skipLevel && value.length > 25) {
      current.paragraphs.push(value);
    }
  }
  flush();
  return sections;
}
export async function resolveArticle(place) {
  if (/^Q\d+$/.test(place.qid || "")) {
    const data = await api("https://www.wikidata.org", {
      action: "wbgetentities",
      ids: place.qid,
      props: "sitelinks",
      sitefilter: "enwiki",
    });
    const title = data.entities?.[place.qid]?.sitelinks?.enwiki?.title;
    if (title) return title;
  }
  if (place.kind === "country") return place.name;
  // Resolve uncatalogued cities by coordinates, so repeated names do not pick an unrelated city.
  const data = await api("https://en.wikipedia.org", {
    action: "query",
    list: "geosearch",
    gscoord: `${place.lat}|${place.lon}`,
    gsradius: "10000",
    gslimit: "50",
  });
  const normal = (value) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const match = data.query?.geosearch?.find(
    (result) => normal(result.title).split(",")[0] === normal(place.name),
  );
  if (!match) throw Error("No matching history article was found.");
  return match.title;
}
async function parseArticle(title) {
  return (
    await api("https://en.wikipedia.org", {
      action: "parse",
      page: title,
      prop: "text|revid",
      redirects: "1",
      disableeditsection: "1",
      disablelimitreport: "1",
    })
  ).parse;
}
export async function fetchHistory(place) {
  const canonical = await resolveArticle(place);
  // Exact canonical titles keep similarly named cities separate.
  const candidates = [`History of ${canonical}`, `History of the ${canonical}`];
  let article;
  for (const candidate of candidates) {
    try {
      article = await parseArticle(candidate);
      break;
    } catch (error) {
      if (!["missingtitle", "invalidtitle"].includes(error.code)) throw error;
    }
  }
  let historyOnly = false;
  if (!article) {
    article = await parseArticle(canonical);
    historyOnly = true;
    const $ = load(article.text);
    const historyHeading = $("h2,h3")
      .filter((i, el) => /^history$/i.test(cleanText($(el).text())))
      .first();
    const container = historyHeading.parent().hasClass("mw-heading")
      ? historyHeading.parent()
      : historyHeading;
    let next = container.next();
    for (let i = 0; next.length && i < 5; i++, next = next.next()) {
      const link = next
        .find(".hatnote a, a")
        .filter((j, el) => /^History of /i.test($(el).attr("title") || ""))
        .first();
      if (link.length) {
        const linkedTitle = link.attr("title");
        try {
          article = await parseArticle(linkedTitle);
          historyOnly = false;
        } catch {}
        break;
      }
      if (next.is("h2,.mw-heading2")) break;
    }
  }
  const sections = parseHistoryHtml(article.text, { historyOnly });
  const url =
    "https://en.wikipedia.org/wiki/" +
    encodeURIComponent(article.title.replaceAll(" ", "_"));
  return {
    id: place.id,
    title: article.title,
    url,
    revision: article.revid,
    sections,
    fetchedAt: new Date().toISOString(),
  };
}
async function history(place) {
  const existing = cache.get(place.id);
  if (existing && Date.now() - existing.at < 86400000) return existing.value;
  if (pending.has(place.id)) return pending.get(place.id);
  const promise = fetchHistory(place)
    .then((value) => {
      if (cache.size >= 250) cache.delete(cache.keys().next().value);
      cache.set(place.id, { at: Date.now(), value });
      return value;
    })
    .finally(() => pending.delete(place.id));
  pending.set(place.id, promise);
  return promise;
}
export async function handleApi(req, res, url) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res
      .writeHead(405, { Allow: "GET" })
      .end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  if (url.pathname !== "/api/history") {
    res.writeHead(404).end(JSON.stringify({ error: "Unknown endpoint" }));
    return;
  }
  const atlas = await atlasPromise,
    place = atlas.get(url.searchParams.get("id"));
  if (!place) {
    res
      .writeHead(400)
      .end(JSON.stringify({ error: "Choose a known country or city." }));
    return;
  }
  if (pending.size >= 12 && !pending.has(place.id)) {
    res
      .writeHead(429, { "Retry-After": "3" })
      .end(JSON.stringify({ error: "Please try again in a moment." }));
    return;
  }
  try {
    const data = await history(place);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.end(JSON.stringify(data));
  } catch (error) {
    console.error(`History for ${place.name}: ${error.message}`);
    res
      .writeHead(502)
      .end(
        JSON.stringify({
          error: "The history service is temporarily unavailable.",
        }),
      );
  }
}
