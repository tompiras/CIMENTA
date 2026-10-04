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

  // Réalisations : visionneuse plein écran
  var rv = document.getElementById('rv');
  var rvData = document.getElementById('rv-data');
  if (rv && rvData && typeof rv.showModal === 'function') {
    var R = JSON.parse(rvData.textContent), cur = 0, idx = 0, sx = null;
    var img = rv.querySelector('.rv-img'), thumbs = rv.querySelector('.rv-thumbs');
    var src = function (s, n, w) { return '/assets/realisations/' + s + '-' + n + '-' + w + '.webp'; };
    var show = function (i) {
      var p = R[cur], n = p.a.length;
      idx = (i + n) % n;
      img.classList.remove('ok');
      img.onload = function () { img.classList.add('ok'); };
      img.src = src(p.s, idx + 1, window.innerWidth * (window.devicePixelRatio || 1) > 1100 ? 2000 : 1000);
      img.alt = p.a[idx];
      if (img.complete) img.classList.add('ok');
      rv.querySelector('.rv-count').textContent = (idx + 1) + ' / ' + n;
      thumbs.querySelectorAll('.rv-th').forEach(function (b, k) { b.setAttribute('aria-selected', String(k === idx)); });
      var nx = new Image(); nx.src = src(p.s, ((idx + 1) % n) + 1, window.innerWidth > 700 ? 2000 : 1000);
    };
    var open = function (k) {
      var p = R[k]; cur = k;
      rv.querySelector('#rv-title').textContent = p.t;
      rv.querySelector('.rv-meta').textContent = p.f.map(function (x) { return x[1]; }).join(' · ');
      rv.querySelector('.rv-desc').textContent = p.d;
      var dl = rv.querySelector('.rv-facts'); dl.innerHTML = '';
      var dt = document.createElement('dt'); dt.textContent = 'Travaux';
      var dd = document.createElement('dd'); dd.textContent = p.w;
      dl.appendChild(dt); dl.appendChild(dd);
      thumbs.innerHTML = '';
      p.a.forEach(function (a, j) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'rv-th'; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', a);
        b.style.backgroundImage = 'url(' + src(p.s, j + 1, 1000) + ')';
        b.addEventListener('click', function () { show(j); });
        thumbs.appendChild(b);
      });
      rv.showModal(); rv.focus(); document.body.style.overflow = 'hidden';
      show(0);
    };
    document.querySelectorAll('[data-rv]').forEach(function (b) {
      b.addEventListener('click', function () { open(+b.getAttribute('data-rv')); });
    });
    rv.querySelector('.rv-close').addEventListener('click', function () { rv.close(); });
    rv.querySelector('.rv-prev').addEventListener('click', function () { show(idx - 1); });
    rv.querySelector('.rv-next').addEventListener('click', function () { show(idx + 1); });
    rv.addEventListener('close', function () { document.body.style.overflow = ''; img.removeAttribute('src'); });
    rv.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
    });
    var stage = rv.querySelector('.rv-stage');
    stage.addEventListener('click', function (e) { if (e.target === stage || e.target.classList.contains('rv-fig')) rv.close(); });
    stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
