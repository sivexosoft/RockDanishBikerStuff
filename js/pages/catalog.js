import { renderProductCard } from '../components.js';
import {
  addToCart,
  handleToggleWishlist,
  isWishlisted,
  store,
} from '../state.js';
import {
  buildSingleProductWhatsAppUrl,
  escapeHtml,
  formatPKR,
  getDiscountPercent,
  getEffectivePrice,
  icon,
  renderStars,
} from '../utils.js';

// Shop Filter State
const shopFilters = {
  q: '',
  category: 'All',
  brand: 'All',
  size: 'All',
  color: 'All',
  minPrice: '',
  maxPrice: '',
  inStockOnly: false,
  dealsOnly: false,
  minRating: 0,
  sortBy: 'newest',
};

export function syncShopFiltersFromUrl(preset = 'all') {
  const params = new URLSearchParams(window.location.search);
  shopFilters.q = params.get('q') || '';
  shopFilters.category = params.get('category') || 'All';
  shopFilters.dealsOnly = preset === 'deals';
}

export function renderShopPage(preset = 'all') {
  const categories = store.categories.filter((c) => c.is_active);
  const brands = Array.from(new Set(store.products.map((p) => p.brand).filter(Boolean))).sort();
  const sizes = Array.from(new Set(store.products.flatMap((p) => p.sizes || []))).filter(Boolean);
  const colors = Array.from(new Set(store.products.flatMap((p) => p.colors || []))).filter(Boolean);

  const q = shopFilters.q.trim().toLowerCase();
  const minP = shopFilters.minPrice !== '' ? Number(shopFilters.minPrice) : null;
  const maxP = shopFilters.maxPrice !== '' ? Number(shopFilters.maxPrice) : null;

  const filtered = store.products
    .filter((p) => {
      if (preset === 'new-arrivals' && !p.new_arrival) return false;
      if (preset === 'best-sellers' && !p.best_seller) return false;
      if ((preset === 'deals' || shopFilters.dealsOnly) && getDiscountPercent(p) <= 0 && !p.featured_deal) {
        return false;
      }
      if (q) {
        const hit =
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category_name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (shopFilters.category !== 'All' && p.category_name !== shopFilters.category) return false;
      if (shopFilters.brand !== 'All' && p.brand !== shopFilters.brand) return false;
      if (shopFilters.size !== 'All' && !(p.sizes || []).includes(shopFilters.size)) return false;
      if (shopFilters.color !== 'All' && !(p.colors || []).includes(shopFilters.color)) return false;
      if (shopFilters.inStockOnly && (p.availability === 'out_of_stock' || Number(p.stock) <= 0)) {
        return false;
      }
      if (shopFilters.minRating > 0 && Number(p.rating || 0) < shopFilters.minRating) return false;
      const eff = getEffectivePrice(p);
      if (minP !== null && eff < minP) return false;
      if (maxP !== null && eff > maxP) return false;
      return true;
    })
    .sort((a, b) => {
      if (shopFilters.sortBy === 'price-asc') return getEffectivePrice(a) - getEffectivePrice(b);
      if (shopFilters.sortBy === 'price-desc') return getEffectivePrice(b) - getEffectivePrice(a);
      if (shopFilters.sortBy === 'rating') return Number(b.rating || 0) - Number(a.rating || 0);
      if (shopFilters.sortBy === 'popular') return Number(b.review_count || 0) - Number(a.review_count || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const headingMap = {
    all: 'Shop Motorcycle Gear & Accessories',
    'new-arrivals': 'New Arrivals',
    'best-sellers': 'Best Selling Rider Gear',
    deals: 'Deals & Special Offers',
  };

  return `
    <div class="page-banner">
      <div class="container">
        <h1 style="font-size:clamp(1.65rem,3vw,2.2rem);font-weight:800;">${escapeHtml(headingMap[preset] || headingMap.all)}</h1>
        <p class="text-muted" style="font-size:14px;margin-top:4px;">
          Browse helmets, riding jackets, gloves, boots, bike covers, and accessories from Rock Danish Biker Stuff in Karachi.
        </p>
      </div>
    </div>

    <div class="container shop-layout">
      <!-- Filter Sidebar -->
      <aside class="filter-sidebar">
        <div class="flex-between">
          <strong style="font-size:15px;">${icon('filter', 16)} Filter Gear</strong>
          <button type="button" class="btn btn-ghost btn-sm" id="shop-reset-btn">Reset</button>
        </div>

        <div class="form-group">
          <label class="form-label">Search Keyword / SKU</label>
          <input type="search" id="f-q" class="form-input" value="${escapeHtml(shopFilters.q)}" placeholder="Helmet, jacket, SKU..." />
        </div>

        <div class="form-group">
          <label class="form-label">Category</label>
          <select id="f-category" class="form-select">
            <option value="All">All Categories</option>
            ${categories
              .map(
                (c) => `<option value="${escapeHtml(c.name)}" ${shopFilters.category === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Brand</label>
          <select id="f-brand" class="form-select">
            <option value="All">All Brands</option>
            ${brands
              .map(
                (b) => `<option value="${escapeHtml(b)}" ${shopFilters.brand === b ? 'selected' : ''}>${escapeHtml(b)}</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Min PKR</label>
            <input type="number" id="f-min" class="form-input tabular-nums" value="${escapeHtml(shopFilters.minPrice)}" placeholder="0" />
          </div>
          <div class="form-group">
            <label class="form-label">Max PKR</label>
            <input type="number" id="f-max" class="form-input tabular-nums" value="${escapeHtml(shopFilters.maxPrice)}" placeholder="25000" />
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Size</label>
            <select id="f-size" class="form-select">
              <option value="All">Any Size</option>
              ${sizes
                .map(
                  (s) => `<option value="${escapeHtml(s)}" ${shopFilters.size === s ? 'selected' : ''}>${escapeHtml(s)}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Color</label>
            <select id="f-color" class="form-select">
              <option value="All">Any Color</option>
              ${colors
                .map(
                  (c) => `<option value="${escapeHtml(c)}" ${shopFilters.color === c ? 'selected' : ''}>${escapeHtml(c)}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Minimum Rating</label>
          <select id="f-rating" class="form-select">
            <option value="0" ${shopFilters.minRating === 0 ? 'selected' : ''}>All Ratings</option>
            <option value="4" ${shopFilters.minRating === 4 ? 'selected' : ''}>4.0+ Stars</option>
            <option value="4.5" ${shopFilters.minRating === 4.5 ? 'selected' : ''}>4.5+ Stars</option>
          </select>
        </div>

        <div class="stack-sm">
          <label class="checkbox-row">
            <input type="checkbox" id="f-instock" ${shopFilters.inStockOnly ? 'checked' : ''} />
            <span>In Stock Only</span>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" id="f-deals" ${shopFilters.dealsOnly ? 'checked' : ''} />
            <span>Discounted Items Only</span>
          </label>
        </div>
      </aside>

      <!-- Product Listing Area -->
      <div class="stack-md">
        <div class="flex-between" style="background:var(--gray-bg);padding:12px 16px;border-radius:10px;border:1px solid var(--border);">
          <span style="font-size:13.5px;font-weight:700;" class="tabular-nums">
            Showing ${filtered.length} ${filtered.length === 1 ? 'product' : 'products'}
          </span>

          <div class="flex-row">
            <label for="f-sort" style="font-size:12.5px;font-weight:700;">Sort by:</label>
            <select id="f-sort" class="form-select" style="height:36px;width:auto;">
              <option value="newest" ${shopFilters.sortBy === 'newest' ? 'selected' : ''}>Newest Arrivals</option>
              <option value="popular" ${shopFilters.sortBy === 'popular' ? 'selected' : ''}>Most Popular</option>
              <option value="price-asc" ${shopFilters.sortBy === 'price-asc' ? 'selected' : ''}>Price: Low to High</option>
              <option value="price-desc" ${shopFilters.sortBy === 'price-desc' ? 'selected' : ''}>Price: High to Low</option>
              <option value="rating" ${shopFilters.sortBy === 'rating' ? 'selected' : ''}>Highest Rated</option>
            </select>
          </div>
        </div>

        ${
          filtered.length === 0
            ? `
          <div class="empty-box">
            <h3 style="font-size:18px;font-weight:800;">No Matching Gear Found</h3>
            <p class="text-muted" style="margin:8px 0 18px;font-size:14px;">Try clearing one or more filters to view all available motorcycle gear.</p>
            <button type="button" class="btn btn-red" id="empty-reset-btn">Clear All Filters</button>
          </div>
        `
            : `<div class="product-grid-3">${filtered.map((p) => renderProductCard(p)).join('')}</div>`
        }
      </div>
    </div>
  `;
}

export function bindShopPageEvents(rerenderFn) {
  const bindChange = (id, key, transform = (v) => v) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      shopFilters[key] = transform(el.type === 'checkbox' ? el.checked : el.value);
      rerenderFn();
    });
  };

  document.getElementById('f-q')?.addEventListener('change', (e) => {
    shopFilters.q = e.target.value;
    rerenderFn();
  });

  bindChange('f-category', 'category');
  bindChange('f-brand', 'brand');
  bindChange('f-size', 'size');
  bindChange('f-color', 'color');
  bindChange('f-min', 'minPrice');
  bindChange('f-max', 'maxPrice');
  bindChange('f-rating', 'minRating', Number);
  bindChange('f-instock', 'inStockOnly', Boolean);
  bindChange('f-deals', 'dealsOnly', Boolean);
  bindChange('f-sort', 'sortBy');

  const resetAll = () => {
    shopFilters.q = '';
    shopFilters.category = 'All';
    shopFilters.brand = 'All';
    shopFilters.size = 'All';
    shopFilters.color = 'All';
    shopFilters.minPrice = '';
    shopFilters.maxPrice = '';
    shopFilters.inStockOnly = false;
    shopFilters.dealsOnly = false;
    shopFilters.minRating = 0;
    shopFilters.sortBy = 'newest';
    rerenderFn();
  };

  document.getElementById('shop-reset-btn')?.addEventListener('click', resetAll);
  document.getElementById('empty-reset-btn')?.addEventListener('click', resetAll);
}

// ============================================================================
// CATEGORIES PAGE
// ============================================================================
export function renderCategoriesPage() {
  const activeCategories = store.categories.filter((c) => c.is_active);
  return `
    <div class="page-banner">
      <div class="container">
        <h1 style="font-size:clamp(1.7rem,3vw,2.25rem);font-weight:800;">Shop By Category</h1>
        <p class="text-muted" style="font-size:14.5px;margin-top:4px;">
          Browse helmets, riding jackets, gloves, boots, bike covers, protection gear, and motorcycle accessories.
        </p>
      </div>
    </div>

    <div class="container" style="padding-top:40px;padding-bottom:64px;">
      <div class="features-grid-3">
        ${activeCategories
          .map((cat) => {
            const count = store.products.filter((p) => p.category_name === cat.name).length;
            return `
              <div class="product-card">
                <div style="aspect-ratio:16/10;padding:24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:center;background:#fff;">
                  <img
                    src="${escapeHtml(cat.image_url)}"
                    alt="${escapeHtml(cat.name)}"
                    style="max-height:150px;object-fit:contain;"
                    onerror="this.src='/images/products/helmet-pro.jpg'"
                  />
                </div>
                <div style="padding:22px;display:flex;flex-direction:column;gap:10px;flex:1;">
                  <div class="flex-between">
                    <h2 style="font-size:19px;font-weight:800;">${escapeHtml(cat.name)}</h2>
                    <span class="badge badge-gray tabular-nums">${count} ${count === 1 ? 'item' : 'items'}</span>
                  </div>
                  <p class="text-muted" style="font-size:13.5px;flex:1;">${escapeHtml(cat.short_description)}</p>
                  <div>
                    <a href="/shop?category=${encodeURIComponent(cat.name)}" data-link class="btn btn-red">
                      <span>View Products</span>
                      ${icon('arrowRight', 15)}
                    </a>
                  </div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}

// ============================================================================
// PRODUCT DETAIL PAGE
// ============================================================================
let pdpState = {
  slug: '',
  imgIndex: 0,
  size: '',
  color: '',
  qty: 1,
};

export function renderProductDetailPage(slug) {
  const product = store.products.find((p) => p.slug === slug || p.id === slug);
  if (!product) {
    return `
      <div class="container" style="padding:72px 16px;text-align:center;">
        <h1 style="font-size:26px;font-weight:800;">Product Not Found</h1>
        <p class="text-muted" style="margin:10px 0 22px;">This motorcycle gear item could not be found.</p>
        <a href="/shop" data-link class="btn btn-red">Browse All Gear</a>
      </div>
    `;
  }

  if (pdpState.slug !== product.slug) {
    pdpState = {
      slug: product.slug,
      imgIndex: 0,
      size: product.sizes?.[0] || '',
      color: product.colors?.[0] || '',
      qty: 1,
    };
  }

  const effective = getEffectivePrice(product);
  const discountPct = getDiscountPercent(product);
  const outOfStock = product.availability === 'out_of_stock' || Number(product.stock) <= 0;
  const wishlisted = isWishlisted(product.id);
  const images = product.images?.length ? product.images : ['/images/products/helmet-pro.jpg'];
  const activeImg = images[pdpState.imgIndex] || images[0];
  const specs = Object.entries(product.specifications || {});
  const related = store.products
    .filter((p) => p.category_name === product.category_name && p.id !== product.id)
    .slice(0, 4);

  const waOrderUrl = buildSingleProductWhatsAppUrl(
    product,
    pdpState.size,
    pdpState.color,
    pdpState.qty,
    store.siteSettings.whatsapp_number
  );

  return `
    <div class="container" style="padding-top:20px;padding-bottom:64px;">
      <nav style="font-size:12.5px;margin-bottom:12px;" class="text-muted">
        <a href="/" data-link>Home</a> &rsaquo;
        <a href="/shop" data-link>Shop</a> &rsaquo;
        <a href="/shop?category=${encodeURIComponent(product.category_name)}" data-link>${escapeHtml(product.category_name)}</a> &rsaquo;
        <strong style="color:var(--black);">${escapeHtml(product.name)}</strong>
      </nav>

      <div class="pdp-grid">
        <!-- Left Gallery -->
        <div>
          <div class="pdp-main-img-wrap">
            <img src="${escapeHtml(activeImg)}" alt="${escapeHtml(product.name)}" onerror="this.src='/images/products/helmet-pro.jpg'" />
          </div>
          ${
            images.length > 1
              ? `
            <div class="pdp-thumbs">
              ${images
                .map(
                  (img, idx) => `
                <button type="button" class="pdp-thumb-btn ${idx === pdpState.imgIndex ? 'active' : ''}" data-pdp-img="${idx}">
                  <img src="${escapeHtml(img)}" alt="Thumbnail ${idx + 1}" />
                </button>
              `
                )
                .join('')}
            </div>
          `
              : ''
          }
        </div>

        <!-- Right Details -->
        <div class="stack-md">
          <div class="flex-between">
            <span class="badge badge-gray">${escapeHtml(product.brand)} &middot; ${escapeHtml(product.category_name)}</span>
            <span class="font-mono text-muted" style="font-size:12.5px;">SKU: ${escapeHtml(product.sku)}</span>
          </div>

          <h1 style="font-size:clamp(1.6rem,2.8vw,2.15rem);font-weight:800;line-height:1.2;">${escapeHtml(product.name)}</h1>

          <div class="flex-row tabular-nums" style="gap:12px;">
            ${renderStars(product.rating, 15)}
            <span style="font-size:13.5px;font-weight:700;">${Number(product.rating || 4.5).toFixed(1)} (${Number(product.review_count || 0)} reviews)</span>
            <span>&middot;</span>
            ${
              outOfStock
                ? '<span class="badge badge-red">Out of Stock</span>'
                : product.availability === 'low_stock'
                  ? `<span class="badge badge-amber">Low Stock (${product.stock} left)</span>`
                  : `<span class="badge badge-green">In Stock (${product.stock} available)</span>`
            }
          </div>

          <div class="flex-row tabular-nums" style="align-items:baseline;gap:12px;padding:12px 16px;background:var(--gray-bg);border-radius:10px;">
            <span style="font-size:28px;font-weight:800;color:var(--red);">${formatPKR(effective)}</span>
            ${
              discountPct > 0
                ? `<span style="font-size:16px;text-decoration:line-through;" class="text-subtle">${formatPKR(product.price)}</span>
                   <span class="badge badge-red">Save ${discountPct}%</span>`
                : ''
            }
          </div>

          <p class="text-muted" style="font-size:14.5px;line-height:1.65;">${escapeHtml(product.description || product.short_description)}</p>

          ${
            product.sizes?.length
              ? `
            <div class="stack-sm">
              <label class="form-label">Select Size: <span class="text-red">${escapeHtml(pdpState.size)}</span></label>
              <div class="option-chips">
                ${product.sizes
                  .map(
                    (sz) => `
                  <button type="button" class="option-chip ${pdpState.size === sz ? 'active' : ''}" data-pdp-size="${escapeHtml(sz)}">${escapeHtml(sz)}</button>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
              : ''
          }

          ${
            product.colors?.length
              ? `
            <div class="stack-sm">
              <label class="form-label">Select Color: <span class="text-red">${escapeHtml(pdpState.color)}</span></label>
              <div class="option-chips">
                ${product.colors
                  .map(
                    (clr) => `
                  <button type="button" class="option-chip ${pdpState.color === clr ? 'active' : ''}" data-pdp-color="${escapeHtml(clr)}">${escapeHtml(clr)}</button>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
              : ''
          }

          <div class="flex-row" style="flex-wrap:wrap;gap:12px;padding-top:6px;">
            <div class="qty-control">
              <button type="button" id="pdp-qty-dec">-</button>
              <span class="tabular-nums">${pdpState.qty}</span>
              <button type="button" id="pdp-qty-inc">+</button>
            </div>

            <button type="button" class="btn btn-lg btn-red" id="pdp-add-cart" ${outOfStock ? 'disabled' : ''} style="flex:1;min-width:170px;">
              ${icon('cart', 18)}
              <span>${outOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
            </button>

            <button type="button" class="btn btn-lg btn-black" id="pdp-buy-now" ${outOfStock ? 'disabled' : ''}>
              <span>Buy Now</span>
            </button>

            <button type="button" class="btn btn-lg btn-outline" id="pdp-wishlist-btn" aria-label="Save to wishlist">
              ${wishlisted ? icon('heartFill', 18) : icon('heart', 18)}
            </button>
          </div>

          <a
            href="${waOrderUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-lg btn-whatsapp btn-block"
          >
            ${icon('whatsapp', 19)}
            <span>Order This Item via WhatsApp (${escapeHtml(store.siteSettings.whatsapp_number)})</span>
          </a>
        </div>
      </div>

      <!-- Specifications Table -->
      ${
        specs.length > 0
          ? `
        <div style="margin-top:32px;" class="table-card">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border);">
            <h2 style="font-size:18px;font-weight:800;">Product Specifications</h2>
          </div>
          <table class="spec-table">
            <tbody>
              ${specs
                .map(
                  ([k, v]) => `
                <tr>
                  <th>${escapeHtml(k)}</th>
                  <td>${escapeHtml(v)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `
          : ''
      }

      <!-- Related Products -->
      ${
        related.length > 0
          ? `
        <div style="margin-top:52px;">
          <div class="section-header">
            <h2 class="section-title">Related ${escapeHtml(product.category_name)}</h2>
            <a href="/shop?category=${encodeURIComponent(product.category_name)}" data-link class="section-link">
              <span>View More</span>
              ${icon('arrowRight', 15)}
            </a>
          </div>
          <div class="product-grid">
            ${related.map((p) => renderProductCard(p)).join('')}
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;
}

export function bindProductDetailEvents(slug, rerenderFn, navigateFn) {
  const product = store.products.find((p) => p.slug === slug || p.id === slug);
  if (!product) return;

  document.querySelectorAll('[data-pdp-img]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pdpState.imgIndex = Number(btn.getAttribute('data-pdp-img') || 0);
      rerenderFn();
    });
  });

  document.querySelectorAll('[data-pdp-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pdpState.size = btn.getAttribute('data-pdp-size') || '';
      rerenderFn();
    });
  });

  document.querySelectorAll('[data-pdp-color]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pdpState.color = btn.getAttribute('data-pdp-color') || '';
      rerenderFn();
    });
  });

  document.getElementById('pdp-qty-dec')?.addEventListener('click', () => {
    pdpState.qty = Math.max(1, pdpState.qty - 1);
    rerenderFn();
  });

  document.getElementById('pdp-qty-inc')?.addEventListener('click', () => {
    pdpState.qty = Math.min(Math.max(1, Number(product.stock || 99)), pdpState.qty + 1);
    rerenderFn();
  });

  document.getElementById('pdp-add-cart')?.addEventListener('click', () => {
    addToCart(product, pdpState.qty, pdpState.size, pdpState.color, true);
  });

  document.getElementById('pdp-buy-now')?.addEventListener('click', () => {
    addToCart(product, pdpState.qty, pdpState.size, pdpState.color, false);
    navigateFn('/checkout');
  });

  document.getElementById('pdp-wishlist-btn')?.addEventListener('click', async () => {
    await handleToggleWishlist(product.id);
    rerenderFn();
  });
}

// ============================================================================
// WISHLIST PAGE
// ============================================================================
export function renderWishlistPage() {
  const savedProducts = store.products.filter((p) => store.wishlistIds.includes(p.id));
  return `
    <div class="page-banner">
      <div class="container">
        <h1 style="font-size:clamp(1.65rem,3vw,2.2rem);font-weight:800;">Saved Wishlist (${savedProducts.length})</h1>
        <p class="text-muted" style="font-size:14px;margin-top:4px;">Keep track of your favorite motorcycle helmets, jackets, and riding gear.</p>
      </div>
    </div>

    <div class="container" style="padding-top:36px;padding-bottom:64px;">
      ${
        savedProducts.length === 0
          ? `
        <div class="empty-box">
          <h2 style="font-size:19px;font-weight:800;">Your Wishlist Is Empty</h2>
          <p class="text-muted" style="margin:8px 0 20px;">Tap the heart icon on any product card to save gear here.</p>
          <a href="/shop" data-link class="btn btn-red">Explore Motorcycle Gear</a>
        </div>
      `
          : `<div class="product-grid">${savedProducts.map((p) => renderProductCard(p)).join('')}</div>`
      }
    </div>
  `;
}
