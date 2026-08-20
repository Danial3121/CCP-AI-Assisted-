# CCP AI System Database Files

This folder contains the reusable database/knowledge files for the FYP 1_CCP AI SYSTEM.

Use these files together with:

```text
FULL_PROMPT_TO_CREATE_THIS_SYSTEM.md
```

## Files

### `CCP_SCA_F153_VLO_DDVLO_DATABASE.json`

Main structured database for the CCP AI system. It contains:

- SCA_F153_VLO_DDVLO inspection zones
- zone picture mapping
- powertrain/system/routing type mapping
- evaluation path fields
- protector classification database
- report-template column mapping
- saved inspection schema
- photo export behavior

### `CCP_REPORT_TEMPLATE_MAPPING.md`

Human-readable explanation of how the saved inspection data maps into the Excel report template.

### `EXAMPLE_SAVED_INSPECTION_RECORDS.json`

Example saved inspection data. Use this when testing:

- session numbering
- saved inspection storage
- Excel report export
- photo column behavior

### `DATABASE_USAGE_PROMPT.md`

Short prompt section that can be copied into a main prompt to tell AI how to use this database folder.

## Important

The database supports the system, but the latest controlled CCP document/manual must always take priority if there is any conflict.

The AI assistant must not invent official grades. The deterministic rule engine is the authority for calculated grade output.
