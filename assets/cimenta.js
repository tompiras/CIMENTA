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
      if (window.innerWidth > 900) setMenu(false);
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

  // Retour de FormSubmit : ?envoi=ok affiche la confirmation, puis nettoie l'adresse.
  var params = new URLSearchParams(window.location.search);
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

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
