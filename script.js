// ============================================================
//  Aura_11 — script.js  (API-wired version)
// ============================================================

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal
  ? `http://${window.location.hostname}:8080/api`
  : '/api';
const LOCAL_CART_KEY = 'aura11-local-cart';

// ── Session ID (sent as X-Session-Id header for cart & favorites) ──
const SESSION_ID = (() => {
    let id = localStorage.getItem('aura11-session');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('aura11-session', id);
    }
    return id;
})();

const HEADERS = {
    'Content-Type': 'application/json',
    'X-Session-Id': SESSION_ID
};

// ── DOM refs ──────────────────────────────────────────────────
const cartCount              = document.getElementById('cart-count');
const cartItems              = document.getElementById('cart-items');
const cartTotal              = document.getElementById('cart-total');
const cartSummary            = document.getElementById('cart-summary');
const checkoutBtn            = document.getElementById('checkout-btn');
const completePaymentBtn     = document.getElementById('complete-payment-btn');
const searchInput            = document.getElementById('search');
const sortSelect             = document.getElementById('sort-select');
const floralGrid             = document.getElementById('floral-grid');
const freshGrid              = document.getElementById('fresh-grid');
const warmGrid               = document.getElementById('warm-grid');
const catalogStatus          = document.getElementById('catalog-status');
const resultsSummary         = document.getElementById('results-summary');
const favoritesList          = document.getElementById('favorites-list');
const toast                  = document.getElementById('toast');
const filterChips            = Array.from(document.querySelectorAll('.filter-chip'));
const slideIndicators        = document.getElementById('slide-indicators');
const paymentAmount          = document.getElementById('payment-amount');
const onlinePaymentBox       = document.getElementById('online-payment-box');
const paymentStatus          = document.getElementById('payment-status');
const orderProgress          = document.getElementById('order-progress');
const customerNameInput      = document.getElementById('customer-name');
const customerPhoneInput     = document.getElementById('customer-phone');
const customerAddressInput   = document.getElementById('customer-address');
const productDetailContainer = document.getElementById('product-detail');
const introSplit             = document.getElementById('intro-split');

// ── State ─────────────────────────────────────────────────────
let products        = [];   // loaded from API
let filteredProducts = [];
let cart            = [];   // synced with API
let favorites       = new Set();
let activeFilter    = 'all';
let toastTimer;
let slideIndex      = 0;
let revealObserver;
let paymentCompleted = false;
let searchDebounce;
let usingLocalCartFallback = false;

// ============================================================
//  API HELPERS
// ============================================================

async function apiFetch(path, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            headers: HEADERS,
            ...options
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `HTTP ${res.status}`);
        }
        return await res.json();
    } catch (e) {
        console.error('API error:', path, e.message);
        throw e;
    }
}

// ── Candle API ────────────────────────────────────────────────
async function fetchCandles(params = {}) {
    const qs = new URLSearchParams({
        page: 0,
        size: 100,
        sortBy: params.sortBy || 'featured',
        direction: params.direction || 'asc',
        ...(params.category && params.category !== 'all' ? { category: params.category } : {}),
        ...(params.keyword ? { keyword: params.keyword } : {})
    });
    const data = await apiFetch(`/candles/filter?${qs}`);
    return data.content || [];
}

async function fetchCandleById(id) {
    return apiFetch(`/candles/${id}`);
}

// ── Cart API ──────────────────────────────────────────────────
async function fetchCart() {
    return apiFetch('/cart');
}

async function apiAddToCart(candleId, quantity) {
    return apiFetch('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ candleId, quantity })
    });
}

async function apiUpdateCartQty(candleId, quantity) {
    return apiFetch(`/cart/items/${candleId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity })
    });
}

async function apiRemoveFromCart(candleId) {
    return apiFetch(`/cart/items/${candleId}`, { method: 'DELETE' });
}

async function apiClearCart() {
    return apiFetch('/cart', { method: 'DELETE' });
}

// ── Favorites API ─────────────────────────────────────────────
async function fetchFavorites() {
    return apiFetch('/favorites');
}

async function apiAddFavorite(candleId) {
    return apiFetch(`/favorites/${candleId}`, { method: 'POST' });
}

async function apiRemoveFavorite(candleId) {
    return apiFetch(`/favorites/${candleId}`, { method: 'DELETE' });
}

// ============================================================
//  FORMATTING
// ============================================================
function formatCurrency(amount) {
    return `INR ${Number(amount).toLocaleString('en-IN')}`;
}

function setCatalogStatus(message) {
    if (!catalogStatus) return;
    catalogStatus.textContent = message;
    catalogStatus.style.display = message ? 'block' : 'none';
}

function showToast(message) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2600);
}

function readLocalCart() {
    try {
        const stored = JSON.parse(localStorage.getItem(LOCAL_CART_KEY) || '[]');
        return Array.isArray(stored) ? stored : [];
    } catch (e) {
        return [];
    }
}

function writeLocalCart(items) {
    localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(items));
}

function clearLocalCart() {
    localStorage.removeItem(LOCAL_CART_KEY);
}

function getProductById(productId) {
    return products.find(product => Number(product.id) === Number(productId));
}

function buildLocalCartItem(product, quantity, existingItem) {
    return {
        candle: product,
        quantity,
        priceAtAdd: Number(existingItem?.priceAtAdd ?? product?.price ?? 0),
        subtotal: Number(existingItem?.priceAtAdd ?? product?.price ?? 0) * quantity
    };
}

function addToLocalCart(candleId, quantity) {
    const product = getProductById(candleId);
    if (!product) return false;

    const localCart = readLocalCart();
    const existingIndex = localCart.findIndex(item => Number(item.candle?.id) === Number(candleId));

    if (existingIndex >= 0) {
        const existingItem = localCart[existingIndex];
        const nextQty = Number(existingItem.quantity || 0) + quantity;
        localCart[existingIndex] = buildLocalCartItem(product, nextQty, existingItem);
    } else {
        localCart.push(buildLocalCartItem(product, quantity));
    }

    writeLocalCart(localCart);
    cart = localCart;
    usingLocalCartFallback = true;
    return true;
}

function removeFromLocalCart(candleId) {
    const localCart = readLocalCart().filter(item => Number(item.candle?.id) !== Number(candleId));
    writeLocalCart(localCart);
    cart = localCart;
    usingLocalCartFallback = true;
}

// ============================================================
//  MOOD TAGS  (kept client-side — derives tags from name/description)
// ============================================================
function getMoodTags(product) {
    // Use backend category first (most reliable)
    if (product.category) {
        const map = {
            floral: ['Floral'],
            fresh:  ['Fresh'],
            citrus: ['Citrus'],
            woody:  ['Woody'],
            cozy:   ['Cozy']
        };
        if (map[product.category]) return map[product.category];
    }

    // Fallback: derive from name + description + notes
    const haystack = `${product.name} ${product.description || ''} ${product.notes || ''}`.toLowerCase();
    const tags = [];
    if (/(rose|lavender|jasmine|lily|floral|bloom|peony)/.test(haystack))  tags.push('Floral');
    if (/(ocean|linen|mint|fresh|rain|breeze|cotton|sea)/.test(haystack))   tags.push('Fresh');
    if (/(orange|lemon|bergamot|grapefruit|citrus|yuzu)/.test(haystack))    tags.push('Citrus');
    if (/(cedar|sandal|amber|musk|wood|oud|vetiver)/.test(haystack))        tags.push('Woody');
    if (/(vanilla|coffee|chai|cozy|warm|spice|caramel|cashmere)/.test(haystack)) tags.push('Cozy');
    return tags.length > 0 ? tags : ['Signature'];
}

function getCollectionGroup(product) {
    const cat = product.category || '';
    if (cat === 'floral') return 'floral';
    if (cat === 'fresh' || cat === 'citrus') return 'fresh';
    if (cat === 'woody' || cat === 'cozy') return 'warm';

    // Fallback using tags
    const tags = getMoodTags(product);
    if (tags.includes('Floral')) return 'floral';
    if (tags.includes('Fresh') || tags.includes('Citrus')) return 'fresh';
    return 'warm';
}

// ============================================================
//  PRODUCT CARD
// ============================================================
function getImageSrc(product) {
    // Backend stores imageUrl; frontend catalog used image
    return product.imageUrl || product.image || './images/profile.jpg';
}

function createProductCard(product) {
    const tags = getMoodTags(product).map(t => `<span class="tag">${t}</span>`).join('');
    const isFav = favorites.has(product.id);
    const price = product.price;

    return `
        <article class="candle">
            <button class="favorite-btn ${isFav ? 'active' : ''}" data-favorite-id="${product.id}" type="button" aria-label="${isFav ? 'Remove favorite' : 'Save favorite'}">&#9829;</button>
            <img src="${getImageSrc(product)}" alt="${product.name}" loading="lazy">
            <div class="card-content">
                <div class="card-topline">
                    <h3>${product.name}</h3>
                    <p class="price">${formatCurrency(price)}</p>
                </div>
                <p class="description">${product.description || ''}</p>
                <div class="tag-list">${tags}</div>
                <div class="card-actions">
                    <input type="number" min="1" value="1" class="quantity" data-product-id="${product.id}" aria-label="Quantity for ${product.name}">
                    <button class="add-to-cart" data-product-id="${product.id}" type="button">Add to Cart</button>
                    <a class="details-link" href="product.html?id=${product.id}">View Details</a>
                </div>
            </div>
        </article>`;
}

// ============================================================
//  RENDER PRODUCTS
// ============================================================
function renderProducts() {
    if (!floralGrid || !freshGrid || !warmGrid) return;

    floralGrid.innerHTML = '';
    freshGrid.innerHTML  = '';
    warmGrid.innerHTML   = '';

    if (filteredProducts.length === 0) {
        setCatalogStatus('No candles matched your search and filter.');
        if (resultsSummary) resultsSummary.textContent = '0 products found';
        return;
    }

    setCatalogStatus('');
    if (resultsSummary) {
        resultsSummary.textContent = `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'} found`;
    }

    const grouped = { floral: [], fresh: [], warm: [] };
    filteredProducts.forEach(p => grouped[getCollectionGroup(p)].push(createProductCard(p)));

    floralGrid.innerHTML = grouped.floral.length ? grouped.floral.join('') : '<p class="empty-state">No floral candles in this filter.</p>';
    freshGrid.innerHTML  = grouped.fresh.length  ? grouped.fresh.join('')  : '<p class="empty-state">No fresh or citrus candles in this filter.</p>';
    warmGrid.innerHTML   = grouped.warm.length   ? grouped.warm.join('')   : '<p class="empty-state">No warm candles in this filter.</p>';

    refreshRevealTargets();
}

// ============================================================
//  RENDER FAVORITES
// ============================================================
function renderFavorites() {
    if (!favoritesList) return;
    const favProducts = products.filter(p => favorites.has(p.id));

    if (favProducts.length === 0) {
        favoritesList.innerHTML = '<p class="empty-state">No favorites yet. Tap the heart on a candle to save it here.</p>';
        return;
    }

    favoritesList.innerHTML = favProducts.map(p => `
        <article class="favorite-card">
            <img src="${getImageSrc(p)}" alt="${p.name}">
            <div>
                <h3>${p.name}</h3>
                <p>${p.description || ''}</p>
            </div>
            <div class="favorite-card-actions">
                <strong>${formatCurrency(p.price)}</strong>
                <button class="favorite-remove-btn" data-remove-favorite-id="${p.id}" type="button">Remove</button>
            </div>
        </article>`).join('');

    refreshRevealTargets();
}

// ============================================================
//  RENDER CART
// ============================================================
function renderCart() {
    // Update badge everywhere
    if (cartCount) {
        const total = cart.reduce((s, i) => s + (i.quantity || 0), 0);
        cartCount.textContent = String(total);
    }

    if (!cartItems || !cartSummary || !cartTotal) return;

    cartItems.innerHTML = '';

    if (cart.length === 0) {
        cartSummary.textContent = '0 items selected';
        cartTotal.textContent   = 'Total: INR 0';
        cartItems.innerHTML     = '<p class="empty-state">Your cart is empty.</p>';
        updatePaymentSummary(0);
        return;
    }

    let grandTotal = 0;
    let itemCount  = 0;

    cart.forEach(item => {
        // item from API: { candle: {...}, quantity, priceAtAdd, subtotal }
        const candle    = item.candle || {};
        const qty       = item.quantity || 1;
        const price     = Number(item.priceAtAdd || candle.price || 0);
        const lineTotal = price * qty;
        grandTotal     += lineTotal;
        itemCount      += qty;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div>
                <strong>${candle.name || 'Candle'}</strong>
                <p>${qty} item${qty === 1 ? '' : 's'} selected</p>
            </div>
            <div class="cart-item-actions">
                <span>${formatCurrency(lineTotal)}</span>
                <button data-cart-candle-id="${candle.id}" type="button">Remove</button>
            </div>`;

        div.querySelector('button').addEventListener('click', () => removeFromCart(candle.id));
        cartItems.appendChild(div);
    });

    cartSummary.textContent = `${itemCount} item${itemCount === 1 ? '' : 's'} selected`;
    cartTotal.textContent   = `Total: ${formatCurrency(grandTotal)}`;
    updatePaymentSummary(grandTotal);
    refreshRevealTargets();
}

// ============================================================
//  LOAD PRODUCTS FROM API
// ============================================================
async function loadProducts() {
    setCatalogStatus('Loading candle catalog...');
    try {
        const sortBy    = sortSelect ? sortSelect.value : 'featured';
        const keyword   = searchInput ? searchInput.value.trim() : '';
        const category  = activeFilter !== 'all' ? activeFilter : undefined;

        products = await fetchCandles({ sortBy, keyword, category });
        filteredProducts = [...products];
        renderProducts();
        renderFavorites();
        setCatalogStatus('');
    } catch (e) {
        setCatalogStatus('Could not load catalog. Is the backend running?');
        console.error(e);
    }
}

// ============================================================
//  APPLY FILTERS  (calls API with current filter state)
// ============================================================
function applyFilters() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadProducts, 300);
}

// ============================================================
//  CART ACTIONS
// ============================================================
async function addToCart(candleId, quantity) {
    try {
        const updatedCart = await apiAddToCart(candleId, quantity);
        cart = updatedCart.items || [];
        usingLocalCartFallback = false;
        clearLocalCart();
        renderCart();
        showToast('Item added to cart.');
    } catch (e) {
        if (addToLocalCart(candleId, quantity)) {
            renderCart();
            showToast('Item added to cart.');
            return;
        }
        showToast('Could not add to cart. Try again.');
    }
}

async function removeFromCart(candleId) {
    try {
        const updatedCart = await apiRemoveFromCart(candleId);
        cart = updatedCart.items || [];
        usingLocalCartFallback = false;
        clearLocalCart();
        renderCart();
        showToast('Item removed from cart.');
    } catch (e) {
        removeFromLocalCart(candleId);
        renderCart();
        showToast('Item removed from cart.');
    }
}

async function loadCart() {
    const localCart = readLocalCart();
    if (localCart.length > 0) {
        cart = localCart;
        usingLocalCartFallback = true;
        renderCart();
    }

    try {
        const data = await fetchCart();
        if (!usingLocalCartFallback || localCart.length === 0) {
            cart = data.items || [];
            usingLocalCartFallback = false;
            if (!cart.length) clearLocalCart();
        }
        renderCart();
    } catch (e) {
        cart = localCart;
        usingLocalCartFallback = localCart.length > 0;
        renderCart();
    }
}

// ============================================================
//  FAVORITES ACTIONS
// ============================================================
async function loadFavoritesFromAPI() {
    try {
        const data = await fetchFavorites();
        favorites = new Set(data.map(f => f.candle?.id || f.candleId));
    } catch (e) {
        favorites = new Set();
    }
}

async function toggleFavorite(productId) {
    if (favorites.has(productId)) {
        try {
            await apiRemoveFavorite(productId);
            favorites.delete(productId);
            showToast('Removed from favorites.');
        } catch (e) {
            showToast('Could not update favorites.');
        }
    } else {
        try {
            await apiAddFavorite(productId);
            favorites.add(productId);
            showToast('Saved to favorites.');
        } catch (e) {
            showToast('Could not save favorite.');
        }
    }
    renderProducts();
    renderFavorites();
}

// ============================================================
//  CHECKOUT
// ============================================================
function getSelectedPaymentMethod() {
    const sel = document.querySelector('input[name="payment-method"]:checked');
    return sel ? sel.value : 'cod';
}

function getCustomerDetails() {
    return {
        name:    customerNameInput    ? customerNameInput.value.trim()    : '',
        phone:   customerPhoneInput   ? customerPhoneInput.value.trim()   : '',
        address: customerAddressInput ? customerAddressInput.value.trim() : ''
    };
}

function updatePaymentSummary(total) {
    if (paymentAmount) paymentAmount.textContent = formatCurrency(total);
    if (!paymentStatus) return;
    const method = getSelectedPaymentMethod();
    paymentStatus.textContent = method === 'cod'
        ? 'Payment mode: Cash on Delivery'
        : (paymentCompleted ? 'Payment completed' : 'Payment pending');
}

function updatePaymentUI() {
    if (!onlinePaymentBox) return;
    const isOnline = getSelectedPaymentMethod() === 'online';
    onlinePaymentBox.classList.toggle('hidden', !isOnline);
    const total = cart.reduce((s, i) => s + (Number(i.priceAtAdd || 0) * i.quantity), 0);
    updatePaymentSummary(total);
    
    if (isOnline) {
        const gpayContainer = document.getElementById('gpay-container');
        if (gpayContainer) {
            // Using the requested number for UPI ID.
            const upiId = '9003331456@upi'; 
            const name = encodeURIComponent('Aura_11 Candle Shop');
            const upiUri = `upi://pay?pa=${upiId}&pn=${name}&am=${total}&cu=INR`;
            
            gpayContainer.innerHTML = `
                <p style="font-size:1.1rem; font-weight:600; margin-bottom: 1rem; color:var(--text-strong)">GPay / PhonePe / UPI to: <strong style="font-size:1.2rem;">9003331456</strong></p>
                <a href="${upiUri}" class="gpay-button" target="_blank" style="display:inline-block; background-color:#111; color:#fff; padding:12px 24px; border-radius:4px; text-decoration:none; font-weight:600; margin-bottom:1rem;">
                    Pay ${formatCurrency(total)} with UPI App
                </a>
                <p style="margin-top:0.5rem; font-size:0.9rem; color:var(--text-soft)">Or scan to pay via any UPI app:</p>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiUri)}" alt="UPI QR Code" style="margin-top: 0.5rem; border-radius: 8px;">
            `;
        }
    }
}

function buildOrderMessage(orderId, total, paymentMethod, customer) {
    const items = cart.map((item, idx) => {
        const candle = item.candle || {};
        const line   = Number(item.priceAtAdd || 0) * item.quantity;
        return `${idx + 1}. ${candle.name} x ${item.quantity} - ${formatCurrency(line)}`;
    }).join('\n');

    return [
        `Order ID: ${orderId}`,
        `Customer: ${customer.name}`,
        `Phone: ${customer.phone}`,
        `Address: ${customer.address}`,
        `Payment: ${paymentMethod === 'online' ? 'Online Payment' : 'Cash on Delivery'}`,
        `Total: ${formatCurrency(total)}`,
        '', 'Products:', items,
        '', 'Please attach your payment screenshot if you paid online.'
    ].join('\n');
}

function openContactChannels(orderText, orderId) {
    const wa  = `https://wa.me/919003331456?text=${encodeURIComponent(orderText)}`;
    const ml  = `mailto:varaks0206@gmail.com?subject=${encodeURIComponent(`New Candle Order ${orderId}`)}&body=${encodeURIComponent(orderText)}`;
    window.open(wa, '_blank', 'noopener');
    window.location.href = ml;
}

async function checkout() {
    const total  = cart.reduce((s, i) => s + (Number(i.priceAtAdd || 0) * i.quantity), 0);
    const orderId = `ORD-${Date.now()}`;
    const method  = getSelectedPaymentMethod();
    const customer = getCustomerDetails();

    if (!customer.name || !customer.phone || !customer.address) {
        alert('Please enter your name, phone number, and address.');
        return;
    }
    if (method === 'online' && !paymentCompleted) {
        alert('Please complete the online payment first.');
        return;
    }

    const orderText = buildOrderMessage(orderId, total, method, customer);
    openContactChannels(orderText, orderId);
    updateOrderProgress(method);

    // Clear cart via API
    try { await apiClearCart(); } catch (e) { /* ignore */ }

    cart = [];
    paymentCompleted = false;
    usingLocalCartFallback = false;
    clearLocalCart();
    renderCart();
    resetCheckoutForm();
    showToast(`Order ${orderId} placed successfully.`);
    alert(`Thank you for your purchase! Order ${orderId} total: ${formatCurrency(total)}`);
}

function buildPaymentConfirmationMessage(total, customer) {
    const items = cart.map((item, idx) => {
        const candle = item.candle || {};
        return `${idx + 1}. ${candle.name} x ${item.quantity} - ${formatCurrency(Number(item.priceAtAdd || 0) * item.quantity)}`;
    }).join('\n');
    return [
        'Online payment completed for Aura_11 order.',
        `Customer: ${customer.name}`,
        `Phone: ${customer.phone}`,
        `Address: ${customer.address}`,
        `Paid Amount: ${formatCurrency(total)}`,
        '', 'Products:', items,
        '', 'Please attach your payment screenshot here to confirm the order.'
    ].join('\n');
}

function sendPaymentConfirmation(total, customer) {
    const text = buildPaymentConfirmationMessage(total, customer);
    const wa   = `https://wa.me/919003331456?text=${encodeURIComponent(text)}`;
    const ml   = `mailto:varaks0206@gmail.com?subject=${encodeURIComponent('Online Payment Completed')}&body=${encodeURIComponent(text)}`;
    window.open(wa, '_blank', 'noopener');
    window.setTimeout(() => { window.location.href = ml; }, 250);
}

function updateOrderProgress(method) {
    if (!orderProgress) return;
    const steps = [
        { title: '1. Order confirmed', text: 'Your cart details are confirmed and received.' },
        { title: '2. Payment completed', text: method === 'online' ? 'Online payment completed successfully.' : 'Cash on Delivery selected.' },
        { title: '3. Order is ready',    text: 'Your order is being packed and prepared.' },
        { title: '4. Ready for delivery', text: 'The order is now ready for delivery dispatch.' }
    ];
    orderProgress.innerHTML = steps.map(s => `
        <div class="order-step active-step">
            <strong>${s.title}</strong>
            <span>${s.text}</span>
        </div>`).join('');
}

function resetCheckoutForm() {
    if (customerNameInput)    customerNameInput.value    = '';
    if (customerPhoneInput)   customerPhoneInput.value   = '';
    if (customerAddressInput) customerAddressInput.value = '';
    const cod = document.querySelector('input[name="payment-method"][value="cod"]');
    if (cod) cod.checked = true;
    updatePaymentUI();
}

// ============================================================
//  PRODUCT DETAIL PAGE
// ============================================================
async function renderProductDetailPage() {
    if (!productDetailContainer) return;

    const params    = new URLSearchParams(window.location.search);
    const productId = Number(params.get('id'));

    if (!productId) {
        productDetailContainer.innerHTML = `<div class="empty-state"><p>Product not found.</p><a href="index.html#collection" class="primary-link">Back to Collection</a></div>`;
        return;
    }

    productDetailContainer.innerHTML = '<p style="padding:2rem;color:var(--text-soft)">Loading product...</p>';

    try {
        const product = await fetchCandleById(productId);
        const tags = getMoodTags(product).map(t => `<span class="tag">${t}</span>`).join('');

        // Related: fetch same category, exclude current
        let related = [];
        try {
            const relData = await fetchCandles({ category: product.category, sortBy: 'featured' });
            related = relData.filter(p => p.id !== productId).slice(0, 4);
        } catch (e) { /* skip related */ }

        const relatedHTML = related.map(createProductCard).join('');

        productDetailContainer.innerHTML = `
            <div class="product-detail-layout">
                <article class="product-detail-card">
                    <div class="product-detail-media">
                        <img src="${getImageSrc(product)}" alt="${product.name}">
                    </div>
                    <div class="product-detail-copy">
                        <p class="eyebrow">Signature Candle</p>
                        <h2>${product.name}</h2>
                        <p class="product-detail-price">${formatCurrency(product.price)}</p>
                        <p class="product-detail-description">${product.description || ''}</p>
                        <div class="tag-list">${tags}</div>
                        <div class="product-detail-highlights">
                            <div class="detail-pill">Clean styled jar</div>
                            <div class="detail-pill">Home fragrance mood</div>
                            <div class="detail-pill">Gift-ready pick</div>
                        </div>
                        <div class="product-detail-actions">
                            <input type="number" min="1" value="1" class="quantity product-detail-quantity" data-product-id="${product.id}" aria-label="Quantity for ${product.name}">
                            <button class="add-to-cart" data-product-id="${product.id}" type="button">Add to Cart</button>
                            <a href="cart.html" class="secondary-link">Go to Cart</a>
                        </div>
                    </div>
                </article>
                ${related.length ? `
                <section class="related-products-panel" aria-label="More products">
                    <div class="section-heading related-heading">
                        <div>
                            <p class="eyebrow">Add More</p>
                            <h2>More Candles You May Like</h2>
                        </div>
                        <p class="results-summary">Add other fragrances without leaving this page</p>
                    </div>
                    <div class="candle-grid related-products-grid">${relatedHTML}</div>
                </section>` : ''}
            </div>`;

        refreshRevealTargets();
    } catch (e) {
        productDetailContainer.innerHTML = `<div class="empty-state"><p>Product not found.</p><a href="index.html#collection" class="primary-link">Back to Collection</a></div>`;
    }
}

// ============================================================
//  SLIDESHOW
// ============================================================
function buildSlideIndicators() {
    if (!slideIndicators) return;
    const slides = document.querySelectorAll('.slideshow img');
    slideIndicators.innerHTML = '';
    slides.forEach((_, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = i === 0 ? 'indicator active' : 'indicator';
        btn.setAttribute('aria-label', `Go to slide ${i + 1}`);
        btn.addEventListener('click', () => showSlides(i));
        slideIndicators.appendChild(btn);
    });
}

function showSlides(n) {
    const slides     = document.querySelectorAll('.slideshow img');
    const indicators = document.querySelectorAll('.indicator');
    if (!slides.length) return;
    if (n >= slides.length) slideIndex = 0;
    else if (n < 0)         slideIndex = slides.length - 1;
    else                    slideIndex = n;
    slides.forEach(s     => s.classList.remove('active'));
    indicators.forEach(i => i.classList.remove('active'));
    slides[slideIndex].classList.add('active');
    if (indicators[slideIndex]) indicators[slideIndex].classList.add('active');
}

function changeSlide(n) { showSlides(slideIndex + n); }

// ============================================================
//  INTRO SPLIT
// ============================================================
function setupIntroSplit() {
    if (!introSplit) return;
    document.body.classList.add('intro-active');
    window.setTimeout(() => introSplit.classList.add('is-complete'), 1000);
    window.setTimeout(() => document.body.classList.remove('intro-active'), 2000);
}

// ============================================================
//  SCROLL REVEAL & CARD TILT
// ============================================================
function setupScrollReveal() {
    if (!('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                entry.target.classList.remove('is-soft-hidden');
            } else {
                entry.target.classList.remove('is-visible');
                entry.target.classList.add('is-soft-hidden');
            }
        });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    refreshRevealTargets();
}

function refreshRevealTargets() {
    if (!revealObserver) return;
    document.querySelectorAll('#home,#collection,#about,#favorites,.cart-preview,.cart-hero,.standalone-cart-section,.collection-group,.favorite-card,.cart-item,.candle').forEach(el => {
        if (!el.classList.contains('scroll-reveal')) el.classList.add('scroll-reveal');
        revealObserver.observe(el);
    });
}

function setupCardInteractions() {
    document.addEventListener('pointermove', e => {
        const card = e.target.closest('.candle');
        if (!card) return;
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty('--mx', `${(x / r.width) * 100}%`);
        card.style.setProperty('--my', `${(y / r.height) * 100}%`);
        card.style.transform = `perspective(900px) rotateX(${((y / r.height) - 0.5) * -10}deg) rotateY(${((x / r.width) - 0.5) * 10}deg) translateY(-4px)`;
    });
    document.addEventListener('pointerleave', e => {
        const card = e.target.closest('.candle');
        if (!card) return;
        card.style.transform = '';
        card.style.removeProperty('--mx');
        card.style.removeProperty('--my');
    }, true);
}

// ============================================================
//  EVENT LISTENERS
// ============================================================
if (searchInput) searchInput.addEventListener('input', applyFilters);
if (sortSelect)  sortSelect.addEventListener('change', applyFilters);

filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
        filterChips.forEach(b => b.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.filter;
        applyFilters();
    });
});

document.addEventListener('click', async e => {
    // Favorite toggle
    const favBtn = e.target.closest('.favorite-btn');
    if (favBtn) { await toggleFavorite(Number(favBtn.dataset.favoriteId)); return; }

    // Add to cart
    const addBtn = e.target.closest('.add-to-cart');
    if (addBtn) {
        const productId = Number(addBtn.dataset.productId);
        const actionScope = addBtn.closest('.card-actions, .product-detail-actions');
        const qtyInput  = actionScope
            ? actionScope.querySelector(`.quantity[data-product-id="${productId}"]`)
            : document.querySelector(`.quantity[data-product-id="${productId}"]`);
        const qty = Number(qtyInput?.value || 1);
        if (!Number.isInteger(qty) || qty < 1) { alert('Please enter a valid quantity.'); return; }
        await addToCart(productId, qty);
        return;
    }

    // Remove from cart (cart page button)
    const removeBtn = e.target.closest('[data-cart-candle-id]');
    if (removeBtn) { await removeFromCart(Number(removeBtn.dataset.cartCandleId)); return; }

    // Remove from favorites panel
    const removeFavBtn = e.target.closest('[data-remove-favorite-id]');
    if (removeFavBtn) { await toggleFavorite(Number(removeFavBtn.dataset.removeFavoriteId)); }
});

if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) { alert('Your cart is empty!'); return; }
        checkout();
    });
}

document.querySelectorAll('input[name="payment-method"]').forEach(opt => {
    opt.addEventListener('change', () => {
        if (getSelectedPaymentMethod() !== 'online') paymentCompleted = false;
        updatePaymentUI();
    });
});

if (completePaymentBtn) {
    completePaymentBtn.addEventListener('click', () => {
        if (cart.length === 0) { alert('Add products to cart before making payment.'); return; }
        const customer = getCustomerDetails();
        if (!customer.name || !customer.phone || !customer.address) {
            alert('Please enter your name, phone number, and address before completing payment.'); return;
        }
        paymentCompleted = true;
        const total = cart.reduce((s, i) => s + (Number(i.priceAtAdd || 0) * i.quantity), 0);
        updatePaymentSummary(total);
        sendPaymentConfirmation(total, customer);
        showToast('Payment completed and message sent.');
    });
}

// ============================================================
//  INIT
// ============================================================
async function initializeStore() {
    setupIntroSplit();
    setupScrollReveal();
    setupCardInteractions();
    buildSlideIndicators();
    showSlides(slideIndex);

    // Load data in parallel
    await Promise.all([
        loadFavoritesFromAPI(),
        loadCart()
    ]);

    await loadProducts();
    await renderProductDetailPage();
    updatePaymentUI();
}

initializeStore();

window.changeSlide = changeSlide;

if (document.querySelector('.slideshow img')) {
    setInterval(() => changeSlide(1), 4000);
}
