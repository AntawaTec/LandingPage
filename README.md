# AntawaTec — Landing Page

Landing page de **AntawaTec**, la plataforma para talleres mecánicos del Ecuador.
Implementada a partir del diseño de Claude Design (`Landing AntawaTec.html`).

## Stack

Sitio estático, sin build. Abre `index.html` directamente o sírvelo con cualquier
servidor estático.

```bash
python3 -m http.server 8000   # luego abre http://localhost:8000
```

## Estructura

- `index.html` — markup + sistema de diseño (tokens, tipografía, tiles, componentes).
- `landing.js` — interactividad sin dependencias: fondo animado del hero (Vanta
  Topology) y los dos flujos de checkout simulados (tarjeta vía Hotmart y
  transferencia bancaria).
- `assets/` — logos de Antawa Technologies (blanco para la nav, navy para el footer).

## Diseño

Sistema monocromático azul Antawa (`#203050`) con rojo de marca (`#e30613`) como
acento gráfico, y un único "pulso" amarillo (`#f3ce34`) reservado a la sección de
precio. Tiles full-bleed alternados (claro / suave / oscuro); el cambio de superficie
es el divisor. Sin pills, sin sombras decorativas, sin gradientes (salvo el header de
la card de precio). Tipografía Helvetica Neue, ladder 400 / 500 / 700.
