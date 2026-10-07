# claude-code-sandgame-mod

A Claude Code mod that opens a falling-sand sandbox in a side pane while a prompt runs.

## Elements

Sand, water, oil, lava, wall, plant, fire and wind. Fire leaves smoke, and lava or fire meeting water makes steam (lava also turns to stone).

## Controls

- **Left click / drag**: pour the selected element (wind: blow particles along the drag)
- **Right click / drag**: erase
- **1-8** or the toolbar: pick an element
- **[ ]** or the `- +` buttons: brush size
- **c**: clear

The pane opens on each prompt and closes when the turn ends. `/sand` opens it and keeps it open.

## Development

```sh
claude plugin validate .
claude plugin test .
```

Claude Code generates the type definitions in `.claude-plugin/types/` when it loads the mod.
