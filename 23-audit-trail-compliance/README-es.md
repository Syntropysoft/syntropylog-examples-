# 23 · Traza de auditoría — exención de masking + el puente de retención

Lo que agregaron **1.5.0** y **2.0.0**, en una corrida esquemática. Dos transports sobre el mismo
logger:

- **`console-infra`** — donde mira infra. Enmascarado, seguro para despertar a alguien a las 3am.
- **`audit-ledger`** — el ledger de compliance. Recibe la verdad, porque `2*****9` no prueba nada.

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

Dos líneas. La misma llamada, el mismo pipeline, un solo recorrido — y con el motor nativo activo
(`nativeEngine: true` en `out/out-of-logger.json`) **las dos versiones salen de un único parse**, así
que una app sin transport exento no paga nada por que la feature exista.

## Cambiá la regla, volvé a correr, diffeá

El bloque `RULE` arriba de `src/index.ts` es el punto del ejemplo. Cambiá un flag y volvé a correr:

| Flag | En false | En true |
|---|---|---|
| `exemptAuditLedger` | el ledger también recibe la entry enmascarada — **el diff queda vacío** | el ledger recibe la tarjeta en claro |
| `emitRules` | **el caso normal.** La entry lleva solo `retention` + `retentionUntil` | las reglas completas *además* viajan en `retentionRules`, selladas con `policyVersion: 'E6-1'` |

`emitRules` no es la otra mitad de un par: es una escotilla, y viene apagado por una razón. Ver
abajo.

La exención se declara en la config de **la aplicación**, nunca por un transport sobre sí mismo: una
dependencia no puede publicar un sink que se exima solo. Un nombre desconocido lanza
`UnknownExemptTransportError` en `init()`, porque un typo acá enmascararía en silencio justo el sink
que tenía que guardar la evidencia.

## El puente de retención (2.0.0)

`withRetention('SOX_AUDIT_TRAIL')` pone el **nombre de la clase** en la entry — siempre un string,
porque todo mecanismo aguas abajo (un label matcher de Loki, un filtro de índice, el ruteo del sink)
matchea sobre un string de baja cardinalidad, y un campo que es string en unas entries y objeto en
otras es un conflicto de mapping en el ingest.

```json
"retention": "SOX_AUDIT_TRAIL",
"retentionUntil": "2033-08-22T20:58:22.617Z"
```

`retentionUntil` **no es un vencimiento**: llegar a esa fecha termina la obligación, no autoriza
borrar.

### Las reglas no viajan solas — se resuelven a demanda

La entry lleva el **nombre**, no las reglas. Un sink que necesita las reglas las pide **en el momento
de escribir**, que es lo que hace el ledger de este ejemplo dentro de su propio adapter:

```ts
// sink en proceso: la entry nos dio el nombre de la clase, la resolvemos acá
const rules = syntropyLog.getRetentionPolicy(entry.retention);
```

Es deliberado, y es por eso que `emitRules` viene apagado:

- **Vigencia.** Resolver al escribir da la regla *en vigor en ese momento*. Los registros se
  re-siembran; un registro escrito en 2026 y leído en 2030 no puede reportar la política de 2030.
- **Cardinalidad.** El nombre de clase es un string de baja cardinalidad sobre el que puede rutear
  cualquier mecanismo aguas abajo. Un objeto de reglas en cada entry es payload que sirve a un solo
  consumidor.

Prendé `emitRules` para exactamente una situación: que el consumidor esté **fuera del proceso** — un
shipper que lee JSON y no tiene registro contra el cual resolver. Ahí el sello `policyVersion` es lo
que permite que la regla persistida diga bajo qué revisión se archivó.

## Resolver una política sin logger

Un camino de dominio que persiste la clase en su propia columna necesita la misma respuesta que
obtuvo el logger. Mirá `out/out-of-logger.json`:

```json
{ "until": "2031-03-01T12:00:00.000Z",
  "untilWithoutYears": null }
```

La fecha sale de **2024-02-29**, un 29 de febrero, más 7 años — y cae el **1 de marzo**: un día de
más, nunca uno de menos, porque cerrar la ventana antes de tiempo es el fallo que castiga un auditor.
Una política sin `years` entero devuelve `null` en vez de inventar una fecha en una columna de
compliance.

Estos accesores están gateados por readiness, así que corren **antes** del `shutdown()`. Y el
`shutdown()` es lo que hace flush de los transports — sin él los archivos pueden quedar cortos.

> El `level: 'fatal'` de la config está solo para que el ruido de ciclo de vida del framework no
> ensucie estos archivos. La entry de auditoría igual llega: `audit` se emite **siempre**, sea cual
> sea el nivel configurado.
