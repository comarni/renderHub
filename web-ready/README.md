# Portfolio Cube Starter (Three.js)

Starter static site ready for GitHub Pages.

## What is included

- `index.html`: semantic structure with 6 section-panels + fallback linear content.
- `main.js`: Three.js cube, desktop drag + arrows, mobile swipe, active face HUD, hash sync.
- `style.css`: clean dark UI and readable cards.

## How to run locally

Open `web-ready/index.html` with any static server.

## How to export in one command

From repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\export-project.ps1 -SourcePath web-ready -OutName portfolio-cubo
```

The zip is generated in `exports/`.
