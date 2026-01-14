import { spawnSync } from "node:child_process";
import path from "node:path";

export function runGodLearn(argv: string[]) {
  const repoRoot = process.cwd();
  const exe = path.join(repoRoot, "scripts", "god_learn", "god-learn");

  const res = spawnSync(exe, argv, {
    stdio: "inherit",
    env: process.env,
  });

  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}
