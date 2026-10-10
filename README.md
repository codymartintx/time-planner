# Time Planner

A single-file operations planner that runs locally in Chrome. Plan multiple wells on one continuous sheet, with separate well details, phase targets, reminders, and daily WellView copy/paste. It includes the saved **Ranger 8549; Epley Glasscock E8E 205H** example job.

## Run

Download or clone this repository and open `index.html` in Chrome. No installation, server, Excel macros, network connection, or build step is required.

The example data comes from **Time Planner - 2026-10-01 (4).html**, the latest working save supplied on September 30, 2026. Subsequent application changes preserve its activities and settings.

## Create a new planner

Open **`builder.html`** in Chrome to enter the rig, job start, number of wells and each well's details. Expand each phase to choose its variables and review its timelog preview. The builder shows target hours from the same reference rules as the planner. **Create planner** downloads a separate, self-contained HTML file with the selected setup and six populated standard phases per well. Each generated job has its own browser-draft identity.

The builder and generated planner work offline without other files. Phase choices are independent for each well:

- **Pre Ops:** always includes the seven BOP and MIRU Rig default rows from **TimeLog Building Ingrdients.xlsx**, followed by exactly one BHA row selected by Motor BHA. 1st Well uses an 8-hour base; No uses 4 hours. Motor BHA adds 0.50 hour to `WOV_BHA`, producing 8.5 or 4.5 hours respectively. Only the first well defaults to Yes for 1st Well.
- **Trip in Hole:** always includes all five TIH default rows, including the Washington rubber/float test.
- **Drill Out:** includes the loader planning row, the standard circulation row, and the default POOH pre-task brief. Importing recorded activities replaces only the loader planning row; the circulation and brief remain at the end even when the import extends past the original forecast.
- **TOH:** Snub No selects exactly one 10 KWF or Top Kill row. Snub Yes uses the four snubbing rows instead, with the sheet's 12 : 0.25 : 1.25 : 3 weights. The kill-method selector is disabled while snubbing is selected.
- **Set Production:** select HPGL, CGL, ESP & ESP-HR, or GAPL. The method is saved on the phase; one row holds the existing 24-hour planning allowance until detailed production rules are supplied.
- **Post Ops:** enter the target hours; the normal template is scaled to that duration.

The defaults, conditional rows, operation fields and comments follow **TimeLog Building Ingrdients.xlsx, Sheet1, rows 4–35**, in sheet order. Each well has independent choices; previews show the same rows used in its generated planner. Set Production and Post Ops retain their existing templates because the sheet does not define replacements for them. The templates live in `scripts/phase-templates.json`.

Included rows share the existing phase-hour budgets. Rows without sheet weights retain the existing relative allowances where available; the added pressure-test and circulation rows use a 0.50-hour allocation weight. Drill Out reserves 0.50 hour for circulation and 0.25 hour for the brief, with the remainder on the loader placeholder (small budgets are scaled to fit). Snubbing uses the four supplied weights, scaled to the existing TOH target. Pre Ops and split-string additions retain their existing exact hours.

For development, `npm run build:builder` updates `builder.html` with the current `index.html` code. The builder interface and generation logic live in `scripts/`; `npm test` rebuilds the standalone file before checking it. Regenerate it after changing the planner so future downloads include those changes.

## Use and save

- **Job Setup & Targets** contains rig/job start, the number of wells, independent details and target settings for each well, target attainment, and instructions. Increasing the count creates additional well-detail fields. Apply setup adds each new well with six empty standard phases. Reducing the count warns before removing wells and their data; Undo can restore them.
- The timeline follows well order with no automatic gaps. Collapse a whole well or an individual phase by clicking its heading. Collapsing does not affect calculations or exports; the saved file retains the collapse settings.
- Each well header shows **Est Well Swap** at the scheduled end of its Drill Out phase for the standard Pre Ops → Trip in Hole → Drill Out → TOH cadence. It updates with schedule edits and loader imports. An incomplete or invalid Drill Out finish shows a dash. Wells rebuilt with manually added phases after **Clear everything** do not calculate a swap time; this is retained when saved.
- **+ New phase** appends a phase to that well. Choose Pre Ops, Trip in Hole, Drill Out, TOH, Set Production, or Post Ops. A phase starts empty; add its activities with the phase row controls. Repeated phase types each receive their own phase budget.
- **Delete phase** in a phase heading removes that phase and all its rows. Later activities retain their durations, with entered end dates shifted to follow the remaining work. Imported start times retain their recorded timestamps. Undo restores the phase, rows, reminders and original dates. You can delete collapsed or empty phases, including the last phase in a well, then use **+ New phase** to add work again.
- Each row has a persistent **+** in the Row column to insert directly below it. Hover or focus **+** to reveal **Insert above**, duplicate, move or delete, then move directly onto those buttons to use them. Tooltips are removed. Inserted rows begin with zero hours and blank operation/comment fields, keeping existing activity durations intact while you enter the new work. The phase footer also offers **Insert at top** and **Add row at bottom**. Undo restores an insertion.
- **Clear everything** warns before removing all wells' details, phases, rows, comments, reminders, and browser recovery data. The reset cannot be undone. Operation choices and target-reference tables remain available. Start again through setup and **+ New phase**, then Save to keep the reset planner.
- The input button switches all phases between entering duration and entering end time. Manual start times follow the previous activity's end time; imported loader starts retain their recorded dates and times.
- Each phase has its own insert/add controls. Row tools support duplicate, delete, move up/down, and Undo.
- **Copy for WellView** lets you choose a well and a 06:00–06:00 reporting day. It groups whole activities by their start time. Select entries in that preview. Events are never split automatically, and different wells are never combined in one copy.
- WellView copy includes Actual Dur, Major Ops Code, Desc, Ops, and Com. Start/end times are shown for reference but excluded from the copied text. The hidden Ops column is included.
- **Save** downloads a portable HTML copy containing the current job data and settings, named `timePlanner_Well Name_YYYY-MM-DD_HH-MM-SS.html` using the local save date/time. Multiple wells' names are joined with ` + `; filename-unsafe characters are replaced with hyphens. Browser drafts are local to that browser; they are not automatically uploaded to GitHub.

To version a later saved job, replace `index.html` with the downloaded HTML, run the checks, then commit and push. Keep other edits you want to retain in the saved file before replacing it.

## Import a drillout loader

Click **Import loader** beside the destination **Drill Out** phase, then choose a saved `.xlsm` or `.xlsx` loader. The preview reads **DO TimeLog** columns A–J by their headers: Start Time, End Time, Duration (hours), Mjr Ops Code, Description, Operation, and Com. The decimal clock helper columns are ignored. Blank template rows containing only operation choices are skipped.

For clock-only times, confirm **First activity date**. Each midnight crossing advances the date automatically. Complete start/end times determine duration; saved duration supplies missing timing where possible. Review the preview before clicking **Import activities**.

The import adds or updates activities only in the selected Drill Out phase. Manual activities and reminders are retained. In a builder-generated phase, importing recorded activities replaces its Drill Out planning row and distributes the phase target across the resulting activities. Empty or invalid loaders retain the planning row. Other phases retain their existing targets; new imported activity targets are blank until reviewed or allocated through **Apply setup**.

Manual Drill Out rows and later phases follow the new finish: their entered end dates shift while their activity durations stay the same. Reimporting a later save from the same loader well updates its previously imported Excel rows; source row numbers identify those rows. Undo restores the import and all shifted dates.

The workbook is read locally and formulas/macros do not run. Save the completed, recalculated loader in Excel first so its formula results are available. **Save** in the planner retains both the importer and imported data in the portable HTML. Excel support uses embedded JSZip 3.10.1 under the MIT license; no network dependency is required.

## Targets

Targets are tracked by phase, well, and job. Each well uses its own formation and lateral length. Pre Ops and Post Ops initially use 8 hours each; builder selections determine each generated well's Pre Ops budget. TIH and TOH use the formation/length tables plus any selected split-string addition. Drill Out uses lateral feet per 24 hours (`lateral feet / target feet per day × 24`). Set Production uses 24 hours.

Both apps use the supplied **Midland Current Targets** image:

| Formation | TIH hours | Drill Out ft/day: <8,500 | 8,500–<11,500 | 11,500–<13,500 | 13,500–<17,500 | 17,500+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| JM, LSS, MSS, Dean | 7 | 8,500 | 8,500 | 8,000 | 7,500 | 6,000 |
| WCA | 7 | 8,500 | 8,500 | 8,500 | 7,500 | 7,000 |
| WCB | 7 | 8,500 | 8,500 | 8,500 | 7,500 | 7,000 |
| WCC, WCD, Barnett, Woodford | 3 | 12,500 | 12,500 | 10,000 | 7,500 | 5,500 |

TOOH hours for all formations are **9.3, 9.3, 10.8, 11.9, 14** across those same five bands. A length exactly at a band boundary uses the band starting there. Existing aliases retain their mapping: MS → MSS; WFMP A1–A3 → WCA; WFMP B1–B3 → WCB; WFMP D → WCD.

The example planner's row targets use these values. Restoring a browser draft with older tables updates its TIH, Drill Out and TOH targets using saved allocation weights, while retaining its schedule and notes. Save the restored planner to carry the updated targets into its portable HTML copy.

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

The checks execute the embedded application script with a lightweight DOM mock. They cover multiple-well setup and targets, continuous timing, collapse persistence, confirmed reset, new phases, whole-event daily exports and preview selection, row tools, phase layout and column resizing, reminders, Undo, older draft compatibility, Drill Out loader imports (overnight dates, duration fallback, repeat imports, and manual row preservation), and the standalone builder (phase selections, exact duration additions, planning-row replacement and generated application behavior). They do not replace a visual check in Chrome.

`outputs/` contains historical local development artifacts and is intentionally excluded from Git.
