# Time Planner

A single-file operations planner that runs locally in Chrome. It includes the saved **Ranger 8549; Epley Glasscock E8E 205H** example job, phase targets, reminders, and daily WellView copy/paste.

## Run

Download or clone this repository and open `index.html` in Chrome. No installation, server, Excel macros, network connection, or build step is required.

The initial `index.html` is an unchanged copy of **Time Planner - 2026-10-01 (4).html**, the latest working save supplied on September 30, 2026.

## Use and save

- **Job Setup & Targets** contains rig/well details, target settings, target attainment, and instructions.
- The input button switches all phases between entering duration and entering end time. Start times follow the previous activity's end time.
- Each phase has its own insert/add controls. Row tools support duplicate, delete, move up/down, and Undo.
- **Copy for WellView** groups whole activities by their start time into reporting days from 06:00 to 06:00. Select entries in that preview. Events are never split automatically.
- WellView copy includes Actual Dur, Major Ops Code, Desc, Ops, and Com. Start/end times are shown for reference but excluded from the copied text. The hidden Ops column is included.
- **Save** downloads a portable HTML copy containing the current job data and settings. Browser drafts are local to that browser; they are not automatically uploaded to GitHub.

To version a later saved job, replace `index.html` with the downloaded HTML, run the checks, then commit and push. Keep other edits you want to retain in the saved file before replacing it.

## Targets

Targets are tracked by phase and job. Pre Ops and Post Ops initially use 8 hours each. TIH and TOOH use the formation/length tables. Drill Out uses lateral feet per 24 hours (`lateral feet / target feet per day × 24`). Set Production uses 24 hours.

Line targets are allocated proportionately using the saved example activity durations. Phase attainment compares target hours with current scheduled hours. Daily target attainment is not calculated.

## Reference documents

The original files are preserved in `references/`:

- `R8549_Epley Glasscock 205H.xlsx` — example job activity log.
- `Daily Drillout Scorecard - 09-10-2026_06-21-06 A.xlsm` — scorecard reference for target-attainment concepts.
- `New Targets MB 4Q26 OL.xlsx` — target reference supplied for future work.

These documents are references; the HTML does not read or execute them. Adding a new reference does not automatically change the planner's calculations.

## Development checks

Node.js 20 or newer is needed only for tests. There are no package dependencies to install.

```sh
npm test
```

The checks execute the embedded application script with a lightweight DOM mock. They cover whole-event daily exports and preview selection, row tools and chained times, phase layout and column resizing, reminder fields, Undo, and older draft compatibility. They do not replace a visual check in Chrome.

`outputs/` contains historical local development artifacts and is intentionally excluded from Git.
