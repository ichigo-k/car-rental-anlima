// Runs the dev server with email and SMS pointed at a dead local address, so
// end-to-end tests never message real people. The tests check for the pid
// file below before they run.
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
const pidFile = ".next/dev-test.pid";
mkdirSync(".next", { recursive: true });
writeFileSync(pidFile, String(process.pid));
const child = spawn("npx", ["next", "dev", "--webpack"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    RESEND_BASE_URL: "http://127.0.0.1:9",
    SMSONLINEGH_BASE_URL: "http://127.0.0.1:9",
  },
});
const stop = () => rmSync(pidFile, { force: true });
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("exit", (code) => {
  stop();
  process.exit(code ?? 0);
});
