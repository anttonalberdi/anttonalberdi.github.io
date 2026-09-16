import { escapeHtml, loadCollection, safeHref } from "./content.js";
import { selectLatestPublications } from "./publication-feed.js";

const HERO_ANIMALS = [
  {
    src: "assets/images/hero-frog-zdenet.jpg",
    alt: "A green tree frog on a dark background",
    width: 1400,
    height: 1050,
    position: "62% center",
  },
  {
    src: "assets/images/hero-lizard-akirevarga.jpg",
    alt: "A lizard among green leaves",
    width: 1400,
    height: 934,
    position: "center",
  },
  {
    src: "assets/images/hero-salamander-kathy-buscher.jpg",
    alt: "A black-and-yellow fire salamander",
    width: 1400,
    height: 1049,
    position: "60% center",
  },
  {
    src: "assets/images/hero-bird-balouriarajesh.jpg",
    alt: "A small brown bird perched on a wire",
    width: 1400,
    height: 912,
    position: "24% center",
  },
  {
    src: "assets/images/mbr-4-700x467.jpg",
    alt: "A wood mouse in its natural habitat",
    width: 700,
    height: 467,
    position: "center",
  },
];

function rotateHeroAnimal() {
  const image = document.querySelector("[data-hero-animal]");
  if (!image) return;

  let index = 0;

  try {
    const previousIndex = Number.parseInt(
      sessionStorage.getItem("hero-animal-index") ?? "",
      10,
    );

    if (Number.isInteger(previousIndex)) {
      index = (previousIndex + 1) % HERO_ANIMALS.length;
    }

    sessionStorage.setItem("hero-animal-index", String(index));
  } catch {
    index = Math.floor(Math.random() * HERO_ANIMALS.length);
  }

  const animal = HERO_ANIMALS[index];
  image.src = animal.src;
  image.alt = animal.alt;
  image.width = animal.width;
  image.height = animal.height;
  image.style.objectPosition = animal.position;
}

rotateHeroAnimal();

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
            <p>${escapeHtml(publication.authors)} · <span class="publication-card__journal">${escapeHtml(publication.journal)}</span></p>
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
