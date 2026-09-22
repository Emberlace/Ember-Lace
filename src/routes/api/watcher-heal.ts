import { createFileRoute } from "@tanstack/react-router";
import {
  ensureSupervisor,
  healState,
  startWatcherHeal,
  SUPERVISE_SCRIPT,
} from "../../server/watcher-heal";

/* GET /api/watcher-heal — status of the boot-time watcher-chain self-heal, and
   a forced check. Read-only with respect to the watchers: it starts
   supervise.sh if it is missing and otherwise does nothing (never kills,
   never changes an env var, so the sweeper stays DRY-RUN by default).

   Handy for a human without shell access: hit this URL after a recycle and the
   JSON says whether the chain (keepalive / cj-watch / cj-pay-sweep) is alive
   and what the last check saw. `ensureSupervisor` never throws, so this can
   never 500 from a heal problem. No secrets in the response — paths and PIDs
   only. */
export const Route = createFileRoute("/api/watcher-heal")({
  server: {
    handlers: {
      GET: async () => {
        const result = await ensureSupervisor("api:/api/watcher-heal");
        // A request also re-arms the periodic check if boot wiring was missed.
        startWatcherHeal("api");
        return Response.json(
          {
            ok: result.error === undefined,
            superviseScript: SUPERVISE_SCRIPT,
            superviseRunning: result.running,
            supervisePids: result.pids,
            spawnedThisCheck: result.spawned,
            checkedAt: result.checkedAt,
            lastCheck: healState.lastCheck,
            lastSpawnedAt: healState.lastSpawnedAt,
            lastError: healState.lastError,
            /* The heal only respawns the supervisor; it never sets env vars, so
               the sweeper inherits this server's environment and stays in its
               DRY-RUN default unless CJ_PAY_LIVE=1 is set there. */
            cjPayLiveInThisProcess: (process.env.CJ_PAY_LIVE ?? "") === "1",
          },
          { status: 200 },
        );
      },
    },
  },
});
