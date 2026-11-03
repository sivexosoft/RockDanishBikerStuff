import {
  DEFAULT_SITE_SETTINGS,
  GENUINE_GOOGLE_REVIEWS,
  INITIAL_CATEGORIES,
  SAMPLE_PRODUCTS,
} from './data.js';
import {
  fetchCategories,
  fetchCoupons,
  fetchDiscounts,
  fetchProducts,
  fetchReviews,
  fetchSiteSettings,
  fetchUserWishlistIds,
  toggleWishlistProduct,
  validateCouponCode,
} from './services.js';
import { escapeHtml, getEffectivePrice } from './utils.js';

const CART_LS_KEY = 'rdbs_cart_v1';

function loadInitialCart() {
  try {
    const raw = localStorage.getItem(CART_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const store = {
  // Auth
  authLoading: true,
  firebaseUser: null,
  profile: null,
  isAdmin: false,

  // Storefront Catalog & Settings
  loadingStore: true,
  products: SAMPLE_PRODUCTS,
  usingSampleCatalog: true,
  categories: INITIAL_CATEGORIES,
  coupons: [],
  discounts: [],
  reviews: GENUINE_GOOGLE_REVIEWS,
  siteSettings: DEFAULT_SITE_SETTINGS,
  wishlistIds: [],

  // Cart & UI Drawers
  cart: loadInitialCart(),
  appliedCoupon: null,
  cartDrawerOpen: false,
  mobileMenuOpen: false,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach((fn) => fn());
}

function saveCartToStorage() {
  try {
    localStorage.setItem(CART_LS_KEY, JSON.stringify(store.cart));
  } catch {
    // Ignore storage quota issues
  }
}

export async function refreshStoreData() {
  try {
    const [prodRes, cats, cpns, dscs, revs, settings] = await Promise.all([
      fetchProducts(),
      fetchCategories(),
      fetchCoupons(),
      fetchDiscounts(),
      fetchReviews(false),
      fetchSiteSettings(),
    ]);
    store.products = prodRes.products;
    store.usingSampleCatalog = prodRes.usingSampleCatalog;
    store.categories = cats;
    store.coupons = cpns;
    store.discounts = dscs;
    store.reviews = revs;
    store.siteSettings = settings;
  } catch (err) {
    console.error('Failed to refresh store catalog:', err);
  } finally {
    store.loadingStore = false;
    notify();
  }
}

export async function refreshWishlist() {
  try {
    store.wishlistIds = await fetchUserWishlistIds(store.firebaseUser?.uid || null);
    notify();
  } catch {
    store.wishlistIds = [];
  }
}

export function isWishlisted(productId) {
  return store.wishlistIds.includes(productId);
}

export async function handleToggleWishlist(productId) {
  const product = store.products.find((p) => p.id === productId);
  const currently = isWishlisted(productId);
  store.wishlistIds = currently
    ? store.wishlistIds.filter((id) => id !== productId)
    : [...store.wishlistIds, productId];
  notify();

  try {
    const nextState = await toggleWishlistProduct(
      productId,
      currently,
      store.firebaseUser?.uid || null
    );
    const cleanName = product ? product.name.replace(/\s*\(Sample\)$/i, '') : 'Item';
    showToast(nextState ? `${cleanName} saved to wishlist` : 'Removed from wishlist', 'info');
  } catch {
    showToast('Could not update wishlist.', 'error');
  }
}

// ============================================================================
// CART ACTIONS
// ============================================================================
export function addToCart(product, quantity = 1, selectedSize = '', selectedColor = '', openDrawer = true) {
  if (!product) return;
  if (product.availability === 'out_of_stock' || Number(product.stock) <= 0) {
    showToast('This item is currently out of stock.', 'error');
    return;
  }

  const size = selectedSize || product.sizes?.[0] || '';
  const color = selectedColor || product.colors?.[0] || '';
  const cartItemId = `${product.id}__${size}__${color}`;

  const existingIdx = store.cart.findIndex((item) => item.cartItemId === cartItemId);
  if (existingIdx >= 0) {
    store.cart[existingIdx].quantity = Math.min(
      store.cart[existingIdx].quantity + quantity,
      Math.max(1, Number(product.stock || 99))
    );
  } else {
    store.cart.push({
      cartItemId,
      product,
      quantity: Math.max(1, quantity),
      selectedSize: size,
      selectedColor: color,
    });
  }

  saveCartToStorage();
  if (openDrawer) {
    store.cartDrawerOpen = true;
  }
  showToast(`${product.name.replace(/\s*\(Sample\)$/i, '')} added to cart`, 'success');
  notify();
}

export function updateCartQuantity(cartItemId, nextQty) {
  if (nextQty <= 0) {
    removeFromCart(cartItemId);
    return;
  }
  store.cart = store.cart.map((item) =>
    item.cartItemId === cartItemId
      ? { ...item, quantity: Math.min(nextQty, Math.max(1, Number(item.product.stock || 99))) }
      : item
  );
  saveCartToStorage();
  notify();
}

export function removeFromCart(cartItemId) {
  store.cart = store.cart.filter((item) => item.cartItemId !== cartItemId);
  if (store.cart.length === 0) store.appliedCoupon = null;
  saveCartToStorage();
  notify();
}

export function clearCart() {
  store.cart = [];
  store.appliedCoupon = null;
  saveCartToStorage();
  notify();
}

export function getCartTotals() {
  const itemCount = store.cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = store.cart.reduce(
    (sum, item) => sum + getEffectivePrice(item.product) * item.quantity,
    0
  );

  let discountAmount = 0;
  if (store.appliedCoupon) {
    if (
      store.appliedCoupon.min_order_amount > 0 &&
      subtotal < store.appliedCoupon.min_order_amount
    ) {
      discountAmount = 0;
    } else if (store.appliedCoupon.discount_type === 'percentage') {
      discountAmount = Math.min(
        subtotal,
        Math.round((subtotal * Number(store.appliedCoupon.discount_value)) / 100)
      );
    } else {
      discountAmount = Math.min(subtotal, Math.round(Number(store.appliedCoupon.discount_value)));
    }
  }

  return {
    itemCount,
    subtotal,
    discountAmount,
    total: Math.max(0, subtotal - discountAmount),
  };
}

export async function applyCouponToCart(code) {
  const { subtotal } = getCartTotals();
  const res = await validateCouponCode(code, subtotal);
  if (res.valid && res.coupon) {
    store.appliedCoupon = res.coupon;
    showToast(res.message, 'success');
    notify();
    return { ok: true, message: res.message };
  }
  showToast(res.message, 'error');
  return { ok: false, message: res.message };
}

export function removeCouponFromCart() {
  store.appliedCoupon = null;
  notify();
}

// ============================================================================
// TOAST NOTIFICATIONS & CONFIRMATION MODALS (No window.alert / window.confirm)
// ============================================================================
export function showToast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const el = document.createElement('div');
  el.className = `toast-item ${
    type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''
  }`;
  el.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <button type="button" aria-label="Dismiss" style="background:none;border:none;color:#fff;font-weight:700;padding:0 4px;">&times;</button>
  `;
  el.querySelector('button')?.addEventListener('click', () => el.remove());
  root.appendChild(el);

  setTimeout(() => {
    if (el.isConnected) el.remove();
  }, 3600);
}

export function openConfirmModal({
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = true,
  onConfirm,
}) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;

  modalRoot.innerHTML = `
    <div class="backdrop-overlay backdrop-center" id="confirm-backdrop">
      <div class="modal-card modal-sm" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3 style="font-size:17px;font-weight:800;">${escapeHtml(title)}</h3>
          <button type="button" class="btn btn-ghost btn-sm" id="confirm-close-btn">&times;</button>
        </div>
        <div class="modal-body stack-md">
          <p class="text-muted" style="font-size:14px;line-height:1.55;">${escapeHtml(description)}</p>
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button type="button" class="btn btn-outline" id="confirm-cancel-btn">Cancel</button>
            <button type="button" class="btn ${destructive ? 'btn-red' : 'btn-black'}" id="confirm-ok-btn">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const close = () => {
    modalRoot.innerHTML = '';
  };

  document.getElementById('confirm-close-btn')?.addEventListener('click', close);
  document.getElementById('confirm-cancel-btn')?.addEventListener('click', close);
  document.getElementById('confirm-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'confirm-backdrop') close();
  });
  document.getElementById('confirm-ok-btn')?.addEventListener('click', async () => {
    close();
    if (onConfirm) await onConfirm();
  });
}

export function closeModalRoot() {
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot) modalRoot.innerHTML = '';
}
