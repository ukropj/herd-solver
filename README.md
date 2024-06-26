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

Solve specific (puzzle names need to be quoted)

```
npm run start -- '#5' '#12*'
```

Solve all starting from a specific puzzle

```
npm run start -- from '#10'
```

Normally, solution steps are only printed if a better than optimal path is found, to always print solution steps use `solutions` or `-s`` as a first argument, e.g.

```
npm run start -- solutions
npm run start -- solutions '#10' '#11*'
npm run start -- -s from '#10'
```

If you want to see a visual solution as well use `visual` or `-v`.

## Solution syntax

- `A▶` means that Shephard 'A' slides left ('A' is the top-left most one, the other one, if present, is 'B')
- `A↠` means that Shephard 'A' jumps left
- the info in parentheses is just suplementary info to note what pieces are now cevered (e.g. `(to W~A)`) or moved as well (e.g. `(& B~B & W~B)`)

## Input

Puzzles are loaded form `puzzles.txt`. Each puzzle entry has (in any order)

- a line starting with `#` containing the name/id of the puzzle
- a line starting with `pieces:` with starting pieces positions in format
  - `{type of piece}@{x},{y}`, available tyes are `B` (Shephard) and `W` (Sheep)
    - "herds" have types `WW` and `WWW` and all segments positions need to be specified eg. `WWW@1,2+1,3+2,3`
  - pieces are separated by any number of spaces
- optionally: a line starting with `walls:` containing pairs of tiles blocked by walls in format
  - `{x1},{y1}|{x2},{y2}`
  - walls are separated by any number of spaces
  - to add a wall at the edge of a puzzle (relevant for vertical page traversal) specify it as a wall between the top and bottom tile, e.g. `1,0|1,7` is a wall on top of the 2nd column of a standard height-8 puzzle.
- optionally: a line starting with `height:` containing a single number, how many tiles fit on the page vertically (relevant for page travesal). **Lowest** allowed height is 3. If not specified, it is assumed the puzzle height is 8.
- a line starting with `optimal:` containing a single number, the optimal number of steps
- optionally: a line starting with `fixed:` containing a single number, the fixed optimal number of steps
- optionally: a line starting with `~` containing a special flag
  - `~secret` - activates the secret jumping mechanic
- an **empty line** (or more) that signifies the end of the puzzle entry (not needed after the last puzzle)
- all other lines are parts of the puzzle plan, each character is one tile
  - space - unpassable tile
  - `.` - normal empty tile
  - `b` or `w` end tiles for Shepards and Sheep respectively
  - `o` - bump
  - `u` - hole
  - `+` - command tile

Notes

- `x` is 0-based horizontal position form left to right
- `y` is 0-based vertical position from top to bottom
- Horizontal page traversal is not supported.

### Tip

If you are using this to find the optimal number of steps, not just to verify it, inputting a too high `optimal:` may cause the program too run too long, if that happens, try a shorter one (or maybe the puzzle is just very hard).
