# Name Premium CSV Storage

Put premium naming CSV files in this folder.

Suggested examples:
- `name-hanja-db.csv`
- `name-change-candidates.csv`
- `surname-db.csv`
- `court-approved-hanja.csv`

Current purpose:
- keep uploaded CSV files inside the app source tree
- make it easy to wire premium naming pages to structured data later
- separate paid naming data from free fun tools
- preserve both raw source text and normalized CSV when imports are messy

When the CSV arrives, keep the original filename if possible unless a loader requires normalization.
