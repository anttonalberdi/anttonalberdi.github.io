import assert from "node:assert/strict";
import test from "node:test";

import { selectLatestPublications } from "../assets/js/publication-feed.js";

test("selects the latest three homepage publications from an Airtable export", () => {
  const publications = [
    { id: "older", year: 2024, order: 10, title: "Older", featured: true },
    { id: "newer-second", year: 2026, order: 2, title: "Newer second", featured: true },
    { id: "hidden", year: 2027, order: 20, title: "Hidden", featured: false },
    { id: "middle", year: 2025, order: 50, title: "Middle", featured: true },
    { id: "newer-first", year: 2026, order: 3, title: "Newer first", featured: true },
  ];
  const originalOrder = publications.map(({ id }) => id);

  assert.deepEqual(
    selectLatestPublications(publications, "3").map(({ id }) => id),
    ["newer-first", "newer-second", "middle"],
  );
  assert.deepEqual(
    publications.map(({ id }) => id),
    originalOrder,
    "selection must not mutate the full archive",
  );
});

test("uses a three-record fallback for an invalid limit", () => {
  const publications = Array.from({ length: 5 }, (_, index) => ({
    id: `record-${index}`,
    year: 2025,
    order: index,
    title: `Record ${index}`,
  }));

  assert.equal(selectLatestPublications(publications, "invalid").length, 3);
});
