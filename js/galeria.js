/* ============================================================
   Galería de fotos — 5K y 10K Melocotón de Cieza
   Índice de categorías → cuadrícula de celdas (carga incremental)
   → lightbox (original desde Google Drive bajo demanda).

   Rendimiento: la cuadrícula usa miniaturas LOCALES estáticas
   (./thumbs/<cat>/<archivo>.jpg) servidas por la CDN del hosting.
   A Drive solo se le pide al abrir el lightbox (ver/descargar).
   ============================================================ */
(function () {
    "use strict";

    var DATA_URL = "./gallery.json";
    var BATCH = 24;                 // celdas por lote en la carga incremental
    var DRIVE_VIEW = "https://drive.google.com/thumbnail?id=%ID%&sz=w1600";
    var DRIVE_DOWNLOAD = "https://drive.google.com/uc?export=download&id=%ID%";

    var data = null;                // gallery.json
    var catsById = Object.create(null);   // sin prototipo: evita prototype-pollution vía ?cat=__proto__/toString
    var view = { catId: null, offset: 0, observer: null };
    var lb = { open: false, items: null, idx: 0, catNombre: "" };

    var els = {};

    /* ---------- Utilidades ---------- */
    // Escapa texto antes de insertarlo como HTML (defensa XSS, aunque gallery.json sea propio)
    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
    function thumbLocal(catId, nombre) {
        var base = nombre.replace(/\.[^.]+$/, "");
        return "./thumbs/" + encodeURIComponent(catId) + "/" + encodeURIComponent(base) + ".jpg";
    }
    // encodeURIComponent en el id: lo hace seguro tanto en la URL como dentro de innerHTML
    function driveView(id) { return DRIVE_VIEW.replace("%ID%", encodeURIComponent(id)); }
    function driveDownload(id) { return DRIVE_DOWNLOAD.replace("%ID%", encodeURIComponent(id)); }
    function itemsDeCelda(celda) { return Array.isArray(celda) ? celda : [celda]; }
    function coverDeCelda(celda) { return itemsDeCelda(celda)[0]; }
    function fotosDeCategoria(cat) {
        return cat.celdas.reduce(function (n, c) { return n + itemsDeCelda(c).length; }, 0);
    }

    /* ---------- Arranque ---------- */
    function init() {
        els.indice = document.getElementById("galIndice");
        els.categoria = document.getElementById("galCategoria");
        els.gridCats = document.getElementById("galGridCategorias");
        els.grid = document.getElementById("galGrid");
        els.catTitle = document.getElementById("galCatTitle");
        els.catCount = document.getElementById("galCatCount");
        els.volver = document.getElementById("galVolver");
        els.sentinel = document.getElementById("galSentinel");
        els.lightbox = document.getElementById("galLightbox");
        if (!els.indice) return;

        fetch(DATA_URL)
            .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
            .then(function (json) {
                data = json;
                data.categorias.forEach(function (c) { catsById[c.id] = c; });
                construirIndice();
                bindGlobal();
                syncFromUrl();
            })
            .catch(function (e) {
                els.indice.innerHTML =
                    '<div class="note"><strong>No se pudo cargar la galería.</strong> ' +
                    "Inténtalo de nuevo más tarde.</div>";
                console.error("Galería:", e);
            });
    }

    /* ---------- Índice de categorías ---------- */
    function construirIndice() {
        els.gridCats.innerHTML = "";
        data.categorias.forEach(function (cat) {
            var nFotos = cat.totalFotos != null ? cat.totalFotos : fotosDeCategoria(cat);
            var a = document.createElement("a");
            a.className = "galeria-tile";
            a.href = "?cat=" + encodeURIComponent(cat.id);
            a.setAttribute("aria-label", cat.nombre + " (" + nFotos + " fotos)");
            var cover = cat.celdas.length ? coverDeCelda(cat.celdas[0]) : null;
            if (cover) {
                var img = document.createElement("img");
                img.className = "tile-bg";
                img.loading = "lazy";
                img.decoding = "async";
                img.alt = "";
                img.src = thumbLocal(cat.id, cover.nombre);
                a.appendChild(img);
            }
            var content = document.createElement("div");
            content.className = "tile-content";
            content.innerHTML =
                "<h3><span class='tile-icon'>" + esc(cat.icono || "") + "</span> " + esc(cat.nombre) + "</h3>" +
                "<span>" + nFotos + " foto" + (nFotos === 1 ? "" : "s") + "</span>";
            a.appendChild(content);
            a.addEventListener("click", function (ev) {
                ev.preventDefault();
                navegar(cat.id);
            });
            els.gridCats.appendChild(a);
        });
    }

    /* ---------- Vista de categoría (cuadrícula incremental) ---------- */
    function abrirCategoria(catId) {
        var cat = catsById[catId];
        if (!cat) { mostrarIndice(); return; }

        view.catId = catId;
        view.offset = 0;
        desconectarObserver();

        els.indice.hidden = true;
        els.categoria.hidden = false;
        els.catTitle.innerHTML = "<span class='gal-icon'>" + esc(cat.icono || "") + "</span>" + esc(cat.nombre);
        var nFotos = cat.totalFotos != null ? cat.totalFotos : fotosDeCategoria(cat);
        els.catCount.textContent = nFotos + " fotos · " + cat.celdas.length + " momentos";
        els.grid.innerHTML = "";

        cargarLote();
        conectarObserver();
        window.scrollTo({ top: 0, behavior: "auto" });
    }

    function cargarLote() {
        var cat = catsById[view.catId];
        if (!cat) return;
        var fin = Math.min(view.offset + BATCH, cat.celdas.length);
        for (var i = view.offset; i < fin; i++) {
            els.grid.appendChild(crearCelda(cat, cat.celdas[i], i));
        }
        view.offset = fin;
        if (view.offset >= cat.celdas.length) desconectarObserver();
    }

    function crearCelda(cat, celda, idx) {
        var items = itemsDeCelda(celda);
        var cover = items[0];
        var btn = document.createElement("button");
        btn.className = "gal-cell";
        btn.type = "button";
        btn.setAttribute("aria-label",
            items.length > 1 ? "Carrusel de " + items.length + " fotos" : "Ver foto");

        var img = document.createElement("img");
        img.loading = "lazy";
        img.decoding = "async";
        img.alt = cat.nombre;
        img.addEventListener("load", function () { img.classList.add("cargada"); });
        img.src = thumbLocal(cat.id, cover.nombre);
        btn.appendChild(img);

        if (items.length > 1) {
            var badge = document.createElement("span");
            badge.className = "gal-cell-badge";
            badge.innerHTML = "⧉ " + items.length;
            btn.appendChild(badge);
        }
        btn.addEventListener("click", function () { abrirLightbox(cat, items); });
        return btn;
    }

    function conectarObserver() {
        if (!("IntersectionObserver" in window)) return;
        view.observer = new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting) cargarLote();
        }, { rootMargin: "600px 0px" });
        view.observer.observe(els.sentinel);
    }
    function desconectarObserver() {
        if (view.observer) { view.observer.disconnect(); view.observer = null; }
    }

    /* ---------- Lightbox ---------- */
    function abrirLightbox(cat, items) {
        lb.open = true;
        lb.items = items;
        lb.idx = 0;
        lb.catNombre = cat.nombre;
        els.lightbox.hidden = false;
        document.body.style.overflow = "hidden";
        history.pushState({ gal: "lb" }, "", location.pathname + location.search + "#ver");
        mostrarFoto();
    }

    function cerrarLightbox(desdePop) {
        if (!lb.open) return;
        lb.open = false;
        els.lightbox.hidden = true;
        document.body.style.overflow = "";
        lb.items = null;
        if (!desdePop && location.hash === "#ver") history.back();
    }

    function mostrarFoto() {
        var it = lb.items[lb.idx];
        var multi = lb.items.length > 1;
        els.lightbox.innerHTML = "";

        var stage = document.createElement("div");
        stage.className = "gal-lb-stage";

        var spin = document.createElement("div");
        spin.className = "gal-lb-spinner";
        stage.appendChild(spin);

        var img = document.createElement("img");
        img.className = "gal-lb-img";
        img.alt = lb.catNombre + " — " + it.nombre;
        img.addEventListener("load", function () {
            img.classList.add("cargada");
            if (spin.parentNode) spin.parentNode.removeChild(spin);
        });
        img.addEventListener("error", function () {
            if (spin.parentNode) spin.parentNode.removeChild(spin);
            var err = document.createElement("div");
            err.className = "gal-lb-error";
            err.innerHTML = "No se pudo cargar la imagen original.<br>" +
                "<a href='" + driveDownload(it.id) + "' target='_blank' rel='noopener'>Abrir en Google Drive</a>";
            stage.appendChild(err);
        });
        img.src = driveView(it.id);
        stage.appendChild(img);

        var close = document.createElement("button");
        close.className = "gal-lb-btn gal-lb-close";
        close.type = "button";
        close.setAttribute("aria-label", "Cerrar");
        close.innerHTML = "✕";
        close.addEventListener("click", function () { cerrarLightbox(false); });
        stage.appendChild(close);

        if (multi) {
            var prev = document.createElement("button");
            prev.className = "gal-lb-btn gal-lb-prev";
            prev.type = "button";
            prev.setAttribute("aria-label", "Anterior");
            prev.innerHTML = "‹";
            prev.addEventListener("click", function () { navFoto(-1); });
            stage.appendChild(prev);

            var next = document.createElement("button");
            next.className = "gal-lb-btn gal-lb-next";
            next.type = "button";
            next.setAttribute("aria-label", "Siguiente");
            next.innerHTML = "›";
            next.addEventListener("click", function () { navFoto(1); });
            stage.appendChild(next);
        }
        els.lightbox.appendChild(stage);

        var bar = document.createElement("div");
        bar.className = "gal-lb-bar";
        bar.innerHTML =
            "<span class='gal-lb-caption'>" + esc(lb.catNombre) + "</span>" +
            "<span class='gal-lb-counter'>" + (multi ? (lb.idx + 1) + " / " + lb.items.length : "") + "</span>";
        var dl = document.createElement("a");
        dl.className = "gal-lb-download";
        dl.href = driveDownload(it.id);
        dl.target = "_blank";
        dl.rel = "noopener";
        dl.innerHTML = "⬇ Descargar original";
        bar.appendChild(dl);
        els.lightbox.appendChild(bar);

        prefetchVecinas();
    }

    function navFoto(delta) {
        if (!lb.items) return;
        var n = lb.items.length;
        lb.idx = (lb.idx + delta + n) % n;
        mostrarFoto();
    }

    function prefetchVecinas() {
        if (!lb.items || lb.items.length < 2) return;
        [lb.idx - 1, lb.idx + 1].forEach(function (i) {
            if (i >= 0 && i < lb.items.length) {
                var im = new Image();
                im.src = driveView(lb.items[i].id);
            }
        });
    }

    /* ---------- Routing (índice ↔ categoría) ---------- */
    function navegar(catId) {
        if (catId) history.pushState({ gal: "cat", catId: catId }, "", "?cat=" + encodeURIComponent(catId));
        else history.pushState({ gal: "indice" }, "", location.pathname);
        syncFromUrl();
    }
    function mostrarIndice() {
        view.catId = null;
        desconectarObserver();
        els.categoria.hidden = true;
        els.indice.hidden = false;
    }
    function syncFromUrl() {
        var params = new URLSearchParams(location.search);
        var catId = params.get("cat");
        if (catId && catsById[catId]) {
            // Si ya estamos en esa categoría (p. ej. al cerrar el lightbox), no reconstruir
            if (view.catId === catId && !els.categoria.hidden) return;
            abrirCategoria(catId);
        } else {
            if (view.catId === null && !els.indice.hidden) return;
            mostrarIndice();
        }
    }

    /* ---------- Eventos globales ---------- */
    function bindGlobal() {
        els.volver.addEventListener("click", function (ev) {
            ev.preventDefault();
            navegar(null);
        });

        window.addEventListener("popstate", function () {
            if (lb.open && location.hash !== "#ver") { cerrarLightbox(true); return; }
            if (!lb.open) syncFromUrl();
        });

        document.addEventListener("keydown", function (e) {
            if (!lb.open) return;
            if (e.key === "Escape") cerrarLightbox(false);
            else if (e.key === "ArrowLeft") navFoto(-1);
            else if (e.key === "ArrowRight") navFoto(1);
        });

        // Cerrar al tocar el fondo (no la imagen ni los botones)
        els.lightbox.addEventListener("click", function (e) {
            if (e.target === els.lightbox || e.target.classList.contains("gal-lb-stage")) {
                cerrarLightbox(false);
            }
        });

        // Swipe en móvil
        var x0 = null;
        els.lightbox.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
        els.lightbox.addEventListener("touchend", function (e) {
            if (x0 === null) return;
            var dx = e.changedTouches[0].clientX - x0;
            if (Math.abs(dx) > 50) navFoto(dx < 0 ? 1 : -1);
            x0 = null;
        }, { passive: true });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
