document.querySelectorAll("[data-current-year]").forEach(function (node) {
    node.textContent = new Date().getFullYear();
});

(function () {
    const dateEl = document.querySelector("[data-countdown]");
    if (!dateEl) return;
    const target = new Date(dateEl.getAttribute("data-countdown")).getTime();
    function tick() {
        const diff = target - Date.now();
        if (diff <= 0) {
            dateEl.textContent = "¡Hoy se corre!";
            return;
        }
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        dateEl.textContent = days + (days === 1 ? " día" : " días");
    }
    tick();
    setInterval(tick, 60 * 1000);
})();
