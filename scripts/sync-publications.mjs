#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const AIRTABLE_API_ROOT = "https://api.airtable.com/v0";
const DEFAULT_OUTPUT = "assets/data/publications.json";

const FIELD_ALIASES = {
  title: ["Title", "Publication title", "Publication"],
  authors: ["Authors", "Author(s)", "Author"],
  year: ["Year", "Publication year"],
  journal: ["Journal", "Venue"],
  doi: ["DOI", "Doi"],
  url: ["URL", "Link", "Publication URL"],
  status: ["Status", "Publication status"],
  group: ["Group", "Section"],
  featured: ["Featured", "Show on homepage"],
  hidden: ["Hide from homepage"],
  order: ["Order", "Sort order"],
};

function configuredAliases(key, environment = process.env) {
  const variable = `AIRTABLE_FIELD_${key.toUpperCase()}`;
  const configured = environment[variable]?.trim();
  return configured ? [configured] : FIELD_ALIASES[key];
}

function fieldValue(fields, key, environment = process.env) {
  const entries = Object.entries(fields);
  for (const alias of configuredAliases(key, environment)) {
    if (Object.hasOwn(fields, alias)) return fields[alias];
    const match = entries.find(([name]) => name.toLowerCase() === alias.toLowerCase());
    if (match) return match[1];
  }
  return undefined;
}

function toText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return toText(value.name ?? value.url ?? value.text ?? "");
  }
  return String(value).trim();
}

function toBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "yes", "y", "on"].includes(String(value).trim().toLowerCase());
}

function normaliseDoi(value) {
  return toText(value)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .trim();
}

function numericYear(value) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const match = toText(value).match(/\b(?:19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function numericOrder(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isUnderReview(value) {
  return /under review|in review|submitted/i.test(toText(value));
}

function groupRank(group) {
  if (group.toLowerCase() === "under review") return Number.POSITIVE_INFINITY;
  const year = numericYear(group);
  return year ?? Number.NEGATIVE_INFINITY;
}

export function normalisePublications(records, environment = process.env) {
  if (!Array.isArray(records)) throw new TypeError("Airtable did not return a records array.");

  const publications = records.map((record, index) => {
    const fields = record?.fields ?? {};
    const title = toText(fieldValue(fields, "title", environment));
    const authors = toText(fieldValue(fields, "authors", environment));
    const status = toText(fieldValue(fields, "status", environment));
    const explicitGroup = toText(fieldValue(fields, "group", environment));
    const rawYear = fieldValue(fields, "year", environment);
    const year = numericYear(rawYear);
    const group = explicitGroup || (isUnderReview(status) || isUnderReview(rawYear) ? "Under review" : "");
    const doi = normaliseDoi(fieldValue(fields, "doi", environment));
    const suppliedUrl = toText(fieldValue(fields, "url", environment));
    const hidden = toBoolean(fieldValue(fields, "hidden", environment));
    const featuredValue = fieldValue(fields, "featured", environment);

    const problems = [];
    if (!record?.id) problems.push("missing Airtable record ID");
    if (!title) problems.push("missing Title");
    if (!authors) problems.push("missing Authors");
    if (!year && !group) problems.push("missing Year, Status, or Group");
    if (problems.length) {
      throw new Error(`Publication row ${index + 1} (${record?.id ?? "unknown"}): ${problems.join(", ")}.`);
    }

    return {
      id: record.id,
      year: year ?? "",
      group: group || String(year),
      title,
      authors,
      journal: toText(fieldValue(fields, "journal", environment)),
      doi,
      url: suppliedUrl || (doi ? `https://doi.org/${doi}` : ""),
      featured: hidden ? false : toBoolean(featuredValue, true),
      order: numericOrder(fieldValue(fields, "order", environment)),
    };
  });

  const ids = new Set();
  for (const publication of publications) {
    if (ids.has(publication.id)) throw new Error(`Duplicate publication ID: ${publication.id}.`);
    ids.add(publication.id);
  }

  return publications.sort((a, b) => {
    const groupDifference = groupRank(b.group) - groupRank(a.group);
    if (groupDifference) return groupDifference;
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    if (b.order !== a.order) return b.order - a.order;
    return a.title.localeCompare(b.title);
  });
}

export async function fetchAllRecords({
  token,
  baseId,
  table,
  view,
  returnFieldsByFieldId = false,
  fetchImpl = fetch,
}) {
  const records = [];
  let offset;

  do {
    const url = new URL(`${AIRTABLE_API_ROOT}/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (view) url.searchParams.set("view", view);
    if (returnFieldsByFieldId) url.searchParams.set("returnFieldsByFieldId", "true");
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new Error(`Airtable request failed with ${response.status}: ${body || response.statusText}`);
    }

    const page = await response.json();
    if (!Array.isArray(page.records)) throw new TypeError("Airtable response is missing its records array.");
    records.push(...page.records);
    offset = page.offset;
  } while (offset);

  return records;
}

export function readConfig(environment = process.env) {
  const config = {
    token: environment.AIRTABLE_ACCESS_TOKEN?.trim(),
    baseId: environment.AIRTABLE_BASE_ID?.trim(),
    table: environment.AIRTABLE_PUBLICATIONS_TABLE?.trim() || "Publications",
    view: environment.AIRTABLE_PUBLICATIONS_VIEW?.trim() || "",
    minimum: Number(environment.AIRTABLE_MIN_PUBLICATIONS?.trim() || 40),
  };

  if (!config.token) throw new Error("AIRTABLE_ACCESS_TOKEN is required.");
  if (!config.baseId) throw new Error("AIRTABLE_BASE_ID is required.");
  if (!Number.isInteger(config.minimum) || config.minimum < 1) {
    throw new Error("AIRTABLE_MIN_PUBLICATIONS must be a positive integer.");
  }
  return config;
}

async function writeSnapshot(outputPath, publications) {
  const payload = `${JSON.stringify({ source: "airtable", complete: true, records: publications }, null, 2)}\n`;
  let previous = "";
  try {
    previous = await readFile(outputPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (previous === payload) {
    console.log(`Publications are already current (${publications.length} records).`);
    return false;
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, payload, "utf8");
  console.log(`Updated ${outputPath} with ${publications.length} publications.`);
  return true;
}

async function main() {
  const config = readConfig();
  const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
  const outputPath = resolve(outputArgument?.slice("--output=".length) || DEFAULT_OUTPUT);
  const records = await fetchAllRecords(config);
  const publications = normalisePublications(records);

  if (publications.length < config.minimum) {
    throw new Error(
      `Refusing to replace the snapshot: Airtable returned ${publications.length} publications, below AIRTABLE_MIN_PUBLICATIONS=${config.minimum}.`,
    );
  }

  await writeSnapshot(outputPath, publications);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
