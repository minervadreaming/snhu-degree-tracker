# SNHU Degree Completion Optimizer

A dependency-free, browser-based degree audit and scenario planner for an SNHU BS in Business Administration with a Management Information Systems concentration.

## Live site

[Open the degree tracker](https://minervadreaming.github.io/snhu-degree-tracker/)

## Privacy model

The GitHub Pages application files are public. They contain a blank first-run plan and an explicitly selectable fictional demonstration profile only.

Personal profile fields, course selections, transfer records, credentials, scenarios, costs, and advisor notes are stored in the current browser’s `localStorage`. The app has:

- no account or cloud synchronization;
- no backend or remote database;
- no analytics, telemetry, or remote error reporting;
- no network-based file parser; and
- no code that uploads plan state or imported file contents.

Clearing site data can erase a plan. Use **Export & print → Download JSON backup** regularly. Restore backups using the local JSON import, which validates and previews the plan before replacement.

Do not commit real academic records, evaluations, exported plans, screenshots containing plan data, or local backups.

## First run and local migration

A new visitor must explicitly choose to:

1. start with a blank plan;
2. import a local JSON backup; or
3. load fictional demo data.

Persisted schema version 3 is separate from public defaults. Existing version-1 or version-2 browser records are migrated locally. The migration keeps an in-memory copy, validates the result, writes only after success, and restores the prior records if an error occurs.

## Features

- Separate Available, Planned, In Progress, and Completed states.
- Requirement status independent from equivalency confidence.
- Configurable SNHU, transfer, credential, and third-party options.
- Degree-total, transfer-ceiling, institutional-residency, and major-residency audits.
- Deterministic planning modes and editable cost/time assumptions.
- Local scenarios, advisor-verification queue, JSON/CSV export, print/PDF, and advisor summary.
- Separate reset-to-blank, fictional-demo, and delete-all-local-data controls.

## Run and test locally

Open `index.html` directly in a modern browser. No build step, dependency install, or server is required.

Open `tests.html` to run the browser test suite. Run the defense-in-depth repository scan with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\privacy-scan.ps1
```

The scanner checks tracked production-readable files and supports an ignored `.privacy-patterns.local` file containing one private literal per line. It reports file paths and categories, not matched values. A passing scan does not prove perfect privacy.

## Optional local development data

The ignored path `private-data/local-profile.json` may be used as a developer reference, but production code never loads or bundles it. A fictional structure example is available at `docs/local-profile.example.json`.

Because the production app is the tracked static source itself, there is no generated `dist` bundle or source map. `dist/` and `build/` are ignored to prevent stale generated output from being published accidentally.

## Git history cleanup

Removing data from the current branch does not remove it from earlier commits. Review affected history before publishing. The included `scripts/history-privacy-cleanup.ps1` uses `git-filter-repo` and an ignored `.privacy-replacements.local` file so private search text does not need to appear in committed scripts.

After backing up the repository and installing `git-filter-repo`, place one supported replace-text expression per line in `.privacy-replacements.local`, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\history-privacy-cleanup.ps1
git remote add origin https://github.com/OWNER/REPOSITORY.git # only if filter-repo removed it
git push --force --all origin
git push --force --tags origin
```

History rewriting changes commit hashes. All collaborators must re-clone. GitHub Pages must be redeployed and checked afterward. Rewriting cannot guarantee removal from forks, caches, old clones, downloads, or third-party archives. Do not run these commands without reviewing the replacement file and keeping an offline backup.

## Deployment verification

1. Run `tests.html` and confirm every test passes.
2. Run `scripts/privacy-scan.ps1`, including a local prohibited-pattern file when available.
3. Confirm `git status` contains no evaluations, backups, PDFs, or private-data files.
4. Confirm `index.html` uses relative asset paths.
5. Push the reviewed static files and wait for the Pages deployment.
6. Open the production URL in a private window and confirm the first-run dialog appears with no preloaded personal plan.

## Disclaimer

This is an independent educational planning tool, not an official degree audit. Institutions determine how transfer, credential, and third-party credit applies. Confirm current requirements and equivalencies with an academic advisor.
