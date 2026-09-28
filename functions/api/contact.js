// CIMENTA — envoi des formulaires du site via l'API Brevo (Sendinblue SAS, France).
// La clé est lue dans le secret Cloudflare BREVO_API_KEY : elle n'apparaît jamais dans le code.

const DEST = { email: 'contact@cimenta.fr', name: 'CIMENTA' };
const SENDER = { email: 'contact@cimenta.fr', name: 'Site CIMENTA' };
const FORMS = {
  contact: { subject: 'Nouveau projet — cimenta.fr', back: '/?envoi=ok' },
  apporteur: { subject: "Apporteur d'affaires — cimenta.fr", back: '/apporteur-affaires.html?envoi=ok' },
};
const MAX_LEN = 5000;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s) => String(s || '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_LEN);
const isEmail = (s) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s) && s.length <= 254;

function reply(request, ok, back, status = 200, error = '', detail = '') {
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  if (wantsJson) {
    // Toujours 200 en JSON : Cloudflare remplace les réponses 5xx par sa propre page d'erreur.
    return new Response(JSON.stringify({ ok, error, detail }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
  // Sans JavaScript : retour sur la page d'origine.
  const url = new URL(ok ? back : back.replace('envoi=ok', 'envoi=erreur'), request.url);
  return Response.redirect(url.toString(), 303);
}


// ---- Base de contacts Brevo : chaque demande envoyée depuis le site est ajoutée (ou mise à jour) ----
// Listes : « Site — Clients » (#9) et « Site — Apporteurs » (#8), ou variables Cloudflare BREVO_LIST_CLIENTS / BREVO_LIST_APPORTEURS.
const toIntl = (tel) => {
  const d = String(tel || '').replace(/[^\d+]/g, '');
  if (/^0[1-9]\d{8}$/.test(d)) return '+33' + d.slice(1);
  if (/^\+\d{8,15}$/.test(d)) return d;
  if (/^00\d{8,15}$/.test(d)) return '+' + d.slice(2);
  return '';
};

async function saveContact(env, kind, email, name, tel) {
  const key = String(env.BREVO_API_KEY || '').trim();
  // Listes Brevo « Site — Apporteurs » (#8) et « Site — Clients » (#9) ; modifiables via les variables Cloudflare.
  const listId = parseInt(kind === 'apporteur' ? (env.BREVO_LIST_APPORTEURS || 8) : (env.BREVO_LIST_CLIENTS || 9), 10);
  const phone = toIntl(tel);
  const base = { email, updateEnabled: true };
  if (listId > 0) base.listIds = [listId];
  // Les comptes Brevo en français utilisent NOM / PRENOM, les comptes en anglais LASTNAME / FIRSTNAME :
  // on essaie du plus complet au plus simple, pour que le contact soit toujours enregistré.
  const attempts = [];
  if (phone) attempts.push({ NOM: name, SMS: phone }, { LASTNAME: name, SMS: phone });
  attempts.push({ NOM: name }, { LASTNAME: name }, null);
  for (const attributes of attempts) {
    const body = attributes ? { ...base, attributes } : base;
    try {
      const r = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok || r.status === 204) return true;
      if (r.status === 401 || r.status === 403) return false;
      if (r.status === 400) {
        let j = {}; try { j = await r.json(); } catch {}
        if (j.code === 'duplicate_parameter') return true; // téléphone déjà utilisé par un autre contact : le contact existe déjà
        continue;
      }
      return false;
    } catch { return false; }
  }
  return false;
}

export async function onRequestPost({ request, env, waitUntil }) {
  let data;
  try { data = await request.formData(); } catch { return reply(request, false, '/', 400, 'format'); }

  const kind = FORMS[data.get('_form')] ? data.get('_form') : 'contact';
  const cfg = FORMS[kind];

  // Anti-spam : champ piège rempli = robot. On répond « ok » sans rien envoyer.
  if (clean(data.get('_honey'))) return reply(request, true, cfg.back);

  // Requêtes venant d'un autre site refusées.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return reply(request, false, cfg.back, 403, 'origine');

  const fields = [];
  for (const [key, value] of data.entries()) {
    if (key.startsWith('_') || typeof value !== 'string') continue;
    fields.push([clean(key).slice(0, 60), clean(value)]);
  }
  const get = (k) => (fields.find(([key]) => key === k) || [])[1] || '';
  const name = get('Nom');
  const email = get('email');
  if (!name || !isEmail(email)) return reply(request, false, cfg.back, 422, 'champs');

  if (!env.BREVO_API_KEY || !String(env.BREVO_API_KEY).trim().startsWith('xkeysib-')) return reply(request, false, cfg.back, 500, 'configuration', env.BREVO_API_KEY ? 'la clé enregistrée n\'est pas une clé API Brevo (xkeysib-…)' : 'BREVO_API_KEY absente');
  if (!env.BREVO_API_KEY) return reply(request, false, cfg.back, 500, 'configuration', 'BREVO_API_KEY absente');

  const rows = fields
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:8px 16px 8px 0;color:#666;vertical-align:top;white-space:nowrap">${esc(k === 'email' ? 'E-mail' : k)}</td><td style="padding:8px 0;color:#111">${esc(v).replace(/\n/g, '<br>')}</td></tr>`)
    .join('');
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px"><p style="margin:0 0 16px">${esc(cfg.subject)}</p><table style="border-collapse:collapse">${rows}</table><p style="margin-top:24px;color:#999;font-size:12px">Envoyé depuis le formulaire du site cimenta.fr. Répondre à ce message écrit directement à l'expéditeur.</p></div>`;
  const text = fields.filter(([, v]) => v).map(([k, v]) => `${k === 'email' ? 'E-mail' : k} : ${v}`).join('\n');

  let res;
  try {
  res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': String(env.BREVO_API_KEY).trim(), 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: SENDER,
      to: [DEST],
      replyTo: { email, name: name.slice(0, 100) },
      subject: `${cfg.subject} — ${name.slice(0, 80)}`,
      htmlContent: html,
      textContent: text,
      tags: ['site', kind],
    }),
  });
  } catch (e) {
    return reply(request, false, cfg.back, 502, 'reseau', String(e && e.message || e).slice(0, 200));
  }

  if (!res.ok) {
    let detail = '';
    try { const t = await res.text(); let j = {}; try { j = JSON.parse(t); } catch {} detail = `${res.status} ${j.code || ''} ${j.message || t.slice(0, 120)}`.trim(); } catch { detail = String(res.status); }
    return reply(request, false, cfg.back, 502, 'envoi', detail.slice(0, 200));
  }
  // Ajout à la base de contacts Brevo, sans retarder ni bloquer la réponse au visiteur.
  const sync = saveContact(env, kind, email, name.slice(0, 100), get('Téléphone')).catch(() => false);
  if (typeof waitUntil === 'function') waitUntil(sync); else await sync;
  return reply(request, true, cfg.back);
}

export function onRequest() {
  return new Response('Méthode non autorisée', { status: 405, headers: { allow: 'POST' } });
}
