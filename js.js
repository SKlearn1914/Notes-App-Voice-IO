// — Utilities & state
const STORAGE_KEY = 'voice_notes_app_v1';
let notes = []; // {id,title,content,updated}
let currentId = null;
let recognition = null;
let listening = false;

// DOM
const notesList = document.getElementById('notesList');
const sidebarEmpty = document.getElementById('sidebarEmpty');
const newNoteBtn = document.getElementById('newNoteBtn');
const titleInput = document.getElementById('titleInput');
const contentInput = document.getElementById('contentInput');
const saveBtn = document.getElementById('saveBtn');
const deleteBtn = document.getElementById('deleteBtn');
const speakBtn = document.getElementById('speakBtn');
const lastSaved = document.getElementById('lastSaved');
const charCount = document.getElementById('charCount');
const searchInput = document.getElementById('searchInput');
const clearAll = document.getElementById('clearAll');
const themeToggle = document.getElementById('themeToggle');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

// — Initialization
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) notes = JSON.parse(raw) || [];
  } catch (e) { notes = [] }
  // theme
  const theme = localStorage.getItem('vn_theme');
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  renderList();
}

function saveAll() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }

// — Rendering
function renderList(filter = '') {
  notesList.innerHTML = '';
  const filtered = notes.slice().sort((a, b) => b.updated - a.updated).filter(n => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });
  if (filtered.length === 0) { sidebarEmpty.style.display = 'block'; return; } else sidebarEmpty.style.display = 'none';
  for (const n of filtered) {
    const el = document.createElement('div'); el.className = 'note-item'; el.setAttribute('role', 'listitem');
    el.innerHTML = `<div class="note-meta"><div class="note-title">${escapeHtml(n.title || 'Untitled')}</div><div class="note-snippet">${escapeHtml(n.content.slice(0, 80))}</div></div><div class="note-time hint">${timeAgo(new Date(n.updated))}</div>`;
    el.onclick = () => { openNote(n.id) };
    notesList.appendChild(el);
  }
}

function openNote(id) {
  const n = notes.find(x => x.id === id); if (!n) return;
  currentId = id;
  titleInput.value = n.title; contentInput.value = n.content; lastSaved.textContent = new Date(n.updated).toLocaleString(); updateCharCount();
}

function clearEditor() { currentId = null; titleInput.value = ''; contentInput.value = ''; lastSaved.textContent = '—'; updateCharCount(); }

// — CRUD
function createNote() {
  const n = { id: uid(), title: '', content: '', updated: Date.now() };
  notes.push(n); saveAll(); renderList(); openNote(n.id);
}

function saveNote() {
  const t = titleInput.value.trim(); const c = contentInput.value.trim();
  if (!currentId) {
    const n = { id: uid(), title: t, content: c, updated: Date.now() }; notes.push(n); currentId = n.id;
  } else {
    const n = notes.find(x => x.id === currentId); if (!n) return; n.title = t; n.content = c; n.updated = Date.now();
  }
  saveAll(); renderList(); lastSaved.textContent = new Date().toLocaleString();
}

function deleteCurrent() {
  if (!currentId) return; notes = notes.filter(x => x.id !== currentId); saveAll(); renderList(); clearEditor();
}

// — helpers
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function timeAgo(d) {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000); if (sec < 60) return 'just now';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
  if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
  return d.toLocaleDateString();
}

function updateCharCount() { charCount.textContent = (contentInput.value.length) + ' chars' }

// — Speech Recognition setup (Web Speech API)
function setupSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    speakBtn.disabled = true;
    speakBtn.title = "Speech recognition not supported in this browser";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onstart = () => {
    listening = true;
    speakBtn.textContent = "⏺️ Listening...";
    speakBtn.classList.add("warn");
  };

  recognition.onend = () => {
    listening = false;
    speakBtn.textContent = "🎤 Speak";
    speakBtn.classList.remove("warn");
  };

  recognition.onresult = (event) => {
    let text = "";
    for (const result of event.results) {
      text += result[0].transcript;
    }
    contentInput.value += text;
    updateCharCount();
  };

  recognition.onerror = (err) => {
    console.log("Speech Error:", err);
    alert("Microphone access is blocked.\n\nGo to Browser Settings → Allow Microphone.");
  };
}

function toggleListening() {
  if (!recognition) return;
  if (!listening) { try { recognition.start() } catch (e) { console.warn(e) } }
  else recognition.stop();
}

// ---------- Text-To-Speech (Working Version) ----------
let voices = [];
const voiceSelect = document.getElementById("voiceSelect");
const rateRange = document.getElementById("rateRange");
const ttsBtn = document.getElementById("ttsBtn");

// Unlock audio context (required on Chrome/Edge)
document.addEventListener("click", () => {
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  speechSynthesis.speak(u);
}, { once: true });

function loadVoices() {
  voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  voiceSelect.innerHTML = voices.map((v, i) =>
    `<option value="${i}">${v.name} (${v.lang})</option>`
  ).join("");
}
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

ttsBtn.addEventListener("click", () => {
  const text = (titleInput.value + "\n" + contentInput.value).trim();
  if (!text) return;

  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);

  const selected = parseInt(voiceSelect.value, 10);
  if (voices[selected]) utter.voice = voices[selected];

  utter.rate = parseFloat(rateRange.value) || 1;
  speechSynthesis.speak(utter);
});


// Export/Import
exportBtn.addEventListener('click', () => {
  const data = JSON.stringify(notes, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'notes-export.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0]; if (!file) return;
  try {
    const txt = await file.text(); const imported = JSON.parse(txt);
    if (Array.isArray(imported)) {
      // merge safely: keep existing, add new with new ids if conflict
      for (const it of imported) { if (!it.id) it.id = uid(); notes.push(it); }
      saveAll(); renderList(); alert('Imported ' + imported.length + ' notes');
    } else alert('Invalid file format');
  } catch (e) { alert('Import failed: ' + e.message) }
  importFile.value = '';
});

// Theme toggle
themeToggle.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  if (cur === 'dark') { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('vn_theme', 'light'); themeToggle.setAttribute('aria-pressed', 'false') }
  else { document.documentElement.setAttribute('data-theme', 'dark'); localStorage.setItem('vn_theme', 'dark'); themeToggle.setAttribute('aria-pressed', 'true') }
});

// Events
newNoteBtn.addEventListener('click', () => createNote());
saveBtn.addEventListener('click', () => saveNote());
deleteBtn.addEventListener('click', () => { if (confirm('Delete this note?')) deleteCurrent(); });
speakBtn.addEventListener("click", () => {
  if (!recognition) return;
  if (listening) recognition.stop();
  else recognition.start();
});

contentInput.addEventListener('input', () => updateCharCount());
titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); contentInput.focus(); } });

searchInput.addEventListener('input', () => renderList(searchInput.value));
clearAll.addEventListener('click', () => {
  if (confirm('Delete ALL notes? This cannot be undone.')) { notes = []; saveAll(); renderList(); clearEditor(); }
});

// keyboard quick save (Ctrl/Cmd+S)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveNote(); }
  if (e.key === '/') { e.preventDefault(); searchInput.focus(); }
});

// Auto-save every 1 second
setInterval(() => { if (titleInput.value.trim() || contentInput.value.trim()) saveNote(); }, 1000);

// startup
load(); setupSpeech(); updateCharCount();

// open most-recent note when available
if (notes.length) openNote(notes.slice().sort((a, b) => b.updated - a.updated)[0].id);

// accessibility: handle beforeunload save
window.addEventListener('beforeunload', () => { saveAll(); });

