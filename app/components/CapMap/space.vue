<template>
  <div ref="container" class="w-full h-full Estedad-FD-Bold"></div>
</template>

<script setup lang="ts">
/*#region ================== Import ================== */
import * as THREE from 'three'
import PF from "pathfinding";
import { gsap } from 'gsap'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { Line2 } from 'three/examples/jsm/lines/Line2'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry'
import img_map from './assets/img/map.png'
import img_lobby from './assets/img/plan-lobby.png'
import img_logo from './assets/img/logo-3d.png'
import model_tree from './assets/models/tree-1.glb'
/*#endregion*/

/*#region ================== Props - Emits ================== */
const props = defineProps({
  title : {
    type: String,
    default: "",
  },
  editMode : {
    type: Boolean,
    default: false,
  },
  routing : {
    type: Boolean,
    default: false,
  }
});
const emit = defineEmits(['update', 'export', 'delete', 'endRouting', 'selectBooth'])
/*#endregion*/

/*#region ================== Interface ================== */
export type PolygonType = 'booth' | 'walkable'
export interface EditorPolygon {
  id: number
  title: string
  hostID: string
  locationID: string
  boothCode?: string   // ⬅️ جدید
  type: PolygonType
  points: THREE.Vector3[]
  color: string
  border?: THREE.LineSegments
  mesh?: THREE.Mesh
  roof?: THREE.Mesh
  line?: THREE.Line
  label?: THREE.Sprite
  codeLabel?: THREE.Sprite   // ⬅️ لیبل شناسه
  handles?: THREE.Mesh[]
}
/*#endregion*/

/*#region ================== STATE ================== */
const container = ref<HTMLDivElement | null>(null)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const gltfLoader = new GLTFLoader()
const modelCache = new Map<string, THREE.Object3D>()

let lastMouseMoveTime = 0;

const multiSelectEnabled = ref(false) // false: فقط یک غرفه همزمان
const hoveredBooth = ref<EditorPolygon | null>(null)
const selectedBooths = ref<EditorPolygon[]>([])
let lastMouseEvent: MouseEvent | null = null
const BOOTH_NORMAL_Y = 2.5 // ارتفاع اولیه
const BOOTH_HOVER_Y = 3.8 // وقتی موس روشه
const BOOTH_SELECTED_Y = 4.5  // وقتی select شده
const OPACITY_DIM = 0.3  // وقتی سایر غرفه‌ها dim شدن
const OPACITY_NORMAL = 0.9 // حالت عادی

//#region Settings
const settings = reactive({
  showGrid: true,
  gridSize: 166,
  gridStep: 1,
})
//#endregion

//#region Line Animation
let fullPathPoints: THREE.Vector3[] = []
let pathProgress = 0
let dashOffset = 0
let animatedLine: Line2 | null = null
let lineMaterial: LineMaterial | null = null
let pathCurve: THREE.CatmullRomCurve3 | null = null
let glowLine: Line2 | null = null
let movingDot: THREE.Mesh | null = null
let arrowGroup: THREE.Group | null = null

let animationT = 0
//#endregion


const GRID = 1
const CLOSE_THRESHOLD = 1.2
let ground: THREE.Mesh
let startPoint: any = null
let endPoint: any = null
let line: THREE.Line | null = null
let polygons: any[] = []
let activePolygon: any = null
let dragging: { poly: any; index: number } | null = null
let drawMode = false
let idCounter = 1
const currentPolygonType = ref<'walkable' | 'booth'>('walkable')
const selectedPolygonId = ref<number | null>(null)
const GRID_SIZE_PATH = 1
const GRID_EXTENT = settings.gridSize

let pfGrid: PF.Grid
let finder = new PF.AStarFinder({
  allowDiagonal: false,
  heuristic: PF.Heuristic.octile,
  dontCrossCorners: true,
})
const OBSTACLE_BUFFER_CELLS = 1   // فاصله از مانع (به واحد grid)
const PATH_HEIGHT = 0.05          // ارتفاع مسیر از زمین
const PATH_LINE_WIDTH = 3         // ضخامت خط (در WebGL واقعی نیست ولی نگه می‌داریم)
/*#endregion*/

/*#region ================== LIFECYCLE ================== */
onMounted(() => {
  init()
  animate()
  // window.addEventListener('mousedown', onDown)
  // window.addEventListener('mousemove', onMove)
  // window.addEventListener('mouseup', onUp)
  // window.addEventListener('click', onClickScene)
  // window.addEventListener('click', (e) => {
  //   if (!props.routing) onClick(e);
  //   if (props.routing) onClickRoutingMode(e);
  // });
  // window.addEventListener('contextmenu', onRightClick)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cancelDrawing()
    }
    if (e.key === 'Enter') {
      finishPolygon()
    }
  })
})
/*#endregion*/

/*#region ================== HELPERS ================== */
function updateMouse(e: MouseEvent) {
  const r = renderer.domElement.getBoundingClientRect()
  mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1
  mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1
}

function snap(v: number) {
  return Math.round(v / GRID) * GRID
}

function getGroundPoint(e: MouseEvent) {
  updateMouse(e)
  raycaster.setFromCamera(mouse, camera)
  const hit = raycaster.intersectObject(ground)
  if (!hit.length) return null
  const p = hit[0].point
  return new THREE.Vector3(snap(p.x), 0, snap(p.z))
}

function extrudePolygon(poly: any) {
  if (poly.extrudedMesh) {
    scene.remove(poly.extrudedMesh)
  }
  const shape = new THREE.Shape(
      poly.points.map((p: THREE.Vector3) => new THREE.Vector2(p.x, p.z))
  )
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 4,
    bevelEnabled: false,
  })
  geometry.rotateX(Math.PI / 2)
  const material = new THREE.MeshStandardMaterial({
    color: poly.color,
    roughness: 0.6,
    metalness: 0.1,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.y = 0
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
  poly.extrudedMesh = mesh
}
/*#endregion*/

/*#region ================== Add Image To Scene ================== */
function addImageToScene(path:string,w:number,h:number,x:number,y:number,z:number=0.02) {
  const textureLoader = new THREE.TextureLoader()
  const texture = textureLoader.load(path)

  const geometry = new THREE.PlaneGeometry(w, h)
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  })

  const plane = new THREE.Mesh(geometry, material)
  plane.rotation.x = -Math.PI / 2
  plane.position.set(x,z, y)

  scene.add(plane)
}
/*#endregion*/

/*#region ================== INIT ================== */
function init() {
  initSceneAndCamera()
  initRendererAndControls()
  addGrid()
  addFloor()
  addGround()
  addLights()
  addExtras()
  animate()
}
/*#endregion */

/*#region Scene & Camera */
function initSceneAndCamera() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf5f5f5)
  scene.fog = new THREE.FogExp2(0xcce0ff, 0.002)

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(40, 110, 90)
}

function initRendererAndControls() {
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  container.value!.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  }
  controls.maxPolarAngle = Math.PI / 2.05

  // ✅ فقط روی canvas
  const canvas = renderer.domElement
  canvas.addEventListener('mousedown', onDown)
  canvas.addEventListener('mousemove', onMove)
  canvas.addEventListener('mouseup', onUp)
  canvas.addEventListener('contextmenu', onRightClick)

  canvas.addEventListener('click', (e) => {
    if (!props.routing) onClick(e)
    else onClickRoutingMode(e)
  })

  canvas.addEventListener('click', onClickScene)

}
/*#endregion */

/*#region Grid & Floor */
function addGrid() {
  if (!settings.showGrid || !props.editMode) return
  const divisions = settings.gridSize / settings.gridStep
  const grid = new THREE.GridHelper(settings.gridSize, divisions, 0x000000, 0xcccccc)
  scene.add(grid)
}

function addFloor() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(166, 0)
  shape.lineTo(166, -110)
  shape.lineTo(105, -110)
  shape.lineTo(105, -138)
  shape.lineTo(57, -138)
  shape.lineTo(57, -110)
  shape.lineTo(0, -110)
  shape.lineTo(0, 0)

  const geometry = new THREE.ShapeGeometry(shape)
  geometry.center()
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const floor = new THREE.Mesh(geometry, material)
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)
}

function addGround() {
  const divisions = settings.gridSize / settings.gridStep
  ground = new THREE.Mesh(
      new THREE.PlaneGeometry(settings.gridSize, divisions),
      new THREE.MeshBasicMaterial({ visible: false })
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
}
/*#endregion */

/*#region Lighting */
function addLights() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.add(ambientLight)

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8)
  hemiLight.position.set(0, 50, 0)
  scene.add(hemiLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight.position.set(30, 50, 30)
  dirLight.target.position.set(0, 0, 0)
  dirLight.castShadow = true
  scene.add(dirLight, dirLight.target)

  addSunAndClouds()
}

function addSunAndClouds() {
  const sun = new THREE.DirectionalLight(0xfff8e7, 0.5)
  sun.position.set(100, 200, 100)
  sun.castShadow = true
  scene.add(sun)

  // const cloudGeo = new THREE.SphereGeometry(20, 32, 16)
  // const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
  // const cloud1 = new THREE.Mesh(cloudGeo, cloudMat)
  // cloud1.position.set(50, 80, -30)
  // const cloud2 = cloud1.clone()
  // cloud2.position.set(-60, 90, 40)
  // scene.add(cloud1, cloud2)
}
/*#endregion */

/*#region Extra Models & Images */
function addExtras() {
  addImageToScene(img_lobby, 50, 27, -2, 28)
  if (!props.editMode) {
    addImageToScene(img_logo, 55, 30, 55, 60)
    addImageToScene(img_map, 1000, 520, 38, 5, -0.5)
    setTimeout(() => {
      addText(props.title, new THREE.Vector3(-2, 1, 70))
      addTrees()
    }, 1500)
  }
}

function addTrees() {
  const positions = [
    { x:190, z: 153},
    { x:180, z: 153},
    { x:170, z: 153},
    { x:160, z: 153},
    { x:150, z: 153},
    { x:140, z: 153},
    { x:130, z: 153},
    { x:-1163, z: 182},
    { x:-158, z: 178},
    { x:-150, z: 168},
    { x:-140, z: 162},
    { x:-130, z: 157},
    { x:-120, z: 153},
    { x:-110, z: 153},
    { x:-100, z: 153},
    { x:-90, z: 153},
    { x:-80, z: 153},
    { x:-70, z: 153},
    { x:-60, z: 153},
    { x:-50, z: 153},
    { x:-40, z: 153},
    { x:-30, z: 153},
    { x:-2, z: 153},
    { x:7 , z: 153},
    { x:25, z: 153},
    { x:32, z: 153},
    { x:40, z: 153},
    { x:50, z: 153},
    { x:60, z: 153},
    { x:70, z: 153},
    { x:80, z: 153},
    { x:-4, z: 110},
    { x:-4, z: 120},
    { x:-4, z: 130},
    { x:8 , z: 110},
    { x:8 , z: 120},
    { x:8 , z: 130},
    { x:-25, z: 120},
    { x:-32, z: 130},
    { x:-45, z: 132},
    { x:26, z: 120},
    { x:32, z: 130},
    { x:45, z: 132},
    { x:122, z: 107},
    { x:122, z: 115},
    { x:122, z: 125},
    { x:122, z: 65},
    { x:122, z: 75},
    { x:122, z: 85},
    { x:122, z: 5},
    { x:122, z: 15},
    { x:122, z: 25},
    { x:122, z: 35},
    { x:122, z: 45},
  ]
  const treeData = positions.map(p => ({ ...p, scale: 0.03 }))
  addModelsToScene(model_tree, treeData)
}
/*#endregion */

/*#region ================== DRAW MODE ================== */
function startPolygon(polygonType: "booth" | "walkable") {
  drawMode = true
  currentPolygonType.value = polygonType;
  let title = polygonType == 'booth' ? 'غرفه ' + idCounter : 'مسیر ' + idCounter
  activePolygon = {
    id: idCounter++,
    title: title,
    boothCode: `PAV-${idCounter - 1}`,
    hostID: null,
    locationID: null,
    data: null,
    color: currentPolygonType.value === 'booth' ? '#f97316' : '#22c55e',
    type: currentPolygonType.value,
    points: [],
    handles: [],
    line: null,
    mesh: null,
    label: null,
    extrudedMesh: null,
  }
}

function finishPolygon() {
  if (!activePolygon || activePolygon.points.length < 3) return
  polygons.push(activePolygon)
  redraw(activePolygon)
  emit('update', polygons)
  activePolygon = null
  drawMode = false
}

function cancelDrawing() {
  if (activePolygon) {
    if (activePolygon.mesh) scene.remove(activePolygon.mesh)
    if (activePolygon.line) scene.remove(activePolygon.line)
    if (activePolygon.label) scene.remove(activePolygon.label)
    if (activePolygon.roof) scene.remove(activePolygon.roof)
    if (activePolygon.codeLabel) scene.remove(activePolygon.codeLabel)
    if (activePolygon.border) scene.remove(activePolygon.border)
    if (activePolygon.extrudedMesh) scene.remove(activePolygon.extrudedMesh)
    if (activePolygon.handles) {
      activePolygon.handles.forEach((it: any) => {
        scene.remove(it)
      })
    }

    emit('update', polygons)
    activePolygon = null
    drawMode = false
  }
}

function updatePolygon(updated: any) {
  const poly = polygons.find(p => p.id === updated.id)
  if (!poly) return
  poly.points = updated.points.map((p: any) => p.clone())
  poly.color = updated.color
  poly.title = updated.title
  redraw(poly)
}

function removePolygon(polyToRemove: any) {
  const index = polygons.findIndex(p => p.id === polyToRemove)
  if (index === -1) return
  const poly = polygons[index]

  // حذف دستگیره‌ها
  if (poly.handles) {
    poly.handles.forEach((h: THREE.Mesh) => scene.remove(h))
  }

  // حذف هندسه‌ها
  if (poly.mesh) scene.remove(poly.mesh)
  if (poly.roof) scene.remove(poly.roof) // حذف سقف
  if (poly.line) scene.remove(poly.line)
  if (poly.label) scene.remove(poly.label)
  if (poly.codeLabel) scene.remove(poly.codeLabel)
  if (poly.border) scene.remove(poly.border)

  // حذف از لیست
  polygons.splice(index, 1)
  emit('update', polygons)
}
/*#endregion*/

/*#region ================== EVENTS ================== */
function onClick(e: MouseEvent) {
  if (e.target !== renderer.domElement) return
  if (!drawMode || dragging) return
  const p = getGroundPoint(e)
  if (!p) return
  if (activePolygon.points.length >= 3 && p.distanceTo(activePolygon.points[0]) < CLOSE_THRESHOLD) {
    finishPolygon()
    return
  }
  addPoint(activePolygon, p)
}

function onDown(e: MouseEvent) {
  lastMouseEvent = e
  updateMouse(e)
  raycaster.setFromCamera(mouse, camera)
  const handles = polygons.flatMap(p =>
      p.handles.map((h: any, i: number) => ({ h, p, i }))
  )
  const hits = raycaster.intersectObjects(handles.map(x => x.h))
  if (!hits.length) return
  const h = hits[0].object
  const found = handles.find(x => x.h === h)
  if (!found) return
  dragging = { poly: found.p, index: found.i }
  controls.enabled = false
}

function onMove(e: MouseEvent) {
  lastMouseEvent = e
  if (!dragging) return
  const p = getGroundPoint(e)
  if (!p) return
  dragging.poly.points[dragging.index].copy(p)
  dragging.poly.handles[dragging.index].position.copy(p)
  redraw(dragging.poly)
}

function onUp() {
  dragging = null
  controls.enabled = true
}

function onRightClick(e: MouseEvent) {
  e.preventDefault()
  updateMouse(e)
  raycaster.setFromCamera(mouse, camera)
  const handles = polygons.flatMap(p => p.handles)
  const hit = raycaster.intersectObjects(handles)
  if (!hit.length) return
  const h = hit[0].object
  const poly = polygons.find(p => p.handles.includes(h))
  const idx = poly.handles.indexOf(h)
  if (poly.points.length <= 3) return
  scene.remove(h)
  poly.handles.splice(idx, 1)
  poly.points.splice(idx, 1)
  redraw(poly)
  emit('update', polygons)
}
/*#endregion*/

/*#region ================== PATHFINDING ================== */
function buildPathfindingGrid() {
  const size = GRID_EXTENT
  const cols = Math.floor(size / GRID_SIZE_PATH)
  const rows = Math.floor(size / GRID_SIZE_PATH)
  const matrix: number[][] = []

  for (let y = 0; y < rows; y++) {
    matrix[y] = []
    for (let x = 0; x < cols; x++) {
      const worldX = x * GRID_SIZE_PATH - size / 2
      const worldZ = y * GRID_SIZE_PATH - size / 2

      // مسیر از داخل غرفه‌ها عبور نکند
      const blocked = polygons.some(poly =>
          pointInPolygon({ x: worldX, z: worldZ }, poly)
      )
      matrix[y][x] = blocked ? 1 : 0
    }
  }

  // 🔹 buffer برای جلوگیری از نزدیک شدن بیش از حد به غرفه‌ها
  inflateObstacles(matrix, OBSTACLE_BUFFER_CELLS)

  // 🔹 اجازه بده start/end حتی داخل غرفه باشند
  if (startPoint) {
    const g = worldToGrid(startPoint.pos)
    if (g.x >= 0 && g.x < cols && g.y >= 0 && g.y < rows) matrix[g.y][g.x] = 0
  }
  if (endPoint) {
    const g = worldToGrid(endPoint.pos)
    if (g.x >= 0 && g.x < cols && g.y >= 0 && g.y < rows) matrix[g.y][g.x] = 0
  }

  pfGrid = new PF.Grid(matrix)
}
function inflateObstacles(matrix: number[][], buffer: number) {
  const h = matrix.length
  const w = matrix[0].length
  const clone = matrix.map(r => [...r])

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (clone[y][x] === 1) {
        for (let dy = -buffer; dy <= buffer; dy++) {
          for (let dx = -buffer; dx <= buffer; dx++) {
            const ny = y + dy
            const nx = x + dx
            if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
              matrix[ny][nx] = 1
            }
          }
        }
      }
    }
  }
}
function pointInPolygon(p: { x: number; z: number }, poly: any) {
  let inside = false
  const pts = poly.points

  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, zi = pts[i].z
    const xj = pts[j].x, zj = pts[j].z

    const intersect =
        zi > p.z !== zj > p.z &&
        p.x < ((xj - xi) * (p.z - zi)) / (zj - zi) + xi

    if (intersect) inside = !inside
  }
  return inside
}
function worldToGrid(v: THREE.Vector3) {
  const half = GRID_EXTENT / 2
  return {
    x: Math.floor((v.x + half) / GRID_SIZE_PATH),
    y: Math.floor((v.z + half) / GRID_SIZE_PATH),
  }
}
function gridToWorld(x: number, y: number) {
  const half = GRID_EXTENT / 2
  return new THREE.Vector3(
      x * GRID_SIZE_PATH - half,
      PATH_HEIGHT,
      y * GRID_SIZE_PATH - half
  )
}
/*#endregion*/

/*#region ================== ROUTING ================== */
function startRouting() {
  clearRouting()
}
function cancelRouting() {
  clearRouting()
  emit('delete')
}
function clearRouting() {
  if (startPoint) scene.remove(startPoint.mesh)
  if (endPoint) scene.remove(endPoint.mesh)
  if (line) scene.remove(line)
  startPoint = null
  endPoint = null
  line = null
}
function onClickRoutingMode(e: MouseEvent) {
  if (!props.routing) return
  updateMouse(e)
  raycaster.setFromCamera(mouse, camera)

  // 🔹 قبل از انتخاب مبدا، تمام غرفه‌ها را از حالت انتخاب خارج کن
  if (!startPoint) {
    polygons.forEach(p => p.selected = false)
  }

  // 🔹 بررسی برخورد با غرفه‌ها
  const boothPolygons = polygons.filter(p => p.type === 'booth' && p.mesh)
  const intersects = raycaster.intersectObjects(boothPolygons.map(p => p.mesh))
  let p: THREE.Vector3 | null = null

  if (intersects.length > 0) {
    const mesh = intersects[0].object
    const poly = boothPolygons.find(p => p.mesh === mesh)!

    // 🔹 اگر بین انتخاب مبدا و مقصد هستیم، غرفه را به‌عنوان نقطه مسیر انتخاب کن، بدون اینکه selected شود
    p = poly.points
        .reduce((a: THREE.Vector3, b: THREE.Vector3) => a.add(b), new THREE.Vector3())
        .multiplyScalar(1 / poly.points.length)
  } else {
    // روی زمین کلیک شد
    p = getGroundPoint(e)
  }

  if (!p) return

  // 🔹 تعیین start و end
  if (!startPoint) {
    startPoint = createPoint(p, 0x00ff00, 'start')
  } else if (!endPoint) {
    endPoint = createPoint(p, 0x0000ff, 'end')
    drawLine()
    emit('endRouting', { start: startPoint.pos, end: endPoint.pos })
  }
}
function createPoint(pos: THREE.Vector3, color: number, type: string) {
  const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.5),
      new THREE.MeshBasicMaterial({ color })
  )
  mesh.position.copy(pos)
  scene.add(mesh)
  return { mesh, pos: pos.clone(), type }
}
function lineIntersectsPolygon(start: THREE.Vector3, end: THREE.Vector3, poly: any) {
  const s = { x: start.x, z: start.z }
  const e = { x: end.x, z: end.z }

  const pts = poly.points.map((p: THREE.Vector3) => ({ x: p.x, z: p.z }))
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]

    if (segmentsIntersect(s, e, a, b)) {
      return true
    }
  }
  return false
}
function segmentsIntersect(p1: any, p2: any, q1: any, q2: any) {
  function ccw(a: any, b: any, c: any) {
    return (c.z - a.z) * (b.x - a.x) > (b.z - a.z) * (c.x - a.x)
  }
  return (ccw(p1, q1, q2) !== ccw(p2, q1, q2)) && (ccw(p1, p2, q1) !== ccw(p1, p2, q2))
}
function smoothPath(path: number[][]): number[][] {
  if (path.length <= 2) return path

  const result = [path[0]]
  let last = path[0]

  for (let i = 1; i < path.length; i++) {
    const next = path[i]
    if (!hasLineOfSight(last, next)) {
      result.push(path[i - 1])
      last = path[i - 1]
    }
  }

  result.push(path[path.length - 1])
  return result
}
function hasLineOfSight(a: number[], b: number[]) {
  const x0 = a[0]
  const y0 = a[1]
  const x1 = b[0]
  const y1 = b[1]

  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)

  let sx = x0 < x1 ? 1 : -1
  let sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  let x = x0
  let y = y0

  while (true) {
    if (!pfGrid.isWalkableAt(x, y)) return false
    if (x === x1 && y === y1) break

    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx) { err += dx; y += sy }
  }

  return true
}
function drawLine() {
  if (!startPoint || !endPoint) return

  buildPathfindingGrid()

  const start = worldToGrid(startPoint.pos)
  const end = worldToGrid(endPoint.pos)

  const gridClone = pfGrid.clone()
  const path = finder.findPath(start.x, start.y, end.x, end.y, gridClone)
  if (!path.length) return

  const smooth = smoothPath(path)
  const worldPoints = smooth.map(p => gridToWorld(p[0], p[1]))

  // منحنی نرم
  pathCurve = new THREE.CatmullRomCurve3(worldPoints)
  const points = pathCurve.getPoints(200)

  const positions: number[] = []
  points.forEach(p => {
    positions.push(p.x, p.y, p.z)
  })

  // حذف قبلی
  if (animatedLine) scene.remove(animatedLine)
  if (glowLine) scene.remove(glowLine)
  if (movingDot) scene.remove(movingDot)
  if (arrowGroup) scene.remove(arrowGroup)

  // ---------- خط اصلی ----------
  const geometry = new LineGeometry()
  geometry.setPositions(positions)

  lineMaterial = new LineMaterial({
    color: 0xff0000,
    linewidth: 0.006, // ضخامت واقعی (در واحد world)
    transparent: true,
  })

  lineMaterial.resolution.set(window.innerWidth, window.innerHeight)

  animatedLine = new Line2(geometry, lineMaterial)
  animatedLine.computeLineDistances()
  scene.add(animatedLine)

  // ---------- Glow ----------
  const glowMaterial = new LineMaterial({
    color: 0xff4444,
    linewidth: 0.015,
    transparent: true,
    opacity: 0.25,
  })
  glowMaterial.resolution.set(window.innerWidth, window.innerHeight)

  const glowGeo = new LineGeometry()
  glowGeo.setPositions(positions)

  glowLine = new Line2(glowGeo, glowMaterial)
  scene.add(glowLine)

  // ---------- نقطه نورانی ----------
  const dotGeo = new THREE.SphereGeometry(0.8, 16, 16)
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffff00 })
  movingDot = new THREE.Mesh(dotGeo, dotMat)
  scene.add(movingDot)

  // ---------- فلش های متحرک ----------
  arrowGroup = new THREE.Group()
  const arrowGeo = new THREE.ConeGeometry(0.6, 1.8, 12)
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x000000 })

  for (let i = 0; i < 15; i++) {
    const arrow = new THREE.Mesh(arrowGeo, arrowMat)
    arrow.rotation.x = Math.PI / 2
    arrow.userData.offset = i / 15
    arrowGroup.add(arrow)
  }

  scene.add(arrowGroup)

  animationT = 0
}

/*#endregion*/

/*#region ================== GEOMETRY ================== */
function addPoint(poly: any, p: THREE.Vector3) {
  poly.points.push(p)

    const handle = new THREE.Mesh(
        new THREE.SphereGeometry(0.3),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
    )
    handle.position.copy(p)
    poly.handles.push(handle)
    scene.add(handle)

  redraw(poly)
}

function redraw(poly: any) {
  // --- حذف اشیاء قبلی از صحنه ---
  if (poly.line) scene.remove(poly.line)
  if (poly.mesh) scene.remove(poly.mesh)
  if (poly.label) scene.remove(poly.label)
  if (poly.roof) scene.remove(poly.roof)

  if (poly.border) {
    scene.remove(poly.border)
    poly.border.geometry.dispose()
    ;(poly.border.material as THREE.Material).dispose()
    poly.border = null
  }

  // Line (بسته)
  const pts = [...poly.points, poly.points[0]].map(p => new THREE.Vector3(p.x, 0.01, p.z))
  poly.line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x2563eb })
  )
  scene.add(poly.line)

  // Shape (در XY بدون rotate)
  const shapePts = poly.points.map((p: any) => new THREE.Vector2(p.x, p.z))
  const shape = new THREE.Shape(shapePts)

  // بررسی نوع پلیگون
  if (poly.type === 'booth') {
    // --- ۱. ساخت بدنه اصلی (Extrude) ---
    const depth = 2.5; // ارتفاع غرفه
    const extrudeSettings = {
      steps: 1,
      depth: depth,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.1,
      bevelSegments: 2
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    poly.mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: poly.color,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
    )
    poly.mesh.userData = {
      type: 'booth',
      id: poly.id,
      poly,
    }
    // تنظیمات بدنه
    poly.mesh.rotation.x = Math.PI / 2
    poly.mesh.position.y = depth
    scene.add(poly.mesh)

    //border
    const edgeColor = new THREE.Color(poly.color).multiplyScalar(0.6)
    const edges = new THREE.EdgesGeometry(geometry)
    const edgeLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
          color: edgeColor,
          linewidth: 2,
          transparent: true,   // ⬅️ اضافه
          opacity: OPACITY_NORMAL, // ⬅️ اضافه
        })
    )
    edgeLine.rotation.x = Math.PI / 2
    edgeLine.position.y = depth + 0.02
    scene.add(edgeLine)
    poly.border = edgeLine

    // --- ۲. ساخت سقف (لایه رنگی رویی) ---
    const roofGeometry = new THREE.ShapeGeometry(shape)
    const roofMaterial = new THREE.MeshBasicMaterial({
      color: poly.color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial)
    // تنظیمات سقف
    roofMesh.rotation.x = Math.PI / 2
    roofMesh.position.y = depth + 0.01
    poly.roof = roofMesh
    scene.add(poly.roof)
    drawLabel(poly)
  }
  else {
    // برای سایر موارد (مسطح)
    poly.mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({
          color: poly.color,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
    )
    poly.mesh.rotation.x = Math.PI / 2
    poly.mesh.position.y = 0.01
    scene.add(poly.mesh)
  }


}
/*#endregion*/

/*#region ================== 3D Model ================== */
type ModelPosition = {
  x: number
  y?: number
  z: number
  scale?: number
  rotationY?: number
}
function addModelsToScene(modelPath: string,positions: ModelPosition[]) {
  // اگر قبلاً لود شده → از cache
  if (modelCache.has(modelPath)) {
    const baseModel = modelCache.get(modelPath)!
    spawnClones(baseModel, positions)
    return
  }

  // لود مدل
  gltfLoader.load(modelPath, (gltf:any) => {
    const model = gltf.scene

    model.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })

    modelCache.set(modelPath, model)
    spawnClones(model, positions)
  })
}
function spawnClones(baseModel: THREE.Object3D,positions: ModelPosition[]) {
  positions.forEach(pos => {
    const clone = baseModel.clone(true)

    clone.position.set(
        pos.x,
        pos.y ?? 0,
        pos.z
    )

    const scale = pos.scale ?? 1
    clone.scale.set(scale, scale, scale)

    if (pos.rotationY !== undefined) {
      clone.rotation.y = pos.rotationY
    }

    scene.add(clone)
  })
}
/*#endregion*/

/*#region ================== LABEL ================== */
function drawLabel(poly: any) {
  if (!poly.points?.length) return

  // محاسبه مرکز
  const center = poly.points
      .reduce((a: THREE.Vector3, b: THREE.Vector3) => a.add(b), new THREE.Vector3())
      .multiplyScalar(1 / poly.points.length)

  // --- Title ---
  if (poly.label) {
    scene.remove(poly.label)
    poly.label.material.map?.dispose()
    poly.label.material.dispose()
  }

  poly.label = createSpriteText(poly.title, 28)
  poly.label.position.set(center.x, 3.8, center.z)
  scene.add(poly.label)

  // --- Booth Code ---
  if (poly.codeLabel) {
    scene.remove(poly.codeLabel)
    poly.codeLabel.material.map?.dispose()
    poly.codeLabel.material.dispose()
  }

  const codeText = poly.boothCode || `PAV-${poly.id}`
  poly.codeLabel = createSpriteText(codeText, 18)
  poly.codeLabel.position.set(center.x, 4.5, (center.z+4)) // ⬅️ زیر عنوان
  scene.add(poly.codeLabel)
}
function addText(text: string, position = new THREE.Vector3(0, 0.01, 0)) {
  const fontSize = 36
  const padding = 20
  const scaleFactor = 0.05

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  ctx.font = `${fontSize}px Estedad-FD-Bold`

  const metrics = ctx.measureText(text)
  const textWidth = Math.ceil(metrics.width)
  const textHeight = fontSize

  canvas.width = textWidth + padding * 2
  canvas.height = textHeight + padding * 2

  ctx.font = `${fontSize}px Estedad-FD-Bold`
  ctx.fillStyle = '#000'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()

  const geometry = new THREE.PlaneGeometry(
      canvas.width * scaleFactor,
      canvas.height * scaleFactor
  )

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  })

  const plane = new THREE.Mesh(geometry, material)

  // ⬇️ خواباندن روی زمین
  plane.rotation.x = -Math.PI / 2

  plane.position.copy(position)
  scene.add(plane)
}
function createSpriteText( text: string,  fontSize = 24,  padding = 16, scaleFactor = 0.05) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  ctx.font = `${fontSize}px Estedad-FD-Bold`
  const metrics = ctx.measureText(text)

  canvas.width = Math.ceil(metrics.width) + padding * 2
  canvas.height = fontSize + padding * 2

  ctx.font = `${fontSize}px Estedad-FD-Bold`
  ctx.fillStyle = '#000'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  })

  const sprite = new THREE.Sprite(material)
  sprite.scale.set(
      canvas.width * scaleFactor,
      canvas.height * scaleFactor,
      1
  )

  return sprite
}
/*#endregion*/

/*#region ================== Hover & Select ================== */
function handleBoothHover() {
  if (!lastMouseEvent) return
  if (lastMouseEvent.target !== renderer.domElement) return
  if (!lastMouseEvent) {
    document.body.style.cursor = 'default'
    hoveredBooth.value = null
    return
  }

  updateMouse(lastMouseEvent)
  raycaster.setFromCamera(mouse, camera)

  const boothPolygons = polygons.filter(
      p => p.type === 'booth' && p.mesh && p.roof && p.border
  )

  const boothMeshes = boothPolygons.map(p => p.mesh!)
  const intersects = raycaster.intersectObjects(boothMeshes, true)

  let hoveredPoly: EditorPolygon | null = null

  if (intersects.length > 0) {
    const obj = intersects[0].object

    hoveredPoly =
        boothPolygons.find(
            p => p.mesh === obj || p.mesh === obj.parent
        ) || null

    document.body.style.cursor = hoveredPoly ? 'pointer' : 'default'
  } else {
    document.body.style.cursor = 'default'
  }

  hoveredBooth.value = hoveredPoly

  boothPolygons.forEach(p => {
    const isSelected = selectedBooths.value.includes(p)
    const isHovered = p === hoveredPoly

    /* ---------- target Y ---------- */
    let targetY = BOOTH_NORMAL_Y
    if (isSelected) targetY = BOOTH_SELECTED_Y
    else if (isHovered) targetY = BOOTH_HOVER_Y

    /* ---------- target opacity ---------- */
    let targetOpacity = OPACITY_NORMAL
    if (selectedBooths.value.length) {
      targetOpacity = isSelected ? OPACITY_NORMAL : OPACITY_DIM
    } else if (isHovered) {
      targetOpacity = OPACITY_NORMAL
    }

    /* ---------- mesh + roof ---------- */
    ;[p.mesh, p.roof].forEach(obj => {
      if (!obj) return

      obj.position.y += (targetY - obj.position.y) * 0.12

      const materials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material]

      materials.forEach(mat => {
        if ('opacity' in mat) {
          mat.transparent = true
          mat.opacity += (targetOpacity - mat.opacity) * 0.12
        }
      })
    })

    /* ---------- border ---------- */
    if (p.border) {
      p.border.position.y +=
          (targetY + 0.02 - p.border.position.y) * 0.12

      const materials = Array.isArray(p.border.material)
          ? p.border.material
          : [p.border.material]

      materials.forEach(mat => {
        mat.transparent = true
        mat.opacity += (targetOpacity - mat.opacity) * 0.12
      })
    }

    /* ---------- labels ---------- */
      if (!p.label) return
      p.label.position.y += (targetY + 1 - p.label.position.y) * 0.12

    if (!p.codeLabel) return
    p.codeLabel.position.y += (targetY + 1 - p.codeLabel.position.y) * 0.1

  })
}
function selectBoothsById(ids: number[]) {
  // 1️⃣ انتخاب state
  selectedBooths.value = polygons.filter(
      p => p.type === 'booth' && (ids.includes(p.id) || ids.includes(p.hostID) || ids.includes(p.locationID))
  )
  const boothPolygons = polygons.filter(
      p => p.type === 'booth' && p.mesh && p.roof && p.border
  )

  // 2️⃣ اگر هیچ غرفه‌ای انتخاب نشده → reset
  if (!selectedBooths.value.length) {
    resetAllBoothsVisual()
    return
  }

  // 3️⃣ اعمال وضعیت
  boothPolygons.forEach(poly => {
    const isSelected = selectedBooths.value.includes(poly)

    if (isSelected) {
      applyBoothVisualState(poly, {
        targetY: BOOTH_SELECTED_Y,
        opacity: OPACITY_NORMAL,
      })
    } else {
      applyBoothVisualState(poly, {
        targetY: BOOTH_NORMAL_Y,
        opacity: OPACITY_DIM,
      })
    }
  })

  // 4️⃣ فوکوس دوربین (اختیاری)
  focusCameraOnBooths(selectedBooths.value)
  emit('selectBooth', selectedBooths.value)
}
function onClickScene(e: MouseEvent) {
  if (e.target !== renderer.domElement) return
  updateMouse(e)
  raycaster.setFromCamera(mouse, camera)

  const boothPolygons = polygons.filter(p => p.type === 'booth' && p.mesh)
  const intersects = raycaster.intersectObjects(boothPolygons.map(p => p.mesh))

  if (!intersects.length) {
    // کلیک روی فضای خالی → لغو انتخاب
    selectedBooths.value = []
    emit('selectBooth', [])
    return
  }

  const clickedMesh = intersects[0].object
  const clickedPoly = boothPolygons.find(p => p.mesh === clickedMesh)
  if (!clickedPoly) return

  const isSelected = selectedBooths.value.includes(clickedPoly)

  if (multiSelectEnabled.value) {
    // حالت چند انتخابی
    if (isSelected) {
      selectedBooths.value = selectedBooths.value.filter(p => p !== clickedPoly)
    } else {
      selectedBooths.value.push(clickedPoly)
      focusCameraOnBooths([clickedPoly])
    }
  } else {
    // حالت تک انتخابی
    selectedBooths.value = isSelected ? [] : [clickedPoly]
    if (!isSelected) focusCameraOnBooths([clickedPoly])
  }

  emit('selectBooth', selectedBooths.value)
}
function applyBoothVisualState(
    poly: EditorPolygon,
    options: {
      targetY: number
      opacity: number
    }
) {
  const { targetY, opacity } = options

      // mesh + roof
  ;[poly.mesh, poly.roof].forEach(obj => {
    if (!obj) return

    gsap.to(obj.position, {
      y: targetY,
      duration: 0.4,
      ease: 'power2.out',
    })

    const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material]

    materials.forEach(mat => {
      if ('opacity' in mat) {
        mat.transparent = true
        gsap.to(mat, {
          opacity,
          duration: 0.4,
          ease: 'power2.out',
        })
      }
    })
  })

  // border
  if (poly.border) {
    gsap.to(poly.border.position, {
      y: targetY + 0.02,
      duration: 0.4,
      ease: 'power2.out',
    })

    const mats = Array.isArray(poly.border.material)
        ? poly.border.material
        : [poly.border.material]

    mats.forEach(mat => {
      mat.transparent = true
      gsap.to(mat, {
        opacity,
        duration: 0.4,
        ease: 'power2.out',
      })
    })
  }

  // labels
  if (poly.label) {
    gsap.to(poly.label.position, {
      y: targetY + 1,
      duration: 0.4,
      ease: 'power2.out',
    })
  }

  if (poly.codeLabel) {
    gsap.to(poly.codeLabel.position, {
      y: targetY + 0.7,
      duration: 0.4,
      ease: 'power2.out',
    })
  }
}
function resetAllBoothsVisual() {
  const boothPolygons = polygons.filter(
      p => p.type === 'booth' && p.mesh && p.roof && p.border
  )

  boothPolygons.forEach(p => {
    applyBoothVisualState(p, {
      targetY: BOOTH_NORMAL_Y,
      opacity: OPACITY_NORMAL,
    })
  })
}
/*#endregion*/

/*#region ================== Select Booth From External ================== */

/*#endregion*/

/*#region ================== Animate ================== */
function animate() {

  requestAnimationFrame(animate)
  controls.update()

  const now = performance.now()
  if (now - lastMouseMoveTime > 50) { // هر 50ms یک بار
    handleBoothHover()
    lastMouseMoveTime = now
  }

  //#region line
// 🔥 Path Animation
  if (pathCurve && animatedLine && movingDot && arrowGroup) {

    animationT += 0.002   // سرعت حرکت کلی

    if (animationT > 1) animationT = 0

    // حرکت نقطه نورانی
    // const point = pathCurve.getPointAt(animationT)
    // movingDot.position.copy(point)

    // حرکت فلش‌ها
    arrowGroup.children.forEach((arrow: any) => {

      let t = (animationT + arrow.userData.offset) % 1
      const pos = pathCurve!.getPointAt(t)
      const tangent = pathCurve!.getTangentAt(t)

      const floatAmplitude = 3
      const floatSpeed = 7
      const heightOffset = 10  // فاصله از زمین (تنظیمی)

      arrow.position.set(
          pos.x,
          pos.y + heightOffset + Math.sin(performance.now() * 0.002 * floatSpeed + arrow.userData.offset * 10) * floatAmplitude,
          pos.z + 2
      )
      arrow.position.copy(pos)

      const axis = new THREE.Vector3(0, 1, 0)
      const quaternion = new THREE.Quaternion()
      quaternion.setFromUnitVectors(axis, tangent.clone().normalize())
      arrow.quaternion.copy(quaternion)
    })
  }
  //#endregion

  renderer.render(scene, camera)
}

window.addEventListener('mousemove', () => {
  lastMouseMoveTime = 0; // فوراً بروزرسانی
})
/*#endregion*/

/*#region ================== Camera Animate - Select Booth  ================== */
function focusCameraOnBooths(booths: EditorPolygon[]) {
  if (!booths.length) return

  const box = new THREE.Box3()
  booths.forEach(b => b.mesh && box.expandByObject(b.mesh))

  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  const maxDim = Math.max(size.x, size.z)
  const distance = maxDim * 1.8

  const targetPos = center.clone().add(
      new THREE.Vector3(distance, distance * 1.2, distance)
  )

  gsap.to(camera.position, {
    x: targetPos.x,
    y: targetPos.y,
    z: targetPos.z,
    duration: 0.5,
    ease: 'power2.out',
    onUpdate: () => camera.lookAt(center),
  })

  gsap.to(controls.target, {
    x: center.x,
    y: center.y,
    z: center.z,
    duration: 0.5,
  })
}
/*#endregion*/

/*#region ================== IMPORT / EXPORT ================== */

// تابع Export: تبدیل وضعیت فعلی به JSON
function exportScene() {
  const dataToSave = polygons.map(poly => ({
    id: poly.id,
    hostID: poly.hostID,
    locationID: poly.locationID,
    title: poly.title,
    boothCode: poly.boothCode,
    type: poly.type,
    color: poly.color,
    // تبدیل Vector3 به آبجکت ساده برای JSON
    points: poly.points.map((p: THREE.Vector3) => ({ x: p.x, y: p.y, z: p.z }))
  }))
  const jsonString = JSON.stringify(dataToSave)
  emit('export', dataToSave)
  return jsonString
}

// تابع Import: دریافت JSON و بازسازی صحنه
function importScene(data: any[]) {
  try {
    // ۱. پاک کردن صحنه فعلی
    // استفاده از حلقه معکوس برای جلوگیری از مشکل ایندکس‌ها هنگام splice
    for (let i = polygons.length - 1; i >= 0; i--) {
      removePolygon(polygons[i].id)
    }
    data.forEach((item: any) => {
      // ساخت آبجکت پلیگون
      const newPoly :any = {
        id: item.id,
        hostID: item.hostID,
        locationID: item.locationID,
        title: item.title,
        boothCode: item.boothCode,
        type: item.type,
        color: item.color,
        points: item.points.map((p: any) => new THREE.Vector3(p.x, p.y, p.z)),
        handles: [],
        line: null,
        mesh: null,
        label: null,
        roof: null,
      }

      // اضافه کردن به لیست
      polygons.push(newPoly)

      // رسم مجدد (که شامل ساخت مش، خط و سقف می‌شود)
      redraw(newPoly)

      // ساخت دستگیره‌ها (Handles) برای ویرایش
      if (props.editMode){
      newPoly.points.forEach((p: THREE.Vector3) => {
        const handle :any = new THREE.Mesh(
            new THREE.SphereGeometry(0.3),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        )
        handle.position.copy(p)
        newPoly.handles.push(handle)
        scene.add(handle)
      })
        }
    })
    if (data.length > 0) {
      const maxId = Math.max(...data.map((p: any) => p.id))
      idCounter = maxId + 1
    }

    emit('update', polygons)

  } catch (error) {
    console.error('Error importing scene:', error)
  }
}

/*#endregion*/

/*#region ================== EXPOSE ================== */
defineExpose({
  startPolygon,
  finishPolygon,
  updatePolygon,
  removePolygon,
  exportScene,
  importScene,
  startRouting,
  cancelRouting,
  addImageToScene,
  selectBoothsById
})
/*#endregion*/
</script>