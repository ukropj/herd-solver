export type TileKind = "." | "b" | "w" | "o";
export type PieceKind = "B" | "W" | "WW" | "WWW";
export type Pos = [number, number];
export type Wall = [Pos, Pos];

export type Piece = {
  readonly id: string;
  readonly letter: string;
  readonly kind: PieceKind;
  readonly pos: Pos;
  readonly coversId?: string;
  readonly coveredById?: string;
  readonly herdIds?: string[];
};

export type Pieces = Record<string, Piece>;

export type Puzzle = {
  no: string;
  plan: TileKind[][];
  pieces: Pieces;
  walls: Wall[];
  optimal: number;
  fixed: boolean;
};

const parsePos = (posStr: string) => {
  const pos = posStr.split(",").map((num) => parseInt(num, 10)) as Pos;
  if (
    pos.length === 2 &&
    typeof pos[0] === "number" &&
    typeof pos[1] === "number"
  )
    return pos;
  else throw Error(`Cannot parse position string: ${posStr}`);
};

const buildMultiId = (id: string, part: number, totalParts: number) =>
  totalParts > 1 ? `${id}:${part + 1}/${totalParts}` : id;

// const buildKind = (kind: string, totalParts: number) =>
//   (totalParts > 1 ? "".padEnd(totalParts, kind) : kind) as PieceKind;

export const parsePuzzles = (lines: string[]) => {
  let puzzle: Puzzle;

  const reset = () => {
    puzzle = {
      no: "",
      plan: [],
      pieces: {},
      walls: [],
      optimal: 0,
      fixed: false,
    };
  };

  reset();

  return lines.reduce((puzzles, line, index) => {
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
            const index = kind === "B" ? bCount++ : wCount++;
            const letter = String.fromCharCode(65 + index);
            const id = `${kind === "B" ? "Black" : "White"}${letter}`;

            const newPieces: Pieces = {
              ...pieces,
            };

            const positions = posStr.split("+").map(parsePos);
            const partIds = positions.map((_, i) =>
              buildMultiId(id, i, positions.length)
            );

            partIds.forEach((id, i) => {
              newPieces[id] = {
                id,
                letter: letter,
                kind: kind as PieceKind,
                pos: positions[i],
                herdIds: positions.length > 1 ? partIds : undefined,
              };
            });

            return newPieces;
          }, {});
      } else if (/^walls:/.test(line)) {
        // walls
        puzzle.walls = line
          .split(":")[1]
          .trim()
          .split(/\s+/)
          .map((wallStr) => wallStr.split("|").map(parsePos) as Wall);
      } else if (/^optimal:/.test(line)) {
        // optimal moves
        puzzle.optimal = parseInt(line.split(":")[1], 10);
      } else if (/^fixed:/.test(line)) {
        // fixed optimal moves
        puzzle.optimal = parseInt(line.split(":")[1], 10);
        puzzle.fixed = true;
      } else if (line.trim().length === 0) {
        // end of puzzle empty line
        const newPuzzle = puzzle;
        reset();

        return [...puzzles, newPuzzle];
      } else {
        // plan/map row
        puzzle.plan.push(line.split("") as TileKind[]);
      }
    } catch (e) {
      console.log(`Parsing error (line ${index})`, e);
    }
    return puzzles;
  }, [] as Puzzle[]);
};
