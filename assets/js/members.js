import { escapeHtml, loadCollectionDocument, safeHref } from "./content.js";

const grid = document.querySelector("[data-members]");
const count = document.querySelector("[data-member-count]");

const profileLinks = new Map([["Antton Alberdi", "antton_alberdi.html"]]);

function memberMarkup(member) {
  const picture = safeHref(member.picture);
  const profile = profileLinks.get(member.name);
  const name = profile
    ? `<a href="${escapeHtml(profile)}">${escapeHtml(member.name)}</a>`
    : escapeHtml(member.name);
  const dimensions = member.pictureWidth && member.pictureHeight
    ? ` width="${escapeHtml(member.pictureWidth)}" height="${escapeHtml(member.pictureHeight)}"`
    : "";
  const biosketch = member.biosketch ? `<p>${escapeHtml(member.biosketch)}</p>` : "";

  return `<article class="person-card is-visible">
    <div class="person-card__image"><img src="${escapeHtml(picture)}" alt="${escapeHtml(member.name)}"${dimensions} loading="lazy"></div>
    <div class="person-card__body">
      <span class="person-card__role">${escapeHtml(member.position)}</span>
      <h3>${name}</h3>
      ${biosketch}
    </div>
  </article>`;
}

async function loadMembers() {
  try {
    const collection = await loadCollectionDocument("members");
    if (collection.source !== "airtable" || !collection.complete) return;
    if (!collection.records.length) throw new Error("The Airtable member list is empty.");
    grid.innerHTML = collection.records.map(memberMarkup).join("");
    count.textContent = String(collection.records.length);
  } catch (error) {
    console.warn("The Airtable member list is unavailable; showing the preserved team list.", error);
  }
}

loadMembers();
