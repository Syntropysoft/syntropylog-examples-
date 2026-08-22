# 23 · Audit trail — masking exemption + the retention bridge

What **1.5.0** and **2.0.0** added, in one schematic run. Two transports on the same logger:

- **`console-infra`** — where ops looks. Masked, safe to page someone with at 3am.
- **`audit-ledger`** — the compliance ledger. Gets the truth, because `2*****9` proves nothing.

```bash
npm install && npm run dev
diff out/console-infra.json out/audit-ledger.json
```

```diff
-     "cardNumber": "************1234",
-     "email": "a**@example.com",
+     "cardNumber": "4111111111111234",
+     "email": "ana@example.com",
```

Two lines. Same log call, same pipeline, one pass — and with the native engine on
(`nativeEngine: true` in `out/out-of-logger.json`) **both renderings come out of a single parse**,
so an app with no exempt transport pays nothing for the feature existing.

## Change the rule, run again, diff

The `RULE` block at the top of `src/index.ts` is the whole point. Change one flag and re-run:

| Flag | Off | On |
|---|---|---|
| `exemptAuditLedger` | the ledger gets the masked entry too — **the diff goes empty** | the ledger gets the card in the clear |
| `emitRules` | **the normal case.** The entry carries only `retention` + `retentionUntil` | the full rules *also* ride along in `retentionRules`, stamped `policyVersion: 'E6-1'` |

`emitRules` is not the other half of a pair — it is an escape hatch, and off is the default for a
reason. See below.

The exemption is declared in the **application's** config, never by a transport about itself — a
dependency must not be able to ship a sink that exempts itself. An unknown name throws
`UnknownExemptTransportError` at `init()`, because a typo here would silently mask the one sink that
had to hold evidence.

## The retention bridge (2.0.0)

`withRetention('SOX_AUDIT_TRAIL')` puts the **class name** on the entry — always a string, because
every mechanism downstream (a Loki label matcher, an index filter, sink routing) matches on a
low-cardinality string, and a field that is a string on some entries and an object on others is a
mapping conflict at ingest.

```json
"retention": "SOX_AUDIT_TRAIL",
"retentionUntil": "2033-08-22T20:58:22.617Z"
```

`retentionUntil` is **not an expiry**: reaching it ends the obligation, it does not authorize
deletion.

### The rules do not ride along — you resolve them on demand

The entry carries the **name**, not the rules. A sink that needs the rules asks for them **at write
time**, which is what the audit ledger in this example does inside its own adapter:

```ts
// in-process sink: the entry gave us the class name, resolve it here
const rules = syntropyLog.getRetentionPolicy(entry.retention);
```

That is deliberate, and it is why `emitRules` defaults to off:

- **Freshness.** Resolving at write time gives the rule *in force at that moment*. Registries get
  re-seeded; a record written in 2026 and read in 2030 must not report the 2030 policy.
- **Cardinality.** The class name is a low-cardinality string every downstream mechanism can route
  on. A rules object on every entry is payload that only one consumer can use.

Turn `emitRules` on for exactly one situation: the consumer is **out of process** — a shipper
reading JSON, with no registry to resolve against. Then the `policyVersion` stamp is what lets the
persisted rule say which revision it was filed under.

## Resolving a policy with no logger

A domain write path that persists the class in its own column needs the same answer the logger got.
See `out/out-of-logger.json`:

```json
{ "until": "2031-03-01T12:00:00.000Z",
  "untilWithoutYears": null }
```

The date is computed from **2024-02-29**, a leap day, plus 7 years — and lands on **1-Mar**: kept one
day longer, never one day short, because ending a window early is the failure an auditor punishes.
A policy with no whole `years` gets `null` rather than a guessed date in a compliance column.

These accessors are readiness-gated, so they run **before** `shutdown()`. And `shutdown()` is what
flushes the transports — without it the files can be short.

> `level: 'fatal'` in the config is only to keep the framework's own lifecycle chatter out of these
> files. The audit entry still lands: `audit` is emitted **always**, whatever the level is set to.

*Español: [README-es.md](README-es.md)*
