/* ============================================================
   AntawaTec — Landing interactivity
   - Animated Vanta Topology background on the hero (Antawa colors)
   - Card checkout REAL vía Payphone (Botón de pago por redirección):
     el modal pide taller + email, arranca el intento contra
     `payphone-prepare` y redirige a la página segura de Payphone;
     al volver, `payphone-confirm` confirma el cobro server-side.
   - Bank transfer REAL: postea multipart a la edge function
     `bank-transfer-intake` del backend (anónima; el admin valida después).
   Reimplemented from the design prototype's React components as
   dependency-free vanilla JS.
   ============================================================ */

/* Endpoints de las edge functions. Globales y con `var` a propósito: una
   página puede definir window.ANTAWA_CONFIG = { functionsBase: "…",
   intakeUrl: "…" } ANTES de cargar landing.js para apuntar a otro entorno
   sin tocar este archivo. En local (http.server + stack de Supabase) apunta
   solo al functions serve. */
var FUNCTIONS_BASE =
  (window.ANTAWA_CONFIG && window.ANTAWA_CONFIG.functionsBase) ||
  (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? "http://127.0.0.1:54321/functions/v1"
    : "https://qldeexeshdzrithjagqq.supabase.co/functions/v1");

var INTAKE_URL =
  (window.ANTAWA_CONFIG && window.ANTAWA_CONFIG.intakeUrl) ||
  FUNCTIONS_BASE + "/bank-transfer-intake";

var PAYPHONE_PREPARE_URL = FUNCTIONS_BASE + "/payphone-prepare";
var PAYPHONE_CONFIRM_URL = FUNCTIONS_BASE + "/payphone-confirm";

(function () {
  "use strict";

  /* ----------------------------------------------------------
     Hero background — Vanta Topology
     ---------------------------------------------------------- */
  function initVanta() {
    if (typeof VANTA === "undefined" || !VANTA.TOPOLOGY) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    VANTA.TOPOLOGY({
      el: "#hero-vanta",
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.0,
      minWidth: 200.0,
      scale: 1.0,
      scaleMobile: 1.0,
      backgroundColor: 0x203050, // Antawa navy
      color: 0xe30613,           // Antawa red
    });
  }

  /* ----------------------------------------------------------
     Small DOM helper — builds a node tree from a template string
     ---------------------------------------------------------- */
  function el(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  /* ----------------------------------------------------------
     JSON fetch helper — usado por el flujo de tarjeta (Payphone).
     Éxito solo si el status es exactamente `okStatus`; si no, intenta
     leer {error} del body y lanza un Error con .status + el mensaje
     (mismo contrato que el intake bancario, pero en JSON en vez de
     multipart).
     ---------------------------------------------------------- */
  function postJson(url, body, okStatus) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30000);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    })
      .then((res) => {
        if (res.status === okStatus) return res.json();
        return res.json().catch(() => null).then((data) => {
          const err = new Error((data && data.error) || "Ocurrió un error. Intenta de nuevo.");
          err.status = res.status;
          throw err;
        });
      })
      .finally(() => clearTimeout(timer));
  }

  // Mismo mapeo de mensajes que el flujo bancario (fetch multipart más abajo):
  // AbortError = timeout, TypeError = sin red/DNS/CORS, resto = {error} legible.
  function friendlyMessage(err, fallback) {
    return err && err.name === "AbortError"
      ? "La conexión tardó demasiado. Revisa tu internet e intenta de nuevo."
      : err instanceof TypeError
        ? "Error de red. Revisa tu conexión e intenta de nuevo."
        : (err && err.message) || fallback;
  }

  /* ----------------------------------------------------------
     Modal host — manages open/close + which flow is active
     ---------------------------------------------------------- */
  const root = document.getElementById("modal-root");
  const container = document.getElementById("modal-container");
  let activeFlow = null;
  // Mientras hay un confirm de Payphone en vuelo, el modal no se puede
  // cerrar (Escape, click en el fondo, o cualquier [data-close-modal]):
  // closeModal() no cancela el fetch, y si el usuario lo cerrara, el
  // resultado terminaría montándose sobre un container ya oculto — el
  // usuario creería que falló y podría intentar pagar de nuevo (doble cobro).
  let modalLocked = false;

  function openModal(flow) {
    activeFlow = flow;
    container.innerHTML = "";
    if (flow === "card") renderCard();
    else if (flow === "bank") renderBank();
    else if (typeof flow === "function") flow();
    root.classList.add("open");
    document.body.style.overflow = "hidden";
    // Focus the first interactive element for keyboard users.
    const focusable = container.querySelector("input, button");
    if (focusable) focusable.focus();
  }

  function closeModal() {
    if (modalLocked) return;
    activeFlow = null;
    root.classList.remove("open");
    document.body.style.overflow = "";
    // Clear after the close transition.
    setTimeout(() => {
      if (!activeFlow) container.innerHTML = "";
    }, 250);
  }

  // Defensa adicional: si por lo que sea el modal perdió la clase "open"
  // mientras confirmábamos (p. ej. otro código la tocó), la restauramos
  // antes de mostrar un resultado terminal — nunca se monta una vista
  // final sobre un modal invisible.
  function ensureModalOpen() {
    if (!root.classList.contains("open")) {
      root.classList.add("open");
      document.body.style.overflow = "hidden";
    }
  }

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-checkout-trigger]");
    if (trigger) {
      e.preventDefault();
      openModal(trigger.dataset.checkoutTrigger);
      return;
    }
    if (e.target.matches("[data-close-modal]")) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeFlow) closeModal();
  });

  /* ----------------------------------------------------------
     Retorno de Payphone — el usuario vuelve del checkout hosteado.
     Con ?id=&clientTransactionId= confirmamos el pago server-side. A
     propósito NO limpiamos la URL acá: si el usuario recarga mientras
     "Confirmando tu pago…" o tras un error, necesitamos seguir teniendo
     id/clientTransactionId para poder reintentar (el confirm es
     idempotente). La URL solo se limpia dentro de renderCardResult, justo
     antes de mostrar un resultado terminal (approved/cancelled).
     Con ?pago=cancelado no hay nada que reintentar, así que ahí sí
     limpiamos de inmediato.
     ---------------------------------------------------------- */
  const returnParams = new URLSearchParams(location.search);
  if (returnParams.has("id") && returnParams.has("clientTransactionId")) {
    const returnId = returnParams.get("id");
    const returnCtid = returnParams.get("clientTransactionId");
    openModal(() => renderCardResult(returnId, returnCtid));
  } else if (returnParams.get("pago") === "cancelado") {
    history.replaceState(null, "", location.pathname + location.hash);
    openModal(() => renderCardCancelled());
  }

  function mount(node) {
    container.innerHTML = "";
    container.appendChild(node);
  }

  function closeButton() {
    return '<button class="modal-close" aria-label="Cerrar" data-close-modal>×</button>';
  }

  /* ----------------------------------------------------------
     Confirmation view (shared by the card flow)
     ---------------------------------------------------------- */
  function renderConfirmation(email, via) {
    mount(el(`
      <div class="modal" role="dialog" aria-modal="true">
        ${closeButton()}
        <div class="modal-confirm">
          <div class="check">✓</div>
          <h3>¡Bienvenido a AntawaTec!</h3>
          <p>Tu pago con ${esc(via)} fue aprobado. Te enviamos a <strong>${esc(email)}</strong> el enlace para entrar a tu taller. Revisa también spam.</p>
          <div class="magic-card">
            <div class="from">De: hola@antawa.tech</div>
            <div class="subj">Tu taller en AntawaTec está listo</div>
            <div>Un solo click. Sin contraseñas. Tu cuenta vacía, lista para tu primer cliente.</div>
            <span class="link">Entrar a mi taller →</span>
          </div>
          <button class="modal-primary" data-close-modal>Entendido</button>
        </div>
      </div>
    `));
  }

  /* ----------------------------------------------------------
     Card flow (Payphone — Botón de pago por redirección):
     form → payphone-prepare → redirige a la página segura de Payphone.
     La confirmación pasa al volver (ver "Retorno de Payphone" arriba).
     ---------------------------------------------------------- */
  function renderCard() {
    const node = el(`
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ck-title">
        ${closeButton()}
        <div class="gateway-bar"><span class="dot"></span> Pago procesado por Payphone · Conexión segura</div>
        <h3 id="ck-title">Activa tu taller en AntawaTec</h3>
        <p class="modal-sub">$25 al mes · Cancelas cuando quieras · Sin contratos</p>

        <form novalidate>
          <div class="form-field">
            <label for="ck-shop">Nombre del taller</label>
            <input id="ck-shop" type="text" required placeholder="Mecánica Don Andrés" />
          </div>
          <div class="form-field">
            <label for="ck-email">Email</label>
            <input id="ck-email" type="email" required placeholder="tu@taller.com" autocomplete="email" />
          </div>

          <input type="text" name="website" value="" autocomplete="off" tabindex="-1" aria-hidden="true"
                 style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0" />

          <p class="modal-error" role="alert" hidden></p>

          <button type="submit" class="modal-primary">Pagar $25 con Payphone</button>
          <p class="modal-fine">
            Te llevaremos a la página segura de Payphone para pagar con tarjeta.
            Al volver, activamos tu taller.
          </p>
        </form>
      </div>
    `);

    const form = node.querySelector("form");
    const shopInput = node.querySelector("#ck-shop");
    const emailInput = node.querySelector("#ck-email");
    const submitBtn = node.querySelector(".modal-primary");
    const errorEl = node.querySelector(".modal-error");

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }
    function clearError() {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      clearError();

      const businessName = shopInput.value;
      const email = emailInput.value;
      const website = node.querySelector('input[name="website"]').value;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Redirigiendo a Payphone…';

      postJson(PAYPHONE_PREPARE_URL, { businessName, email, website }, 201)
        .then((res) => {
          location.assign(res.payWithCard);
        })
        .catch((err) => {
          // El formulario queda intacto: el reintento es volver a apretar el
          // botón, sin re-escribir nada (igual que el flujo bancario).
          showError(friendlyMessage(err, "No pudimos iniciar el pago. Intenta de nuevo."));
          submitBtn.disabled = false;
          submitBtn.textContent = "Pagar $25 con Payphone";
        });
    });

    mount(node);
  }

  /* ----------------------------------------------------------
     Card flow — retorno de Payphone: confirmar el cobro server-side.
     Payphone reversa el cobro si no confirmamos en 5 min, así que el
     reintento ante un 409 ("otro confirm en curso") importa de verdad.
     ---------------------------------------------------------- */
  function renderCardResult(id, ctid, attempt) {
    attempt = attempt || 1;
    // Bloqueamos el modal (`modalLocked`) mientras este confirm está en
    // vuelo: sin botón de cerrar, y Escape/backdrop tampoco lo cierran
    // (ver closeModal arriba) — así el resultado nunca se monta sobre un
    // container ya oculto ni pierde su única URL de recuperación.
    modalLocked = true;
    mount(el(`
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-confirm">
          <div class="check" style="background: var(--canvas-soft);">
            <span class="spinner" style="width:28px;height:28px;border-width:3px;border-color:rgba(32,48,80,0.15);border-top-color:var(--primary);"></span>
          </div>
          <h3>Confirmando tu pago…</h3>
          <p>No cierres esta ventana.</p>
        </div>
      </div>
    `));

    postJson(PAYPHONE_CONFIRM_URL, { id: Number(id), clientTransactionId: ctid }, 200)
      .then((res) => {
        // Resultado terminal: recién ahora desbloqueamos el modal y
        // limpiamos id/clientTransactionId de la URL (antes de esto, un
        // reload debe poder reintentar).
        if (res.status === "approved") {
          modalLocked = false;
          ensureModalOpen();
          history.replaceState(null, "", location.pathname + location.hash);
          renderConfirmation(res.email, "tarjeta");
        } else if (res.status === "cancelled") {
          modalLocked = false;
          ensureModalOpen();
          history.replaceState(null, "", location.pathname + location.hash);
          renderCardCancelled();
        } else {
          modalLocked = false;
          ensureModalOpen();
          renderCardError(id, ctid, "Ocurrió un problema inesperado. Intenta de nuevo.");
        }
      })
      .catch((err) => {
        if (err && err.status === 409 && attempt < 5) {
          // Seguimos bloqueados: renderCardResult se vuelve a llamar y
          // vuelve a fijar modalLocked = true de todos modos.
          setTimeout(() => renderCardResult(id, ctid, attempt + 1), 3000);
          return;
        }
        modalLocked = false;
        ensureModalOpen();
        renderCardError(id, ctid, friendlyMessage(err, "No pudimos confirmar tu pago. Intenta de nuevo."));
      });
  }

  function renderCardError(id, ctid, message) {
    const node = el(`
      <div class="modal" role="dialog" aria-modal="true">
        ${closeButton()}
        <div class="modal-confirm">
          <h3>No pudimos confirmar tu pago</h3>
          <p>${esc(message)}</p>
          <button class="modal-primary" data-retry>Reintentar</button>
          <p class="modal-fine">
            Si el problema continúa, escríbenos y lo resolvemos (no se te cobra dos veces).
          </p>
        </div>
      </div>
    `);
    node.querySelector("[data-retry]").addEventListener("click", () => renderCardResult(id, ctid));
    mount(node);
  }

  function renderCardCancelled() {
    const node = el(`
      <div class="modal" role="dialog" aria-modal="true">
        ${closeButton()}
        <div class="modal-confirm">
          <div class="check" style="background: var(--canvas-soft); color: var(--ink-muted-70);">✕</div>
          <h3>Pago cancelado</h3>
          <p>No se realizó ningún cobro.</p>
          <button class="modal-primary" data-retry>Intentar de nuevo</button>
          <button class="modal-secondary" data-close-modal>Cerrar</button>
        </div>
      </div>
    `);
    node.querySelector("[data-retry]").addEventListener("click", () => renderCard());
    mount(node);
  }

  /* ----------------------------------------------------------
     Bank flow: form → bank details + proof upload → review
     ---------------------------------------------------------- */
  function renderBank() {
    renderBankForm({ shop: "", email: "" });
  }

  function renderBankForm(state) {
    const node = el(`
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="bk-title">
        ${closeButton()}
        <h3 id="bk-title">Pagar con transferencia</h3>
        <p class="modal-sub">Cuéntanos a dónde enviar el acceso. En el siguiente paso te mostramos los datos bancarios.</p>

        <form novalidate>
          <div class="form-field">
            <label for="bk-shop">Nombre del taller</label>
            <input id="bk-shop" type="text" required placeholder="Mecánica Don Andrés" />
          </div>
          <div class="form-field">
            <label for="bk-email">Email del taller</label>
            <input id="bk-email" type="email" required placeholder="tu@taller.com" autocomplete="email" />
          </div>

          <button type="submit" class="modal-primary">Ver datos bancarios →</button>
          <p class="modal-fine">
            Tu taller queda activo cuando nuestro equipo valide el comprobante
            (10 minutos a 2 horas en horario laboral).
          </p>
        </form>
      </div>
    `);

    const shopInput = node.querySelector("#bk-shop");
    const emailInput = node.querySelector("#bk-email");
    shopInput.value = state.shop;
    emailInput.value = state.email;

    node.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      if (!form.reportValidity()) return;
      renderBankDetails({ shop: shopInput.value, email: emailInput.value });
    });

    mount(node);
  }

  function renderBankDetails(state) {
    const node = el(`
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="bk-title">
        ${closeButton()}
        <h3 id="bk-title">Transfiere $25 a esta cuenta</h3>
        <p class="modal-sub">Cuando recibamos tu comprobante, activamos tu taller en menos de 2 horas.</p>

        <div class="bank-details">
          <div class="label">Banco</div>
          <div class="val">Produbanco</div>
          <div class="label">Tipo de cuenta</div>
          <div class="val">Cuenta Pro Pyme</div>
          <div class="label">Número de cuenta</div>
          <div class="val">2705 9080 294 <span class="copy-btn" data-copy="27059080294">Copiar</span></div>
          <div class="label">Beneficiario</div>
          <div class="val">ANTAWATEC S.A.S.</div>
          <div class="label">RUC</div>
          <div class="val">1793218430001</div>
          <div class="label">Email para comprobantes</div>
          <div class="val">mshpapp@antwt.com</div>
          <div class="label">Teléfono</div>
          <div class="val">0983924303</div>
        </div>

        <form novalidate>
          <div class="form-field">
            <label>Sube el comprobante de transferencia</label>
            <label for="proof" class="upload-zone">
              <div class="upload-ic">↑</div>
              <span class="upload-text">Click o arrastra una imagen / PDF aquí<br/><span style="font-size:12px;color:var(--ink-muted-48)">JPG, PNG, WebP o PDF · hasta 5 MB</span></span>
              <input id="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style="display:none" />
            </label>
          </div>

          <input type="text" name="website" value="" autocomplete="off" tabindex="-1" aria-hidden="true"
                 style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0" />

          <p class="modal-error" role="alert" hidden></p>

          <button type="submit" class="modal-primary" disabled>Enviar comprobante</button>
          <button type="button" class="modal-secondary" data-back>← Volver</button>
        </form>
      </div>
    `);

    const copyBtn = node.querySelector(".copy-btn");
    copyBtn.addEventListener("click", () => {
      if (navigator.clipboard) navigator.clipboard.writeText(copyBtn.dataset.copy);
      copyBtn.textContent = "✓ Copiado";
    });

    const zone = node.querySelector(".upload-zone");
    const fileInput = node.querySelector("#proof");
    const submitBtn = node.querySelector(".modal-primary");
    const errorEl = node.querySelector(".modal-error");

    // Espejo client-side de la validación del intake (el server manda igual).
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const MAX_BYTES = 5 * 1024 * 1024;

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }
    function clearError() {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }

    fileInput.addEventListener("change", () => {
      clearError();
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (ALLOWED_TYPES.indexOf(file.type) === -1) {
        showError("Formato no soportado: sube un JPG, PNG, WebP o PDF.");
        fileInput.value = "";
        submitBtn.disabled = true;
        return;
      }
      if (file.size > MAX_BYTES) {
        showError("El archivo pesa más de 5 MB. Comprime la imagen o vuelve a exportar el PDF.");
        fileInput.value = "";
        submitBtn.disabled = true;
        return;
      }
      zone.classList.add("has-file");
      zone.querySelector(".upload-ic").textContent = "✓";
      zone.querySelector(".upload-text").innerHTML =
        `<strong>${esc(file.name)}</strong><br/><span style="font-size:12px">Click para cambiar</span>`;
      submitBtn.disabled = false;
    });

    node.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      clearError();
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Enviando…';

      const fd = new FormData();
      fd.set("businessName", state.shop);
      fd.set("email", state.email);
      fd.set("amount", "25");
      // Honeypot: vacío para humanos; un bot que lo llenó se delata solo.
      fd.set("website", node.querySelector('input[name="website"]').value);
      fd.set("file", file);

      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 30000);

      fetch(INTAKE_URL, { method: "POST", body: fd, signal: ctl.signal })
        .then((res) => {
          if (res.status === 201) {
            renderBankReview(state);
            return;
          }
          // El intake responde {error} legible (400/429/500); si no, genérico.
          return res.json().catch(() => null).then((body) => {
            throw new Error(
              (body && body.error) || "No pudimos recibir tu comprobante. Intenta de nuevo.",
            );
          });
        })
        .catch((err) => {
          // El archivo elegido y el formulario quedan intactos: el reintento
          // es volver a apretar el botón, sin re-elegir nada.
          // TypeError = fetch no llegó al server (sin red / DNS / CORS): mensaje
          // propio. Los {error} del intake ya vienen legibles y en español.
          showError(
            err && err.name === "AbortError"
              ? "La conexión tardó demasiado. Revisa tu internet e intenta de nuevo."
              : err instanceof TypeError
                ? "Error de red. Revisa tu conexión e intenta de nuevo."
                : (err && err.message) || "No pudimos recibir tu comprobante. Intenta de nuevo.",
          );
          submitBtn.disabled = false;
          submitBtn.textContent = "Enviar comprobante";
        })
        .finally(() => clearTimeout(timer));
    });
    node.querySelector("[data-back]").addEventListener("click", () => renderBankForm(state));

    mount(node);
  }

  function renderBankReview(state) {
    mount(el(`
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="bk-title">
        ${closeButton()}
        <div class="modal-confirm">
          <div class="check" style="background: var(--accent-pulse); color: var(--accent-pulse-ink);">⏳</div>
          <h3 id="bk-title">Recibimos tu comprobante</h3>
          <p>
            Nuestro equipo revisa tu pago manualmente. Suele tomar
            entre <strong>10 minutos y 2 horas</strong> en horario laboral.
          </p>
          <div class="magic-card">
            <div class="from">De: hola@antawa.tech</div>
            <div class="subj">Cuando aprobemos, te enviaremos a ${esc(state.email || "tu@email.com")}:</div>
            <div>“Tu taller en AntawaTec está listo. Entra con un click.”</div>
            <span class="link">Entrar a ${esc(state.shop || "mi taller")} →</span>
          </div>
          <button class="modal-primary" data-close-modal>Entendido</button>
        </div>
      </div>
    `));
  }

  /* ----------------------------------------------------------
     Boot
     ---------------------------------------------------------- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVanta);
  } else {
    initVanta();
  }
})();
