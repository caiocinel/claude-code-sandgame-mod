import { expect, test } from 'claude-code/testing'

const pane = {
  title: 'Sand',
  isFocused: false,
  bodyColumns: 40,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
}

test('/sand opens the pane', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  const answer = await $.command.run({ command: 'sand', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
  expect(answer.text).toContain('drop sand')
})

test('a click drops sand that falls to the floor', async $ => {
  const ui = await $.ui.mount({ plugin: 'sand-falling', surface: 'terminal', component: 'Pane', props: pane, requestId: 'sand' })
  await ui.resize({ in: 'sand', columns: 40, rows: 19 })
  expect(await ui.find({ type: 'Text', text: 'left: pour' })).toBeDefined()

  await ui.pointer({ in: 'sand', type: 'down', x: 20, y: 2, button: 'left' })
  await ui.pointer({ in: 'sand', type: 'up', x: 20, y: 2, button: 'left' })
  await ui.advance(3000)

  const texts = await ui.findAll({ type: 'Text', in: 'sand' })
  expect(texts.some(t => t.props.color !== '#000000' || t.props.backgroundColor !== '#000000')).toBe(true)
  await ui.unmount()
})

test('a big pane full of sand stays under the tree size limit', async $ => {
  const ui = await $.ui.mount({ plugin: 'sand-falling', surface: 'terminal', component: 'Pane', props: { ...pane, bodyColumns: 120, scroll: { offset: 0, bodyRows: 50 } }, requestId: 'sand' })
  await ui.resize({ in: 'sand', columns: 120, rows: 49 })
  for (let pass = 0; pass < 6; pass++) {
    await ui.pointer({ in: 'sand', type: 'down', x: 0, y: 0, button: 'left' })
    for (let x = 0; x < 120; x++) {
      await ui.pointer({ in: 'sand', type: 'move', x, y: 0, button: 'left' })
      await ui.advance(40)
    }
    await ui.pointer({ in: 'sand', type: 'up', x: 119, y: 0, button: 'left' })
  }
  await ui.advance(10000)
  const texts = await ui.findAll({ type: 'Text', in: 'sand' })
  expect(texts.length).toBeGreaterThan(49)
  await ui.unmount()
})

test('the toolbar switches to water', async $ => {
  const ui = await $.ui.mount({ plugin: 'sand-falling', surface: 'terminal', component: 'Pane', props: pane, requestId: 'sand' })
  await ui.resize({ in: 'sand', columns: 40, rows: 19 })
  await ui.pointer({ in: 'sand', type: 'down', x: 12, y: 0, button: 'left' })
  await ui.pointer({ in: 'sand', type: 'up', x: 12, y: 0, button: 'left' })
  await ui.pointer({ in: 'sand', type: 'down', x: 20, y: 3, button: 'left' })
  await ui.advance(200)
  await ui.pointer({ in: 'sand', type: 'up', x: 20, y: 3, button: 'left' })
  await ui.advance(3000)
  const texts = await ui.findAll({ type: 'Text', in: 'sand' })
  expect(texts.some(t => t.props.color === '#3a7bd5' || t.props.backgroundColor === '#3a7bd5')).toBe(true)
  expect(texts.some(t => t.props.color === '#d8b878' && /[▀▄█]/.test(t.text))).toBe(false)
  await ui.unmount()
})

test('fire burns a plant down to nothing', async $ => {
  const ui = await $.ui.mount({ plugin: 'sand-falling', surface: 'terminal', component: 'Pane', props: pane, requestId: 'sand' })
  await ui.resize({ in: 'sand', columns: 40, rows: 19 })
  await ui.key({ in: 'sand', key: '6' })
  for (let x = 5; x < 35; x++) {
    await ui.pointer({ in: 'sand', type: x === 5 ? 'down' : 'move', x, y: 15, button: 'left' })
    await ui.advance(40)
  }
  await ui.pointer({ in: 'sand', type: 'up', x: 34, y: 15, button: 'left' })
  const green = async () => (await ui.findAll({ type: 'Text', in: 'sand' })).some(t => t.props.color === '#3fa34d' && /[▀▄█]/.test(t.text))
  expect(await green()).toBe(true)

  await ui.key({ in: 'sand', key: '7' })
  await ui.pointer({ in: 'sand', type: 'down', x: 5, y: 14, button: 'left' })
  await ui.advance(200)
  await ui.pointer({ in: 'sand', type: 'up', x: 5, y: 14, button: 'left' })
  await ui.advance(20000)
  expect(await green()).toBe(false)
  await ui.unmount()
})

test('the wind leaves streaks in the air', async $ => {
  const ui = await $.ui.mount({ plugin: 'sand-falling', surface: 'terminal', component: 'Pane', props: pane, requestId: 'sand' })
  await ui.resize({ in: 'sand', columns: 40, rows: 19 })
  await ui.key({ in: 'sand', key: '8' })
  await ui.pointer({ in: 'sand', type: 'down', x: 10, y: 8, button: 'left' })
  for (let x = 11; x < 16; x++) {
    await ui.pointer({ in: 'sand', type: 'move', x, y: 8, button: 'left' })
    await ui.advance(40)
  }
  const texts = await ui.findAll({ type: 'Text', in: 'sand' })
  expect(texts.some(t => ['#3c5566', '#5d8299', '#9ad0ff'].includes(String(t.props.color)) && /[▀▄█]/.test(t.text))).toBe(true)
  await ui.pointer({ in: 'sand', type: 'up', x: 15, y: 8, button: 'left' })
  await ui.unmount()
})

test('the wind throws sand into the air', async $ => {
  const ui = await $.ui.mount({ plugin: 'sand-falling', surface: 'terminal', component: 'Pane', props: pane, requestId: 'sand' })
  await ui.resize({ in: 'sand', columns: 40, rows: 19 })
  for (let x = 2; x < 14; x++) {
    await ui.pointer({ in: 'sand', type: x === 2 ? 'down' : 'move', x, y: 17, button: 'left' })
    await ui.advance(40)
  }
  await ui.pointer({ in: 'sand', type: 'up', x: 13, y: 17, button: 'left' })
  await ui.advance(3000)
  await ui.key({ in: 'sand', key: '8' })
  for (let x = 2; x < 20; x++) {
    await ui.pointer({ in: 'sand', type: x === 2 ? 'down' : 'move', x, y: 17, button: 'left' })
    await ui.advance(40)
  }
  // Mid-gust, some sand flies well above the pile, which sat on the bottom rows.
  const rows = (await ui.findAll({ type: 'Box', in: 'sand' })).filter(b => b.props.flexDirection === 'row').slice(-18)
  const highest = rows.findIndex(r => JSON.stringify(r.children).includes('#d8b878') && /[▀▄█]/.test(JSON.stringify(r.children)))
  expect(highest).toBeGreaterThanOrEqual(0)
  expect(highest).toBeLessThan(11)
  await ui.pointer({ in: 'sand', type: 'up', x: 19, y: 17, button: 'left' })
  await ui.unmount()
})

test('] grows the brush and the toolbar shows the size', async $ => {
  const ui = await $.ui.mount({ plugin: 'sand-falling', surface: 'terminal', component: 'Pane', props: pane, requestId: 'sand' })
  await ui.resize({ in: 'sand', columns: 40, rows: 19 })
  expect(await ui.find({ type: 'Text', in: 'sand', text: ' 2 ' })).toBeDefined()
  for (let n = 0; n < 3; n++) await ui.key({ in: 'sand', key: ']' })
  expect(await ui.find({ type: 'Text', in: 'sand', text: ' 5 ' })).toBeDefined()
  await ui.pointer({ in: 'sand', type: 'down', x: 20, y: 5, button: 'left' })
  await ui.pointer({ in: 'sand', type: 'up', x: 20, y: 5, button: 'left' })
  const texts = await ui.findAll({ type: 'Text', in: 'sand' })
  const sand = texts.filter(t => t.props.color === '#d8b878').map(t => t.text.trim()).join('')
  expect(sand.length).toBeGreaterThan(6)
  await ui.unmount()
})
