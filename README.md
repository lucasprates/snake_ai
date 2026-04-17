# Classic Snake (snake_ai)

Current version: `0.7.3`

Minimal browser-based Snake game built with vanilla JavaScript, HTML, and CSS. Features configurable AI opponents, sprite-based 2D visuals, and symmetric collision rules.

![Gameplay screenshot](screenshot.png)

## What It Includes

- Four difficulty modes: Easy (220ms), Medium (160ms), Hard (90ms), and Story (progressive speed from 160ms down to 60ms)
- Grid-based snake movement with dynamic tick loop via recursive setTimeout
- Food spawning on unoccupied cells
- Snake growth and score updates when food is eaten
- Pre-game setup to choose `0-5` AI rogue snakes and difficulty mode
- AI snakes that chase food using Manhattan distance, eat fruit, grow, die, and respawn after random delays
- AI snakes spawn from random corners and emerge from the wall over initial ticks
- Active AI snakes resolve movement from the same board snapshot, keeping head-on collisions symmetric
- Swipe input only locks once a direction change is accepted, so a bad first swipe can still be corrected mid-gesture
- AI spawn and respawn timers now resolve on the exact tick where their delay reaches zero
- Symmetric collision rules for player/AI and AI/AI (same-cell head and head-swap collisions)
- Game-over modal includes AI count and difficulty selectors synced with the main setup
- Persistent best-score tracking per AI count and difficulty via localStorage (survives page reloads and server restarts)
- Best-scores panel with independent difficulty filter (Story/Easy/Medium/Hard), defaulting to the active run/setup difficulty on open
- Game over on wall collision, self collision, or rogue collision
- Win/end state when the board is fully filled
- Restart and pause/resume controls
- Mobile-compatible responsive UI for phone and tablet browsers, with a lighter touch-device render path
- Keyboard controls (`Arrow` keys + `WASD`), on-screen touch controls, and board swipe gestures
- 2D sprite visuals: green player snake, red/blue AI snake themes, animated food berry, and textured grass tiles

## Architecture

```
src/
  shared.js           Shared utilities (clampIntRange, clampRandom, toCellKey, cloneSnake, OPPOSITE_DIRECTIONS)
  difficultyConfig.js  Difficulty constants, tick speeds, and Story mode speed formula
  highScoreLogic.js    Per-difficulty score logic: normalization, migration, and updates
  gameLogic.js         Pure game state: movement, collisions, food, scoring
  rogueLogic.js        AI snake behavior: spawning, pathfinding, rogue collisions
  app.js               DOM rendering, event handling, game loop orchestration
  styles.css           Sprite rendering, layout, responsive design
  assets/              SVG sprites (player, rogue-red, rogue-blue, food, tiles)
```

- `gameLogic.js` and `rogueLogic.js` are pure logic with no DOM access, making them fully testable
- `app.js` orchestrates the game loop, wiring state updates to CSS-based sprite rendering
- State is immutable: all updates return new objects via spread

## Patch Notes

- `v0.7.3`: hardened best-score loading against data loss. `loadHighScoresByRogueCount` now recovers the legacy `snake_highScore` key when the main `snake_highScoresByAiCount` JSON is corrupt instead of silently resetting to zeros. After reading a legacy score, the migrated fallback is persisted into the new key and the legacy key is removed, so subsequent loads skip migration. `normalizeHighScores` now preserves well-formed scores for unknown difficulties or rogue counts, so version downgrades and difficulty-set trims don't drop records. Increased total coverage from 92 to 102 tests with regression coverage for each fix, plus new tests for `stepState` with null food and `advanceRogueLifecycle`'s `respawnFood` callback paths.
- `v0.7.2`: tightened per-tick collision checks for both the player snake and rogue snakes by replacing temporary body-slice scans with direct indexed loops, reducing unnecessary allocations in hot movement paths. Also removed a candidate render-path change that added avoidable per-frame array writes, so this release keeps the net performance change positive while preserving the current 92-test behavior.
- `v0.7.1`: improved runtime smoothness, especially on phones. Reduced board-render DOM churn by diffing overlay classes with cheaper indexed structures, optimized food respawn placement to avoid string-heavy board scans when fruit is eaten, and added a lighter coarse-pointer/mobile paint path that trims expensive tile and sprite effects under touch interaction. This keeps gameplay noticeably smoother while preserving the current 92-test behavior.
- `v0.7.0`: fixed three gameplay consistency issues. Swipe gestures no longer get consumed by invalid reverse inputs, so a later valid swipe in the same gesture still works. Rogue spawn and respawn timers now trigger on the exact countdown tick instead of one tick late. Active rogues now choose moves from the same board snapshot, restoring symmetric same-cell collision outcomes when multiple rogues contest the same target. Added three regression tests and increased total coverage from 89 to 92 tests.
- `v0.6.0`: added mobile swipe controls directly on the board (up/down/left/right) with low-latency direction detection on `touchmove`, unified direction handling across keyboard/buttons/swipe, and mobile-safe board touch behavior (`touch-action: none`). Updated docs for mobile compatibility and expanded app behavior coverage to 89 tests with swipe-specific assertions.
- `v0.5.3`: fixed `setDirection` to check `pendingDirection` instead of committed `direction` for reverse-prevention, improving responsiveness for rapid multi-key inputs at high tick speeds (Hard/Story). Expanded test coverage from 68 to 87 tests with new cases for `positionsEqual`, `isInsideBoard`, `createInitialState` defaults, single-segment reversal, all four movement directions, `normalizeHighScores`/`migrateHighScores` null inputs, `clampRandom`/`clampIntRange` Infinity edge cases, empty rogue arrays, and simultaneous multi-rogue collisions.
- `v0.5.2`: refreshed Best Scores UX with `Show/Close Best Scores` wording and a dedicated difficulty filter inside the panel that defaults to the active run/setup difficulty on open while remaining independent from game difficulty selection.
- `v0.5.1`: optimized food spawning by using a two-pass free-cell selection and an explicit occupied-cell set (snake + blocked positions), avoiding large temporary available-cell arrays.
- `v0.5.0`: optimized rogue movement occupancy checks by replacing per-rogue blocked-cell rebuilds with a shared per-tick occupancy map updated incrementally.
- `v0.4.2`: stopped scheduling idle game ticks while paused (and resumed scheduling on unpause), reducing unnecessary timer/render work.
- `v0.4.1`: locked run-specific difficulty and AI count at `Start Game` so tick speed and score persistence stay bound to the active run; prevented game-over score upsert from rerunning on setup edits; and clarified best-score HUD/modal text by including difficulty.
- `v0.4.0`: added four difficulty modes (Easy, Medium, Hard, Story) with per-difficulty high score tracking. Story mode progressively increases speed as you score. Replaced fixed `setInterval` with dynamic `setTimeout` chain for variable tick rates. Added legacy score migration.
- `v0.3.2`: internal refactoring and performance improvements — consolidated duplicate utilities (`toCellKey`, `clampIntRange`), eliminated redundant DOM rebuilds in score panel, and removed wasted idle-tick work.
- `v0.3.1`: added persistent per-AI best score tracking with localStorage, plus a “Best Scores by AI” panel toggle.
- `v0.3.0`: upgraded board rendering with 2D sprite visuals for player snake (green head/body/tail), AI snakes (red/blue themes), animated food, and textured background/frame styling.
- `v0.2.1`: fixed rogue spawn rendering edge case where emerging off-board segments could appear on the opposite side of the grid.
- `v0.2`: added symmetric AI collisions (player/rogue and rogue/rogue head-on and head-swap detection) and updated documentation.
- `v0.1`: initial release with configurable 0-5 AI rogue snakes and basic game mechanics.

## Tech Stack

- Plain JavaScript modules (`src/app.js`, `src/gameLogic.js`, `src/rogueLogic.js`, `src/shared.js`, `src/highScoreLogic.js`, `src/difficultyConfig.js`)
- HTML/CSS UI (`index.html`, `src/styles.css`)
- SVG sprite assets (`src/assets/`)
- Node built-in test runner (`node --test`)

No external runtime dependencies are required.

## Run Locally

Requirements:

- Node.js 18+ (for test runner and npm scripts)
- Python 3 (used by the dev server script)

Install and run:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:4173
```

## Controls

- Configure AI snakes: choose count (`0-5`) and difficulty (Easy/Medium/Hard/Story), then press `Start Game` / `Apply & Restart`
- At game over, change AI count or difficulty in modal and press `Play Again` to restart with new values
- Move: `Arrow Up/Down/Left/Right`, `W/A/S/D`, on-screen direction buttons, or swipe directly on the board
- Mobile compatibility: layout scales for small screens and supports direct board swipes
- Optional mouse controls on desktop: toggle `Show On-Screen Controls`
- View per-AI best-score table: toggle `Show Best Scores` / `Close Best Scores`, then choose panel difficulty from the dropdown
- Pause/Resume: `Space` or `Pause` button
- Restart: `R`, `Restart` button, or modal `Play Again`

## Scripts

- `npm run dev`: starts a static server on port `4173`
- `npm test`: runs tests in `tests/appBehavior.test.js`, `tests/gameLogic.test.js`, `tests/rogueLogic.test.js`, `tests/shared.test.js`, `tests/highScoreLogic.test.js`, and `tests/difficultyConfig.test.js`

## Test Coverage (Core Logic)

92 tests across six test files:

**App behavior** (`tests/appBehavior.test.js`):
- Run difficulty remains locked for active tick timing and HUD best label
- Run AI count remains locked during active gameplay
- Pausing stops scheduled ticks until resumed
- Scores panel difficulty mirrors active run on open but stays independent
- Game-over score summary does not change when modal setup selectors are edited
- Swipe input applies direction on `touchmove` (without waiting for `touchend`)
- Invalid reverse swipe keeps the gesture alive for a later valid swipe
- Touch movement below swipe threshold does not change direction
- One-tick initial rogue delays spawn on the next tick

**Shared utilities** (`tests/shared.test.js`):
- `clampIntRange` clamping, truncation, NaN, and Infinity handling
- `toCellKey` coordinate serialization
- `clampRandom` edge cases (NaN, negative, >= 1, Infinity, valid pass-through)
- `cloneSnake` deep copy independence
- `OPPOSITE_DIRECTIONS` mapping correctness

**Difficulty config** (`tests/difficultyConfig.test.js`):
- Fixed tick values for Easy, Medium, Hard
- Unknown difficulty fallback to Medium
- Story mode formula at boundaries (score 0, 3, 24, 27+)
- Story mode floor enforcement (60ms minimum)
- Negative score safety, delegation from `getTickMs`

**Score logic** (`tests/highScoreLogic.test.js`):
- Per-difficulty score map creation and normalization
- Normalization with null and non-object inputs
- Difficulty+AI-count-specific best retrieval
- Record update behavior (new record vs no change)
- Ordered row projection for the “Best Scores by AI” panel
- Legacy key migration (`”0”` → `”0:MEDIUM”`) and skip for already-migrated scores
- Migration with null input

**Game logic** (`tests/gameLogic.test.js`):
- Movement per tick in all four directions (UP, DOWN, LEFT, RIGHT)
- Growth + score increment when eating food
- Wall collision game-over
- Self collision game-over
- Filled-board end condition
- Reverse-direction input prevention via `pendingDirection`
- Rapid multi-key sequences allowed (RIGHT→UP→LEFT, UP→RIGHT→DOWN)
- Pause/resume toggling and game-over guard
- `stepState` no-op when paused or game over
- Direction input validation (invalid and duplicate inputs)
- Food placement on valid empty cells only (including full-board edge case)
- `positionsEqual` matching and non-matching coordinates
- `isInsideBoard` in-bounds and out-of-bounds positions
- `createInitialState` default grid, center snake, and initial values
- Single-segment snake reversal allowance

**Rogue AI** (`tests/rogueLogic.test.js`):
- Rogue snake spawn, movement, growth, and respawn behavior
- Rogue spawn returns null when all corners are occupied
- Rogue segment collection and filtering by ID
- Rogue segment collection with empty rogue array
- Rogue pathfinding with null food (random fallback)
- Rogue avoidance of other rogues' occupied cells
- Rogue/player and rogue/rogue collision outcomes (body-hit, same-cell head-on, and head-swap)
- Simultaneous contested-food rogue head-on collision regression
- Multiple rogues hitting player simultaneously

## Manual Verification Checklist

- Start game and verify snake moves continuously
- Choose different difficulty modes and verify speed difference is noticeable
- In Story mode, eat food and observe speed increasing in status bar
- Choose different AI counts (`0-5`) and verify they apply on Start
- Confirm keyboard controls respond as expected
- Confirm touch/on-screen controls work on small screens
- Confirm board swipe controls (up/down/left/right) work on mobile devices
- Eat food and verify snake length + score increase by 1
- Verify AI snakes chase food, can eat fruit, and respawn after dying
- Verify player head into rogue body causes game over
- Verify rogue head into player body kills rogue and player survives
- Verify player/rogue head-on and head-swap collisions defeat both
- Verify rogue/rogue head-on and head-swap collisions defeat both rogues
- Hit a wall and verify game-over modal appears
- Hit snake body and verify game-over modal appears
- Pause and resume without state corruption
- Restart from both button and modal and verify score resets
