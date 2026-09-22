# AntawaTec — Landing Page

Landing page de **AntawaTec**, la plataforma para talleres mecánicos del Ecuador.
Implementada a partir del diseño de Claude Design (`Landing AntawaTec.html`).

## Stack

Sitio estático, sin build. Sírvelo SIEMPRE con un servidor http (no `file://`:
el submit real del flujo bancario hace `fetch` y el origen `null` de file:// lo
rompe):

```bash
python3 -m http.server 8080   # luego abre http://localhost:8080
```

## Probar el flujo bancario en local

El modal de transferencia postea de verdad a la edge function
`bank-transfer-intake`. En `localhost`/`127.0.0.1`, `landing.js` apunta solo al
stack local del backend:

```bash
cd ../AntawaTec-BE && ./scripts/seed-test.sh          # supabase start + seed
supabase functions serve --env-file supabase/functions/.env   # dejar corriendo
```

Luego: modal "Pagar con transferencia" → datos + archivo → "Recibimos tu
comprobante", y la fila queda `pending` en `bank_transfer_proofs` (Studio en
`:54323`). En cualquier otro host apunta al proyecto hosted; se puede overridear
sin tocar código definiendo `window.ANTAWA_CONFIG = { intakeUrl: "…" }` (o
`{ functionsBase: "…" }` para mover los tres endpoints a la vez) antes de
cargar `landing.js`.

## Probar el pago con tarjeta en local

El modal de tarjeta postea de verdad contra `payphone-prepare` y redirige al
checkout hosteado de Payphone; al volver, `payphone-confirm` confirma el cobro
server-side. Para probarlo en local necesitas una app de **pruebas**: en
https://appdeveloper.payphonetodoesposible.com crea una aplicación tipo
**WEB**, con "Dominio web" `www.antwt.com` y "URL de respuesta"
`https://www.antwt.com/`; el Token y el StoreID están en la pestaña
**Credenciales**, y el teléfono de quien pruebe se registra en
**Probadores → Clientes**. Con esas credenciales en
`../AntawaTec-BE/supabase/functions/.env`:

```
PAYPHONE_TOKEN=…
PAYPHONE_STORE_ID=…
PAYPHONE_RESPONSE_URL=http://localhost:8080/
PAYPHONE_CANCELLATION_URL=http://localhost:8080/?pago=cancelado
```

Con esas variables cargadas:

```bash
cd ../AntawaTec-BE && supabase functions serve --env-file supabase/functions/.env
```

Flujo: modal "Pagar con tarjeta" → taller + email → `payphone-prepare` →
redirige al sandbox de Payphone (con la app de pruebas, aprueba cualquier
tarjeta) → vuelve a `http://localhost:8080/?id=…&clientTransactionId=…` →
`payphone-confirm` → "¡Bienvenido a AntawaTec!". En Studio (`:54323`) revisa
`card_payment_intents` (debe quedar `approved`), `shops` (taller nuevo) y
`subscriptions` (`provider = 'payphone'`). Cancelar desde el checkout de
Payphone lleva a `?pago=cancelado` y muestra el modal de pago cancelado. Se
puede apuntar a otro entorno sin tocar código con
`window.ANTAWA_CONFIG = { functionsBase: "…" }` antes de cargar `landing.js`.

## Estructura

- `index.html` — markup + sistema de diseño (tokens, tipografía, tiles, componentes).
- `landing.js` — interactividad sin dependencias: fondo animado del hero (Vanta
  Topology), checkout de tarjeta REAL vía Payphone (botón de pago por
  redirección) y flujo de transferencia bancaria REAL (multipart al intake).
- `assets/` — logos de Antawa Technologies (blanco para la nav, navy para el footer).

## Diseño

Sistema monocromático azul Antawa (`#203050`) con rojo de marca (`#e30613`) como
acento gráfico, y un único "pulso" amarillo (`#f3ce34`) reservado a la sección de
precio. Tiles full-bleed alternados (claro / suave / oscuro); el cambio de superficie
es el divisor. Sin pills, sin sombras decorativas, sin gradientes (salvo el header de
la card de precio). Tipografía Helvetica Neue, ladder 400 / 500 / 700.
