import { Piece, Pieces, Pos, Puzzle, TileKind } from "./parser";

const LOG = false;

type Dir = Readonly<[number, number, string, string]>;

type State = {
  readonly step: number;
  readonly pieces: Pieces;
  readonly piecesArr: Piece[];
  readonly actions: string[];
};

const BUMP = /^o$/;
const HOLE = /^u$/;
// const CAN_SLIDE_FROM = /^[.bw]$/;
const CAN_SLIDE_TO = /^[.bwu]$/;

const CAN_JUMP_FROM = /^[.bwoBW]$/;
const CAN_JUMP_OVER = /^[oBW]$/;
const CAN_JUMP_TO = /^[.bwouBW]$/;

const DIRS: Dir[] = [
  [1, 0, "▶", "↠"],
  [0, 1, "▼", "↡"],
  [-1, 0, "◀", "↞"],
  [0, -1, "▲", "↟"],
] as const;

export const comparePieces = (p1: Piece, p2: Piece) =>
  p1.id.localeCompare(p2.id);

const toStr = (pos?: Pos | null) => pos?.join(",") ?? "";

const stringify = (piecesArr: Piece[]) =>
  piecesArr
    .sort((p1: Piece, p2: Piece) => {
      if (p1.kind === p2.kind) {
        return toStr(p1.pos).localeCompare(toStr(p2.pos));
      }
      return p1.kind.localeCompare(p2.kind);
    })
    .map(
      ({ kind, pos, coveredById }) =>
        `${kind}:${coveredById ?? ""}:${toStr(pos)}`
    )
    .join(",");

const findEndTiles = ({ plan }: Puzzle) => {
  const endTiles: { kind: TileKind; pos: Pos }[] = [];

  plan.forEach((row, y) => {
    row.forEach((kind, x) => {
      if (/^[bw]$/.test(kind)) {
        endTiles.push({
          kind,
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

  const getTopPieceInPlan = (
    [x, y]: Pos,
    piecesArr: Piece[],
    ignoreIds?: string[]
  ) =>
    piecesArr.find(
      ({ id, coveredById, pos: [px, py] }) =>
        px === x &&
        py === y &&
        (!coveredById || (ignoreIds && ignoreIds.includes(coveredById))) &&
        (!ignoreIds || !ignoreIds.includes(id))
    );

  const getInPlan = ([x, y]: Pos, piecesArr?: Piece[], ignoreIds?: string[]) =>
    (piecesArr ? getTopPieceInPlan([x, y], piecesArr, ignoreIds) : null)
      ?.kind[0] ??
    puzzle.plan[y]?.[x] ??
    " ";

  const isSolved = ({ pieces, piecesArr }: State) =>
    endTiles.every((tile) =>
      piecesArr.some(
        ({ kind, coveredById, coversId, pos: [x, y], herdIds }) =>
          tile.kind === kind[0].toLowerCase() &&
          tile.pos[0] === x &&
          tile.pos[1] === y &&
          coveredById == null &&
          coversId == null &&
          (herdIds?.every((id) => pieces[id].coveredById == null) ?? true)
      )
    );

  const isWall = (p1: Pos, p2: Pos) =>
    walls.some(
      ([p1hash, p2hash]) => p1hash === p1.toString() && p2hash === p2.toString()
    );

  const canSlide = (
    from: Pos[],
    dir: Dir,
    piecesArr: Piece[],
    ignoreIds?: string[]
  ) => {
    const tiles = from.map((fromPos) => getInPlan(fromPos));
    if (
      tiles.every((tile) => HOLE.test(tile)) ||
      tiles.some((tile) => BUMP.test(tile))
    ) {
      return false; // pinned by a hole or a bump
    }

    return from.every((fromPos) => {
      const to = add(fromPos, dir);
      // check if a wall would "slice a moving herd"
      if (
        from.length > 1 &&
        from.some((otherPos) => isWall(add(otherPos, dir), to))
      ) {
        return false;
      }
      return (
        !isWall(fromPos, to) &&
        CAN_SLIDE_TO.test(getInPlan(to, piecesArr, ignoreIds))
      );
    });
  };

  const moveSlide = (
    from: Pos,
    dir: Dir,
    state: State,
    herdToCheck?: Piece[]
  ) => {
    let moved = false;
    let pos: Pos = from;
    let otherPoses = herdToCheck?.map(({ pos }) => pos);
    let ignoreIds = herdToCheck?.flatMap((herdPiece) => [
      herdPiece.id,
      ...getPiecesAbove(herdPiece, state.pieces).map(({ id }) => id),
    ]);
    let vector: Pos = [0, 0];
    while (canSlide(otherPoses ?? [pos], dir, state.piecesArr, ignoreIds)) {
      moved = true;
      vector = add(vector, dir);
      pos = add(pos, dir);
      otherPoses = otherPoses?.map((otherPos) => add(otherPos, dir));
    }
    return moved ? vector : null;
  };

  const canJump = (
    from: Pos,
    dir: Dir,
    piecesArr: Piece[],
    jumpingId: string
  ) => {
    if (!CAN_JUMP_FROM.test(getInPlan(from, piecesArr, [jumpingId])))
      return false;

    const jumpOver = add(from, dir);
    const to = add(jumpOver, dir);
    return (
      !isWall(from, jumpOver) &&
      CAN_JUMP_OVER.test(getInPlan(jumpOver, piecesArr)) &&
      !isWall(jumpOver, to) &&
      CAN_JUMP_TO.test(getInPlan(to))
    );
  };

  const moveJump = (startPos: Pos, dir: Dir, state: State, jumpingId: string) =>
    canJump(startPos, dir, state.piecesArr, jumpingId)
      ? add(add([0, 0], dir), dir)
      : null;

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

  const updatePieces = (
    mainPiece: Piece,
    vector: Pos,
    didJump: boolean,
    preMoveState: State,
    herd?: Piece[]
  ): Pieces => {
    LOG && console.log("---------------------------");
    const mainEndPos = add(mainPiece.pos, vector);

    const updated: Pieces = {
      [mainPiece.id]: {
        ...mainPiece,
        pos: mainEndPos,
        coversId: !didJump
          ? mainPiece.coversId
          : getTopPieceInPlan(mainEndPos, preMoveState.piecesArr)?.id,
      },
    };

    if (didJump) {
      LOG && console.log(mainPiece.id, "jumped to", toStr(mainEndPos));
      const toUncoverId = mainPiece.coversId;
      if (toUncoverId) {
        LOG &&
          console.log("  ", toUncoverId, "uncovered at", toStr(mainPiece.pos));

        updated[toUncoverId] = {
          ...preMoveState.pieces[toUncoverId],
          coveredById: undefined, // not covered any more
        };
      }
      const toCover = didJump
        ? getTopPieceInPlan(mainEndPos, preMoveState.piecesArr)
        : null;
      if (toCover) {
        LOG && console.log("  ", toCover.id, "covered at", toStr(mainEndPos));

        updated[toCover.id] = {
          ...toCover,
          coveredById: mainPiece.id,
        };
      }
    } else {
      LOG && console.log(mainPiece.id, "slid to", toStr(mainEndPos));
      getPiecesUnder(updated[mainPiece.id], preMoveState.pieces).forEach(
        (toMove) => {
          LOG && console.log("  ", toMove.id, "slid too to", toStr(mainEndPos));

          updated[toMove.id] = {
            ...toMove,
            pos: mainEndPos,
          };
        }
      );
      if (herd) {
        herd.forEach((herdPiece) => {
          if (updated[herdPiece.id]) return; // already updated

          LOG &&
            console.log(
              "  ",
              herdPiece.id,
              "slid too as part of the herd to",
              toStr(add(herdPiece.pos, vector))
            );

          updated[herdPiece.id] = {
            ...herdPiece,
            pos: add(herdPiece.pos, vector),
          };
          getPiecesAbove(herdPiece, preMoveState.pieces).forEach((toMove) => {
            if (updated[toMove.id] || mainPiece.id === toMove.id) return; // already updated
            LOG &&
              console.log(
                "  ",
                toMove.id,
                "moved on top herd to",
                toStr(add(toMove.pos, vector))
              );

            updated[toMove.id] = {
              ...toMove,
              pos: add(toMove.pos, vector),
            };
          });
        });
      }
    }

    getPiecesAbove(updated[mainPiece.id], preMoveState.pieces).forEach(
      (toMove) => {
        LOG &&
          console.log(
            "  ",
            toMove.id,
            "moved on top of it to",
            toStr(mainEndPos)
          );

        updated[toMove.id] = {
          ...toMove,
          pos: mainEndPos,
        };
      }
    );

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
          [true, false].forEach((isJump) => {
            let vector: Pos | null = null;
            const herd = getPiecesUnder(piece, state.pieces)
              .find(({ herdIds }) => herdIds != null)
              ?.herdIds?.map((id) => state.pieces[id]);

            if (isJump) {
              // attempt jump
              vector = moveJump(startPos, dir, state, piece.id);
            } else {
              // attempt slide
              vector = moveSlide(startPos, dir, state, herd);
            }
            // console.log(
            //   toStr(endPos) || "no move",
            //   buildAction(piece, didJump, dir, state.pieces)
            // );

            if (vector) {
              const newPieces = {
                ...state.pieces,
                ...updatePieces(piece, vector, isJump, state, herd),
              };

              const newState = {
                step: state.step + 1,
                pieces: newPieces,
                piecesArr: Object.values(newPieces),
                actions: [
                  ...state.actions,
                  buildAction(newPieces[piece.id], isJump, dir, newPieces),
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
                // console.log(stateMap.length);
              }
            }
          });
        });
      });
    return nextStates;
  };

  const evaluateNext = (state: State): State | null => {
    // if (state.step === 3) return null;
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
