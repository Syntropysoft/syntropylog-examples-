# syntropylog-examples — gate e invariantes del repo

> Ficha que consumen las skills `/sl-*` (nivel usuario). El método vive en la skill; los hechos de
> este repo, acá. Sin esta ficha, la skill se detiene.

## Qué es

23 ejemplos ejecutables (`00`–`22`) de SyntropyLog. Cada uno es un paquete independiente con su
propio `package.json` y su `README.md` (varios con gemelo `README-es.md`).

Un ejemplo **no es documentación**: es código que alguien copia y pega en producción. Un ejemplo que
enseña una API vieja hace más daño que un doc desactualizado, porque el doc se lee y el ejemplo se
ejecuta.

## Gate

⚠️ **No hay CI. No hay gate.** `.github/workflows/` no existe.

Hasta que exista, el gate es manual y por ejemplo tocado:

```
cd <NN-ejemplo> && npm install && npm run dev     # (o el script que declare su package.json)
```

❌ NEVER declarar un ejemplo "actualizado" porque compila: hay que **correrlo** y mirar la salida.
✅ ALWAYS decir explícitamente cuáles se corrieron y cuáles no.

## Invariantes

- ❌ NEVER que un ejemplo dependa de una versión de `syntropylog` distinta de la publicada como
  `latest`, salvo que el propio ejemplo declare por qué.
- ❌ NEVER que el comentario de cabecera de un ejemplo describa una semántica que la versión que
  pinnea ya no tiene.
- ✅ ALWAYS actualizar el `README.md` del ejemplo **y** su `README-es.md` si existe.
- ✅ ALWAYS que un ejemplo nuevo entre en la lista del README de SyntropyLog (hoy: "23 runnable
  examples (`00`–`22`)") — un ejemplo que nadie enlaza no existe.

## Estado conocido (2026-08-22) — deuda abierta

**Los 22 ejemplos con `package.json` pinnean `syntropylog@1.4.0`. `latest` en npm es `2.0.0`.**
Dos minors y **un major** atrás. Consecuencias verificadas:

- `19-retention-policies/src/index.ts:10` documenta `withRetention('NAME')` como *"binds it as
  `retention` metadata"* — la semántica **anterior** a 2.0.0. El major la invirtió: ahora liga el
  nombre de clase como string, y las reglas viajan opt-in en `retentionRules`. El ejemplo enseña el
  contrato eliminado.
- Ningún ejemplo ejercita `masking.exemptTransports` ni el paso nativo dual, ambos de 1.5.0.
- `22-distributed-orders-kafka` no pinnea en la raíz (resuelve por servicio) y es el único que
  ejercita propagación cross-proceso.

Nada de esto lo detecta nada, porque no hay gate.

## Fuente de verdad del estado

El `package.json` de cada ejemplo → el `CHANGELOG.md` de SyntropyLog (qué cambió entre la versión
pinneada y `latest`).
