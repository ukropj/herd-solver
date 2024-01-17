import * as fs from "node:fs";

import { parsePuzzles } from "./parser";
import { solvePuzzle } from "./solver";

const args = process.argv.slice(2);
let alwaysShowSolution = args[0] == "solution";
const whitelist = alwaysShowSolution ? args.slice(1) : args;

try {
  const lines = fs.readFileSync("./puzzles.txt", "utf8").split("\n");
  const puzzles = parsePuzzles(lines);

  puzzles.forEach((puzzle) => {
    if (whitelist.length && !whitelist.includes(puzzle.no)) {
      // console.log(`${puzzle.no}: skipped`);
      return;
    }
    const solution = solvePuzzle(puzzle);
    if (solution) {
      const betterFound = solution.step < puzzle.optimal;
      console.log(
        `${puzzle.no}: solved in ${solution.step}, ${
          !betterFound
            ? `OK${puzzle.fixed ? " (fixed)" : ""}`
            : `expected ${puzzle.optimal}}`
        }${
          betterFound || alwaysShowSolution
            ? `\n  steps: ${solution.actions.join(", ")}`
            : ""
        }`
      );
    } else {
      console.log(`${puzzle.no}: NOT solved`);
    }
  });
  console.log("DONE");
} catch (e) {
  console.error(e);
}
