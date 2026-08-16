# ADR: Valuation field catalog (sourceKind / correction)

**Status:** Accepted for Phase 1 prep  
**Date:** 2026-08-16  
**Context:** `docs/ejadah-cursor-package-v1/seed-fields-v3.js`

## Decision

- Keep the live **Field Dictionary** (ops screens: input/view modes) unchanged for case-study / Infath.
- Add a parallel **valuation seed contract** under `packages/app-shared/src/valuation/` with `sourceKind` + `correction` from the PM package.
- Phase 1 ships **deed kind**, **deed↔nature match**, **client registry**, **building inventory**, **attachment print dictionary**, and **valuer roster** (org settings JSON + dual credential gate) into domain/API/UI (not via Field Dictionary CRUD).
- Later phases load the full 118+ seed into a valuation-specific catalog or extend Field Dictionary with optional `sourceKind`/`correction` columns (follow-up ADR).

## Consequences

- No big-bang rewrite of Field Dictionary.
- Package `seed-fields-v3.js` remains the full inventory reference until a sync tool is built.
