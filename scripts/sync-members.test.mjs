import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildMembers, normaliseMemberRecords, readMemberConfig, selectMemberRecords } from "./sync-members.mjs";

const SAMPLE_RECORD = {
  id: "recPerson",
  fields: {
    Name: "Ada Example",
    Biosketch: "I study example ecosystems.",
    Position: { name: "Postdoc" },
    Picture: [
      {
        filename: "portrait.jpeg",
        type: "image/jpeg",
        url: "https://example.test/original",
        width: 1200,
        height: 1600,
        thumbnails: {
          full: { url: "https://example.test/full", width: 900, height: 1200 },
        },
      },
    ],
  },
};

test("normalises the four member fields and chooses the full thumbnail", () => {
  const [member] = normaliseMemberRecords([SAMPLE_RECORD]);
  assert.equal(member.name, "Ada Example");
  assert.equal(member.position, "Postdoc");
  assert.equal(member.picture.url, "https://example.test/full");
  assert.equal(member.picture.width, 900);
});

test("normalises member fields returned by Airtable ID", () => {
  const environment = {
    AIRTABLE_FIELD_MEMBER_NAME: "fldName",
    AIRTABLE_FIELD_MEMBER_BIOSKETCH: "fldBio",
    AIRTABLE_FIELD_MEMBER_POSITION: "fldPosition",
    AIRTABLE_FIELD_MEMBER_PICTURE: "fldPicture",
  };
  const fields = Object.fromEntries(
    Object.entries(SAMPLE_RECORD.fields).map(([name, value]) => [
      environment[`AIRTABLE_FIELD_MEMBER_${name.toUpperCase()}`],
      value,
    ]),
  );
  const [member] = normaliseMemberRecords([{ ...SAMPLE_RECORD, fields }], environment);
  assert.equal(member.name, "Ada Example");
  assert.equal(member.position, "Postdoc");
});

test("selects website profiles from a shared Airtable table", () => {
  const records = [
    { id: "recUnrelated", fields: { Name: "Unrelated row", Status: "Active" } },
    SAMPLE_RECORD,
    { id: "recPartial", fields: { Name: "Partial profile", Position: "PhD fellow" } },
  ];

  assert.deepEqual(
    selectMemberRecords(records).map(({ id }) => id),
    ["recPerson", "recPartial"],
  );
});

test("rejects an incomplete member", () => {
  assert.throws(
    () => normaliseMemberRecords([{ id: "recBad", fields: { Name: "Incomplete" } }]),
    /missing Position, missing Picture\. Available fields: Name\./,
  );
});

test("allows a member profile without a biosketch", () => {
  const fields = { ...SAMPLE_RECORD.fields };
  delete fields.Biosketch;
  const [member] = normaliseMemberRecords([{ ...SAMPLE_RECORD, fields }]);
  assert.equal(member.biosketch, "");
});

test("downloads portraits and removes only stale generated portraits", async () => {
  const directory = await mkdtemp(join(tmpdir(), "alberdilab-members-"));
  try {
    await writeFile(join(directory, "airtable-stale.jpg"), "stale");
    await writeFile(join(directory, "keep-me.txt"), "keep");
    const members = await buildMembers([SAMPLE_RECORD], {
      imageDirectory: directory,
      imageUrlPrefix: "assets/images/people",
      fetchImpl: async () => ({
        ok: true,
        headers: { get: () => "image/jpeg" },
        arrayBuffer: async () => Uint8Array.from([255, 216, 255, 217]).buffer,
      }),
    });

    assert.match(members[0].picture, /^assets\/images\/people\/airtable-recPerson-[a-f0-9]{12}\.jpg$/);
    const files = await readdir(directory);
    assert.equal(files.includes("airtable-stale.jpg"), false);
    assert.equal(files.includes("keep-me.txt"), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("validates member configuration", () => {
  assert.throws(() => readMemberConfig({}), /AIRTABLE_ACCESS_TOKEN/);
  const config = readMemberConfig({
    AIRTABLE_ACCESS_TOKEN: "pat",
    AIRTABLE_BASE_ID: "app",
    AIRTABLE_MEMBERS_TABLE: "People",
  });
  assert.equal(config.table, "People");
  assert.equal(config.view, "");
  assert.equal(config.minimum, 5);
  assert.equal(config.returnFieldsByFieldId, false);

  const fieldIdConfig = readMemberConfig({
    AIRTABLE_ACCESS_TOKEN: "pat",
    AIRTABLE_BASE_ID: "app",
    AIRTABLE_MEMBERS_TABLE: "People",
    AIRTABLE_FIELD_MEMBER_NAME: "fldName",
  });
  assert.equal(fieldIdConfig.returnFieldsByFieldId, true);
});
