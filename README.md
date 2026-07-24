# SNHU Degree Tracker

An interactive degree-planning tracker for Southern New Hampshire University's
BS in Business Administration with a Management Information Systems
concentration.

## Live site

[Open the degree tracker](https://minervadreaming.github.io/snhu-degree-tracker/)

## Features

- Tracks planned, in-progress, and completed courses
- Separates SNHU, transfer, certificate, and Sophia Learning credits
- Monitors the 120-credit degree total
- Monitors the 30-credit SNHU residency minimum and 90-credit transfer maximum
- Supports editable free electives and custom courses
- Exports plans as JSON backups or CSV files

## Run locally

Open `index.html` in a modern web browser. The application is a self-contained
static site and has no build step or external dependencies.

## Data and persistence

Tracker data is saved in the browser's local storage. It persists across
sessions in the same browser, but it does not automatically synchronize across
browsers or devices. Use **Export plan** to download a JSON backup, then use
**Restore backup** on another browser or device.

No course selections, notes, transfer records, or other personal tracker data
are sent to GitHub by the application.

## Disclaimer

This project is an independent planning tool, not an official SNHU degree
audit. SNHU determines how transfer, certificate, Sophia Learning, and other
prior-learning credits apply to a student's program. Confirm current
requirements and equivalencies with an SNHU academic advisor.

