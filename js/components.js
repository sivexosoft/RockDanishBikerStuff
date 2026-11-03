import { BUSINESS_INFO } from './data.js';
import {
  addToCart,
  getCartTotals,
  handleToggleWishlist,
  isWishlisted,
  notify,
  removeFromCart,
  store,
  updateCartQuantity,
} from './state.js';
import {
  buildGeneralSupportWhatsAppUrl,
  escapeHtml,
  formatPKR,
  getDiscountPercent,
  getEffectivePrice,
  icon,
  renderStars,
} from './utils.js';

const NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/shop' },
  { label: 'Categories', to: '/categories' },
  { label: 'New Arrivals', to: '/new-arrivals' },
  { label: 'Best Sellers', to: '/best-sellers' },
  { label: 'Deals', to: '/deals' },
  { label: 'About Us', to: '/about' },
  { label: 'Track Order', to: '/track-order' },
  { label: 'Contact', to: '/contact' },
];

export function renderAnnouncementBar() {
  const s = store.siteSettings;
  const freeDeliveryNotice =
    s.free_delivery_enabled && Number(s.free_delivery_threshold) > 0
      ? ` <span class="announcement-dot">&bull;</span> <span>Free Delivery on Orders Over ${formatPKR(s.free_delivery_threshold)}</span>`
      : s.free_delivery_enabled
        ? ' <span class="announcement-dot">&bull;</span> <span>Free Delivery Enabled</span>'
        : '';

  return `
    <div class="announcement-bar">
      <div class="container announcement-inner">
        <div class="announcement-text">
          <span>${escapeHtml(s.announcement_text)}</span>
          ${freeDeliveryNotice}
        </div>
        <div class="announcement-links">
          <a href="${escapeHtml(s.facebook_url)}" target="_blank" rel="noopener noreferrer">Facebook</a>
          <a href="${escapeHtml(s.instagram_url)}" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="${escapeHtml(s.youtube_url)}" target="_blank" rel="noopener noreferrer">YouTube</a>
        </div>
      </div>
    </div>
  `;
}

export function renderHeader(currentPath = '/') {
  const { itemCount } = getCartTotals();
  const wishCount = store.wishlistIds.length;
  const isLogged = Boolean(store.firebaseUser);

  return `
    <header class="site-header">
      <div class="container header-main">
        <a href="/" data-link class="brand-logo-link" aria-label="Rock Danish Biker Stuff Home">
          <img src="/images/logo-on-white.png" alt="Rock Danish Biker Stuff" class="brand-logo-img" />
        </a>

        <div class="header-search-wrap" id="desktop-search-wrap">
          <form class="header-search-form" id="header-search-form">
            <input
              type="search"
              id="header-search-input"
              class="header-search-input"
              placeholder="Search helmets, jackets, gloves, SKU (e.g. RDBS-JACKET-001)..."
              autocomplete="off"
              aria-label="Search products"
            />
            <button type="submit" class="header-search-btn" aria-label="Search">
              ${icon('search', 17)}
            </button>
          </form>
          <div id="header-search-dropdown" class="search-dropdown" style="display:none;"></div>
        </div>

        <div class="header-actions">
          ${
            store.isAdmin
              ? `<a href="/admin" data-link class="btn btn-sm btn-red desktop-only">${icon('shield', 15)}<span>Admin</span></a>`
              : ''
          }

          <a
            href="${isLogged ? '/account' : '/login'}"
            data-link
            class="icon-action-btn"
            title="${isLogged ? 'My Account' : 'Login / Register'}"
          >
            ${icon('user', 19)}
            <span class="desktop-only">${
              isLogged
                ? escapeHtml((store.profile?.full_name || store.profile?.email || 'Account').split(' ')[0])
                : 'Login / Register'
            }</span>
          </a>

          <a href="/wishlist" data-link class="icon-action-btn" aria-label="Wishlist">
            ${icon('heart', 19)}
            ${wishCount > 0 ? `<span class="counter-pill tabular-nums">${wishCount}</span>` : ''}
          </a>

          <button type="button" class="icon-action-btn" id="open-cart-drawer-btn" aria-label="Shopping Cart">
            ${icon('cart', 19)}
            <span class="counter-pill tabular-nums">${itemCount}</span>
          </button>

          <button type="button" class="icon-action-btn mobile-only" id="open-mobile-menu-btn" aria-label="Open menu">
            ${icon('menu', 21)}
          </button>
        </div>
      </div>

      <!-- Mobile Search Bar -->
      <div class="mobile-search-bar">
        <form class="header-search-form" id="mobile-search-form">
          <input
            type="search"
            id="mobile-search-input"
            class="header-search-input"
            placeholder="Search helmets, jackets, gloves..."
            aria-label="Search products"
          />
          <button type="submit" class="header-search-btn" aria-label="Search">
            ${icon('search', 16)}
          </button>
        </form>
      </div>

      <!-- Desktop Navigation Strip -->
      <nav class="nav-strip" aria-label="Primary Navigation">
        <div class="container nav-strip-inner">
          <div class="nav-links">
            ${NAV_ITEMS.map(
              (item) => `
              <a
                href="${item.to}"
                data-link
                class="nav-link ${currentPath === item.to ? 'active' : ''}"
              >${escapeHtml(item.label)}</a>
            `
            ).join('')}
          </div>
          <a
            href="${buildGeneralSupportWhatsAppUrl('', store.siteSettings.whatsapp_number)}"
            target="_blank"
            rel="noopener noreferrer"
            style="font-size:12.5px;font-weight:700;color:#34D399;display:inline-flex;align-items:center;gap:6px;"
          >
            ${icon('whatsapp', 15)}
            <span class="tabular-nums">WhatsApp: ${escapeHtml(store.siteSettings.whatsapp_number)}</span>
          </a>
        </div>
      </nav>
    </header>
  `;
}

export function renderFooter() {
  const s = store.siteSettings;
  const topCats = store.categories.filter((c) => c.is_active).slice(0, 6);

  return `
    <footer class="site-footer">
      <div class="container footer-grid">
        <div>
          <a href="/" data-link aria-label="Rock Danish Biker Stuff">
            <img src="/images/logo-dark.png" alt="Rock Danish Biker Stuff" class="footer-logo" />
          </a>
          <p style="font-size:13.5px;color:#A3A3A3;max-width:380px;line-height:1.6;">
            Rock Danish Biker Stuff is a Karachi-based motorcycle gear, biker clothing, and riding accessories store serving commuters, touring enthusiasts, and everyday riders with practical gear and direct WhatsApp ordering.
          </p>
          <div class="social-btns">
            <a href="${escapeHtml(s.facebook_url)}" target="_blank" rel="noopener noreferrer" class="social-btn">Facebook</a>
            <a href="${escapeHtml(s.instagram_url)}" target="_blank" rel="noopener noreferrer" class="social-btn">Instagram</a>
            <a href="${escapeHtml(s.youtube_url)}" target="_blank" rel="noopener noreferrer" class="social-btn">YouTube</a>
          </div>
        </div>

        <div>
          <h3 class="footer-heading">Quick Links</h3>
          <ul class="footer-list">
            <li><a href="/" data-link>Home</a></li>
            <li><a href="/shop" data-link>Shop All Gear</a></li>
            <li><a href="/new-arrivals" data-link>New Arrivals</a></li>
            <li><a href="/best-sellers" data-link>Best Sellers</a></li>
            <li><a href="/deals" data-link>Deals &amp; Discounts</a></li>
            <li><a href="/about" data-link>About Us</a></li>
          </ul>
        </div>

        <div>
          <h3 class="footer-heading">Shop Categories</h3>
          <ul class="footer-list">
            ${topCats
              .map(
                (cat) => `
              <li>
                <a href="/shop?category=${encodeURIComponent(cat.name)}" data-link>${escapeHtml(cat.name)}</a>
              </li>
            `
              )
              .join('')}
          </ul>
        </div>

        <div>
          <h3 class="footer-heading">Contact &amp; Support</h3>
          <ul class="footer-list">
            <li style="display:flex;align-items:flex-start;gap:8px;color:#A3A3A3;">
              <span style="color:var(--red);margin-top:2px;">${icon('mapPin', 16)}</span>
              <span>${escapeHtml(s.address)}</span>
            </li>
            <li style="display:flex;align-items:center;gap:8px;">
              <span style="color:var(--red);">${icon('phone', 16)}</span>
              <a href="tel:${escapeHtml(s.phone_number.replace(/\s+/g, ''))}" class="tabular-nums">${escapeHtml(s.phone_number)}</a>
            </li>
            <li style="display:flex;align-items:center;gap:8px;">
              <span style="color:#10B981;">${icon('whatsapp', 16)}</span>
              <a href="${buildGeneralSupportWhatsAppUrl('', s.whatsapp_number)}" target="_blank" rel="noopener noreferrer" class="tabular-nums">
                WhatsApp: ${escapeHtml(s.whatsapp_number)}
              </a>
            </li>
            <li><a href="/track-order" data-link style="text-decoration:underline;text-underline-offset:4px;">Track Your Order</a></li>
            <li><a href="/account" data-link style="text-decoration:underline;text-underline-offset:4px;">My Account &amp; Orders</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; 2026 Rock Danish Biker Stuff. All Rights Reserved.</p>
        <p>
          <a
            href="${BUSINESS_INFO.developerUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="footer-dev-link"
          >Developed by ${BUSINESS_INFO.developerName} ${icon('external', 12)}</a>
        </p>
      </div>
    </footer>
  `;
}

export function renderProductCard(product) {
  const effective = getEffectivePrice(product);
  const discountPct = getDiscountPercent(product);
  const wishlisted = isWishlisted(product.id);
  const outOfStock = product.availability === 'out_of_stock' || Number(product.stock) <= 0;

  return `
    <article class="product-card">
      <div class="product-media">
        <div class="product-badges">
          ${discountPct > 0 ? `<span class="badge badge-red tabular-nums">${discountPct}% OFF</span>` : ''}
          ${
            outOfStock
              ? '<span class="badge badge-black">Out of Stock</span>'
              : product.availability === 'low_stock'
                ? '<span class="badge badge-amber">Low Stock</span>'
                : ''
          }
        </div>

        <button
          type="button"
          class="wishlist-btn ${wishlisted ? 'active' : ''}"
          data-wishlist-id="${escapeHtml(product.id)}"
          aria-label="Toggle wishlist"
        >
          ${wishlisted ? icon('heartFill', 16) : icon('heart', 16)}
        </button>

        <a href="/product/${escapeHtml(product.slug)}" data-link style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
          <img
            src="${escapeHtml(product.images?.[0] || '/images/products/helmet-pro.jpg')}"
            alt="${escapeHtml(product.name)}"
            loading="lazy"
            onerror="this.src='/images/products/helmet-pro.jpg'"
          />
        </a>
      </div>

      <div class="product-body">
        <div class="product-cat-row">
          <span>${escapeHtml(product.category_name)}</span>
          <span class="font-mono">${escapeHtml(product.sku)}</span>
        </div>

        <a href="/product/${escapeHtml(product.slug)}" data-link class="product-title">
          ${escapeHtml(product.name)}
        </a>

        <div class="rating-row tabular-nums">
          ${renderStars(product.rating, 13)}
          <span>${Number(product.rating || 4.5).toFixed(1)} (${Number(product.review_count || 0)})</span>
        </div>

        <div class="price-row tabular-nums">
          <span class="price-current">${formatPKR(effective)}</span>
          ${discountPct > 0 ? `<span class="price-old">${formatPKR(product.price)}</span>` : ''}
        </div>

        <div class="product-actions">
          <button
            type="button"
            class="btn btn-sm ${outOfStock ? 'btn-outline' : 'btn-red'}"
            data-add-cart-id="${escapeHtml(product.id)}"
            ${outOfStock ? 'disabled' : ''}
          >
            ${icon('cart', 14)}
            <span>${outOfStock ? 'Sold Out' : 'Add to Cart'}</span>
          </button>
          <a href="/product/${escapeHtml(product.slug)}" data-link class="btn btn-sm btn-outline">
            Details
          </a>
        </div>
      </div>
    </article>
  `;
}

export function renderDrawers(navigateFn) {
  const drawerRoot = document.getElementById('drawer-root');
  if (!drawerRoot) return;

  if (!store.cartDrawerOpen && !store.mobileMenuOpen) {
    drawerRoot.innerHTML = '';
    return;
  }

  if (store.mobileMenuOpen) {
    const isLogged = Boolean(store.firebaseUser);
    drawerRoot.innerHTML = `
      <div class="backdrop-overlay backdrop-left" id="mobile-drawer-backdrop">
        <div class="drawer-panel" style="max-width:320px;">
          <div class="drawer-header">
            <img src="/images/logo-on-white.png" alt="Rock Danish Biker Stuff" style="height:40px;width:auto;" />
            <button type="button" class="btn btn-ghost btn-sm" id="close-mobile-menu-btn">${icon('x', 20)}</button>
          </div>
          <div class="drawer-body stack-sm">
            ${NAV_ITEMS.map(
              (item) => `
              <a href="${item.to}" data-link class="admin-nav-link">${escapeHtml(item.label)}</a>
            `
            ).join('')}
            <hr style="border:none;border-top:1px solid var(--border);margin:8px 0;" />
            <a href="${isLogged ? '/account' : '/login'}" data-link class="admin-nav-link">
              ${icon('user', 16)}
              <span>${isLogged ? 'My Account' : 'Sign In / Create Account'}</span>
            </a>
            ${
              store.isAdmin
                ? `<a href="/admin" data-link class="btn btn-red btn-block">${icon('shield', 16)}<span>Admin Dashboard</span></a>`
                : ''
            }
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-mobile-menu-btn')?.addEventListener('click', () => {
      store.mobileMenuOpen = false;
      notify();
    });
    document.getElementById('mobile-drawer-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'mobile-drawer-backdrop') {
        store.mobileMenuOpen = false;
        notify();
      }
    });
    return;
  }

  if (store.cartDrawerOpen) {
    const { subtotal, discountAmount, total, itemCount } = getCartTotals();
    drawerRoot.innerHTML = `
      <div class="backdrop-overlay" id="cart-drawer-backdrop">
        <div class="drawer-panel">
          <div class="drawer-header">
            <h3 style="font-size:17px;font-weight:800;">Shopping Cart (${itemCount})</h3>
            <button type="button" class="btn btn-ghost btn-sm" id="close-cart-drawer-btn">${icon('x', 20)}</button>
          </div>

          <div class="drawer-body stack-md">
            ${
              store.cart.length === 0
                ? `
              <div style="text-align:center;padding:48px 12px;">
                <p style="font-weight:700;font-size:15px;">Your cart is empty</p>
                <p class="text-muted" style="font-size:13px;margin:6px 0 18px;">Add helmets, riding jackets, gloves, or accessories to get started.</p>
                <button type="button" class="btn btn-red" id="drawer-browse-btn">Browse Gear</button>
              </div>
            `
                : store.cart
                    .map((item) => {
                      const unit = getEffectivePrice(item.product);
                      return `
                  <div style="display:flex;gap:12px;padding-bottom:14px;border-bottom:1px solid var(--border);">
                    <img
                      src="${escapeHtml(item.product.images?.[0] || '/images/products/helmet-pro.jpg')}"
                      alt="${escapeHtml(item.product.name)}"
                      style="width:64px;height:64px;object-fit:contain;border:1px solid var(--border);border-radius:8px;padding:4px;flex-shrink:0;"
                    />
                    <div style="flex:1;min-width:0;">
                      <p style="font-size:13.5px;font-weight:700;line-height:1.3;">${escapeHtml(item.product.name)}</p>
                      <p class="text-subtle" style="font-size:11.5px;margin-top:2px;">
                        ${escapeHtml([item.selectedSize, item.selectedColor].filter(Boolean).join(' · ') || item.product.sku)}
                      </p>
                      <div class="flex-between" style="margin-top:8px;">
                        <div class="qty-control" style="height:30px;">
                          <button type="button" data-drawer-dec="${escapeHtml(item.cartItemId)}">-</button>
                          <span style="min-width:28px;font-size:12.5px;">${item.quantity}</span>
                          <button type="button" data-drawer-inc="${escapeHtml(item.cartItemId)}">+</button>
                        </div>
                        <span style="font-weight:800;font-size:13.5px;color:var(--red);" class="tabular-nums">
                          ${formatPKR(unit * item.quantity)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      data-drawer-rm="${escapeHtml(item.cartItemId)}"
                      aria-label="Remove item"
                    >${icon('trash', 15)}</button>
                  </div>
                `;
                    })
                    .join('')
            }
          </div>

          ${
            store.cart.length > 0
              ? `
            <div class="drawer-footer stack-sm">
              <div class="flex-between" style="font-size:13.5px;">
                <span class="text-muted">Subtotal</span>
                <strong class="tabular-nums">${formatPKR(subtotal)}</strong>
              </div>
              ${
                discountAmount > 0
                  ? `<div class="flex-between" style="font-size:13px;color:var(--green);">
                      <span>Discount (${escapeHtml(store.appliedCoupon?.code || '')})</span>
                      <strong class="tabular-nums">-${formatPKR(discountAmount)}</strong>
                    </div>`
                  : ''
              }
              <div class="flex-between" style="font-size:16px;padding-top:6px;border-top:1px solid var(--border);">
                <strong>Total</strong>
                <strong style="color:var(--red);" class="tabular-nums">${formatPKR(total)}</strong>
              </div>
              <div class="grid-2" style="padding-top:6px;">
                <a href="/cart" data-link class="btn btn-outline btn-block">View Cart</a>
                <a href="/checkout" data-link class="btn btn-red btn-block">Checkout</a>
              </div>
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;

    document.getElementById('close-cart-drawer-btn')?.addEventListener('click', () => {
      store.cartDrawerOpen = false;
      notify();
    });
    document.getElementById('cart-drawer-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'cart-drawer-backdrop') {
        store.cartDrawerOpen = false;
        notify();
      }
    });
    document.getElementById('drawer-browse-btn')?.addEventListener('click', () => {
      store.cartDrawerOpen = false;
      notify();
      navigateFn('/shop');
    });

    drawerRoot.querySelectorAll('[data-drawer-dec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-drawer-dec');
        const found = store.cart.find((c) => c.cartItemId === id);
        if (found) updateCartQuantity(id, found.quantity - 1);
      });
    });
    drawerRoot.querySelectorAll('[data-drawer-inc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-drawer-inc');
        const found = store.cart.find((c) => c.cartItemId === id);
        if (found) updateCartQuantity(id, found.quantity + 1);
      });
    });
    drawerRoot.querySelectorAll('[data-drawer-rm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-drawer-rm');
        removeFromCart(id);
      });
    });
  }
}

export function bindSharedStorefrontEvents(container, navigateFn) {
  // Cart & Mobile Menu Triggers
  document.getElementById('open-cart-drawer-btn')?.addEventListener('click', () => {
    store.cartDrawerOpen = true;
    notify();
  });
  document.getElementById('open-mobile-menu-btn')?.addEventListener('click', () => {
    store.mobileMenuOpen = true;
    notify();
  });

  // Search Bar + Instant Dropdown
  const desktopInput = document.getElementById('header-search-input');
  const dropdown = document.getElementById('header-search-dropdown');
  const desktopForm = document.getElementById('header-search-form');
  const mobileForm = document.getElementById('mobile-search-form');

  if (desktopInput && dropdown) {
    desktopInput.addEventListener('input', () => {
      const q = desktopInput.value.trim().toLowerCase();
      if (q.length < 2) {
        dropdown.style.display = 'none';
        return;
      }
      const matches = store.products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.category_name.toLowerCase().includes(q)
        )
        .slice(0, 5);

      if (matches.length === 0) {
        dropdown.innerHTML = `<div style="padding:14px;text-align:center;font-size:13px;" class="text-muted">No gear matching &ldquo;${escapeHtml(desktopInput.value)}&rdquo;</div>`;
      } else {
        dropdown.innerHTML =
          matches
            .map(
              (m) => `
          <a href="/product/${escapeHtml(m.slug)}" data-link class="search-result-item">
            <img src="${escapeHtml(m.images?.[0] || '/images/products/helmet-pro.jpg')}" alt="${escapeHtml(m.name)}" class="search-result-thumb" />
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(m.name)}</div>
              <div class="text-subtle font-mono" style="font-size:11px;">${escapeHtml(m.sku)}</div>
            </div>
            <strong style="font-size:13px;color:var(--red);" class="tabular-nums">${formatPKR(getEffectivePrice(m))}</strong>
          </a>
        `
            )
            .join('') +
          `<a href="/shop?q=${encodeURIComponent(desktopInput.value.trim())}" data-link style="display:block;padding:10px;text-align:center;font-size:12.5px;font-weight:700;color:var(--red);background:var(--gray-bg);">View all search results &rarr;</a>`;
      }
      dropdown.style.display = 'block';
    });
  }

  desktopForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = desktopInput?.value.trim() || '';
    if (dropdown) dropdown.style.display = 'none';
    navigateFn(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
  });

  mobileForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('mobile-search-input')?.value.trim() || '';
    navigateFn(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
  });

  // Delegated Product Card Buttons (Add to Cart & Wishlist)
  container.querySelectorAll('[data-add-cart-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-add-cart-id');
      const prod = store.products.find((p) => p.id === id);
      if (prod) addToCart(prod, 1);
    });
  });

  container.querySelectorAll('[data-wishlist-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-wishlist-id');
      if (id) handleToggleWishlist(id);
    });
  });
}
