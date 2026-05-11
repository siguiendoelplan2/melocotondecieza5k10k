document.addEventListener("DOMContentLoaded", function () {
    const STORAGE_KEY = "melocoton_cookie_consent";
    const consent = localStorage.getItem(STORAGE_KEY);

    if (consent) return;

    const inSubfolder = window.location.pathname
        .replace(/\/$/, "")
        .split("/")
        .filter(Boolean).length > 0
        && !/\/index\.html$/i.test(window.location.pathname)
        ? true
        : window.location.pathname.split("/").filter(Boolean).length > 1;

    const basePath = inSubfolder ? "../" : "./";

    const banner = document.createElement("div");
    banner.id = "melocoton-cookie-banner";
    banner.className = "cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Aviso de cookies");

    banner.innerHTML = `
        <div class="cookie-content">
            <p><strong>Tu privacidad nos importa.</strong> Esta web usa cookies técnicas necesarias para funcionar y, si nos lo permites, recursos externos como tipografías y el widget de Instagram. Más detalles en la <a href="${basePath}cookies/">política de cookies</a> y la <a href="${basePath}privacidad/">política de privacidad</a>.</p>
        </div>
        <div class="cookie-buttons">
            <button id="btn-accept-cookies" class="btn-cookie btn-accept" type="button">Aceptar todas</button>
            <button id="btn-reject-cookies" class="btn-cookie btn-reject" type="button">Solo necesarias</button>
        </div>
    `;

    document.body.appendChild(banner);

    document.getElementById("btn-accept-cookies").addEventListener("click", function () {
        localStorage.setItem(STORAGE_KEY, "all");
        cerrarBanner();
    });

    document.getElementById("btn-reject-cookies").addEventListener("click", function () {
        localStorage.setItem(STORAGE_KEY, "essential");
        cerrarBanner();
    });

    function cerrarBanner() {
        banner.classList.add("fade-out");
        setTimeout(function () { banner.remove(); }, 300);
    }
});
