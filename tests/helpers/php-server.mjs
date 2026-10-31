// The one way the test suites start a disposable php -S. A failed start names its
// port, the last probe result, and PHP's stderr, and leaves no server running.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { join } from "node:path";

const START_LIMIT_MS = 60000;
const PORT_TRIES = 32;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function osPort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

const probeResult = (error) => error.cause?.message ?? error.message;

/**
 * A free port that fetch will really connect to. fetch rejects the Fetch standard's
 * blocked ports (6000, 6566, 10080, ...) without touching the network, so a healthy
 * server on one looks dead for the whole start limit. Windows hands those out when its
 * dynamic range starts low, so ask fetch: a usable free port is refused by the OS.
 */
export async function freePort(nextPort = osPort) {
  let outcome;
  for (let tries = 0; tries < PORT_TRIES; tries++) {
    const port = await nextPort();
    outcome = await fetch(`http://127.0.0.1:${port}/`).catch((error) => error);
    if (outcome.cause?.code === "ECONNREFUSED") return port;
  }
  throw new Error(`no usable port in ${PORT_TRIES} tries, last: ${probeResult(outcome)}`);
}

/** Starts php -S on docroot/router.php; any HTTP reply from /api/health means it is up. */
export async function startPhpServer({ args = [], docroot, cwd, env, limitMs = START_LIMIT_MS }) {
  const port = await freePort();
  let stderr = "";
  const child = spawn("php", [...args, "-S", `127.0.0.1:${port}`, "-t", docroot, join(docroot, "router.php")], {
    cwd,
    env,
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const deadline = Date.now() + limitMs;
  let lastProbe = "none finished";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`php server on port ${port} exited with code ${child.exitCode}; stderr: ${stderr}`);
    try {
      const reply = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(deadline - Date.now()) });
      await reply.text();
      return { port, stop: () => child.kill() };
    } catch (error) {
      lastProbe = probeResult(error);
      await sleep(100);
    }
  }
  if (child.kill()) await once(child, "exit");
  throw new Error(`php server did not start on port ${port} within ${limitMs}ms; last probe: ${lastProbe}; stderr: ${stderr}`);
}
