import type { ClientModule } from 'claude-code'

// One grid of particles, two per terminal cell (upper and lower half block),
// under a toolbar that picks what the left button pours.

const EMPTY = 0
const SAND = 1
const WATER = 2
const OIL = 3
const LAVA = 4
const WALL = 5
const STONE = 6
const PLANT = 7
const FIRE = 8
const SMOKE = 9
const STEAM = 10
// A tool, not a particle: pushes what is under the pen along the drag.
const WIND = 100
// Toolbar buttons that change the brush size, not the tool.
const SMALLER = 101
const BIGGER = 102
const MAX_SIZE = 8

const COLORS = ['', '#d8b878', '#3a7bd5', '#8a6a2e', '#e0541b', '#8a8a8a', '#5c544c', '#3fa34d', '#ff8c1a', '#4a4a4a', '#c8d4e0']
const WIND_COLOR = '#9ad0ff'
// Gust streaks, bright to faint as they fade.
const GUST_COLORS = ['#3c5566', '#5d8299', '#9ad0ff']

const TOOLS = [
  { name: 'Sand', tool: SAND },
  { name: 'Water', tool: WATER },
  { name: 'Oil', tool: OIL },
  { name: 'Lava', tool: LAVA },
  { name: 'Wall', tool: WALL },
  { name: 'Plant', tool: PLANT },
  { name: 'Fire', tool: FIRE },
  { name: 'Wind', tool: WIND },
]

// How heavy each falling particle is: heavier sinks through lighter liquids.
const DENSITY: Record<number, number> = { [SAND]: 10, [LAVA]: 6, [WATER]: 5, [OIL]: 4 }

type Sim = {
  width: number
  height: number
  grid: Uint8Array
  // Frames left for fire, smoke and steam.
  life: Uint8Array
  moved: Uint8Array
  // Velocity of particles the wind threw, in cells per frame; 0 when not flying.
  vx: Float32Array
  vy: Float32Array
  tool: number
  // Brush radius in particles, 0 to MAX_SIZE; the eraser and wind scale off it.
  size: number
  pen: { x: number; y: number; erase: boolean } | null
  // The drag's direction, a unit vector smoothed over the last few moves.
  wind: [number, number]
  // Streaks the wind tool leaves in the air, drawn over empty cells only.
  // Each keeps the velocity it was born with.
  gusts: { x: number; y: number; vx: number; vy: number; life: number }[]
  air: Uint8Array
  idle: number
}

type State = { sim: Sim; frame: number }

// Frames with nothing changing before the loop stops redrawing.
const SETTLE_FRAMES = 50

// A Client's tree must serialize under 100000 characters; each run is a Text.
const MAX_RUNS = 600

const Sand: ClientModule<null, State> = (_props, surface) => {
  const { Box, Text } = surface.elements
  const bar = layout(surface.columns)
  const width = Math.max(1, surface.columns)
  const height = Math.max(2, (surface.rows - bar.rows) * 2)

  let state = surface.state
  // A sim kept from before a reload may lack newer fields: rebuild it.
  if (state === undefined || state.sim.width !== width || state.sim.height !== height || state.sim.size === undefined) {
    const sim = resize(state?.sim, width, height)
    state = { sim, frame: 0 }
    if (surface.state === undefined) start(surface, sim)
    surface.setState(state)
  }
  const { sim } = state

  const toolbar = []
  for (let row = 0; row < bar.rows; row++) {
    const texts = []
    for (const b of bar.buttons.filter(b => b.row === row)) {
      if (b.tool === SMALLER || b.tool === BIGGER) {
        if (b.tool === BIGGER) texts.push(<Text bold>{String(sim.size + 1).padStart(2, ' ').padEnd(3, ' ')}</Text>)
        else if (texts.length > 0) texts.push(<Text> </Text>)
        texts.push(<Text inverse>{b.label}</Text>)
        continue
      }
      const color = b.tool === WIND ? WIND_COLOR : COLORS[b.tool]
      const isOn = b.tool === sim.tool
      if (texts.length > 0) texts.push(<Text> </Text>)
      texts.push(
        <Text color={isOn ? '#000000' : color} backgroundColor={isOn ? color : undefined} bold={isOn}>
          {b.label}
        </Text>,
      )
    }
    toolbar.push(<Box flexDirection="row">{texts}</Box>)
  }

  // A run is one foreground and one background color (or the terminal's own),
  // drawn with block characters, so a run of one color and empty cells is a
  // single Text however ragged.
  let budget = MAX_RUNS
  const rows = []
  for (let row = 0; row * 2 < height; row++) {
    const texts = []
    let text = ''
    let fg = ''
    let bg = ''
    let isOpen = false
    for (let x = 0; x < width; x++) {
      const top = colorAt(sim, x, row * 2)
      const bottom = colorAt(sim, x, row * 2 + 1)
      // A run of only empty cells so far takes the first color it meets.
      if (isOpen && fg === '' && bg === '' && (top === '' || bottom === '' || top === bottom)) fg = top || bottom
      const fits = (c: string) => c === '' ? bg === '' : c === fg || c === bg
      // Out of budget, the rest of the row keeps its run and draws any
      // particle in it: the right shape, maybe the wrong color.
      if (!isOpen || (budget > 0 && !(fits(top) && fits(bottom)))) {
        if (isOpen) {
          texts.push(<Text color={fg || undefined} backgroundColor={bg || undefined}>{text}</Text>)
          budget--
        }
        const isPair = top !== '' && bottom !== '' && top !== bottom
        fg = isPair ? top : top || bottom
        bg = isPair ? bottom : ''
        text = ''
        isOpen = true
      }
      text += block(top !== '' && top !== bg, bottom !== '' && bottom !== bg)
    }
    texts.push(<Text color={fg || undefined} backgroundColor={bg || undefined}>{text}</Text>)
    rows.push(<Box flexDirection="row">{texts}</Box>)
  }
  return (
    <Box flexDirection="column">
      {toolbar}
      {rows}
    </Box>
  )
}

export default Sand

// Picks a block from whether the top and bottom half are filled.
function block(top: boolean, bottom: boolean): string {
  return top ? (bottom ? '█' : '▀') : bottom ? '▄' : ' '
}

function colorAt(sim: Sim, x: number, y: number): string {
  const i = y * sim.width + x
  const kind = sim.grid[i] ?? EMPTY
  if (kind === EMPTY) {
    const air = sim.air[i] ?? 0
    return air === 0 ? '' : GUST_COLORS[Math.min(GUST_COLORS.length, air) - 1] ?? ''
  }
  if (kind !== FIRE) return COLORS[kind] ?? ''
  const life = sim.life[i] ?? 0
  return life > 26 ? '#ffd23f' : life > 13 ? '#ff8c1a' : '#e8361d'
}

// The toolbar's buttons, wrapped to the region's width.
function layout(columns: number) {
  const buttons = []
  let row = 0
  let x = 0
  for (const [i, t] of TOOLS.entries()) {
    const label = ` ${i + 1} ${t.name} `
    if (x > 0 && x + label.length > columns) {
      row++
      x = 0
    }
    buttons.push({ ...t, label, row, from: x, to: x + label.length })
    x += label.length + 1
  }
  // The size control: ' - ', the size, ' + ', kept together on one row.
  if (x > 0 && x + 9 > columns) {
    row++
    x = 0
  }
  buttons.push({ name: '', tool: SMALLER, label: ' - ', row, from: x, to: x + 3 })
  buttons.push({ name: '', tool: BIGGER, label: ' + ', row, from: x + 6, to: x + 9 })
  return { buttons, rows: row + 1, size: { row, x: x + 3 } }
}

function start(surface: Parameters<typeof Sand>[1], sim: Sim): void {
  const live = () => surface.state?.sim ?? sim
  const redraw = () => {
    const now = surface.state
    surface.setState({ sim: now?.sim ?? sim, frame: (now?.frame ?? 0) + 1 })
  }
  const pick = (tool: number) => {
    const s = live()
    if (tool === SMALLER || tool === BIGGER) s.size = Math.max(0, Math.min(MAX_SIZE, s.size + (tool === BIGGER ? 1 : -1)))
    else s.tool = tool
    redraw()
  }
  const act = (s: Sim) => {
    if (s.tool === WIND && !s.pen?.erase) blow(s)
    else paint(s)
  }

  surface.onPointer(e => {
    const s = live()
    if (e.type === 'up' || e.type === 'leave' || e.button === undefined) {
      s.pen = null
      return
    }
    const bar = layout(surface.columns)
    if (e.y < bar.rows) {
      if (e.type !== 'down') return
      const button = bar.buttons.find(b => b.row === e.y && e.x >= b.from && e.x < b.to)
      if (button) pick(button.tool)
      return
    }
    const y = Math.max(0, e.fine ? Math.floor((e.fine.y - bar.rows) * 2) : (e.y - bar.rows) * 2)
    const moved = s.pen !== null && (e.x !== s.pen.x || y !== s.pen.y)
    if (s.pen && moved) steer(s, e.x - s.pen.x, y - s.pen.y)
    s.pen = { x: e.x, y, erase: e.button === 'right' }
    if (moved && s.tool === WIND && !s.pen.erase) gust(s)
    act(s)
    redraw()
  })

  surface.onKey(e => {
    const tool = TOOLS[Number(e.key) - 1]
    if (tool) pick(tool.tool)
    else if (e.key === '[' || e.key === '-') pick(SMALLER)
    else if (e.key === ']' || e.key === '+' || e.key === '=') pick(BIGGER)
    else if (e.key === 'c') {
      live().grid.fill(EMPTY)
      live().vx.fill(0)
      live().vy.fill(0)
      redraw()
    }
  })

  surface.every(40, () => {
    const s = live()
    if (s.pen) act(s)
    if (s.pen || s.idle < SETTLE_FRAMES) {
      step(s)
      redraw()
    }
  })
}

function resize(old: Sim | undefined, width: number, height: number): Sim {
  const grid = new Uint8Array(width * height)
  const life = new Uint8Array(width * height)
  if (old) {
    // Keep the pile sitting on the floor.
    const dy = height - old.height
    for (let y = 0; y < old.height; y++) {
      const ny = y + dy
      if (ny < 0 || ny >= height) continue
      for (let x = 0; x < Math.min(width, old.width); x++) {
        grid[ny * width + x] = old.grid[y * old.width + x] ?? EMPTY
        life[ny * width + x] = old.life?.[y * old.width + x] ?? 0
      }
    }
  }
  return {
    width,
    height,
    grid,
    life,
    moved: new Uint8Array(width * height),
    tool: old?.tool ?? SAND,
    size: old?.size ?? 1,
    pen: null,
    wind: old?.wind ?? [1, 0],
    gusts: [],
    air: new Uint8Array(width * height),
    vx: new Float32Array(width * height),
    vy: new Float32Array(width * height),
    idle: 0,
  }
}

function paint(sim: Sim): void {
  const pen = sim.pen
  if (pen === null) return
  const radius = pen.erase ? sim.size + 1 : sim.size
  const odds = sim.tool === WALL || sim.tool === PLANT ? 1 : 0.75
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const i = at(sim, pen.x + dx, pen.y + dy)
      if (i < 0 || dx * dx + dy * dy > radius * radius) continue
      if (pen.erase) sim.grid[i] = EMPTY
      else if (sim.grid[i] === EMPTY && Math.random() < odds) {
        sim.grid[i] = sim.tool
        sim.life[i] = sim.tool === FIRE ? fireLife() : 0
      }
    }
  }
  sim.idle = 0
}

// Pushes loose particles near the pen one cell along the drag, leading edge
// first so a clump moves together.
function blow(sim: Sim): void {
  const pen = sim.pen
  if (pen === null) return
  const [wx, wy] = sim.wind
  const radius = sim.size + 4
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const i = at(sim, pen.x + dx, pen.y + dy)
      if (i < 0 || dx * dx + dy * dy > radius * radius) continue
      const kind = sim.grid[i] ?? EMPTY
      if (kind === EMPTY || isSolid(kind) || Math.random() > 0.8) continue
      // Throws the particle along the drag, with some lift so piles take off.
      const speed = 2.5 + Math.random() * 2
      sim.vx[i] = wx * speed + (Math.random() - 0.5)
      sim.vy[i] = wy * speed - 2 - Math.random() * 2
    }
  }
  sim.idle = 0
}

function step(sim: Sim): void {
  const { width, height, grid, life, moved } = sim
  moved.fill(0)
  let changed = false

  const set = (i: number, kind: number, frames = 0) => {
    grid[i] = kind
    life[i] = frames
    moved[i] = 1
    changed = true
  }
  // Whether a falling particle of kind can take cell i's place.
  const sinks = (kind: number, i: number) => {
    if (i < 0) return false
    const t = grid[i] ?? EMPTY
    return isThin(t) || (isLiquid(t) && (DENSITY[t] ?? 0) < (DENSITY[kind] ?? 0))
  }
  const neighbors = (x: number, y: number) => {
    const out = []
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) out.push(at(sim, x + dx, y + dy))
    return out.filter(j => j >= 0)
  }

  for (let y = height - 1; y >= 0; y--) {
    const leftFirst = Math.random() < 0.5
    for (let n = 0; n < width; n++) {
      const x = leftFirst ? n : width - 1 - n
      const i = y * width + x
      const kind = grid[i] ?? EMPTY
      if (kind === EMPTY || moved[i] || kind === WALL || kind === STONE) continue
      if (sim.vx[i] !== 0 || sim.vy[i] !== 0) {
        fly(sim, x, y)
        changed = true
        continue
      }
      const dir = Math.random() < 0.5 ? -1 : 1
      const wobble = Math.floor(Math.random() * 3) - 1

      if (kind === PLANT) {
        // Drinks the water it touches, growing into it.
        const water = neighbors(x, y).find(j => grid[j] === WATER)
        if (water !== undefined && Math.random() < 0.04) set(water, PLANT)
        continue
      }

      if (kind === FIRE) {
        changed = true
        let isOut = false
        for (const j of neighbors(x, y)) {
          const t = grid[j]
          if (t === WATER) {
            set(j, STEAM, gasLife())
            set(i, EMPTY)
            isOut = true
            break
          }
          if ((t === PLANT && Math.random() < 0.15) || (t === OIL && Math.random() < 0.3)) set(j, FIRE, fireLife())
        }
        if (isOut) continue
        life[i] = Math.max(0, (life[i] ?? 0) - 1)
        if (life[i] === 0) {
          if (Math.random() < 0.4) set(i, SMOKE, gasLife())
          else set(i, EMPTY)
          continue
        }
        // Flames mostly cling to what burns; a few lick upward.
        const up = at(sim, x + wobble, y - 1)
        if (Math.random() < 0.1 && up >= 0 && grid[up] === EMPTY) swap(sim, i, up)
        continue
      }

      if (kind === SMOKE || kind === STEAM) {
        changed = true
        life[i] = Math.max(0, (life[i] ?? 0) - 1)
        if (life[i] === 0) {
          // Some steam rains back down.
          set(i, kind === STEAM && Math.random() < 0.3 ? WATER : EMPTY)
          continue
        }
        const up = at(sim, x + wobble, y - 1)
        if (up >= 0 && grid[up] === EMPTY) swap(sim, i, up)
        else {
          const side = at(sim, x + dir, y)
          if (side >= 0 && grid[side] === EMPTY) swap(sim, i, side)
        }
        continue
      }

      if (kind === LAVA) {
        let isCooled = false
        for (const j of neighbors(x, y)) {
          const t = grid[j]
          if (t === WATER) {
            set(j, STEAM, gasLife())
            set(i, STONE)
            isCooled = true
            break
          }
          if ((t === PLANT || t === OIL) && Math.random() < 0.1) set(j, FIRE, fireLife())
        }
        // Lava is thick: it moves about every other frame.
        if (isCooled || Math.random() < 0.5) continue
      }

      // Sand, water, oil and lava fall, then slide off what they land on.
      const below = at(sim, x, y + 1)
      if (sinks(kind, below)) {
        swap(sim, i, below)
        changed = true
        continue
      }
      let isSlid = false
      for (const d of [dir, -dir]) {
        const diagonal = at(sim, x + d, y + 1)
        if (sinks(kind, diagonal) && sinks(kind, at(sim, x + d, y))) {
          swap(sim, i, diagonal)
          changed = true
          isSlid = true
          break
        }
      }
      // Liquids level out. Not counted as change: water on a flat floor
      // would wander forever.
      if (isSlid || !isLiquid(kind)) continue
      for (const d of [dir, -dir]) {
        const side = at(sim, x + d, y)
        if (side >= 0 && isThin(grid[side] ?? EMPTY)) {
          swap(sim, i, side)
          break
        }
      }
    }
  }
  moveGusts(sim)
  if (sim.gusts.length > 0) changed = true
  sim.idle = changed ? 0 : sim.idle + 1
}

function at(sim: Sim, x: number, y: number): number {
  return x < 0 || y < 0 || x >= sim.width || y >= sim.height ? -1 : y * sim.width + x
}

function swap(sim: Sim, a: number, b: number): void {
  const { grid, life, moved } = sim
  const kind = grid[a] ?? EMPTY
  const frames = life[a] ?? 0
  grid[a] = grid[b] ?? EMPTY
  life[a] = life[b] ?? 0
  grid[b] = kind
  life[b] = frames
  const vx = sim.vx[a] ?? 0
  const vy = sim.vy[a] ?? 0
  sim.vx[a] = sim.vx[b] ?? 0
  sim.vy[a] = sim.vy[b] ?? 0
  sim.vx[b] = vx
  sim.vy[b] = vy
  moved[a] = 1
  moved[b] = 1
}

// Moves a thrown particle along its velocity until something blocks it, then
// slows it with drag and, unless it is a gas, gravity. Hitting something or
// slowing down lands it, and it falls and flows as usual again.
function fly(sim: Sim, x: number, y: number): void {
  const i = y * sim.width + x
  let vx = sim.vx[i] ?? 0
  let vy = sim.vy[i] ?? 0
  const kind = sim.grid[i] ?? EMPTY
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(vx), Math.abs(vy))))
  let to = i
  let isBlocked = false
  for (let k = 1; k <= steps; k++) {
    const next = at(sim, Math.round(x + (vx * k) / steps), Math.round(y + (vy * k) / steps))
    if (next < 0 || (next !== to && !isThin(sim.grid[next] ?? EMPTY))) {
      isBlocked = true
      break
    }
    to = next
  }
  const isGas = kind === SMOKE || kind === STEAM || kind === FIRE
  vx *= 0.9
  vy = vy * 0.9 + (isGas ? 0 : 0.25)
  if (isBlocked || Math.hypot(vx, vy) < 0.7) {
    vx = 0
    vy = 0
  }
  sim.vx[i] = vx
  sim.vy[i] = vy
  if (to !== i) swap(sim, i, to)
  else sim.moved[i] = 1
}

function isLiquid(kind: number): boolean {
  return kind === WATER || kind === OIL || kind === LAVA
}

function isSolid(kind: number): boolean {
  return kind === WALL || kind === STONE || kind === PLANT
}

// Empty, gas or fire: anything heavier passes through.
function isThin(kind: number): boolean {
  return kind === EMPTY || kind === SMOKE || kind === STEAM || kind === FIRE
}

function fireLife(): number {
  return 20 + Math.floor(Math.random() * 20)
}

function gasLife(): number {
  return 40 + Math.floor(Math.random() * 40)
}

// Turns the wind toward a drag step, so a curve bends it gradually.
function steer(sim: Sim, dx: number, dy: number): void {
  const len = Math.hypot(dx, dy)
  const x = sim.wind[0] * 0.5 + (dx / len) * 0.5
  const y = sim.wind[1] * 0.5 + (dy / len) * 0.5
  const norm = Math.hypot(x, y) || 1
  sim.wind = [x / norm, y / norm]
}

// Starts a couple of streaks near the pen, flying the way the drag goes now;
// only a moving pen makes them, and later drags never turn them.
function gust(sim: Sim): void {
  const pen = sim.pen
  if (pen === null) return
  const [wx, wy] = sim.wind
  for (let n = 0; n < 2; n++) {
    // Spread across the drag, not along it.
    const across = (Math.random() - 0.5) * (sim.size + 4) * 1.5
    const speed = 1.5 + Math.random()
    sim.gusts.push({
      x: pen.x - wy * across,
      y: pen.y + wx * across,
      vx: wx * speed,
      vy: wy * speed,
      life: 5 + Math.floor(Math.random() * 4),
    })
  }
  if (sim.gusts.length > 60) sim.gusts.splice(0, sim.gusts.length - 60)
}

// Flies each streak along its own velocity and paints its tail into air,
// three cells long, brightest at the head, dimming as it dies.
function moveGusts(sim: Sim): void {
  sim.air.fill(0)
  sim.gusts = sim.gusts.filter(g => --g.life > 0)
  for (const g of sim.gusts) {
    g.x += g.vx
    g.y += g.vy
    const len = Math.hypot(g.vx, g.vy) || 1
    const head = Math.min(3, g.life)
    for (let t = 0; t < 3; t++) {
      const i = at(sim, Math.round(g.x - (g.vx / len) * t), Math.round(g.y - (g.vy / len) * t))
      const shade = head - t
      if (i >= 0 && shade > 0) sim.air[i] = Math.max(sim.air[i] ?? 0, shade)
    }
  }
}
