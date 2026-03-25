const cartCount = document.getElementById('cart-count');
const cartItems = document.getElementById('cart-items');
const cartTotal = document.getElementById('cart-total');
const cartSummary = document.getElementById('cart-summary');
const checkoutBtn = document.getElementById('checkout-btn');
const completePaymentBtn = document.getElementById('complete-payment-btn');
const searchInput = document.getElementById('search');
const sortSelect = document.getElementById('sort-select');
const floralGrid = document.getElementById('floral-grid');
const freshGrid = document.getElementById('fresh-grid');
const warmGrid = document.getElementById('warm-grid');
const catalogStatus = document.getElementById('catalog-status');
const resultsSummary = document.getElementById('results-summary');
const favoritesList = document.getElementById('favorites-list');
const toast = document.getElementById('toast');
const filterChips = Array.from(document.querySelectorAll('.filter-chip'));
const slideIndicators = document.getElementById('slide-indicators');
const paymentAmount = document.getElementById('payment-amount');
const onlinePaymentBox = document.getElementById('online-payment-box');
const paymentStatus = document.getElementById('payment-status');
const orderProgress = document.getElementById('order-progress');
const customerNameInput = document.getElementById('customer-name');
const customerPhoneInput = document.getElementById('customer-phone');
const customerAddressInput = document.getElementById('customer-address');
const productDetailContainer = document.getElementById('product-detail');
const introSplit = document.getElementById('intro-split');

const catalog = [
    {
        id: 1,
        name: 'Lavender Haze',
        description: 'A floral lavender candle with soft vanilla warmth for restful evenings.',
        price: 699,
        image: './images/lavendar.jpg'
    },
    {
        id: 2,
        name: 'Amber Night',
        description: 'A woody amber blend with musk and cedar for a richer, lounge-like glow.',
        price: 849,
        image: './images/my_profile1.png'
    },
    {
        id: 3,
        name: 'Citrus Daybreak',
        description: 'Orange zest, bergamot, and clean cotton notes for a bright fresh start.',
        price: 749,
        image: './images/my_profile2.png'
    },
    {
        id: 4,
        name: 'Rose Bloom',
        description: 'Rose petals and jasmine wrapped into a soft floral candle for romantic spaces.',
        price: 799,
        image: './images/my_profile3.png'
    },
    {
        id: 5,
        name: 'Cozy Chai',
        description: 'A warm spiced candle with chai, caramel, and vanilla for comforting corners.',
        price: 879,
        image: './images/lavendar.jpg'
    },
    {
        id: 6,
        name: 'Ocean Linen',
        description: 'Fresh linen, ocean breeze, and light mint notes crafted for calm interiors.',
        price: 729,
        image: './images/my_profile2.png'
    }
];

const favoriteStorageKey = 'candle-favorites';
const cartStorageKey = 'candle-cart';

let products = [...catalog];
let filteredProducts = [];
let cart = readCart();
let activeFilter = 'all';
let toastTimer;
let slideIndex = 0;
let favorites = new Set(loadFavorites());
let revealObserver;
let paymentCompleted = false;

function loadFavorites() {
    try {
        const parsed = JSON.parse(localStorage.getItem(favoriteStorageKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function readCart() {
    try {
        const parsed = JSON.parse(localStorage.getItem(cartStorageKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function persistFavorites() {
    localStorage.setItem(favoriteStorageKey, JSON.stringify([...favorites]));
}

function persistCart() {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
}

function formatCurrency(amount) {
    return `INR ${amount.toLocaleString('en-IN')}`;
}

function setCatalogStatus(message) {
    if (!catalogStatus) {
        return;
    }

    catalogStatus.textContent = message;
    catalogStatus.style.display = message ? 'block' : 'none';
}

function showToast(message) {
    if (!toast) {
        return;
    }

    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = window.setTimeout(() => {
        toast.classList.remove('visible');
    }, 2600);
}

function getMoodTags(product) {
    const haystack = `${product.name} ${product.description}`.toLowerCase();
    const tags = [];

    if (/(rose|lavender|jasmine|lily|floral|bloom)/.test(haystack)) {
        tags.push('Floral');
    }
    if (/(ocean|linen|mint|fresh|rain|breeze|cotton)/.test(haystack)) {
        tags.push('Fresh');
    }
    if (/(orange|lemon|bergamot|grapefruit|citrus)/.test(haystack)) {
        tags.push('Citrus');
    }
    if (/(cedar|sandal|amber|musk|wood|oud)/.test(haystack)) {
        tags.push('Woody');
    }
    if (/(vanilla|coffee|chai|cozy|warm|spice|caramel)/.test(haystack)) {
        tags.push('Cozy');
    }

    return tags.length > 0 ? tags : ['Signature'];
}

function getCollectionGroup(product) {
    const tags = getMoodTags(product);

    if (tags.includes('Floral')) {
        return 'floral';
    }
    if (tags.includes('Fresh') || tags.includes('Citrus')) {
        return 'fresh';
    }
    return 'warm';
}

function matchesFilter(product) {
    if (activeFilter === 'all') {
        return true;
    }

    const haystack = `${product.name} ${product.description}`.toLowerCase();
    return haystack.includes(activeFilter);
}

function sortProducts(items) {
    if (!sortSelect) {
        return [...items];
    }

    const selected = sortSelect.value;
    const sorted = [...items];

    if (selected === 'price-asc') {
        sorted.sort((a, b) => a.price - b.price);
    } else if (selected === 'price-desc') {
        sorted.sort((a, b) => b.price - a.price);
    } else if (selected === 'name-asc') {
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sorted;
}

function createProductCard(product) {
    const tags = getMoodTags(product)
        .map((tag) => `<span class="tag">${tag}</span>`)
        .join('');
    const favoriteLabel = favorites.has(product.id) ? 'Remove favorite' : 'Save favorite';

    return `
        <article class="candle">
            <button class="favorite-btn ${favorites.has(product.id) ? 'active' : ''}" data-favorite-id="${product.id}" type="button" aria-label="${favoriteLabel}">
                &#9829;
            </button>
            <img src="${product.image}" alt="${product.name}">
            <div class="card-content">
                <div class="card-topline">
                    <h3>${product.name}</h3>
                    <p class="price">${formatCurrency(product.price)}</p>
                </div>
                <p class="description">${product.description}</p>
                <div class="tag-list">${tags}</div>
                <div class="card-actions">
                    <input type="number" min="1" value="1" class="quantity" data-product-id="${product.id}" aria-label="Quantity for ${product.name}">
                    <button class="add-to-cart" data-product-id="${product.id}" type="button">Add to Cart</button>
                    <a class="details-link" href="product.html?id=${product.id}">View Details</a>
                </div>
            </div>
        </article>
    `;
}

function renderProducts() {
    if (!floralGrid || !freshGrid || !warmGrid) {
        return;
    }

    floralGrid.innerHTML = '';
    freshGrid.innerHTML = '';
    warmGrid.innerHTML = '';

    if (filteredProducts.length === 0) {
        setCatalogStatus('No candles matched your search and filter.');
        if (resultsSummary) {
            resultsSummary.textContent = '0 products found';
        }
        return;
    }

    setCatalogStatus('');
    if (resultsSummary) {
        resultsSummary.textContent = `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'} found`;
    }

    const grouped = {
        floral: [],
        fresh: [],
        warm: []
    };

    filteredProducts.forEach((product) => {
        grouped[getCollectionGroup(product)].push(createProductCard(product));
    });

    floralGrid.innerHTML = grouped.floral.length > 0 ? grouped.floral.join('') : '<p class="empty-state">No floral candles in this filter.</p>';
    freshGrid.innerHTML = grouped.fresh.length > 0 ? grouped.fresh.join('') : '<p class="empty-state">No fresh or citrus candles in this filter.</p>';
    warmGrid.innerHTML = grouped.warm.length > 0 ? grouped.warm.join('') : '<p class="empty-state">No warm candles in this filter.</p>';
    refreshRevealTargets();
}

function renderFavorites() {
    if (!favoritesList) {
        return;
    }

    const favoriteProducts = products.filter((product) => favorites.has(product.id));

    if (favoriteProducts.length === 0) {
        favoritesList.innerHTML = '<p class="empty-state">No favorites yet. Tap the heart on a candle to save it here.</p>';
        return;
    }

    favoritesList.innerHTML = favoriteProducts
        .map((product) => `
            <article class="favorite-card">
                <img src="${product.image}" alt="${product.name}">
                <div>
                    <h3>${product.name}</h3>
                    <p>${product.description}</p>
                </div>
                <div class="favorite-card-actions">
                    <strong>${formatCurrency(product.price)}</strong>
                    <button class="favorite-remove-btn" data-remove-favorite-id="${product.id}" type="button">Remove</button>
                </div>
            </article>
        `)
        .join('');
    refreshRevealTargets();
}

function renderCart() {
    if (cartCount) {
        const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = String(itemCount);
    }

    if (!cartItems || !cartSummary || !cartTotal) {
        return;
    }

    cartItems.innerHTML = '';

    if (cart.length === 0) {
        cartSummary.textContent = '0 items selected';
        cartTotal.textContent = 'Total: INR 0';
        cartItems.innerHTML = '<p class="empty-state">Your cart is empty.</p>';
        updatePaymentSummary(0);
        return;
    }

    let total = 0;
    let itemCount = 0;

    cart.forEach((item) => {
        const lineTotal = item.price * item.quantity;
        total += lineTotal;
        itemCount += item.quantity;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'cart-item';
        itemDiv.innerHTML = `
            <div>
                <strong>${item.name}</strong>
                <p>${item.quantity} item${item.quantity === 1 ? '' : 's'} selected</p>
            </div>
            <div class="cart-item-actions">
                <span>${formatCurrency(lineTotal)}</span>
                <button data-cart-item-id="${item.id}" type="button">Remove</button>
            </div>
        `;

        const removeButton = itemDiv.querySelector('button');
        removeButton.addEventListener('click', () => removeFromCart(item.id));
        cartItems.appendChild(itemDiv);
    });

    cartSummary.textContent = `${itemCount} item${itemCount === 1 ? '' : 's'} selected`;
    cartTotal.textContent = `Total: ${formatCurrency(total)}`;
    updatePaymentSummary(total);
    refreshRevealTargets();
}

function loadProducts() {
    setCatalogStatus('Loading candle catalog...');
    products = [...catalog];
    applyFilters();
    renderFavorites();
}

function addToCart(productId, quantity) {
    const product = products.find((item) => item.id === productId);
    if (!product) {
        throw new Error('Product not found.');
    }

    const existing = cart.find((item) => item.productId === productId);
    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({
            id: Date.now() + productId,
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity
        });
    }

    persistCart();
    renderCart();
}

function removeFromCart(cartItemId) {
    cart = cart.filter((item) => item.id !== cartItemId);
    persistCart();
    renderCart();
    showToast('Item removed from cart.');
}

function checkout() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderId = `ORD-${Date.now()}`;
    const paymentMethod = getSelectedPaymentMethod();
    const customer = getCustomerDetails();

    if (!customer.name || !customer.phone || !customer.address) {
        alert('Please enter your name, phone number, and address.');
        return;
    }

    if (paymentMethod === 'online' && !paymentCompleted) {
        alert('Please complete the online payment first.');
        return;
    }

    const orderText = buildOrderMessage(orderId, total, paymentMethod, customer);
    openContactChannels(orderText, orderId);
    updateOrderProgress(paymentMethod);
    cart = [];
    paymentCompleted = false;
    persistCart();
    renderCart();
    resetCheckoutForm();
    showToast(`Order ${orderId} placed successfully.`);
    alert(`Thank you for your purchase! Order ${orderId} total: ${formatCurrency(total)}`);
}

function applyFilters() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const matches = products.filter((product) => {
        const haystack = `${product.name} ${product.description}`.toLowerCase();
        return haystack.includes(query) && matchesFilter(product);
    });

    filteredProducts = sortProducts(matches);
    renderProducts();
}

function toggleFavorite(productId) {
    if (favorites.has(productId)) {
        favorites.delete(productId);
        showToast('Removed from favorites.');
    } else {
        favorites.add(productId);
        showToast('Saved to favorites.');
    }

    persistFavorites();
    renderProducts();
    renderFavorites();
}

function buildSlideIndicators() {
    if (!slideIndicators) {
        return;
    }

    const slides = document.querySelectorAll('.slideshow img');
    slideIndicators.innerHTML = '';

    slides.forEach((_, index) => {
        const indicator = document.createElement('button');
        indicator.type = 'button';
        indicator.className = index === 0 ? 'indicator active' : 'indicator';
        indicator.setAttribute('aria-label', `Go to slide ${index + 1}`);
        indicator.addEventListener('click', () => showSlides(index));
        slideIndicators.appendChild(indicator);
    });
}

function showSlides(n) {
    const slides = document.querySelectorAll('.slideshow img');
    const indicators = document.querySelectorAll('.indicator');

    if (slides.length === 0) {
        return;
    }

    if (n >= slides.length) {
        slideIndex = 0;
    } else if (n < 0) {
        slideIndex = slides.length - 1;
    } else {
        slideIndex = n;
    }

    slides.forEach((slide) => slide.classList.remove('active'));
    indicators.forEach((indicator) => indicator.classList.remove('active'));

    slides[slideIndex].classList.add('active');
    if (indicators[slideIndex]) {
        indicators[slideIndex].classList.add('active');
    }
}

function changeSlide(n) {
    showSlides(slideIndex + n);
}

function setupIntroSplit() {
    if (!introSplit) {
        return;
    }

    document.body.classList.add('intro-active');

    window.setTimeout(() => {
        introSplit.classList.add('is-complete');
    }, 1000);

    window.setTimeout(() => {
        document.body.classList.remove('intro-active');
    }, 2000);
}

function getProductById(productId) {
    return catalog.find((item) => item.id === productId);
}

function renderProductDetailPage() {
    if (!productDetailContainer) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const productId = Number(params.get('id'));
    const product = getProductById(productId);

    if (!product) {
        productDetailContainer.innerHTML = `
            <div class="empty-state">
                <p>Product not found.</p>
                <a href="index.html#collection" class="primary-link">Back to Collection</a>
            </div>
        `;
        return;
    }

    const tags = getMoodTags(product)
        .map((tag) => `<span class="tag">${tag}</span>`)
        .join('');
<<<<<<< HEAD

    productDetailContainer.innerHTML = `
        <article class="product-detail-card">
            <div class="product-detail-media">
                <img src="${product.image}" alt="${product.name}">
            </div>
            <div class="product-detail-copy">
                <p class="eyebrow">Signature Candle</p>
                <h2>${product.name}</h2>
                <p class="product-detail-price">${formatCurrency(product.price)}</p>
                <p class="product-detail-description">${product.description}</p>
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
    `;
=======
    const relatedProducts = products
        .filter((item) => item.id !== product.id)
        .slice(0, 4)
        .map((item) => createProductCard(item))
        .join('');

    productDetailContainer.innerHTML = `
        <div class="product-detail-layout">
            <article class="product-detail-card">
                <div class="product-detail-media">
                    <img src="${product.image}" alt="${product.name}">
                </div>
                <div class="product-detail-copy">
                    <p class="eyebrow">Signature Candle</p>
                    <h2>${product.name}</h2>
                    <p class="product-detail-price">${formatCurrency(product.price)}</p>
                    <p class="product-detail-description">${product.description}</p>
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

            <section class="related-products-panel" aria-label="More products to add to cart">
                <div class="section-heading related-heading">
                    <div>
                        <p class="eyebrow">Add More</p>
                        <h2>More Candles You May Like</h2>
                    </div>
                    <p class="results-summary">Add other fragrances without leaving this page</p>
                </div>
                <div class="candle-grid related-products-grid">
                    ${relatedProducts}
                </div>
            </section>
        </div>
    `;
    refreshRevealTargets();
>>>>>>> bd0a21b (Updated home page and buttons and product page)
}

function getSelectedPaymentMethod() {
    const selected = document.querySelector('input[name="payment-method"]:checked');
    return selected ? selected.value : 'cod';
}

function getCustomerDetails() {
    return {
        name: customerNameInput ? customerNameInput.value.trim() : '',
        phone: customerPhoneInput ? customerPhoneInput.value.trim() : '',
        address: customerAddressInput ? customerAddressInput.value.trim() : ''
    };
}

function updatePaymentSummary(total) {
    if (paymentAmount) {
        paymentAmount.textContent = formatCurrency(total);
    }

    if (!paymentStatus) {
        return;
    }

    const method = getSelectedPaymentMethod();
    if (method === 'cod') {
        paymentStatus.textContent = 'Payment mode: Cash on Delivery';
    } else {
        paymentStatus.textContent = paymentCompleted ? 'Payment completed' : 'Payment pending';
    }
}

function updatePaymentUI() {
    if (!onlinePaymentBox) {
        return;
    }

    const method = getSelectedPaymentMethod();
    onlinePaymentBox.classList.toggle('hidden', method !== 'online');
    updatePaymentSummary(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0));
}

function buildOrderMessage(orderId, total, paymentMethod, customer) {
    const items = cart
        .map((item, index) => `${index + 1}. ${item.name} x ${item.quantity} - ${formatCurrency(item.price * item.quantity)}`)
        .join('\n');

    return [
        `Order ID: ${orderId}`,
        `Customer: ${customer.name}`,
        `Phone: ${customer.phone}`,
        `Address: ${customer.address}`,
        `Payment: ${paymentMethod === 'online' ? 'Online Payment' : 'Cash on Delivery'}`,
        `Total: ${formatCurrency(total)}`,
        '',
        'Products:',
        items
    ].join('\n');
}

function openContactChannels(orderText, orderId) {
    const whatsappUrl = `https://wa.me/918072673238?text=${encodeURIComponent(orderText)}`;
    const mailtoUrl = `mailto:abineshofficial01@gmail.com?subject=${encodeURIComponent(`New Candle Order ${orderId}`)}&body=${encodeURIComponent(orderText)}`;

    window.open(whatsappUrl, '_blank', 'noopener');
    window.location.href = mailtoUrl;
}

<<<<<<< HEAD
=======
function buildPaymentConfirmationMessage(total, customer) {
    const items = cart
        .map((item, index) => `${index + 1}. ${item.name} x ${item.quantity} - ${formatCurrency(item.price * item.quantity)}`)
        .join('\n');

    return [
        'Online payment completed for Candle Emporium order.',
        `Customer: ${customer.name}`,
        `Phone: ${customer.phone}`,
        `Address: ${customer.address}`,
        `Paid Amount: ${formatCurrency(total)}`,
        '',
        'Products:',
        items
    ].join('\n');
}

function sendPaymentConfirmation(total, customer) {
    const paymentText = buildPaymentConfirmationMessage(total, customer);
    const whatsappUrl = `https://wa.me/918072673238?text=${encodeURIComponent(paymentText)}`;
    const mailtoUrl = `mailto:abineshofficial01@gmail.com?subject=${encodeURIComponent('Online Payment Completed')}&body=${encodeURIComponent(paymentText)}`;

    window.open(whatsappUrl, '_blank', 'noopener');
    window.setTimeout(() => {
        window.location.href = mailtoUrl;
    }, 250);
}

>>>>>>> bd0a21b (Updated home page and buttons and product page)
function updateOrderProgress(paymentMethod) {
    if (!orderProgress) {
        return;
    }

    const steps = [
        {
            title: '1. Order confirmed',
            text: 'Your cart details are confirmed and received.'
        },
        {
            title: '2. Payment completed',
            text: paymentMethod === 'online' ? 'Online payment completed successfully.' : 'Cash on Delivery selected.'
        },
        {
            title: '3. Order is ready',
            text: 'Your order is being packed and prepared.'
        },
        {
            title: '4. Ready for delivery',
            text: 'The order is now ready for delivery dispatch.'
        }
    ];

    orderProgress.innerHTML = steps
        .map((step, index) => `
            <div class="order-step active-step">
                <strong>${step.title}</strong>
                <span>${step.text}</span>
            </div>
        `)
        .join('');
}

function resetCheckoutForm() {
    if (customerNameInput) {
        customerNameInput.value = '';
    }
    if (customerPhoneInput) {
        customerPhoneInput.value = '';
    }
    if (customerAddressInput) {
        customerAddressInput.value = '';
    }

    const codOption = document.querySelector('input[name="payment-method"][value="cod"]');
    if (codOption) {
        codOption.checked = true;
    }

    updatePaymentUI();
}

function setupCardInteractions() {
    document.addEventListener('pointermove', (event) => {
        const card = event.target.closest('.candle');
        if (!card) {
            return;
        }

        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const rotateY = ((x / rect.width) - 0.5) * 10;
        const rotateX = (((y / rect.height) - 0.5) * -10);

        card.style.setProperty('--mx', `${(x / rect.width) * 100}%`);
        card.style.setProperty('--my', `${(y / rect.height) * 100}%`);
        card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    });

    document.addEventListener('pointerleave', (event) => {
        const card = event.target.closest('.candle');
        if (!card) {
            return;
        }

        card.style.transform = '';
        card.style.removeProperty('--mx');
        card.style.removeProperty('--my');
    }, true);
}

function setupScrollReveal() {
    if (!('IntersectionObserver' in window)) {
        return;
    }

    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                entry.target.classList.remove('is-soft-hidden');
            } else if (entry.boundingClientRect.top < window.innerHeight && entry.boundingClientRect.bottom > 0) {
                entry.target.classList.add('is-visible');
                entry.target.classList.remove('is-soft-hidden');
            } else {
                entry.target.classList.remove('is-visible');
                entry.target.classList.add('is-soft-hidden');
            }
        });
    }, {
        threshold: 0.18,
        rootMargin: '0px 0px -8% 0px'
    });

    refreshRevealTargets();
}

function refreshRevealTargets() {
    if (!revealObserver) {
        return;
    }

    const targets = document.querySelectorAll(
        '#home, #collection, #about, #favorites, .cart-preview, .cart-hero, .standalone-cart-section, .collection-group, .favorite-card, .cart-item, .candle'
    );

    targets.forEach((target) => {
        if (!target.classList.contains('scroll-reveal')) {
            target.classList.add('scroll-reveal');
        }
        revealObserver.observe(target);
    });
}

if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
}

if (sortSelect) {
    sortSelect.addEventListener('change', applyFilters);
}

filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
        filterChips.forEach((button) => button.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.filter;
        applyFilters();
    });
});

document.addEventListener('click', (event) => {
    const favoriteButton = event.target.closest('.favorite-btn');
    if (favoriteButton) {
        toggleFavorite(Number(favoriteButton.dataset.favoriteId));
        return;
    }

    const addButton = event.target.closest('.add-to-cart');
    if (addButton) {
        const productId = Number(addButton.dataset.productId);
        const quantityInput = document.querySelector(`.quantity[data-product-id="${productId}"]`);
        const quantity = Number(quantityInput.value);

        if (!Number.isInteger(quantity) || quantity < 1) {
            alert('Please enter a valid quantity.');
            quantityInput.focus();
            return;
        }

        try {
            addToCart(productId, quantity);
            showToast('Item added to cart.');
        } catch (error) {
            alert(error.message);
        }

        return;
    }

    const removeButton = event.target.closest('[data-cart-item-id]');
    if (removeButton) {
        removeFromCart(Number(removeButton.dataset.cartItemId));
        return;
    }

    const removeFavoriteButton = event.target.closest('[data-remove-favorite-id]');
    if (removeFavoriteButton) {
        toggleFavorite(Number(removeFavoriteButton.dataset.removeFavoriteId));
    }
});

if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert('Your cart is empty!');
            return;
        }

        checkout();
    });
}

document.querySelectorAll('input[name="payment-method"]').forEach((option) => {
    option.addEventListener('change', () => {
        if (getSelectedPaymentMethod() !== 'online') {
            paymentCompleted = false;
        }
        updatePaymentUI();
    });
});

if (completePaymentBtn) {
    completePaymentBtn.addEventListener('click', () => {
        if (cart.length === 0) {
            alert('Add products to cart before making payment.');
            return;
        }

<<<<<<< HEAD
        paymentCompleted = true;
        updatePaymentSummary(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0));
        showToast('Payment completed.');
=======
        const customer = getCustomerDetails();
        if (!customer.name || !customer.phone || !customer.address) {
            alert('Please enter your name, phone number, and address before completing payment.');
            return;
        }

        paymentCompleted = true;
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        updatePaymentSummary(total);
        sendPaymentConfirmation(total, customer);
        showToast('Payment completed and message sent.');
>>>>>>> bd0a21b (Updated home page and buttons and product page)
    });
}

function initializeStore() {
    setupIntroSplit();
    setupScrollReveal();
    setupCardInteractions();
    buildSlideIndicators();
    showSlides(slideIndex);
    loadProducts();
    renderProductDetailPage();
    cart = readCart();
    renderCart();
    updatePaymentUI();
}

initializeStore();

window.changeSlide = changeSlide;

if (document.querySelector('.slideshow img')) {
    setInterval(() => {
        changeSlide(1);
    }, 4000);
}
