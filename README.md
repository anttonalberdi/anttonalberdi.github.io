# AlberdiLab website

The public website for the AlberdiLab at the GLOBE Institute, University of
Copenhagen: [www.alberdilab.dk](https://www.alberdilab.dk/).

## Site architecture

The primary site replaces the generated AMP/Mobirise layer with a small,
dependency-free site engine designed for GitHub Pages:

- `index.html` and the primary content pages — semantic layouts and metadata
- `assets/css/site.css` — shared design tokens, components and responsive styles
- `assets/js/site.js` — shared header/footer web components, mobile navigation,
  theme preference and restrained reveal motion
- `assets/js/content.js` — content provider with a remote-first/local-fallback
  contract
- `assets/js/home.js` — homepage renderers
- `assets/js/publications.js` — searchable rendering of the publication archive
- `assets/data/*.json` — current content snapshots

The former homepage and publication export are preserved in `history/`.
`project.mobirise` remains the original editable source archive. Retired,
backup and utility pages have intentionally not been folded into the public
design system.

No build step is required. Serve the repository root locally so browser `fetch`
can load the JSON files:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173/`.

## Content and Airtable

The homepage and project page read local snapshots from
`assets/data/projects.json`. Publications and current members are exported from
Airtable to `assets/data/publications.json` and `assets/data/members.json` by
`.github/workflows/deploy-site.yml`. Generated snapshots are versioned, so the
site does not make browser requests to Airtable and an Airtable outage cannot
break the public site.

Until the first successful Airtable export, the publication page continues to
use `history/publications-mobirise-2025.html`. Afterward, the generated JSON is
the primary source for both the homepage and complete publication archive.
The People page likewise retains its hard-coded current-team cards until its
first successful member export. Alumni and visitors remain static HTML.

### Airtable setup

The exporter reads every record in the `Publications` table by default. It
recognises these columns (names are case-insensitive):

| Column | Requirement | Purpose |
| --- | --- | --- |
| `Title` | Required | Publication title |
| `Authors` | Required | Formatted author list |
| `Year` | Required for published work | Four-digit publication year |
| `Journal` | Optional | Journal or venue |
| `DOI` | Optional | Bare DOI or doi.org URL |
| `URL` | Optional | Article URL; derived from DOI when absent |
| `Status` | Optional | `Under review` creates the matching archive group |
| `Group` | Optional | Explicit group name, overriding the year heading |
| `Order` | Optional | Higher numbers appear first within a group |
| `Hide from homepage` | Optional | Checked records remain in the archive but not the homepage |

Alternative field names and explicit `AIRTABLE_FIELD_*` overrides are supported
in `scripts/sync-publications.mjs`.

Create an Airtable personal access token with only `data.records:read` access,
scoped to the relevant base. In the GitHub repository, open **Settings → Secrets
and variables → Actions** and add:

- Secret `AIRTABLE_ACCESS_TOKEN`: the personal access token.
- Variable `AIRTABLE_BASE_ID`: the Airtable base ID beginning with `app`.
- Variable `AIRTABLE_PUBLICATIONS_TABLE`: table name or ID; defaults to
  `Publications` when omitted.
- Variable `AIRTABLE_PUBLICATIONS_VIEW`: optional view name or ID. When omitted,
  every record in the table is exported.
- Variable `AIRTABLE_MIN_PUBLICATIONS`: optional safety threshold, defaulting to
  `40`. The sync fails instead of replacing the 54-entry preserved archive when
  Airtable returns fewer records. Lower it only if a smaller export is intended.

If an Airtable column uses a different name, add the corresponding repository
variable, such as `AIRTABLE_FIELD_TITLE`, `AIRTABLE_FIELD_AUTHORS`, or
`AIRTABLE_FIELD_YEAR`. The complete list is in the workflow file.

### People setup

The member exporter reads the table named by `AIRTABLE_MEMBERS_TABLE`. Rows with
none of the three profile fields (`Biosketch`, `Position`, or `Picture`) are
treated as unrelated records and ignored, which allows the roster to live in a
shared table. Once any profile field is present, the exporter requires the
name, position, and picture fields:

| Column | Requirement | Purpose |
| --- | --- | --- |
| `Name` | Required | Display name |
| `Biosketch` | Optional | Short biography shown on the card |
| `Position` | Required | Role or job title |
| `Picture` | Required | Airtable image attachment |

The workflow downloads each `Picture` attachment into
`assets/images/people/` and stores the local path in `members.json`. This avoids
publishing temporary Airtable attachment URLs. Obsolete generated portraits are
removed, while manually managed images elsewhere in `assets/images/` are never
touched.

Repository variables for People:

- `AIRTABLE_MEMBERS_TABLE`: required table name or ID.
- `AIRTABLE_MEMBERS_VIEW`: optional view name or ID. When omitted, every record
  in the table is exported.
- `AIRTABLE_MIN_MEMBERS`: optional safety threshold, defaulting to `5`.
- `AIRTABLE_FIELD_MEMBER_NAME`, `AIRTABLE_FIELD_MEMBER_BIOSKETCH`,
  `AIRTABLE_FIELD_MEMBER_POSITION`, and `AIRTABLE_FIELD_MEMBER_PICTURE`: optional
  field-name overrides; the four names above are used by default.

The workflow runs daily at 04:17 UTC and can be started immediately from the
repository's **Actions → Deploy site → Run workflow** menu. Normal pushes deploy
the checked-in snapshot without querying Airtable. Scheduled and manual runs
fetch every Airtable page, validate the records, download member portraits,
commit changed snapshots, and deploy that exact version.

Never put the Airtable token in this repository, an HTML file, or browser
JavaScript.

## Deployment

The site is published by the `Deploy site` GitHub Actions workflow. In the
repository's **Settings → Pages**, set **Source** to **GitHub Actions**. Keep
`CNAME` in the repository root. Pushes to `master` deploy code changes; scheduled
or manual workflow runs also refresh publications before deploying.
