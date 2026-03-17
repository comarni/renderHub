# RenderHub

Static deployment for the RenderHub 3D Editor.

Public URL:
- https://comarni.github.io/renderHub/

## HTML/Three.js Export Workflow

Starter target for generated websites:
- `web-ready/`

One-command export (creates ZIP in `exports/`):

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\export-project.ps1 -SourcePath web-ready -OutName portfolio-cubo
```

## One Click In VS Code

1. Open Command Palette and run: Tasks: Run Task
2. Choose: One Click: Export Portfolio Web
3. The zip is generated in `exports/`
