import { escapeHtml, loadCollectionDocument, safeHref } from "./content.js";

const grid = document.querySelector("[data-members]");
const formerGrid = document.querySelector("[data-former-members]");
const visitorList = document.querySelector("[data-visitors]");
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

function formerMarkup(member) {
  const detail = member.biosketch || member.position;
  return `<article class="alumni-item"><h3>${escapeHtml(member.name)}</h3><p>${escapeHtml(detail)}</p></article>`;
}

function visitorMarkup(member) {
  const detail = member.biosketch || member.position;
  return `<li><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(detail)}</span></li>`;
}

async function loadMembers() {
  try {
    const collection = await loadCollectionDocument("members");
    if (collection.source !== "airtable" || !collection.complete) return;
    if (!collection.records.length) throw new Error("The Airtable member list is empty.");
    const active = collection.records.filter(({ section }) => section === "active");
    const former = collection.records.filter(({ section }) => section === "former");
    const visitors = collection.records.filter(({ section }) => section === "visitor");
    if (!active.length) throw new Error("The Airtable active-member list is empty.");
    grid.innerHTML = active.map(memberMarkup).join("");
    formerGrid.innerHTML = former.map(formerMarkup).join("");
    visitorList.innerHTML = visitors.map(visitorMarkup).join("");
    count.textContent = String(active.length);
  } catch (error) {
    console.warn("The Airtable member list is unavailable; showing the preserved team list.", error);
  }
}

loadMembers();
