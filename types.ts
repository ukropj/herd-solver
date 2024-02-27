export type TileKind = " " | "." | "b" | "w" | "o" | "u" | "+";
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
  altPieces?: Pieces[];
  walls: Wall[];
  pageHeight: number;
  optimal: number;
  fixed: boolean;
};

export type Dir = Readonly<[number, number, string, string]>;

export type State = {
  readonly step: number;
  readonly pieces: Pieces;
  readonly piecesArr: Piece[];
  readonly actions: string[];
  readonly prevState: State | undefined;
};
