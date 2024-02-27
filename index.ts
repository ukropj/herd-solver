import * as fs from "node:fs";

import { parsePuzzles } from "./parser";
import { solvePuzzle } from "./solver";
import { Pieces } from "./types";
// import { render } from "./display";

const args = process.argv.slice(2);

const alwaysShowSolution = /^solutions?$/.test(args[0]);
if (alwaysShowSolution) args.shift();

const startFrom = args[0] == "from" ? args[1] : undefined;

const whitelist = startFrom ? [] : args;

const formatPieces = (pieces: Pieces) =>
  `\n  pieces: ${Object.values(pieces)
    .map((piece) => `${piece.kind}@[${piece.pos.join(",")}]`)
    .join(" ")}`;

try {
  const lines = fs.readFileSync("./puzzles.txt", "utf8").split("\n");
  const puzzles = parsePuzzles(lines);
  let fromFound = false;

  puzzles.forEach((puzzle) => {
    if (whitelist.length && !whitelist.includes(puzzle.no)) {
      // console.log(`${puzzle.no}: skipped`);
      return;
    }
    if (startFrom) {
      if (puzzle.no === startFrom) fromFound = true;
      if (!fromFound) return;
    }
    // render(puzzle);

    const solutionAndPieces = solvePuzzle(puzzle);
    if (solutionAndPieces) {
      const { solution, pieces } = solutionAndPieces;
      const betterFound = solution.step < puzzle.optimal;
      console.log(
        `${puzzle.no}: solved in ${solution.step}, ${
          !betterFound
            ? `OK${puzzle.fixed ? " (fixed)" : ""}`
            : `expected ${puzzle.optimal}`
        }${
          betterFound || alwaysShowSolution
            ? `${
                puzzle.altPieces ? formatPieces(pieces) : ""
              }\n  steps: ${solution.actions.join(", ")}\n`
            : ""
        }`
      );
      if (alwaysShowSolution) {
        // render(puzzle, solution);
      }
    } else {
      console.log(`${puzzle.no}: NOT solved`);
    }
  });
  console.log("DONE");
} catch (e) {
  console.error(e);
}
