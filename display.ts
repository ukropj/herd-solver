import { generateWallHashes, toStr, wrapPos } from "./solver";
import { Piece, Pieces, Pos, Puzzle, State, TileKind } from "./types";

type Ctx = {
  hasCenter: boolean;
  hasLeftTop: boolean;

  hasLeft: boolean;
  hasLeftWall: boolean;
  hasLeftHerd: boolean;

  hasTop: boolean;
  hasTopWall: boolean;
  hasTopHerd: boolean;
};

const isVoid = (ch: string | undefined) => !ch || ch === " ";

const stack = (ch: string) => `\x1b[4m${ch}\x1b[0m`;
const black = (ch: string) => `\x1b[30m${ch}\x1b[0m`;

const bg = (ch: string) => ch; //`\x1b[47m${ch}\x1b[0m`;
const shephard = (ch: string) => `\x1b[1m\x1b[32m${ch}\x1b[0m`;
const bgShephard = (ch: string) => `\x1b[42m${ch}\x1b[0m`;
const sheep = (ch: string) => `\x1b[37m${ch}\x1b[0m`;
const bgSheep = (ch: string) => `\x1b[47m${ch}\x1b[0m`;
const red = (ch: string) => `\x1b[31m${ch}\x1b[0m`;

const getPieces = (pieces: Piece[], tile: TileKind) => {
  if (pieces.length === 0) return undefined;
  const kind = pieces[0].kind[0];

  let ch = "";
  switch (kind) {
    case "B":
      ch = shephard(pieces[0].letter);
      // ch = "\x1b[30m●\x1b[0m"; //"◯";
      break;
    case "W":
      ch = sheep("S");
      break;
  }
  if (pieces.length > 1) {
    ch = stack(ch);
  }

  switch (tile) {
    case "b":
      if (kind === "B") {
        return bgShephard(black(pieces[0].letter));
      }
      return bgShephard(ch);
    case "w":
      if (kind === "W") {
        return bgSheep(black("S"));
      }
      // if (kind === "W") return bgSheep("\x1b[7m□\x1b[0m"); // ◯
      return bgSheep(ch);
    default:
      return bg(ch);
  }
};

const getTileContent = (tile: TileKind) => {
  switch (tile) {
    case " ":
    case ".":
      return bg(" ");
    case "+":
      return bg("\x1b[34m+\x1b[0m");
    case "b":
      return bgShephard(" ");
    case "w":
      return bgSheep(" ");
    case "o":
      return bg("\x1b[90m▲\x1b[0m");
    case "u":
      return bg(red("×")); //"▢";
    default:
      return tile;
  }
};
const getTileSideContent = (tile: TileKind) => {
  switch (tile) {
    case "b":
      return bgShephard(" ");
    case "w":
      return bgSheep(" ");
    default:
      return bg(" ");
  }
};

const getTopLeftCorner = ({ hasCenter, hasLeft, hasTop, hasLeftTop }: Ctx) => {
  const n = hasTop || hasLeftTop;
  const s = hasLeft || hasCenter;
  const w = hasLeft || hasLeftTop;
  const e = hasTop || hasCenter;
  if (!n && !s && !w && !e) return " ";
  if (n && s && w && e) return "┼";

  if (n) {
    if (w) {
      if (e) return "┴";
      if (s) return "┤";
      return "┘";
    }
    if (e) {
      if (s) return "├";
      return "└";
    }
  }
  if (w) {
    if (e) return "┬";
    return "┐";
  }
  return "┌";
};

const getTop = (
  { hasCenter, hasTop, hasTopWall, hasTopHerd }: Ctx,
  isSide?: boolean
) => {
  if (!hasCenter && !hasTop) return " ";
  if (hasTopWall) {
    return red(hasTopHerd && !isSide ? "╪" : "═");
  } else {
    return hasTopHerd && !isSide ? "╂" : "─";
  }
};
const getLeft = ({ hasCenter, hasLeft, hasLeftWall, hasLeftHerd }: Ctx) => {
  if (!hasCenter && !hasLeft) return " ";
  if (hasLeftWall) {
    return red(hasLeftHerd ? "╫" : "║");
  } else {
    return hasLeftHerd ? "┿" : "│";
  }
};

const getTileChars = (tile: TileKind, pieces: Piece[], ctx: Ctx) => {
  const top = bg(getTop(ctx));
  const topSide = bg(getTop(ctx, true));
  const center = getPieces(pieces, tile) ?? getTileContent(tile);
  const cneteSide = getTileSideContent(tile);
  const chs = [
    [bg(getTopLeftCorner(ctx)), topSide, top, topSide],
    [bg(getLeft(ctx)), cneteSide, center, cneteSide],
    // [getLeft(ctx), content, content],
  ];
  return chs;
};

const MIN_STATE_WIDTH = 20;

const getStatesPerRow = (stateWidth: number) =>
  Math.max(1, Math.floor(120 / stateWidth));

export const render = (puzzle: Puzzle, state?: State) => {
  if (!state) {
    state = {
      step: 0,
      pieces: puzzle.pieces,
      piecesArr: Object.values(puzzle.pieces),
      actions: [],
      prevState: undefined,
    };
  }

  const walls = generateWallHashes(puzzle);

  const states: { state: State; render: string[][] }[] = [];
  do {
    states.unshift({ state, render: renderState(puzzle, state, walls) });
    state = state?.prevState;
  } while (state?.prevState);

  let chars: string[][] = [[]];
  const stateWidth = Math.max(MIN_STATE_WIDTH, states[0].render[0].length);
  const statesPerRow = getStatesPerRow(stateWidth);

  states.forEach(({ state, render }, i) => {
    render.forEach((chs, i) => {
      if (!chars[i + 1]) chars[i + 1] = [];
      chars[i + 1].push(...chs);
      if (chs.length < MIN_STATE_WIDTH) {
        chars[i + 1].push("".padEnd(MIN_STATE_WIDTH - chs.length, " "));
      }
    });
    const step =
      state.step === 0
        ? "Start"
        : `${state.step}. ${state.actions[state.actions.length - 1]}`;
    chars[0].push(step.padEnd(stateWidth, " "));

    if ((i + 1) % statesPerRow === 0 || i === states.length - 1) {
      chars.forEach((chs) => {
        console.log(chs.join(""));
      });
      console.log();
      chars = [[]];
    }
  });
};

const isWall = (walls: string[][], p1: Pos, p2: Pos) =>
  walls.some(
    ([p1hash, p2hash]) => p1hash === p1.toString() && p2hash === p2.toString()
  );

const hasHerd = (tilePiecesArr: Piece[], allPieces: Pieces, [dx, dy]: Pos) => {
  const herd = tilePiecesArr.find(({ herdIds }) => herdIds != null);
  if (!herd) return false;

  const targetStr = toStr([herd.pos[0] + dx, herd.pos[1] + dy]);
  return (
    herd.herdIds?.some((id) => toStr(allPieces[id].pos) === targetStr) ?? false
  );
};

export const renderState = (
  puzzle: Puzzle,
  state: State,
  walls: string[][]
) => {
  const maxRowLength = puzzle.plan.reduce(
    (max, row) => Math.max(max, row.length),
    0
  );
  const plan = [
    ...puzzle.plan.map((row) => [
      ...row,
      ...new Array(maxRowLength + 1 - row.length).fill(" "),
    ]),
    new Array(maxRowLength + 1).fill(" "),
  ];

  return plan.flatMap((row, y) => {
    const chars: string[][] = [];
    row.forEach((tile, x) => {
      const pieces =
        state.piecesArr.filter(({ pos }) => pos[0] === x && pos[1] === y) ?? [];
      getTileChars(tile, pieces, {
        hasCenter: !isVoid(tile),
        hasLeftTop: x > 0 && y > 0 && !isVoid(plan[y - 1][x - 1]),
        hasLeft: x > 0 && !isVoid(row[x - 1]),
        hasLeftWall: isWall(walls, [x, y], wrapPos(puzzle, [x - 1, y])),
        hasLeftHerd: hasHerd(pieces, state.pieces, [-1, 0]),
        hasTop: y > 0 && !isVoid(plan[y - 1][x]),
        hasTopWall: isWall(walls, [x, y], wrapPos(puzzle, [x, y - 1])),
        hasTopHerd: hasHerd(pieces, state.pieces, [0, -1]),
      }).forEach((chs, i) => {
        if (!chars[i]) chars[i] = [];
        chars[i].push(...chs);
      });
    });
    return chars.filter((_chs, i) => !(y === plan.length - 1 && i > 0));
  });
};
