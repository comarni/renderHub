# ═══════════════════════════════════════════════════════════════════════════
# ATMOSPHERIC STORY VIEWER - Super Simple One-Liner
# ═══════════════════════════════════════════════════════════════════════════
# 
# COPIA Y PEGA DIRECTAMENTE EN PowerShell:
# 
# ┌─ OPCIÓN 1: Automática (Rápido) ────────────────────────────────────────┐
# │                                                                         │
# │ powershell -Command "& {                                              │
# │   $n = Read-Host 'Nombre'; $s = Read-Host 'Escenas (1-10)';           │
# │   $html = '<!DOCTYPE html> ...'; Set-Content -Path \"$n\index.html\"  │
# │   Start-Process \"$n\index.html\"                                    │
# │ }"                                                                      │
# │                                                                         │
# └─────────────────────────────────────────────────────────────────────────┘
#
# ┌─ OPCIÓN 2: Desde PowerShell directo ───────────────────────────────────┐
# │                                                                         │
# │ $name = 'mi-historia'                                                  │
# │ $scenes = 5                                                             │
# │ .\create-story-viewer.ps1 -projectName $name -scenes $scenes -open     │
# │                                                                         │
# └─────────────────────────────────────────────────────────────────────────┘
# 
# ═══════════════════════════════════════════════════════════════════════════

# Para máxima simplicidad, aquí está todo en una función que puedes copiar:

function New-AtmosphericStory {
    param(
        [string]$Name = (Read-Host "Nombre del proyecto"),
        [int]$Scenes = 5
    )

    $path = New-Item -ItemType Directory "$Name" -Force | % FullName
    
    # HTML Template
    $html = @"
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>ATMOS - $Name</title><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;font-family:'Segoe UI',Arial,sans-serif;background:#0a0e27;color:#e0e0e0;overflow:hidden}#canvas{width:100%;height:100%;display:block}#ui{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100}.header{position:absolute;top:30px;left:50%;transform:translateX(-50%);text-align:center;pointer-events:auto}h1{font-size:48px;font-weight:300;letter-spacing:4px;text-transform:uppercase;color:#00d4ff;text-shadow:0 0 20px rgba(0,212,255,0.5)}p{font-size:14px;color:#999}.scroll{position:absolute;bottom:40px;left:50%;transform:translateX(-50%);text-align:center;pointer-events:auto}.scroll p{color:#00d4ff;margin-bottom:8px}.arrow{width:20px;height:30px;border:2px solid #00d4ff;border-radius:10px;margin:0 auto}.h2{position:absolute;top:30px;right:30px;background:rgba(10,14,39,0.9);border:1px solid rgba(0,212,255,0.3);padding:20px;border-radius:8px;backdrop-filter:blur(10px);font-size:12px;color:#999;pointer-events:auto;min-width:200px}h3{color:#00d4ff;margin-bottom:10px;font-size:14px}.line{margin:8px 0;display:flex;justify-content:space-between}.bar{width:100%;height:3px;background:rgba(0,212,255,0.2);margin-top:15px;border-radius:2px}.fill{height:100%;background:#00d4ff;width:0%;transition:width 0.3s}.load{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:#00d4ff;z-index:1000}.spin{width:50px;height:50px;border:2px solid rgba(0,212,255,0.3);border-top:2px solid #00d4ff;border-radius:50%;animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}</style></head><body><canvas id="canvas"></canvas><div id="ui"><div class="header"><h1>ATMOS</h1><p>$Name</p></div><div class="scroll"><p>Scroll to begin</p><div class="arrow"></div></div><div class="h2"><h3>Navigation</h3><div class="line"><span>Scene:</span><span id="scene">1/$Scenes</span></div><div class="line"><span>Progress:</span><span id="prog">0%</span></div><div class="bar"><div class="fill" id="fill"></div></div></div><div class="load" id="load"><div class="spin"></div><p>Loading...</p></div></div><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@r128/build/three.module.js"}}</script><script type="module">import*as THREE from 'three';const scenes=$Scenes;const canvas=document.getElementById('canvas');const scene=new THREE.Scene();scene.background=new THREE.Color(0x0a0e27);const camera=new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,0.1,1000);camera.position.z=20;const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(window.devicePixelRatio);renderer.setSize(window.innerWidth,window.innerHeight);renderer.shadowMap.enabled=true;const amb=new THREE.AmbientLight(0x4488ff,0.4);scene.add(amb);const dir=new THREE.DirectionalLight(0x00d4ff,1.2);dir.position.set(10,10,10);dir.castShadow=true;scene.add(dir);const rim=new THREE.DirectionalLight(0xff00ff,0.3);rim.position.set(-10,-5,-10);scene.add(rim);const planes=[];for(let i=0;i<scenes;i++){const cvs=document.createElement('canvas');cvs.width=1024;cvs.height=768;const ctx=cvs.getContext('2d');const grad=ctx.createLinearGradient(0,0,0,cvs.height);grad.addColorStop(0,'#1a1f3a');grad.addColorStop(1,'#0a0e27');ctx.fillStyle=grad;ctx.fillRect(0,0,cvs.width,cvs.height);ctx.strokeStyle='#00d4ff';ctx.lineWidth=2;ctx.globalAlpha=0.5;ctx.strokeRect(20,20,cvs.width-40,cvs.height-40);ctx.globalAlpha=1;ctx.fillStyle='#00d4ff';ctx.font='Bold 48px Arial';ctx.textAlign='center';ctx.fillText(\`Scene \${i+1}\`,cvs.width/2,120);ctx.fillStyle='#b0b0b0';ctx.font='18px Arial';ctx.fillText('Tu contenido narrativo aquí',cvs.width/2,250);const tex=new THREE.CanvasTexture(cvs);const mat=new THREE.MeshStandardMaterial({map:tex,roughness:0.3,metalness:0.1,emissive:0x00d4ff,emissiveIntensity:0.1});const geo=new THREE.PlaneGeometry(8,5);const mesh=new THREE.Mesh(geo,mat);mesh.position.z=-i*15;mesh.position.y=(i%2===0?3:-3);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);planes.push(mesh)}let curr=0,trans=false;function nav(idx){if(trans||idx<0||idx>=scenes)return;trans=true;const tZ=planes[idx].position.z;const sZ=camera.position.z;const start=Date.now();const dur=2000;function ease(t){return t<0.5?4*t*t*t:(t-1)*(2*t-2)*(2*t-2)+1}function anim(){const elap=Date.now()-start;const prog=Math.min(elap/dur,1);const e=ease(prog);camera.position.z=sZ+(tZ-sZ)*e;if(prog<1)requestAnimationFrame(anim);else{trans=false;curr=idx;upd()}}}let st;window.addEventListener('wheel',(e)=>{e.preventDefault();clearTimeout(st);e.deltaY>0?nav(curr+1):nav(curr-1);st=setTimeout(()=>{},1000)},{passive:false});document.addEventListener('keydown',(e)=>{e.key==='ArrowDown'?nav(curr+1):e.key==='ArrowUp'?nav(curr-1):null});function upd(){const n=curr+1;const p=Math.round((curr/(scenes-1))*100);document.getElementById('scene').textContent=\`\${n}/\${scenes}\`;document.getElementById('prog').textContent=\`\${p}%\`;document.getElementById('fill').style.width=\`\${p}%\`}function anim2(){requestAnimationFrame(anim2);planes.forEach((p,i)=>{p.rotation.y+=0.0005;p.rotation.x+=0.0002;const t=Date.now()*0.001;p.position.y+=(i%2===0?3:-3)+Math.sin(t+i)*0.5});renderer.render(scene,camera)}window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight)});setTimeout(()=>{document.getElementById('load').style.display='none';upd();anim2()},500);</script></body></html>
"@

    Set-Content -Path "$path\index.html" -Value $html -Encoding UTF8
    
    Write-Host "✨ Proyecto creado: $path" -ForegroundColor Green
    Write-Host "🌐 Abriendo en navegador..." -ForegroundColor Cyan
    
    Start-Process "$path\index.html"
}

# Usa así:
# New-AtmosphericStory -Name "mi-historia" -Scenes 5
