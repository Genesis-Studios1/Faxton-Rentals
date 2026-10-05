(() => {
  const $ = (s) => document.querySelector(s);
  const money = (n) => '$' + n.toLocaleString('en-US');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  let favs = new Set(store.get('favs', []));
  const state = { q: '', type: '', beds: 0, max: 0, pets: false, favOnly: false, sort: 'featured' };

  // ---- theme ----
  const themeBtn = $('#themeToggle');
  const paintTheme = () => { themeBtn.textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙'; };
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    paintTheme();
  });
  paintTheme();

  // ---- toast ----
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---- listing grid ----
  function filtered() {
    const q = state.q.trim().toLowerCase();
    let r = LISTINGS.filter((l) =>
      (!q || (l.city + ' ' + l.title).toLowerCase().includes(q)) &&
      (!state.type || l.type === state.type) &&
      l.beds >= state.beds &&
      (!state.max || l.price <= state.max) &&
      (!state.pets || l.pets) &&
      (!state.favOnly || favs.has(l.id)));
    const sorts = {
      featured: (a, b) => b.featured - a.featured || a.id - b.id,
      low: (a, b) => a.price - b.price,
      high: (a, b) => b.price - a.price,
      beds: (a, b) => b.beds - a.beds || a.price - b.price,
    };
    return r.sort(sorts[state.sort]);
  }

  function render() {
    const list = filtered();
    $('#grid').innerHTML = list.map((l) => `
      <article class="card" data-id="${l.id}" tabindex="0" aria-label="${esc(l.title)}">
        <div class="card-img">
          <img src="${esc(l.photos[0])}" alt="${esc(l.title)}" loading="lazy" onerror="this.remove()">
          ${l.featured ? '<span class="badge">Featured</span>' : ''}
          <button class="heart ${favs.has(l.id) ? 'on' : ''}" data-fav="${l.id}" aria-label="Save ${esc(l.title)}" aria-pressed="${favs.has(l.id)}">♥</button>
        </div>
        <div class="card-body">
          <div class="price">${money(l.price)} <small>/ month</small></div>
          <h3>${esc(l.title)}</h3>
          <div class="muted">${esc(l.city)}</div>
          <div class="meta"><span>🛏 ${l.beds} bd</span><span>🛁 ${l.baths} ba</span><span>📐 ${l.sqft.toLocaleString()} sqft</span>${l.pets ? '<span>🐾 Pets ok</span>' : ''}</div>
        </div>
      </article>`).join('');
    $('#empty').hidden = list.length > 0;
    $('#resultCount').textContent = `${list.length} ${list.length === 1 ? 'home' : 'homes'} found`;
    $('#favCount').textContent = favs.size;
    $('#favToggle').classList.toggle('active', state.favOnly);
  }

  function toggleFav(id) {
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.set('favs', [...favs]);
    render();
  }

  $('#grid').addEventListener('click', (e) => {
    const heart = e.target.closest('[data-fav]');
    if (heart) { e.stopPropagation(); toggleFav(+heart.dataset.fav); return; }
    const card = e.target.closest('.card');
    if (card) openModal(+card.dataset.id);
  });
  $('#grid').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('card')) openModal(+e.target.dataset.id);
  });

  // ---- filters ----
  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.q = $('#q').value; state.type = $('#type').value;
    state.beds = +$('#beds').value; state.max = +$('#maxPrice').value;
    render();
    $('#listings').scrollIntoView({ behavior: 'smooth' });
  });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  $('#petOnly').addEventListener('change', (e) => { state.pets = e.target.checked; render(); });
  $('#favOnly').addEventListener('change', (e) => { state.favOnly = e.target.checked; render(); });
  $('#favToggle').addEventListener('click', () => {
    const c = $('#favOnly'); c.checked = !c.checked; state.favOnly = c.checked; render();
    $('#listings').scrollIntoView({ behavior: 'smooth' });
  });
  $('#reset').addEventListener('click', () => {
    Object.assign(state, { q: '', type: '', beds: 0, max: 0, pets: false, favOnly: false, sort: 'featured' });
    $('#searchForm').reset(); $('#petOnly').checked = false; $('#favOnly').checked = false; $('#sort').value = 'featured';
    render();
  });

  // ---- detail modal + booking ----
  const modal = $('#modal');
  function openModal(id) {
    const l = LISTINGS.find((x) => x.id === id);
    const [a, b, c] = l.photos;
    const img = (s) => s ? `<div><img src="${esc(s)}" alt="" onerror="this.remove()"></div>` : '';
    const today = new Date().toISOString().slice(0, 10);
    $('#mBody').innerHTML = `
      <div class="gallery">${img(a)}${b ? `<div class="side">${img(b)}${img(c) || ''}</div>` : ''}</div>
      <div class="m-content">
        <div>
          <h2 id="mTitle">${esc(l.title)}</h2>
          <p class="muted">${esc(l.city)} · ${esc(l.type)} · Hosted by ${esc(l.host)}</p>
          <div class="meta" style="margin-top:10px"><span>🛏 ${l.beds} bedrooms</span><span>🛁 ${l.baths} baths</span><span>📐 ${l.sqft.toLocaleString()} sqft</span><span>${l.pets ? '🐾 Pets welcome' : '🚫 No pets'}</span></div>
          <div class="tags">${l.amenities.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>
          <p>${esc(l.desc)}</p>
        </div>
        <form class="book" id="bookForm" novalidate>
          <div class="price">${money(l.price)} <small>/ month</small></div>
          <label>Your name<input name="name" required autocomplete="name"></label>
          <label>Email<input name="email" type="email" required autocomplete="email"></label>
          <label>Preferred viewing date<input name="date" type="date" min="${today}" required></label>
          <label>Move-in date<input name="movein" type="date" min="${today}"></label>
          <label>Message (optional)<textarea name="msg" rows="2"></textarea></label>
          <div class="err" id="bookErr" role="alert"></div>
          <button class="btn primary" type="submit">Request viewing</button>
          <button class="btn" type="button" id="mFav">${favs.has(l.id) ? '♥ Saved' : '♡ Save home'}</button>
        </form>
      </div>`;
    $('#mFav').onclick = () => { toggleFav(l.id); $('#mFav').textContent = favs.has(l.id) ? '♥ Saved' : '♡ Save home'; };
    $('#bookForm').onsubmit = (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const err = $('#bookErr');
      if (!f.name.trim()) return (err.textContent = 'Please enter your name.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return (err.textContent = 'Please enter a valid email.');
      if (!f.date) return (err.textContent = 'Please choose a viewing date.');
      const reqs = store.get('requests', []);
      reqs.push({ listing: l.id, ...f, at: Date.now() });
      store.set('requests', reqs);
      modal.close();
      toast(`Viewing requested for ${l.title}. ${l.host} will be in touch.`);
    };
    modal.showModal();
  }
  $('#mClose').addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

  $('#yr').textContent = new Date().getFullYear();
  render();
})();
