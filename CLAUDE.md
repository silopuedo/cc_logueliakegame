# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-based Roguelike survival game ("蛋壳特工队") built with vanilla JavaScript (ES6+), HTML5 Canvas, and CSS3. Zero external dependencies — open in a browser and play.

## How to Run

```bash
# Option 1: Open directly (file:// — may have script loading issues in Chrome)
open index.html

# Option 2: Local HTTP server (recommended)
python -m http.server 8080
# then open http://localhost:8080
```

## Git

- Remote: `git@github.com:silopuedo/cc_logueliakegame.git`
- Branch: `master`

## Architecture

### Module Load Order (strict — defined by `<script>` tags in index.html)

Each file depends on globals declared by files loaded before it:

1. **`js/config.js`** — `const CFG` — All game numeric constants (player stats, enemy definitions, wave table, role configs, upgrade definitions)
2. **`js/utils.js`** — Math utilities (`dist`, `ang`, `rand`, `clamp`, etc.) + all DOM element references (canvas, HUD, menu screens, panels)
3. **`js/audio.js`** — Web Audio API sound engine (`sfx`, `SND` object with named sound effects)
4. **`js/entity.js`** — Entity factories (`createPlayer`, `initSingle/Survival/Cooperative`, `shoot`, `spawnGem`, `spawnParticles`, `floatText`) + shape drawing helpers (`drawCircle`, `drawEntity`, `drawProjShape`, etc.) + collision helper (`wallBlocks`)
5. **`js/game.js`** — Global game state (`players`, `enemies`, `projs`, `gameState`, `gameMode`, etc.) + `update(dt)` main loop + state machine (`enterMenu`, `enterPlaying`, `togglePause`, `gameOver`) + wave management + button event bindings
6. **`js/skills.js`** — `useSkill()` — Ice wall barrier, fire burst, steam explosion combo
7. **`js/upgrades.js`** — Upgrade panel flow (`showUpgradeSingle/Survival/Coop`, `applyUpg`)
8. **`js/renderer.js`** — `render()` — All Canvas drawing (painters algorithm: bg→walls→gems→enemies→projectiles→players→particles→UI) + `updateUI()` HUD updates + `buildUpgHtml()` upgrade display helper
9. **`js/input.js`** — Keyboard + touch event listeners, `getInputDir()` input abstraction
10. **`js/main.js`** — Entry point: `resize()`, `loop(ts)` (requestAnimationFrame), startup initialization

### Key Game Systems

| System | File | Design Pattern |
|--------|------|---------------|
| State machine | game.js | 5 states: menu → modeSelect → (roleSelect) → playing ⇄ paused → gameover |
| Game loop | main.js | requestAnimationFrame, dt-driven timing |
| Input | input.js | Unified abstraction (keyboard + touch → direction vector) |
| Rendering | renderer.js | Painter's algorithm, read-only (no mutation of game state) |
| Audio | audio.js | Web Audio API, lazy init, procedural synthesis (no audio files) |
| Skills | skills.js | Ice/fire with combo (steam explosion), composable |
| Upgrades | upgrades.js | 3 mode-specific upgrade rules (single/survival/cooperative) |
| Entities | entity.js | Factory functions, plain objects, no classes |

### Game Modes

- **Single**: 1 player, personal upgrades
- **Survival**: 2 players, independent upgrades
- **Cooperative**: 2 players (Ice Guardian + Fire Shooter), shared XP + role-specific upgrades + revive mechanic

### Difficulty Scaling

- Enemy stats scale with `gameTime` (`hp *= 1 + gameTime * .005`, `speed *= 1 + gameTime * .0015`)
- Waves defined in `CFG.waves` with increasing spawn rate
- XP required per level: `base * growthRate^(level-1)` (currently base=20, growth=1.35)
- Enemy XP also scales with time

### XP/Leveling Flow

1. Enemy death → `spawnGem(x, y, xpAmt)` adds to `gems[]`
2. Player proximity → magnet pull + pickup → `xp += xpGain`
3. `while (xp >= xpTo)` → level up → show upgrade choices → apply selection
4. `xpTo = Math.floor(20 * Math.pow(1.35, level - 1))`

### Shared Global State (declared in game.js)

- `players[]`, `enemies[]`, `projs[]`, `gems[]`, `parts[]`, `floatT[]`, `iceWalls[]`
- `gameState` ('menu'|'playing'|'paused'|'gameover'), `gameMode` ('single'|'survival'|'cooperative')
- `upgLvs` (flat `{id:level}` in single mode, nested `{playerIdx:{id:level}}` in multi)
- View-only in renderer.js + input.js, mutated in game.js update + entity.js
