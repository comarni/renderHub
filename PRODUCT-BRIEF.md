# RenderHub — Product Brief
### Resumen Ejecutivo de Producto · Marzo 2026

---

## ¿Qué es RenderHub?

RenderHub es un **editor 3D CAD-paramétrico web**, de arquitectura modular, que corre íntegramente en el navegador sin instalación. Combina capacidades de modelado 3D en tiempo real, un pipeline de exportación pluggable a múltiples formatos industriales, inteligencia artificial generativa (Image-to-3D), y un sistema de snapping de precisión; todo sobre una base de código abierto y extensible.

En términos de posicionamiento:

> **"El Blender ligero del navegador con exportación industrial lista para producción."**

---

## Funcionalidades Objetivas Actuales

### 🧱 Motor 3D
- Renderizado WebGL tiempo real vía Three.js (PBR + sombras + antialiasing)
- Sistema de cámara dual: perspectiva / ortográfica con OrbitControls
- Grid adaptativo, helpers de ejes, overlay de viewport con accesos directos
- Loop de render con delta-time, sin dependencia de servidor

### 📦 Sistema de Objetos
- Primitivas paramétrizables: cubo, esfera, cilindro, plano
- Importación de modelos externos: GLTF, GLB, OBJ, STL, imagen-3D, video plane, web plane
- ObjectManager con IDs únicos, registro centralizado y eventos de ciclo de vida
- MaterialManager con sistema PBR: 12+ presets (metal, vidrio, chrome, madera, goma…)

### 🔧 CAD Paramétrico (Fase 1–3 completas)
- **Timeline de operaciones**: cada acción (extrude, transform, material) queda registrada como operación reversible
- Supresión de operaciones sin pérdida de datos
- Reordenamiento de operaciones
- Edición de parámetros en operaciones pasadas (no destructivo)
- Undo/Redo de 3 niveles: CadState, CommandParser y operaciones individuales
- **SnapManager** con índice hash espacial: vertex snap, edge snap, grid snap
- Tolerancia adaptable y feedback visual en tiempo real (marcadores de snap)

### 🚪 Sistema de Exportación (Phase 4 — recién completada)
Arquitectura **pluggable** real:

| Formato | Destino | Características |
|---------|---------|----------------|
| **STL** | Impresión 3D / CNC / CAD | Binary, world transforms bakeados, compatible con cualquier slicer |
| **GLTF/GLB** | Web / Games / Unity / Unreal / Blender | PBR materials, escena completa, posiciones relativas preservadas |
| **JSON / .hub** | Backup / Portabilidad / Debug | Timeline CAD + snapSettings + metadata, reloadable 100% |
| **HTML** | Distribución inmediata | Viewer Three.js standalone, sin servidor, cualquier browser |

Añadir un nuevo formato requiere **un único archivo** y **una línea de registro**. El core no se toca.

### 🤖 Inteligencia Artificial
- Pipeline Image-to-3D via TripoSR (modelo VAST-AI, 6 GB)
- Proxy Node.js (puerto 8787) + wrapper Python FastAPI (puerto 9000)
- Fallback a generación local de relieve si el modelo no está disponible
- Soporte GPU (CUDA) y CPU

### 🎬 Sistema de Mundo / Escenario
- EnvironmentManager: 8 presets de ambiente (Studio, Sunset, Night, Arctic…)
- ObjectAnimator: keyframes, loops, animaciones procedurales
- ScenarioDirector: narrativa de escena, secuencias automatizadas

### 🖥️ UX Profesional
- Terminal de comandos con historial, autocompletado y parser extensible
- SceneHierarchy: árbol de objetos, renombrar, seleccionar, reordenar
- PropertiesPanel: edición numérica de transforms + export por objeto
- RadialContextMenu: menú circular contextual en right-click
- ProjectLibrary: thumbnails automáticos, save/load local
- ExportPanel: modal unificado para los 4 formatos, async, domain-aware
- Sistema de toasts, analytics internos, guided demo onboarding

---

## Punto Actual de Madurez Comercial

### Escala de 1 a 10 por dimensión:

| Dimensión | Puntuación | Justificación |
|-----------|-----------|--------------|
| **Funcionalidad core** | 7/10 | Editor funcionando, CAD paramétrico, exportación multi-formato |
| **Arquitectura técnica** | 8/10 | Modular, pluggable, sin deuda técnica grave, EventBus limpio |
| **UX / Pulido** | 5/10 | Funcional pero sin onboarding profundo, documentación de usuario básica |
| **Robustez / QA** | 4/10 | No hay tests automatizados, matriz QA pendiente |
| **Escalabilidad cloud** | 4/10 | Backend existe pero en modo local/dev; no hay auth, ni multi-tenant |
| **Diferenciación de mercado** | 8/10 | Combinación CAD + IA + export multi-industria en browser es rara |
| **Preparación para venta** | 5/10 | Necesita demo pulida, pricing claro, y QA verificado |

**Conclusión**: Estás en un punto `early commercial` — el producto existe y funciona, pero necesita entre 4 y 8 semanas de trabajo enfocado para ser presentable ante un comprador corporativo serio.

---

## Modelos de Monetización

### 1. 🏢 Licencia B2B (mayor potencial inmediato)
Vender acceso o instancia del sistema a empresas que necesiten:
- Configuradores de producto 3D en su web (e-commerce, industrial)
- Herramienta interna CAD ligera para equipos de diseño
- Viewer 3D embebible white-label

**Precio orientativo**: €500–€5.000/mes por empresa según uso y soporte.

### 2. ☁️ SaaS / Plataforma (alto potencial a medio plazo)
Modelo freemium con límites:
- Free: 3 proyectos, formatos básicos (STL, JSON)
- Pro (€29/mes): proyectos ilimitados, GLTF, HTML, Image-to-3D, colaboración
- Team (€99/mes): multi-user, roles, historial de versiones, API

### 3. 🔌 SDK / API de exportación
Vender solo el motor de exportación como librería npm:
```
npm install @renderhub/exporter
```
Dirigido a estudios que ya tienen su propio editor pero necesitan el pipeline de conversión multi-formato.

**Precio orientativo**: €99–€499/mes por proyecto / uso.

### 4. 🤖 API Image-to-3D como servicio independiente
El pipeline TripoSR es el diferencial más obvio para monetizar por sí solo:
- Precio por conversión (€0.10–€0.50/modelo según resolución)
- Suscripción volumen para estudios de e-commerce, arquitectura, gaming

### 5. 📐 Vertical industrial (CAD ligero en browser)
Vender a fabricantes, estudios de ingeniería, arquitectos que no quieren el peso de SolidWorks/Fusion360 para tareas simples:
- STL export directo al slicer
- Snapping de precisión
- Timeline paramétrico
- Integración con ERP/PLM vía API REST (a construir)

### 6. 🎬 Vertical creativa / agencias
El HTML export + presets (agency, ecommerce, realestate) ya apunta a esto:
- Agencias digitales que quieren entregar configuradores 3D a clientes
- Productoras que necesitan assets web interactivos sin Blender

---

## Valoración Estimada si se Vende a una Gran Empresa

> **Disclaimer**: No soy banco de inversión ni tasador oficial. Estas son estimaciones basadas en comparables de mercado de herramientas SaaS/dev-tools B2B y adquisiciones de tooling 3D web en 2023–2026.

### Metodología aplicada: múltiplos de ARR proyectado + valor estratégico

#### Escenario 1 — Venta por activo técnico (IP sale)
Lo que se vende: el código, la arquitectura, el pipeline de exportación.
Sin usuarios, sin revenue.

**Valoración**: **€80.000 – €200.000**

Justificación: 4-8 meses de trabajo de un equipo senior (€8.000–€12.000/mes), arquitectura limpia, diferencial real, pero sin tracción demostrada.

---

#### Escenario 2 — Venta como producto con demo y clientes piloto (2-3 empresas pagando)
Con 2–3 clientes B2B pagando €1.000–€2.000/mes = ARR ≈ €30.000–€50.000.
Múltiplo típico en herramientas B2B early-stage: 5x–10x ARR.

**Valoración**: **€250.000 – €500.000**

---

#### Escenario 3 — Adquisición estratégica por empresa de software 3D / CAD / e-commerce
Compradores potenciales: Adobe, Autodesk, Shopify, Matterport, Sketchfab, Unity, Trimble.
Lo que valoran: el pipeline CAD-web-browser sin instalación + Image-to-3D + export multi-formato.

En este contexto el valor no es el ARR, sino eliminar 12–18 meses de desarrollo interno.

**Valoración**: **€500.000 – €2.000.000**

El rango amplio depende de si hay IP protegible (patent-pending en pipeline) y de la urgencia estratégica del comprador.

---

#### Escenario 4 — Integración en plataforma de manufacturación o e-commerce (acquisition for product-fit)
Compradores tipo: Protolabs, Xometry, Materialise (3D printing), Shopify (product configurators).
Estos compradores valoran el flujo completo: diseño → configuración → STL → pedido.

**Valoración**: **€1.000.000 – €3.000.000**

Solo si el pipeline STL/CAD está QA-verificado y el sistema es multi-tenant.

---

### Resumen de valoración

| Escenario | Condición | Rango estimado |
|-----------|-----------|----------------|
| IP sale puro | Sin tracción | €80K – €200K |
| Early-stage con pilotos | 2-3 clientes | €250K – €500K |
| Adquisición estratégica (big tech) | Producto maduro | €500K – €2M |
| Adquisición industrial / e-commerce | Pipeline QA + multi-tenant | €1M – €3M |

---

## Qué Falta para Maximizar el Valor (Hoja de Ruta Comercial)

Para pasar de Escenario 1 a Escenario 3 en 3–4 meses:

1. **QA Matrix** (2 semanas) — Pruebas reales de los 4 formatos en los 5 casos de la tabla. Detecta y cierra brechas de coherencia.
2. **Determinismo de pipeline** (1 semana) — Garantizar que export → reimport → re-export produce resultado idéntico.
3. **Export por selección** (1 semana) — Pieza por pieza, no solo escena completa.
4. **Auth + multi-tenant básico** (3 semanas) — Mínimo viable para SaaS: login, proyectos por usuario, límites de tier.
5. **Demo pulida + landing page** (2 semanas) — Video de 90 segundos, 3 casos de uso, pricing visible.
6. **2-3 clientes piloto** (ongoing) — Cualquier estudio de arquitectura, agencia o empresa de manufactura local dispuesta a pagar €200–€500/mes para validar.

---

*Documento generado el 18 de marzo de 2026. Estado del producto: Early Commercial — Production-ready core, pre-scale.*
