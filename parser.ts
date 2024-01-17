export type TileKind = "." | "b" | "w" | "o";
export type PieceKind = "B" | "W";
export type Pos = [number, number];
export type Wall = [Pos, Pos];

export type Piece = {
  readonly id: string;
  readonly letter: string;
  readonly kind: PieceKind;
  readonly pos: Pos;
  readonly coversId?: string;
  readonly coveredById?: string;
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
          .reduce((pieces, posStr) => {
            const [kind, x, y] = posStr.split(",");
            const index = kind === "B" ? bCount++ : wCount++;
            const letter = String.fromCharCode(65 + index);
            const id = `${kind === "B" ? "Black" : "White"}${letter}`;

            return {
              ...pieces,
              [id]: {
                id,
                letter: letter,
                kind: kind as PieceKind,
                pos: [parseInt(x, 10), parseInt(y, 10)],
              },
            };
          }, {});
      } else if (/^walls:/.test(line)) {
        // walls
        puzzle.walls = line
          .split(":")[1]
          .trim()
          .split(/\s+/)
          .map(
            (wallStr) =>
              wallStr
                .split("|")
                .map(
                  (posStr) =>
                    posStr.split(",").map((num) => parseInt(num, 10)) as Pos
                ) as Wall
          );
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
