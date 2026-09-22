/* Boot-time self-heal for the watcher chain.

   The watcher chain (/home/team/shared/supervise.sh, which respawns
   keepalive.sh, cj-watch.sh and cj-pay-sweep.sh every 60s) is nothing but
   nohup'd shell loops. Nothing restarts them when this machine recycles: there
   is no cron and no meaningful systemd in this container, so the chain has
   silently died at least twice since 2026-09-19. The ONE process that does
   auto-restart is the site app itself — so the app's boot is the only reliable
   hook available, and this module uses it.

   On boot (and every 10 minutes after), it checks whether the supervisor is
   alive and respawns it — detached, via setsid — if it is not.

   Safety properties, all deliberate:
   - It never kills anything. Only ever starts a missing supervisor.
   - It never sets, unsets or overrides an environment variable, so the
     respawned sweeper keeps its shipped DRY-RUN default: cj-pay-sweep.sh pays
     real money only when CJ_PAY_LIVE=1, which is not set in this server's
     environment (and is deliberately absent from the spawn command). Real
     payment stays gated behind that single switch in supervise.sh's env.
   - Nothing here blocks or delays request handling: the check runs off the
     boot path on a timer and uses async child_process + /proc reads.
   - Every failure is caught and appended to the supervisor log; a heal
     problem can never take the server down.
   - If BOTH probes fail we fail CLOSED (no spawn), because a blind spawn could
     stack a second supervisor on top of a live one.

   Wired in at: vite.config.ts (dev server boot — the platform-managed process
   on port 3000) and serve.ts (production `bun run start` boot). GET
   /api/watcher-heal reports status and forces an immediate check. */
import { execFile, spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { appendFile } from "node:fs/promises";

/** Absolute path of the supervisor script — matched exactly, never as a substring. */
export const SUPERVISE_SCRIPT = "/home/team/shared/supervise.sh";
const SUPERVISE_LOG = "/home/team/shared/supervise.log";
const NOHUP_LOG = "/home/team/shared/supervise-nohup.log";
/** Coarse pgrep pre-filter; results are re-verified against /proc/<pid>/cmdline. */
const PGREP_PATTERN = "supervise.sh";
const CHECK_EVERY_MS = 10 * 60 * 1000;
/** First check shortly after boot — off the boot path, but early enough to matter. */
const FIRST_CHECK_MS = 3_000;
/** How long to wait before confirming a respawn actually took. */
const RESPAWN_CONFIRM_MS = 2_500;

export type HealResult = {
  /** True when a live supervisor was found (either already, or after respawn). */
  running: boolean;
  /** PIDs of verified supervisor processes. */
  pids: number[];
  spawned: boolean;
  checkedAt: string;
  /** Set when the check itself could not complete — heal stays hands-off. */
  error?: string;
};

export const healState: {
  lastCheck: string | null;
  lastSpawnedAt: string | null;
  lastError: string | null;
  supervisePids: number[];
} = {
  lastCheck: null,
  lastSpawnedAt: null,
  lastError: null,
  supervisePids: [],
};

let lastKnownRunning: boolean | null = null;
let started = false;
let firstTimer: ReturnType<typeof setTimeout> | null = null;
let interval: ReturnType<typeof setInterval> | null = null;

const stamp = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

/** Append one timestamped line to supervise.log. Never throws. */
function log(line: string): void {
  try {
    void appendFile(SUPERVISE_LOG, `${stamp()} watcher-heal: ${line}\n`).catch(
      () => {},
    );
  } catch {
    /* logging must never break the server */
  }
}

/** pgrep -f <pattern> → PIDs. Resolves [] on "no match" (exit 1); throws if pgrep itself failed. */
function pgrep(pattern: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    execFile(
      "/usr/bin/pgrep",
      ["-f", pattern],
      { timeout: 5_000 },
      (err, stdout) => {
        const code = (err as { code?: unknown } | null)?.code;
        // exit status 1 is pgrep's "no processes matched" — not a failure.
        if (err && code !== 1) {
          reject(err instanceof Error ? err : new Error(String(code ?? err)));
          return;
        }
        resolve(
          String(stdout ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
            .map(Number)
            .filter((n) => Number.isInteger(n) && n > 0),
        );
      },
    );
  });
}

/** Is this PID actually `bash /home/team/shared/supervise.sh` (exact argv, not a substring)? */
function isSupervisorPid(pid: number): boolean {
  try {
    const argv = readFileSync(`/proc/${String(pid)}/cmdline`, "utf8")
      .split("\0")
      .filter(Boolean);
    if (argv.length < 2) return false;
    const shell = (argv[0] ?? "").split("/").pop() ?? "";
    return (
      ["bash", "sh", "dash"].includes(shell) &&
      argv.slice(1).some((a) => a === SUPERVISE_SCRIPT)
    );
  } catch {
    // PID vanished between listing and reading, or /proc is unreadable.
    return false;
  }
}

/** Direct /proc walk: the authoritative probe, needs no external binary. */
function scanProc(): number[] {
  const out: number[] = [];
  const self = process.pid;
  for (const entry of readdirSync("/proc")) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (pid === self) continue;
    if (isSupervisorPid(pid)) out.push(pid);
  }
  return out;
}

/** Union of both probes, each verified against the exact script path. */
async function findSupervisorPids(): Promise<{
  pids: number[];
  warning?: string;
}> {
  const notes: string[] = [];
  let fromProc: number[] | null = null;
  let fromPgrep: number[] | null = null;

  try {
    fromProc = scanProc();
  } catch (err) {
    notes.push(
      `/proc scan failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  try {
    fromPgrep = (await pgrep(PGREP_PATTERN)).filter(isSupervisorPid);
  } catch (err) {
    notes.push(
      `pgrep failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (fromProc === null && fromPgrep === null) {
    // Fail closed: an unreadable probe is not evidence that the chain is dead.
    return { pids: [], warning: `both probes failed (${notes.join("; ")})` };
  }
  const pids = [...new Set([...(fromProc ?? []), ...(fromPgrep ?? [])])].sort(
    (a, b) => a - b,
  );
  return notes.length > 0 ? { pids, warning: notes.join("; ") } : { pids };
}

/**
 * Check the supervisor once and respawn it if it is missing.
 * Never throws — every outcome is reported in the return value and the log.
 */
export async function ensureSupervisor(
  trigger = "manual",
): Promise<HealResult> {
  const checkedAt = stamp();
  try {
    const { pids, warning } = await findSupervisorPids();

    if (warning !== undefined) {
      log(
        `probe warning [${trigger}]: ${warning} (alive=${String(pids.length)})`,
      );
    }

    if (pids.length > 0) {
      healState.lastCheck = checkedAt;
      healState.supervisePids = pids;
      healState.lastError = warning ?? null;
      if (lastKnownRunning !== true) {
        log(
          `supervise.sh alive (pid ${pids.join(",")}) — nothing to do [${trigger}]`,
        );
      }
      lastKnownRunning = true;
      return { running: true, pids, spawned: false, checkedAt };
    }

    if (warning !== undefined) {
      // Both probes unreadable — hands off rather than risk a second supervisor.
      const error = `not spawning: ${warning} [${trigger}]`;
      log(error);
      healState.lastCheck = checkedAt;
      healState.lastError = error;
      return { running: false, pids: [], spawned: false, checkedAt, error };
    }

    log(`supervise.sh NOT running — respawning detached [${trigger}]`);
    // Exact command a human would run, minus the interactivity: setsid detaches
    // from our session/process group so the chain outlives this server, nohup
    // ignores SIGHUP, stdio goes to the same nohup log (appended, so earlier
    // crash output is preserved), stdin is /dev/null.
    const command = `setsid nohup bash ${SUPERVISE_SCRIPT} >> ${NOHUP_LOG} 2>&1 < /dev/null &`;
    const child = spawn("/bin/bash", ["-c", command], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    healState.lastSpawnedAt = checkedAt;

    // Confirm it actually came up; a shell that exits silently is the failure
    // mode worth catching rather than reporting a hopeful "respawned".
    await new Promise((resolve) => setTimeout(resolve, RESPAWN_CONFIRM_MS));
    const after = await findSupervisorPids();
    healState.lastCheck = stamp();
    healState.supervisePids = after.pids;
    healState.lastError = after.warning ?? null;
    lastKnownRunning = after.pids.length > 0;
    if (after.pids.length > 0) {
      log(`respawned supervise.sh (pid ${after.pids.join(",")}) [${trigger}]`);
    } else {
      log(
        `respawn attempt did NOT produce a live supervise.sh after ${String(RESPAWN_CONFIRM_MS)}ms — check ${NOHUP_LOG} [${trigger}]`,
      );
    }
    return {
      running: after.pids.length > 0,
      pids: after.pids,
      spawned: true,
      checkedAt: healState.lastCheck,
      ...(after.warning !== undefined ? { error: after.warning } : {}),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`heal FAILED (server unaffected): ${message} [${trigger}]`);
    healState.lastCheck = checkedAt;
    healState.lastError = message;
    return {
      running: false,
      pids: [],
      spawned: false,
      checkedAt,
      error: message,
    };
  }
}

/**
 * Boot hook: one check shortly after startup, then every 10 minutes. Both
 * timers are unref'd, so they never hold the server open, and a stop function
 * is returned for callers that want to cancel (e.g. Vite's server teardown).
 */
export function startWatcherHeal(where = "server"): () => void {
  if (started) return stopWatcherHeal;
  started = true;

  const first = setTimeout(() => {
    void ensureSupervisor(`boot:${where}`);
  }, FIRST_CHECK_MS);
  first.unref?.();
  firstTimer = first;

  interval = setInterval(() => {
    void ensureSupervisor(`interval:${where}`);
  }, CHECK_EVERY_MS);
  interval.unref?.();

  return stopWatcherHeal;
}

/** Stop the periodic check and allow startWatcherHeal to be called again. */
export function stopWatcherHeal(): void {
  if (firstTimer !== null) {
    clearTimeout(firstTimer);
    firstTimer = null;
  }
  if (interval !== null) {
    clearInterval(interval);
    interval = null;
  }
  started = false;
}
