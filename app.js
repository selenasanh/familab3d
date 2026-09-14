// APP.JS - Lógica de Negocio, Control de Caja, Inventario y Variantes para Familab3D

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
  { id: 'p1', name: 'Pegatina Stand', price: 1.00, stock: 100, image: 'default-sticker', hasVariants: false, variants: [] },
  { id: 'p2', name: 'Llavero Acrílico', price: 3.00, stock: 40, image: 'default-keychain', hasVariants: false, variants: [] },
  { id: 'p3', name: 'Taza de Cerámica', price: 8.00, stock: 20, image: 'default-mug', hasVariants: false, variants: [] },
  { id: 'p4', name: 'Camiseta Oficial', price: 15.00, stock: 15, image: 'default-shirt', hasVariants: false, variants: [] },
  { id: 'p5', name: 'Bolsa de Tela (Totebag)', price: 10.00, stock: 25, image: 'default-bag', hasVariants: false, variants: [] },
  { id: 'p6', name: 'Refresco / Agua', price: 2.00, stock: 30, image: 'default-drink', hasVariants: false, variants: [] },
  { 
    id: 'p7', 
    name: 'Disco / Figura 3D', 
    price: 5.00, 
    stock: 15, 
    image: 'generic', 
    hasVariants: true, 
    variants: [
      { id: 'v_red', name: 'Rojo', stock: 5 },
      { id: 'v_blue', name: 'Azul', stock: 5 },
      { id: 'v_green', name: 'Verde', stock: 5 }
    ] 
  }
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

// ESTADO DE CONEXIÓN FIREBASE
let isFirebaseConnected = false;
let firebaseRef = null;
let isRemoteUpdating = false;

// Almacenamiento temporal de variantes para el formulario de administración
let tempVariants = [];

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
  
  // Inicializar Firebase si existen credenciales guardadas
  initFirebase();
  
  // Escuchar cambios de red (online/offline)
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  
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

// INICIALIZACIÓN DE FIREBASE (SINCRONIZACIÓN EN TIEMPO REAL)
function initFirebase() {
  const savedConfigStr = localStorage.getItem('familab3d_firebase_config');
  if (!savedConfigStr || typeof firebase === 'undefined') {
    updateNetworkStatus();
    return;
  }

  try {
    const config = JSON.parse(savedConfigStr);
    if (!config.databaseURL || !config.apiKey || !config.projectId) {
      updateNetworkStatus();
      return;
    }

    if (firebase.apps.length === 0) {
      firebase.initializeApp(config);
    }

    firebaseRef = firebase.database().ref('/familab3d_state');
    
    // Escuchar cambios en la nube en tiempo real (Realtime Listener)
    firebaseRef.on('value', snapshot => {
      const remoteData = snapshot.val();
      if (remoteData) {
        isRemoteUpdating = true;
        state.products = remoteData.products || [];
        state.cashRegister = remoteData.cashRegister || { ...DEFAULT_CASH_REGISTER };
        state.sales = remoteData.sales || [];
        
        normalizeProductsState();
        
        // Guardar copia local sin re-sincronizar a firebase para prevenir loops infinitos
        localStorage.setItem('familab3d_state', JSON.stringify({
          products: state.products,
          cashRegister: state.cashRegister,
          sales: state.sales
        }));
        
        renderCatalog();
        renderAdminList();
        renderCart();
        renderCashRegister();
        renderSalesHistory();
        updateStats();
        
        isRemoteUpdating = false;
      }
    });

    isFirebaseConnected = true;
    updateNetworkStatus();
  } catch (e) {
    console.error("Error al inicializar Firebase:", e);
    isFirebaseConnected = false;
    updateNetworkStatus();
  }
}

// ESTADO DE RED E INDICADOR VISUAL
function updateNetworkStatus() {
  const badge = document.getElementById('sync-status-badge');
  const text = document.getElementById('sync-text');
  if (!badge || !text) return;

  if (navigator.onLine && isFirebaseConnected) {
    badge.className = 'sync-status-badge sync-online';
    text.textContent = 'Conectado (Nube)';
  } else {
    badge.className = 'sync-status-badge sync-offline';
    text.textContent = navigator.onLine ? 'Guardado Local (Sin Firebase)' : 'Guardado Local (Offline)';
  }
}

// MODAL DE CONFIGURACIÓN DE FIREBASE
function openFirebaseModal() {
  const modal = document.getElementById('firebase-modal');
  const savedConfigStr = localStorage.getItem('familab3d_firebase_config');
  if (savedConfigStr) {
    try {
      const cfg = JSON.parse(savedConfigStr);
      document.getElementById('fb-database-url').value = cfg.databaseURL || '';
      document.getElementById('fb-api-key').value = cfg.apiKey || '';
      document.getElementById('fb-project-id').value = cfg.projectId || '';
    } catch (e) {}
  }
  modal.classList.add('active');
}

function closeFirebaseModal() {
  document.getElementById('firebase-modal').classList.remove('active');
}

function saveFirebaseConfig(event) {
  event.preventDefault();
  const databaseURL = document.getElementById('fb-database-url').value.trim();
  const apiKey = document.getElementById('fb-api-key').value.trim();
  const projectId = document.getElementById('fb-project-id').value.trim();

  if (!databaseURL || !apiKey || !projectId) {
    alert("Por favor completa los tres campos obligatorios.");
    return;
  }

  const config = { databaseURL, apiKey, projectId };
  localStorage.setItem('familab3d_firebase_config', JSON.stringify(config));
  
  closeFirebaseModal();
  initFirebase();
  saveStateToLocalStorage();
  alert("¡Configuración de Firebase guardada con éxito! La sincronización en tiempo real está activada.");
}

// PERSISTENCIA DE DATOS Y DOBLE GUARDADO
function saveStateToLocalStorage() {
  // 1. Guardado LOCAL inmediato (100% offline safety)
  localStorage.setItem('familab3d_state', JSON.stringify({
    products: state.products,
    cashRegister: state.cashRegister,
    sales: state.sales
  }));

  // 2. Si Firebase está activo y no estamos en medio de un evento remoto, sincronizar en la Nube
  if (isFirebaseConnected && firebaseRef && !isRemoteUpdating) {
    firebaseRef.set({
      products: state.products,
      cashRegister: state.cashRegister,
      sales: state.sales,
      lastUpdated: Date.now()
    }).catch(err => {
      console.warn("[Firebase] Error al sincronizar en la nube:", err);
      updateNetworkStatus();
    });
  }
}

function loadStateFromLocalStorage() {
  const saved = localStorage.getItem('familab3d_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.products = parsed.products || [];
      state.cashRegister = parsed.cashRegister || { ...DEFAULT_CASH_REGISTER };
      state.sales = parsed.sales || [];
      
      // Normalización / Migración para asegurar estructura de variantes
      normalizeProductsState();
    } catch (e) {
      console.error("Error al cargar localStorage, usando valores predeterminados", e);
      resetStateToDefaults();
    }
  } else {
    resetStateToDefaults();
  }
}

function normalizeProductsState() {
  state.products.forEach(prod => {
    if (prod.hasVariants === undefined) prod.hasVariants = false;
    if (!prod.variants) prod.variants = [];
    
    // Si tiene variantes, calcular el stock total acumulado
    if (prod.hasVariants && prod.variants.length > 0) {
      prod.stock = prod.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
    }
  });
}

function resetStateToDefaults() {
  state.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  state.cashRegister = { ...DEFAULT_CASH_REGISTER };
  state.sales = [];
  state.cart = [];
  saveStateToLocalStorage();
}

// FUNCIONES AUXILIARES DE PRODUCTOS Y VARIANTES
function getProductTotalStock(prod) {
  if (prod.hasVariants && prod.variants && prod.variants.length > 0) {
    return prod.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
  }
  return parseInt(prod.stock) || 0;
}

function getVariantStock(prod, variantId) {
  if (prod.hasVariants && prod.variants) {
    const v = prod.variants.find(variant => variant.id === variantId);
    return v ? (parseInt(v.stock) || 0) : 0;
  }
  return parseInt(prod.stock) || 0;
}

// CONTROL DE PESTAÑAS (TABS)
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
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
    
    const totalStock = getProductTotalStock(prod);
    card.dataset.stock = totalStock;
    
    // Calcular clase e indicador de stock
    let stockClass = 'in-stock';
    let stockText = `${totalStock} disponibles`;
    
    if (totalStock === 0) {
      stockClass = 'out-of-stock';
      stockText = 'Agotado';
    } else if (totalStock <= 5) {
      stockClass = 'low-stock';
      stockText = `Últimas ${totalStock} uds.`;
    }
    
    // Crear elemento de imagen (si es base64 o placeholder)
    let imgHTML = '';
    if (prod.image && prod.image.startsWith('data:image')) {
      imgHTML = `<img src="${prod.image}" class="product-card-img" alt="${prod.name}">`;
    } else {
      const symbol = IMAGE_PLACEHOLDERS[prod.image] || IMAGE_PLACEHOLDERS['generic'];
      imgHTML = `<div class="product-image-fallback">${symbol}</div>`;
    }
    
    // Selector de variantes (si aplica)
    let variantSelectorHTML = '';
    if (prod.hasVariants && prod.variants && prod.variants.length > 0) {
      let optionsHTML = prod.variants.map(v => {
        const vStock = parseInt(v.stock) || 0;
        const disabled = vStock === 0 ? 'disabled' : '';
        const labelText = `${v.name} (${vStock > 0 ? vStock + ' uds' : 'Agotado'})`;
        return `<option value="${v.id}" ${disabled}>${labelText}</option>`;
      }).join('');
      
      variantSelectorHTML = `
        <div class="variant-select-wrapper">
          <select id="select_var_${prod.id}" class="variant-select">
            ${optionsHTML}
          </select>
        </div>
      `;
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
        ${variantSelectorHTML}
        <button class="btn-add-cart" onclick="handleAddCatalogToCart('${prod.id}')" ${totalStock === 0 ? 'disabled' : ''}>
          <span>🛒 Añadir</span>
        </button>
      </div>
    `;
    
    grid.appendChild(card);
  });
}

function handleAddCatalogToCart(productId) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;
  
  let variantId = null;
  if (prod.hasVariants && prod.variants && prod.variants.length > 0) {
    const selectElem = document.getElementById(`select_var_${productId}`);
    if (selectElem) {
      variantId = selectElem.value;
    }
  }
  
  addToCart(productId, variantId);
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
    
    // Render de controles de stock (simples o desglosados por variantes)
    let stockControlHTML = '';
    if (prod.hasVariants && prod.variants && prod.variants.length > 0) {
      let subrowsHTML = prod.variants.map(v => `
        <div class="variant-subrow">
          <span style="font-weight:600;">${v.name}:</span>
          <div class="stock-control">
            <button class="btn-qty" onclick="quickAdjustVariantStock('${prod.id}', '${v.id}', -1)">-</button>
            <input type="number" class="admin-stock-input" value="${v.stock}" min="0" onchange="manualAdjustVariantStock('${prod.id}', '${v.id}', this.value)">
            <button class="btn-qty" onclick="quickAdjustVariantStock('${prod.id}', '${v.id}', 1)">+</button>
          </div>
        </div>
      `).join('');
      
      stockControlHTML = `<div style="display:flex; flex-direction:column; gap:0.25rem;">${subrowsHTML}</div>`;
    } else {
      stockControlHTML = `
        <div class="stock-control">
          <button class="btn-qty" onclick="quickAdjustStock('${prod.id}', -1)">-</button>
          <input type="number" class="admin-stock-input" value="${prod.stock}" min="0" onchange="manualAdjustStock('${prod.id}', this.value)">
          <button class="btn-qty" onclick="quickAdjustStock('${prod.id}', 1)">+</button>
        </div>
      `;
    }
    
    row.innerHTML = `
      <td>${imgHTML}</td>
      <td style="font-weight: 600;">${prod.name}</td>
      <td>${prod.price.toFixed(2)}€</td>
      <td>${stockControlHTML}</td>
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

function adjustCashDenomination(denom, amount) {
  const current = state.cashRegister[denom] || 0;
  const newValue = Math.max(0, current + amount);
  state.cashRegister[denom] = newValue;
  
  saveStateToLocalStorage();
  renderCashRegister();
  calculateChange();
}

// FORMULARIO Y MANEJO DE VARIANTES DINÁMICAS (ADMIN)
function toggleVariantsSection() {
  const checkbox = document.getElementById('prod-has-variants');
  const panel = document.getElementById('variants-config-panel');
  const stockInputGroup = document.getElementById('group-prod-stock');
  const stockInput = document.getElementById('prod-stock');
  
  if (checkbox.checked) {
    panel.style.display = 'block';
    stockInput.disabled = true;
    stockInput.value = '0';
    stockInputGroup.style.opacity = '0.4';
  } else {
    panel.style.display = 'none';
    stockInput.disabled = false;
    stockInputGroup.style.opacity = '1';
  }
}

function addVariantToTempList() {
  const nameInput = document.getElementById('variant-name-input');
  const stockInput = document.getElementById('variant-stock-input');
  
  const name = nameInput.value.trim();
  const stock = parseInt(stockInput.value) || 0;
  
  if (!name) {
    alert("Por favor introduce el nombre de la variante (ej. Rojo, Azul, XL).");
    return;
  }
  
  const newVariant = {
    id: 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name: name,
    stock: Math.max(0, stock)
  };
  
  tempVariants.push(newVariant);
  
  nameInput.value = '';
  stockInput.value = '';
  nameInput.focus();
  
  renderTempVariantsList();
}

function removeTempVariant(variantId) {
  tempVariants = tempVariants.filter(v => v.id !== variantId);
  renderTempVariantsList();
}

function renderTempVariantsList() {
  const container = document.getElementById('temp-variants-list');
  container.innerHTML = '';
  
  tempVariants.forEach(v => {
    const chip = document.createElement('div');
    chip.className = 'temp-variant-chip';
    chip.innerHTML = `
      <span><strong>${v.name}:</strong> ${v.stock} uds</span>
      <button type="button" class="btn-remove-chip" onclick="removeTempVariant('${v.id}')">✕</button>
    `;
    container.appendChild(chip);
  });
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
  const hasVariants = document.getElementById('prod-has-variants').checked;
  const image = document.getElementById('prod-image-data').value || 'generic';
  
  if (!name || isNaN(price)) return;
  
  let finalVariants = [];
  let finalStock = 0;
  
  if (hasVariants) {
    if (tempVariants.length === 0) {
      alert("Has marcado que el producto tiene variantes, pero no has añadido ninguna. Por favor añade al menos una variante (ej. Rojo, Azul).");
      return;
    }
    finalVariants = JSON.parse(JSON.stringify(tempVariants));
    finalStock = finalVariants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
  } else {
    finalStock = parseInt(document.getElementById('prod-stock').value) || 0;
  }
  
  if (id) {
    // Modo Edición
    const prodIdx = state.products.findIndex(p => p.id === id);
    if (prodIdx !== -1) {
      state.products[prodIdx] = {
        id,
        name,
        price,
        stock: finalStock,
        image,
        hasVariants,
        variants: finalVariants
      };
    }
  } else {
    // Modo Crear
    const newId = 'p_' + Date.now();
    state.products.push({
      id: newId,
      name,
      price,
      stock: finalStock,
      image,
      hasVariants,
      variants: finalVariants
    });
  }
  
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
  
  const hasVariantsCheckbox = document.getElementById('prod-has-variants');
  hasVariantsCheckbox.checked = !!prod.hasVariants;
  
  tempVariants = prod.hasVariants && prod.variants ? JSON.parse(JSON.stringify(prod.variants)) : [];
  toggleVariantsSection();
  renderTempVariantsList();
  
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
  
  document.querySelector('.product-form-card').scrollIntoView({ behavior: 'smooth' });
}

function cancelProductEdit() {
  document.getElementById('form-title').textContent = "Agregar Nuevo Producto";
  document.getElementById('form-product-id').value = '';
  document.getElementById('product-form').reset();
  
  tempVariants = [];
  document.getElementById('prod-has-variants').checked = false;
  toggleVariantsSection();
  renderTempVariantsList();
  
  useDefaultImage();
  
  document.getElementById('btn-submit-form').textContent = "Crear Producto";
  document.getElementById('btn-cancel-edit').style.display = 'none';
}

function deleteProduct(id) {
  if (confirm("¿Estás seguro de que quieres eliminar este producto? Se eliminará del inventario y del catálogo.")) {
    state.products = state.products.filter(p => p.id !== id);
    state.cart = state.cart.filter(item => item.productId !== id);
    
    saveStateToLocalStorage();
    renderCatalog();
    renderAdminList();
    renderCart();
  }
}

function quickAdjustStock(id, delta) {
  const prod = state.products.find(p => p.id === id);
  if (prod && !prod.hasVariants) {
    prod.stock = Math.max(0, prod.stock + delta);
    saveStateToLocalStorage();
    renderAdminList();
    renderCatalog();
  }
}

function manualAdjustStock(id, value) {
  const parsed = parseInt(value);
  const prod = state.products.find(p => p.id === id);
  if (prod && !prod.hasVariants && !isNaN(parsed)) {
    prod.stock = Math.max(0, parsed);
    saveStateToLocalStorage();
    renderAdminList();
    renderCatalog();
  }
}

function quickAdjustVariantStock(productId, variantId, delta) {
  const prod = state.products.find(p => p.id === productId);
  if (prod && prod.hasVariants && prod.variants) {
    const v = prod.variants.find(variant => variant.id === variantId);
    if (v) {
      v.stock = Math.max(0, (parseInt(v.stock) || 0) + delta);
      prod.stock = prod.variants.reduce((sum, item) => sum + (parseInt(item.stock) || 0), 0);
      saveStateToLocalStorage();
      renderAdminList();
      renderCatalog();
    }
  }
}

function manualAdjustVariantStock(productId, variantId, value) {
  const parsed = parseInt(value);
  const prod = state.products.find(p => p.id === productId);
  if (prod && prod.hasVariants && prod.variants && !isNaN(parsed)) {
    const v = prod.variants.find(variant => variant.id === variantId);
    if (v) {
      v.stock = Math.max(0, parsed);
      prod.stock = prod.variants.reduce((sum, item) => sum + (parseInt(item.stock) || 0), 0);
      saveStateToLocalStorage();
      renderAdminList();
      renderCatalog();
    }
  }
}

// GESTIÓN DEL CARRITO DE COMPRA
function addToCart(productId, variantId = null) {
  const prod = state.products.find(p => p.id === productId);
  if (!prod) return;
  
  let availableStock = 0;
  let variantObj = null;
  
  if (prod.hasVariants && prod.variants && prod.variants.length > 0) {
    if (!variantId) {
      alert("Por favor selecciona una variante (color/talla) del desplegable.");
      return;
    }
    variantObj = prod.variants.find(v => v.id === variantId);
    if (!variantObj || variantObj.stock <= 0) {
      alert("La variante seleccionada está agotada.");
      return;
    }
    availableStock = parseInt(variantObj.stock) || 0;
  } else {
    if (prod.stock <= 0) {
      alert("Este producto está agotado.");
      return;
    }
    availableStock = parseInt(prod.stock) || 0;
  }
  
  const cartItem = state.cart.find(item => item.productId === productId && item.variantId === variantId);
  if (cartItem) {
    if (cartItem.quantity < availableStock) {
      cartItem.quantity++;
    } else {
      alert(`No puedes añadir más unidades. El stock límite disponible es ${availableStock}.`);
    }
  } else {
    state.cart.push({ productId, variantId, quantity: 1 });
  }
  
  renderCart();
}

function adjustCartQty(productId, variantId, delta) {
  const cartItem = state.cart.find(item => item.productId === productId && item.variantId === variantId);
  const prod = state.products.find(p => p.id === productId);
  if (!cartItem || !prod) return;
  
  const availableStock = getVariantStock(prod, variantId);
  const newQty = cartItem.quantity + delta;
  
  if (newQty <= 0) {
    removeFromCart(productId, variantId);
  } else if (newQty <= availableStock) {
    cartItem.quantity = newQty;
  } else {
    alert(`No puedes añadir más unidades. El stock límite disponible es ${availableStock}.`);
  }
  
  renderCart();
}

function removeFromCart(productId, variantId) {
  state.cart = state.cart.filter(item => !(item.productId === productId && item.variantId === variantId));
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
    
    document.getElementById('btn-confirm-sale').disabled = true;
    resetCashPaymentInputs();
    return;
  }
  
  let totalQty = 0;
  let totalAmount = 0;
  
  state.cart.forEach(item => {
    const prod = state.products.find(p => p.id === item.productId);
    if (!prod) return;
    
    let displayName = prod.name;
    if (item.variantId && prod.hasVariants && prod.variants) {
      const v = prod.variants.find(variant => variant.id === item.variantId);
      if (v) {
        displayName += ` (${v.name})`;
      }
    }
    
    const subtotal = prod.price * item.quantity;
    totalQty += item.quantity;
    totalAmount += subtotal;
    
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    row.innerHTML = `
      <div class="cart-item-details">
        <div class="cart-item-name" title="${displayName}">${displayName}</div>
        <div class="cart-item-price-unit">${prod.price.toFixed(2)}€ c/u</div>
      </div>
      <div class="cart-item-controls">
        <button class="btn-cart-qty" onclick="adjustCartQty('${prod.id}', '${item.variantId || ''}', -1)">-</button>
        <span class="cart-item-qty">${item.quantity}</span>
        <button class="btn-cart-qty" onclick="adjustCartQty('${prod.id}', '${item.variantId || ''}', 1)">+</button>
      </div>
      <div class="cart-item-subtotal">${subtotal.toFixed(2)}€</div>
      <button class="btn-remove-item" onclick="removeFromCart('${prod.id}', '${item.variantId || ''}')" title="Eliminar">✕</button>
    `;
    
    cartContainer.appendChild(row);
  });
  
  document.getElementById('cart-qty-count').textContent = totalQty;
  document.getElementById('cart-total-amount').textContent = `${totalAmount.toFixed(2)}€`;
  document.getElementById('bizum-confirm-total').textContent = `${totalAmount.toFixed(2)}€`;
  
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
    const changeBreakdown = calculateOptimalChange(changeNeeded);
    
    if (changeBreakdown.success) {
      suggestionBox.style.display = 'block';
      
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
      alertBox.style.display = 'block';
      suggestionBox.style.display = 'block';
      pillsContainer.innerHTML = `<span style="color: var(--danger); font-size: 0.8rem; font-weight:600;">⚠️ Caja sin cambio suficiente exacto.</span>`;
    }
  }
  
  validateCheckoutForm();
}

function calculateOptimalChange(targetAmount) {
  let remaining = Math.round(targetAmount * 100);
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
    
    const clientPaymentBreakdown = estimatePaymentDenominations(given);
    const changeBreakdown = calculateOptimalChange(change);
    
    for (const [denom, count] of Object.entries(clientPaymentBreakdown)) {
      state.cashRegister[denom] = (state.cashRegister[denom] || 0) + count;
    }
    
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
  
  // Actualizar stocks de productos y variantes
  const saleItemsRecord = [];
  
  state.cart.forEach(cartItem => {
    const prod = state.products.find(p => p.id === cartItem.productId);
    if (!prod) return;
    
    let itemName = prod.name;
    if (cartItem.variantId && prod.hasVariants && prod.variants) {
      const v = prod.variants.find(variant => variant.id === cartItem.variantId);
      if (v) {
        v.stock = Math.max(0, (parseInt(v.stock) || 0) - cartItem.quantity);
        itemName += ` (${v.name})`;
      }
      // Recalcular stock acumulado del producto
      prod.stock = prod.variants.reduce((sum, item) => sum + (parseInt(item.stock) || 0), 0);
    } else {
      prod.stock = Math.max(0, (parseInt(prod.stock) || 0) - cartItem.quantity);
    }
    
    saleItemsRecord.push({
      productId: cartItem.productId,
      variantId: cartItem.variantId || null,
      name: itemName,
      price: prod.price,
      quantity: cartItem.quantity
    });
  });
  
  const saleRecord = {
    id: saleId,
    time: timeStr,
    timestamp: date.getTime(),
    items: saleItemsRecord,
    total: total,
    payment: paymentDetails
  };
  
  state.sales.unshift(saleRecord);
  state.cart = [];
  
  saveStateToLocalStorage();
  
  renderCatalog();
  renderAdminList();
  renderCart();
  renderCashRegister();
  renderSalesHistory();
  updateStats();
  
  resetCashPaymentInputs();
}

function estimatePaymentDenominations(amount) {
  let remaining = Math.round(amount * 100);
  const denominations = [50, 20, 10, 5, 2, 1];
  const breakdown = { 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 };
  
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
    
    const itemsStr = sale.items.map(it => `${it.quantity}x ${it.name}`).join(', ');
    
    const badgeClass = sale.payment.method === 'cash' ? 'payment-cash' : 'payment-bizum';
    const badgeText = sale.payment.method === 'cash' ? '💵 Efectivo' : '📱 Bizum';
    const badgeHTML = `<span class="badge-payment ${badgeClass}">${badgeText}</span>`;
    
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

// DESHACER VENTA (ROLLBACK CON RESTAURACIÓN DE VARIANTES)
function undoSale(saleId) {
  const saleIdx = state.sales.findIndex(s => s.id === saleId);
  if (saleIdx === -1) return;
  
  if (confirm("¿Estás seguro de que quieres deshacer esta venta? Se devolverán los artículos y sus variantes correspondientes al stock y se revertirán los importes de caja.")) {
    const sale = state.sales[saleIdx];
    
    sale.items.forEach(item => {
      const prod = state.products.find(p => p.id === item.productId);
      if (prod) {
        if (item.variantId && prod.hasVariants && prod.variants) {
          const v = prod.variants.find(variant => variant.id === item.variantId);
          if (v) {
            v.stock = (parseInt(v.stock) || 0) + item.quantity;
          }
          prod.stock = prod.variants.reduce((sum, it) => sum + (parseInt(it.stock) || 0), 0);
        } else {
          prod.stock = (parseInt(prod.stock) || 0) + item.quantity;
        }
      }
    });
    
    if (sale.payment.method === 'cash') {
      if (sale.payment.addedDenoms) {
        for (const [denom, count] of Object.entries(sale.payment.addedDenoms)) {
          state.cashRegister[denom] = Math.max(0, (state.cashRegister[denom] || 0) - count);
        }
      }
      if (sale.payment.removedDenoms) {
        for (const [denom, count] of Object.entries(sale.payment.removedDenoms)) {
          state.cashRegister[denom] = (state.cashRegister[denom] || 0) + count;
        }
      }
    }
    
    state.sales.splice(saleIdx, 1);
    saveStateToLocalStorage();
    
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
    
    <div class="report-section">
      <h4>Ventas por Producto y Variante</h4>
      <div class="report-products-list">
        ${productsHTML}
      </div>
    </div>
    
    <div class="report-section">
      <h4>Estado de Caja Fuerte</h4>
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
    cancelProductEdit();
    renderCatalog();
    renderAdminList();
    renderCart();
    renderCashRegister();
    renderSalesHistory();
    updateStats();
    alert("Aplicación reiniciada a los valores iniciales de fábrica.");
  }
}
