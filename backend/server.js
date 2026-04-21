const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// ── Serve the frontend (index.html, style.css, script.js, images, etc.) ──
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve static files from the parent folder (d:\Candle)
app.use(express.static(path.join(__dirname, '..')));

// Redirect root to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ==========================================
// MOCK DATA STORE
// ==========================================
let candles = [
  {
    id: 1,
    name: "Midnight Rose",
    category: "floral",
    price: 1500,
    stock: 20,
    description: "A dark, romantic blend of deep crimson roses and night-blooming jasmine.",
    notes: "Rose, Jasmine, Musk",
    imageUrl: "../images/profile.jpg",
    featured: true
  },
  {
    id: 2,
    name: "Ocean Breeze",
    category: "fresh",
    price: 1200,
    stock: 50,
    description: "Crisp and clean, capturing the essence of a morning walk on the beach.",
    notes: "Sea Salt, Ozone, Linen",
    imageUrl: "../images/profile.jpg",
    featured: false
  },
  {
    id: 3,
    name: "Cozy Cabin",
    category: "cozy",
    price: 1800,
    stock: 15,
    description: "Warm and inviting, with notes of cedarwood and sweet vanilla.",
    notes: "Cedar, Vanilla, Amber",
    imageUrl: "../images/profile.jpg",
    featured: true
  },
  {
    id: 4,
    name: "Citrus Sunshine",
    category: "citrus",
    price: 1300,
    stock: 30,
    description: "A bright, energizing burst of fresh lemon and sweet orange.",
    notes: "Lemon, Orange, Bergamot",
    imageUrl: "../images/profile.jpg",
    featured: false
  },
  {
    id: 5,
    name: "Sandalwood Dreams",
    category: "woody",
    price: 1600,
    stock: 10,
    description: "Deep, earthy sandalwood layered with subtle spices.",
    notes: "Sandalwood, Patchouli, Spice",
    imageUrl: "../images/profile.jpg",
    featured: true
  },
  {
    id: 6,
    name: "Lavender Haze",
    category: "floral",
    price: 1400,
    stock: 25,
    description: "A calming blend of French lavender and soft vanilla to ease the mind.",
    notes: "Lavender, Vanilla, Tonka Bean",
    imageUrl: "../images/profile.jpg",
    featured: true
  },
  {
    id: 7,
    name: "Eucalyptus Morning",
    category: "fresh",
    price: 1100,
    stock: 40,
    description: "Revitalizing and pure, like a deep breath in a sunlit forest.",
    notes: "Eucalyptus, Mint, Pine",
    imageUrl: "../images/profile.jpg",
    featured: false
  }
];

let nextCandleId = 8;

// session_id -> { items: [{ candle: {}, quantity: n, priceAtAdd: p }] }
const carts = {}; 

// session_id -> Set of candleIds
const favorites = {}; 

const ADMIN_KEY = 'aura11-admin-secret';

// ==========================================
// HELPERS
// ==========================================
function getSessionId(req) {
  return req.header('X-Session-Id') || 'default-session';
}

function getCart(sessionId) {
  if (!carts[sessionId]) {
    carts[sessionId] = { items: [] };
  }
  return carts[sessionId];
}

function getFavs(sessionId) {
  if (!favorites[sessionId]) {
    favorites[sessionId] = new Set();
  }
  return favorites[sessionId];
}

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

// GET /api/candles/filter
app.get('/api/candles/filter', (req, res) => {
  const { category, keyword, sortBy, direction } = req.query;
  
  let result = [...candles];
  
  if (category && category !== 'all') {
    result = result.filter(c => c.category === category);
  }
  
  if (keyword) {
    const lowerKw = keyword.toLowerCase();
    result = result.filter(c => 
      c.name.toLowerCase().includes(lowerKw) || 
      (c.description && c.description.toLowerCase().includes(lowerKw)) ||
      (c.notes && c.notes.toLowerCase().includes(lowerKw))
    );
  }
  
  // Sort
  if (sortBy) {
    result.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      
      // Default fallback if property doesn't exist
      if (valA === undefined) valA = '';
      if (valB === undefined) valB = '';
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return direction === 'desc' ? 1 : -1;
      if (valA > valB) return direction === 'desc' ? -1 : 1;
      return 0;
    });
  }
  
  res.json({ content: result });
});

// GET /api/candles/:id
app.get('/api/candles/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const candle = candles.find(c => c.id === id);
  if (!candle) return res.status(404).json({ message: "Candle not found" });
  res.json(candle);
});

// GET /api/cart
app.get('/api/cart', (req, res) => {
  const cart = getCart(getSessionId(req));
  res.json(cart);
});

// POST /api/cart/items
app.post('/api/cart/items', (req, res) => {
  const sessionId = getSessionId(req);
  const { candleId, quantity } = req.body;
  
  const candle = candles.find(c => c.id === parseInt(candleId, 10));
  if (!candle) return res.status(404).json({ message: "Candle not found" });
  
  const cart = getCart(sessionId);
  const existing = cart.items.find(i => i.candle.id === candle.id);
  
  const qty = parseInt(quantity, 10) || 1;
  
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.items.push({
      candle,
      quantity: qty,
      priceAtAdd: candle.price,
      subtotal: candle.price * qty
    });
  }
  
  res.json(cart);
});

// PUT /api/cart/items/:candleId
app.put('/api/cart/items/:candleId', (req, res) => {
  const sessionId = getSessionId(req);
  const candleId = parseInt(req.params.candleId, 10);
  const { quantity } = req.body;
  
  const cart = getCart(sessionId);
  const item = cart.items.find(i => i.candle.id === candleId);
  
  if (item) {
    item.quantity = parseInt(quantity, 10) || 1;
    item.subtotal = item.quantity * item.priceAtAdd;
  }
  
  res.json(cart);
});

// DELETE /api/cart/items/:candleId
app.delete('/api/cart/items/:candleId', (req, res) => {
  const sessionId = getSessionId(req);
  const candleId = parseInt(req.params.candleId, 10);
  
  const cart = getCart(sessionId);
  cart.items = cart.items.filter(i => i.candle.id !== candleId);
  
  res.json(cart);
});

// DELETE /api/cart
app.delete('/api/cart', (req, res) => {
  const sessionId = getSessionId(req);
  carts[sessionId] = { items: [] };
  res.json(carts[sessionId]);
});

// GET /api/favorites
app.get('/api/favorites', (req, res) => {
  const favs = getFavs(getSessionId(req));
  const result = Array.from(favs).map(id => {
    const candle = candles.find(c => c.id === id);
    return candle ? { candle, candleId: id } : null;
  }).filter(Boolean);
  
  res.json(result);
});

// POST /api/favorites/:candleId
app.post('/api/favorites/:candleId', (req, res) => {
  const sessionId = getSessionId(req);
  const candleId = parseInt(req.params.candleId, 10);
  
  if (!candles.find(c => c.id === candleId)) {
    return res.status(404).json({ message: "Candle not found" });
  }
  
  const favs = getFavs(sessionId);
  favs.add(candleId);
  res.status(201).json({ message: "Added to favorites" });
});

// DELETE /api/favorites/:candleId
app.delete('/api/favorites/:candleId', (req, res) => {
  const sessionId = getSessionId(req);
  const candleId = parseInt(req.params.candleId, 10);
  
  const favs = getFavs(sessionId);
  favs.delete(candleId);
  res.status(204).send();
});


// ==========================================
// ADMIN ENDPOINTS
// ==========================================

function adminAuth(req, res, next) {
  const key = req.header('X-Admin-Key');
  if (key !== ADMIN_KEY) {
    return res.status(403).json({ message: "Forbidden: Invalid Admin Key" });
  }
  next();
}

// GET /api/candles (Admin)
app.get('/api/candles', adminAuth, (req, res) => {
  // Can just return all for admin
  res.json({ content: candles });
});

// POST /api/admin/candles
app.post('/api/admin/candles', adminAuth, (req, res) => {
  const { name, category, price, stock, description, notes, imageUrl, featured } = req.body;
  
  const newCandle = {
    id: nextCandleId++,
    name,
    category,
    price: parseFloat(price) || 0,
    stock: parseInt(stock, 10) || 0,
    description,
    notes,
    imageUrl,
    featured: Boolean(featured)
  };
  
  candles.push(newCandle);
  res.status(201).json(newCandle);
});

// PUT /api/admin/candles/:id
app.put('/api/admin/candles/:id', adminAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = candles.findIndex(c => c.id === id);
  
  if (idx === -1) return res.status(404).json({ message: "Candle not found" });
  
  const { name, category, price, stock, description, notes, imageUrl, featured } = req.body;
  
  candles[idx] = {
    ...candles[idx],
    name: name !== undefined ? name : candles[idx].name,
    category: category !== undefined ? category : candles[idx].category,
    price: price !== undefined ? parseFloat(price) : candles[idx].price,
    stock: stock !== undefined ? parseInt(stock, 10) : candles[idx].stock,
    description: description !== undefined ? description : candles[idx].description,
    notes: notes !== undefined ? notes : candles[idx].notes,
    imageUrl: imageUrl !== undefined ? imageUrl : candles[idx].imageUrl,
    featured: featured !== undefined ? Boolean(featured) : candles[idx].featured
  };
  
  // Also update carts if price changes or stock changes etc? (simplified for now)
  
  res.json(candles[idx]);
});

// DELETE /api/admin/candles/:id
app.delete('/api/admin/candles/:id', adminAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  candles = candles.filter(c => c.id !== id);
  res.status(204).send();
});


app.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ====================================');
  console.log('   Aura_11 Backend is RUNNING!');
  console.log('  ====================================');
  console.log(`\n  Open your site at: http://localhost:${PORT}`);
  console.log('  Press Ctrl+C to stop the server.\n');
});
