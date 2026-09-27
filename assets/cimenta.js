/* CIMENTA — comportements communs : menu, navigation, apparitions, confirmation des formulaires */
(function () {
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var drawer = document.getElementById('drawer');

  function setMenu(open) {
    if (!burger || !drawer) return;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    if (nav) nav.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (burger) {
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1180) setMenu(false);
    });
  }

  if (nav && !nav.classList.contains('light')) {
    var onScroll = function () { nav.classList.toggle('stuck', window.scrollY > 40); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('[data-reveal]').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('[data-reveal]').forEach(function (el) { el.classList.add('on'); });
  }


  // Formulaire « Présenter un projet » en fenêtre
  var dlg = document.getElementById('formulaire');
  if (dlg && typeof dlg.showModal === 'function') {
    document.querySelectorAll('[data-open-form]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof setMenu === 'function') setMenu(false);
        dlg.showModal(); document.body.style.overflow = 'hidden';
        var first = dlg.querySelector('input:not([type=hidden]):not(.hp)'); if (first) setTimeout(function(){ first.focus(); }, 50);
      });
    });
    dlg.querySelectorAll('[data-close-form]').forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { document.body.style.overflow = ''; });
  } else if (dlg) {
    document.querySelectorAll('[data-open-form]').forEach(function (a) { a.setAttribute('href', '#formulaire'); });
    dlg.setAttribute('open', '');
  }


  // Envoi des formulaires sans rechargement (fonction /api/contact → Brevo)
  document.querySelectorAll('form[data-form]').forEach(function (form) {
    if (!window.fetch || !window.FormData) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      var err = form.querySelector('.form-error');
      if (!err) { err = document.createElement('p'); err.className = 'form-error'; err.setAttribute('role', 'alert'); form.appendChild(err); }
      err.textContent = '';
      if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.textContent = 'Envoi en cours…'; }
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http', detail: String(r.status) }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error([res.error, res.detail].filter(Boolean).join(' — ') || 'envoi');
          form.reset();
          var ok = document.getElementById('success');
          var dlgEl = form.closest('dialog');
          if (dlgEl && dlgEl.open) dlgEl.close();
          if (ok) { ok.style.display = 'block'; if (!dlgEl) form.style.display = 'none'; ok.scrollIntoView({ block: 'center' }); }
        })
        .catch(function (e) {
          err.innerHTML = "L'envoi n'a pas abouti. Réessayez ou écrivez-nous à <a href=\"mailto:contact@cimenta.fr\">contact@cimenta.fr</a>.";
          if (window.console) console.warn('Envoi formulaire :', e && e.message);
        })
        .then(function () { if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; } });
    });
  });

  // Retour sans JavaScript (?envoi=ok / ?envoi=erreur) : ?envoi=ok affiche la confirmation, puis nettoie l'adresse.
  var params = new URLSearchParams(window.location.search);
  if (params.get('envoi') === 'erreur') {
    var f = document.querySelector('form[data-form]');
    if (f) { var m = document.createElement('p'); m.className = 'form-error'; m.innerHTML = "L'envoi n'a pas abouti. Réessayez ou écrivez-nous à <a href=\"mailto:contact@cimenta.fr\">contact@cimenta.fr</a>."; f.appendChild(m); }
    params.delete('envoi'); history.replaceState(null, '', window.location.pathname);
  }
  if (params.get('envoi') === 'ok') {
    var form = document.querySelector('form[data-form]');
    var ok = document.getElementById('success');
    if (form && ok) {
      form.style.display = 'none';
      ok.style.display = 'block';
      var target = document.getElementById(form.getAttribute('data-form'));
      if (target) setTimeout(function () { target.scrollIntoView(); }, 60);
    }
    params.delete('envoi');
    var q = params.toString();
    history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''));
  }


  // Écran d'accueil : un clic le ferme
  var gate = document.getElementById('gate');
  if (gate) {
    gate.addEventListener('click', function () { gate.classList.add('out'); });
  }

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
