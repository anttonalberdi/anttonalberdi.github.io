import { escapeHtml, loadCollectionDocument, safeHref } from "./content.js";

const archive = document.querySelector("[data-publication-archive]");
const tools = document.querySelector("[data-publication-tools]");
const search = document.querySelector("#publication-search");
const yearFilter = document.querySelector("#publication-year");
const count = document.querySelector("[data-publication-count]");

function cleanPublication(blockquote) {
  const copy = blockquote.cloneNode(true);
  copy.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (element.tagName === "A" && attribute.name === "href") return;
      element.removeAttribute(attribute.name);
    });
  });
  copy.querySelectorAll("a").forEach((link) => {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });
  return copy;
}

function finishRender(labels) {
  archive.setAttribute("aria-busy", "false");
  tools.hidden = false;
  yearFilter.replaceChildren(new Option("All years", "all"));
  labels.forEach((label) => yearFilter.append(new Option(label, label.toLowerCase())));
  filterPublications();
}

function renderLegacyGroups(groups) {
  archive.replaceChildren();

  groups.forEach(({ label, publications }) => {
    const section = document.createElement("section");
    section.className = "publication-year";
    section.dataset.publicationGroup = label.toLowerCase();

    const heading = document.createElement("h3");
    heading.textContent = label;
    section.append(heading);

    const list = document.createElement("div");
    publications.forEach((publication) => {
      const article = document.createElement("article");
      article.className = "archive-publication";
      article.dataset.publication = "";
      article.dataset.search = publication.textContent.toLowerCase();
      article.append(cleanPublication(publication));
      list.append(article);
    });
    section.append(list);
    archive.append(section);
  });

  finishRender(groups.map(({ label }) => label));
}

function groupPublications(publications) {
  const groups = new Map();
  publications.forEach((publication) => {
    const label = String(publication.group || publication.year || "Other");
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(publication);
  });
  return [...groups.entries()].map(([label, records]) => ({ label, publications: records }));
}

function publicationMarkup(publication) {
  const doi = String(publication.doi ?? "").trim();
  const href = safeHref(publication.url || (doi ? `https://doi.org/${doi}` : ""));
  const linkedTitle = href === "#"
    ? `<strong>${escapeHtml(publication.title)}</strong>`
    : `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(publication.title)}</strong></a>`;
  const year = publication.year ? `${escapeHtml(publication.year)}. ` : "";
  const journal = publication.journal
    ? ` <strong>${escapeHtml(publication.journal)}</strong>${publication.volume ? ` ${escapeHtml(publication.volume)}` : ""}.`
    : "";
  const doiText = doi ? ` doi: ${escapeHtml(doi)}.` : "";
  return `<p>${escapeHtml(publication.authors)}. ${year}${linkedTitle}.${journal}${doiText}</p>`;
}

function renderStructuredArchive(publications) {
  const groups = groupPublications(publications);
  archive.replaceChildren();

  groups.forEach(({ label, publications: records }) => {
    const section = document.createElement("section");
    section.className = "publication-year";
    section.dataset.publicationGroup = label.toLowerCase();
    section.innerHTML = `<h3>${escapeHtml(label)}</h3>`;

    const list = document.createElement("div");
    records.forEach((publication) => {
      const article = document.createElement("article");
      article.className = "archive-publication";
      article.dataset.publication = "";
      article.dataset.search = [
        publication.title,
        publication.authors,
        publication.journal,
        publication.doi,
        publication.year,
        publication.group,
      ].join(" ").toLowerCase();
      article.innerHTML = publicationMarkup(publication);
      list.append(article);
    });
    section.append(list);
    archive.append(section);
  });

  finishRender(groups.map(({ label }) => label));
}

function extractLegacyGroups(documentRoot) {
  const groups = [];
  let current;

  documentRoot.querySelectorAll("body > section").forEach((section) => {
    if (section.classList.contains("content3")) {
      const heading = section.querySelector(".display-2");
      const label = heading?.textContent.trim();
      if (label) {
        current = { label: label.toLowerCase() === "under review" ? "Under review" : label, publications: [] };
        groups.push(current);
      }
      return;
    }

    const blockquote = section.querySelector("blockquote");
    if (blockquote) {
      if (!current) {
        current = { label: "Other", publications: [] };
        groups.push(current);
      }
      current.publications.push(blockquote);
    }
  });

  return groups.filter((group) => group.publications.length);
}

function filterPublications() {
  const query = search.value.trim().toLowerCase();
  const selectedYear = yearFilter.value;
  let visible = 0;

  archive.querySelectorAll("[data-publication-group]").forEach((group) => {
    const yearMatches = selectedYear === "all" || group.dataset.publicationGroup === selectedYear;
    let visibleInGroup = 0;
    group.querySelectorAll("[data-publication]").forEach((publication) => {
      const matches = yearMatches && publication.dataset.search.includes(query);
      publication.hidden = !matches;
      if (matches) visibleInGroup += 1;
    });
    group.hidden = visibleInGroup === 0;
    visible += visibleInGroup;
  });

  archive.querySelector(".publication-empty")?.remove();
  if (!visible) {
    const empty = document.createElement("p");
    empty.className = "publication-empty";
    empty.textContent = "No publications match those filters.";
    archive.append(empty);
  }
  count.textContent = `${visible} ${visible === 1 ? "result" : "results"}`;
}

async function loadLegacyArchive() {
  const sourceUrl = new URL("../../history/publications-mobirise-2025.html", import.meta.url);
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Archive request failed with ${response.status}`);
  const source = new DOMParser().parseFromString(await response.text(), "text/html");
  const groups = extractLegacyGroups(source);
  if (!groups.length) throw new Error("No publication records were found in the archive.");
  renderLegacyGroups(groups);
}

async function loadArchive() {
  try {
    const collection = await loadCollectionDocument("publications");
    if (collection.source !== "airtable" || !collection.complete) {
      throw new Error("The Airtable archive has not been generated yet.");
    }
    if (!collection.records.length) throw new Error("The Airtable publication archive is empty.");
    renderStructuredArchive(collection.records);
  } catch (error) {
    console.warn("The Airtable publication archive is unavailable; showing the preserved archive.", error);
    try {
      await loadLegacyArchive();
    } catch (fallbackError) {
      console.error(fallbackError);
      archive.innerHTML = '<p class="content-error">The publication list is temporarily unavailable. Please try again later.</p>';
      archive.setAttribute("aria-busy", "false");
    }
  }
}

search.addEventListener("input", filterPublications);
yearFilter.addEventListener("change", filterPublications);
loadArchive();
