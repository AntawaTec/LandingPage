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
sin tocar código definiendo `window.ANTAWA_CONFIG = { intakeUrl: "…" }` antes de
cargar `landing.js`.

## Estructura

- `index.html` — markup + sistema de diseño (tokens, tipografía, tiles, componentes).
- `landing.js` — interactividad sin dependencias: fondo animado del hero (Vanta
  Topology), checkout de tarjeta (Hotmart, simulado — el real es un webhook
  server-side) y flujo de transferencia bancaria REAL (multipart al intake).
- `assets/` — logos de Antawa Technologies (blanco para la nav, navy para el footer).

## Diseño

Sistema monocromático azul Antawa (`#203050`) con rojo de marca (`#e30613`) como
acento gráfico, y un único "pulso" amarillo (`#f3ce34`) reservado a la sección de
precio. Tiles full-bleed alternados (claro / suave / oscuro); el cambio de superficie
es el divisor. Sin pills, sin sombras decorativas, sin gradientes (salvo el header de
la card de precio). Tipografía Helvetica Neue, ladder 400 / 500 / 700.
