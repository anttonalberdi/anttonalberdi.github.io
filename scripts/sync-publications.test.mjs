import assert from "node:assert/strict";
import test from "node:test";

import { fetchAllRecords, normalisePublications, readConfig } from "./sync-publications.mjs";

test("normalises and sorts published and under-review records", () => {
  const result = normalisePublications([
    {
      id: "recPublished",
      fields: {
        Title: "Published paper",
        Authors: "A Author, B Author",
        Year: 2025,
        Journal: "Example Journal",
        DOI: "https://doi.org/10.1234/example",
        Order: 2,
      },
    },
    {
      id: "recReview",
      fields: {
        Title: "Submitted paper",
        Authors: "A Author",
        Status: "Under review",
        "Hide from homepage": true,
      },
    },
  ]);

  assert.equal(result[0].id, "recReview");
  assert.equal(result[0].group, "Under review");
  assert.equal(result[0].featured, false);
  assert.equal(result[1].doi, "10.1234/example");
  assert.equal(result[1].url, "https://doi.org/10.1234/example");
});

test("rejects incomplete records", () => {
  assert.throws(
    () => normalisePublications([{ id: "recBad", fields: { Title: "Incomplete" } }]),
    /missing Authors, missing Year/,
  );
});

test("follows Airtable pagination", async () => {
  const requestedUrls = [];
  const pages = [
    { records: [{ id: "rec1", fields: {} }], offset: "next-page" },
    { records: [{ id: "rec2", fields: {} }] },
  ];
  const records = await fetchAllRecords({
    token: "token",
    baseId: "appBase",
    table: "Publications",
    view: "Published",
    returnFieldsByFieldId: true,
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      return {
        ok: true,
        json: async () => pages.shift(),
      };
    },
  });

  assert.deepEqual(records.map(({ id }) => id), ["rec1", "rec2"]);
  assert.equal(requestedUrls[0].searchParams.get("view"), "Published");
  assert.equal(requestedUrls[0].searchParams.get("returnFieldsByFieldId"), "true");
  assert.equal(requestedUrls[1].searchParams.get("offset"), "next-page");
});

test("requires credentials and validates the safety threshold", () => {
  assert.throws(() => readConfig({}), /AIRTABLE_ACCESS_TOKEN/);
  const defaults = readConfig({ AIRTABLE_ACCESS_TOKEN: "pat", AIRTABLE_BASE_ID: "app" });
  assert.equal(defaults.minimum, 40);
  assert.equal(defaults.view, "");
  assert.throws(
    () => readConfig({ AIRTABLE_ACCESS_TOKEN: "pat", AIRTABLE_BASE_ID: "app", AIRTABLE_MIN_PUBLICATIONS: "0" }),
    /positive integer/,
  );
});
