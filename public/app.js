const form = document.getElementById('student-form');
const formView = document.getElementById('form-view');
const receipt = document.getElementById('receipt');
const alertBox = document.getElementById('form-alert');
const submitButton = document.getElementById('submit-button');
const submitLabel = document.getElementById('submit-label');
const fileInput = document.getElementById('passport');
const dropzone = document.getElementById('dropzone');
const dropzoneWrap = document.getElementById('dropzone-wrap');
const preview = document.getElementById('preview');
const previewImage = document.getElementById('preview-image');
const previewName = document.getElementById('preview-name');
const previewMeta = document.getElementById('preview-meta');
const changePhoto = document.getElementById('change-photo');
const removePhoto = document.getElementById('remove-photo');
const matricInput = document.getElementById('matricNumber');

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

let selectedFile = null;
let previewUrl = null;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setFieldError(name, message) {
  const errorNode = document.getElementById(`${name}-error`);
  const input = document.getElementById(name);
  if (errorNode) errorNode.textContent = message || '';
  if (input) {
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  if (name === 'passport') {
    dropzone.dataset.invalid = message ? 'true' : 'false';
  }
}

function clearErrors() {
  ['title', 'fullName', 'matricNumber', 'passport'].forEach((name) => setFieldError(name, ''));
  hideAlert();
}

function showAlert(title, items = []) {
  alertBox.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = title;
  alertBox.append(heading);
  if (items.length) {
    const list = document.createElement('ul');
    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.append(li);
    });
    alertBox.append(list);
  }
  alertBox.hidden = false;
}

function hideAlert() {
  alertBox.hidden = true;
}

function clearField(name) {
  setFieldError(name, '');
  hideAlert();
}

function fileProblem(file) {
  if (!ALLOWED.includes(file.type)) return 'That file is not an image. Use JPG, PNG or WEBP.';
  if (file.size > MAX_BYTES) return `That image is ${formatBytes(file.size)}. The limit is 4 MB.`;
  return '';
}

function showPreview(file) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  previewImage.src = previewUrl;
  previewName.textContent = file.name;
  previewMeta.textContent = `${formatBytes(file.size)} · ${file.type.replace('image/', '').toUpperCase()}`;
  preview.hidden = false;
  dropzoneWrap.hidden = true;
}

function clearPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  selectedFile = null;
  fileInput.value = '';
  preview.hidden = true;
  previewImage.removeAttribute('src');
  dropzoneWrap.hidden = false;
  setFieldError('passport', '');
}

function acceptFile(file) {
  const problem = fileProblem(file);
  if (problem) {
    setFieldError('passport', problem);
    selectedFile = null;
    fileInput.value = '';
    return;
  }
  selectedFile = file;
  setFieldError('passport', '');
  hideAlert();
  showPreview(file);
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) acceptFile(file);
});

changePhoto.addEventListener('click', () => fileInput.click());
removePhoto.addEventListener('click', clearPreview);

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.dataset.dragging = 'true';
  });
});

['dragleave', 'dragend'].forEach((eventName) => {
  dropzone.addEventListener(eventName, () => {
    dropzone.dataset.dragging = 'false';
  });
});

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.dataset.dragging = 'false';
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;

  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  acceptFile(file);
});

matricInput.addEventListener('input', () => {
  const start = matricInput.selectionStart;
  matricInput.value = matricInput.value.toUpperCase();
  matricInput.setSelectionRange(start, start);
  clearField('matricNumber');
});

['title', 'fullName'].forEach((name) => {
  const field = document.getElementById(name);
  ['input', 'change'].forEach((eventName) => {
    field.addEventListener(eventName, () => clearField(name));
  });
});

function collectErrors() {
  const errors = {};
  const title = document.getElementById('title').value;
  const fullName = document.getElementById('fullName').value.trim().replace(/\s+/g, ' ');
  const matric = matricInput.value.trim().toUpperCase();

  if (!title) errors.title = 'Select your title.';
  if (fullName.length < 3) errors.fullName = 'Enter your full name as it appears on your admission letter.';
  else if (fullName.length > 120) errors.fullName = 'Full name must be 120 characters or fewer.';

  if (!matric) errors.matricNumber = 'Enter your matric number.';
  else if (!/^[A-Z0-9][A-Z0-9/\-]{2,24}$/.test(matric)) {
    errors.matricNumber = 'Use letters, numbers, "/" or "-" only (4 to 25 characters).';
  }

  if (!selectedFile) errors.passport = 'Attach your passport photograph.';

  return errors;
}

function setBusy(busy) {
  submitButton.disabled = busy;
  submitButton.setAttribute('aria-busy', String(busy));
  submitLabel.textContent = busy ? 'Submitting…' : 'Submit details';
  if (busy && !submitButton.querySelector('.spinner')) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    submitButton.prepend(spinner);
  } else if (!busy) {
    submitButton.querySelector('.spinner')?.remove();
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const errors = collectErrors();
  const keys = Object.keys(errors);
  if (keys.length) {
    keys.forEach((key) => setFieldError(key, errors[key]));
    showAlert('Check these details before submitting.', keys.map((key) => errors[key]));
    const firstInput = document.getElementById(keys[0]);
    (firstInput || dropzone).focus();
    if (keys.includes('passport')) dropzone.dataset.invalid = 'true';
    return;
  }

  setBusy(true);

  try {
    const body = new FormData(form);
    if (selectedFile) body.set('passport', selectedFile);

    const response = await fetch('/api/students', { method: 'POST', body });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const fieldErrors = payload.errors || {};
      const messages = Object.values(fieldErrors);
      Object.entries(fieldErrors).forEach(([key, message]) => setFieldError(key, message));
      showAlert(
        payload.message || 'We could not save these details.',
        messages.length ? messages : ['Try again. If it keeps failing, contact the Postgraduate College.'],
      );
      setBusy(false);
      return;
    }

    showReceipt(payload);
  } catch (error) {
    showAlert('We could not reach the server.', [
      'Check your connection, then submit again. Nothing was saved.',
    ]);
    setBusy(false);
  }
});

function showReceipt(payload) {
  const student = payload.student;

  document.getElementById('receipt-heading').textContent = payload.created
    ? 'Your details have been submitted'
    : 'Your record has been updated';
  document.getElementById('receipt-message').textContent = payload.created
    ? 'The Postgraduate College now holds your bio-data and photograph. Keep the file name below for reference.'
    : 'This matric number was already on the register, so the earlier record was replaced with what you just submitted.';

  document.getElementById('receipt-name').textContent = `${student.title} ${student.fullName}`;
  document.getElementById('receipt-matric').textContent = student.matricNumber;
  document.getElementById('receipt-file').textContent = student.passportFile;

  const photo = document.getElementById('receipt-photo');
  photo.src = `${student.passportUrl}&inline=1`;
  photo.alt = `Passport photograph of ${student.fullName}`;

  const download = document.getElementById('receipt-download');
  download.href = student.passportUrl;
  download.setAttribute('download', student.passportFile);

  formView.hidden = true;
  receipt.hidden = false;
  receipt.classList.add('fade-in');
  setBusy(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.getElementById('receipt-heading').focus?.();
}

document.getElementById('submit-another').addEventListener('click', () => {
  form.reset();
  clearErrors();
  clearPreview();
  receipt.hidden = true;
  formView.hidden = false;
  document.getElementById('title').focus();
});
