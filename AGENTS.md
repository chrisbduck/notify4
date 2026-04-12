# Codex Repo Notes

## Environment-specific guidance

- `rg` may not be runnable in this workspace on Windows/Codex Desktop. In this repo it failed with an "Access is denied" launch error from the packaged `rg.exe`, so prefer PowerShell-native search commands first:
  - File search: `Get-ChildItem -Recurse -File`
  - Text search: `Get-ChildItem ... | Select-String -Pattern ...`
- When searching, avoid scanning `node_modules` or `frontend/dist` unless you explicitly need generated output.
- Approved build command already works from the repo root: `npm run build`
- For quick backend verification, `python -m py_compile api\\index.py` works in this environment.

## Coding style preferences

- Prefer keeping code on one line when it is still readable. Do not automatically split every parameter, prop, argument, or object field onto its own line.
- Optimize for keeping more code visible on screen rather than minimizing future merge conflicts from a single changed parameter.
- There is no strict maximum line length in this repo. Long lines are acceptable when they improve readability and avoid unnecessary vertical expansion.
- Treat roughly `150+` characters as acceptable when that keeps related code together. Word wrap is preferred over aggressive reformatting.
- Only expand calls, JSX props, or object literals across multiple lines when it materially improves readability.

## Project-specific notes

- Frontend source of truth is under `frontend/src`.
- Backend API entrypoint is `api/index.py`.
- The Admin / Testing panel lives in `frontend/src/App.tsx`.
