import { Piece, PieceKind, Pieces, Pos, Puzzle, TileKind, Wall } from "./types";

const validateKind = (pieceKind: string, totalParts: number) => {
  if (
    ["B", "W", "WW", "WWW"].includes(pieceKind) &&
    pieceKind.length === totalParts
  ) {
    return pieceKind as PieceKind;
  } else throw Error(`Invalid piece kind string: ${pieceKind}`);
};

const parsePos = (posStr: string) => {
  const pos = posStr.split(",").map((num) => parseInt(num, 10));
  if (
    pos.length === 2 &&
    typeof pos[0] === "number" &&
    typeof pos[1] === "number"
  ) {
    return pos as Pos;
  } else throw Error(`Cannot parse position string: ${posStr}`);
};

const parseWall = (wallStr: string) => {
  const wall = wallStr.split("|").map(parsePos);
  if (wall.length == 2) {
    return wall as Wall;
  } else throw Error(`Cannot parse wall string: ${wallStr}`);
};

const buildMultiId = (id: string, part: number, totalParts: number) =>
  totalParts > 1 ? `${id}:${part + 1}/${totalParts}` : id;

const parsePlanRow = (planRow: string) => {
  if (/^[ .wbou+]+$/.test(planRow)) {
    return planRow.split("") as TileKind[];
  } else throw Error(`Cannot parse plan row string: ${planRow}`);
};

const isValid = (puzzle: Puzzle) => {
  if (!puzzle.plan.length) return `Puzzle ${puzzle.no} has no plan`;
  if (!Object.keys(puzzle.pieces).length && !puzzle.altPieces?.length)
    return `Puzzle ${puzzle.no} has no pieces`;
  if (puzzle.optimal < 1)
    return `Puzzle ${puzzle.no} has no optimal moves count`;
  if (!puzzle.plan.some((row) => row.some((tile) => /[bw]/.test(tile))))
    return `Puzzle ${puzzle.no} has no end tiles`;
  return true;
};

const allPairs = (pieces: Piece[]) =>
  pieces.flatMap((piece, i) =>
    pieces.slice(i + 1).map((secondPiece) => [piece, secondPiece])
  );

const buildAternatives = (piecesArr: Piece[], altKind: PieceKind) => {
  const thePieces = piecesArr.filter(({ kind }) => kind === altKind);
  const otherPieces = piecesArr.filter(({ kind }) => kind !== altKind);

  return allPairs(thePieces).map((pair) =>
    [...pair, ...otherPieces].reduce(
      (pieces, piece) => ({ ...pieces, [piece.id]: piece }),
      {} as Pieces
    )
  );
};

const checkPieceLimits = (puzzle: Puzzle) => {
  const piecesArr = Object.values(puzzle.pieces);
  let alternatives: Pieces[] = [];

  // check shepherds (max 2)
  const shepherds = piecesArr.filter(({ kind }) => kind === "B");
  if (shepherds.length > 2) {
    alternatives = buildAternatives(piecesArr, "B");
  }

  // check single-sheep (max 2)
  const sheep = piecesArr.filter(({ kind }) => kind === "W");
  if (sheep.length > 2) {
    if (alternatives.length) {
      alternatives = alternatives.flatMap((altPieces) =>
        buildAternatives(Object.values(altPieces), "W")
      );
    } else {
      alternatives = buildAternatives(piecesArr, "W");
    }
  }

  // ensure stacks are kept
  alternatives = alternatives.filter((altPieces) =>
    Object.values(altPieces).every(
      (piece) =>
        (!piece.coversId || altPieces[piece.coversId]) &&
        (!piece.coveredById || altPieces[piece.coveredById])
    )
  );

  if (alternatives.length) {
    puzzle.pieces = {};
    puzzle.altPieces = alternatives;
  }
};

export const parsePuzzles = (lines: string[]) => {
  let puzzle: Puzzle;

  const reset = () => {
    puzzle = {
      no: "",
      plan: [],
      pieces: {},
      walls: [],
      pageHeight: 8,
      optimal: 0,
      fixed: false,
    };
  };

  reset();

  return lines.reduce((puzzles, line, index, lines) => {
    // console.log(line, { no, plan, pieces, optimal });
    try {
      if (/^#/.test(line)) {
        // puzzle number
        puzzle.no = line.trim();
      } else if (/^pieces:/.test(line)) {
        let bCount = 0;
        let wCount = 0;
        // pieces starting positions
        puzzle.pieces = line
          .split(":")[1]
          .trim()
          .split(/\s+/)
          .reduce((pieces, pieceStr) => {
            const [kind, posStr] = pieceStr.split("@");
            const pieceIndex = kind === "B" ? bCount++ : wCount++;
            const letter = String.fromCharCode(65 + pieceIndex);
            const id = `${kind === "B" ? "Black" : "White"}${letter}`;

            const positions = posStr.split("+").map(parsePos);
            const partIds = positions.map((_, i) =>
              buildMultiId(id, i, positions.length)
            );

            const oldPieces = Object.values(pieces);

            const newPieces: Pieces = {
              ...pieces,
            };
            partIds.forEach((id, i) => {
              const pos = positions[i];

              const willCover = oldPieces.find(
                (piece) =>
                  !piece.coveredById &&
                  piece.pos[0] === pos[0] &&
                  piece.pos[1] === pos[1]
              );

              newPieces[id] = {
                id,
                letter: letter,
                kind: validateKind(kind, positions.length),
                pos,
                herdIds: positions.length > 1 ? partIds : undefined,
                coversId: willCover?.id,
                coveredById: undefined,
              };
              if (willCover) {
                newPieces[willCover.id] = {
                  ...willCover,
                  coveredById: id,
                };
              }
            });

            return newPieces;
          }, {} as Pieces);

        checkPieceLimits(puzzle);
      } else if (/^walls:/.test(line)) {
        // walls
        puzzle.walls = line.split(":")[1].trim().split(/\s+/).map(parseWall);
      } else if (/^height:/.test(line)) {
        // walls
        puzzle.pageHeight = parseInt(line.split(":")[1], 10);
        if (puzzle.pageHeight < 3) {
          throw Error("Puzzle height is too low, must be at least 3");
        }
      } else if (/^optimal:/.test(line)) {
        // optimal moves
        puzzle.optimal = parseInt(line.split(":")[1], 10);
      } else if (/^fixed:/.test(line)) {
        // fixed optimal moves
        puzzle.optimal = parseInt(line.split(":")[1], 10);
        puzzle.fixed = true;
      } else if (line.trim().length === 0) {
        if (!puzzle.no) return puzzles; // ignore empty line
        // end of puzzle empty line
        const newPuzzle = puzzle;
        reset();
        const result = isValid(newPuzzle);
        if (result === true) {
          return [...puzzles, newPuzzle];
        } else {
          console.log("Parsing error", result);
        }
      } else {
        // plan/map row
        puzzle.plan.push(parsePlanRow(line));
      }
      if (index === lines.length - 1 && puzzle.no) {
        // add last puzzle if pending
        const newPuzzle = puzzle;
        const result = isValid(newPuzzle);
        if (result === true) {
          return [...puzzles, newPuzzle];
        }
      }
    } catch (e) {
      console.log(`Parsing error (line ${index})`, e);
    }
    return puzzles;
  }, [] as Puzzle[]);
};
