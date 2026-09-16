/**
 * Small content-provider boundary for the static site.
 *
 * By default, collections are loaded from assets/data/*.json. If the
 * `alberdilab-content-api` meta tag contains a URL, the same collection is
 * requested from that endpoint first and the local JSON remains the fallback.
 * This keeps Airtable credentials out of the browser while allowing a future
 * sync service to use the exact same public data shape.
 */

function normaliseCollection(payload, name) {
  const records = Array.isArray(payload) ? payload : payload?.records;
  if (!Array.isArray(records)) {
    throw new TypeError(`The ${name} content source did not return an array.`);
  }
  return records;
}

function collectionDocument(payload, name) {
  return {
    records: normaliseCollection(payload, name),
    source: Array.isArray(payload) ? "snapshot" : String(payload.source ?? "snapshot"),
    complete: Array.isArray(payload) ? false : payload.complete === true,
  };
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Content request failed with status ${response.status}.`);
  }
  return response.json();
}

export async function loadCollectionDocument(name) {
  if (!/^[a-z0-9-]+$/i.test(name)) {
    throw new TypeError("Invalid content collection name.");
  }

  const fallbackUrl = new URL(`../data/${name}.json`, import.meta.url);
  const apiBase = document
    .querySelector('meta[name="alberdilab-content-api"]')
    ?.getAttribute("content")
    ?.trim();

  if (apiBase) {
    try {
      const apiUrl = `${apiBase.replace(/\/$/, "")}/${name}`;
      return collectionDocument(await requestJson(apiUrl), name);
    } catch (error) {
      console.warn(`Remote ${name} content unavailable; using the local snapshot.`, error);
    }
  }

  return collectionDocument(await requestJson(fallbackUrl), name);
}

export async function loadCollection(name) {
  return (await loadCollectionDocument(name)).records;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeHref(value) {
  const href = String(value ?? "").trim();
  if (/^(https?:\/\/|mailto:)/i.test(href)) {
    return href;
  }
  if (/^(?!\/\/)[./]?[a-z0-9][a-z0-9_./-]*(?:#[a-z0-9_-]+)?$/i.test(href)) {
    return href;
  }
  return "#";
}
