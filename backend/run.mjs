import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["dist/index.js"], {
  cwd: process.cwd(),
  env: process.env,
  detached: true,
  stdio: ["ignore", "ignore", "ignore"],
});
child.unref();
console.error("LAUNCHED_PID:" + child.pid);
process.exit(0);
