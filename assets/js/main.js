// ── Reveal on scroll ───────────────────────────────────────────────
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));

// ── Hero lite YouTube — click-to-load (no cookies until consent) ───
(function initLiteYT(){
  const wrap = document.getElementById('heroVideoLite');
  if (!wrap) return;
  function load(){
    const id = wrap.getAttribute('data-video-id');
    if (!id) return;
    const iframe = document.createElement('iframe');
    iframe.id = 'heroVideoPlayer';
    iframe.title = 'MADAMI.UZ bilan Amerikaga';
    // Use youtube-nocookie so we don't drop tracking cookies on first paint
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
    wrap.replaceWith(iframe);
  }
  wrap.addEventListener('click', load);
  wrap.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); load(); }
  });
})();

// ── Hero card parallax ─────────────────────────────────────────────
const card = document.getElementById('heroCard');
const heroV = card?.closest('.hero-visual');
heroV?.addEventListener('mousemove', (e) => {
  const r = heroV.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  card.style.transform = `rotate(${-2 + x*3}deg) translate3d(${x*10}px, ${y*10}px, 0)`;
});
heroV?.addEventListener('mouseleave', () => { card.style.transform = ''; });

// ── Nav active ─────────────────────────────────────────────────────
const links = document.querySelectorAll('.nav ul a');
const sections = [...document.querySelectorAll('section[id],header[id]')];
window.addEventListener('scroll', () => {
  const y = window.scrollY + 200;
  let active = sections[0]?.id;
  sections.forEach(s => { if (s.offsetTop <= y) active = s.id; });
  links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + active));
}, { passive: true });

// ── Staff Scroll Fan ───────────────────────────────────────────────
(function initStaffFan(){
  const section  = document.querySelector('.staff-scroll-section');
  const cards    = section ? [...section.querySelectorAll('.sf-card')] : [];
  const idxEl    = document.getElementById('sf-idx');
  const nameEl   = document.getElementById('sf-name');
  const hintEl   = document.getElementById('staff-hint');
  const rosterEl = document.getElementById('staff-roster');

  const names = ['Asad Madaminov', 'Abduqodir Ubaydullayev', 'Xusan Ibragimov'];

  if (!section || !cards.length) return;

  function update(){
    const rect       = section.getBoundingClientRect();
    const sectionH   = section.offsetHeight;
    const winH       = window.innerHeight;
    const scrolled   = Math.max(0, -rect.top);
    const scrollable = sectionH - winH;
    const progress   = scrollable > 0 ? Math.min(1, scrolled / scrollable) : 0;
    const fanAt      = 0.30;
    const rosterAt   = 0.64;

    const thresholds = [0, fanAt, fanAt];
    let lastVisible  = -1;
    const rosterPhase = progress >= rosterAt;

    cards.forEach((c, i) => {
      const show = progress >= thresholds[i];
      c.classList.toggle('show', show);
      if (show) lastVisible = i;
    });

    section.classList.toggle('roster-phase', rosterPhase);
    if (rosterEl) rosterEl.setAttribute('aria-hidden', rosterPhase ? 'false' : 'true');

    if (idxEl && lastVisible >= 0){
      const fullTeam = progress >= fanAt;
      idxEl.textContent = fullTeam ? '03' : String(lastVisible + 1).padStart(2, '0');
      if (nameEl) nameEl.textContent = fullTeam ? 'Full team' : (names[lastVisible] || '');
    }
    if (hintEl) hintEl.classList.toggle('done', progress >= rosterAt);
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// ── Mobile nav hamburger (with focus trap + body-scroll lock) ─────
(function initMobileNav(){
  const toggle  = document.getElementById('nav-toggle');
  const overlay = document.getElementById('nav-overlay');
  if (!toggle || !overlay) return;

  let lastFocused = null;
  function focusables(){ return overlay.querySelectorAll('a, button'); }

  function openMenu(){
    lastFocused = document.activeElement;
    document.body.classList.add('menu-open');
    document.body.style.overflow = 'hidden';
    toggle.setAttribute('aria-expanded', 'true');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.removeAttribute('inert');
    const els = focusables();
    if (els.length) els[0].focus();
  }
  function closeMenu(){
    document.body.classList.remove('menu-open');
    document.body.style.overflow = '';
    toggle.setAttribute('aria-expanded', 'false');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  toggle.addEventListener('click', () => {
    document.body.classList.contains('menu-open') ? closeMenu() : openMenu();
  });
  overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => {
    if (!document.body.classList.contains('menu-open')) return;
    if (e.key === 'Escape') return closeMenu();
    if (e.key === 'Tab') {
      const els = [...focusables()];
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();

document.getElementById('year').textContent = new Date().getFullYear();

// ── Testimonials Carousel (manual, no autoplay) ────────────────────
(function initTestimonials(){
  const track  = document.getElementById('rcTrack');
  const dotsEl = document.getElementById('rcDots');
  if (!track) return;
  const slides = track.querySelectorAll('.rc-slide');
  const total  = slides.length;
  let current  = 0;

  slides.forEach((_, i) => {
    const d = document.createElement('button');
    d.className = 'rc-dot' + (i === 0 ? ' active' : '');
    d.setAttribute('aria-label', `Slide ${i + 1}`);
    d.addEventListener('click', () => goTo(i));
    dotsEl.appendChild(d);
  });
  function goTo(idx){
    current = (idx + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    dotsEl.querySelectorAll('.rc-dot').forEach((d, i) => d.classList.toggle('active', i === current));
  }
  document.getElementById('rcPrev').addEventListener('click', () => goTo(current - 1));
  document.getElementById('rcNext').addEventListener('click', () => goTo(current + 1));

  let touchStartX = 0;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend',  e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(current + (diff > 0 ? 1 : -1));
  });
})();

// ── Country selector: show/hide USA-only fields ───────────────────
function handleDestChange(radio){
  const wrap      = document.getElementById('f-usa-extra');
  const ieltsEl   = document.getElementById('f-ielts');
  const eduInputs = wrap.querySelectorAll('input[name="edu"]');
  if (radio.value === '🇺🇸 USA'){
    wrap.classList.add('visible');
    ieltsEl.required = true;
    eduInputs.forEach(i => { i.required = true; });
  } else {
    wrap.classList.remove('visible');
    ieltsEl.required = false;
    ieltsEl.value    = '';
    eduInputs.forEach(i => { i.required = false; i.checked = false; });
  }
}
// Wire the destination radios via JS instead of inline onchange (CSP-safe)
document.querySelectorAll('input[name="dest"]').forEach(r => {
  r.addEventListener('change', () => handleDestChange(r));
});

// ── Form submission → /api/lead (token lives in Vercel env var) ───
// The page no longer carries the Telegram bot token. The serverless
// function at /api/lead.js reads TELEGRAM_BOT_TOKEN from the Vercel
// environment, validates input, rate-limits by IP, and forwards the
// message to the Telegram group.
(function initLeadForm(){
  const form    = document.getElementById('leadForm');
  if (!form) return;
  const status  = document.getElementById('leadStatus');
  const btn     = document.getElementById('leadSubmit');
  const ENDPOINT = form.dataset.endpoint || '/api/lead';

  function setStatus(msg, kind){
    status.textContent = msg;
    status.dataset.kind = kind || '';
    status.style.color =
      kind === 'error'   ? '#c0392b' :
      kind === 'success' ? '#1F9D6B' : 'var(--muted)';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (location.protocol === 'file:'){
      setStatus("Form faqat HTTP server orqali ishlaydi. Iltimos, `vercel dev` (yoki `python3 -m http.server`) ishlatib oching.", 'error');
      return;
    }

    const name    = form.querySelector('#f-name').value.trim();
    const age     = form.querySelector('#f-age').value.trim();
    const phone   = form.querySelector('#f-phone').value.trim();
    const tg      = form.querySelector('#f-tg').value.trim();
    const ielts   = form.querySelector('#f-ielts').value.trim();
    const comment = form.querySelector('#f-comment').value.trim();
    const company = form.querySelector('#f-company') ? form.querySelector('#f-company').value : '';
    const turnstileToken = form.querySelector('input[name="cf-turnstile-response"]')?.value || '';

    const countryInput = form.querySelector('input[name="dest"]:checked');
    if (!countryInput){ setStatus("Iltimos, yo'nalishni tanlang.", 'error'); return; }
    const country = countryInput.value;

    let edu = '';
    if (country === '🇺🇸 USA'){
      const eduInput = form.querySelector('input[name="edu"]:checked');
      if (!eduInput){ setStatus("Iltimos, talim turini tanlang (Bakalavr yoki Magistr).", 'error'); return; }
      edu = eduInput.value;
    }

    btn.disabled = true;
    const originalLabel = btn.innerHTML;
    btn.innerHTML = '<span>Yuborilmoqda…</span>';
    setStatus('Yuborilmoqda…');

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, age, phone, tg, country, ielts, edu, comment, company, turnstileToken
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok){
        setStatus("Yuborildi — tez orada bog'lanamiz ✓", 'success');
        form.reset();
        document.getElementById('f-usa-extra').classList.remove('visible');
      } else {
        const msg = (data && data.error) ? data.error : 'Server error';
        setStatus("Xatolik: " + msg + ". Qayta urinib ko'ring.", 'error');
      }
    } catch (err){
      console.error('Lead submit failed:', err);
      setStatus("Tarmoq xatosi. Iltimos, qayta urinib ko'ring.", 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  });
})();
