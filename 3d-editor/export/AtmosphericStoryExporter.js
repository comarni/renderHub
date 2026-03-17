/* ═══════════════════════════════════════════════════════════════
   AtmosphericStoryExporter — Generate interactive atmospheric story pages
   Similar to atmos.leeroy.ca with floating content planes
   ═══════════════════════════════════════════════════════════════ */

import { EventBus } from '../core/EventBus.js';

export class AtmosphericStoryExporter {
  constructor(scene, objectManager, materialManager) {
    this.scene = scene;
    this.objs = objectManager;
    this.mats = materialManager;
  }

  /**
   * Export scene as interactive atmospheric story page
   * @param {string} projectName - Name of the project
   * @param {number} numScenes - Number of scenes to generate (1-10)
   * @returns {{ success: boolean, message: string, html?: string }}
   */
  export(projectName = 'atmospheric-story', numScenes = 5) {
    try {
      if (numScenes < 1 || numScenes > 10) numScenes = 5;
      
      const sceneData = [];
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#ABEBC6'
      ];

      for (let i = 1; i <= numScenes; i++) {
        sceneData.push({
          id: i,
          title: `Scene ${i}`,
          content: `Content for scene ${i}`,
          position: { x: (i - 1) * 15, y: 0, z: -30 },
          color: colors[(i - 1) % colors.length]
        });
      }

      const html = this._generateHTML(projectName, sceneData);
      const filename = `${projectName}.html`;

      EventBus.emit('preview:open', {
        title: projectName,
        filename,
        html,
      });

      // Download HTML
      this._downloadFile(html, filename, 'text/html');
      
      return {
        success: true,
        message: `✓ Exported atmospheric story: ${projectName} (${numScenes} scenes)`
      };
    } catch (e) {
      return { success: false, message: `Export failed: ${e.message}` };
    }
  }

  /**
   * Generate complete atmospheric HTML document
   */
  _generateHTML(projectName, sceneData) {
    const sceneJson = JSON.stringify(sceneData);
    
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #0a0e27; overflow: hidden; }
        canvas { display: block; width: 100vw; height: 100vh; }
        #info { position: absolute; top: 20px; left: 20px; color: #fff; z-index: 100; font-size: 18px; font-weight: bold; }
        #progress { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); 
                   width: 300px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden; }
        #progressBar { height: 100%; background: linear-gradient(90deg, #00d4ff, #ff00ff); width: 0%; transition: width 0.3s; }
    </style>
</head>
<body>
    <div id="info">${projectName}</div>
    <div id="progress"><div id="progressBar"></div></div>
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
    <script>
        const SCENES = ${sceneJson};
        
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0e27);
        scene.fog = new THREE.Fog(0x0a0e27, 100, 500);
        
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(0, 5, 30);
        camera.lookAt(0, 0, 0);
        
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        document.body.appendChild(renderer.domElement);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambientLight);
        
        const keyLight = new THREE.DirectionalLight(0x00d4ff, 1);
        keyLight.position.set(10, 10, 20);
        keyLight.castShadow = true;
        scene.add(keyLight);
        
        const fillLight = new THREE.DirectionalLight(0xff00ff, 0.5);
        fillLight.position.set(-10, 5, 10);
        scene.add(fillLight);
        
        const planes = [];
        SCENES.forEach(function(sceneData, idx) {
            const geometry = new THREE.PlaneGeometry(10, 8);
            const material = new THREE.MeshStandardMaterial({
                color: sceneData.color,
                roughness: 0.5,
                metalness: 0.2,
                emissive: sceneData.color,
                emissiveIntensity: 0.15
            });
            
            const plane = new THREE.Mesh(geometry, material);
            plane.position.x = sceneData.position.x;
            plane.position.y = sceneData.position.y;
            plane.position.z = sceneData.position.z;
            scene.add(plane);
            planes.push({mesh: plane, pos: sceneData.position});
        });
        
        let targetCameraPos = camera.position.clone();
        let currentScene = 0;
        
        function goToScene(index) {
            if (index < 0 || index >= SCENES.length) return;
            currentScene = index;
            const sceneData = SCENES[index];
            targetCameraPos.x = sceneData.position.x;
            targetCameraPos.y = sceneData.position.y + 3;
            targetCameraPos.z = sceneData.position.z + 25;
        }
        
        window.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowRight' || e.key === ' ') goToScene(currentScene + 1);
            if (e.key === 'ArrowLeft') goToScene(currentScene - 1);
        });
        
        window.addEventListener('wheel', function(e) {
            e.preventDefault();
            if (e.deltaY > 0) goToScene(currentScene + 1);
            if (e.deltaY < 0) goToScene(currentScene - 1);
        }, { passive: false });
        
        window.addEventListener('resize', function() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        function animate() {
            requestAnimationFrame(animate);
            
            camera.position.x += (targetCameraPos.x - camera.position.x) * 0.08;
            camera.position.y += (targetCameraPos.y - camera.position.y) * 0.08;
            camera.position.z += (targetCameraPos.z - camera.position.z) * 0.08;
            camera.lookAt(targetCameraPos.x, targetCameraPos.y - 2, 0);
            
            planes.forEach(function(p, i) {
                p.mesh.rotation.z += 0.001;
                p.mesh.position.y = p.pos.y + Math.sin(Date.now() * 0.0005 + i) * 0.5;
            });
            
            const progress = ((currentScene + 1) / SCENES.length) * 100;
            document.getElementById('progressBar').style.width = progress + '%';
            
            renderer.render(scene, camera);
        }
        
        goToScene(0);
        animate();
    <\/script>
</body>
</html>`;
  }

  /**
   * Trigger browser download of a file
   */
  _downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
