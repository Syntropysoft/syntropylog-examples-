/**
 * 23 — Audit trail: masking exemption + the retention bridge
 *
 * Schematic. It shows what 1.5.0 and 2.0.0 added, nothing more:
 *
 *   1.5.0  masking.exemptTransports — one sink receives the entry UNMASKED
 *   2.0.0  withRetention('NAME') puts the class NAME (a string) + retentionUntil on the entry
 *   2.0.0  retention.emitRules — the full rules travel, opt-in, for out-of-process consumers
 *   2.0.0  getRetentionPolicy / getRetentionUntil — resolve a policy with no logger involved
 *
 * Run it, look at out/*.json, change the RULE block below, run again, diff.
 * Console output scrolls away; a file you can diff does not.
 */
import {
  syntropyLog,
  AdapterTransport,
  defineRetentionPolicies,
  retentionUntil,
} from 'syntropylog';
import { mkdir, writeFile } from 'node:fs/promises';

// ─────────────────────────────────────────────────────────────────────────────
//  RULE — change one of these, re-run, and diff out/
// ─────────────────────────────────────────────────────────────────────────────
const RULE = {
  /** true → 'audit-ledger' is exempt from masking and gets the card in the clear. */
  exemptAuditLedger: true,
  /**
   * true → the full rules ALSO ride on the entry, in `retentionRules`, stamped policyVersion.
   * This is the escape hatch for a consumer that is **out of process** — a shipper reading JSON
   * with no registry to resolve against. The in-process ledger below does NOT need it: it
   * resolves on demand. Leave it false unless something outside the process has to read the rules.
   */
  emitRules: false,
};
// ─────────────────────────────────────────────────────────────────────────────

/** Collect what each transport actually received. The native path hands over a
 *  pre-serialized string, the JS path a LogEntry — normalize both. */
const captured: Record<string, unknown[]> = {
  'console-infra': [], // where ops looks: masked, safe to page someone with
  'audit-ledger': [], // the compliance ledger: the truth, or it proves nothing
};
const normalize = (entry: unknown) =>
  (typeof entry === 'string' ? JSON.parse(entry) : entry) as Record<string, unknown>;

const collector = (bucket: unknown[]) => ({
  log(entry: unknown) {
    bucket.push(normalize(entry));
  },
});

/**
 * The audit ledger is an IN-PROCESS sink, so the rules never travel on the entry: it gets the
 * class NAME and resolves it here, at write time, against the same frozen registry the logger
 * used. That is the rule in force at this moment — which is the whole point, because registries
 * get re-seeded and a record read in 2030 must not report the 2030 policy.
 */
const ledgerCollector = (bucket: unknown[]) => ({
  log(entry: unknown) {
    const e = normalize(entry);
    let rulesAtWriteTime: unknown;
    try {
      if (typeof e.retention === 'string') {
        rulesAtWriteTime = syntropyLog.getRetentionPolicy(e.retention);
      }
    } catch {
      // RetentionPolicyNotFoundError — an unregistered class. A sink must never throw,
      // so it is recorded as absent rather than taking the process down.
      rulesAtWriteTime = null;
    }
    bucket.push(rulesAtWriteTime === undefined ? e : { ...e, rulesAtWriteTime });
  },
});

await syntropyLog.init({
  logger: {
    serviceName: 'payments',
    // 'fatal' silences the framework's own info-level lifecycle chatter, which would
    // otherwise be 90% of these files. The audit entry still lands: `audit` is emitted
    // ALWAYS, whatever the configured level — that is what the level is for.
    level: 'fatal',
    transports: {
      default: [
        new AdapterTransport({
          name: 'console-infra',
          adapter: collector(captured['console-infra']),
        }),
        new AdapterTransport({
          name: 'audit-ledger',
          adapter: ledgerCollector(captured['audit-ledger']),
        }),
      ],
    },
  },
  masking: {
    enableDefaultRules: true,
    // The exemption is declared HERE, by the application — never by a transport
    // about itself. An unknown name throws UnknownExemptTransportError at init().
    ...(RULE.exemptAuditLedger ? { exemptTransports: ['audit-ledger'] } : {}),
  },
  retentionPolicies: defineRetentionPolicies({
    SOX_AUDIT_TRAIL: { years: 7, standard: 'SOX 802' },
    CACHE_SNAPSHOT: { days: 30 }, // no whole `years` → no retentionUntil
  }),
  retention: { version: 'E6-1', emitRules: RULE.emitRules },
});

const log = syntropyLog.getLogger();

log.withRetention('SOX_AUDIT_TRAIL').audit(
  { cardNumber: '4111111111111234', email: 'ana@example.com', amount: 1500 },
  'payment.authorized',
);

// ── The same resolution, from a path that never touches a logger ─────────────
// The ledger above resolves inside a transport. A domain write path that persists
// the class in its own column uses the very same accessors. Readiness-gated, so
// they run BEFORE shutdown().
const now = new Date('2024-02-29T12:00:00Z'); // leap day, on purpose
const outOfLogger = {
  registered: Object.keys(syntropyLog.getRetentionPolicies()),
  policy: syntropyLog.getRetentionPolicy('SOX_AUDIT_TRAIL'),
  until: syntropyLog.getRetentionUntil('SOX_AUDIT_TRAIL', now),
  // no whole `years` → null, rather than guessing a date into a compliance column
  untilWithoutYears: syntropyLog.getRetentionUntil('CACHE_SNAPSHOT', now),
  // the same computation as a pure function, for callers already holding the rules
  pure: retentionUntil(now, 7),
  nativeEngine: syntropyLog.isNativeAddonInUse(),
};

// shutdown() is what flushes the transports. Without it the files can be short.
await syntropyLog.shutdown();

await mkdir('out', { recursive: true });
await writeFile(
  'out/console-infra.json',
  JSON.stringify(captured['console-infra'], null, 2) + '\n',
);
await writeFile(
  'out/audit-ledger.json',
  JSON.stringify(captured['audit-ledger'], null, 2) + '\n',
);
await writeFile(
  'out/out-of-logger.json',
  JSON.stringify(outOfLogger, null, 2) + '\n',
);

console.log(`RULE = ${JSON.stringify(RULE)}`);
console.log('wrote out/console-infra.json, out/audit-ledger.json, out/out-of-logger.json');
console.log('→ diff out/console-infra.json out/audit-ledger.json');
