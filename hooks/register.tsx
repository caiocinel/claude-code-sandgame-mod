import type { Register } from 'claude-code'

const PANE = 'sand'
const TITLE = 'Sand'

export const register: Register = on => {
  // Opened by /sand: stays open after the turn ends.
  let isPinned = false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sand', description: 'Open the falling-sand pane' })
    return next(e)
  })

  on('command.run', { command: 'sand' }, async $ => {
    isPinned = true
    const opened = await $.ui.open({ id: PANE, title: TITLE, columns: 64, rows: 20 })
    return { text: opened.isPlaced ? 'Click or drag in the pane to drop sand.' : 'Sand pane waits for a wider terminal.' }
  })

  on('prompt.submit', async ($, e, next) => {
    void $.ui.open({ id: PANE, title: TITLE, columns: 64, rows: 20 })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (!isPinned) await $.ui.close({ id: PANE })
    return next(e)
  })

  on('ui.close', { id: PANE }, ($, e, next) => {
    isPinned = false
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e, next) => {
    // Client takes the mouse on the terminal and desktop alone.
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    const { Box, Text, Client } = $.ui.resolve(e)
    const rows = Math.max(4, e.props.scroll.bodyRows - 1)

    return (
      <Box flexDirection="column">
        <Client key="sand" module="./sand.tsx" width={e.props.bodyColumns} height={rows} />
        <Text dimColor wrap="truncate-end">
          left: pour · right: erase · 1-8 pick · [ ] size · c clear
        </Text>
      </Box>
    )
  })
}
