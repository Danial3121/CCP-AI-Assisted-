# CCP Report Template Mapping

This file explains how system data must be exported into the CCP Excel report template.

Template file:

```text
assets/templates/CCP_REPORT_TEMPLATE.xlsm
```

The exporter must use the sheet whose name starts with:

```text
SESSION
```

The exported sheet should be renamed to the current session label:

```text
SESSION 1
SESSION 2
SESSION 3
```

## Export rules

- Export current session only.
- Start writing data from row 2.
- Keep the original template style.
- Keep header colors.
- Keep column widths.
- Keep row heights.
- Keep workbook as `.xlsm`.
- Use `openpyxl.load_workbook(..., keep_vba=True)`.

## Column mapping

| Excel Column | Header | Source from system |
|---|---|---|
| A | SL NO | `concernNo` |
| B | Index Number / N° fiche | `Z` + selected zone, e.g. `Z14` |
| C | Perimeter or Project Impacted | `vehicle` |
| D | Area / Zone | zone area, e.g. `Underhood`, `Underbody` |
| E | Powertrain or Function | `powertrain` |
| F | System | `system` |
| G | Routing type | `routingType` |
| H | Default detail | blank |
| I | Clearance mini acceptable + put the source of the value in DT | blank |
| J | Defect Area | blank |
| K | Photos | embedded evidence photos |
| L | Status | blank |
| M | Aligned comment with SCA,DVX & VEHE | blank |
| N | LPM Comment | blank |

## Photo behavior

Photos must be embedded inside column K.

Do not link to external image files.

Maximum photos per inspection:

```text
4
```

Layout:

- 1 photo: centered inside Photos cell
- 2 photos: side by side
- 3 or 4 photos: 2x2 grid

Photos must be resized to stay inside the report cell so the user does not need to adjust manually.

## Important blank fields

These fields should be blank first:

- Default detail
- Clearance mini acceptable
- Defect Area
- Status
- Aligned comment
- LPM Comment

These can be filled manually later if needed.
