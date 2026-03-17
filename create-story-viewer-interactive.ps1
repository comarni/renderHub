#!/usr/bin/env powershell
# ═══════════════════════════════════════════════════════════════════════════
# ATMOSPHERIC STORY VIEWER - Editor Interactivo
# ═══════════════════════════════════════════════════════════════════════════
# Uso: .\create-story-viewer-interactive.ps1
# ═══════════════════════════════════════════════════════════════════════════

Clear-Host
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ATMOSPHERIC STORY VIEWER - Generador Interactivo" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Obtener información del proyecto
$title = Read-Host "Nombre del proyecto (ej: 'mi-historia')"
$title = if ([string]::IsNullOrWhiteSpace($title)) { "atmospheric-story" } else { $title }

$numScenesStr = Read-Host "¿Cuántas escenas? [1-10, default: 5]"
$numScenes = if ([string]::IsNullOrWhiteSpace($numScenesStr)) { 5 } else { [int]$numScenesStr }
$numScenes = [Math]::Max(1, [Math]::Min(10, $numScenes))

Write-Host ""
Write-Host "Ingresa el contenido para cada escena:" -ForegroundColor Yellow
Write-Host ""

$scenes = @()
for ($i = 1; $i -le $numScenes; $i++) {
    Write-Host "─── ESCENA $i ───" -ForegroundColor Cyan
    $sceneTitle = Read-Host "Título"
    $sceneTitle = if ([string]::IsNullOrWhiteSpace($sceneTitle)) { "Escena $i" } else { $sceneTitle }
    
    $sceneContent = Read-Host "Descripción (1 línea)"
    $sceneContent = if ([string]::IsNullOrWhiteSpace($sceneContent)) { "Contenido narrativo de la escena $i" } else { $sceneContent }
    
    $scenes += @{
        title = $sceneTitle
        content = $sceneContent
    }
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════════════════════
# Crear estructura de carpeta
# ═══════════════════════════════════════════════════════════════════════════

$projectPath = Join-Path $PWD $title
if (Test-Path $projectPath) {
    $projectPath = Join-Path $PWD "$title-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}
New-Item -ItemType Directory -Path $projectPath -Force | Out-Null

# ═══════════════════════════════════════════════════════════════════════════
# Generar JSON de escenas
# ═══════════════════════════════════════════════════════════════════════════

$scenesJson = @()
$scenesHtml = @()

for ($i = 0; $i -lt $scenes.Count; $i++) {
    $zPos = -$i * 15
    $yPos = $i % 2 -eq 0 ? 3 : -3
    
    $scenesJson += @{
        id = "scene-$($i+1)"
        title = $scenes[$i].title
        content = $scenes[$i].content
        position = @{ x = 0; y = $yPos; z = $zPos }
        rotation = @{ x = 0; y = 0; z = 0 }
        scale = @{ x = 8; y = 5; z = 1 }
    }
    
    $contentDiv = @"
        <div class="scene-content scene-$($i+1)">
            <div class="content-wrapper">
                <h2>$($scenes[$i].title)</h2>
                <p>$($scenes[$i].content)</p>
                <p class="scroll-hint">↓ Desplázate para continuar ↓</p>
            </div>
        </div>
"@
    $scenesHtml += $contentDiv
}

$scenesJsonStr = ($scenesJson | ConvertTo-Json -Depth 10).Replace('"', '\"')
$scenesContentStr = $scenesHtml -join "`n"

# ═══════════════════════════════════════════════════════════════════════════
# Generar HTML completo
# ═══════════════════════════════════════════════════════════════════════════

$htmlContent = @"
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ATMOS - $title</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html, body {
            width: 100%;
            height: 100%;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0e27;
            color: #e0e0e0;
            overflow: hidden;
        }

        #canvas {
            display: block;
            width: 100%;
            height: 100%;
        }

        /* OVERLAY UI */
        #ui-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 100;
        }

        .header {
            position: absolute;
            top: 30px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            pointer-events: auto;
            animation: fadeIn 1.5s ease-in;
        }

        .header h1 {
            font-size: 48px;
            font-weight: 300;
            letter-spacing: 4px;
            text-transform: uppercase;
            color: #00d4ff;
            text-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
        }

        .header p {
            font-size: 14px;
            color: #999;
            margin-top: 8px;
            letter-spacing: 2px;
        }

        .scroll-indicator {
            position: absolute;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            pointer-events: auto;
        }

        .scroll-indicator p {
            font-size: 12px;
            color: #00d4ff;
            letter-spacing: 1px;
            margin-bottom: 8px;
            animation: pulse 2s infinite;
        }

        .scroll-arrow {
            width: 20px;
            height: 30px;
            border: 2px solid #00d4ff;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
        }

        .scroll-arrow::before {
            content: '';
            width: 2px;
            height: 8px;
            background: #00d4ff;
            animation: scroll 1.5s infinite;
        }

        @keyframes scroll {
            0% { transform: translateY(-6px); opacity: 1; }
            100% { transform: translateY(6px); opacity: 0; }
        }

        @keyframes pulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        /* SCENE CONTENT */
        .scene-content {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, transparent, rgba(0, 212, 255, 0.1));
            backdrop-filter: blur(10px);
        }

        .content-wrapper {
            max-width: 90%;
            text-align: center;
            padding: 40px;
        }

        .content-wrapper h2 {
            font-size: 36px;
            font-weight: 300;
            margin-bottom: 20px;
            color: #00d4ff;
            letter-spacing: 2px;
        }

        .content-wrapper p {
            font-size: 16px;
            line-height: 1.6;
            color: #b0b0b0;
            margin-bottom: 15px;
        }

        .scroll-hint {
            margin-top: 30px;
            color: #00d4ff;
            font-size: 14px;
            letter-spacing: 1px;
        }

        /* INFO PANEL */
        .info-panel {
            position: absolute;
            top: 30px;
            right: 30px;
            background: rgba(10, 14, 39, 0.9);
            border: 1px solid rgba(0, 212, 255, 0.3);
            padding: 20px;
            border-radius: 8px;
            backdrop-filter: blur(10px);
            font-size: 12px;
            color: #999;
            pointer-events: auto;
            min-width: 200px;
            animation: fadeIn 1.5s ease-in;
        }

        .info-panel h3 {
            color: #00d4ff;
            margin-bottom: 10px;
            font-size: 14px;
            letter-spacing: 1px;
        }

        .info-line {
            margin: 8px 0;
            display: flex;
            justify-content: space-between;
        }

        .progress-bar {
            width: 100%;
            height: 3px;
            background: rgba(0, 212, 255, 0.2);
            margin-top: 15px;
            border-radius: 2px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: #00d4ff;
            width: 0%;
            transition: width 0.3s ease;
        }

        /* LOADING */
        .loading {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #00d4ff;
            z-index: 1000;
        }

        .loading-spinner {
            width: 50px;
            height: 50px;
            border: 2px solid rgba(0, 212, 255, 0.3);
            border-top: 2px solid #00d4ff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* RESPONSIVE */
        @media (max-width: 768px) {
            .header h1 { font-size: 32px; }
            .info-panel { display: none; }
        }
    </style>
</head>
<body>
    <canvas id="canvas"></canvas>

    <div id="ui-container">
        <div class="header">
            <h1>ATMOS</h1>
            <p>$title</p>
        </div>

        <div class="scroll-indicator">
            <p>Scroll to begin the journey</p>
            <div class="scroll-arrow"></div>
        </div>

        <div class="info-panel">
            <h3>Navigation</h3>
            <div class="info-line">
                <span>Scene:</span>
                <span id="current-scene">1 / $numScenes</span>
            </div>
            <div class="info-line">
                <span>Progress:</span>
                <span id="progress">0%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" id="progress-fill"></div>
            </div>
        </div>

        <div class="loading" id="loading">
            <div class="loading-spinner"></div>
            <p>Loading atmospheric experience...</p>
        </div>
    </div>

    <script type="importmap">
        {
            "imports": {
                "three": "https://cdn.jsdelivr.net/npm/three@r128/build/three.module.js"
            }
        }
    </script>

    <script type="module">
        import * as THREE from 'three';

        const SCENES_DATA = $scenesJsonStr;
        const TOTAL_SCENES = $numScenes;

        // THREE.JS SETUP
        const canvas = document.getElementById('canvas');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0e27);
        scene.fog = new THREE.Fog(0x0a0e27, 100, 400);

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 20;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;

        // LIGHTING
        const ambientLight = new THREE.AmbientLight(0x4488ff, 0.4);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0x00d4ff, 1.2);
        directionalLight.position.set(10, 10, 10);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        const rimLight = new THREE.DirectionalLight(0xff00ff, 0.3);
        rimLight.position.set(-10, -5, -10);
        scene.add(rimLight);

        // CREATE SCENE MESHES
        const planes = [];
        SCENES_DATA.forEach((sceneData, index) => {
            const canvas2d = document.createElement('canvas');
            canvas2d.width = 1024;
            canvas2d.height = 768;
            const ctx = canvas2d.getContext('2d');

            // Background
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas2d.height);
            gradient.addColorStop(0, '#1a1f3a');
            gradient.addColorStop(1, '#0a0e27');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas2d.width, canvas2d.height);

            // Border
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.strokeRect(20, 20, canvas2d.width - 40, canvas2d.height - 40);
            ctx.globalAlpha = 1.0;

            // Title
            ctx.fillStyle = '#00d4ff';
            ctx.font = 'Bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(sceneData.title, canvas2d.width / 2, 120);

            // Content
            ctx.fillStyle = '#b0b0b0';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            const text = sceneData.content;
            const words = text.split(' ');
            let line = '';
            let y = 250;

            words.forEach(word => {
                const testLine = line + word + ' ';
                const testWidth = ctx.measureText(testLine).width;
                if (testWidth > 850) {
                    ctx.fillText(line, canvas2d.width / 2, y);
                    line = word + ' ';
                    y += 50;
                } else {
                    line = testLine;
                }
            });
            ctx.fillText(line, canvas2d.width / 2, y);

            const texture = new THREE.CanvasTexture(canvas2d);
            const material = new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.3,
                metalness: 0.1,
                emissive: 0x00d4ff,
                emissiveIntensity: 0.1
            });

            const geometry = new THREE.PlaneGeometry(8, 5);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(sceneData.position.x, sceneData.position.y, sceneData.position.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            scene.add(mesh);
            planes.push({ mesh, data: sceneData, index });
        });

        // NAVIGATION
        let currentScene = 0, isTransitioning = false;

        function navigateToScene(sceneIndex) {
            if (isTransitioning || sceneIndex < 0 || sceneIndex >= TOTAL_SCENES) return;
            
            isTransitioning = true;
            const targetZ = planes[sceneIndex].mesh.position.z;
            const startZ = camera.position.z;
            const startTime = Date.now();
            const duration = 2000;

            function easeInOutCubic(t) {
                return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
            }

            function animateCamera() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = easeInOutCubic(progress);
                camera.position.z = startZ + (targetZ - startZ) * easeProgress;

                if (progress < 1) {
                    requestAnimationFrame(animateCamera);
                } else {
                    isTransitioning = false;
                    currentScene = sceneIndex;
                    updateUI();
                }
            }
            animateCamera();
        }

        // INPUT HANDLING
        let scrollTimeout;
        window.addEventListener('wheel', (e) => {
            e.preventDefault();
            clearTimeout(scrollTimeout);
            if (e.deltaY > 0) navigateToScene(currentScene + 1);
            else navigateToScene(currentScene - 1);
            scrollTimeout = setTimeout(() => {}, 1000);
        }, { passive: false });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') navigateToScene(currentScene + 1);
            if (e.key === 'ArrowUp') navigateToScene(currentScene - 1);
        });

        // UI
        function updateUI() {
            const sceneNum = currentScene + 1;
            const progress = Math.round((currentScene / (TOTAL_SCENES - 1)) * 100);
            document.getElementById('current-scene').textContent = \`\${sceneNum} / \${TOTAL_SCENES}\`;
            document.getElementById('progress').textContent = \`\${progress}%\`;
            document.getElementById('progress-fill').style.width = \`\${progress}%\`;
        }

        // RENDER
        function animate() {
            requestAnimationFrame(animate);
            planes.forEach((plane, index) => {
                plane.mesh.rotation.y += 0.0005;
                plane.mesh.rotation.x += 0.0002;
                const time = Date.now() * 0.001;
                plane.mesh.position.y += Math.sin(time + index) * 0.0005;
            });
            renderer.render(scene, camera);
        }

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
            updateUI();
            animate();
        }, 500);
    </script>
</body>
</html>
"@

# ═══════════════════════════════════════════════════════════════════════════
# Guardar archivos
# ═══════════════════════════════════════════════════════════════════════════

$indexPath = Join-Path $projectPath "index.html"
Set-Content -Path $indexPath -Value $htmlContent -Encoding UTF8

# Crear archivo de datos
$dataPath = Join-Path $projectPath "data.json"
$scenesData = @{ title = $title; scenes = $scenesJson }
$scenesData | ConvertTo-Json -Depth 10 | Set-Content -Path $dataPath -Encoding UTF8

# ═══════════════════════════════════════════════════════════════════════════
# Salida
# ═══════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  ✨ PROYECTO CREADO EXITOSAMENTE ✨                  ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "📁 Ubicación: " -ForegroundColor Yellow -NoNewline
Write-Host $projectPath -ForegroundColor Green

Write-Host ""
Write-Host "📊 Proyecto: " -ForegroundColor Yellow
Write-Host "   Título: $title"
Write-Host "   Escenas: $numScenes"
Write-Host ""

Write-Host "🎮 Para ver tu proyecto:" -ForegroundColor Yellow
Write-Host "   1. Navega a: " -NoNewline
Write-Host "cd '$title'" -ForegroundColor Cyan
Write-Host "   2. Abre: " -NoNewline
Write-Host "index.html" -ForegroundColor Cyan
Write-Host ""

Write-Host "✏️  Para editar:" -ForegroundColor Yellow
Write-Host "   Abre index.html con un editor y personaliza los estilos" -ForegroundColor Gray
Write-Host ""

$openNow = Read-Host "¿Abrir en navegador ahora? (s/n)"
if ($openNow -eq 's' -or $openNow -eq 'S') {
    Start-Process $indexPath
}
