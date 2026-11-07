import { escapeHtml, loadCollection } from "./content.js";

const root = document.querySelector("[data-publishing-chart]");

const SERIES = [
  { key: "nonprofit", label: "Non-profit / society journals" },
  { key: "forprofit", label: "For-profit / non-society journals" },
  { key: "unclassified", label: "Unclassified" },
];

async function loadTypes() {
  const url = new URL("../data/journal-types.json", import.meta.url);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`journal-types.json: HTTP ${response.status}`);
  return (await response.json()).journals ?? {};
}

function tally(publications, types) {
  const years = new Map();
  publications.forEach(({ year, journal }) => {
    if (!year) return;
    const row = years.get(year) ?? { nonprofit: 0, forprofit: 0, unclassified: 0 };
    row[types[journal] ?? "unclassified"] += 1;
    years.set(year, row);
  });
  return [...years.entries()].sort(([a], [b]) => a - b);
}

function render(rows) {
  const max = Math.max(...rows.map(([, row]) => row.nonprofit + row.forprofit + row.unclassified));
  const used = SERIES.filter(({ key }) => rows.some(([, row]) => row[key] > 0));

  const bars = rows
    .map(([year, row]) => {
      const total = row.nonprofit + row.forprofit + row.unclassified;
      const segments = used
        .filter(({ key }) => row[key] > 0)
        .map(
          ({ key, label }) =>
            `<span class="publishing-chart__seg publishing-chart__seg--${key}" style="flex-grow:${row[key]}" title="${escapeHtml(label)}: ${row[key]}">${row[key]}</span>`,
        )
        .join("");
      const summary = used.map(({ key, label }) => `${label}: ${row[key]}`).join(", ");
      return `<li class="publishing-chart__col" role="img" aria-label="${year}: ${total} papers. ${escapeHtml(summary)}">
        <span class="publishing-chart__total">${total}</span>
        <span class="publishing-chart__bar" style="height:calc((100% - 24px) * ${total / max})">${segments}</span>
        <span class="publishing-chart__year">${year}</span>
      </li>`;
    })
    .join("");

  const legend = used
    .map(
      ({ key, label }) =>
        `<li><span class="publishing-chart__swatch publishing-chart__seg--${key}" aria-hidden="true"></span>${escapeHtml(label)}</li>`,
    )
    .join("");

  root.innerHTML = `<ol class="publishing-chart__plot">${bars}</ol><ul class="publishing-chart__legend">${legend}</ul>`;
  root.setAttribute("aria-busy", "false");
}

async function init() {
  if (!root) return;
  try {
    const [publications, types] = await Promise.all([loadCollection("publications"), loadTypes()]);
    const rows = tally(publications, types);
    if (rows.length) render(rows);
    else root.textContent = "Publication data is not available right now.";
  } catch (error) {
    console.warn("Publishing chart unavailable.", error);
    root.textContent = "Publication data is not available right now.";
  }
}

init();
