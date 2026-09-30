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
    }, { threshold: 0.06, rootMargin: '0px 0px -8% 0px' });
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
    if (window.location.hash === '#formulaire') { setTimeout(function () { dlg.showModal(); document.body.style.overflow = 'hidden'; history.replaceState(null, '', window.location.pathname + window.location.search); }, 400); }
  } else if (dlg) {
    document.querySelectorAll('[data-open-form]').forEach(function (a) { a.setAttribute('href', '#formulaire'); });
    dlg.setAttribute('open', '');
  }


  // Vérification du numéro de téléphone (France : 10 chiffres ; étranger : +indicatif)
  function phoneOk(v) {
    var d = String(v || '').replace(/[\s.\-()\/]/g, '').replace(/^(\+|00)330/, '+33');
    return /^0[1-9]\d{8}$/.test(d) || /^(\+|00)33[1-9]\d{8}$/.test(d) || /^(\+|00)(?!33)[1-9]\d{7,14}$/.test(d);
  }
  function setFieldMsg(input, msg) {
    var field = input.closest('.field') || input.parentNode;
    var label = field.querySelector('label');
    var el = field.querySelector('.field-msg');
    if (label && !label.dataset.base) label.dataset.base = label.textContent;
    if (!msg) {
      input.removeAttribute('aria-invalid'); field.classList.remove('is-invalid');
      if (label) label.textContent = label.dataset.base;
      if (el) el.remove();
      return;
    }
    if (!el) { el = document.createElement('span'); el.className = 'field-msg'; el.id = input.id + '-msg'; el.setAttribute('role', 'alert'); field.appendChild(el); }
    el.textContent = msg;
    field.classList.add('is-invalid');
    if (label) label.textContent = msg;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', el.id);
  }
  var PHONE_MSG = 'Téléphone invalide';
  document.querySelectorAll('form[data-form] input[type=tel]').forEach(function (inp) {
    inp.addEventListener('input', function () { if (inp.getAttribute('aria-invalid')) setFieldMsg(inp, phoneOk(inp.value) ? '' : PHONE_MSG); });
    inp.addEventListener('blur', function () { if (inp.value.trim()) setFieldMsg(inp, phoneOk(inp.value) ? '' : PHONE_MSG); });
  });

  // Envoi des formulaires sans rechargement (fonction /api/contact → Brevo)
  document.querySelectorAll('form[data-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      var tel = form.querySelector('input[type=tel]');
      if (tel && tel.value.trim() && !phoneOk(tel.value)) { e.preventDefault(); setFieldMsg(tel, PHONE_MSG); tel.focus(); }
    });
  });
  document.querySelectorAll('form[data-form]').forEach(function (form) {
    if (!window.fetch || !window.FormData) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var telIn = form.querySelector('input[type=tel]');
      if (telIn && telIn.getAttribute('aria-invalid')) return;
      var btn = form.querySelector('button[type=submit]');
      var err = form.querySelector('.form-error');
      if (!err) { err = document.createElement('p'); err.className = 'form-error'; err.setAttribute('role', 'alert'); form.appendChild(err); }
      err.textContent = '';
      if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.textContent = 'Envoi en cours…'; }
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http', detail: String(r.status) }; }); })
        .then(function (res) {
          if (!res.ok && res.error === 'telephone' && telIn) { setFieldMsg(telIn, PHONE_MSG); telIn.focus(); return; }
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



  // Bouton « Appeler » (mobile) : visible après le haut de page, masqué sur la section Contact et le pied de page
  var callbar = document.getElementById('callbar');
  if (callbar) {
    var hidden = {};
    var hideTargets = document.querySelectorAll('#contact, .footer');
    var update = function () {
      var past = window.scrollY > window.innerHeight * 0.6 || !document.querySelector('.hero-a');
      var blocked = Object.keys(hidden).some(function (k) { return hidden[k]; });
      callbar.classList.toggle('show', past && !blocked);
    };
    if ('IntersectionObserver' in window) {
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { hidden[e.target.className + e.target.id] = e.isIntersecting; });
        update();
      }, { threshold: 0 });
      hideTargets.forEach(function (el) { io2.observe(el); });
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // Écran d'accueil : un clic le ferme
  var gate = document.getElementById('gate');
  if (gate) {
    gate.addEventListener('click', function () { gate.classList.add('out'); });
  }

  // Photo du haut de page : défile plus lentement que la page (effet de profondeur)
  var heroBg = document.querySelector('.hero-img .hero-bg');
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (heroBg && !calm) {
    var ticking = false;
    var drift = function () {
      var sy = window.scrollY;
      if (sy <= window.innerHeight) heroBg.style.translate = '0 ' + (sy * 0.25).toFixed(1) + 'px';
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(drift); }
    }, { passive: true });
    drift();
  }

  // Méthode : cartes empilées — la carte recouverte recule légèrement
  var stackCards = Array.prototype.slice.call(document.querySelectorAll('#methode .stack > li'));
  // Texte qui s'éclaire mot à mot
  var lightEls = Array.prototype.slice.call(document.querySelectorAll('[data-light]'));
  lightEls.forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map(function (w) { return '<span class="w" aria-hidden="true">' + w + '</span>'; }).join(' ');
  });
  if (!calm && (stackCards.length || lightEls.length)) {
    var busy = false;
    var paint = function () {
      var vh = window.innerHeight;
      for (var i = 0; i < stackCards.length - 1; i++) {
        var a = stackCards[i].getBoundingClientRect(), b = stackCards[i + 1].getBoundingClientRect();
        var p = Math.min(Math.max(1 - (b.top - a.top) / a.height, 0), 1);
        stackCards[i].style.setProperty('--s', (1 - p * 0.05).toFixed(4));
      }
      lightEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var start = vh * 0.85, end = vh * 0.40;
        var prog = Math.min(Math.max((start - r.top) / (start - end), 0), 1);
        var ws = el.querySelectorAll('.w'), n = Math.round(prog * ws.length);
        for (var k = 0; k < ws.length; k++) ws[k].classList.toggle('lit', k < n);
      });
      busy = false;
    };
    window.addEventListener('scroll', function () { if (!busy) { busy = true; window.requestAnimationFrame(paint); } }, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  }

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
