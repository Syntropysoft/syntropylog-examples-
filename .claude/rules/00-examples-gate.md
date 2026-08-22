# syntropylog-examples — gate e invariantes del repo

> Ficha que consumen las skills `/sl-*` (nivel usuario). El método vive en la skill; los hechos de
> este repo, acá. Sin esta ficha, la skill se detiene.

## Cómo se trabaja acá (aplica antes que cualquier otra cosa)

- **La frontera es tuya, el código es mío.** Alcance, límites y fronteras — qué entra y qué no, qué
  se niega a hacer la librería, dónde termina su responsabilidad, qué se borra, qué promete el
  contrato — son decisiones del usuario y **se preguntan**. La implementación, los nombres, la
  estructura, los tests y la verificación son del agente: se hacen, no se consultan.
- **El tell, porque una decisión de frontera casi nunca parece una.** Si la respuesta a *"¿por qué
  así?"* es un **principio**, saliste del código y estás moviendo un límite → preguntá. Si es una
  **técnica**, decidí y seguí.
  *"Uso un Map porque el lookup es O(1)"* → técnica, mío.
  *"Devuelvo `null` porque no adivinamos"* → principio, tuyo.
- ❌ NEVER meter código sin análisis previo. Si algo no queda claro, **se pregunta** — no se elige
  la interpretación más razonable y se sigue.
- ✅ ALWAYS **el contexto que aporta el usuario se convierte en test**, no en doc. Un hecho de
  comportamiento — *"esto ya está en producción"*, *"siempre funcionó así"*, *"no cambies esto"* —
  se fija con un test cuyo **nombre** lo enuncia. Un doc se lee si alguien lo busca; un test falla
  cuando alguien lo contradice, sin que nadie recuerde la conversación.
- ❌ NEVER afirmar una negación ("no existe X") sin decir **dónde** se buscó.
- ❌ NEVER borrar porque el archivo destino existe. ✅ ALWAYS comparar **contenido**.
- ❌ NEVER una sonda manual como evidencia: o se vuelve test, o se dice "verificado a mano, sin test".

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
