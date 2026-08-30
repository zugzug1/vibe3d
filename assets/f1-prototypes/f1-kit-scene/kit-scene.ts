/**
 * Compound F1 kit evaluation scene — a pit-straight diorama, not a GP.
 *
 * Overhead (looking down, +Z is the far end of the road):
 *
 *   END   stairs/bridge · armco/jersey/tecpro (runoff lives here)
 *   MID   ribbon + kerb/turf/gravel/fence the full length · sector gantry
 *   START grid / SF / lights · grandstands | verge | ribbon | pit wall | pit | garages
 *
 * Linear verge props (kerb, turf, gravel, drain, fence) run the full ribbon once.
 * Trackside furniture sits on the marshalling strip or in the stand gap — never
 * behind a grandstand. Every kit id appears at least once.
 */

import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  Object3D,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
} from 'three/webgpu'

import { GARAGE, GARAGE_BAY_PITCH, PIT_WALL, TOKEN, TRUCK, shade } from '../f1-kit-core/index.ts'
import { createModel as createTyre } from '../f1-tyre/model.ts'
import { createModel as createStack } from '../f1-tyre-stack/model.ts'
import { createModel as createReel } from '../f1-hose-reel/model.ts'
import { createModel as createPitBoard } from '../f1-pit-board/model.ts'
import { createModel as createPitGantry } from '../f1-pit-gantry/model.ts'
import { createModel as createLollipop } from '../f1-lollipop-board/model.ts'
import { createModel as createTyreGun } from '../f1-tyre-gun/model.ts'
import { createModel as createPitJack } from '../f1-pit-jack/model.ts'
import { createModel as createCabinet } from '../f1-tool-cabinet/model.ts'
import { createModel as createExtinguisher } from '../f1-fire-extinguisher/model.ts'
import { createModel as createGunRack } from '../f1-gun-rack/model.ts'
import { createModel as createCatchFence } from '../f1-catch-fence/model.ts'
import { createModel as createArmco } from '../f1-armco/model.ts'
import { createModel as createTyreBarrier } from '../f1-tyre-barrier/model.ts'
import { createModel as createTecpro } from '../f1-tecpro/model.ts'
import { createModel as createStartLights } from '../f1-start-lights/model.ts'
import { createModel as createKerb } from '../f1-kerb/model.ts'
import { createModel as createFloodlight } from '../f1-floodlight/model.ts'
import { createModel as createTimingPylon } from '../f1-timing-pylon/model.ts'
import { createModel as createBrakeMarker } from '../f1-brake-marker/model.ts'
import { createModel as createJumbotron } from '../f1-jumbotron/model.ts'
import { createModel as createMarshalPost } from '../f1-marshal-post/model.ts'
import { createModel as createStartGantry } from '../f1-start-gantry/model.ts'
import { createModel as createGrandstandBay } from '../f1-grandstand-bay/model.ts'
import { createModel as createOranjeCan } from '../f1-oranje-can/model.ts'
import { createModel as createConcreteWall } from '../f1-concrete-wall/model.ts'
import { createModel as createSausageKerb } from '../f1-sausage-kerb/model.ts'
import { createModel as createAstroturf } from '../f1-astroturf-strip/model.ts'
import { createModel as createJersey } from '../f1-jersey-barrier/model.ts'
import { createModel as createAccessGate } from '../f1-access-gate/model.ts'
import { createModel as createCrashCushion } from '../f1-crash-cushion/model.ts'
import { createModel as createGravelTrap } from '../f1-gravel-trap/model.ts'
import { createModel as createCrowdFence } from '../f1-crowd-fence/model.ts'
import { createModel as createMarkerPost } from '../f1-marker-post/model.ts'
import { createModel as createSlotDrain } from '../f1-slot-drain/model.ts'
import { createModel as createStairs } from '../f1-stairs/model.ts'
import { createModel as createCircuitSign } from '../f1-circuit-sign/model.ts'
import { createModel as createGridBox } from '../f1-grid-box/model.ts'
import { createModel as createStartFinishLine } from '../f1-start-finish-line/model.ts'
import { createModel as createFiaLightPanel } from '../f1-fia-light-panel/model.ts'
import { createModel as createChevronBoard } from '../f1-chevron-board/model.ts'
import { createModel as createCameraTower } from '../f1-camera-tower/model.ts'
import { createModel as createFoamMonitor } from '../f1-foam-monitor/model.ts'
import { createModel as createCctvMast } from '../f1-cctv-mast/model.ts'
import { createModel as createPaHorn } from '../f1-pa-horn/model.ts'
import { createModel as createGarageBox } from '../f1-garage-box/model.ts'
import { createModel as createPitWall } from '../f1-pit-wall/model.ts'
import { createModel as createRaceControl } from '../f1-race-control/model.ts'
import { createModel as createSpectatorBridge } from '../f1-spectator-bridge/model.ts'
import { createModel as createPodium } from '../f1-podium/model.ts'
import { createModel as createCone } from '../f1-cone/model.ts'
import { createModel as createBollard } from '../f1-bollard/model.ts'
import { createModel as createWeighbridge } from '../f1-weighbridge/model.ts'
import { createModel as createParcFerme } from '../f1-parc-ferme/model.ts'
import { createModel as createMedicalPost } from '../f1-medical-post/model.ts'
import { createModel as createGeneratorCabin } from '../f1-generator-cabin/model.ts'
import { createModel as createFlagPole } from '../f1-flag-pole/model.ts'
import { createModel as createCameraPlatform } from '../f1-camera-platform/model.ts'
import { createModel as createTunnelPortal } from '../f1-tunnel-portal/model.ts'
import { createModel as createSectorGantry } from '../f1-sector-gantry/model.ts'
import { createModel as createTrophyCup } from '../f1-trophy-cup/model.ts'
import { createModel as createChampagne } from '../f1-champagne/model.ts'
import { createModel as createIceBucket } from '../f1-ice-bucket/model.ts'
import { createModel as createTrophyTable } from '../f1-trophy-table/model.ts'
import { createModel as createInterviewBackdrop } from '../f1-interview-backdrop/model.ts'
import { createModel as createCooldownBoard } from '../f1-cooldown-board/model.ts'
import { createModel as createLedRibbon } from '../f1-led-ribbon/model.ts'
import { createModel as createSectorBoard } from '../f1-sector-board/model.ts'
import { createModel as createNameboard } from '../f1-nameboard/model.ts'
import { createModel as createServiceTruck } from '../f1-service-truck/model.ts'
import { createModel as createChequeredFlag } from '../f1-chequered-flag/model.ts'
import { createModel as createMotorhome } from '../f1-team-motorhome/model.ts'
import { createModel as createHotWheelsLoop } from '../hot-wheels-loop/model.ts'
import { createModel as createHotWheelsBanked } from '../hot-wheels-banked-turned/model.ts'

interface Live {
  readonly root: Group
  update(deltaSeconds: number): void
  dispose(): void
}

export interface F1KitScene {
  readonly root: Group
  update(deltaSeconds: number): void
  dispose(): void
}

/** Local +Z (doors, glass, seats) → world +X. */
const FACE_PIT = Math.PI / 2
/** Local +Z → world −X (spectator furniture looking at the ribbon). */
const FACE_SPEC = -Math.PI / 2
/** Local-X runs (kerbs, fences, walls) → world Z along the ribbon. */
const ALONG = Math.PI / 2

const RIBBON_W = 12
const RIBBON_HALF = RIBBON_W / 2
/** Racing surface is the 12 m ribbon: SF chequer and kerbs share that width. Pit apron is a lighter pad to the doors. */
const ROAD_W = RIBBON_W
const ROAD_X = 0
const ROAD_LEN = 220
const ROAD_Z = 20
const END_Z = 108
const SPAN = 22
const STAND_X = 22
const STAND_PITCH = 10
const DOOR_X = -(RIBBON_HALF + 1.2 + 14)
const APRON_W = Math.abs(DOOR_X) - ROAD_W / 2
const APRON_X = -(ROAD_W / 2 + APRON_W / 2)
const GARAGE_X = DOOR_X - GARAGE.depth / 2
const WALL_X = -(RIBBON_HALF + 0.6 + PIT_WALL.depth / 2)
const TOOL_X = DOOR_X + 0.55
const KERB_X = RIBBON_HALF - 0.4
const TURF_X = RIBBON_HALF + 1.0
const CATCH_X = RIBBON_HALF + 3.4
const GRAVEL_X = CATCH_X + 0.4 + 1.25
const CROWD_X = 18
/** Marshalling strip: between spec kerb and catch fence, in front of the stands. */
const EDGE_X = RIBBON_HALF + 2.35
const DRAIN_X = -(RIBBON_HALF - 0.9)
/** Two boxes per team garage — one boom + one pit-wall bay pair each. */
const TEAM_BAYS = 2
const TEAMS = [
  { numbers: ['1', '11'], legend: 'RBR', open: 1, primary: 0x1e5aff, accent: 0xffd200, platePaper: 0x050a2e, plateInk: 0xf5f7ff },
  { numbers: ['16', '55'], legend: 'FER', open: 0, primary: 0xe10600, accent: 0xffe014, platePaper: 0x1a0508, plateInk: 0xfff6e8 },
  { numbers: ['4', '81'], legend: 'MCL', open: 0, primary: 0xff8000, accent: 0x47c7fc, platePaper: 0x14110c, plateInk: 0xfff8f0 },
  { numbers: ['10', '43'], legend: 'CAD', open: 0, primary: 0x1a1a1a, accent: 0xf7c948, platePaper: 0x0a0a0a, plateInk: 0xf7c948 },
] as const
/** Clear break between team facades so the pair reads as one garage. */
const TEAM_GAP = 1.5
const TEAM_SPAN = TEAM_BAYS * GARAGE_BAY_PITCH
const GARAGE_SPAN = TEAMS.length * TEAM_SPAN + (TEAMS.length - 1) * TEAM_GAP
/** Stand block 1 occupies z −15…15; block 2 occupies z 39…69. Furniture goes in the gap. */
const GAP_Z = 27
/** Module counts for a single full-ribbon run (~ROAD_LEN). */
const KERB_MODULES = Math.max(2, Math.round(ROAD_LEN / 0.8))
const TURF_MODULES = Math.max(1, Math.round(ROAD_LEN / 1.0))
const GRAVEL_MODULES = Math.max(1, Math.round(ROAD_LEN / 2.5))
const DRAIN_MODULES = Math.max(1, Math.round(ROAD_LEN / 2.0))

export function createScene(): F1KitScene {
  const root = new Group()
  root.name = 'f1-kit-scene'
  const instances: Live[] = []
  const animated: Live[] = []
  const extras: Array<{ dispose: () => void }> = []

  const add = (instance: Live, x: number, z: number, yaw = 0, y = 0, animate = false): void => {
    instance.root.position.set(x, y, z)
    instance.root.rotation.y = yaw
    root.add(instance.root)
    instances.push(instance)
    if (animate) animated.push(instance)
  }

  const asphaltMat = new MeshStandardMaterial({
    name: 'f1-kit / scene asphalt',
    color: shade(TOKEN.GRAPHITE_800, 0.16),
    roughness: 0.92,
    metalness: 0,
  })
  const apronMat = new MeshStandardMaterial({
    name: 'f1-kit / scene apron',
    color: shade(TOKEN.GRAPHITE_800, 0.32),
    roughness: 0.94,
    metalness: 0,
  })
  const groundMat = new MeshStandardMaterial({
    name: 'f1-kit / scene ground',
    color: shade(TOKEN.DUST_300, -0.28),
    roughness: 0.96,
    metalness: 0,
  })
  const paintMat = new MeshStandardMaterial({
    name: 'f1-kit / scene pit paint',
    color: TOKEN.CYAN_400,
    roughness: 0.88,
    metalness: 0,
  })
  extras.push({
    dispose: () => {
      asphaltMat.dispose()
      apronMat.dispose()
      groundMat.dispose()
      paintMat.dispose()
    },
  })

  const ground = new Mesh(new PlaneGeometry(110, 220), groundMat)
  ground.name = 'scene-ground'
  ground.rotation.x = -Math.PI / 2
  ground.position.set(-16, -0.02, ROAD_Z)
  ground.receiveShadow = true
  root.add(ground)
  extras.push({ dispose: () => { ground.geometry.dispose() } })

  // Keep this *under* grid-box pads (top 6 mm) and SF chequer (top 8 mm).
  // At y=0.012 those tiles were buried and only the numbers poked through.
  const road = new Mesh(new PlaneGeometry(ROAD_W, ROAD_LEN), asphaltMat)
  road.name = 'scene-asphalt'
  road.rotation.x = -Math.PI / 2
  road.position.set(ROAD_X, 0.001, ROAD_Z)
  road.receiveShadow = true
  root.add(road)
  extras.push({ dispose: () => { road.geometry.dispose() } })

  const apron = new Mesh(new PlaneGeometry(APRON_W, ROAD_LEN), apronMat)
  apron.name = 'scene-pit-apron'
  apron.rotation.x = -Math.PI / 2
  apron.position.set(APRON_X, 0.001, ROAD_Z)
  apron.receiveShadow = true
  root.add(apron)
  extras.push({ dispose: () => { apron.geometry.dispose() } })

  const paint = new Mesh(new PlaneGeometry(2.2, GARAGE_SPAN + 8), paintMat)
  paint.name = 'scene-pit-paint'
  paint.rotation.x = -Math.PI / 2
  paint.position.set(-(RIBBON_HALF + 1.1), 0.003, 0)
  paint.receiveShadow = true
  root.add(paint)
  extras.push({ dispose: () => { paint.geometry.dispose() } })

  // START — grid, SF, lights over the boxes, not mid-straight.
  add(createGridBox({ index: 1, pad: false, width: RIBBON_W }), 0, -8)
  add(createGridBox({ index: 2, pad: false, width: RIBBON_W }), 0, 0)
  add(createGridBox({ index: 3, pad: false, width: RIBBON_W }), 0, 8)
  add(createStartFinishLine({ kind: 'SF', width: RIBBON_W }), 0, -16, 0)
  add(createStartGantry({ span: 16, height: 7.2 }), 0, -18)
  add(createStartLights({ lit: 5 }), 0, -14)
  add(createChequeredFlag({ waving: true, windXZ: [0.9, -0.4] }), RIBBON_HALF + 0.55, -16, -0.35, 0, true)

  // Verge — one full-ribbon run each (catch-fence style), no overlapping tiles.
  add(createKerb({ modules: KERB_MODULES }), KERB_X, ROAD_Z, ALONG)
  add(createKerb({ modules: KERB_MODULES }), -KERB_X, ROAD_Z, ALONG)
  add(createAstroturf({ modules: TURF_MODULES, pileStep: 0.22 }), TURF_X, ROAD_Z, ALONG)
  add(createGravelTrap({ modules: GRAVEL_MODULES, pebblesPerModule: 90 }), GRAVEL_X, ROAD_Z, ALONG)
  add(createSlotDrain({ modules: DRAIN_MODULES }), DRAIN_X, ROAD_Z, ALONG)
  add(createSausageKerb({ modules: 14 }), RIBBON_HALF + 0.3, -56, ALONG)
  add(createSausageKerb({ modules: 14 }), RIBBON_HALF + 0.3, 70, ALONG)
  // Pit-side turf only where the wall/trucks are not: before the garage and after it.
  add(createAstroturf({ modules: 40, pileStep: 0.22 }), -TURF_X, -52, ALONG)
  add(createAstroturf({ modules: 50, pileStep: 0.22 }), -TURF_X, 72, ALONG)

  // Pit (−X): 4 team double-garages (2 bays + 2 booms + branded pit wall each).
  let cursorZ = -GARAGE_SPAN / 2
  let openBayZ = 0
  let firstTeamZ = 0
  for (const [ti, team] of TEAMS.entries()) {
    const centerZ = cursorZ + TEAM_SPAN / 2
    if (ti === 0) firstTeamZ = centerZ
    const labels = [...team.numbers]
    add(
      createGarageBox({
        count: TEAM_BAYS,
        number: team.numbers[0],
        legend: team.legend,
        open: team.open,
      }),
      GARAGE_X,
      centerZ,
      FACE_PIT,
    )
    add(
      createPitWall({
        bays: TEAM_BAYS,
        labels,
        legend: team.legend,
        primary: team.primary,
        accent: team.accent,
        platePaper: team.platePaper,
        plateInk: team.plateInk,
        benches: true,
      }),
      WALL_X,
      centerZ,
      FACE_SPEC,
    )
    for (let j = 0; j < TEAM_BAYS; j++) {
      // Bay centre is the door centre — park the boom beside the opening, not through it.
      const doorZ = cursorZ + (j + 0.5) * GARAGE_BAY_PITCH
      const gantryZ = doorZ + GARAGE.door * 0.5 + 0.4
      add(createPitGantry({ span: 5, height: 4.0, bays: 4 }), DOOR_X + 0.4, gantryZ)
      if (j < team.open) openBayZ = doorZ
    }
    cursorZ += TEAM_SPAN + TEAM_GAP
  }
  add(createLollipop(), TOOL_X - 1.6, firstTeamZ - GARAGE_BAY_PITCH + 1.4)
  add(createPitBoard(), TOOL_X - 1.4, firstTeamZ - GARAGE_BAY_PITCH + 2.6)
  add(createStack(), TOOL_X, firstTeamZ - GARAGE_BAY_PITCH - 1.6)
  add(createGunRack(), TOOL_X, firstTeamZ)
  add(createCabinet(), TOOL_X, firstTeamZ + GARAGE_BAY_PITCH - 1.2)
  add(createReel(), TOOL_X, firstTeamZ + GARAGE_BAY_PITCH + 1.4)
  add(createTyre(), TOOL_X + 0.7, firstTeamZ - GARAGE_BAY_PITCH - 0.2)
  add(createTyreGun(), DOOR_X - 1.0, openBayZ - 0.7)
  add(createPitJack(), DOOR_X - 1.4, openBayZ)
  add(createExtinguisher(), TOOL_X + 0.45, firstTeamZ + GARAGE_BAY_PITCH + 0.2)

  // Spectator (+X): fence the full asphalt; two stand blocks with a dressed gap.
  add(createCatchFence({ length: 200, height: 5 }), CATCH_X, ROAD_Z, ALONG)
  add(createCrowdFence({ length: 200 }), CROWD_X, ROAD_Z, ALONG)
  add(createGrandstandBay({ rows: 6, width: 10 }), STAND_X, -2 * STAND_PITCH, FACE_SPEC)
  add(createGrandstandBay({ rows: 6, width: 10 }), STAND_X, -STAND_PITCH, FACE_SPEC)
  add(createGrandstandBay({ rows: 6, width: 10 }), STAND_X, 0, FACE_SPEC)
  add(createGrandstandBay({ rows: 6, width: 10 }), STAND_X, STAND_PITCH, FACE_SPEC)
  const stand2Z = 54
  add(createGrandstandBay({ rows: 6, width: 10 }), STAND_X, stand2Z - STAND_PITCH, FACE_SPEC)
  add(createGrandstandBay({ rows: 6, width: 10 }), STAND_X, stand2Z, FACE_SPEC)
  add(createGrandstandBay({ rows: 6, width: 10 }), STAND_X, stand2Z + STAND_PITCH, FACE_SPEC)
  const stand3Z = 90
  add(createGrandstandBay({ rows: 6, width: 10 }), STAND_X, stand3Z - STAND_PITCH, FACE_SPEC)
  add(createGrandstandBay({ rows: 6, width: 10 }), STAND_X, stand3Z, FACE_SPEC)
  add(createGrandstandBay({ rows: 6, width: 10 }), STAND_X, stand3Z + STAND_PITCH, FACE_SPEC)
  // Gap furniture sits on the walkway in front of the seats, not behind a roof.
  add(createJumbotron(), CROWD_X + 1, GAP_Z, FACE_SPEC)
  add(createCameraPlatform(), CROWD_X + 1, GAP_Z - 5, FACE_SPEC)
  add(createPaHorn(), CROWD_X + 1, GAP_Z + 5, FACE_SPEC)
  add(createLedRibbon({ length: 8 }), CROWD_X + 1, GAP_Z + 4, FACE_SPEC)
  add(createFloodlight({ height: 12 }), EDGE_X, -18)
  add(createFloodlight({ height: 12 }), EDGE_X, 74)
  add(createFlagPole({ height: 6 }), EDGE_X + 0.8, -21)

  // MID — one gantry over the road, no stairs.
  add(createSectorGantry({ span: 18, sector: 2 }), 0, 36)

  // Marshalling line on the catch-fence strip, in the open (start, gap, after stands).
  add(createFiaLightPanel(), EDGE_X, -24, FACE_SPEC)
  add(createSectorBoard({ sector: 1 }), EDGE_X, -20, FACE_SPEC)
  add(createTimingPylon(), EDGE_X, -12)
  add(createCctvMast(), EDGE_X, -6)
  add(createCircuitSign({ kind: 'DRS' }), EDGE_X, GAP_Z - 4, FACE_SPEC)
  add(createMarkerPost(), EDGE_X, GAP_Z + 6)
  add(createBrakeMarker({ distance: 100 }), EDGE_X, 78, FACE_SPEC)
  add(createMarshalPost({ number: '11', flag: 'yellow' }), EDGE_X, 84, FACE_SPEC)
  add(createOranjeCan({ lit: true }), EDGE_X + 1.6, 84, 0, 0, true)

  // END of the track — stairs next to the bridge, runoff barriers in the verge.
  add(createSpectatorBridge({ span: SPAN }), 0, END_Z)
  add(createStairs({ kind: 'flight', steps: 16, width: 1.4 }), SPAN / 2 + 2, END_Z + 2)
  add(createPitWall({
    bays: 2,
    labels: ['16', '55'],
    legend: 'FER',
    primary: 0xe10600,
    accent: 0xffe014,
    benches: true,
  }), WALL_X, END_Z, FACE_PIT)
  add(createNameboard(), WALL_X + 0.2, END_Z - GARAGE_BAY_PITCH, FACE_PIT)
  add(createArmco({ bays: 14 }), RIBBON_HALF + 0.55, END_Z - 14, ALONG)
  add(createCrashCushion({ fits: 'armco' }), RIBBON_HALF + 0.55, END_Z - 28, ALONG)
  add(createAccessGate({ fits: 'armco', width: 3 }), RIBBON_HALF + 0.55, END_Z, ALONG)
  add(createJersey({ modules: 8 }), GRAVEL_X, END_Z + 8, ALONG)
  add(createConcreteWall({ bays: 4 }), GRAVEL_X + 2.5, END_Z + 8, ALONG)
  add(createTecpro({ columns: 3, rows: 2 }), GRAVEL_X, END_Z + 16, ALONG)
  add(createTyreBarrier({ columns: 4, rows: 3, depth: 1 }), GRAVEL_X + 2.5, END_Z + 16, ALONG)
  add(createChevronBoard(), EDGE_X, END_Z - 8, 0.2)
  add(createCameraTower({ height: 8 }), EDGE_X, END_Z - 6)
  add(createFoamMonitor(), RIBBON_HALF + 1.4, END_Z - 14, 0.2)
  add(createCone(), -(RIBBON_HALF + 0.45), -22)
  add(createBollard(), -(RIBBON_HALF + 0.35), -26)
  // Paddock — same side of the track as the garages, on the +Z desert past the
  // garage column (toward the bridge / END). Not the −Z desert. Campus continues
  // the garage column; Hot Wheels is one street further −X behind that campus.
  const ROW_X = GARAGE_X
  const PARK_X = GARAGE_X - 22

  // Weigh / parc stay near the +Z end of the garage block.
  add(createWeighbridge(), ROW_X - 1, 30, FACE_PIT)
  add(createParcFerme(), ROW_X + 3, 30, FACE_PIT)

  // —— +Z desert (past garage column) — HQ + ceremony + generator ——
  add(createGeneratorCabin(), ROW_X - 1, 38, FACE_PIT)
  add(createMotorhome(), ROW_X, 50, FACE_PIT)
  add(createRaceControl(), ROW_X, 68, FACE_PIT)

  const tableTopY = 0.75 + 0.03
  const plazaZ = 84
  add(createPodium(), ROW_X - 1, plazaZ, Math.PI)
  add(createTrophyTable(), ROW_X - 1, plazaZ - 3.2)
  add(createTrophyCup(), ROW_X - 1, plazaZ - 3.2, 0, tableTopY)
  add(createChampagne(), ROW_X - 0.45, plazaZ - 3.2, 0, tableTopY)
  add(createIceBucket(), ROW_X - 1.55, plazaZ - 3.2, 0, tableTopY)
  add(createInterviewBackdrop(), ROW_X + 6, plazaZ, Math.PI)
  add(createCooldownBoard(), ROW_X + 4.5, plazaZ + 3, Math.PI)

  add(createMedicalPost(), ROW_X - 1, 96, FACE_PIT)
  add(createMarshalPost({ number: '22', flag: 'green' }), ROW_X - 1, 104, FACE_PIT)
  add(createTunnelPortal(), ROW_X - 2, 114, FACE_PIT)

  // Service trucks on the ribbon.
  const teamPitch = TRUCK.length + 1.8
  const teamRow = [
    { kind: 'box', paint: TOKEN.RED_500, legend: 'ROSSO', number: '16', paper: TOKEN.SHELL_050, ink: TOKEN.RED_500, accent: TOKEN.SHELL_050 },
    { kind: 'curtainside', paint: TOKEN.SHELL_200, legend: 'STEEL', number: '63', paper: TOKEN.SHELL_200, ink: TOKEN.GRAPHITE_800, accent: TOKEN.GRAPHITE_800 },
    { kind: 'reefer', paint: TOKEN.INK_900, legend: 'NAVY', number: '1', paper: TOKEN.SHELL_050, ink: TOKEN.INK_900, accent: TOKEN.AMBER_400 },
    { kind: 'box', paint: TOKEN.ORANGE_500, legend: 'CITRUS', number: '4', paper: TOKEN.ORANGE_500, ink: TOKEN.INK_950, accent: TOKEN.INK_950 },
    { kind: 'box', paint: TOKEN.GRAPHITE_800, legend: 'PAD', number: '44', paper: TOKEN.SHELL_050, ink: TOKEN.GRAPHITE_800, accent: TOKEN.AMBER_400 },
  ] as const
  for (let i = 0; i < teamRow.length; i++) {
    const spec = teamRow[i]!
    const teamTruck = createServiceTruck({
      kind: spec.kind,
      lamps: true,
      wheelRpm: 0,
      paint: spec.paint,
      legend: spec.legend,
      number: spec.number,
      paper: spec.paper,
      ink: spec.ink,
      accent: spec.accent,
    })
    teamTruck.setGround(ground)
    add(teamTruck, ROAD_X, (i - (teamRow.length - 1) / 2) * teamPitch, FACE_SPEC)
  }

  // Exhibition behind the +Z campus (further from the ribbon).
  add(createHotWheelsLoop({ radius: 4.5, straightLength: 6 }), PARK_X, 58, FACE_PIT)
  add(createHotWheelsBanked({ radius: 4, straightLength: 6 }), PARK_X, 78, FACE_PIT)

  // Flat verge / ground never need shadow casters — keep heroes casting.
  const noCast = /^(f1-kerb|f1-astroturf|f1-gravel|f1-slot-drain|f1-sausage-kerb|scene-)/
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    let node: Object3D | null = object
    while (node) {
      if (noCast.test(node.name)) {
        object.castShadow = false
        break
      }
      node = node.parent
    }
  })

  // Freeze static transforms; keep matrix updates on animated subtrees only.
  root.updateMatrixWorld(true)
  const liveNodes = new Set<Object3D>()
  for (const instance of animated) {
    instance.root.traverse((object) => {
      liveNodes.add(object)
    })
  }
  root.traverse((object) => {
    if (liveNodes.has(object)) return
    object.matrixAutoUpdate = false
  })

  return {
    root,
    update(deltaSeconds) {
      for (const instance of animated) instance.update(deltaSeconds)
    },
    dispose() {
      for (const instance of instances) instance.dispose()
      instances.length = 0
      animated.length = 0
      for (const extra of extras) extra.dispose()
      extras.length = 0
      root.clear()
      root.removeFromParent()
    },
  }
}

function lightScene(scene: Scene): void {
  scene.add(new HemisphereLight(0x91a4b0, 0x080b0f, 0.62))
  const key = new DirectionalLight(0xffeee0, 2.1)
  key.position.set(-40, 55, 30)
  scene.add(key)
  const fill = new DirectionalLight(0x83a8be, 0.5)
  fill.position.set(45, 18, 20)
  scene.add(fill)
}

function kitBeautyPreview(
  name: string,
  place: (camera: PerspectiveCamera) => Vector3,
  { aspect, time }: { aspect: number; time?: number },
) {
  const kit = createScene()
  const scene = new Scene()
  scene.name = 'f1-kit / circuit scene'
  scene.background = new Color(0x000000)
  scene.add(kit.root)
  lightScene(scene)

  const camera = new PerspectiveCamera(42, aspect > 0 ? aspect : 1, 0.5, 420)
  camera.name = name
  const focus = place(camera)
  camera.lookAt(focus)
  camera.updateProjectionMatrix()
  scene.add(camera)

  kit.update(time ?? 0.4)

  return {
    scene,
    root: kit.root,
    camera,
    update(deltaSeconds: number) {
      kit.update(deltaSeconds)
    },
    dispose() {
      scene.remove(kit.root)
      kit.dispose()
      scene.clear()
    },
  }
}

export function createPreview({ aspect, time }: { aspect: number; time?: number }) {
  return kitBeautyPreview('f1-kit / scene camera', (camera) => {
    // Eye-level on the apron between garages and pit wall — branded faces + benches in a row.
    camera.position.set(-11, 3.2, -42)
    return new Vector3(-11, 1.4, 8)
  }, { aspect, time })
}

/** 3/4 from the ribbon, framed on the 2×2 truck group. */
export function createAltPreview({ aspect, time }: { aspect: number; time?: number }) {
  return kitBeautyPreview('f1-kit / street camera', (camera) => {
    camera.fov = 40
    camera.position.set(5, 10, -10)
    return new Vector3(-6, 1.5, 8)
  }, { aspect, time })
}

/** True top-down plan of the diorama. +Z (end of track) is up. */
export function createOverheadPreview({ aspect, time }: { aspect: number; time?: number }) {
  const kit = createScene()
  const scene = new Scene()
  scene.name = 'f1-kit / circuit overhead'
  scene.background = new Color(0x000000)
  scene.add(kit.root)
  lightScene(scene)

  const ratio = aspect > 0 ? aspect : 16 / 9
  const halfH = 112
  const halfW = halfH * ratio
  const camera = new OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.5, 400)
  camera.name = 'f1-kit / overhead camera'
  camera.up.set(0, 0, 1)
  camera.position.set(ROAD_X, 160, ROAD_Z)
  camera.lookAt(ROAD_X, 0, ROAD_Z)
  camera.updateProjectionMatrix()
  scene.add(camera)

  kit.update(time ?? 0.4)

  return {
    scene,
    root: kit.root,
    camera,
    update(deltaSeconds: number) {
      kit.update(deltaSeconds)
    },
    dispose() {
      scene.remove(kit.root)
      kit.dispose()
      scene.clear()
    },
  }
}
