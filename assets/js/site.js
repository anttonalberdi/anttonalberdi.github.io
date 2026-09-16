const THEME_PREFERENCES = ["system", "light", "dark"];

const NAVIGATION = [
  { id: "research", label: "Research", href: "research.html" },
  { id: "ethics", label: "Ethics", href: "ethics.html" },
  { id: "members", label: "People", href: "members.html" },
  { id: "publications", label: "Publications", href: "publications.html" },
  { id: "resources", label: "Resources", href: "resources.html" },
  { id: "teaching", label: "Teaching", href: "teaching.html" },
  { id: "joinus", label: "Join us", href: "joinus.html" },
];

function readThemePreference() {
  try {
    const value = localStorage.getItem("theme");
    return THEME_PREFERENCES.includes(value) ? value : "system";
  } catch (_) {
    return "system";
  }
}

function resolveTheme(preference) {
  if (preference !== "system") return preference;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function themeIcon(preference) {
  if (preference === "light") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="1.7"/>
        <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56m11.02 11.02 1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/>
      </svg>`;
  }

  if (preference === "dark") {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.4 15.25A8.4 8.4 0 0 1 8.75 3.6 8.42 8.42 0 1 0 20.4 15.25Z" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="1.7"/>
      </svg>`;
  }

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="1.7"/>
      <path d="M12 3.75a8.25 8.25 0 0 1 0 16.5Z" fill="currentColor"/>
    </svg>`;
}

function applyTheme(preference) {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;

  try {
    localStorage.setItem("theme", preference);
  } catch (_) {
    // Browsers can disable storage in strict privacy modes.
  }

  document.querySelectorAll(".theme-toggle").forEach((button) => {
    button.innerHTML = themeIcon(preference);
    button.setAttribute("aria-label", `Theme: ${preference}. Activate to change.`);
    button.setAttribute("title", `Theme: ${preference}`);
  });

  const themeColor = resolved === "dark" ? "#192520" : "#f4efe6";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
}

class SiteHeader extends HTMLElement {
  connectedCallback() {
    const active = this.getAttribute("active") || "";
    const links = NAVIGATION.map(
      ({ id, label, href }) => `
        <li>
          <a href="${href}"${active === id ? ' aria-current="page"' : ""}>${label}</a>
        </li>`,
    ).join("");

    this.innerHTML = `
      <nav class="site-nav" aria-label="Primary navigation">
        <a class="site-brand" href="index.html"${active === "home" ? ' aria-current="page"' : ""}>
          <img class="site-brand__mark" src="assets/images/alberdilab-110x110.png" alt="" width="44" height="44">
          <span class="site-brand__copy">
            <span class="site-brand__name">AlberdiLab</span>
            <span class="site-brand__place">GLOBE · UCPH</span>
          </span>
        </a>
        <div class="site-nav__cluster">
          <ul class="site-nav__links">${links}</ul>
          <div class="site-nav__controls">
            <button class="theme-toggle" type="button"></button>
            <button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false">
              <span></span>
            </button>
          </div>
        </div>
      </nav>`;

    const menu = this.querySelector(".site-nav__links");
    const menuToggle = this.querySelector(".menu-toggle");
    const themeToggle = this.querySelector(".theme-toggle");

    const closeMenu = () => {
      menu.classList.remove("is-open");
      this.classList.remove("is-open");
      document.body.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation");
    };

    const setScrolledState = () => {
      this.classList.toggle("is-scrolled", window.scrollY > 18);
    };

    menuToggle.addEventListener("click", () => {
      const open = !menu.classList.contains("is-open");
      menu.classList.toggle("is-open", open);
      this.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    });

    themeToggle.addEventListener("click", () => {
      const current = readThemePreference();
      const next = THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(current) + 1) % THEME_PREFERENCES.length];
      applyTheme(next);
    });

    menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) closeMenu();
    });
    window.addEventListener("scroll", setScrolledState, { passive: true });

    applyTheme(readThemePreference());
    setScrolledState();
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="site-footer">
        <div class="shell site-footer__top">
          <div class="site-footer__intro">
            <a class="site-footer__brand" href="index.html">
              <img src="assets/images/alberdilab-110x110.png" alt="" width="58" height="58">
              <span>AlberdiLab</span>
            </a>
            <p class="site-footer__tagline">Exploring animals as dynamic ecological communities.</p>
          </div>
          <div>
            <h2>Visit us</h2>
            <address>
              GLOBE Institute<br>
              University of Copenhagen<br>
              Øster Farimagsgade 5, Building 7<br>
              1353 Copenhagen, Denmark
            </address>
          </div>
          <div>
            <h2>Connect</h2>
            <p class="site-footer__contact">
              <a href="mailto:antton.alberdi@sund.ku.dk">antton.alberdi@sund.ku.dk</a>
            </p>
            <ul class="site-footer__links">
              <li><a href="https://www.earthhologenome.org/" target="_blank" rel="noopener noreferrer">Earth Hologenome Initiative ↗</a></li>
              <li><a href="https://www.3domics.eu/" target="_blank" rel="noopener noreferrer">3D'omics ↗</a></li>
              <li><a href="https://globe.ku.dk/" target="_blank" rel="noopener noreferrer">GLOBE Institute ↗</a></li>
            </ul>
          </div>
        </div>
        <div class="shell site-footer__bottom">
          <span>© ${new Date().getFullYear()} AlberdiLab</span>
          <div class="site-footer__affiliation">
            <span>Part of the University of Copenhagen</span>
            <img src="assets/images/ku-logo-uk-h-240x89.png" alt="University of Copenhagen" width="92" height="34">
          </div>
        </div>
      </footer>`;
  }
}

customElements.define("site-header", SiteHeader);
customElements.define("site-footer", SiteFooter);

const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
mediaQuery?.addEventListener?.("change", () => {
  if (readThemePreference() === "system") applyTheme("system");
});

function prepareReveals() {
  const elements = document.querySelectorAll("[data-reveal]");
  if (!elements.length || !window.IntersectionObserver) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  document.documentElement.classList.add("reveal-ready");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8%", threshold: 0.08 },
  );

  elements.forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index % 3, 2) * 70}ms`;
    observer.observe(element);
  });
}

prepareReveals();
