import { Dir, Piece, Pieces, Pos, Puzzle, State, TileKind } from "./types";

const LOG = false;

const BUMP = "o";
const HOLE = "u";
const COMMAND = "+";
const DEATH = "x";
const CAN_SLIDE_TO = /^[.bwu+x]$/;
const CAN_JUMP_OVER = /^[oBW]$/;
const CAN_JUMP_TO = /^[.bwouBW+]$/;

const DIRS: Dir[] = [
  [1, 0, "▶", "↠"],
  [0, 1, "▼", "↡"],
  [-1, 0, "◀", "↞"],
  [0, -1, "▲", "↟"],
] as const;

export const comparePieces = (p1: Piece, p2: Piece) =>
  p1.id.localeCompare(p2.id);

export const toStr = (pos?: Pos | null) => pos?.join(",") ?? "";

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

export const generateWallHashes = ({ walls }: Puzzle) =>
  walls.flatMap(([from, to]) => [
    [from.toString(), to.toString()],
    [to.toString(), from.toString()],
  ]);

export const wrapPos = ({ pageHeight }: Puzzle, pos: Pos): Pos => {
  if (pos[1] < 0) {
    return [pos[0], pageHeight + pos[1]];
  }
  if (pos[1] > pageHeight - 1) {
    return [pos[0], pos[1] - pageHeight];
  }
  return pos;
};

export const solvePuzzle = (puzzle: Puzzle) => {
  if (!puzzle.altPieces) {
    const solution = _solvePuzzle(puzzle);
    return solution ? { solution, pieces: puzzle.pieces } : null;
  }
  const solutions = puzzle.altPieces.map((pieces) =>
    _solvePuzzle({ ...puzzle, pieces })
  );

  let lowestStep = puzzle.optimal + 1;
  let bestSolutionIndex: number | null = null;
  solutions.forEach((solution, i) => {
    if (solution?.step && solution.step < lowestStep) {
      lowestStep = solution.step;
      bestSolutionIndex = i;
    }
  });
  return bestSolutionIndex != null
    ? {
        solution: solutions[bestSolutionIndex] as State,
        pieces: puzzle.altPieces[bestSolutionIndex],
      }
    : null;
};

const _solvePuzzle = (puzzle: Puzzle) => {
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
    prevState: undefined,
  };
  statesMap[stringify(startState.piecesArr)] = 0;

  const allowNewState = (hash: string, step: number) =>
    statesMap[hash] == null || statesMap[hash] > step;

  const add = ([x, y]: Pos, [dx, dy]: Pos | Dir, dontWrap?: boolean): Pos => {
    const result: Pos = [x + dx, y + dy];
    return dontWrap ? result : wrapPos(puzzle, result);
  };

  const getTopPieceInPlan = (
    [x, y]: Pos,
    pieces: Pieces,
    ignoreIds?: string[]
  ) =>
    Object.values(pieces).find(
      ({ id, coveredById, pos: [px, py] }) =>
        px === x &&
        py === y &&
        (!coveredById || (ignoreIds && ignoreIds.includes(coveredById))) &&
        (!ignoreIds || !ignoreIds.includes(id))
    );

  const getInPlan = ([x, y]: Pos, pieces?: Pieces, ignoreIds?: string[]) =>
    (pieces ? getTopPieceInPlan([x, y], pieces, ignoreIds) : null)?.kind[0] ??
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
    pieces: Pieces,
    ignoreIds: string[],
    dontWrap: boolean
  ) => {
    const tiles = from.map((fromPos) => getInPlan(fromPos));
    if (
      tiles.every((tile) => HOLE === tile) ||
      tiles.some((tile) => BUMP === tile)
    ) {
      return false; // pinned by a hole or a bump
    }

    return from.every((fromPos) => {
      const to = add(fromPos, dir, dontWrap);
      // check if a wall would "slice a moving herd"

      if (
        from.length > 1 &&
        from.some((otherPos) => isWall(add(otherPos, dir, dontWrap), to))
      ) {
        return false;
      }
      return (
        !isWall(fromPos, to) &&
        CAN_SLIDE_TO.test(getInPlan(to, pieces, ignoreIds))
      );
    });
  };

  const findSlideVector = (
    from: Pos,
    dir: Dir,
    pieces: Pieces,
    herdToCheck?: Piece[]
  ): [Pos | null, boolean, boolean] => {
    let moved = false;
    let pos: Pos = from;
    let otherPoses = herdToCheck?.map(({ pos }) => pos);

    const topPiece = getTopPieceInPlan(from, pieces);
    const ignoreIds = [
      ...(herdToCheck?.flatMap((herdPiece) => [
        herdPiece.id,
        ...getPiecesAbove(herdPiece, pieces).map(({ id }) => id),
      ]) ?? []),
    ];
    if (topPiece) {
      // ignoring self is relevant when checking for infinite vertical traversal
      ignoreIds.push(
        topPiece.id,
        ...getPiecesUnder(topPiece, pieces).map(({ id }) => id)
      );
    }
    let onCommand = (otherPoses ?? [pos]).some((p) => COMMAND === getInPlan(p));

    let vector: Pos = [0, 0];
    while (
      canSlide(
        otherPoses ?? [pos],
        dir,
        pieces,
        ignoreIds,
        otherPoses != null && otherPoses.length > 0
      )
    ) {
      moved = true;
      vector = add(vector, dir, true);
      pos = add(pos, dir);
      otherPoses = otherPoses?.map((otherPos) => add(otherPos, dir));
      onCommand =
        onCommand ||
        (otherPoses ?? [pos]).some((p) => COMMAND === getInPlan(p));

      if (toStr(pos) === toStr(from)) {
        // would cause infinite sliding!
        return [null, false, true];
      }
      if (getInPlan(pos) === DEATH) {
        return [null, false, true];
      }
    }
    return moved ? [vector, onCommand, false] : [null, false, false];
  };

  const canJump = (from: Pos, dir: Dir, pieces: Pieces, idUnder?: string) => {
    if (!idUnder && HOLE === getInPlan(from)) return false;

    // if secret mechanic is turned on, ignore walls if 2 pieces are under
    const ignoreWalls =
      puzzle.flag === "secret" &&
      idUnder &&
      (pieces[idUnder].coversId || getInPlan(from) === BUMP);

    const jumpOver = add(from, dir);
    const to = add(jumpOver, dir);
    return (
      (ignoreWalls || !isWall(from, jumpOver)) &&
      CAN_JUMP_OVER.test(getInPlan(jumpOver, pieces)) &&
      (ignoreWalls || !isWall(jumpOver, to)) &&
      CAN_JUMP_TO.test(getInPlan(to))
    );
  };

  const findJumpVector = (
    startPos: Pos,
    dir: Dir,
    pieces: Pieces,
    idUnder?: string
  ) =>
    canJump(startPos, dir, pieces, idUnder)
      ? add(add([0, 0], dir, true), dir, true)
      : null;

  const getPiecesUnder = ({ coversId }: Piece, pieces: Pieces): Piece[] => {
    if (!coversId) {
      return [];
    }
    const pieceUnder = pieces[coversId];
    return [pieceUnder, ...getPiecesUnder(pieceUnder, pieces)];
  };

  const getHerdPiecesUnder = (piece: Piece, pieces: Pieces) =>
    getPiecesUnder(piece, pieces)
      .find(({ herdIds }) => herdIds != null)
      ?.herdIds?.map((id) => pieces[id]);

  const getPiecesAbove = ({ coveredById }: Piece, pieces: Pieces): Piece[] => {
    if (!coveredById) {
      return [];
    }
    const pieceAbove = pieces[coveredById];
    return [pieceAbove, ...getPiecesAbove(pieceAbove, pieces)];
  };

  // TODO this logic is a "little" convoluted, consider refactor
  const commandPieces = (
    alreadyMovedPieces: Pieces,
    dir: Dir,
    preMoveState: Pick<State, "pieces">
  ): [Pieces | null, boolean] => {
    // take pieces that did not trigger the command AND are not on top of others
    // also pick just one from each herd
    const piecesToMove = Object.values(preMoveState.pieces).filter(
      ({ id, coversId, herdIds }) =>
        !alreadyMovedPieces[id] && !coversId && (!herdIds || id === herdIds[0])
    );
    let tmpPieces = piecesToMove.reduce(
      (pieces, piece) => ({
        ...pieces,
        [piece.id]: { ...piece },
      }),
      {
        ...preMoveState.pieces,
        ...alreadyMovedPieces,
      } as Pieces
    );
    let pieceMoved = false;
    let anotherCommand = false; // this could trigger another command
    let abortMove = false;

    // keep sliding pieces until not possible
    // (so we don't have to compute the optimal order to slide them in)
    do {
      pieceMoved = false;
      piecesToMove.forEach(({ id }) => {
        const piece = tmpPieces[id];
        const herd = piece.herdIds?.map((id) => tmpPieces[id]);
        const [vector, command, abort] = findSlideVector(
          piece.pos,
          dir,
          tmpPieces,
          herd
        );
        if (abort) {
          abortMove = true;
        }
        if (vector) {
          LOG && console.log("Commading", id, dir[2]);
          pieceMoved = true;
          tmpPieces = {
            ...tmpPieces,
            ...updatePiece(piece, vector, tmpPieces, true, true),
          };
        }
        anotherCommand = anotherCommand || command;
      });
    } while (pieceMoved);

    if (abortMove) return [null, false];

    return [
      Object.values(tmpPieces).reduce((commandedPieces, piece) => {
        if (!alreadyMovedPieces[piece.id]) {
          commandedPieces[piece.id] = piece;
        }
        return commandedPieces;
      }, {} as Pieces),
      anotherCommand,
    ];
  };

  const updatePiece = (
    mainPiece: Piece,
    vector: Pos,
    preMovePieces: Pieces,
    handleAbove: boolean,
    handleBelow: boolean,
    isJump: boolean = false
  ): Pieces => {
    //This code assumes that one herd can be never stacked on another herd
    const piecesToUpdate = mainPiece.herdIds
      ? mainPiece.herdIds.map((id) => preMovePieces[id])
      : [mainPiece];

    return piecesToUpdate.reduce((pieces, piece) => {
      const isSideHerdPiece = piece.id !== mainPiece.id;
      const pieceOnTargetPos = isJump
        ? getTopPieceInPlan(add(piece.pos, vector), preMovePieces)
        : undefined;

      return {
        ...pieces,
        // main piece
        [piece.id]: {
          ...piece,
          pos: add(piece.pos, vector),
          coversId: isJump ? pieceOnTargetPos?.id : piece.coversId,
        },
        // above
        ...(piece.coveredById && (handleAbove || isSideHerdPiece)
          ? updatePiece(
              preMovePieces[piece.coveredById],
              vector,
              preMovePieces,
              true,
              false
            )
          : {}),
        // below
        ...(piece.coversId &&
          (isJump
            ? {
                // uncover what was covered
                [piece.coversId]: {
                  ...preMovePieces[piece.coversId],
                  coveredById: undefined,
                },
              }
            : handleBelow || isSideHerdPiece
            ? updatePiece(
                preMovePieces[piece.coversId],
                vector,
                preMovePieces,
                false,
                true
              )
            : {})),
        // cover new one
        ...(isJump && pieceOnTargetPos
          ? {
              [pieceOnTargetPos.id]: {
                ...pieceOnTargetPos,
                coveredById: piece.id,
              },
            }
          : {}),
      };
    }, {} as Pieces);
  };

  const buildAction = (
    movedPiece: Piece,
    didJump: boolean,
    onCommand: boolean,
    dir: Dir,
    pieces: Pieces
  ) => {
    const under = getPiecesUnder(movedPiece, pieces).map(({ id }) => id);
    const above = getPiecesAbove(movedPiece, pieces).map(({ id }) => id);
    let supp = "";
    if (didJump) {
      if (above.length) {
        supp = `(& ${above.join(" & ")})`;
      }
      if (under.length) {
        supp = `(to ${under.join(" & ")})`;
      }
    } else {
      const other = [...under, ...above];
      if (other.length) {
        supp = `(& ${other.join(" & ")})`;
      }
      if (onCommand) {
        supp += "(cmd)";
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
            let onCommand = false;

            if (isJump) {
              // attempt jump
              vector = findJumpVector(
                startPos,
                dir,
                state.pieces,
                piece.coversId
              );
            } else {
              const herd = getHerdPiecesUnder(piece, state.pieces);
              // attempt slide
              [vector, onCommand] = findSlideVector(
                startPos,
                dir,
                state.pieces,
                herd
              );
            }
            // console.log(
            //   toStr(vector) || "no move",
            //   buildAction(piece, isJump, onCommand, dir, state.pieces)
            // );

            if (vector) {
              let updatedPieces = updatePiece(
                piece,
                vector,
                state.pieces,
                true,
                true,
                isJump
              );

              let newPieces = {
                ...state.pieces,
                ...updatedPieces,
              };

              let i = 0;
              // while (onCommand) {
              if (onCommand) {
                const [commandedPieces, _anotherCommand] = onCommand
                  ? commandPieces(updatedPieces, dir, { pieces: newPieces })
                  : [{}, false];
                if (commandedPieces === null) {
                  return; // invalid command
                }

                newPieces = {
                  ...newPieces,
                  ...commandedPieces,
                };
                // if (!anotherCommand) {
                //   break;
                // } else {
                //   i++;
                //   updatedPieces = commandedPieces;
                // }
                // if (i > 10) {
                //   // assume endless loop, abandon the state.
                //   return;
                // }
              }

              const newState: State = {
                step: state.step + 1,
                pieces: newPieces,
                piecesArr: Object.values(newPieces),
                actions: [
                  ...state.actions,
                  buildAction(
                    newPieces[piece.id],
                    isJump,
                    onCommand,
                    dir,
                    newPieces
                  ),
                ],
                prevState: state,
              };
              const hash = stringify(newState.piecesArr);
              // console.log(hash);

              if (allowNewState(hash, newState.step)) {
                statesMap[hash] = newState.step;
                nextStates.push(newState);

                // console.log(
                //   newState.step,
                //   `[${stringify(newState.piecesArr)}]\t`,
                //   newState.actions.join(" ")
                // );
                // console.log(stateMap.length);
              }
              LOG && console.log("----------------------------");
            }
          });
        });
      });
    return nextStates;
  };

  const evaluateNext = (state: State): State | null => {
    // if (state.step === 5) return null;
    if (
      state.step <= puzzle.optimal &&
      state.step < solvedSteps &&
      isSolved(state)
    ) {
      // console.log("solved", state.step, state.actions.join(" "));
      // console.log(state.pieces);
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
