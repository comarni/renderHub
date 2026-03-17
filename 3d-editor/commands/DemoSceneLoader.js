/* ═══════════════════════════════════════════════════════════════
   Demo Scene Loader — Load predefined demo objects into editor
   ═══════════════════════════════════════════════════════════════
   
   USAGE: Call loadDemoScene(objectManager, materialManager) in app.js
   or execute in browser console after RenderHub loads:
   
   > loadDemoScene(window.__objectManager, window.__materialManager)
*/

export function loadDemoScene(objectManager, materialManager) {
  if (!objectManager || !materialManager) {
    console.error('[Demo] ObjectManager or MaterialManager not available');
    return false;
  }

  console.log('[Demo] Loading demo scene...');

  // Demo object definitions
  const objects = [
    {
      type: 'box',
      name: 'Gold Cube',
      position: { x: -2, y: 0.5, z: 0 },
      rotation: { x: 0, y: 0.5, z: 0.3 },
      scale: { x: 1, y: 1, z: 1 },
      material: { color: '#ffc060', preset: 'gold' }
    },
    {
      type: 'sphere',
      name: 'Glass Sphere',
      position: { x: 0, y: 0.75, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1.2, y: 1.2, z: 1.2 },
      material: { color: '#88ccee', preset: 'glass' }
    },
    {
      type: 'plane',
      name: 'Floor',
      position: { x: 0, y: -0.5, z: 0 },
      rotation: { x: -Math.PI / 2, y: 0, z: 0 },
      scale: { x: 5, y: 5, z: 1 },
      material: { color: '#606060', preset: 'matte' }
    },
    {
      type: 'cylinder',
      name: 'Chrome Cylinder',
      position: { x: 2, y: 0.5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      material: { color: '#c8d0d8', preset: 'chrome' }
    },
    {
      type: 'box',
      name: 'Wood Cube',
      position: { x: -1.5, y: 0.5, z: 2 },
      rotation: { x: 0.2, y: 0.7, z: -0.3 },
      scale: { x: 0.9, y: 1.2, z: 0.8 },
      material: { color: '#8b5e3c', preset: 'wood' }
    },
    {
      type: 'sphere',
      name: 'Rubber Sphere',
      position: { x: 1.5, y: 0.75, z: 2 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 0.8, y: 0.8, z: 0.8 },
      material: { color: '#2a2a2a', preset: 'rubber' }
    }
  ];

  // Create objects
  let count = 0;
  objects.forEach(objDef => {
    try {
      const record = objectManager.add(objDef.type, objDef.name);
      
      if (record && record.mesh) {
        // Apply transforms
        record.mesh.position.set(objDef.position.x, objDef.position.y, objDef.position.z);
        record.mesh.rotation.set(objDef.rotation.x, objDef.rotation.y, objDef.rotation.z);
        record.mesh.scale.set(objDef.scale.x, objDef.scale.y, objDef.scale.z);

        // Apply material
        if (objDef.material.preset) {
          const mat = materialManager.createMaterial(objDef.material.color, objDef.material.preset);
          record.mesh.material = mat;
        }

        count++;
        console.log(`[Demo] ✓ Created: ${objDef.name}`);
      }
    } catch (err) {
      console.error(`[Demo] ✗ Failed to create ${objDef.name}:`, err);
    }
  });

  console.log(`[Demo] Loaded ${count}/${objects.length} objects successfully`);
  return count > 0;
}

/**
 * Auto-load demo scene on page load
 * Add this to app.js init() if you want it to load automatically
 */
export function autoLoadDemoScene(objectManager, materialManager, delayMs = 500) {
  setTimeout(() => {
    loadDemoScene(objectManager, materialManager);
  }, delayMs);
}
