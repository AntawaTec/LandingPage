/* ============================================================
   AntawaTec — Landing interactivity
   - Animated Vanta Topology background on the hero (Antawa colors)
   - Card checkout (Hotmart) SIMULADO — el real es un webhook server-side.
   - Bank transfer REAL: postea multipart a la edge function
     `bank-transfer-intake` del backend (anónima; el admin valida después).
   Reimplemented from the design prototype's React components as
   dependency-free vanilla JS.
   ============================================================ */

/* Endpoint del intake bancario. Global y con `var` a propósito: una página
   puede definir window.ANTAWA_CONFIG = { intakeUrl: "…" } ANTES de cargar
   landing.js para apuntar a otro entorno sin tocar este archivo. En local
   (http.server + stack de Supabase) apunta solo al functions serve. */
var INTAKE_URL =
  (window.ANTAWA_CONFIG && window.ANTAWA_CONFIG.intakeUrl) ||
  (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? "http://127.0.0.1:54321/functions/v1/bank-transfer-intake"
    : "https://qldeexeshdzrithjagqq.supabase.co/functions/v1/bank-transfer-intake");

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
     Modal host — manages open/close + which flow is active
     ---------------------------------------------------------- */
  const root = document.getElementById("modal-root");
  const container = document.getElementById("modal-container");
  let activeFlow = null;

  function openModal(flow) {
    activeFlow = flow;
    container.innerHTML = "";
    if (flow === "card") renderCard();
    else if (flow === "bank") renderBank();
    root.classList.add("open");
    document.body.style.overflow = "hidden";
    // Focus the first interactive element for keyboard users.
    const focusable = container.querySelector("input, button");
    if (focusable) focusable.focus();
  }

  function closeModal() {
    activeFlow = null;
    root.classList.remove("open");
    document.body.style.overflow = "";
    // Clear after the close transition.
    setTimeout(() => {
      if (!activeFlow) container.innerHTML = "";
    }, 250);
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
          <p>Tu pago con ${esc(via)} fue aprobado. Te enviamos un enlace mágico a <strong>${esc(email)}</strong>.</p>
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
     Card flow (Hotmart simulation): form → processing → done
     ---------------------------------------------------------- */
  function renderCard() {
    const node = el(`
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ck-title">
        ${closeButton()}
        <div class="hotmart-bar"><span class="dot"></span> Pago procesado por Hotmart · Conexión segura</div>
        <h3 id="ck-title">Activa tu taller en AntawaTec</h3>
        <p class="modal-sub">$20 al mes · Cancelas cuando quieras · Sin contratos</p>

        <form novalidate>
          <div class="form-field">
            <label for="ck-email">Email</label>
            <input id="ck-email" name="email" type="email" required placeholder="tu@taller.com" autocomplete="email" />
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="ck-name">Tu nombre</label>
              <input id="ck-name" type="text" required placeholder="Andrés Pérez" autocomplete="name" />
            </div>
            <div class="form-field">
              <label for="ck-shop">Nombre del taller</label>
              <input id="ck-shop" type="text" required placeholder="Mecánica Don Andrés" />
            </div>
          </div>
          <div class="form-field">
            <label for="ck-card">Número de tarjeta</label>
            <input id="ck-card" type="text" required placeholder="4242 4242 4242 4242" inputmode="numeric" autocomplete="cc-number" />
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="ck-exp">Vencimiento</label>
              <input id="ck-exp" type="text" required placeholder="MM/AA" autocomplete="cc-exp" />
            </div>
            <div class="form-field">
              <label for="ck-cvc">CVC</label>
              <input id="ck-cvc" type="text" required placeholder="123" autocomplete="cc-csc" />
            </div>
          </div>

          <button type="submit" class="modal-primary">Pagar $20 y empezar</button>
          <p class="modal-fine">
            Al continuar aceptas los Términos y la Política de Privacidad de Antawa.
            Tu suscripción se renueva automáticamente cada mes. Cancelas cuando quieras.
          </p>
        </form>
      </div>
    `);

    const form = node.querySelector("form");
    const submitBtn = node.querySelector(".modal-primary");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const email = node.querySelector("#ck-email").value || "tu@email.com";
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Procesando…';
      setTimeout(() => renderConfirmation(email, "tarjeta"), 1800);
    });

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
        <h3 id="bk-title">Transfiere $20 a esta cuenta</h3>
        <p class="modal-sub">Cuando recibamos tu comprobante, activamos tu taller en menos de 2 horas.</p>

        <div class="bank-details">
          <div class="label">Banco</div>
          <div class="val">Banco Pichincha</div>
          <div class="label">Tipo de cuenta</div>
          <div class="val">Corriente</div>
          <div class="label">Número de cuenta</div>
          <div class="val">2100 4488 71 <span class="copy-btn" data-copy="2100448871">Copiar</span></div>
          <div class="label">Beneficiario</div>
          <div class="val">Antawa S.A.S.</div>
          <div class="label">RUC</div>
          <div class="val">1793215467001</div>
          <div class="label">Email para comprobantes</div>
          <div class="val">pagos@antawa.tech</div>
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
      fd.set("amount", "20");
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
