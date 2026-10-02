# Time Planner

A single-file operations planner that runs locally in Chrome. Plan multiple wells on one continuous sheet, with separate well details, phase targets, reminders, and daily WellView copy/paste. It includes the saved **Ranger 8549; Epley Glasscock E8E 205H** example job.

## Run

Download or clone this repository and open `index.html` in Chrome. No installation, server, Excel macros, network connection, or build step is required.

The example data comes from **Time Planner - 2026-10-01 (4).html**, the latest working save supplied on September 30, 2026. Subsequent application changes preserve its activities and settings.

## Use and save

- **Job Setup & Targets** contains rig/job start, the number of wells, independent details and target settings for each well, target attainment, and instructions. Increasing the count creates additional well-detail fields. Apply setup adds each new well with six empty standard phases. Reducing the count warns before removing wells and their data; Undo can restore them.
- The timeline follows well order with no automatic gaps. Collapse a whole well or an individual phase by clicking its heading. Collapsing does not affect calculations or exports; the saved file retains the collapse settings.
- **+ New phase** appends a phase to that well. Choose Pre Ops, Trip in Hole, Drill Out, Trip Out of Hole, Set Production, or Post Ops. A phase starts empty; add its activities with the phase row controls. Repeated phase types each receive their own phase budget.
- **Clear everything** warns before removing all wells' details, phases, rows, comments, reminders, and browser recovery data. The reset cannot be undone. Operation choices and target-reference tables remain available. Start again through setup and **+ New phase**, then Save to keep the reset planner.
- The input button switches all phases between entering duration and entering end time. Start times follow the previous activity's end time.
- Each phase has its own insert/add controls. Row tools support duplicate, delete, move up/down, and Undo.
- **Copy for WellView** lets you choose a well and a 06:00–06:00 reporting day. It groups whole activities by their start time. Select entries in that preview. Events are never split automatically, and different wells are never combined in one copy.
- WellView copy includes Actual Dur, Major Ops Code, Desc, Ops, and Com. Start/end times are shown for reference but excluded from the copied text. The hidden Ops column is included.
- **Save** downloads a portable HTML copy containing the current job data and settings. Browser drafts are local to that browser; they are not automatically uploaded to GitHub.

To version a later saved job, replace `index.html` with the downloaded HTML, run the checks, then commit and push. Keep other edits you want to retain in the saved file before replacing it.

## Targets

Targets are tracked by phase, well, and job. Each well uses its own formation and lateral length. Pre Ops and Post Ops initially use 8 hours each. TIH and TOOH use the formation/length tables. Drill Out uses lateral feet per 24 hours (`lateral feet / target feet per day × 24`). Set Production uses 24 hours.

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

The checks execute the embedded application script with a lightweight DOM mock. They cover multiple-well setup and targets, continuous timing, collapse persistence, confirmed reset, new phases, whole-event daily exports and preview selection, row tools, phase layout and column resizing, reminders, Undo, and older draft compatibility. They do not replace a visual check in Chrome.

`outputs/` contains historical local development artifacts and is intentionally excluded from Git.
