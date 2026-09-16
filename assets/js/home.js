import { escapeHtml, loadCollection, safeHref } from "./content.js";
import { selectLatestPublications } from "./publication-feed.js";
import "./hero-animals.js";

function renderProjects(projects) {
  const container = document.querySelector("[data-projects]");
  if (!container) return;

  const featured = projects
    .filter((project) => project.featured !== false)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .slice(0, 3);

  container.innerHTML = featured
    .map((project) => {
      const href = safeHref(project.url);
      const external = /^https?:\/\//.test(href);
      return `
        <a class="project-card" href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>
          <img class="project-card__image" src="${escapeHtml(project.image)}" alt="${escapeHtml(project.imageAlt)}" loading="lazy">
          <span class="project-card__shade" aria-hidden="true"></span>
          <span class="project-card__meta">
            <span>${escapeHtml(project.type)}</span>
            <span class="project-card__arrow" aria-hidden="true">↗</span>
          </span>
          <h3>${escapeHtml(project.title)}</h3>
          <p>${escapeHtml(project.description)}</p>
        </a>`;
    })
    .join("");

  container.setAttribute("aria-busy", "false");
}

function renderPublications(publications) {
  const container = document.querySelector("[data-publications]");
  if (!container) return;

  const latest = selectLatestPublications(publications, container.dataset.limit);

  container.innerHTML = latest
    .map((publication) => {
      const href = safeHref(publication.url);
      return `
        <a class="publication-card" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
          <span class="publication-card__year">${escapeHtml(publication.year)}</span>
          <span>
            <h3>${escapeHtml(publication.title)}</h3>
            <p>${escapeHtml(publication.authors)} · <span class="publication-card__journal">${escapeHtml(publication.journal)}${publication.volume ? ` ${escapeHtml(publication.volume)}` : ""}</span></p>
          </span>
          <span class="publication-card__arrow" aria-hidden="true">↗</span>
        </a>`;
    })
    .join("");

  container.setAttribute("aria-busy", "false");
}

function showContentError(selector, destination, label) {
  const container = document.querySelector(selector);
  if (!container) return;
  container.innerHTML = `<p class="content-error">This content is temporarily unavailable. <a href="${destination}">Visit ${label}</a>.</p>`;
  container.setAttribute("aria-busy", "false");
}

Promise.allSettled([loadCollection("projects"), loadCollection("publications")]).then(
  ([projectsResult, publicationsResult]) => {
    if (projectsResult.status === "fulfilled") {
      renderProjects(projectsResult.value);
    } else {
      console.error(projectsResult.reason);
      showContentError("[data-projects]", "research.html", "the research page");
    }

    if (publicationsResult.status === "fulfilled") {
      renderPublications(publicationsResult.value);
    } else {
      console.error(publicationsResult.reason);
      showContentError("[data-publications]", "publications.html", "the publications page");
    }
  },
);
