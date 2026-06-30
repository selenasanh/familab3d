// APP.JS - Lógica de Negocio, Control de Caja e Inventario para Familab3D

// Registro del Service Worker para funcionamiento como PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado con éxito', reg.scope))
      .catch(err => console.error('Error al registrar el Service Worker:', err));
  });
}

// CONFIGURACIÓN DE ESTADO INICIAL
const DEFAULT_PRODUCTS = [
  { id: 'p1', name: 'Pegatina Stand', price: 1.00, stock: 100, image: 'default-sticker' },
  { id: 'p2', name: 'Llavero Acrílico', price: 3.00, stock: 40, image: 'default-keychain' },
  { id: 'p3', name: 'Taza de Cerámica', price: 8.00, stock: 20, image: 'default-mug' },
  { id: 'p4', name: 'Camiseta Oficial', price: 15.00, stock: 15, image: 'default-shirt' },
  { id: 'p5', name: 'Bolsa de Tela (Totebag)', price: 10.00, stock: 25, image: 'default-bag' },
  { id: 'p6', name: 'Refresco / Agua', price: 2.00, stock: 30, image: 'default-drink' }
];

const DEFAULT_CASH_REGISTER = {
  1: 15,   // 15 monedas de 1€ = 15€
  2: 15,   // 15 monedas de 2€ = 30€
  5: 10,   // 10 billetes de 5€ = 50€
  10: 10,  // 10 billetes de 10€ = 100€
  20: 5,   // 5 billetes de 20€ = 100€
  50: 2    // 2 billetes de 50€ = 100€
};

// ESTADO GLOBAL DE LA APLICACIÓN
let state = {
  products: [],
  cashRegister: {},
  cart: [],
  sales: [],
  paymentMethod: 'cash' // 'cash' o 'bizum'
};

// Iconos predeterminados por tipo de producto (SVG en formato CSS)
const IMAGE_PLACEHOLDERS = {
  'default-sticker': '🏷️',
  'default-keychain': '🔑',
  'default-mug': '☕',
  'default-shirt': '👕',
  'default-bag': '🛍️',
  'default-drink': '🥤',
  'generic': '📦'
};

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  loadStateFromLocalStorage();
  
  // Rellenar imagen de previsualización por defecto
  useDefaultImage();
  
  // Renderizado inicial
  renderCatalog();
  renderAdminList();
  renderCart();
  renderCashRegister();
  renderSalesHistory();
  updateStats();
  
  // Configurar input de efectivo inicial
  document.getElementById('cash-given').value = '';
});

// PERSISTENCIA DE DATOS
function saveStateToLocalStorage() {
  localStorage.setItem('familab3d_state', JSON.stringify({
    products: state.products,
    cashRegister: state.cashRegister,
    sales: state.sales
  }));
}

function loadStateFromLocalStorage() {
  const saved = localStorage.getItem('familab3d_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.products = parsed.products || [];
      state.cashRegister = parsed.cashRegister || { ...DEFAULT_CASH_REGISTER };
      state.sales = parsed.sales || [];
    } catch (e) {
      console.error("Error al cargar localStorage, usando valores predeterminados", e);
      resetStateToDefaults();
    }
  } else {
    resetStateToDefaults();
  }
}

function resetStateToDefaults() {
  state.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  state.cashRegister = { ...DEFAULT_CASH_REGISTER };
  state.sales = [];
  state.cart = [];
  saveStateToLocalStorage();
}

// CONTROL DE PESTAÑAS (TABS)
function switchTab(tabId) {
  // Pestañas botones
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  // Paneles de contenido
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
  
  if (tabId === 'catalog') {
    document.getElementById('tab-catalog').classList.add('active');
    document.getElementById('panel-catalog').classList.add('active');
    renderCatalog();
  } else if (tabId === 'admin') {
    document.getElementById('tab-admin').classList.add('active');
    document.getElementById('panel-admin').classList.add('active');
    renderAdminList();
  }
}

// BUSCADOR Y FILTRADO DE CATÁLOGO
function filterProducts() {
  const query = document.getElementById('search-product').value.toLowerCase();
  const stockFilter = document.getElementById('filter-stock').value;
  
  const cards = document.querySelectorAll('.product-card');
  cards.forEach(card => {
    const name = card.dataset.name.toLowerCase();
    const stock = parseInt(card.dataset.stock);
    
    let matchesSearch = name.includes(query);
    let matchesStock = true;
    
    if (stockFilter === 'in-stock') {
      matchesStock = stock > 0;
    } else if (stockFilter === 'low-stock') {
      matchesStock = stock > 0 && stock <= 5;
    } else if (stockFilter === 'out-of-stock') {
      matchesStock = stock === 0;
    }
    
    if (matchesSearch && matchesStock) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

// RENDERIZADO DE CATÁLOGO DE PRODUCTOS (VISTA PRINCIPAL)
function renderCatalog() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';
  
  state.products.forEach(prod => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.name = prod.name;
    card.dataset.stock = prod.stock;
    
    // Calcular clase de stock
    let stockClass = 'in-stock';
    let stockText = `${prod.stock} disponibles`;
    
    if (prod.stock === 0) {
      stockClass = 'out-of-stock';
      stockText = 'Agotado';
    } else if (prod.stock <= 5) {
      stockClass = 'low-stock';
      stockText = `Últimas ${prod.stock} uds.`;
    }
    
    // Crear elemento de imagen (si es base64 o placeholder)
    let imgHTML = '';
    if (prod.image && prod.image.startsWith('data:image')) {
      imgHTML = `<img src="${prod.image}" class="product-card-img" alt="${prod.name}">`;
    } else {
      const symbol = IMAGE_PLACEHOLDERS[prod.image] || IMAGE_PLACEHOLDERS['generic'];
      imgHTML = `<div class="product-image-fallback">${symbol}</div>`;
    }
    
    card.innerHTML = `
      <div class="stock-badge ${stockClass}">${stockText}</div>
      <div class="product-image-wrapper">
        ${imgHTML}
      </div>
      <div class="product-info">
        <h4 class="product-name" title="${prod.name}">${prod.name}</h4>
        <div class="product-price-stock">
          <span class="product-price">${prod.price.toFixed(2)}€</span>
        </div>
        <button class="btn-add-cart" onclick="addToCart('${prod.id}')" ${prod.stock === 0 ? 'disabled' : ''}>
          <span>🛒 Añadir</span>
        </button>
      </div>
    `;
    
    grid.appendChild(card);
  });
}

// RENDERIZADO DE GESTIÓN DE INVENTARIO (ADMIN PANEL)
function renderAdminList() {
  const tbody = document.getElementById('admin-product-rows');
  tbody.innerHTML = '';
  
  state.products.forEach(prod => {
    const row = document.createElement('tr');
    
    // Imagen miniatura
    let imgHTML = '';
    if (prod.image && prod.image.startsWith('data:image')) {
      imgHTML = `<img src="${prod.image}" class="admin-table-img" alt="${prod.name}">`;
    } else {
      const symbol = IMAGE_PLACEHOLDERS[prod.image] || IMAGE_PLACEHOLDERS['generic'];
      imgHTML = `<div class="admin-table-img-fallback">${symbol}</div>`;
    }
    
    row.innerHTML = `
      <td>${imgHTML}</td>
      <td style="font-weight: 600;">${prod.name}</td>
      <td>${prod.price.toFixed(2)}€</td>
      <td>
        <div class="stock-control">
          <button class="btn-qty" onclick="quickAdjustStock('${prod.id}', -1)">-</button>
          <input type="number" class="admin-stock-input" value="${prod.stock}" min="0" onchange="manualAdjustStock('${prod.id}', this.value)">
          <button class="btn-qty" onclick="quickAdjustStock('${prod.id}', 1)">+</button>
        </div>
      </td>
      <td>
        <div class="admin-actions">
          <button class="btn-table-icon" onclick="startEditProduct('${prod.id}')" title="Editar">✏️</button>
          <button class="btn-table-icon" onclick="deleteProduct('${prod.id}')" title="Eliminar" style="color: var(--danger);">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// RENDERIZADO DE CAJA DE EFECTIVO (Billetes y Monedas)
function renderCashRegister() {
  const denominations = [50, 20, 10, 5, 2, 1];
  let totalSum = 0;
  
  denominations.forEach(denom => {
    const count = state.cashRegister[denom] || 0;
    const subtotal = count * denom;
    totalSum += subtotal;
    
    document.getElementById(`count-${denom}`).textContent = count;
    document.getElementById(`subtotal-${denom}`).textContent = `${subtotal.toFixed(2)}€`;
  });
  
  document.getElementById('register-total-sum').textContent = `${totalSum.toFixed(2)}€`;
  document.getElementById('stat-cash-register').textContent = `${totalSum.toFixed(2)}€`;
}

// COLAPSAR/DESPLEGAR DETALLES DE LA CAJA
function toggleRegisterDetails() {
  const details = document.getElementById('register-details');
  const btn = document.getElementById('btn-toggle-reg');
  
  if (details.classList.contains('collapsed')) {
    details.classList.remove('collapsed');
    btn.textContent = 'ocultar ▲';
  } else {
    details.classList.add('collapsed');
    btn.textContent = 'mostrar ▼';
  }
}

// CONTROL DE AJUSTES EN CAJA
function adjustCashDenomination(denom, amount) {
  const current = state.cashRegister[denom] || 0;
  const newValue = Math.max(0, current + amount);
  state.cashRegister[denom] = newValue;
  
  saveStateToLocalStorage();
  renderCashRegister();
  calculateChange(); // Recalcular cambio sugerido por si cambió la disponibilidad
}

// GESTIÓN DE PRODUCTOS (CREAR, EDITAR, ELIMINAR)
let currentUploadedImage = null;

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      currentUploadedImage = e.target.result;
      const preview = document.getElementById('image-preview');
      preview.innerHTML = '';
      preview.style.backgroundImage = `url(${currentUploadedImage})`;
      document.getElementById('prod-image-data').value = currentUploadedImage;
    };
    reader.readAsDataURL(file);
  }
}

function useDefaultImage() {
  currentUploadedImage = 'generic';
  const preview = document.getElementById('image-preview');
  preview.innerHTML = '📦';
  preview.style.backgroundImage = 'none';
  document.getElementById('prod-image-data').value = 'generic';
  document.getElementById('prod-image-file').value = '';
}

function saveProduct(event) {
  event.preventDefault();
  
  const id = document.getElementById('form-product-id').value;
  const name = document.getElementById('prod-name').value.trim();
  const price = parseFloat(document.getElementById('prod-price').value);
  const stock = parseInt(document.getElementById('prod-stock').value);
  const image = document.getElementById('prod-image-data').value || 'generic';
  
  if (!name || isNaN(price) || isNaN(stock)) return;
  
  if (id) {
    // Modo Edición
    const prodIdx = state.products.findIndex(p => p.id === id);
    if (prodIdx !== -1) {
      state.products[prodIdx] = { id, name, price, stock, image };
    }
  } else {
    // Modo Crear
    const newId = 'p_' + Date.now();
    state.products.push({ id: newId, name, price, stock, image });
  }
  
  // Limpiar formulario y resetear
  cancelProductEdit();
  saveStateToLocalStorage();
  renderCatalog();
  renderAdminList();
}

function startEditProduct(id) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;
  
  document.getElementById('form-title').textContent = "Editar Producto";
  document.getElementById('form-product-id').value = prod.id;
  document.getElementById('prod-name').value = prod.name;
  document.getElementById('prod-price').value = prod.price;
  document.getElementById('prod-stock').value = prod.stock;
  document.getElementById('prod-image-data').value = prod.image;
  
  const preview = document.getElementById('image-preview');
  if (prod.image && prod.image.startsWith('data:image')) {
    preview.innerHTML = '';
    preview.style.backgroundImage = `url(${prod.image})`;
  } else {
    const symbol = IMAGE_PLACEHOLDERS[prod.image] || IMAGE_PLACEHOLDERS['generic'];
    preview.innerHTML = symbol;
    preview.style.backgroundImage = 'none';
  }
  
  document.getElementById('btn-submit-form').textContent = "Guardar Cambios";
  document.getElementById('btn-cancel-edit').style.display = 'block';
  
  // Scroll hacia el formulario
  document.querySelector('.product-form-card').scrollIntoView({ behavior: 'smooth' });
}

function cancelProductEdit() {
  document.getElementById('form-title').textContent = "Agregar Nuevo Producto";
  document.getElementById('form-product-id').value = '';
  document.getElementById('product-form').reset();
  useDefaultImage();
  
  document.getElementById('btn-submit-form').textContent = "Crear Producto";
  document.getElementById('btn-cancel-edit').style.display = 'none';
}

function deleteProduct(id) {
  if (confirm("¿Estás seguro de que quieres eliminar este producto? Se eliminará del inventario y del catálogo.")) {
    state.products = state.products.filter(p => p.id !== id);
    // Eliminar también del carrito si estaba
    removeFromCart(id);
    
    saveStateToLocalStorage();
    renderCatalog();
    renderAdminList();
  }
}

function quickAdjustStock(id, delta) {
  const prod = state.products.find(p => p.id === id);
  if (prod) {
    prod.stock = Math.max(0, prod.stock + delta);
    saveStateToLocalStorage();
    renderAdminList();
    renderCatalog();
  }
}

function manualAdjustStock(id, value) {
  const parsed = parseInt(value);
  const prod = state.products.find(p => p.id === id);
  if (prod && !isNaN(parsed)) {
    prod.stock = Math.max(0, parsed);
    saveStateToLocalStorage();
    renderAdminList();
    renderCatalog();
  }
}

// GESTIÓN DEL CARRITO DE COMPRA
function addToCart(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod || prod.stock <= 0) return;
  
  const cartItem = state.cart.find(item => item.productId === productId);
  if (cartItem) {
    if (cartItem.quantity < prod.stock) {
      cartItem.quantity++;
    } else {
      alert(`No puedes añadir más de este producto. El stock límite es ${prod.stock}.`);
    }
  } else {
    state.cart.push({ productId, quantity: 1 });
  }
  
  renderCart();
}

function adjustCartQty(productId, delta) {
  const cartItem = state.cart.find(item => item.productId === productId);
  const prod = state.products.find(p => p.id === productId);
  if (!cartItem || !prod) return;
  
  const newQty = cartItem.quantity + delta;
  if (newQty <= 0) {
    removeFromCart(productId);
  } else if (newQty <= prod.stock) {
    cartItem.quantity = newQty;
  } else {
    alert(`No puedes añadir más de este producto. El stock límite es ${prod.stock}.`);
  }
  
  renderCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(item => item.productId !== productId);
  renderCart();
}

// RENDERIZADO DEL CARRITO
function renderCart() {
  const cartContainer = document.getElementById('cart-items');
  cartContainer.innerHTML = '';
  
  if (state.cart.length === 0) {
    cartContainer.innerHTML = `<div class="empty-cart-message">El carrito está vacío. Haz clic en los productos para agregarlos.</div>`;
    document.getElementById('cart-qty-count').textContent = '0';
    document.getElementById('cart-total-amount').textContent = '0.00€';
    document.getElementById('bizum-confirm-total').textContent = '0.00€';
    
    // Deshabilitar botón de confirmar
    document.getElementById('btn-confirm-sale').disabled = true;
    resetCashPaymentInputs();
    return;
  }
  
  let totalQty = 0;
  let totalAmount = 0;
  
  state.cart.forEach(item => {
    const prod = state.products.find(p => p.id === item.productId);
    if (!prod) return;
    
    const subtotal = prod.price * item.quantity;
    totalQty += item.quantity;
    totalAmount += subtotal;
    
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    row.innerHTML = `
      <div class="cart-item-details">
        <div class="cart-item-name" title="${prod.name}">${prod.name}</div>
        <div class="cart-item-price-unit">${prod.price.toFixed(2)}€ c/u</div>
      </div>
      <div class="cart-item-controls">
        <button class="btn-cart-qty" onclick="adjustCartQty('${prod.id}', -1)">-</button>
        <span class="cart-item-qty">${item.quantity}</span>
        <button class="btn-cart-qty" onclick="adjustCartQty('${prod.id}', 1)">+</button>
      </div>
      <div class="cart-item-subtotal">${subtotal.toFixed(2)}€</div>
      <button class="btn-remove-item" onclick="removeFromCart('${prod.id}')" title="Eliminar">✕</button>
    `;
    
    cartContainer.appendChild(row);
  });
  
  document.getElementById('cart-qty-count').textContent = totalQty;
  document.getElementById('cart-total-amount').textContent = `${totalAmount.toFixed(2)}€`;
  document.getElementById('bizum-confirm-total').textContent = `${totalAmount.toFixed(2)}€`;
  
  // Activar botón si el pago está listo
  validateCheckoutForm();
}

function resetCashPaymentInputs() {
  document.getElementById('cash-given').value = '';
  document.getElementById('change-to-return').textContent = '0.00€';
  document.getElementById('change-suggestion-box').style.display = 'none';
  document.getElementById('change-alert-box').style.display = 'none';
}

// METODOS DE PAGO Y CAJA
function selectPaymentMethod(method) {
  state.paymentMethod = method;
  
  // Actualizar UI pestañas de pago
  document.getElementById('pay-cash-btn').classList.remove('active');
  document.getElementById('pay-bizum-btn').classList.remove('active');
  
  document.getElementById('cash-payment-details').style.display = 'none';
  document.getElementById('bizum-payment-details').style.display = 'none';
  
  if (method === 'cash') {
    document.getElementById('pay-cash-btn').classList.add('active');
    document.getElementById('cash-payment-details').style.display = 'block';
    calculateChange();
  } else {
    document.getElementById('pay-bizum-btn').classList.add('active');
    document.getElementById('bizum-payment-details').style.display = 'block';
  }
  
  validateCheckoutForm();
}

// Ajustes rápidos de cobro en efectivo
function quickCash(option) {
  const total = getCartTotal();
  if (total === 0) return;
  
  let val = 0;
  if (option === 'exact') {
    val = total;
  } else {
    val = parseFloat(option);
  }
  
  document.getElementById('cash-given').value = val.toFixed(2);
  calculateChange();
}

function getCartTotal() {
  return state.cart.reduce((sum, item) => {
    const prod = state.products.find(p => p.id === item.productId);
    return sum + (prod ? prod.price * item.quantity : 0);
  }, 0);
}

// CALCULO DE CAMBIO ÓPTIMO SUGERIDO
function calculateChange() {
  const total = getCartTotal();
  const givenInput = document.getElementById('cash-given').value;
  const given = givenInput === '' ? 0 : parseFloat(givenInput);
  
  const changeOutput = document.getElementById('change-to-return');
  const suggestionBox = document.getElementById('change-suggestion-box');
  const pillsContainer = document.getElementById('suggestion-pills-container');
  const alertBox = document.getElementById('change-alert-box');
  
  pillsContainer.innerHTML = '';
  suggestionBox.style.display = 'none';
  alertBox.style.display = 'none';
  
  if (given < total || total === 0) {
    changeOutput.textContent = '0.00€';
    validateCheckoutForm();
    return;
  }
  
  const changeNeeded = parseFloat((given - total).toFixed(2));
  changeOutput.textContent = `${changeNeeded.toFixed(2)}€`;
  
  if (changeNeeded > 0) {
    // ALGORITMO SUGERENCIA DE CAMBIO CON EFECTIVO REAL EN CAJA
    const changeBreakdown = calculateOptimalChange(changeNeeded);
    
    if (changeBreakdown.success) {
      suggestionBox.style.display = 'block';
      
      // Renderizar los pills de cambio sugerido
      for (const [denom, count] of Object.entries(changeBreakdown.breakdown)) {
        if (count > 0) {
          const isBill = parseInt(denom) >= 5;
          const pill = document.createElement('span');
          pill.className = `suggest-pill ${isBill ? 'suggest-bill' : 'suggest-coin'}`;
          pill.textContent = `${count} x ${denom}€`;
          pillsContainer.appendChild(pill);
        }
      }
    } else {
      // Alerta si no es posible dar el cambio exacto con lo que hay
      alertBox.style.display = 'block';
      suggestionBox.style.display = 'block';
      pillsContainer.innerHTML = `<span style="color: var(--danger); font-size: 0.8rem; font-weight:600;">⚠️ Caja sin cambio suficiente exacto.</span>`;
    }
  }
  
  validateCheckoutForm();
}

// Algoritmo glotón (Greedy) para calcular el cambio disponible
function calculateOptimalChange(targetAmount) {
  let remaining = Math.round(targetAmount * 100); // Evitar problemas de coma flotante
  const denominations = [50, 20, 10, 5, 2, 1];
  const available = { ...state.cashRegister };
  const breakdown = { 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 };
  
  for (let denom of denominations) {
    const denomCents = denom * 100;
    while (remaining >= denomCents && available[denom] > 0) {
      remaining -= denomCents;
      available[denom]--;
      breakdown[denom]++;
    }
  }
  
  return {
    success: remaining === 0,
    breakdown: breakdown
  };
}

// VALIDAR FORMULARIO DE COBRO
function validateCheckoutForm() {
  const confirmBtn = document.getElementById('btn-confirm-sale');
  const total = getCartTotal();
  
  if (total === 0) {
    confirmBtn.disabled = true;
    return;
  }
  
  if (state.paymentMethod === 'bizum') {
    confirmBtn.disabled = false;
  } else {
    const given = parseFloat(document.getElementById('cash-given').value || '0');
    // Activar botón solo si nos han dado suficiente dinero
    confirmBtn.disabled = given < total;
  }
}

// CONFIRMAR Y REGISTRAR VENTA
function confirmSale() {
  const total = getCartTotal();
  if (total === 0) return;
  
  const saleId = 'sale_' + Date.now();
  const date = new Date();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  let paymentDetails = {};
  
  if (state.paymentMethod === 'cash') {
    const given = parseFloat(document.getElementById('cash-given').value);
    const change = parseFloat((given - total).toFixed(2));
    
    // Calcular denominaciones entregadas por el cliente de forma estimada
    // (Por ejemplo, si paga 20€ para un total de 12€, asume que entrega un billete de 20€)
    const clientPaymentBreakdown = estimatePaymentDenominations(given);
    
    // Calcular denominaciones devueltas de cambio (óptimas si existen, si no, greedy estándar)
    const changeBreakdown = calculateOptimalChange(change);
    
    // 1. Añadir el dinero entregado por el cliente a la caja
    for (const [denom, count] of Object.entries(clientPaymentBreakdown)) {
      state.cashRegister[denom] = (state.cashRegister[denom] || 0) + count;
    }
    
    // 2. Restar el cambio de la caja
    // Si fue exitoso el cálculo óptimo, restamos ese desglose. Si no, hacemos lo que podamos
    const actualChangeGiven = changeBreakdown.success ? changeBreakdown.breakdown : calculateOptimalChange(change).breakdown;
    for (const [denom, count] of Object.entries(actualChangeGiven)) {
      state.cashRegister[denom] = Math.max(0, (state.cashRegister[denom] || 0) - count);
    }
    
    paymentDetails = {
      method: 'cash',
      given: given,
      change: change,
      addedDenoms: clientPaymentBreakdown,
      removedDenoms: actualChangeGiven
    };
  } else {
    paymentDetails = {
      method: 'bizum',
      given: total,
      change: 0
    };
  }
  
  // Actualizar stocks de productos
  state.cart.forEach(cartItem => {
    const prod = state.products.find(p => p.id === cartItem.productId);
    if (prod) {
      prod.stock = Math.max(0, prod.stock - cartItem.quantity);
    }
  });
  
  // Guardar la venta en el historial
  const saleRecord = {
    id: saleId,
    time: timeStr,
    timestamp: date.getTime(),
    items: state.cart.map(item => {
      const prod = state.products.find(p => p.id === item.productId);
      return {
        productId: item.productId,
        name: prod ? prod.name : 'Producto Eliminado',
        price: prod ? prod.price : 0,
        quantity: item.quantity
      };
    }),
    total: total,
    payment: paymentDetails
  };
  
  state.sales.unshift(saleRecord); // Insertar al inicio de la lista
  state.cart = []; // Vaciar carrito
  
  saveStateToLocalStorage();
  
  // Refrescar UI
  renderCatalog();
  renderAdminList();
  renderCart();
  renderCashRegister();
  renderSalesHistory();
  updateStats();
  
  resetCashPaymentInputs();
}

// Estimar la composición del dinero entregado por el cliente
function estimatePaymentDenominations(amount) {
  let remaining = Math.round(amount * 100);
  const denominations = [50, 20, 10, 5, 2, 1];
  const breakdown = { 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 };
  
  // Caso exacto simple
  for (let denom of denominations) {
    const denomCents = denom * 100;
    while (remaining >= denomCents) {
      remaining -= denomCents;
      breakdown[denom]++;
    }
  }
  return breakdown;
}

// RENDERIZADO DEL HISTORIAL DE VENTAS
function renderSalesHistory() {
  const tbody = document.getElementById('history-rows');
  const emptyMsg = document.getElementById('empty-history-msg');
  tbody.innerHTML = '';
  
  if (state.sales.length === 0) {
    emptyMsg.style.display = 'block';
    return;
  }
  
  emptyMsg.style.display = 'none';
  
  state.sales.forEach(sale => {
    const row = document.createElement('tr');
    
    // Listado de productos e.g. "2x Camiseta, 1x Refresco"
    const itemsStr = sale.items.map(it => `${it.quantity}x ${it.name}`).join(', ');
    
    // Método badge
    const badgeClass = sale.payment.method === 'cash' ? 'payment-cash' : 'payment-bizum';
    const badgeText = sale.payment.method === 'cash' ? '💵 Efectivo' : '📱 Bizum';
    const badgeHTML = `<span class="badge-payment ${badgeClass}">${badgeText}</span>`;
    
    // Detalle pago
    let detailsStr = '';
    if (sale.payment.method === 'cash') {
      detailsStr = `Recibido: ${sale.payment.given.toFixed(2)}€ | Cambio: ${sale.payment.change.toFixed(2)}€`;
    } else {
      detailsStr = 'Pago Bizum directo';
    }
    
    row.innerHTML = `
      <td>${sale.time}</td>
      <td style="font-weight: 500;" title="${itemsStr}">${itemsStr}</td>
      <td style="font-weight: 700;">${sale.total.toFixed(2)}€</td>
      <td>${badgeHTML}</td>
      <td class="text-muted" style="font-size: 0.8rem;">${detailsStr}</td>
      <td>
        <button class="btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: 0.35rem;" onclick="undoSale('${sale.id}')">
          ↩ Deshacer
        </button>
      </td>
    `;
    
    tbody.appendChild(row);
  });
}

// DESHACER VENTA (ROLLBACK)
function undoSale(saleId) {
  const saleIdx = state.sales.findIndex(s => s.id === saleId);
  if (saleIdx === -1) return;
  
  if (confirm("¿Estás seguro de que quieres deshacer esta venta? Se devolverán los artículos al stock y se revertirán los importes correspondientes de la caja.")) {
    const sale = state.sales[saleIdx];
    
    // 1. Devolver productos al stock
    sale.items.forEach(item => {
      const prod = state.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock += item.quantity;
      }
    });
    
    // 2. Revertir caja si fue en efectivo
    if (sale.payment.method === 'cash') {
      // Restar el dinero que entregó el cliente
      if (sale.payment.addedDenoms) {
        for (const [denom, count] of Object.entries(sale.payment.addedDenoms)) {
          state.cashRegister[denom] = Math.max(0, (state.cashRegister[denom] || 0) - count);
        }
      }
      // Sumar de vuelta el cambio que le devolvimos
      if (sale.payment.removedDenoms) {
        for (const [denom, count] of Object.entries(sale.payment.removedDenoms)) {
          state.cashRegister[denom] = (state.cashRegister[denom] || 0) + count;
        }
      }
    }
    
    // 3. Eliminar venta del historial
    state.sales.splice(saleIdx, 1);
    
    saveStateToLocalStorage();
    
    // Actualizar UI
    renderCatalog();
    renderAdminList();
    renderCashRegister();
    renderSalesHistory();
    updateStats();
  }
}

// ACTUALIZAR ESTADÍSTICAS DEL DÍA (HEADER STATS)
function updateStats() {
  let totalSales = 0;
  let cashSales = 0;
  let bizumSales = 0;
  
  state.sales.forEach(sale => {
    totalSales += sale.total;
    if (sale.payment.method === 'cash') {
      cashSales += sale.total;
    } else {
      bizumSales += sale.total;
    }
  });
  
  document.getElementById('stat-total-sales').textContent = `${totalSales.toFixed(2)}€`;
  document.getElementById('stat-cash-sales').textContent = `${cashSales.toFixed(2)}€`;
  document.getElementById('stat-bizum-sales').textContent = `${bizumSales.toFixed(2)}€`;
}

// EXPORTAR RESUMEN DEL DÍA (REPORT MODAL)
function exportDailyReport() {
  const modal = document.getElementById('report-modal');
  const body = document.getElementById('report-modal-body');
  
  // Calcular estadísticas detalladas
  let totalVolume = 0;
  let cashVolume = 0;
  let bizumVolume = 0;
  let itemsCount = 0;
  
  const productSummary = {};
  
  state.sales.forEach(sale => {
    totalVolume += sale.total;
    if (sale.payment.method === 'cash') {
      cashVolume += sale.total;
    } else {
      bizumVolume += sale.total;
    }
    
    sale.items.forEach(it => {
      itemsCount += it.quantity;
      if (!productSummary[it.name]) {
        productSummary[it.name] = { qty: 0, revenue: 0 };
      }
      productSummary[it.name].qty += it.quantity;
      productSummary[it.name].revenue += it.price * it.quantity;
    });
  });
  
  // Desglose de Caja actual
  let currentCashRegisterTotal = 0;
  const cashLines = [];
  const denominations = [50, 20, 10, 5, 2, 1];
  
  denominations.forEach(denom => {
    const count = state.cashRegister[denom] || 0;
    const sub = count * denom;
    currentCashRegisterTotal += sub;
    if (count > 0) {
      cashLines.push(`<div class="report-line"><span>${count} x ${denom}€</span><span>${sub.toFixed(2)}€</span></div>`);
    }
  });
  
  // Renderizar contenido HTML para el modal
  let productsHTML = '';
  if (Object.keys(productSummary).length === 0) {
    productsHTML = '<div class="report-line text-muted">No se vendió ningún producto.</div>';
  } else {
    for (const [name, data] of Object.entries(productSummary)) {
      productsHTML += `
        <div class="report-line">
          <span>${data.qty}x ${name}</span>
          <strong>${data.revenue.toFixed(2)}€</strong>
        </div>
      `;
    }
  }
  
  body.innerHTML = `
    <!-- Resumen Financiero -->
    <div class="report-section">
      <h4>Resumen Financiero</h4>
      <div class="report-grid-2col">
        <div>
          <div class="report-line"><span>Total Ventas:</span><strong>${totalVolume.toFixed(2)}€</strong></div>
          <div class="report-line"><span>Efectivo cobrado:</span><span style="color: var(--cash); font-weight:600;">${cashVolume.toFixed(2)}€</span></div>
          <div class="report-line"><span>Bizum recibido:</span><span style="color: var(--bizum); font-weight:600;">${bizumVolume.toFixed(2)}€</span></div>
        </div>
        <div>
          <div class="report-line"><span>Artículos vendidos:</span><strong>${itemsCount} uds</strong></div>
          <div class="report-line"><span>Transacciones:</span><strong>${state.sales.length}</strong></div>
        </div>
      </div>
    </div>
    
    <!-- Ventas por Producto -->
    <div class="report-section">
      <h4>Ventas por Producto</h4>
      <div class="report-products-list">
        ${productsHTML}
      </div>
    </div>
    
    <!-- Estado de Caja Fuerte -->
    <div class="report-section">
      <h4>Desglose de Efectivo en Caja</h4>
      <div class="report-cash-list">
        ${cashLines.length > 0 ? cashLines.join('') : '<div class="report-line text-muted">Caja vacía.</div>'}
        <div class="report-line total">
          <span>Total Caja:</span>
          <strong>${currentCashRegisterTotal.toFixed(2)}€</strong>
        </div>
      </div>
    </div>
  `;
  
  modal.classList.add('active');
}

function closeReportModal() {
  document.getElementById('report-modal').classList.remove('active');
}

// RESETEAR TODOS LOS DATOS
function clearAllData() {
  if (confirm("ATENCIÓN: Se eliminará todo el historial de ventas del día, se restablecerá el stock por defecto y se reiniciará la caja. ¿Deseas continuar?")) {
    resetStateToDefaults();
    
    // Limpiar campos formulario
    cancelProductEdit();
    
    // Refrescar vistas
    renderCatalog();
    renderAdminList();
    renderCart();
    renderCashRegister();
    renderSalesHistory();
    updateStats();
    
    alert("Aplicación reiniciada a los valores iniciales de fábrica.");
  }
}
