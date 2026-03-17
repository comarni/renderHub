/* ═══════════════════════════════════════════════════════════════
   CommandParser — CLI command dispatcher with undo/redo stack
   ═══════════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { EventBus }            from '../core/EventBus.js';
import { NLPParser }           from '../ai/NLPParser.js';
import { ProceduralGenerator } from '../ai/ProceduralGenerator.js';
import { SceneSerializer }     from '../io/SceneSerializer.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

const HELP_TEXT = `
Available commands:
  gen <description>     — gen perro grande rojo | generame un coche azul
  save [name]           — save scene as .hub file
  load                  — load .hub file (opens file picker)
  import                — import GLTF / OBJ model (opens file picker)
  add <type> [name]     — add cube | sphere | cylinder | plane
  select <name|all>     — select Cube.001
  deselect              — clear selection
  move <x> <y> <z>      — move 0 1.5 0
  rotate <axis> <deg>   — rotate y 45
  rotate <x> <y> <z>    — rotate 0 45 0
  scale <x> <y> <z>     — scale 2 1 1  (or: scale 2)
  color <#hex>          — color #ff5500
  material <preset>     — plastic|metal|matte|glass|rubber|chrome|gold|wood|concrete|ceramic|carbon|velvet
  roughness <0-1>       — roughness 0.3
  metalness <0-1>       — metalness 0.8
  duplicate             — duplicate selected
  delete                — delete selected
  rename <name>         — rename NewName
  list                  — list all objects
  focus                 — focus camera on selected
  reset                 — clear all objects
  export [file.stl]     — export scene as STL
  view <mode>           — view top | front | right | perspective
  wireframe             — toggle wireframe
  undo / redo
  help`.trim();

export class CommandParser {
  /**
   * @param {import('../objects/ObjectManager.js').ObjectManager}     objectManager
   * @param {import('../objects/MaterialManager.js').MaterialManager} materialManager
   * @param {import('../core/SelectionManager.js').SelectionManager}  selectionManager
   * @param {import('../core/Camera.js').CameraManager}               cameraManager
   * @param {import('../export/STLExporter.js').STLExporter}          stlExporter
   */
  constructor(objectManager, materialManager, selectionManager, cameraManager, stlExporter) {
    this.objs   = objectManager;
    this.mats   = materialManager;
    this.sel    = selectionManager;
    this.cam    = cameraManager;
    this.exp    = stlExporter;

    // Callbacks set externally by UI components
    this.onViewChange     = null;  // (mode) => void
    this.onWireframe      = null;  // () => void
    this.onTransformMode  = null;  // (mode) => void

    // AI generation modules
    this._nlp = new NLPParser();
    this._gen = new ProceduralGenerator();

    // Scene serializer (instantiated here; needs objectManager + materialManager)
    this._serializer = new SceneSerializer(objectManager, materialManager);

    // ModelImporter set externally via setImporter()
    this._importer = null;

    this._history   = [];  // undo stack (100 entries)
    this._redoStack = [];  // redo stack
  }
  /** Wire the ModelImporter after construction. */
  setImporter(importer) {
    this._importer = importer;
  }

  /** True if there are undo steps available. */
  canUndo() { return this._history.length > 0; }

  /** True if there are redo steps available. */
  canRedo() { return this._redoStack.length > 0; }
  /* ══ Public API ═══════════════════════════════════════════════ */

  /**
   * Parse and execute a raw command string.
   * @param {string} raw
   * @returns {{ success: boolean, message: string }}
   */
  execute(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return { success: true, message: '' };

    const parts = trimmed.split(/\s+/);
    const cmd   = parts[0].toLowerCase();
    const args  = parts.slice(1);

    try {
      switch (cmd) {
        case 'add':        return this._add(args);
        case 'select':     return this._select(args);
        case 'deselect':   return this._deselect();
        case 'move':       return this._move(args);
        case 'rotate':     return this._rotate(args);
        case 'scale':      return this._scale(args);
        case 'color':      return this._color(args);
        case 'material':   return this._material(args);
        case 'roughness':  return this._roughness(args);
        case 'metalness':  return this._metalness(args);
        case 'duplicate':  return this._duplicate();
        case 'delete':     return this._delete();
        case 'rename':     return this._rename(args);
        case 'list':       return this._list();
        case 'focus':      return this._focus();
        case 'reset':      return this._reset();
        case 'export':     return this._export(args);
        case 'view':       return this._view(args);
        case 'wireframe':  return this._wireframe();
        case 'undo':       return this.undo();
        case 'redo':       return this.redo();
        case 'help':       return { success: true, message: HELP_TEXT };
        case 'save':       return this._save(args);
        case 'load':       return this._load();
        case 'import':     return this._import();
        // Natural-language generation: explicit 'gen' command
        case 'gen':        return this._generate(args.join(' '));
        default: {
          // Try NLP before giving up — catches "generame un perro" etc.
          const nlpResult = this._generate(trimmed);
          if (nlpResult.success) return nlpResult;
          return { success: false, message: `Unknown command: "${cmd}". Type help for list.` };
        }
      }
    } catch (e) {
      return { success: false, message: `Error: ${e.message}` };
    }
  }

  /* ══ Undo / Redo ══════════════════════════════════════════════ */

  _pushHistory(label, undoFn, redoFn) {
    this._history.push({ label, undo: undoFn, redo: redoFn });
    this._redoStack = [];
    if (this._history.length > 100) this._history.shift();
  }

  undo() {
    const entry = this._history.pop();
    if (!entry) return { success: false, message: 'Nothing to undo.' };
    entry.undo();
    this._redoStack.push(entry);
    EventBus.emit('state:changed', { type: 'scene' });
    return { success: true, message: `Undo: ${entry.label}` };
  }

  redo() {
    const entry = this._redoStack.pop();
    if (!entry) return { success: false, message: 'Nothing to redo.' };
    entry.redo();
    this._history.push(entry);
    EventBus.emit('state:changed', { type: 'scene' });
    return { success: true, message: `Redo: ${entry.label}` };
  }

  /* ══ Command implementations ══════════════════════════════════ */

  /* ══ AI / Natural language generation ═══════════════════════ */

  _generate(text) {
    const parsed = this._nlp.parse(text);
    if (!parsed) {
      const supported = this._nlp.supportedObjects.join(', ');
      return {
        success: false,
        message: `I don't recognise an object in: "${text}"\nSupported: ${supported}`,
      };
    }

    const { type, scale, color, count } = parsed;
    const names = [];
    const ids   = [];
    const spacing = 2.2 * (scale || 1);

    for (let i = 0; i < count; i++) {
      const group = this._gen.generate(type, { color: color || undefined });

      // Spread multiple objects in a row, centred at origin
      if (count > 1) {
        group.position.x = (i - (count - 1) / 2) * spacing;
      }

      if (scale !== 1) group.scale.setScalar(scale);

      const name = this.objs._generateName(type);
      const rec  = this.objs.addGroup(group, name, type);
      names.push(rec.name);
      ids.push(rec.id);
    }

    // Select all generated objects
    this.sel.selectByIds(ids, false);

    const colorInfo = color  ? ` color:${color}`   : '';
    const scaleInfo = scale !== 1 ? ` scale:×${scale}` : '';
    return {
      success: true,
      message: `✓ Generated: ${names.join(', ')}${colorInfo}${scaleInfo}`,
    };
  }

  /* ══ Command implementations ═════════════════════════════════ */

  _add(args) {
    const typeArg = (args[0] || '').toLowerCase();
    const nameArg = args.slice(1).join(' ') || null;

    const typeMap = { cube: 'box', box: 'box', sphere: 'sphere', cylinder: 'cylinder', plane: 'plane' };
    const type = typeMap[typeArg];
    if (!type) {
      return { success: false, message: `Unknown type "${typeArg}". Use: cube, sphere, cylinder, plane` };
    }

    const record = this.objs.add(type, nameArg);
    this.sel.selectByIds([record.id], false);

    this._pushHistory(
      `add ${record.name}`,
      () => { this.sel.deselectAll(); this.objs.delete(record.id); },
      () => {
        const r = this.objs.add(type, record.name);
        this.sel.selectByIds([r.id], false);
      }
    );

    return { success: true, message: `Added "${record.name}"` };
  }

  _select(args) {
    if (!args.length) return { success: false, message: 'Usage: select <name|all>' };
    const name = args.join(' ');
    if (name.toLowerCase() === 'all') {
      const ids = this.objs.list().map(r => r.id);
      this.sel.selectByIds(ids, false);
      return { success: true, message: `Selected ${ids.length} object(s)` };
    }
    const rec = this.sel.selectByName(name, false);
    if (!rec) return { success: false, message: `Object not found: "${name}"` };
    return { success: true, message: `Selected "${rec.name}"` };
  }

  _deselect() {
    this.sel.deselectAll();
    return { success: true, message: 'Deselected all' };
  }

  _move(args) {
    const rec = this._requireSelection();
    if (rec._error) return rec;
    const [x, y, z] = this._parseXYZ(args);
    const mesh = rec.mesh;
    const prev = mesh.position.clone();
    mesh.position.set(x, y, z);
    this._pushHistory(
      `move ${rec.name}`,
      () => { mesh.position.copy(prev); EventBus.emit('state:changed', { type: 'transform' }); },
      () => { mesh.position.set(x, y, z); EventBus.emit('state:changed', { type: 'transform' }); }
    );
    EventBus.emit('state:changed', { type: 'transform' });
    return { success: true, message: `Moved "${rec.name}" to (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)})` };
  }

  _rotate(args) {
    const rec = this._requireSelection();
    if (rec._error) return rec;
    const mesh = rec.mesh;
    const prev = mesh.rotation.clone();

    let rx, ry, rz;

    if (args.length === 2 && ['x', 'y', 'z'].includes(args[0].toLowerCase())) {
      // rotate y 45  (incremental on one axis)
      const axis = args[0].toLowerCase();
      const deg  = parseFloat(args[1]) || 0;
      rx = mesh.rotation.x * RAD2DEG;
      ry = mesh.rotation.y * RAD2DEG;
      rz = mesh.rotation.z * RAD2DEG;
      if (axis === 'x') rx += deg;
      if (axis === 'y') ry += deg;
      if (axis === 'z') rz += deg;
    } else {
      // rotate 0 45 0  (absolute all axes)
      [rx, ry, rz] = this._parseXYZ(args);
    }

    mesh.rotation.set(rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD);

    this._pushHistory(
      `rotate ${rec.name}`,
      () => { mesh.rotation.copy(prev); EventBus.emit('state:changed', { type: 'transform' }); },
      () => { mesh.rotation.set(rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD); EventBus.emit('state:changed', { type: 'transform' }); }
    );
    EventBus.emit('state:changed', { type: 'transform' });
    return { success: true, message: `Rotated "${rec.name}"` };
  }

  _scale(args) {
    const rec = this._requireSelection();
    if (rec._error) return rec;
    const mesh = rec.mesh;
    const prev = mesh.scale.clone();

    let sx, sy, sz;
    if (args.length === 1) {
      // Uniform scale
      sx = sy = sz = parseFloat(args[0]) || 1;
    } else {
      [sx, sy, sz] = this._parseXYZ(args);
    }

    if (sx <= 0 || sy <= 0 || sz <= 0) {
      return { success: false, message: 'Scale values must be > 0' };
    }

    mesh.scale.set(sx, sy, sz);
    this._pushHistory(
      `scale ${rec.name}`,
      () => { mesh.scale.copy(prev); EventBus.emit('state:changed', { type: 'transform' }); },
      () => { mesh.scale.set(sx, sy, sz); EventBus.emit('state:changed', { type: 'transform' }); }
    );
    EventBus.emit('state:changed', { type: 'transform' });
    return { success: true, message: `Scaled "${rec.name}" to (${sx}, ${sy}, ${sz})` };
  }

  _color(args) {
    const rec = this._requireSelection();
    if (rec._error) return rec;
    if (!args.length) return { success: false, message: 'Usage: color #rrggbb' };

    let hex = args[0];
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      return { success: false, message: `Invalid color: "${hex}". Use format #rrggbb` };
    }

    const prevColor = '#' + rec.mesh.material.color.getHexString();
    this.mats.applyColor(rec.mesh, hex);

    this._pushHistory(
      `color ${rec.name}`,
      () => { this.mats.applyColor(rec.mesh, prevColor); EventBus.emit('state:changed', { type: 'material' }); },
      () => { this.mats.applyColor(rec.mesh, hex); EventBus.emit('state:changed', { type: 'material' }); }
    );
    EventBus.emit('state:changed', { type: 'material' });
    return { success: true, message: `Color set to ${hex} on "${rec.name}"` };
  }

  _material(args) {
    const rec = this._requireSelection();
    if (rec._error) return rec;
    const preset = (args[0] || '').toLowerCase();
    const valid = ['plastic', 'metal', 'matte', 'glass'];
    if (!valid.includes(preset)) {
      return { success: false, message: `Unknown preset "${preset}". Use: ${valid.join(', ')}` };
    }
    this.mats.applyPreset(rec.mesh, preset);
    EventBus.emit('state:changed', { type: 'material' });
    return { success: true, message: `Material set to "${preset}" on "${rec.name}"` };
  }

  _roughness(args) {
    const rec = this._requireSelection();
    if (rec._error) return rec;
    const val = parseFloat(args[0]);
    if (isNaN(val)) return { success: false, message: 'Usage: roughness <0-1>' };
    this.mats.setRoughness(rec.mesh, val);
    EventBus.emit('state:changed', { type: 'material' });
    return { success: true, message: `Roughness: ${Math.max(0, Math.min(1, val)).toFixed(2)}` };
  }

  _metalness(args) {
    const rec = this._requireSelection();
    if (rec._error) return rec;
    const val = parseFloat(args[0]);
    if (isNaN(val)) return { success: false, message: 'Usage: metalness <0-1>' };
    this.mats.setMetalness(rec.mesh, val);
    EventBus.emit('state:changed', { type: 'material' });
    return { success: true, message: `Metalness: ${Math.max(0, Math.min(1, val)).toFixed(2)}` };
  }

  _duplicate() {
    const rec = this._requireSelection();
    if (rec._error) return rec;
    const newRec = this.objs.duplicate(rec.id);
    this.sel.selectByIds([newRec.id], false);
    this._pushHistory(
      `duplicate ${rec.name}`,
      () => { this.sel.deselectAll(); this.objs.delete(newRec.id); },
      () => { const r = this.objs.duplicate(rec.id); this.sel.selectByIds([r.id]); }
    );
    return { success: true, message: `Duplicated "${rec.name}" → "${newRec.name}"` };
  }

  _delete() {
    const recs = this.sel.getAll();
    if (recs.length === 0) return { success: false, message: 'No object selected.' };
    this.sel.deselectAll();
    recs.forEach(r => this.objs.delete(r.id));
    // Note: undo for delete would need to re-create geometry; simplified here
    return { success: true, message: `Deleted ${recs.length} object(s)` };
  }

  _rename(args) {
    const rec = this._requireSelection();
    if (rec._error) return rec;
    if (!args.length) return { success: false, message: 'Usage: rename <newname>' };
    const newName = args.join(' ');
    const oldName = rec.name;
    this.objs.rename(rec.id, newName);
    this._pushHistory(
      `rename ${oldName}`,
      () => { this.objs.rename(rec.id, oldName); EventBus.emit('state:changed', { type: 'scene' }); },
      () => { this.objs.rename(rec.id, newName); EventBus.emit('state:changed', { type: 'scene' }); }
    );
    return { success: true, message: `Renamed "${oldName}" → "${newName}"` };
  }

  _list() {
    const list = this.objs.list();
    if (list.length === 0) return { success: true, message: 'Scene is empty.' };
    const lines = list.map((r, i) => {
      const sel = this.sel.selected.has(r.id) ? '●' : ' ';
      const p = r.mesh.position;
      return `${sel} ${i + 1}. [${r.type}] "${r.name}" @ (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
    });
    return { success: true, message: lines.join('\n') };
  }

  _focus() {
    const rec = this._requireSelection();
    if (rec._error) return rec;
    this.cam.focusOn(rec.mesh);
    return { success: true, message: `Focused on "${rec.name}"` };
  }

  _reset() {
    this.sel.deselectAll();
    this.objs.reset();
    return { success: true, message: 'Scene cleared.' };
  }

  _export(args) {
    if (!this.exp) return { success: false, message: 'Exporter not available.' };
    const filename = args[0] || 'scene.stl';
    return this.exp.export(filename);
  }

  _view(args) {
    const mode = (args[0] || '').toLowerCase();
    const valid = ['top', 'front', 'right', 'perspective', 'persp'];
    const resolved = mode === 'persp' ? 'perspective' : mode;
    if (!valid.includes(mode)) {
      return { success: false, message: `Unknown view "${mode}". Use: top, front, right, perspective` };
    }
    this.cam.setView(resolved);
    this.sel.updateCamera();
    if (this.onViewChange) this.onViewChange(resolved);
    EventBus.emit('state:changed', { type: 'camera' });
    return { success: true, message: `View: ${resolved}` };
  }

  _wireframe() {
    if (this.onWireframe) this.onWireframe();
    return { success: true, message: 'Wireframe toggled' };
  }

  /* ══ Helpers ══════════════════════════════════════════════════ */

  _requireSelection() {
    const rec = this.sel.getPrimary();
    if (!rec) return { _error: true, success: false, message: 'No object selected. Use: select <name>' };
    return rec;
  }

  _parseXYZ(args) {
    const x = parseFloat(args[0]) || 0;
    const y = parseFloat(args[1]) || 0;
    const z = parseFloat(args[2]) || 0;
    return [x, y, z];
  }
}
