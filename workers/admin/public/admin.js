const SITE_ROOT = 'https://allenchenhan99.github.io/website/';
const ratingKeys = ['longevity', 'presence', 'sweetness', 'warmth', 'complexity', 'dailyWearability'];
const ratingLabels = ['LONGEVITY', 'PRESENCE', 'SWEETNESS', 'WARMTH', 'COMPLEXITY', 'DAILY'];

const state = {
  tab: 'perfume',
  perfume: [],
  music: [],
  revision: '',
  selectedId: null,
  images: { perfume: null, music: null },
  previewUrls: { perfume: '', music: '' },
  publishing: false,
};

const elements = {
  workspace: document.querySelector('.workspace'),
  loading: document.querySelector('#loading'),
  identity: document.querySelector('#identity'),
  list: document.querySelector('#entry-list'),
  count: document.querySelector('#item-count'),
  newEntry: document.querySelector('#new-entry'),
  editorMode: document.querySelector('#editor-mode'),
  editorTitle: document.querySelector('#editor-title'),
  dirty: document.querySelector('#dirty-state'),
  perfumeForm: document.querySelector('#perfume-form'),
  musicForm: document.querySelector('#music-form'),
  perfumePreview: document.querySelector('#perfume-preview'),
  musicPreview: document.querySelector('#music-preview'),
  radar: document.querySelector('#radar'),
  toast: document.querySelector('#toast'),
  deletePerfume: document.querySelector('#delete-perfume'),
  deleteMusic: document.querySelector('#delete-music'),
  clearPerfumeImage: document.querySelector('#clear-perfume-image'),
  clearMusicImage: document.querySelector('#clear-music-image'),
};

function splitList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function assetUrl(path) {
  if (!path) return '';
  return path.startsWith('https://') ? path : new URL(path, SITE_ROOT).href;
}

function showToast(message, options = {}) {
  elements.toast.className = `toast visible${options.error ? ' error' : ''}`;
  elements.toast.replaceChildren(document.createTextNode(message));
  if (options.link) {
    elements.toast.append(document.createTextNode(' '));
    const anchor = document.createElement('a');
    anchor.href = options.link;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.textContent = 'View commit ↗';
    elements.toast.append(anchor);
  }
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => elements.toast.classList.remove('visible'), 7000);
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function setBusy(busy) {
  state.publishing = busy;
  document.querySelectorAll('.publish-button, .danger-button').forEach((button) => {
    button.disabled = busy;
  });
  document.querySelectorAll('.publish-button').forEach((button) => {
    button.textContent = busy ? 'Publishing…' : button.dataset.label;
  });
}

function setFormValue(form, name, value) {
  const field = form.elements.namedItem(name);
  if (field) field.value = value ?? '';
}

function setPreview(type, path) {
  const preview = type === 'perfume' ? elements.perfumePreview : elements.musicPreview;
  const clearButton = type === 'perfume' ? elements.clearPerfumeImage : elements.clearMusicImage;
  const placeholder = preview.parentElement.querySelector('.image-placeholder');
  const url = state.previewUrls[type] || assetUrl(path);
  preview.src = url;
  preview.hidden = !url;
  placeholder.hidden = Boolean(url);
  clearButton.hidden = !url;
}

function clearImage(type) {
  if (state.previewUrls[type]) URL.revokeObjectURL(state.previewUrls[type]);
  state.previewUrls[type] = '';
  state.images[type] = null;
  setPreview(type, '');
}

function removeCover(type) {
  const form = type === 'perfume' ? elements.perfumeForm : elements.musicForm;
  form.dataset.cover = '';
  form.elements.namedItem('image').value = '';
  clearImage(type);
  elements.dirty.textContent = 'UNPUBLISHED CHANGES';
}

function resetPerfume() {
  const form = elements.perfumeForm;
  form.reset();
  form.dataset.cover = '';
  setFormValue(form, 'id', '');
  setFormValue(form, 'date', today());
  ratingKeys.forEach((key) => setFormValue(form, key, 3));
  state.selectedId = null;
  clearImage('perfume');
  elements.deletePerfume.hidden = true;
  elements.editorMode.textContent = 'NEW ENTRY';
  elements.editorTitle.textContent = 'Add a perfume';
  updateRatings();
  renderList();
}

function resetMusic() {
  const form = elements.musicForm;
  form.reset();
  form.dataset.cover = '';
  setFormValue(form, 'id', '');
  setFormValue(form, 'date', today());
  state.selectedId = null;
  clearImage('music');
  elements.deleteMusic.hidden = true;
  elements.editorMode.textContent = 'NEW ENTRY';
  elements.editorTitle.textContent = 'Add a music post';
  renderList();
}

function fillPerfume(post) {
  const form = elements.perfumeForm;
  clearImage('perfume');
  for (const field of ['id', 'brand', 'name', 'title', 'date', 'source', 'excerpt']) {
    setFormValue(form, field, post[field]);
  }
  setFormValue(form, 'scents', post.scents.join(', '));
  setFormValue(form, 'notes-top', post.notes.top.join(', '));
  setFormValue(form, 'notes-middle', post.notes.middle.join(', '));
  setFormValue(form, 'notes-base', post.notes.base.join(', '));
  setFormValue(form, 'content', post.content.join('\n\n'));
  ratingKeys.forEach((key) => setFormValue(form, key, post.ratings[key]));
  form.dataset.cover = post.cover || '';
  state.selectedId = post.id;
  setPreview('perfume', post.cover);
  elements.deletePerfume.hidden = false;
  elements.editorMode.textContent = `EDITING / #${String(post.id).padStart(2, '0')}`;
  elements.editorTitle.textContent = `${post.brand} — ${post.name}`;
  updateRatings();
  renderList();
}

function fillMusic(post) {
  const form = elements.musicForm;
  clearImage('music');
  for (const field of ['id', 'title', 'tag', 'date', 'excerpt']) setFormValue(form, field, post[field]);
  form.dataset.cover = post.cover || '';
  state.selectedId = post.id;
  setPreview('music', post.cover);
  elements.deleteMusic.hidden = false;
  elements.editorMode.textContent = `EDITING / #${String(post.id).padStart(2, '0')}`;
  elements.editorTitle.textContent = post.title;
  renderList();
}

function renderList() {
  const posts = state[state.tab];
  elements.count.textContent = `${posts.length} ${posts.length === 1 ? 'entry' : 'entries'}`;
  elements.list.replaceChildren();
  if (posts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-list';
    empty.textContent = 'Nothing here yet.\nCreate the first entry.';
    elements.list.append(empty);
    return;
  }
  posts.forEach((post) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `entry-card${post.id === state.selectedId ? ' active' : ''}`;
    const title = document.createElement('strong');
    title.textContent = state.tab === 'perfume' ? `${post.brand} — ${post.name}` : post.title;
    const subtitle = document.createElement('span');
    subtitle.textContent = state.tab === 'perfume' ? post.title : post.tag;
    const meta = document.createElement('small');
    meta.textContent = `${post.date}  ·  #${String(post.id).padStart(2, '0')}`;
    button.append(title, subtitle, meta);
    button.addEventListener('click', () => state.tab === 'perfume' ? fillPerfume(post) : fillMusic(post));
    elements.list.append(button);
  });
}

function selectTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  elements.perfumeForm.hidden = tab !== 'perfume';
  elements.musicForm.hidden = tab !== 'music';
  if (tab === 'perfume') resetPerfume();
  else resetMusic();
}

function ratingValues() {
  return Object.fromEntries(ratingKeys.map((key) => [
    key,
    Number(elements.perfumeForm.elements.namedItem(key).value),
  ]));
}

function polygonPoint(cx, cy, radius, index, count) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
}

function drawRadar() {
  const canvas = elements.radar;
  const context = canvas.getContext('2d');
  const scale = window.devicePixelRatio || 1;
  const cssWidth = 360;
  const cssHeight = 310;
  canvas.width = cssWidth * scale;
  canvas.height = cssHeight * scale;
  context.scale(scale, scale);
  context.clearRect(0, 0, cssWidth, cssHeight);
  const cx = cssWidth / 2;
  const cy = cssHeight / 2 - 3;
  const radius = 102;
  const values = ratingValues();

  for (let level = 1; level <= 5; level += 1) {
    context.beginPath();
    ratingKeys.forEach((_, index) => {
      const [x, y] = polygonPoint(cx, cy, radius * level / 5, index, ratingKeys.length);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.closePath();
    context.strokeStyle = level === 5 ? '#555' : '#353535';
    context.lineWidth = 1;
    context.stroke();
  }

  ratingKeys.forEach((_, index) => {
    const [x, y] = polygonPoint(cx, cy, radius, index, ratingKeys.length);
    context.beginPath();
    context.moveTo(cx, cy);
    context.lineTo(x, y);
    context.strokeStyle = '#343434';
    context.stroke();
    const [labelX, labelY] = polygonPoint(cx, cy, radius + 25, index, ratingKeys.length);
    context.fillStyle = '#858585';
    context.font = '9px "SF Mono", monospace';
    context.textAlign = Math.abs(labelX - cx) < 4 ? 'center' : labelX > cx ? 'left' : 'right';
    context.textBaseline = labelY < cy ? 'bottom' : labelY > cy ? 'top' : 'middle';
    context.fillText(ratingLabels[index], labelX, labelY);
  });

  context.beginPath();
  ratingKeys.forEach((key, index) => {
    const [x, y] = polygonPoint(cx, cy, radius * values[key] / 5, index, ratingKeys.length);
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  context.closePath();
  context.fillStyle = 'rgba(212, 165, 116, .18)';
  context.strokeStyle = '#d4a574';
  context.lineWidth = 1.5;
  context.fill();
  context.stroke();
}

function updateRatings() {
  ratingKeys.forEach((key) => {
    const value = Number(elements.perfumeForm.elements.namedItem(key).value);
    document.querySelector(`[data-output="${key}"]`).textContent = value.toFixed(1);
  });
  drawRadar();
}

async function optimizeImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (file.size > 12 * 1024 * 1024) throw new Error('The original image must be under 12 MB.');
  const bitmap = await createImageBitmap(file);
  const maxSide = 1800;
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', .86));
  if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('The optimized image is still over 5 MB.');
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Unable to read the image.'));
    reader.readAsDataURL(blob);
  });
  return { name: file.name.replace(/\.[^.]+$/, '.webp'), type: 'image/webp', base64 };
}

async function acceptImage(type, file) {
  if (!file) return;
  try {
    state.images[type] = await optimizeImage(file);
    if (state.previewUrls[type]) URL.revokeObjectURL(state.previewUrls[type]);
    state.previewUrls[type] = URL.createObjectURL(file);
    setPreview(type, '');
    elements.dirty.textContent = 'IMAGE READY';
  } catch (error) {
    showToast(error.message, { error: true });
  }
}

function formId(form) {
  const value = Number(form.elements.namedItem('id').value);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function perfumePayload() {
  const form = elements.perfumeForm;
  const content = form.elements.namedItem('content').value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return {
    id: formId(form),
    date: form.elements.namedItem('date').value.trim(),
    brand: form.elements.namedItem('brand').value.trim(),
    name: form.elements.namedItem('name').value.trim(),
    title: form.elements.namedItem('title').value.trim(),
    excerpt: form.elements.namedItem('excerpt').value.trim(),
    content,
    scents: splitList(form.elements.namedItem('scents').value),
    notes: {
      top: splitList(form.elements.namedItem('notes-top').value),
      middle: splitList(form.elements.namedItem('notes-middle').value),
      base: splitList(form.elements.namedItem('notes-base').value),
    },
    ratings: ratingValues(),
    cover: form.dataset.cover || '',
    source: form.elements.namedItem('source').value.trim(),
  };
}

function musicPayload() {
  const form = elements.musicForm;
  return {
    id: formId(form),
    date: form.elements.namedItem('date').value.trim(),
    title: form.elements.namedItem('title').value.trim(),
    tag: form.elements.namedItem('tag').value.trim(),
    excerpt: form.elements.namedItem('excerpt').value.trim(),
    cover: form.dataset.cover || '',
  };
}

async function publish(type, item) {
  setBusy(true);
  try {
    const payload = await api(`/api/publish/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Action': 'publish' },
      body: JSON.stringify({
        action: 'upsert',
        revision: state.revision,
        [type]: item,
        image: state.images[type] || undefined,
      }),
    });
    showToast('Published. GitHub Pages is rebuilding now.', { link: payload.commitUrl });
    await loadContent(payload.post?.id);
  } catch (error) {
    showToast(error.message, { error: true });
  } finally {
    setBusy(false);
  }
}

async function deleteEntry(type) {
  if (!state.selectedId || !window.confirm(`Delete this ${type} entry? This will publish immediately.`)) return;
  setBusy(true);
  try {
    const payload = await api(`/api/publish/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Action': 'publish' },
      body: JSON.stringify({ action: 'delete', revision: state.revision, id: state.selectedId }),
    });
    showToast('Deleted. GitHub Pages is rebuilding now.', { link: payload.commitUrl });
    await loadContent();
  } catch (error) {
    showToast(error.message, { error: true });
  } finally {
    setBusy(false);
  }
}

async function loadContent(preferredId) {
  const content = await api('/api/content');
  state.perfume = content.perfume;
  state.music = content.music;
  state.revision = content.revision;
  elements.identity.textContent = content.identity.email;
  const selected = state[state.tab].find((post) => post.id === preferredId);
  if (selected) state.tab === 'perfume' ? fillPerfume(selected) : fillMusic(selected);
  else if (state.tab === 'perfume') resetPerfume();
  else resetMusic();
  elements.dirty.textContent = `SYNCED / ${content.revision.slice(0, 7)}`;
}

document.querySelectorAll('.publish-button').forEach((button) => { button.dataset.label = button.textContent; });
document.querySelectorAll('.tab').forEach((button) => button.addEventListener('click', () => selectTab(button.dataset.tab)));
elements.newEntry.addEventListener('click', () => state.tab === 'perfume' ? resetPerfume() : resetMusic());
elements.perfumeForm.addEventListener('input', (event) => {
  elements.dirty.textContent = 'UNPUBLISHED CHANGES';
  if (event.target.type === 'range') updateRatings();
});
elements.musicForm.addEventListener('input', () => { elements.dirty.textContent = 'UNPUBLISHED CHANGES'; });
elements.perfumeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.publishing) publish('perfume', perfumePayload());
});
elements.musicForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.publishing) publish('music', musicPayload());
});
document.querySelector('#perfume-image').addEventListener('change', (event) => acceptImage('perfume', event.target.files[0]));
document.querySelector('#music-image').addEventListener('change', (event) => acceptImage('music', event.target.files[0]));
document.querySelectorAll('.image-field').forEach((field) => {
  field.addEventListener('dragover', (event) => { event.preventDefault(); field.classList.add('dragging'); });
  field.addEventListener('dragleave', () => field.classList.remove('dragging'));
  field.addEventListener('drop', (event) => {
    event.preventDefault();
    field.classList.remove('dragging');
    const type = field.htmlFor.startsWith('perfume') ? 'perfume' : 'music';
    acceptImage(type, event.dataTransfer.files[0]);
  });
});
elements.deletePerfume.addEventListener('click', () => deleteEntry('perfume'));
elements.deleteMusic.addEventListener('click', () => deleteEntry('music'));
elements.clearPerfumeImage.addEventListener('click', () => removeCover('perfume'));
elements.clearMusicImage.addEventListener('click', () => removeCover('music'));

updateRatings();
loadContent()
  .catch((error) => {
    showToast(error.message, { error: true });
    elements.identity.textContent = 'Session unavailable';
  })
  .finally(() => {
    elements.loading.hidden = true;
    elements.workspace.setAttribute('aria-busy', 'false');
  });
