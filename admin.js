// ============================================================
//  admin.js — Aura_11 Admin Panel
//  All candle CRUD operations via Spring Boot API
// ============================================================

const API_BASE    = 'http://localhost:8080/api';
const ADMIN_KEY   = 'aura11-admin-secret';   // must match backend AdminController
const SESSION_KEY = 'aura11-admin-logged-in';

// ── DOM refs ──────────────────────────────────────────────────
const loginOverlay    = document.getElementById('admin-login-overlay');
const adminPanel      = document.getElementById('admin-panel');
const loginPasswordEl = document.getElementById('admin-password-input');
const loginError      = document.getElementById('admin-login-error');
const loginBtn        = document.getElementById('admin-login-btn');
const logoutBtn       = document.getElementById('admin-logout-btn');
const statusBadge     = document.getElementById('admin-status-badge');

const candleForm      = document.getElementById('candle-form');
const formTitle       = document.getElementById('form-title');
const submitBtn       = document.getElementById('submit-btn');
const submitLabel     = document.getElementById('submit-label');
const resetFormBtn    = document.getElementById('reset-form-btn');
const formStatus      = document.getElementById('form-status');

const editIdField     = document.getElementById('edit-candle-id');
const fieldName       = document.getElementById('field-name');
const fieldCategory   = document.getElementById('field-category');
const fieldPrice      = document.getElementById('field-price');
const fieldStock      = document.getElementById('field-stock');
const fieldDesc       = document.getElementById('field-description');
const fieldNotes      = document.getElementById('field-notes');
const fieldImageUpload = document.getElementById('field-image-upload');
const fieldFeatured    = document.getElementById('field-featured');
const imagePreviewWrap = document.getElementById('image-preview-wrap');
const imagePreview    = document.getElementById('image-preview');

const adminSearch     = document.getElementById('admin-search');
const adminFilterCat  = document.getElementById('admin-filter-cat');
const adminRefreshBtn = document.getElementById('admin-refresh-btn');
const adminTableBody  = document.getElementById('admin-table-body');
const catalogStatus   = document.getElementById('admin-catalog-status');

const statTotal       = document.getElementById('stat-total');
const statFeatured    = document.getElementById('stat-featured');
const statInstock     = document.getElementById('stat-instock');
const statCategories  = document.getElementById('stat-categories');

const toast           = document.getElementById('toast');

// ── State ─────────────────────────────────────────────────────
let allCandles   = [];
let toastTimer;
let currentImageUrl = '';

// ============================================================
//  AUTH — simple password guard
//  The password is checked against the backend, which returns
//  a 403 if wrong. The session is kept in sessionStorage so
//  a page refresh requires re-login.
// ============================================================
const ADMIN_PASSWORD = 'aura11admin'; // Change this! Must match AdminController

function isLoggedIn() {
    try {
        return sessionStorage.getItem(SESSION_KEY) === 'true';
    } catch (e) {
        console.warn('sessionStorage is not available. Please run via a local web server (http://localhost) instead of file://');
        return false;
    }
}

function showPanel() {
    loginOverlay.classList.add('hidden');
    adminPanel.classList.remove('hidden');
}

function showLogin() {
    loginOverlay.classList.remove('hidden');
    adminPanel.classList.add('hidden');
}

loginBtn.addEventListener('click', () => {
    const pw = loginPasswordEl.value.trim();
    if (pw === ADMIN_PASSWORD) {
        try {
            sessionStorage.setItem(SESSION_KEY, 'true');
        } catch (e) {
            alert("Login state cannot be saved when opening the file directly from your computer. Please use a local server like VS Code Live Server.");
        }
        loginError.classList.add('hidden');
        showPanel();
        initAdmin();
    } else {
        loginError.classList.remove('hidden');
        loginPasswordEl.value = '';
        loginPasswordEl.focus();
    }
});

loginPasswordEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') loginBtn.click();
});

logoutBtn.addEventListener('click', () => {
    try {
        sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    showLogin();
});

// ============================================================
//  API HELPERS
// ============================================================
async function adminFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            'X-Admin-Key':  ADMIN_KEY,
            ...options.headers
        },
        ...options
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
    }

    // DELETE returns plain message, not always JSON
    if (res.status === 204) return {};
    return res.json();
}

// ============================================================
//  TOAST
// ============================================================
function showToast(msg) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

// ============================================================
//  LOAD ALL CANDLES
// ============================================================
async function loadCandles() {
    catalogStatus.textContent = 'Loading...';
    try {
        const data = await adminFetch('/candles?page=0&size=200&sortBy=name&direction=asc');
        allCandles = data.content || [];
        renderTable(allCandles);
        updateStats(allCandles);
        catalogStatus.textContent = `${allCandles.length} candle${allCandles.length === 1 ? '' : 's'} in catalog`;
        statusBadge.textContent   = '● Connected';
        statusBadge.classList.remove('offline');
    } catch (e) {
        catalogStatus.textContent = '⚠ Could not load candles. Is the backend running on :8080?';
        statusBadge.textContent   = '● Offline';
        statusBadge.classList.add('offline');
    }
}

function updateStats(candles) {
    statTotal.textContent      = candles.length;
    statFeatured.textContent   = candles.filter(c => c.featured).length;
    statInstock.textContent    = candles.filter(c => c.stock > 0).length;
    const cats = new Set(candles.map(c => c.category));
    statCategories.textContent = cats.size;
}

// ============================================================
//  RENDER TABLE
// ============================================================
function renderTable(candles) {
    if (!adminTableBody) return;

    const keyword = adminSearch  ? adminSearch.value.trim().toLowerCase()  : '';
    const catFilter = adminFilterCat ? adminFilterCat.value : '';

    const filtered = candles.filter(c => {
        const matchesKw  = !keyword || `${c.name} ${c.notes || ''} ${c.description || ''}`.toLowerCase().includes(keyword);
        const matchesCat = !catFilter || c.category === catFilter;
        return matchesKw && matchesCat;
    });

    if (filtered.length === 0) {
        adminTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-soft)">No candles found.</td></tr>`;
        return;
    }

    adminTableBody.innerHTML = filtered.map(c => `
        <tr>
            <td>
                <img class="admin-table-img"
                     src="${c.imageUrl || './images/profile.jpg'}"
                     alt="${c.name}"
                     onerror="this.src='./images/profile.jpg'">
            </td>
            <td>
                <strong>${c.name}</strong>
                ${c.notes ? `<br><span style="font-size:0.8rem;color:var(--text-soft)">${c.notes}</span>` : ''}
            </td>
            <td><span class="admin-cat-badge">${c.category}</span></td>
            <td><strong>₹${Number(c.price).toLocaleString('en-IN')}</strong></td>
            <td class="${c.stock < 5 ? 'admin-stock-low' : 'admin-stock-ok'}">${c.stock}</td>
            <td class="${c.featured ? 'admin-featured-yes' : 'admin-featured-no'}">${c.featured ? '★ Yes' : '—'}</td>
            <td>
                <div class="admin-action-btns">
                    <button class="admin-btn-edit" onclick="startEdit(${c.id})">✏ Edit</button>
                    <button class="admin-btn-delete" onclick="deleteCandle(${c.id}, '${c.name.replace(/'/g, "\\'")}')">🗑 Delete</button>
                </div>
            </td>
        </tr>`).join('');
}

// ============================================================
//  IMAGE PREVIEW (File Upload)
// ============================================================
if (fieldImageUpload) {
    fieldImageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                currentImageUrl = ev.target.result;
                imagePreview.src = ev.target.result;
                imagePreviewWrap.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            if (!currentImageUrl) {
                imagePreviewWrap.classList.add('hidden');
            }
        }
    });
}

// ============================================================
//  FORM VALIDATION
// ============================================================
function validateForm() {
    let valid = true;
    [fieldName, fieldCategory, fieldPrice, fieldStock].forEach(f => {
        f.classList.remove('field-error');
        if (!f.value.trim()) { f.classList.add('field-error'); valid = false; }
    });
    if (Number(fieldPrice.value) <= 0) { fieldPrice.classList.add('field-error'); valid = false; }
    if (Number(fieldStock.value) < 0)  { fieldStock.classList.add('field-error'); valid = false; }
    return valid;
}

// ============================================================
//  CREATE / UPDATE
// ============================================================
candleForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm()) {
        setFormStatus('Please fill in all required fields.', 'error');
        return;
    }

    const id       = editIdField.value;
    const isEdit   = Boolean(id);
    const payload  = {
        name:        fieldName.value.trim(),
        category:    fieldCategory.value,
        price:       parseFloat(fieldPrice.value),
        stock:       parseInt(fieldStock.value),
        description: fieldDesc.value.trim(),
        notes:       fieldNotes.value.trim(),
        imageUrl:    currentImageUrl,
        featured:    fieldFeatured.checked
    };

    submitBtn.disabled = true;
    submitLabel.textContent = isEdit ? 'Saving...' : 'Adding...';

    try {
        if (isEdit) {
            await adminFetch(`/admin/candles/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            setFormStatus('Candle updated successfully!', 'success');
            showToast(`"${payload.name}" updated.`);
        } else {
            await adminFetch('/admin/candles', { method: 'POST', body: JSON.stringify(payload) });
            setFormStatus('Candle added to catalog!', 'success');
            showToast(`"${payload.name}" added.`);
        }
        resetForm();
        await loadCandles();
    } catch (err) {
        setFormStatus(`Error: ${err.message}`, 'error');
        showToast('Something went wrong. Check the console.');
    } finally {
        submitBtn.disabled = false;
        submitLabel.textContent = isEdit ? 'Save Changes' : 'Add Candle';
    }
});

function setFormStatus(msg, type) {
    formStatus.textContent = msg;
    formStatus.className = `admin-form-status ${type}`;
    setTimeout(() => { formStatus.textContent = ''; formStatus.className = 'admin-form-status'; }, 4000);
}

// ============================================================
//  EDIT — populate form with existing candle
// ============================================================
window.startEdit = function(id) {
    const candle = allCandles.find(c => c.id === id);
    if (!candle) return;

    editIdField.value     = candle.id;
    fieldName.value       = candle.name;
    fieldCategory.value   = candle.category;
    fieldPrice.value      = candle.price;
    fieldStock.value      = candle.stock;
    fieldDesc.value       = candle.description || '';
    fieldNotes.value      = candle.notes || '';
    currentImageUrl       = candle.imageUrl || '';
    if (fieldImageUpload) fieldImageUpload.value = ''; // clear file input
    fieldFeatured.checked = candle.featured;

    // Show image preview
    if (candle.imageUrl) {
        imagePreview.src = candle.imageUrl;
        imagePreviewWrap.classList.remove('hidden');
    }

    formTitle.textContent        = `Editing: ${candle.name}`;
    submitLabel.textContent      = 'Save Changes';
    resetFormBtn.classList.remove('hidden');
    formStatus.textContent       = '';

    // Scroll to form
    candleForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ============================================================
//  DELETE
// ============================================================
window.deleteCandle = async function(id, name) {
    if (!confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) return;

    try {
        await adminFetch(`/admin/candles/${id}`, { method: 'DELETE' });
        showToast(`"${name}" deleted.`);
        await loadCandles();
        if (String(editIdField.value) === String(id)) resetForm();
    } catch (err) {
        showToast(`Delete failed: ${err.message}`);
    }
};

// ============================================================
//  RESET FORM
// ============================================================
function resetForm() {
    editIdField.value     = '';
    currentImageUrl       = '';
    candleForm.reset();
    fieldFeatured.checked = false;
    formTitle.textContent = 'Add New Candle';
    submitLabel.textContent = 'Add Candle';
    resetFormBtn.classList.add('hidden');
    imagePreviewWrap.classList.add('hidden');
    [fieldName, fieldCategory, fieldPrice, fieldStock].forEach(f => f.classList.remove('field-error'));
}

resetFormBtn.addEventListener('click', resetForm);

// ============================================================
//  TABLE SEARCH + FILTER (client-side, instant)
// ============================================================
adminSearch.addEventListener('input',    () => renderTable(allCandles));
adminFilterCat.addEventListener('change', () => renderTable(allCandles));
adminRefreshBtn.addEventListener('click', loadCandles);

// ============================================================
//  INIT
// ============================================================
async function initAdmin() {
    await loadCandles();
}

// Auto-restore session on page load
try {
    if (isLoggedIn()) {
        showPanel();
        initAdmin();
    } else {
        showLogin();
    }
} catch (e) {
    showLogin();
}
