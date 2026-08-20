# Database Usage Prompt

Use the files in the `database/` folder as the structured knowledge base for the CCP AI system.

Required database files:

- `database/CCP_SCA_F153_VLO_DDVLO_DATABASE.json`
- `database/CCP_REPORT_TEMPLATE_MAPPING.md`
- `database/EXAMPLE_SAVED_INSPECTION_RECORDS.json`

Rules:

1. Use `CCP_SCA_F153_VLO_DDVLO_DATABASE.json` for:
   - inspection zone names
   - zone descriptions
   - zone-to-report-area mapping
   - powertrain/system/routing type options
   - protector classification options
   - photo export behavior
   - saved inspection schema

2. Use `CCP_REPORT_TEMPLATE_MAPPING.md` for:
   - Excel report columns
   - source-field mapping
   - blank fields
   - photo-in-cell requirements

3. Use `EXAMPLE_SAVED_INSPECTION_RECORDS.json` for:
   - testing session records
   - testing report export
   - verifying saved inspection schema

4. Do not invent official CCP grades from the database alone.

5. The deterministic rule engine must calculate the grade.

6. If official CCP document/manual data conflicts with this database, use the latest official document/manual.
