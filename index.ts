import * as fs from "node:fs";

import { parsePuzzles } from "./parser";
import { solvePuzzle } from "./solver";
import { Pieces } from "./types";
import { render } from "./display";

const args = process.argv.slice(2);

let alwaysShowSolution = false;
let visualize = false;
let startFrom: string | undefined = undefined;
let whitelist: string[] = [];

let arg = args.shift();
while (arg) {
  switch (arg) {
    case "-s":
    case "solution":
    case "solutions":
      alwaysShowSolution = true;
      break;
    case "-v":
    case "visual":
      visualize = true;
      break;
    case "from":
      startFrom = args.shift();
      break;
    default:
      if (!startFrom) {
        whitelist.push(arg);
      }
      break;
  }
  arg = args.shift();
}

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
      if (visualize) {
        render(puzzle);
      }
      if ((betterFound || alwaysShowSolution) && visualize) {
        render(puzzle, solution);
      }
    } else {
      if (visualize) {
        render(puzzle);
      }
      console.log(`${puzzle.no}: \x1b[31m${"NOT solved"}\x1b[0m`);
    }
  });
  console.log("DONE");
} catch (e) {
  console.error(e);
}
