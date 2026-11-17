# ACU PhD Passport Portal

A small web portal that collects PhD student bio-data and passport photographs for the
Postgraduate College, Ajayi Crowther University, and lets registry staff download everything.

- **Student form** (`/`) collects title, full name, matric number and one passport photograph.
- **Admin register** (`/admin`) lists every submission and exports the records.
- Each passport is stored and named after the student's matric number
  (`ACU/PHD/24/0119` → `ACU-PHD-24-0119.jpg`).

## Run it locally

```bash
npm install
npm start
```

Open <http://localhost:3000>. The admin register is at <http://localhost:3000/admin>
(it is not linked from the student page).

Without configuration the portal uses SQLite and writes `data/portal.db`. Records and
photographs both live in that file, so copying it backs up the whole register.

## What the admin page gives you

| Action | What it downloads |
| --- | --- |
| **Excel** | `ACU-PhD-students-YYYY-MM-DD.xlsx` — matric, title, full name, photograph file name, submitted date |
| **CSV** | Same columns, UTF-8 with BOM so Excel opens it correctly |
| **All passports (.zip)** | Every photograph, one file per student, named with the matric number |
| **View / Download** per row | That student's photograph |
| **Delete** per row | Removes the record and the photograph |

Search filters by name or matric number as you type.

## How records behave

- Submitting a matric number that already exists **updates** that record. Re-uploading a
  photograph replaces it; leaving the file empty keeps the existing one.
- Uploads are limited to JPG, PNG or WEBP, 4 MB, one file.
- Matric numbers accept letters, digits, `/` and `-` (4–25 characters) and are stored uppercase.
- Photographs are stored inside the database, so a redeploy only needs the database to persist.

## Deploying

The portal needs a host with a persistent database. Two straightforward options:

### Render

`render.yaml` in this repo is a blueprint with a Node web service plus a managed Postgres.
Push the repo to GitHub, then in Render choose **New → Blueprint** and point it at the repo.
`DATABASE_URL` is injected automatically.

### Railway / Fly.io / any Docker host

1. Provision a Postgres instance (Railway: **New → Database → PostgreSQL**).
2. Set the environment variables below.
3. Build from the included `Dockerfile`, or use `npm start` on Node 22+.

```bash
docker build -t acu-phd-portal .
docker run -p 3000:3000 -e DATABASE_URL=postgres://... acu-phd-portal
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. When set, Postgres is used instead of SQLite. |
| `PORT` | Port to listen on (default `3000`). |
| `DATA_DIR` | Where the SQLite file lives when `DATABASE_URL` is unset (default `./data`). |

The schema is created automatically on first boot.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/students` | Multipart form: `title`, `fullName`, `matricNumber`, `passport` |
| `GET` | `/api/students?q=` | List records (no image data) |
| `GET` | `/api/students/:id/passport` | Photograph, downloaded as `<MATRIC>.<ext>` (`?inline=1` to display) |
| `DELETE` | `/api/students/:id` | Delete a record |
| `GET` | `/api/stats` | Totals and latest submission |
| `GET` | `/api/export.csv` · `/api/export.xlsx` · `/api/passports.zip` | Downloads |
| `GET` | `/api/config` | Titles, upload limit, active database |

## Before you share the link

The admin page has **no password, as requested**. Anyone who knows the URL can read the
register, download photographs and delete records. Keep the `/admin` URL to College staff,
and if it will be public for long, put an access rule in front of it (host-level basic auth,
or an allowlist on `/admin` and `/api/*` in `server.js`).
