(function () {
  'use strict';

  /* ============================================================
     Config & state
     ============================================================ */
  const TOKEN_KEY = 'bm_token';
  const SECTIONS = ['profile', 'stats', 'skills', 'experience', 'education', 'achievements', 'certifications'];

  let projects = [];
  let content = {}; // section -> [ {id, sortOrder, data} ]
  let adminMode = false;
  let editingContent = null; // { section, id|null }
  let projectSearch = '';           // free-text filter
  const activeTechs = new Set();    // selected tech tags (lowercase)

  const $ = (s) => document.querySelector(s);
  const homeView = $('#homeView');
  const detailView = $('#detailView');
  const projectsGrid = $('#projectsGrid');
  const projectsStatus = $('#projectsStatus');
  const projectModal = $('#projectModal');
  const loginModal = $('#loginModal');
  const contentModal = $('#contentModal');

  /* ---------- Skill-group icons ---------- */
  const ICONS = {
    code: '<path stroke-linecap="round" stroke-linejoin="round" d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 5l-2 14"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path stroke-linecap="round" d="M7 7.5h.01M7 16.5h.01"/>',
    database: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path stroke-linecap="round" stroke-linejoin="round" d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    tool: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/>',
    sparkles: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3l1.8 4.7L18 9.5l-4.2 1.8L12 16l-1.8-4.7L6 9.5l4.2-1.8L12 3zM18 15l.9 2.3L21 18l-2.1.7L18 21l-.9-2.3L15 18l2.1-.7L18 15z"/>',
  };
  const ICON_KEYS = Object.keys(ICONS);

  /* ---------- Field definitions for the generic editor ---------- */
  const CONTENT_FIELDS = {
    profile: [
      { key: 'intro', label: 'Intro line', type: 'text' },
      { key: 'headlineLead', label: 'Headline — before accent', type: 'text' },
      { key: 'headlineAccent', label: 'Headline — accent (colored)', type: 'text' },
      { key: 'headlineTail', label: 'Headline — after accent', type: 'text' },
      { key: 'availability', label: 'Availability badge', type: 'text' },
      { key: 'tagline', label: 'Hero tagline', type: 'textarea' },
      { key: 'bio1', label: 'Bio paragraph 1', type: 'textarea' },
      { key: 'bio2', label: 'Bio paragraph 2', type: 'textarea' },
      { key: 'location', label: 'Location', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'github', label: 'GitHub URL', type: 'text' },
      { key: 'linkedin', label: 'LinkedIn URL', type: 'text' },
      { key: 'resumeUrl', label: 'Resume file / URL', type: 'text' },
    ],
    stats: [
      { key: 'value', label: 'Value (e.g. 200+)', type: 'text', required: true },
      { key: 'label', label: 'Label', type: 'text' },
    ],
    skills: [
      { key: 'title', label: 'Group title', type: 'text', required: true },
      { key: 'icon', label: 'Icon', type: 'select', options: ICON_KEYS },
      { key: 'items', label: 'Items (one per line)', type: 'list' },
    ],
    experience: [
      { key: 'role', label: 'Role', type: 'text', required: true },
      { key: 'company', label: 'Company', type: 'text' },
      { key: 'kind', label: 'Type (e.g. Internship)', type: 'text' },
      { key: 'bullets', label: 'Responsibilities (one per line)', type: 'list' },
    ],
    education: [
      { key: 'degree', label: 'Degree / title', type: 'text', required: true },
      { key: 'org', label: 'Institution', type: 'text' },
      { key: 'period', label: 'Period (e.g. 2021 – 2025)', type: 'text' },
      { key: 'notes', label: 'Notes / badges (one per line)', type: 'list' },
    ],
    achievements: [
      { key: 'text', label: 'Achievement', type: 'textarea', required: true },
    ],
    certifications: [
      { key: 'name', label: 'Certification', type: 'text', required: true },
    ],
  };
  const SECTION_SINGULAR = {
    profile: 'Profile', stats: 'Stat', skills: 'Skill group', experience: 'Role',
    education: 'Education entry', achievements: 'Achievement', certifications: 'Certification',
  };

  /* ============================================================
     Utilities
     ============================================================ */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeUrl(url) { const u = String(url || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
  function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} }

  async function api(url, options = {}) {
    const opts = Object.assign({ headers: {} }, options);
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers);
    const token = getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, opts);
    if (res.status === 401) { setToken(null); setAdminMode(false); }
    return res;
  }

  /* ---------- Admin-only item controls (dynamic cards / list items) ---------- */
  function cardControls(section, id) {
    if (!adminMode) return '';
    return `<div class="absolute right-3 top-3 z-10 flex items-center gap-1.5">
      <button data-content-edit="${section}:${id}" title="Edit" class="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white/90 text-steel transition hover:border-navy hover:text-navy dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 4l4 4M4 20l1-4L16 5l3 3L8 19l-4 1z"/></svg></button>
      <button data-content-delete="${section}:${id}" title="Delete" class="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-600 hover:text-white dark:border-red-500/30 dark:bg-red-500/10"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0h6l-.6 12a1 1 0 0 1-1 1H8.6a1 1 0 0 1-1-1L7 7z"/></svg></button>
    </div>`;
  }
  function inlineControls(section, id) {
    if (!adminMode) return '';
    return `<span class="ml-1 inline-flex items-center gap-1 align-middle">
      <button data-content-edit="${section}:${id}" title="Edit" class="grid h-6 w-6 place-items-center rounded-md border border-slate-200 bg-white/90 text-steel transition hover:border-navy hover:text-navy dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 4l4 4M4 20l1-4L16 5l3 3L8 19l-4 1z"/></svg></button>
      <button data-content-delete="${section}:${id}" title="Delete" class="grid h-6 w-6 place-items-center rounded-md border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-600 hover:text-white dark:border-red-500/30 dark:bg-red-500/10"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
    </span>`;
  }

  /* ============================================================
     Theme
     ============================================================ */
  $('#themeToggle').addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch {}
  });

  /* ============================================================
     Render: Profile (hero + about + contact)
     ============================================================ */
  function profileData() { return (content.profile && content.profile[0] && content.profile[0].data) || {}; }

  function renderProfile() {
    const p = profileData();
    const av = document.querySelector('[data-field="availability"]');
    if (av) av.textContent = p.availability || 'Available for work';

    $('#heroTitle').innerHTML =
      `${esc(p.intro || '')}<br>${esc(p.headlineLead || '')}<span class="bg-gradient-to-r from-navy to-blue-500 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">${esc(p.headlineAccent || '')}</span>${esc(p.headlineTail || '')}`;
    $('#heroTagline').textContent = p.tagline || '';

    const btn = (href, label, icon, opts = {}) =>
      `<a href="${esc(href)}"${opts.download ? ' download' : ''}${opts.blank ? ' target="_blank" rel="noopener"' : ''} class="${opts.primary
        ? 'inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-navy dark:bg-white dark:text-ink dark:hover:bg-slate-200'
        : 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-5 py-3 text-sm font-semibold shadow-sm transition hover:border-navy hover:text-navy dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-400 dark:hover:text-blue-300'}">${icon}${esc(label)}</a>`;
    const iDown = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/></svg>';
    const iGit = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>';
    const iIn = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/></svg>';
    const iMail = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 7l9 6 9-6"/></svg>';

    const hb = [];
    hb.push(btn(p.resumeUrl || '#', 'Download Resume', iDown, { primary: true, download: true }));
    if (p.github) hb.push(btn(p.github, 'GitHub', iGit, { blank: true }));
    if (p.linkedin) hb.push(btn(p.linkedin, 'LinkedIn', iIn, { blank: true }));
    if (p.email) hb.push(btn('mailto:' + p.email, 'Contact', iMail));
    $('#heroButtons').innerHTML = hb.join('');

    $('#aboutBio').innerHTML = [p.bio1, p.bio2].filter(Boolean).map((t) => `<p>${esc(t)}</p>`).join('') || '<p class="text-steel dark:text-slate-400">No bio yet.</p>';

    const meta = [];
    if (p.location) meta.push(`<span class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm font-medium text-steel shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-navy dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7-4.35-7-10a7 7 0 1 1 14 0c0 5.65-7 10-7 10z"/><circle cx="12" cy="11" r="2.5"/></svg>${esc(p.location)}</span>`);
    if (p.phone) meta.push(`<a href="tel:${esc(p.phone.replace(/\s/g, ''))}" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm font-medium text-steel shadow-sm transition hover:border-navy hover:text-navy dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-blue-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-navy dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 0 1 2-2h2.3a1 1 0 0 1 1 .76l1 4a1 1 0 0 1-.29.95L7.6 10.6a12 12 0 0 0 5.8 5.8l1.9-1.9a1 1 0 0 1 .95-.29l4 1a1 1 0 0 1 .76 1V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5z"/></svg>${esc(p.phone)}</a>`);
    $('#aboutMeta').innerHTML = meta.join('');

    const cb = [];
    if (p.email) cb.push(`<a href="mailto:${esc(p.email)}" class="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-100">${iMail}${esc(p.email)}</a>`);
    if (p.phone) cb.push(`<a href="tel:${esc(p.phone.replace(/\s/g, ''))}" class="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">${esc(p.phone)}</a>`);
    if (p.github) cb.push(`<a href="${esc(p.github)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">GitHub</a>`);
    if (p.linkedin) cb.push(`<a href="${esc(p.linkedin)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">LinkedIn</a>`);
    $('#contactButtons').innerHTML = cb.join('');
  }

  /* ============================================================
     Render: list sections
     ============================================================ */
  function items(section) { return content[section] || []; }

  function renderStats() {
    $('#statsGrid').innerHTML = items('stats').map((it) => {
      const d = it.data || {};
      return `<div class="card relative rounded-2xl p-5">${cardControls('stats', it.id)}
        <div class="text-3xl font-extrabold tracking-tight">${esc(d.value || '')}</div>
        <div class="mt-1 text-sm text-steel dark:text-slate-400">${esc(d.label || '')}</div></div>`;
    }).join('');
  }

  function renderSkills() {
    $('#skillsGrid').innerHTML = items('skills').map((it) => {
      const d = it.data || {};
      const list = Array.isArray(d.items) ? d.items : [];
      return `<div class="card group relative rounded-2xl p-6">${cardControls('skills', it.id)}
        <span class="grid h-11 w-11 place-items-center rounded-xl bg-navy/10 text-navy transition group-hover:bg-navy group-hover:text-white dark:bg-blue-400/10 dark:text-blue-400 dark:group-hover:bg-blue-500 dark:group-hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">${ICONS[d.icon] || ICONS.code}</svg>
        </span>
        <h3 class="mt-5 text-base font-bold">${esc(d.title || '')}</h3>
        <div class="mt-4 flex flex-wrap gap-2">${list.map((i) => `<span class="badge rounded-lg px-2.5 py-1 text-xs font-medium">${esc(i)}</span>`).join('')}</div>
      </div>`;
    }).join('');
  }

  function renderExperience() {
    $('#experienceList').innerHTML = items('experience').map((it) => {
      const d = it.data || {};
      const bullets = Array.isArray(d.bullets) ? d.bullets : [];
      return `<div class="card relative rounded-2xl p-6 sm:p-8">${cardControls('experience', it.id)}
        <div class="flex flex-wrap items-start justify-between gap-4 pr-20">
          <div><h3 class="text-xl font-bold">${esc(d.role || '')}</h3><p class="mt-1 font-semibold text-navy dark:text-blue-400">${esc(d.company || '')}</p></div>
          ${d.kind ? `<span class="badge rounded-full px-3 py-1 text-xs font-semibold">${esc(d.kind)}</span>` : ''}
        </div>
        <ul class="mt-5 space-y-3 text-steel dark:text-slate-300">${bullets.map((b) => `<li class="flex gap-3"><svg xmlns="http://www.w3.org/2000/svg" class="mt-1 h-4 w-4 flex-none text-navy dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span>${esc(b)}</span></li>`).join('')}</ul>
      </div>`;
    }).join('');
  }

  function renderEducation() {
    $('#educationGrid').innerHTML = items('education').map((it) => {
      const d = it.data || {};
      const notes = Array.isArray(d.notes) ? d.notes : [];
      return `<div class="card relative rounded-2xl p-6 sm:p-8">${cardControls('education', it.id)}
        <div class="flex items-center justify-between gap-3 pr-20">
          <span class="grid h-11 w-11 place-items-center rounded-xl bg-navy/10 text-navy dark:bg-blue-400/10 dark:text-blue-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4L2 9l10 5 10-5-10-5z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 11v5c0 1 2.7 3 6 3s6-2 6-3v-5"/></svg></span>
          ${d.period ? `<span class="badge rounded-full px-3 py-1 text-xs font-semibold">${esc(d.period)}</span>` : ''}
        </div>
        <p class="mt-5 font-semibold">${esc(d.degree || '')}</p>
        <p class="mt-1 text-steel dark:text-slate-400">${esc(d.org || '')}</p>
        <div class="mt-4 flex flex-wrap gap-2">${notes.map((n) => `<span class="badge rounded-lg px-3 py-1.5 text-sm font-semibold">${esc(n)}</span>`).join('')}</div>
      </div>`;
    }).join('');
  }

  function renderAchievements() {
    $('#achievementsList').innerHTML = items('achievements').map((it) => {
      const d = it.data || {};
      return `<li class="flex items-start gap-3"><svg xmlns="http://www.w3.org/2000/svg" class="mt-1 h-4 w-4 flex-none text-navy dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span>${esc(d.text || '')}${inlineControls('achievements', it.id)}</span></li>`;
    }).join('');
  }

  function renderCertifications() {
    $('#certificationsList').innerHTML = items('certifications').map((it) => {
      const d = it.data || {};
      return `<span class="badge inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium">${esc(d.name || '')}${inlineControls('certifications', it.id)}</span>`;
    }).join('');
  }

  function renderAllContent() {
    renderProfile();
    renderStats();
    renderSkills();
    renderExperience();
    renderEducation();
    renderAchievements();
    renderCertifications();
  }

  /* ============================================================
     Project filtering (instant search + tag tags)
     ============================================================ */
  function getFilteredProjects() {
    const q = projectSearch.trim().toLowerCase();
    return projects.filter((p) => {
      const tags = (p.techStack || []).map((t) => String(t).toLowerCase());
      for (const t of activeTechs) if (!tags.includes(t)) return false; // AND across selected tags
      if (q) {
        const hay = [p.title, p.summary, (p.techStack || []).join(' ')].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function updateClearVisibility() {
    const clear = $('#clearFilters');
    if (clear) clear.style.display = (projectSearch.trim() || activeTechs.size) ? 'inline-flex' : 'none';
  }

  function buildFilterBar() {
    const bar = $('#projectTags');
    if (!bar) return;
    const set = new Map(); // lowercase -> display casing
    projects.forEach((p) => (p.techStack || []).forEach((t) => {
      const k = String(t).trim();
      if (k) set.set(k.toLowerCase(), k);
    }));
    // drop selected tags that no longer exist
    [...activeTechs].forEach((t) => { if (!set.has(t)) activeTechs.delete(t); });

    const techs = [...set.values()].sort((a, b) => a.localeCompare(b));
    bar.innerHTML = techs.map((t) => {
      const on = activeTechs.has(t.toLowerCase());
      return `<button data-tech="${esc(t)}" aria-pressed="${on}" class="rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on
        ? 'border-navy bg-navy text-white dark:border-blue-500 dark:bg-blue-500 dark:text-white'
        : 'border-slate-200 bg-white/70 text-steel hover:border-navy hover:text-navy dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-blue-400 dark:hover:text-blue-300'}">${esc(t)}</button>`;
    }).join('');
    updateClearVisibility();
  }

  /* ============================================================
     Render: Project cards
     ============================================================ */
  function renderProjects() {
    projectsStatus.classList.add('hidden');
    if (!projects.length) {
      projectsGrid.innerHTML = '';
      projectsStatus.textContent = adminMode ? 'No projects yet. Click "Add New Project".' : 'No projects to show yet.';
      projectsStatus.classList.remove('hidden');
      return;
    }
    const list = getFilteredProjects();
    if (!list.length) {
      projectsGrid.innerHTML = '';
      projectsStatus.textContent = 'No projects match your filters.';
      projectsStatus.classList.remove('hidden');
      return;
    }
    projectsGrid.innerHTML = list.map((p) => {
      const tags = Array.isArray(p.techStack) ? p.techStack : [];
      const cover = (p.media || []).find((m) => m && m.type === 'image');
      const coverHtml = cover && safeUrl(cover.url)
        ? `<div class="mb-4 h-40 overflow-hidden rounded-xl"><img src="${esc(safeUrl(cover.url))}" alt="" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" /></div>`
        : `<div class="mb-4 flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-3xl font-black text-slate-300 dark:from-slate-800 dark:to-slate-900 dark:text-slate-700">${esc((p.title || '?').slice(0, 2).toUpperCase())}</div>`;
      const controls = adminMode ? `<div class="absolute right-3 top-3 z-10 flex items-center gap-1.5">
        <button data-edit="${p.id}" title="Edit" class="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white/90 text-steel transition hover:border-navy hover:text-navy dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 4l4 4M4 20l1-4L16 5l3 3L8 19l-4 1z"/></svg></button>
        <button data-delete="${p.id}" title="Delete" class="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-600 hover:text-white dark:border-red-500/30 dark:bg-red-500/10"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0h6l-.6 12a1 1 0 0 1-1 1H8.6a1 1 0 0 1-1-1L7 7z"/></svg></button>
      </div>` : '';
      return `<article data-project-link="${p.id}" role="button" tabindex="0" class="card group relative flex cursor-pointer flex-col rounded-2xl p-5">
        ${controls}${coverHtml}
        <h3 class="text-lg font-bold">${esc(p.title)}</h3>
        <p class="mt-2 flex-1 text-sm leading-relaxed text-steel dark:text-slate-400">${esc(p.summary)}</p>
        <div class="mt-4 flex flex-wrap gap-2">${tags.slice(0, 4).map((t) => `<span class="badge rounded-lg px-2.5 py-1 text-xs font-medium">${esc(t)}</span>`).join('')}${tags.length > 4 ? `<span class="badge rounded-lg px-2.5 py-1 text-xs font-medium">+${tags.length - 4}</span>` : ''}</div>
        <div class="mt-5 flex items-center gap-1.5 border-t border-slate-100 pt-4 text-sm font-semibold text-navy dark:border-white/5 dark:text-blue-400">View case study<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg></div>
      </article>`;
    }).join('');
  }

  /* ============================================================
     Render: Project detail page
     ============================================================ */
  function renderDetail(p) {
    const gh = safeUrl(p.githubLink);
    const live = safeUrl(p.liveDemoLink);
    const media = (p.media || []).filter((m) => m && safeUrl(m.url));
    const tags = Array.isArray(p.techStack) ? p.techStack : [];
    const features = Array.isArray(p.features) ? p.features : [];

    const cta = [];
    if (live) cta.push(`<a href="${esc(live)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-ink dark:hover:bg-blue-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M20 4l-9 9M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/></svg>Live Demo</a>`);
    if (gh) cta.push(`<a href="${esc(gh)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-5 py-3 text-sm font-semibold shadow-sm transition hover:border-navy hover:text-navy dark:border-white/10 dark:bg-white/5 dark:hover:border-blue-400 dark:hover:text-blue-300"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>GitHub Repository</a>`);

    const galleryHtml = media.length ? `
      <div class="mt-10">
        <div id="galleryStage" class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-800"></div>
        ${media.length > 1 ? `<div class="mt-3 flex gap-3 overflow-x-auto pb-1">${media.map((m, i) => `<button data-thumb="${i}" class="thumb h-16 w-24 flex-none overflow-hidden rounded-lg border-2 transition ${i === 0 ? 'border-navy dark:border-blue-400' : 'border-transparent opacity-70 hover:opacity-100'}">${m.type === 'video' ? '<div class="flex h-full w-full items-center justify-center bg-slate-900 text-white"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>' : `<img src="${esc(safeUrl(m.url))}" class="h-full w-full object-cover" alt="" />`}</button>`).join('')}</div>` : ''}
      </div>` : `<div class="mt-10 flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 text-5xl font-black text-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-700">${esc((p.title || '?').slice(0, 2).toUpperCase())}</div>`;

    $('#detailContent').innerHTML = `
      <button data-home class="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-steel transition hover:text-navy dark:text-slate-400 dark:hover:text-blue-400"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 12H5M11 18l-6-6 6-6"/></svg>Back to all projects</button>
      <p class="text-sm font-semibold uppercase tracking-widest text-navy dark:text-blue-400">Case study</p>
      <h1 class="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">${esc(p.title)}</h1>
      <p class="mt-4 max-w-3xl text-lg leading-relaxed text-steel dark:text-slate-300">${esc(p.summary)}</p>
      <div class="mt-6 flex flex-wrap gap-2">${tags.map((t) => `<span class="badge rounded-lg px-3 py-1.5 text-sm font-medium">${esc(t)}</span>`).join('')}</div>
      ${cta.length ? `<div class="mt-8 flex flex-wrap gap-3">${cta.join('')}</div>` : ''}
      ${galleryHtml}
      <div class="mt-12 grid gap-10 lg:grid-cols-3">
        <div class="lg:col-span-2"><h2 class="text-xl font-bold">Overview</h2><p class="mt-4 whitespace-pre-line text-base leading-relaxed text-steel dark:text-slate-300">${esc(p.description || p.summary)}</p></div>
        <div><div class="card rounded-2xl p-6"><h2 class="text-base font-bold">Technical breakdown</h2>
          ${features.length ? `<ul class="mt-4 space-y-3 text-sm text-steel dark:text-slate-300">${features.map((f) => `<li class="flex gap-2.5"><svg xmlns="http://www.w3.org/2000/svg" class="mt-0.5 h-4 w-4 flex-none text-navy dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span>${esc(f)}</span></li>`).join('')}</ul>` : '<p class="mt-4 text-sm text-steel dark:text-slate-400">No feature breakdown provided yet.</p>'}
          <div class="mt-6 border-t border-slate-100 pt-4 dark:border-white/5"><p class="text-xs font-semibold uppercase tracking-widest text-steel dark:text-slate-400">Stack</p><div class="mt-3 flex flex-wrap gap-2">${tags.map((t) => `<span class="badge rounded-lg px-2.5 py-1 text-xs font-medium">${esc(t)}</span>`).join('')}</div></div>
        </div></div>
      </div>`;

    const stage = $('#galleryStage');
    if (stage && media.length) {
      const show = (i) => {
        const m = media[i];
        stage.innerHTML = m.type === 'video'
          ? `<video src="${esc(safeUrl(m.url))}" controls class="h-auto max-h-[460px] w-full bg-black"></video>`
          : `<img src="${esc(safeUrl(m.url))}" alt="" class="h-auto max-h-[460px] w-full object-contain" />`;
        document.querySelectorAll('.thumb').forEach((t, idx) => {
          t.classList.toggle('border-navy', idx === i);
          t.classList.toggle('dark:border-blue-400', idx === i);
          t.classList.toggle('border-transparent', idx !== i);
          t.classList.toggle('opacity-70', idx !== i);
        });
      };
      show(0);
      document.querySelectorAll('[data-thumb]').forEach((btn) => btn.addEventListener('click', () => show(Number(btn.getAttribute('data-thumb')))));
    }
  }

  /* ============================================================
     Router
     ============================================================ */
  function showHome() { detailView.classList.add('hidden'); homeView.classList.remove('hidden'); }
  function showDetail() { homeView.classList.add('hidden'); detailView.classList.remove('hidden'); }

  async function route() {
    const m = location.pathname.match(/^\/projects\/(\d+)\/?$/);
    if (m) {
      const id = Number(m[1]);
      showDetail();
      $('#detailContent').innerHTML = '<p class="py-20 text-center text-steel dark:text-slate-400">Loading…</p>';
      window.scrollTo(0, 0);
      let project = projects.find((p) => p.id === id);
      if (!project) { try { const res = await api(`/api/projects/${id}`); if (res.ok) project = await res.json(); } catch {} }
      if (project) renderDetail(project);
      else $('#detailContent').innerHTML = '<div class="py-20 text-center"><p class="text-lg font-semibold">Project not found.</p><button data-home class="mt-4 rounded-xl bg-navy px-5 py-2.5 text-sm font-semibold text-white">Back home</button></div>';
    } else { showHome(); }
  }
  function navigateTo(path) { if (location.pathname !== path) history.pushState({}, '', path); route(); }
  window.addEventListener('popstate', route);

  /* ============================================================
     Global click delegation
     ============================================================ */
  document.addEventListener('click', (e) => {
    const home = e.target.closest('[data-home]');
    if (home) { e.preventDefault(); navigateTo('/'); return; }

    const nav = e.target.closest('[data-nav]');
    if (nav && !detailView.classList.contains('hidden')) {
      e.preventDefault();
      const hash = nav.getAttribute('href');
      navigateTo('/');
      setTimeout(() => { const el = document.querySelector(hash); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 50);
      return;
    }

    // content section controls
    const cAdd = e.target.closest('[data-content-add]');
    if (cAdd) { e.preventDefault(); openContentModal(cAdd.getAttribute('data-content-add'), null); return; }
    const cEdit = e.target.closest('[data-content-edit]');
    if (cEdit) { e.preventDefault(); e.stopPropagation(); const [s, id] = cEdit.getAttribute('data-content-edit').split(':'); openContentModal(s, id); return; }
    const cDel = e.target.closest('[data-content-delete]');
    if (cDel) { e.preventDefault(); e.stopPropagation(); const [s, id] = cDel.getAttribute('data-content-delete').split(':'); deleteContent(s, Number(id)); return; }

    // project controls
    const edit = e.target.closest('[data-edit]');
    if (edit) { e.preventDefault(); e.stopPropagation(); openProjectModal(projects.find((p) => p.id === Number(edit.getAttribute('data-edit')))); return; }
    const del = e.target.closest('[data-delete]');
    if (del) { e.preventDefault(); e.stopPropagation(); deleteProject(Number(del.getAttribute('data-delete'))); return; }

    const card = e.target.closest('[data-project-link]');
    if (card) navigateTo('/projects/' + card.getAttribute('data-project-link'));
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-project-link]')) { e.preventDefault(); navigateTo('/projects/' + e.target.getAttribute('data-project-link')); }
    if (e.key === 'Escape') {
      if (!projectModal.classList.contains('hidden')) closeProjectModal();
      if (!loginModal.classList.contains('hidden')) closeLogin();
      if (!contentModal.classList.contains('hidden')) closeContent();
    }
  });

  /* ============================================================
     Data loading
     ============================================================ */
  async function loadProjects() {
    try {
      const res = await api('/api/projects');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      projects = await res.json();
      buildFilterBar();
      renderProjects();
    } catch (err) {
      projectsGrid.innerHTML = '';
      projectsStatus.textContent = 'Could not load projects. Is the API running?';
      projectsStatus.classList.remove('hidden');
      console.error(err);
    }
  }
  async function loadContent() {
    try {
      const results = await Promise.all(SECTIONS.map((s) => api('/api/content/' + s).then((r) => r.ok ? r.json() : [])));
      SECTIONS.forEach((s, i) => { content[s] = results[i]; });
      renderAllContent();
    } catch (err) { console.error('content load failed', err); }
  }

  /* ============================================================
     Admin mode
     ============================================================ */
  function applyAdminVisibility() {
    document.querySelectorAll('.admin-only').forEach((el) => {
      el.style.display = adminMode ? (el.classList.contains('place-items-center') ? 'grid' : 'inline-flex') : 'none';
    });
  }
  function setAdminMode(on) {
    adminMode = on;
    const banner = $('#adminBanner');
    const toggle = $('#adminToggle');
    banner.classList.toggle('hidden', !on);
    banner.classList.toggle('flex', on);
    toggle.classList.toggle('!text-navy', on);
    toggle.classList.toggle('dark:!text-blue-400', on);
    toggle.classList.toggle('!border-navy', on);
    toggle.title = on ? 'Owner Mode active' : 'Owner login';
    applyAdminVisibility();
    renderAllContent();
    renderProjects();
  }

  /* ---------- Login ---------- */
  function openLogin() {
    $('#loginUser').value = ''; $('#loginPassword').value = '';
    $('#loginError').classList.add('hidden');
    loginModal.classList.remove('hidden'); loginModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('#loginUser').focus(), 60);
  }
  function closeLogin() { loginModal.classList.add('hidden'); loginModal.classList.remove('flex'); document.body.style.overflow = ''; }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginSubmit'); btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $('#loginUser').value, password: $('#loginPassword').value }) });
      if (!res.ok) { $('#loginError').classList.remove('hidden'); return; }
      const data = await res.json();
      setToken(data.token);
      setAdminMode(true);
      closeLogin();
    } catch { $('#loginError').textContent = 'Could not reach the server.'; $('#loginError').classList.remove('hidden'); }
    finally { btn.disabled = false; btn.textContent = 'Sign in'; }
  });
  $('#adminToggle').addEventListener('click', () => { if (adminMode) { setToken(null); setAdminMode(false); } else openLogin(); });
  $('#exitAdmin').addEventListener('click', () => { setToken(null); setAdminMode(false); });
  $('#closeLogin').addEventListener('click', closeLogin);
  document.querySelector('.loginOverlay').addEventListener('click', closeLogin);

  async function restoreSession() {
    if (!getToken()) return;
    try { const res = await api('/api/auth/me'); if (res.ok) setAdminMode(true); else setToken(null); } catch {}
  }

  /* ============================================================
     Generic content modal (create / edit)
     ============================================================ */
  function buildContentFields(section, data) {
    const defs = CONTENT_FIELDS[section] || [];
    return defs.map((f) => {
      const id = 'c-' + f.key;
      let control;
      const base = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/20 dark:border-white/10 dark:bg-slate-800';
      if (f.type === 'select') {
        control = `<select id="${id}" class="${base}">${(f.options || []).map((o) => `<option value="${esc(o)}"${data && data[f.key] === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      } else if (f.type === 'textarea') {
        control = `<textarea id="${id}" rows="3" class="${base} resize-none">${esc(data ? data[f.key] : '')}</textarea>`;
      } else if (f.type === 'list') {
        const val = data && Array.isArray(data[f.key]) ? data[f.key].join('\n') : '';
        control = `<textarea id="${id}" rows="4" class="${base} resize-none">${esc(val)}</textarea>`;
      } else {
        control = `<input id="${id}" type="text" value="${esc(data ? data[f.key] : '')}" class="${base}" />`;
      }
      return `<div><label class="mb-1.5 block text-sm font-semibold" for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>${control}</div>`;
    }).join('');
  }

  function openContentModal(section, id) {
    if (!CONTENT_FIELDS[section]) return;
    let item = null;
    if (section === 'profile') item = content.profile && content.profile[0];
    else if (id && id !== 'self') item = (content[section] || []).find((x) => x.id === Number(id));

    editingContent = { section, id: item ? item.id : null };
    $('#contentModalTitle').textContent = (item ? 'Edit ' : 'Add ') + SECTION_SINGULAR[section];
    $('#contentFields').innerHTML = buildContentFields(section, item ? item.data : null);
    $('#contentError').classList.add('hidden');

    contentModal.classList.remove('hidden');
    contentModal.classList.add('flex', 'modal-enter');
    requestAnimationFrame(() => contentModal.classList.remove('modal-enter'));
    document.body.style.overflow = 'hidden';
    const first = $('#contentFields').querySelector('input, textarea, select');
    if (first) setTimeout(() => first.focus(), 60);
  }
  function closeContent() { contentModal.classList.add('hidden'); contentModal.classList.remove('flex'); document.body.style.overflow = ''; editingContent = null; }

  function collectContentData(section) {
    const defs = CONTENT_FIELDS[section] || [];
    const data = {};
    defs.forEach((f) => {
      const el = document.getElementById('c-' + f.key);
      if (!el) return;
      if (f.type === 'list') data[f.key] = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
      else data[f.key] = el.value.trim();
    });
    return data;
  }

  $('#contentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingContent) return;
    const { section, id } = editingContent;
    const defs = CONTENT_FIELDS[section] || [];
    const data = collectContentData(section);
    const requiredField = defs.find((f) => f.required);
    if (requiredField && !data[requiredField.key]) {
      $('#contentError').textContent = requiredField.label + ' is required.';
      $('#contentError').classList.remove('hidden');
      return;
    }
    const existing = id ? (content[section] || []).find((x) => x.id === id) : null;
    const payload = { sortOrder: existing ? existing.sortOrder : (content[section] || []).length, data };
    const btn = $('#contentSubmit'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const res = await api(id ? `/api/content/${section}/${id}` : `/api/content/${section}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        $('#contentError').textContent = msg.message || (res.status === 401 ? 'Session expired — sign in again.' : 'Save failed.');
        $('#contentError').classList.remove('hidden');
        return;
      }
      await reloadSection(section);
      closeContent();
    } catch { $('#contentError').textContent = 'Could not reach the server.'; $('#contentError').classList.remove('hidden'); }
    finally { btn.disabled = false; btn.textContent = 'Save'; }
  });
  $('#closeContent').addEventListener('click', closeContent);
  $('#cancelContent').addEventListener('click', closeContent);
  $('#contentOverlay').addEventListener('click', closeContent);

  async function reloadSection(section) {
    try { const res = await api('/api/content/' + section); if (res.ok) content[section] = await res.json(); } catch {}
    renderAllContent();
  }
  async function deleteContent(section, id) {
    const item = (content[section] || []).find((x) => x.id === id);
    const label = item && (item.data.title || item.data.role || item.data.degree || item.data.name || item.data.text || item.data.value) || 'this item';
    if (!window.confirm(`Delete "${label}"? This permanently removes it from the database.`)) return;
    try {
      const res = await api(`/api/content/${section}/${id}`, { method: 'DELETE' });
      if (res.ok) await reloadSection(section);
      else alert(res.status === 401 ? 'Session expired — sign in again.' : 'Delete failed.');
    } catch { alert('Could not reach the server.'); }
  }

  /* ============================================================
     Project modal (create / edit)
     ============================================================ */
  function parseMedia(text) {
    return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      let type = 'image', url = line;
      if (/^video:/i.test(line)) { type = 'video'; url = line.replace(/^video:/i, '').trim(); }
      else if (/^image:/i.test(line)) { url = line.replace(/^image:/i, '').trim(); }
      else if (/\.(mp4|webm|mov|ogg)(\?|$)/i.test(line)) { type = 'video'; }
      return { type, url };
    });
  }
  function mediaToText(media) { return (media || []).map((m) => (m.type === 'video' ? 'video:' : '') + m.url).join('\n'); }

  function openProjectModal(project) {
    $('#projectForm').reset();
    $('#formError').classList.add('hidden');
    if (project) {
      $('#modalTitle').textContent = 'Edit Project';
      $('#f-id').value = project.id;
      $('#f-title').value = project.title || '';
      $('#f-summary').value = project.summary || '';
      $('#f-desc').value = project.description || '';
      $('#f-tech').value = (project.techStack || []).join(', ');
      $('#f-features').value = (project.features || []).join('\n');
      $('#f-media').value = mediaToText(project.media);
      $('#f-github').value = project.githubLink || '';
      $('#f-live').value = project.liveDemoLink || '';
    } else {
      $('#modalTitle').textContent = 'Add New Project';
      $('#f-id').value = '';
    }
    projectModal.classList.remove('hidden');
    projectModal.classList.add('flex', 'modal-enter');
    requestAnimationFrame(() => projectModal.classList.remove('modal-enter'));
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('#f-title').focus(), 60);
  }
  function closeProjectModal() { projectModal.classList.add('hidden'); projectModal.classList.remove('flex'); document.body.style.overflow = ''; }

  // ---- filter bar events ----
  $('#projectSearch').addEventListener('input', (e) => {
    projectSearch = e.target.value;
    updateClearVisibility();
    renderProjects();
  });
  $('#projectTags').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tech]');
    if (!btn) return;
    const key = btn.getAttribute('data-tech').toLowerCase();
    if (activeTechs.has(key)) activeTechs.delete(key); else activeTechs.add(key);
    buildFilterBar();
    renderProjects();
  });
  $('#clearFilters').addEventListener('click', () => {
    projectSearch = '';
    $('#projectSearch').value = '';
    activeTechs.clear();
    buildFilterBar();
    renderProjects();
  });

  $('#addProjectBtn').addEventListener('click', () => openProjectModal(null));
  $('#closeModal').addEventListener('click', closeProjectModal);
  $('#cancelModal').addEventListener('click', closeProjectModal);
  $('#modalOverlay').addEventListener('click', closeProjectModal);

  $('#projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#f-id').value;
    const payload = {
      title: $('#f-title').value.trim(),
      summary: $('#f-summary').value.trim(),
      description: $('#f-desc').value.trim(),
      techStack: $('#f-tech').value.split(',').map((t) => t.trim()).filter(Boolean),
      features: $('#f-features').value.split('\n').map((t) => t.trim()).filter(Boolean),
      media: parseMedia($('#f-media').value),
      githubLink: $('#f-github').value.trim(),
      liveDemoLink: $('#f-live').value.trim(),
      sortOrder: 0,
    };
    if (!payload.title || !payload.summary) { $('#formError').textContent = 'Title and summary are required.'; $('#formError').classList.remove('hidden'); return; }
    const btn = $('#formSubmit'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const res = await api(id ? `/api/projects/${id}` : '/api/projects', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        $('#formError').textContent = msg.message || (res.status === 401 ? 'Session expired — sign in again.' : 'Save failed.');
        $('#formError').classList.remove('hidden');
        return;
      }
      await loadProjects();
      closeProjectModal();
    } catch { $('#formError').textContent = 'Could not reach the server.'; $('#formError').classList.remove('hidden'); }
    finally { btn.disabled = false; btn.textContent = 'Save Project'; }
  });

  async function deleteProject(id) {
    const p = projects.find((x) => x.id === id);
    if (!window.confirm(`Delete "${p ? p.title : 'this project'}"? This permanently removes it from the database.`)) return;
    try {
      const res = await api(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) await loadProjects();
      else alert(res.status === 401 ? 'Session expired — sign in again.' : 'Delete failed.');
    } catch { alert('Could not reach the server.'); }
  }

  /* ============================================================
     Scroll reveal
     ============================================================ */
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => { if (entry.isIntersecting) { entry.target.style.animationDelay = (i * 70) + 'ms'; entry.target.classList.add('in'); io.unobserve(entry.target); } });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
  }

  /* ============================================================
     Init
     ============================================================ */
  async function init() {
    $('#year').textContent = new Date().getFullYear();
    applyAdminVisibility();
    initReveal();
    await restoreSession();
    await Promise.all([loadContent(), loadProjects()]);
    route();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
