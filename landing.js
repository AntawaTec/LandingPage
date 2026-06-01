/* ============================================================
   AntawaTec — Landing interactivity
   - Animated Vanta Topology background on the hero (Antawa colors)
   - Two simulated checkout flows: card (Hotmart) and bank transfer
   Reimplemented from the design prototype's React components as
   dependency-free vanilla JS.
   ============================================================ */
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
              <span class="upload-text">Click o arrastra una imagen / PDF aquí<br/><span style="font-size:12px;color:var(--ink-muted-48)">JPG, PNG o PDF · hasta 5 MB</span></span>
              <input id="proof" type="file" accept="image/*,application/pdf" style="display:none" />
            </label>
          </div>

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
    fileInput.addEventListener("change", () => {
      const name = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : "";
      if (name) {
        zone.classList.add("has-file");
        zone.querySelector(".upload-ic").textContent = "✓";
        zone.querySelector(".upload-text").innerHTML =
          `<strong>${esc(name)}</strong><br/><span style="font-size:12px">Click para cambiar</span>`;
        submitBtn.disabled = false;
      }
    });

    node.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      renderBankReview(state);
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
