# CCP Routing Evaluator

A standalone decision-support prototype for rapid VLO/DDVLO evaluation of:

- Contact
- Proximity below 3 mm
- Heat-source clearance
- Built-in offline CCP Assistant for rule explanations and suggestions

The grading logic is encoded from `SCA_F153_VLO_DDVLO_O10`, pages 14-15. Definitions, inspection zones and countermeasure wording are supported by `CS.CCP-ROUTINGS (HARMONIZED)`.

## Start the system

Double-click `index.html`. No installation, internet connection, login or server is required.

For the best browser behaviour, you may also serve the folder locally:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Workflow

1. Enter the vehicle/project, inspection zone and observation.
   - The official zone diagram changes automatically when a zone is selected.
   - Select the diagram to open a larger reference image.
2. Select Contact, Proximity or Heat Source.
3. Answer the guided fields.
   - Select **Powertrain / Function**, **System** and **Routing type** for the final report.
   - Routing type choices depend on the selected system, and **Other / new routing type** allows a custom routing type.
4. Select **Evaluate CCP**.
5. Review the initial grade, applied special rules, final grade and actions.
6. Save the inspection, print the report or export the current session as an Excel-style report.

## Saved inspection records

The system supports two record-storage modes:

- **Shared backend storage** when opened through `http://localhost:8080` or an Azure/App Service link. Saved inspections are stored in `data/records.json` on the server, so users opening the same deployed system can see the same saved inspections.
- **Browser-only storage** when opened directly as `file://.../index.html`. This mode uses the browser's local storage, so records are visible only on that same computer/browser.

Evidence photos are compressed in the browser and stored with the inspection record. In shared-backend mode, the compressed image data is saved in `data/records.json`; in browser-only mode, it is saved in that browser's local storage. The stored images are used in the Excel report export.

## Session and report export

Use **New session** when starting a new inspection session. The first saved concern in that session is numbered **No. 1**, then the next saved concern becomes **No. 2**, and so on. Starting a new session resets the concern number back to **No. 1** without deleting old saved inspections. The saved-inspections table and the session summary show the current session only, for example **Session 3 | Saved inspections in this session: 34**.

When the system is opened through `http://localhost:8080` or Azure, the **Export Excel report** button fills the real macro-enabled template at `assets/templates/CCP_REPORT_TEMPLATE.xlsm` and downloads a `.xlsm` file for the current session. This keeps the original template colours, row heights, column widths and workbook structure.

If an evidence photo is selected before saving an inspection, the system stores a compressed copy with that inspection and inserts it into the report **Photos** column.

When the system is opened directly as `file://.../index.html`, the browser cannot rewrite the `.xlsm` template, so export falls back to a simple Excel-readable `.xls` file.

The report uses the CCP report-template columns:

- SL NO
- Index Number / N° fiche
- Perimeter or Project Impacted
- Area Zone
- Powertrain or Function
- System
- Routing type
- Default detail
- Clearance mini acceptable
- Defect Area
- Photos
- Status
- Aligned comment
- LPM Comment

The fields **Clearance mini acceptable**, **Defect Area**, **Status**, **Aligned comment** and **LPM Comment** are intentionally left blank for now.

## Professional AI and offline fallback

The system now has two assistant modes:

1. **Professional AI** - a real language model accessed securely through the included server.
2. **Offline CCP Assistant** - the embedded rule-based fallback when no model connection is available.

Professional AI can answer open-ended questions while using the deterministic CCP result as context. The offline assistant can use the current form and completed assessment to:

- Explain the initial and final grade
- List the rules that changed a grade
- Suggest the next action
- Explain Contact, Proximity and Heat Source conditions
- Describe inspection zones
- Explain aggressive/friendly surfaces, movement and special rules

The deterministic rule engine remains responsible for grade calculation in both modes.

### Run Professional AI locally

Requirements: Node.js 20 or newer and an OpenAI API key approved for the data being processed.

In PowerShell, set the key for the current terminal and start the server:

```powershell
$env:OPENAI_API_KEY="your-key"
$env:OPENAI_MODEL="gpt-5.5"
node server.mjs
```

Then open `http://localhost:8080`. Do not open `index.html` directly when you want Professional AI or shared records; the `file://` version intentionally stays in offline/local mode.

After setting the environment variable, you can alternatively double-click `start-ai-server.cmd`.

Once the server is running, open `CCP Routing System.url` from the `outputs` folder or browse to `http://localhost:8080`.

The API key is read only by the server from the environment. Never put it in `app.js`, `index.html`, a public repository or a screenshot.

### Deploy for multiple workers

Deploy this folder as a Node.js web service and configure `OPENAI_API_KEY` as a protected server secret. Add company authentication before production use. Workers then open the single HTTPS web address; they never receive the API key.

For a complete Azure walkthrough, see `../Azure_Deployment_Guide.md` in the outputs folder.

### Confidentiality warning

The supplied manuals and zone images are marked for internal use. Obtain company approval before sending CCP questions, assessment context or vehicle information to any externally hosted AI service. This implementation does not send photos, vehicle/project identifiers, inspector names or free-text observations to the model.

## Important boundaries

- This MVP stores compressed evidence photos with inspection records, but it does not send them to the Professional AI service.
- Shared records are stored in `data/records.json` by the included Node.js server. For production use with backups, permissions and many users, replace the JSON file with Azure SQL, PostgreSQL or another approved database.
- The inspector must confirm material, surface, movement, safety classification, measurements and validated-contact status.
- For a condition between two unprotected PCWs, calculate each PCW and enter the second PCW's grade; the engine retains the higher grade.
- Engineering approval and the current controlled document always take precedence.
- Before production use, the encoded tables should receive line-by-line validation from the CCP/Packaging owner.

## Why the final grade uses rules rather than an AI prediction

The official tables are deterministic and safety-related. A trained image model may later suggest material, surface, condition type or clearance, but the controlled rule engine should calculate the final grade. Low-confidence AI suggestions should always return to human confirmation.

## Run rule tests

With Node.js installed:

```powershell
node engine.test.js
```

The included tests cover representative contact, proximity, heat-source and special-rule boundaries.
