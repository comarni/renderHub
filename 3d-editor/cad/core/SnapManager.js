import * as THREE from 'three';

/**
 * SnapManager
 * Tool-agnostic snapping engine with spatial hash cache.
 */
export class SnapManager {
  constructor({ scene, cameraManager, objectManager, selectionManager }) {
    this.scene = scene;
    this.cameraManager = cameraManager;
    this.objectManager = objectManager;
    this.selectionManager = selectionManager;

    this.settings = {
      enabled: true,
      vertex: true,
      edge: true,
      grid: true,
      tolerance: 0.35,
      gridSize: 0.25,
    };

    this._vertexGrid = new Map();
    this._edgeGrid = new Map();
    this._meshCache = new Map();
    this._dirty = true;

    this._pointMarker = this._createPointMarker();
    this._edgeMarker = this._createEdgeMarker();
    this.scene.add(this._pointMarker);
    this.scene.add(this._edgeMarker);
  }

  updateSettings(partial = {}) {
    this.settings = { ...this.settings, ...partial };
    if (Number.isFinite(this.settings.tolerance)) this.settings.tolerance = Math.max(0.01, this.settings.tolerance);
    if (Number.isFinite(this.settings.gridSize)) this.settings.gridSize = Math.max(0.01, this.settings.gridSize);
    this._dirty = true;
  }

  getSettings() {
    return { ...this.settings };
  }

  invalidateAll() {
    this._dirty = true;
  }

  clearFeedback() {
    this._pointMarker.visible = false;
    this._edgeMarker.visible = false;
  }

  /**
   * @param {THREE.Vector3} inputPosition
   * @param {{
   *   camera: THREE.Camera,
   *   ray?: THREE.Ray,
   *   sceneObjects?: Array,
   *   activeSnapSettings?: any,
   *   tolerance?: number,
   * }} context
   */
  getSnap(inputPosition, context = {}) {
    if (!inputPosition || !this.settings.enabled) {
      this.clearFeedback();
      return null;
    }

    if (context.activeSnapSettings) {
      this.updateSettings(context.activeSnapSettings);
    }

    this._ensureIndex();

    const tolerance = Number.isFinite(context.tolerance) ? context.tolerance : this.settings.tolerance;
    const candidates = [];

    if (this.settings.vertex) {
      const bestVertex = this._closestVertex(inputPosition, tolerance);
      if (bestVertex) {
        candidates.push({
          position: bestVertex.position,
          type: 'vertex',
          targetId: bestVertex.targetId,
          distance: bestVertex.distance,
          edge: null,
        });
      }
    }

    if (this.settings.edge) {
      const bestEdge = this._closestEdgePoint(inputPosition, tolerance);
      if (bestEdge) {
        candidates.push({
          position: bestEdge.position,
          type: 'edge',
          targetId: bestEdge.targetId,
          distance: bestEdge.distance,
          edge: bestEdge.edge,
        });
      }
    }

    if (this.settings.grid) {
      const g = this.settings.gridSize;
      const gridPos = new THREE.Vector3(
        Math.round(inputPosition.x / g) * g,
        Math.round(inputPosition.y / g) * g,
        Math.round(inputPosition.z / g) * g
      );
      const gridDist = gridPos.distanceTo(inputPosition);
      if (gridDist <= tolerance) {
        candidates.push({
          position: gridPos,
          type: 'grid',
          distance: gridDist,
          targetId: null,
          edge: null,
        });
      }
    }

    if (!candidates.length) {
      this.clearFeedback();
      return null;
    }

    candidates.sort((a, b) => a.distance - b.distance);
    const winner = candidates[0];
    this._showFeedback(winner.type, winner.position, winner.edge);

    return {
      position: winner.position.clone(),
      type: winner.type,
      targetId: winner.targetId,
    };
  }

  _createPointMarker() {
    const geo = new THREE.SphereGeometry(0.04, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x5eead4, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.renderOrder = 10000;
    return mesh;
  }

  _createEdgeMarker() {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const mat = new THREE.LineBasicMaterial({ color: 0xfbbf24, depthTest: false, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    line.renderOrder = 9999;
    return line;
  }

  _showFeedback(type, position, edge = null) {
    this._pointMarker.visible = true;
    this._pointMarker.position.copy(position);

    if (type === 'edge' && edge) {
      const arr = this._edgeMarker.geometry.attributes.position.array;
      arr[0] = edge.a.x; arr[1] = edge.a.y; arr[2] = edge.a.z;
      arr[3] = edge.b.x; arr[4] = edge.b.y; arr[5] = edge.b.z;
      this._edgeMarker.geometry.attributes.position.needsUpdate = true;
      this._edgeMarker.visible = true;
    } else {
      this._edgeMarker.visible = false;
    }

    if (type === 'grid') {
      this._pointMarker.material.color.set(0x93c5fd);
    } else if (type === 'vertex') {
      this._pointMarker.material.color.set(0x5eead4);
    } else {
      this._pointMarker.material.color.set(0xfbbf24);
    }
  }

  _ensureIndex() {
    if (!this._dirty) return;

    this._vertexGrid.clear();
    this._edgeGrid.clear();
    this._meshCache.clear();

    const cellSize = Math.max(0.05, this.settings.tolerance * 1.5);
    const records = this.objectManager.list();

    records.forEach((record) => {
      const editable = this._getEditableMesh(record.mesh);
      if (!editable?.geometry?.attributes?.position) return;

      editable.updateWorldMatrix(true, false);
      const posAttr = editable.geometry.attributes.position;
      const index = editable.geometry.index;
      const verticesWorld = new Array(posAttr.count);

      for (let i = 0; i < posAttr.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(posAttr, i).applyMatrix4(editable.matrixWorld);
        verticesWorld[i] = v;
        this._insertVertex(v, record.id, cellSize);
      }

      const edgeSet = new Set();
      const pushEdge = (a, b) => {
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        const key = `${min}_${max}`;
        if (edgeSet.has(key)) return;
        edgeSet.add(key);

        const va = verticesWorld[a];
        const vb = verticesWorld[b];
        if (!va || !vb) return;
        this._insertEdge(va, vb, record.id, cellSize);
      };

      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          const ia = index.getX(i);
          const ib = index.getX(i + 1);
          const ic = index.getX(i + 2);
          pushEdge(ia, ib);
          pushEdge(ib, ic);
          pushEdge(ic, ia);
        }
      } else {
        for (let i = 0; i < posAttr.count; i += 3) {
          pushEdge(i, i + 1);
          pushEdge(i + 1, i + 2);
          pushEdge(i + 2, i);
        }
      }
    });

    this._dirty = false;
  }

  _insertVertex(v, targetId, cellSize) {
    const key = this._cellKey(v, cellSize);
    if (!this._vertexGrid.has(key)) this._vertexGrid.set(key, []);
    this._vertexGrid.get(key).push({ position: v, targetId });
  }

  _insertEdge(a, b, targetId, cellSize) {
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const key = this._cellKey(mid, cellSize);
    if (!this._edgeGrid.has(key)) this._edgeGrid.set(key, []);
    this._edgeGrid.get(key).push({ a, b, targetId });
  }

  _closestVertex(point, tolerance) {
    const cellSize = Math.max(0.05, this.settings.tolerance * 1.5);
    const nearby = this._collectNearby(this._vertexGrid, point, cellSize);
    let best = null;

    nearby.forEach((v) => {
      const d = v.position.distanceTo(point);
      if (d > tolerance) return;
      if (!best || d < best.distance) {
        best = { position: v.position, targetId: v.targetId, distance: d };
      }
    });

    return best;
  }

  _closestEdgePoint(point, tolerance) {
    const cellSize = Math.max(0.05, this.settings.tolerance * 1.5);
    const nearby = this._collectNearby(this._edgeGrid, point, cellSize);
    let best = null;

    nearby.forEach((edge) => {
      const cp = new THREE.Vector3();
      const line = new THREE.Line3(edge.a, edge.b);
      line.closestPointToPoint(point, true, cp);
      const d = cp.distanceTo(point);
      if (d > tolerance) return;
      if (!best || d < best.distance) {
        best = {
          position: cp,
          targetId: edge.targetId,
          distance: d,
          edge: { a: edge.a, b: edge.b },
        };
      }
    });

    return best;
  }

  _collectNearby(grid, point, cellSize) {
    const base = this._cellCoord(point, cellSize);
    const out = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const key = `${base.x + x}|${base.y + y}|${base.z + z}`;
          const list = grid.get(key);
          if (list?.length) out.push(...list);
        }
      }
    }
    return out;
  }

  _cellCoord(v, cellSize) {
    return {
      x: Math.floor(v.x / cellSize),
      y: Math.floor(v.y / cellSize),
      z: Math.floor(v.z / cellSize),
    };
  }

  _cellKey(v, cellSize) {
    const c = this._cellCoord(v, cellSize);
    return `${c.x}|${c.y}|${c.z}`;
  }

  _getEditableMesh(root) {
    if (root?.isMesh && root.geometry?.attributes?.position) return root;
    let found = null;
    root?.traverse((child) => {
      if (!found && child.isMesh && child.geometry?.attributes?.position) found = child;
    });
    return found;
  }
}
