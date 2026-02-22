# Classic Snake (snake_ai)

Current version: `0.1`

Minimal browser-based Snake game built with vanilla JavaScript, HTML, and CSS.

## What It Includes

- Grid-based snake movement with fixed tick loop
- Food spawning on unoccupied cells
- Snake growth and score updates when food is eaten
- Game over on wall collision or self collision
- Win/end state when the board is fully filled
- Restart and pause/resume controls
- Keyboard controls (`Arrow` keys + `WASD`) and on-screen touch controls
- Basic game-over modal with restart action

## Tech Stack

- Plain JavaScript modules (`src/app.js`, `src/gameLogic.js`)
- HTML/CSS UI (`index.html`, `src/styles.css`)
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

- Move: `Arrow Up/Down/Left/Right` or `W/A/S/D`
- Pause/Resume: `Space` or `Pause` button
- Restart: `R`, `Restart` button, or modal `Play Again`

## Scripts

- `npm run dev`: starts a static server on port `4173`
- `npm test`: runs logic tests in `tests/gameLogic.test.js`

## Test Coverage (Core Logic)

Current tests cover:

- Movement per tick
- Growth + score increment when eating food
- Wall collision game-over
- Self collision game-over
- Filled-board end condition
- Reverse-direction input prevention
- Food placement on valid empty cells only

## Manual Verification Checklist

- Start game and verify snake moves continuously
- Confirm keyboard controls respond as expected
- Confirm touch/on-screen controls work on small screens
- Eat food and verify snake length + score increase by 1
- Hit a wall and verify game-over modal appears
- Hit snake body and verify game-over modal appears
- Pause and resume without state corruption
- Restart from both button and modal and verify score resets
