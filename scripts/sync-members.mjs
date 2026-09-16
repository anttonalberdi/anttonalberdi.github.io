#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { fetchAllRecords } from "./sync-publications.mjs";

const DEFAULT_OUTPUT = "assets/data/members.json";
const DEFAULT_IMAGE_DIRECTORY = "assets/images/people";
const DEFAULT_IMAGE_URL_PREFIX = "assets/images/people";
const GENERATED_IMAGE_PREFIX = "airtable-";

const FIELD_ALIASES = {
  name: ["Name"],
  biosketch: ["Biosketch"],
  position: ["Position"],
  picture: ["Picture"],
};

const MIME_EXTENSIONS = new Map([
  ["image/avif", ".avif"],
  ["image/gif", ".gif"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function configuredAliases(key, environment = process.env) {
  const configured = environment[`AIRTABLE_FIELD_MEMBER_${key.toUpperCase()}`]?.trim();
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
  if (typeof value === "object") return toText(value.name ?? value.text ?? "");
  return String(value).trim();
}

function choosePicture(value) {
  const attachment = Array.isArray(value) ? value.find((item) => item?.url) : null;
  if (attachment) {
    const rendition = attachment.thumbnails?.full ?? attachment.thumbnails?.large ?? attachment;
    return {
      url: rendition.url,
      width: Number(rendition.width) || Number(attachment.width) || null,
      height: Number(rendition.height) || Number(attachment.height) || null,
      type: String(attachment.type ?? "").toLowerCase(),
      filename: String(attachment.filename ?? ""),
    };
  }

  const url = toText(value);
  return url ? { url, width: null, height: null, type: "", filename: "" } : null;
}

function imageExtension(contentType, picture) {
  const mimeType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (MIME_EXTENSIONS.has(mimeType)) return MIME_EXTENSIONS.get(mimeType);
  if (MIME_EXTENSIONS.has(picture.type)) return MIME_EXTENSIONS.get(picture.type);

  const extension = extname(picture.filename).toLowerCase();
  if ([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"].includes(extension)) {
    return extension === ".jpeg" ? ".jpg" : extension;
  }
  throw new Error(`unsupported picture type ${contentType || picture.type || "unknown"}`);
}

export function normaliseMemberRecords(records, environment = process.env) {
  if (!Array.isArray(records)) throw new TypeError("Airtable did not return a records array.");

  return records.map((record, index) => {
    const fields = record?.fields ?? {};
    const name = toText(fieldValue(fields, "name", environment));
    const biosketch = toText(fieldValue(fields, "biosketch", environment));
    const position = toText(fieldValue(fields, "position", environment));
    const picture = choosePicture(fieldValue(fields, "picture", environment));
    const problems = [];

    if (!record?.id) problems.push("missing Airtable record ID");
    if (!name) problems.push("missing Name");
    if (!biosketch) problems.push("missing Biosketch");
    if (!position) problems.push("missing Position");
    if (!picture?.url) problems.push("missing Picture");
    if (problems.length) {
      const availableFields = Object.keys(fields).sort((a, b) => a.localeCompare(b));
      const fieldSummary = availableFields.length ? availableFields.join(", ") : "none";
      throw new Error(
        `Member row ${index + 1} (${record?.id ?? "unknown"}): ${problems.join(", ")}. ` +
          `Available fields: ${fieldSummary}.`,
      );
    }

    let pictureUrl;
    try {
      pictureUrl = new URL(picture.url);
    } catch {
      throw new Error(`Member row ${index + 1} (${record.id}): Picture is not a valid URL.`);
    }
    if (!/^https?:$/.test(pictureUrl.protocol)) {
      throw new Error(`Member row ${index + 1} (${record.id}): Picture must use HTTP or HTTPS.`);
    }

    return { id: record.id, name, biosketch, position, picture };
  });
}

async function downloadPicture(member, { imageDirectory, imageUrlPrefix, fetchImpl }) {
  const response = await fetchImpl(member.picture.url, { headers: { Accept: "image/*" } });
  if (!response.ok) {
    throw new Error(`Could not download Picture for ${member.name}: HTTP ${response.status}.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`Could not download Picture for ${member.name}: empty response.`);

  const contentType = response.headers?.get?.("content-type") ?? "";
  let extension;
  try {
    extension = imageExtension(contentType, member.picture);
  } catch (error) {
    throw new Error(`Could not download Picture for ${member.name}: ${error.message}.`);
  }

  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const filename = `${GENERATED_IMAGE_PREFIX}${member.id}-${digest}${extension}`;
  await mkdir(imageDirectory, { recursive: true });
  await writeFile(resolve(imageDirectory, filename), bytes);

  return {
    id: member.id,
    name: member.name,
    biosketch: member.biosketch,
    position: member.position,
    picture: `${imageUrlPrefix.replace(/\/$/, "")}/${filename}`,
    pictureWidth: member.picture.width,
    pictureHeight: member.picture.height,
  };
}

async function removeStalePictures(imageDirectory, currentFilenames) {
  let filenames;
  try {
    filenames = await readdir(imageDirectory);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  await Promise.all(
    filenames
      .filter((filename) => filename.startsWith(GENERATED_IMAGE_PREFIX) && !currentFilenames.has(filename))
      .map((filename) => unlink(resolve(imageDirectory, filename))),
  );
}

export async function buildMembers(
  records,
  {
    environment = process.env,
    imageDirectory = resolve(DEFAULT_IMAGE_DIRECTORY),
    imageUrlPrefix = DEFAULT_IMAGE_URL_PREFIX,
    fetchImpl = fetch,
  } = {},
) {
  const normalised = normaliseMemberRecords(records, environment);
  const members = [];
  for (const member of normalised) {
    members.push(await downloadPicture(member, { imageDirectory, imageUrlPrefix, fetchImpl }));
  }

  const currentFilenames = new Set(members.map((member) => member.picture.split("/").pop()));
  await removeStalePictures(imageDirectory, currentFilenames);
  return members;
}

export function readMemberConfig(environment = process.env) {
  const config = {
    token: environment.AIRTABLE_ACCESS_TOKEN?.trim(),
    baseId: environment.AIRTABLE_BASE_ID?.trim(),
    table: environment.AIRTABLE_MEMBERS_TABLE?.trim(),
    view: environment.AIRTABLE_MEMBERS_VIEW?.trim() || "",
    minimum: Number(environment.AIRTABLE_MIN_MEMBERS?.trim() || 5),
  };

  if (!config.token) throw new Error("AIRTABLE_ACCESS_TOKEN is required.");
  if (!config.baseId) throw new Error("AIRTABLE_BASE_ID is required.");
  if (!config.table) throw new Error("AIRTABLE_MEMBERS_TABLE is required.");
  if (!Number.isInteger(config.minimum) || config.minimum < 1) {
    throw new Error("AIRTABLE_MIN_MEMBERS must be a positive integer.");
  }
  return config;
}

async function writeSnapshot(outputPath, members) {
  const payload = `${JSON.stringify({ source: "airtable", complete: true, records: members }, null, 2)}\n`;
  let previous = "";
  try {
    previous = await readFile(outputPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (previous === payload) {
    console.log(`Members are already current (${members.length} records).`);
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, payload, "utf8");
  console.log(`Updated ${outputPath} with ${members.length} members.`);
}

async function main() {
  const config = readMemberConfig();
  const outputArgument = process.argv.find((argument) => argument.startsWith("--output="));
  const imageDirectoryArgument = process.argv.find((argument) => argument.startsWith("--image-dir="));
  const imagePrefixArgument = process.argv.find((argument) => argument.startsWith("--image-url-prefix="));
  const outputPath = resolve(outputArgument?.slice("--output=".length) || DEFAULT_OUTPUT);
  const imageDirectory = resolve(imageDirectoryArgument?.slice("--image-dir=".length) || DEFAULT_IMAGE_DIRECTORY);
  const imageUrlPrefix = imagePrefixArgument?.slice("--image-url-prefix=".length) || DEFAULT_IMAGE_URL_PREFIX;
  const records = await fetchAllRecords(config);

  if (records.length < config.minimum) {
    throw new Error(
      `Refusing to replace the snapshot: Airtable returned ${records.length} members, below AIRTABLE_MIN_MEMBERS=${config.minimum}.`,
    );
  }

  const members = await buildMembers(records, { imageDirectory, imageUrlPrefix });
  await writeSnapshot(outputPath, members);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
