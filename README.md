# Herd solver

Solves the Herd puzles designed by Blaž Urban Gracar.

The main purpose is to validate optimal solutions before publishing the game.

## Running

Requires Node 18

Install (once)

```
npm i
```

Solve all

```
npm run start
```

Solve specific

```
npm run start -- '#5' '#12*'
```

Normally, solution steps are only printed if a better than optimal path is found, to always print solution steps use `solutions` as a first argument, e.g.

```
npm run start -- solutions '#10'
```

## Solution syntax

- `A▶` means that Shephard 'A' slides left ('A' is the top-left most one, the other one, if present, is 'B')
- `A↠` means that Shephard 'A' jumps left
- the info in parentheses is just suplementary info to note what pieces are now cevered (e.g. `(onto WhiteA)`) or moved as well (e.g. `(with BlackB & WhiteB)`)

## Input

Puzzles are loaded form `puzzles.txt`. Each puzzle entry has

- a line starting with `#` containing the name/id of the puzzle
- a line starting with `pieces:` with starting pieces positions in format
  - `{type of piece}@{x},{y}`, available tyes are `B` (Shephard) and `W` (Sheep)
    - "herds" have types `WW` and `WWW` and all segments positions need to be specified eg. `WWW@1,2+1,3+2,3`
  - pieces are separated by any number of spaces
- optionally: a line starting with `walls:` containing pairs of slaces blocked by walls in format
  - `{x1},{y1}|{x2},{y2}`
  - walls are separated by any number of spaces
- a line starting with `optimal:` containing a single number, the optimal number of steps
- optionally: a line starting with `fixed:` containing a single number, the fixed optimal number of steps
- an empty line that signifies the end of the puzle entry
- all other lines are parts of the puzzle plan, each character is one tile
  - space - unpassable tile
  - `.` - normal empty tile
  - `b` or `w` end tiles for Shepards and Sheep respectively
  - `o` - bump
  - `u` - hole

Notes

- `x` is 0-based horizontal position form left to right
- `y` is 0-based vertical position from top to down

### Tip

If you are using this to find the optimal number of steps, not just to verify it, inputting a too high `optimal:` may cause the program too run too long, if that happens, try a shorter one (or maybe the puzzle is just very hard).
