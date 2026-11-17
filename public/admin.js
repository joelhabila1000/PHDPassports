const body = document.getElementById('records-body');
const resultCount = document.getElementById('result-count');
const alertSlot = document.getElementById('alert-slot');
const search = document.getElementById('search');
const statTotal = document.getElementById('stat-total');
const statPhotos = document.getElementById('stat-photos');
const statLatest = document.getElementById('stat-latest');
const checkedAt = document.getElementById('checked-at');
const dbNote = document.getElementById('db-note');

const downloads = [
  document.getElementById('download-xlsx'),
  document.getElementById('download-csv'),
  document.getElementById('download-zip'),
].filter(Boolean);

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const shortFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

let debounceTimer = null;

function formatDate(value, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : dateFormat.format(date);
}

function setStats(count, photos, latest) {
  statTotal.textContent = String(count);
  statPhotos.textContent = String(photos);
  statLatest.textContent = latest ? shortFormat.format(new Date(latest)) : 'None yet';
  statLatest.classList.toggle('stat__value--text', !latest);

  const disabled = count === 0;
  downloads.forEach((link) => {
    link.setAttribute('aria-disabled', String(disabled));
    link.tabIndex = disabled ? -1 : 0;
    link.style.opacity = disabled ? '0.45' : '';
    link.style.pointerEvents = disabled ? 'none' : '';
  });
}

function showAlert(kind, title, detail, action) {
  alertSlot.replaceChildren();
  const box = document.createElement('div');
  box.className = `alert${kind === 'success' ? ' alert--success' : ''}`;
  box.setAttribute('role', 'alert');
  box.style.margin = '16px 18px 0';

  const heading = document.createElement('strong');
  heading.textContent = title;
  box.append(heading);

  if (detail) {
    const text = document.createElement('span');
    text.textContent = detail;
    box.append(text);
  }

  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--secondary';
    button.textContent = action.label;
    button.style.marginTop = '8px';
    button.style.alignSelf = 'start';
    button.addEventListener('click', action.run);
    box.append(button);
  }

  alertSlot.append(box);
}

function clearAlert() {
  alertSlot.replaceChildren();
}

function skeleton() {
  body.replaceChildren();
  for (let index = 0; index < 4; index += 1) {
    const row = document.createElement('tr');
    row.className = 'skeleton-row';
    const widths = ['62%', '40%', '48%', '54%', '30%'];
    widths.forEach((width, cellIndex) => {
      const cell = document.createElement('td');
      const block = document.createElement('div');
      block.className = cellIndex === 1 ? 'skeleton skeleton--photo' : 'skeleton';
      if (cellIndex !== 1) block.style.width = width;
      cell.append(block);
      row.append(cell);
    });
    body.append(row);
  }
  resultCount.textContent = 'Loading records…';
}

function emptyState(title, message, withLink) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 5;
  const wrap = document.createElement('div');
  wrap.className = 'state';

  const icon = document.createElement('div');
  icon.className = 'state__icon';
  icon.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8.5 17c.9-1.6 2.1-2.4 3.5-2.4s2.6.8 3.5 2.4" stroke-linecap="round"/></svg>';

  const heading = document.createElement('h3');
  heading.textContent = title;

  const text = document.createElement('p');
  text.textContent = message;

  wrap.append(icon, heading, text);

  if (withLink) {
    const link = document.createElement('a');
    link.className = 'btn btn--secondary';
    link.href = '/';
    link.textContent = 'Open the student form';
    link.style.marginTop = '6px';
    wrap.append(link);
  }

  cell.append(wrap);
  row.append(cell);
  body.replaceChildren(row);
}

function buildRow(student) {
  const row = document.createElement('tr');
  row.dataset.id = String(student.id);

  const studentCell = document.createElement('td');
  studentCell.dataset.label = 'Student';
  const person = document.createElement('div');
  person.className = 'cell-person';

  const photo = document.createElement('img');
  photo.className = 'avatar';
  photo.loading = 'lazy';
  photo.alt = '';
  photo.src = `/api/students/${student.id}/passport?inline=1`;
  photo.width = 40;
  photo.height = 46;

  const nameWrap = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'cell-person__name';
  name.textContent = student.fullName;
  const title = document.createElement('div');
  title.className = 'cell-person__title';
  title.textContent = student.title;
  nameWrap.append(name, title);
  person.append(photo, nameWrap);

  const matricCell = document.createElement('td');
  matricCell.dataset.label = 'Matric';
  const matric = document.createElement('span');
  matric.className = 'mono';
  matric.textContent = student.matricNumber;
  matricCell.append(matric);

  const fileCell = document.createElement('td');
  fileCell.dataset.label = 'File';
  const file = document.createElement('span');
  file.className = 'mono';
  if (student.hasPassport) {
    file.textContent = student.passportFile;
  } else {
    file.textContent = 'Not uploaded';
    file.style.color = 'var(--ink-3)';
  }
  fileCell.append(file);

  const dateCell = document.createElement('td');
  dateCell.dataset.label = 'Submitted';
  const dateWrap = document.createElement('div');
  const submitted = document.createElement('div');
  submitted.textContent = formatDate(student.createdAt);
  dateWrap.append(submitted);
  if (student.updatedAt && student.updatedAt !== student.createdAt) {
    const updated = document.createElement('div');
    updated.className = 'muted';
    updated.textContent = `Updated ${formatDate(student.updatedAt)}`;
    dateWrap.append(updated);
  }
  dateCell.append(dateWrap);

  const actionCell = document.createElement('td');
  actionCell.dataset.label = 'Actions';
  const actions = document.createElement('div');
  actions.className = 'row-actions';

  if (student.hasPassport) {
    const view = document.createElement('a');
    view.className = 'btn btn--ghost';
    view.href = `/api/students/${student.id}/passport?inline=1`;
    view.target = '_blank';
    view.rel = 'noopener';
    view.textContent = 'View';
    actions.append(view);

    const download = document.createElement('a');
    download.className = 'btn btn--ghost';
    download.href = `/api/students/${student.id}/passport`;
    download.setAttribute('download', student.passportFile);
    download.textContent = 'Download';
    actions.append(download);
  }

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn btn--danger';
  remove.textContent = 'Delete';
  remove.addEventListener('click', () => deleteRecord(student));
  actions.append(remove);

  actionCell.append(actions);
  studentCell.append(person);

  row.append(studentCell, matricCell, fileCell, dateCell, actionCell);
  return row;
}

function render(students, query) {
  if (students.length === 0) {
    if (query) {
      emptyState(
        `No match for “${query}”`,
        'Check the spelling, or search with only part of the name or matric number.',
        false,
      );
      resultCount.textContent = '0 of ' + statTotal.textContent + ' students';
    } else {
      emptyState(
        'No students have submitted yet',
        'Records appear here the moment a student submits the form. Share the student link to start collecting details.',
        true,
      );
      resultCount.textContent = '0 students';
    }
    return;
  }

  const fragment = document.createDocumentFragment();
  students.forEach((student) => fragment.append(buildRow(student)));
  body.replaceChildren(fragment);

  resultCount.textContent = query
    ? `${students.length} of ${statTotal.textContent} students`
    : `${students.length} student${students.length === 1 ? '' : 's'}`;
}

async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    if (!response.ok) throw new Error('stats failed');
    const stats = await response.json();
    setStats(stats.total, stats.photos, stats.latest);
    return stats;
  } catch (error) {
    setStats(0, 0, null);
    return { total: 0, latest: null };
  }
}

async function loadRecords(query = '') {
  const url = query ? `/api/students?q=${encodeURIComponent(query)}` : '/api/students';
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Request failed');
    const payload = await response.json();
    clearAlert();
    render(payload.students, query);
  } catch (error) {
    body.replaceChildren();
    resultCount.textContent = 'Records unavailable';
    showAlert(
      'error',
      'Could not load the register.',
      'The server did not respond. Check the connection, then try again.',
      { label: 'Try again', run: refresh },
    );
  }
}

async function refresh() {
  skeleton();
  clearAlert();
  await loadStats();
  await loadRecords(search.value.trim());
  checkedAt.textContent = `Checked ${dateFormat.format(new Date())}`;
}

async function deleteRecord(student) {
  const confirmed = window.confirm(
    `Delete the record and photograph for ${student.title} ${student.fullName} (${student.matricNumber})?\n\nThis cannot be undone.`,
  );
  if (!confirmed) return;

  try {
    const response = await fetch(`/api/students/${student.id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Delete failed');
    await refresh();
    showAlert('success', 'Record deleted.', `${student.matricNumber} was removed from the register.`);
  } catch (error) {
    showAlert(
      'error',
      'Could not delete that record.',
      'Nothing was changed. Try again in a moment.',
    );
  }
}

search.addEventListener('input', () => {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => loadRecords(search.value.trim()), 220);
});

document.getElementById('search').addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && search.value) {
    search.value = '';
    loadRecords('');
  }
});

refresh();

fetch('/api/config')
  .then((response) => (response.ok ? response.json() : null))
  .then((config) => {
    if (config) dbNote.textContent = `Storage: ${config.database}`;
  })
  .catch(() => {});
