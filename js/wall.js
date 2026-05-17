/* =============================================
   js/wall.js — Confession Wall Logic
   WhisperWall Confession App
   ============================================= */

// ── State ──
let confessions    = [];
let selectedMood   = '😶 Blank';
let currentUser    = null;

// ── On Page Load ──
window.addEventListener('DOMContentLoaded', () => {
  // Auth Guard
  const session = getSession();
  if (!session || !session.verified) {
    window.location.href = 'index.html';
    return;
  }

  currentUser = session;
  document.getElementById('userBadge').textContent = `👤 ${session.name}`;

  // Load from storage
  loadConfessions();
  renderFeed();

  // Mood picker
  setupMoodPicker();

  // Char counter
  setupCharCounter();
});

// ── Post a Confession ──
function postConfession() {
  const titleEl = document.getElementById('confTitle');
  const textEl  = document.getElementById('confText');
  const errEl   = document.getElementById('confError');
  const btn     = document.getElementById('confessBtn');

  errEl.textContent = '';

  const title = titleEl.value.trim();
  const text  = textEl.value.trim();

  if (text.length < 10) {
    errEl.textContent = 'Your confession must be at least 10 characters.';
    return;
  }

  const conf = {
    id:        Date.now().toString(),
    title:     title || 'Untitled Confession',
    body:      text,
    mood:      selectedMood,
    author:    currentUser.name,
    authorEmail: currentUser.email,
    timestamp: new Date().toISOString(),
    likes:     0,
    likedBy:   [],
  };

  confessions.unshift(conf);
  saveConfessions();

  // Reset form
  titleEl.value = '';
  textEl.value  = '';
  document.getElementById('charCount').textContent = '0';

  // Animate button
  btn.textContent = '✅ Posted!';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = '🕯️ Post to the Wall';
    btn.disabled = false;
  }, 2000);

  showToast('🕯️ Your confession is on the wall!');
  renderFeed();
}

// ── Render Feed ──
function renderFeed(list = null) {
  const grid    = document.getElementById('feedGrid');
  const empty   = document.getElementById('feedEmpty');
  const toRender = list !== null ? list : getSorted();

  // Remove old cards (keep the empty div)
  const oldCards = grid.querySelectorAll('.conf-card');
  oldCards.forEach(c => c.remove());

  if (toRender.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  toRender.forEach((conf, i) => {
    const card = buildCard(conf, i);
    grid.appendChild(card);
  });
}

// ── Build a Card DOM Element ──
function buildCard(conf, index) {
  const card = document.createElement('div');
  card.className = 'conf-card';
  card.style.animationDelay = `${index * 0.06}s`;

  const isLiked = conf.likedBy && conf.likedBy.includes(currentUser.email);
  const date    = formatDate(conf.timestamp);

  card.innerHTML = `
    <div class="card-mood">${conf.mood}</div>
    <div class="card-title">${escapeHTML(conf.title)}</div>
    <div class="card-body">${escapeHTML(conf.body)}</div>
    <div class="card-footer">
      <span class="card-meta">🕯️ Anonymous · ${date}</span>
      <div class="card-actions">
        <button class="btn-like ${isLiked ? 'liked' : ''}" onclick="toggleLike(event, '${conf.id}')">
          ❤️ ${conf.likes}
        </button>
        <button class="btn-share" onclick="shareConf(event, '${conf.id}')">🔗</button>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openLightbox(conf));
  return card;
}

// ── Like a Confession ──
function toggleLike(event, id) {
  event.stopPropagation();
  const conf = confessions.find(c => c.id === id);
  if (!conf) return;

  if (!conf.likedBy) conf.likedBy = [];

  if (conf.likedBy.includes(currentUser.email)) {
    conf.likedBy = conf.likedBy.filter(e => e !== currentUser.email);
    conf.likes = Math.max(0, conf.likes - 1);
  } else {
    conf.likedBy.push(currentUser.email);
    conf.likes++;
  }

  saveConfessions();
  renderFeed(getFiltered());
}

// ── Share a Confession ──
function shareConf(event, id) {
  event.stopPropagation();
  const conf = confessions.find(c => c.id === id);
  if (!conf) return;

  const text = `"${conf.title}" — ${conf.body.slice(0, 100)}… via WhisperWall 🕯️`;

  if (navigator.share) {
    navigator.share({ title: conf.title, text });
  } else {
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Confession copied to clipboard!');
    });
  }
}

// ── Open Lightbox ──
function openLightbox(conf) {
  document.getElementById('lbMood').textContent  = conf.mood;
  document.getElementById('lbTitle').textContent = conf.title;
  document.getElementById('lbBody').textContent  = conf.body;
  document.getElementById('lbMeta').textContent  = `🕯️ Anonymous · ${formatDate(conf.timestamp)} · ❤️ ${conf.likes} likes`;
  document.getElementById('lightbox').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(event) {
  if (event && event.target !== document.getElementById('lightbox') && !event.target.classList.contains('lightbox-close')) return;
  document.getElementById('lightbox').classList.add('hidden');
  document.body.style.overflow = '';
}

// ── Filter & Sort ──
function filterFeed() {
  renderFeed(getFiltered());
}

function getFiltered() {
  const query = (document.getElementById('searchInput').value || '').toLowerCase();
  let list    = [...confessions];

  if (query) {
    list = list.filter(c =>
      c.title.toLowerCase().includes(query) ||
      c.body.toLowerCase().includes(query)
    );
  }

  return sortList(list);
}

function getSorted() {
  return sortList([...confessions]);
}

function sortList(list) {
  const sort = document.getElementById('sortSelect').value;
  if (sort === 'oldest')  return list.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (sort === 'popular') return list.sort((a,b) => b.likes - a.likes);
  return list.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)); // newest
}

// ── Mood Picker ──
function setupMoodPicker() {
  const btns = document.querySelectorAll('.mood-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMood = btn.dataset.mood;
    });
  });
}

// ── Char Counter ──
function setupCharCounter() {
  const textarea = document.getElementById('confText');
  const counter  = document.getElementById('charCount');
  textarea.addEventListener('input', () => {
    counter.textContent = textarea.value.length;
    counter.style.color = textarea.value.length > 900 ? 'var(--red)' : 'var(--text-faint)';
  });
}

// ── Logout ──
function logout() {
  localStorage.removeItem('ww_session');
  window.location.href = 'index.html';
}

// ── Persistence Helpers ──
function loadConfessions() {
  try {
    confessions = JSON.parse(localStorage.getItem('ww_confessions')) || getDefaultConfessions();
  } catch {
    confessions = getDefaultConfessions();
  }
}

function saveConfessions() {
  localStorage.setItem('ww_confessions', JSON.stringify(confessions));
}

// ── Seed Data ──
function getDefaultConfessions() {
  return [
    {
      id: '1',
      title: 'I pretend to be confident',
      body: 'I give everyone advice about being bold and fearless, but inside I am terrified every single day. Nobody knows.',
      mood: '😔 Guilty',
      author: 'Anonymous',
      authorEmail: '',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      likes: 47,
      likedBy: [],
    },
    {
      id: '2',
      title: 'I never finished reading that book',
      body: 'I have been recommending "The Alchemist" to people for years. I got to chapter 3 and then put it down. I have never finished it.',
      mood: '😅 Relieved',
      author: 'Anonymous',
      authorEmail: '',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      likes: 132,
      likedBy: [],
    },
    {
      id: '3',
      title: 'I cried at a dog food ad',
      body: 'It was 2 AM, I was tired, and suddenly I was sobbing at a 30-second commercial about a golden retriever coming home. No regrets.',
      mood: '😂 Laughing',
      author: 'Anonymous',
      authorEmail: '',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      likes: 89,
      likedBy: [],
    },
  ];
}

// ── Utility ──
function getSession() {
  try { return JSON.parse(localStorage.getItem('ww_session')); }
  catch { return null; }
}

function showToast(msg, duration = 3500) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
