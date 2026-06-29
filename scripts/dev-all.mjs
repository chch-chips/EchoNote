import { spawn } from "node:child_process";

const commands = ["npm run dev", "npm run worker:ai"];
const children = [];
let shuttingDown = false;

function start(command) {
  const child = spawn(command, {
    shell: true,
    stdio: "inherit",
    windowsHide: true,
  });

  child.on("error", (error) => {
    console.error(`Failed to start '${command}':`, error);
    stopAll(1);
  });

  child.on("exit", (code) => {
    if (!shuttingDown) stopAll(code ?? 0);
  });

  children.push(child);
}

function stopChild(child) {
  if (child.killed || child.exitCode !== null) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  child.kill("SIGTERM");
}

function stopAll(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) stopChild(child);

  process.exitCode = code;
}

for (const command of commands) start(command);

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));