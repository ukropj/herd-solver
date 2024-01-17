import { Piece, Pieces, PieceKind, Pos, Puzzle } from "./parser";

// const LOG = false;

// const log = (...args: any[]) => {
//   if (LOG) console.log(...args);
// };

type Dir = Readonly<[number, number, string, string]>;

type State = {
  readonly step: number;
  readonly pieces: Pieces;
  readonly piecesArr: Piece[];
  readonly actions: string[];
};

const VALID = /^[.bwoBW]$/;
const EMPTY = /^[.bw]$/;
const OCCUPIED = /^[oBW]$/;
const BUMP = /^o$/;

const DIRS: Dir[] = [
  [1, 0, "▶", "↠"],
  [0, 1, "▼", "↡"],
  [-1, 0, "◀", "↞"],
  [0, -1, "▲", "↟"],
] as const;

export const comparePieces = (p1: Piece, p2: Piece) =>
  p1.id.localeCompare(p2.id);

const stringify = (piecesArr: Piece[]) =>
  piecesArr
    .sort((p1: Piece, p2: Piece) => {
      if (p1.kind === p2.kind) {
        return p1.pos.join("").localeCompare(p2.pos.join(""));
      }
      return p1.kind.localeCompare(p2.kind);
    })
    .map(
      ({ kind, pos: [x, y], coveredById }) =>
        `${kind}:${coveredById ?? ""}:${x}:${y}`
    )
    .join(",");

const findEndTiles = ({ plan }: Puzzle) => {
  const endTiles: { kind: PieceKind; pos: Pos }[] = [];

  plan.forEach((row, y) => {
    row.forEach((kind, x) => {
      if (/^[bw]$/.test(kind)) {
        endTiles.push({
          kind: kind.toUpperCase() as PieceKind,
          pos: [x, y],
        });
      }
    });
  });
  return endTiles;
};

const generateWallHashes = ({ walls }: Puzzle) =>
  walls.flatMap(([from, to]) => [
    [from.toString(), to.toString()],
    [to.toString(), from.toString()],
  ]);

const add = ([x, y]: Pos, [dx, dy]: Pos | Dir): Pos => [x + dx, y + dy];

export const solvePuzzle = (puzzle: Puzzle) => {
  let solvedSteps = Infinity;
  const statesMap: Record<string, number> = {}; // pieces string to step

  // preprocess puzzle
  const endTiles = findEndTiles(puzzle);
  const walls = generateWallHashes(puzzle);

  const startState: State = {
    step: 0,
    pieces: puzzle.pieces,
    piecesArr: Object.values(puzzle.pieces),
    actions: [],
  };
  statesMap[stringify(startState.piecesArr)] = 0;

  const allowNewState = (hash: string, step: number) =>
    statesMap[hash] == null || statesMap[hash] > step;

  const getTopPieceInPlan = ([x, y]: Pos, piecesArr: Piece[]) =>
    piecesArr.find(
      ({ coveredById, pos: [px, py] }) => px === x && py === y && !coveredById
    );

  const getInPlan = ([x, y]: Pos, piecesArr?: Piece[]) =>
    (piecesArr ? getTopPieceInPlan([x, y], piecesArr) : null)?.kind ??
    puzzle.plan[y]?.[x] ??
    " ";

  const isSolved = ({ piecesArr }: State) =>
    endTiles.every((tile) =>
      piecesArr.some(
        ({ kind, coveredById, coversId, pos: [x, y] }) =>
          tile.kind === kind &&
          tile.pos[0] === x &&
          tile.pos[1] === y &&
          !coveredById &&
          !coversId
      )
    );

  const isWall = (p1: Pos, p2: Pos) =>
    walls.some(
      ([p1hash, p2hash]) => p1hash === p1.toString() && p2hash === p2.toString()
    );

  const canSlide = (from: Pos, dir: Dir, piecesArr: Piece[]) => {
    const to = add(from, dir);
    return !isWall(from, to) && EMPTY.test(getInPlan(to, piecesArr));
  };

  const canJump = (from: Pos, dir: Dir, piecesArr: Piece[]) => {
    const jumpOver = add(from, dir);
    const to = add(jumpOver, dir);
    return (
      !isWall(from, jumpOver) &&
      OCCUPIED.test(getInPlan(jumpOver, piecesArr)) &&
      !isWall(jumpOver, to) &&
      VALID.test(getInPlan(to))
    );
  };

  const moveSlide = (from: Pos, dir: Dir, piecesArr: Piece[]) => {
    let pos: Pos = [...from];
    while (canSlide(pos, dir, piecesArr)) {
      pos = add(pos, dir);
    }
    return pos;
  };

  const moveJump = (startPos: Pos, dir: Dir) => add(add(startPos, dir), dir);

  const getPiecesUnder = ({ coversId }: Piece, pieces: Pieces): Piece[] => {
    if (!coversId) {
      return [];
    }
    const pieceUnder = pieces[coversId];
    return [pieceUnder, ...getPiecesUnder(pieceUnder, pieces)];
  };

  const getPiecesAbove = ({ coveredById }: Piece, pieces: Pieces): Piece[] => {
    if (!coveredById) {
      return [];
    }
    const pieceAbove = pieces[coveredById];
    return [pieceAbove, ...getPiecesAbove(pieceAbove, pieces)];
  };

  const updateOtherPieces = (
    movedPiece: Piece,
    didJump: boolean,
    preMoveState: State
  ): Pieces => {
    const updated: Pieces = {};
    const origPiece = preMoveState.pieces[movedPiece.id];

    if (didJump) {
      // console.log(movedPiece.id, "jumped");
      const toUncoverId = origPiece.coversId;
      if (toUncoverId) {
        // console.log("  ", toUncoverId, "uncovered");
        updated[toUncoverId] = {
          ...preMoveState.pieces[toUncoverId],
          coveredById: undefined, // not covered any more
        };
      }
      const toCover = didJump
        ? getTopPieceInPlan(movedPiece.pos, preMoveState.piecesArr)
        : null;
      if (toCover) {
        // console.log("  ", toCover.id, "covered");
        updated[toCover.id] = {
          ...toCover,
          coveredById: movedPiece.id,
        };
      }
    } else {
      // console.log(movedPiece.id, "slid");
      getPiecesUnder(movedPiece, preMoveState.pieces).forEach((toMove) => {
        // console.log("  ", toMove.id, "slid too");
        updated[toMove.id] = {
          ...toMove,
          pos: movedPiece.pos,
        };
      });
    }

    getPiecesAbove(movedPiece, preMoveState.pieces).forEach((toMove) => {
      // console.log("  ", toMove.id, "moved on top of it");
      updated[toMove.id] = {
        ...toMove,
        pos: movedPiece.pos,
      };
    });

    return updated;
  };

  const buildAction = (
    movedPiece: Piece,
    didJump: boolean,
    dir: Dir,
    pieces: Pieces
  ) => {
    const under = getPiecesUnder(movedPiece, pieces).map(({ id }) => id);
    const above = getPiecesAbove(movedPiece, pieces).map(({ id }) => id);
    let supp = "";
    if (didJump) {
      if (above.length) {
        supp = `(with ${above.join(" & ")})`;
      }
      if (under.length) {
        supp = `(onto ${under.join(" & ")})`;
      }
    } else {
      const other = [...under, ...above];
      if (other.length) {
        supp = `(with ${other.join(" & ")})`;
      }
    }
    return `${movedPiece.letter}${didJump ? dir[3] : dir[2]}${supp}`;
  };

  const getNextStates = (state: State) => {
    const nextStates: State[] = [];
    // check every B piece (can move even if covered)
    state.piecesArr
      .filter(({ kind }) => kind === "B")
      .forEach((piece) => {
        const startPos = piece.pos;
        // check every cardinal direction
        DIRS.forEach((dir) => {
          let endPos: Pos | null = null;
          let didJump = false;

          // attempt slide
          if (
            !BUMP.test(getInPlan(startPos)) &&
            canSlide(startPos, dir, state.piecesArr)
          ) {
            endPos = moveSlide(startPos, dir, state.piecesArr);
          }
          // attempt jump
          else if (canJump(startPos, dir, state.piecesArr)) {
            endPos = moveJump(startPos, dir);
            didJump = true;
          }
          // console.log(buildAction(piece.letter, didJump, dir, piece.coversId));

          if (endPos) {
            const movedPiece = {
              ...piece,
              pos: endPos,
              coversId: !didJump
                ? piece.coversId
                : getTopPieceInPlan(endPos, state.piecesArr)?.id,
            };

            const newPieces = {
              ...state.pieces,
              [movedPiece.id]: movedPiece,
              ...updateOtherPieces(movedPiece, didJump, state),
            };

            const newState = {
              step: state.step + 1,
              pieces: newPieces,
              piecesArr: Object.values(newPieces),
              actions: [
                ...state.actions,
                buildAction(movedPiece, didJump, dir, newPieces),
              ],
            };
            const hash = stringify(newState.piecesArr);
            // console.log(hash);
            if (allowNewState(hash, newState.step)) {
              statesMap[hash] = newState.step;
              nextStates.push(newState);

              // console.log(
              //   newState.step,
              //   stringify(newState.piecesArr),
              //   newState.actions.join(" ")
              // );
              // console.log(states.length);
            }
          }
        });
      });
    return nextStates;
  };

  const evaluateNext = (state: State): State | null => {
    // if (solvedSteps < puzzle.optimal) {
    // already found a better solution
    // return null;
    // }
    if (
      state.step <= puzzle.optimal &&
      state.step < solvedSteps &&
      isSolved(state)
    ) {
      // console.log(state.step, state.actions.join(" "));
      // console.log(
      //   "states",
      //   Object.values(statesMap).length,
      //   "steps",
      //   state.step
      // );
      solvedSteps = state.step;
      return state;
    }

    if (state.step >= puzzle.optimal || state.step >= solvedSteps) return null;

    return getNextStates(state)
      .map(evaluateNext)
      .filter((state) => state != null)
      .sort((s1, s2) => (s1?.step ?? 100) - (s2?.step ?? 100))[0];
  };

  return evaluateNext(startState);
};

// 43680
