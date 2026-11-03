import { DEFAULT_SITE_SETTINGS, ORDER_STATUSES } from '../data.js';
import {
  deleteCategoryById,
  deleteCouponById,
  deleteDiscountById,
  deleteProductById,
  deleteReviewById,
  fetchAllCustomersForAdmin,
  fetchAllOrdersForAdmin,
  fetchReviews,
  saveCategory,
  saveCoupon,
  saveDiscount,
  saveProduct,
  signOutCurrentUser,
  updateOrderStatus,
  updateReviewApproval,
  updateSiteSettings,
  uploadImageToSupabase,
  uploadMultipleImagesToSupabase,
} from '../services.js';
import {
  closeModalRoot,
  openConfirmModal,
  refreshStoreData,
  showToast,
  store,
} from '../state.js';
import {
  buildWhatsAppUrl,
  escapeHtml,
  formatDateShort,
  formatPKR,
  generateSku,
  getDiscountPercent,
  getEffectivePrice,
  icon,
  renderStars,
  slugify,
} from '../utils.js';

const ADMIN_NAV = [
  { label: 'Overview', to: '/admin' },
  { label: 'Products', to: '/admin/products' },
  { label: 'Categories', to: '/admin/categories' },
  { label: 'Orders', to: '/admin/orders' },
  { label: 'Customers', to: '/admin/customers' },
  { label: 'Coupons', to: '/admin/coupons' },
  { label: 'Discounts', to: '/admin/discounts' },
  { label: 'Reviews', to: '/admin/reviews' },
  { label: 'Inventory', to: '/admin/inventory' },
  { label: 'Site Settings', to: '/admin/settings' },
];

let adminOrders = [];
let adminCustomers = [];
let adminAllReviews = [];
let adminMobileSidebar = false;
let prodSearch = '';
let orderStatusFilter = 'All';
let invFilter = 'all';

export async function loadAdminDatasets() {
  if (!store.isAdmin) return;
  try {
    const [ords, custs, revs] = await Promise.all([
      fetchAllOrdersForAdmin(),
      fetchAllCustomersForAdmin(),
      fetchReviews(true),
    ]);
    adminOrders = ords;
    adminCustomers = custs;
    adminAllReviews = revs;
  } catch (err) {
    console.error('Admin dataset load error:', err);
  }
}

export function renderAdminShell(subRoute = '/admin') {
  if (store.authLoading) {
    return `<div style="min-height:80vh;display:flex;align-items:center;justify-content:center;"><p class="text-muted">Verifying administrator privileges...</p></div>`;
  }

  if (!store.firebaseUser) {
    return `
      <div style="min-height:80vh;background:var(--gray-bg);display:flex;align-items:center;justify-content:center;padding:24px;">
        <div class="card-panel stack-md" style="max-width:440px;text-align:center;">
          <h1 style="font-size:21px;font-weight:800;">Administrator Sign-In Required</h1>
          <p class="text-muted" style="font-size:13.5px;">Sign in with an authorized Rock Danish Biker Stuff owner account to access store administration.</p>
          <a href="/login" data-link class="btn btn-red btn-block">Sign In</a>
          <a href="/" data-link class="btn btn-outline btn-block">Return to Storefront</a>
        </div>
      </div>
    `;
  }

  if (!store.isAdmin) {
    return `
      <div style="min-height:80vh;background:var(--gray-bg);display:flex;align-items:center;justify-content:center;padding:24px;">
        <div class="card-panel stack-md" style="max-width:460px;text-align:center;">
          <div class="icon-box-red" style="margin:0 auto;">${icon('shield', 22)}</div>
          <h1 style="font-size:21px;font-weight:800;">Restricted Store Owner Area</h1>
          <p class="text-muted" style="font-size:13.5px;">
            You are signed in as <strong>${escapeHtml(store.profile?.email || store.firebaseUser.email)}</strong>, which is a standard customer account. Only authorized owner accounts can access the Admin Dashboard.
          </p>
          <div class="grid-2">
            <a href="/account" data-link class="btn btn-black">My Account</a>
            <a href="/" data-link class="btn btn-outline">Back to Store</a>
          </div>
        </div>
      </div>
    `;
  }

  const navHtml = ADMIN_NAV.map(
    (item) => `
      <a href="${item.to}" data-link class="admin-nav-link ${subRoute === item.to ? 'active' : ''}">
        <span>${escapeHtml(item.label)}</span>
      </a>
    `
  ).join('');

  return `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div style="padding:18px;border-bottom:1px solid var(--border);">
          <a href="/admin" data-link>
            <img src="/images/logo-on-white.png" alt="Rock Danish Admin" style="height:44px;width:auto;" />
          </a>
        </div>
        <div style="padding:10px 16px;background:var(--gray-bg);border-bottom:1px solid var(--border);">
          <div style="font-size:11px;color:var(--text-subtle);font-weight:600;">Authorized Owner</div>
          <div style="font-size:12px;font-weight:800;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(store.profile?.email || store.firebaseUser.email)}</div>
        </div>
        <nav class="admin-nav">${navHtml}</nav>
        <div style="padding:12px;border-top:1px solid var(--border);" class="stack-sm">
          <a href="/" data-link class="btn btn-outline btn-sm btn-block">View Live Store ${icon('external', 13)}</a>
          <button type="button" id="admin-logout-btn" class="btn btn-red btn-sm btn-block">${icon('logout', 14)} Logout</button>
        </div>
      </aside>

      ${
        adminMobileSidebar
          ? `
        <div class="backdrop-overlay backdrop-left" id="admin-mobile-backdrop">
          <div class="drawer-panel" style="max-width:270px;">
            <div class="drawer-header">
              <strong>Admin Menu</strong>
              <button type="button" class="btn btn-ghost btn-sm" id="close-admin-mobile">${icon('x', 18)}</button>
            </div>
            <div class="drawer-body stack-sm">${navHtml}</div>
          </div>
        </div>
      `
          : ''
      }

      <div class="admin-main-col">
        <header class="admin-topbar">
          <div class="flex-row">
            <button type="button" class="btn btn-ghost btn-sm mobile-only" id="open-admin-mobile">${icon('menu', 20)}</button>
            <strong style="font-size:16px;font-weight:800;">Rock Danish Store Administration</strong>
          </div>
          <a href="/" data-link class="btn btn-sm btn-outline">Storefront ${icon('external', 13)}</a>
        </header>

        <main class="admin-content">
          ${renderAdminSectionContent(subRoute)}
        </main>
      </div>
    </div>
  `;
}

function renderAdminSectionContent(subRoute) {
  switch (subRoute) {
    case '/admin/products':
      return renderAdminProducts();
    case '/admin/categories':
      return renderAdminCategories();
    case '/admin/orders':
      return renderAdminOrders();
    case '/admin/customers':
      return renderAdminCustomers();
    case '/admin/coupons':
      return renderAdminCoupons();
    case '/admin/discounts':
      return renderAdminDiscounts();
    case '/admin/reviews':
      return renderAdminReviews();
    case '/admin/inventory':
      return renderAdminInventory();
    case '/admin/settings':
      return renderAdminSettings();
    default:
      return renderAdminOverview();
  }
}

// ----------------------------------------------------------------------------
// MODULE 1: OVERVIEW
// ----------------------------------------------------------------------------
function renderAdminOverview() {
  const revenue = adminOrders
    .filter((o) => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const lowStock = store.products.filter((p) => Number(p.stock) <= 5);

  return `
    <div class="stack-lg">
      <div>
        <h2 style="font-size:24px;font-weight:800;">Dashboard Overview</h2>
        <p class="text-muted" style="font-size:13.5px;">Live summary of Rock Danish Biker Stuff catalog, orders, and inventory.</p>
      </div>

      ${
        store.usingSampleCatalog
          ? `<div style="padding:14px 18px;border-radius:10px;background:var(--amber-soft);border:1px solid #FDE68A;font-size:13.5px;color:#92400E;">
              <strong>Sample Catalog Active:</strong> The storefront is displaying starter sample items until you add your first live product under <a href="/admin/products" data-link style="text-decoration:underline;font-weight:700;">Products</a>.
            </div>`
          : ''
      }

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Recorded Order Value</div>
          <div class="kpi-value tabular-nums">${formatPKR(revenue)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Orders</div>
          <div class="kpi-value tabular-nums">${adminOrders.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Catalog SKUs</div>
          <div class="kpi-value tabular-nums">${store.products.length}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Low / Out-of-Stock</div>
          <div class="kpi-value tabular-nums" style="color:var(--red);">${lowStock.length}</div>
        </div>
      </div>

      <div class="table-card">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);" class="flex-between">
          <h3 style="font-size:16px;font-weight:800;">Recent Orders</h3>
          <a href="/admin/orders" data-link class="section-link">Manage All Orders &rarr;</a>
        </div>
        ${
          adminOrders.length === 0
            ? `<div style="padding:32px;text-align:center;" class="text-muted">No orders recorded yet.</div>`
            : `<div class="table-scroll">
                <table class="data-table">
                  <thead>
                    <tr><th>Order ID</th><th>Customer</th><th>City</th><th>Total</th><th>Status</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    ${adminOrders
                      .slice(0, 6)
                      .map(
                        (o) => `
                      <tr>
                        <td class="font-mono" style="font-weight:700;">${escapeHtml(o.order_number)}</td>
                        <td>${escapeHtml(o.customer_name)}</td>
                        <td>${escapeHtml(o.city || 'Karachi')}</td>
                        <td class="tabular-nums" style="font-weight:700;">${formatPKR(o.total)}</td>
                        <td><span class="badge badge-red">${escapeHtml(o.status)}</span></td>
                        <td class="tabular-nums text-subtle">${formatDateShort(o.created_at)}</td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// MODULE 2: PRODUCTS
// ----------------------------------------------------------------------------
function renderAdminProducts() {
  const q = prodSearch.trim().toLowerCase();
  const list = store.products.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category_name.toLowerCase().includes(q)
  );

  return `
    <div class="stack-md">
      <div class="flex-between">
        <div>
          <h2 style="font-size:24px;font-weight:800;">Product Management</h2>
          <p class="text-muted" style="font-size:13.5px;">Add, edit, duplicate, or delete products and upload gallery images to Supabase Storage.</p>
        </div>
        <button type="button" class="btn btn-red" id="adm-new-prod-btn">${icon('plus', 16)} Add Product</button>
      </div>

      <div class="card-panel" style="padding:14px;">
        <input type="search" id="adm-prod-search" class="form-input" placeholder="Search by product name, SKU, or category..." value="${escapeHtml(prodSearch)}" />
      </div>

      <div class="table-card">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th class="text-right">Actions</th></tr>
            </thead>
            <tbody>
              ${list
                .map(
                  (p) => `
                <tr>
                  <td>
                    <div class="flex-row">
                      <img src="${escapeHtml(p.images?.[0] || '/images/products/helmet-pro.jpg')}" alt="" style="width:42px;height:42px;object-fit:contain;border:1px solid var(--border);border-radius:6px;padding:2px;" />
                      <div>
                        <strong>${escapeHtml(p.name)}</strong>
                        <div class="font-mono text-subtle" style="font-size:11.5px;">${escapeHtml(p.sku)}</div>
                      </div>
                    </div>
                  </td>
                  <td>${escapeHtml(p.category_name)}</td>
                  <td class="tabular-nums">
                    <strong style="color:var(--red);">${formatPKR(getEffectivePrice(p))}</strong>
                    ${p.sale_price ? `<div class="text-subtle" style="font-size:11px;text-decoration:line-through;">${formatPKR(p.price)}</div>` : ''}
                  </td>
                  <td class="tabular-nums">${p.stock} (${escapeHtml(p.availability)})</td>
                  <td class="text-right">
                    <button type="button" class="btn btn-ghost btn-sm" data-edit-prod="${escapeHtml(p.id)}" title="Edit">${icon('edit', 15)}</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-dup-prod="${escapeHtml(p.id)}" title="Duplicate">${icon('copy', 15)}</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-del-prod="${escapeHtml(p.id)}" title="Delete" style="color:var(--red);">${icon('trash', 15)}</button>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// MODULE 3: CATEGORIES
// ----------------------------------------------------------------------------
function renderAdminCategories() {
  return `
    <div class="stack-md">
      <div class="flex-between">
        <div>
          <h2 style="font-size:24px;font-weight:800;">Category Management</h2>
          <p class="text-muted" style="font-size:13.5px;">Create, reorder, and upload category images via Supabase Storage.</p>
        </div>
        <button type="button" class="btn btn-red" id="adm-new-cat-btn">${icon('plus', 16)} Add Category</button>
      </div>

      <div class="features-grid-3">
        ${store.categories
          .map(
            (cat) => `
          <div class="card-panel stack-sm">
            <div class="flex-between">
              <img src="${escapeHtml(cat.image_url)}" alt="${escapeHtml(cat.name)}" style="width:56px;height:56px;object-fit:contain;border:1px solid var(--border);border-radius:8px;padding:4px;" />
              <span class="badge ${cat.is_active ? 'badge-green' : 'badge-gray'}">${cat.is_active ? 'Active' : 'Hidden'}</span>
            </div>
            <strong style="font-size:16px;">${escapeHtml(cat.name)}</strong>
            <p class="text-muted" style="font-size:12.5px;">${escapeHtml(cat.short_description)}</p>
            <div class="flex-between" style="padding-top:8px;border-top:1px solid var(--border);">
              <span class="text-subtle tabular-nums" style="font-size:12px;">Order #${cat.display_order}</span>
              <div>
                <button type="button" class="btn btn-ghost btn-sm" data-edit-cat="${escapeHtml(cat.id)}">${icon('edit', 15)}</button>
                <button type="button" class="btn btn-ghost btn-sm" data-del-cat="${escapeHtml(cat.id)}" style="color:var(--red);">${icon('trash', 15)}</button>
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// MODULE 4: ORDERS
// ----------------------------------------------------------------------------
function renderAdminOrders() {
  const filtered = adminOrders.filter(
    (o) => orderStatusFilter === 'All' || o.status === orderStatusFilter
  );

  return `
    <div class="stack-md">
      <div class="flex-between">
        <div>
          <h2 style="font-size:24px;font-weight:800;">Order Management</h2>
          <p class="text-muted" style="font-size:13.5px;">Inspect customer WhatsApp orders and update fulfillment status.</p>
        </div>
        <select id="adm-order-filter" class="form-select" style="width:auto;">
          <option value="All">All Statuses (${adminOrders.length})</option>
          ${ORDER_STATUSES.map(
            (st) => `<option value="${st}" ${orderStatusFilter === st ? 'selected' : ''}>${st}</option>`
          ).join('')}
        </select>
      </div>

      <div class="table-card">
        ${
          filtered.length === 0
            ? `<div style="padding:36px;text-align:center;" class="text-muted">No orders match this status.</div>`
            : `<div class="table-scroll">
                <table class="data-table">
                  <thead>
                    <tr><th>Order No</th><th>Customer</th><th>Phone / City</th><th>Total</th><th>Status</th><th class="text-right">Contact</th></tr>
                  </thead>
                  <tbody>
                    ${filtered
                      .map((o) => {
                        const waCustomer = buildWhatsAppUrl(
                          `Hello ${o.customer_name}, your Rock Danish Biker Stuff order ${o.order_number} status is currently: ${o.status}.`,
                          o.whatsapp || o.phone
                        );
                        return `
                          <tr>
                            <td>
                              <strong class="font-mono">${escapeHtml(o.order_number)}</strong>
                              <div class="text-subtle" style="font-size:11.5px;">${formatDateShort(o.created_at)}</div>
                            </td>
                            <td>
                              <strong>${escapeHtml(o.customer_name)}</strong>
                              <div class="text-subtle" style="font-size:11.5px;">${escapeHtml(o.delivery_address)}</div>
                            </td>
                            <td class="tabular-nums">${escapeHtml(o.phone)}<div class="text-subtle" style="font-size:11.5px;">${escapeHtml(o.city || 'Karachi')}</div></td>
                            <td class="tabular-nums" style="font-weight:800;color:var(--red);">${formatPKR(o.total)}</td>
                            <td>
                              <select class="form-select" style="height:34px;font-size:12.5px;width:155px;" data-ord-status="${escapeHtml(o.id)}">
                                ${ORDER_STATUSES.map(
                                  (st) => `<option value="${st}" ${o.status === st ? 'selected' : ''}>${st}</option>`
                                ).join('')}
                              </select>
                            </td>
                            <td class="text-right">
                              <a href="${waCustomer}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-whatsapp">${icon('whatsapp', 14)} WhatsApp</a>
                            </td>
                          </tr>
                        `;
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// MODULE 5: CUSTOMERS
// ----------------------------------------------------------------------------
function renderAdminCustomers() {
  return `
    <div class="stack-md">
      <div>
        <h2 style="font-size:24px;font-weight:800;">Registered Customers</h2>
        <p class="text-muted" style="font-size:13.5px;">Accounts registered via Firebase Authentication and synced to Supabase profiles.</p>
      </div>

      <div class="table-card">
        ${
          adminCustomers.length === 0
            ? `<div style="padding:36px;text-align:center;" class="text-muted">No customer profiles synced yet.</div>`
            : `<div class="table-scroll">
                <table class="data-table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Phone / WhatsApp</th><th>City</th><th>Role</th></tr>
                  </thead>
                  <tbody>
                    ${adminCustomers
                      .map(
                        (c) => `
                      <tr>
                        <td><strong>${escapeHtml(c.full_name || 'Rider')}</strong></td>
                        <td>${escapeHtml(c.email)}</td>
                        <td class="tabular-nums">${escapeHtml(c.phone || c.whatsapp || '—')}</td>
                        <td>${escapeHtml(c.city || 'Karachi')}</td>
                        <td><span class="badge ${c.role === 'admin' ? 'badge-red' : 'badge-gray'}">${escapeHtml(c.role)}</span></td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// MODULE 6: COUPONS
// ----------------------------------------------------------------------------
function renderAdminCoupons() {
  return `
    <div class="stack-md">
      <div class="flex-between">
        <div>
          <h2 style="font-size:24px;font-weight:800;">Coupon Management</h2>
          <p class="text-muted" style="font-size:13.5px;">Create percentage or fixed PKR checkout codes. No coupons are active unless enabled here.</p>
        </div>
        <button type="button" class="btn btn-red" id="adm-new-cpn-btn">${icon('plus', 16)} Create Coupon</button>
      </div>

      ${
        store.coupons.length === 0
          ? `<div class="empty-box"><p style="font-weight:700;">No Coupons Created Yet</p><p class="text-muted" style="font-size:13px;margin-top:4px;">Click &ldquo;Create Coupon&rdquo; to add promotional codes like RIDE10.</p></div>`
          : `<div class="table-card">
              <div class="table-scroll">
                <table class="data-table">
                  <thead>
                    <tr><th>Code</th><th>Discount</th><th>Min. Order</th><th>Status</th><th class="text-right">Actions</th></tr>
                  </thead>
                  <tbody>
                    ${store.coupons
                      .map(
                        (c) => `
                      <tr>
                        <td><span class="badge badge-gray font-mono">${escapeHtml(c.code)}</span></td>
                        <td class="tabular-nums" style="font-weight:800;color:var(--red);">
                          ${c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `${formatPKR(c.discount_value)} OFF`}
                        </td>
                        <td class="tabular-nums">${c.min_order_amount > 0 ? formatPKR(c.min_order_amount) : 'None'}</td>
                        <td>
                          <button type="button" class="badge ${c.is_active ? 'badge-green' : 'badge-gray'}" data-toggle-cpn="${escapeHtml(c.id)}">
                            ${c.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td class="text-right">
                          <button type="button" class="btn btn-ghost btn-sm" data-del-cpn="${escapeHtml(c.id)}" style="color:var(--red);">${icon('trash', 15)}</button>
                        </td>
                      </tr>
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>`
      }
    </div>
  `;
}

// ----------------------------------------------------------------------------
// MODULE 7: DISCOUNTS & SALE PRICING
// ----------------------------------------------------------------------------
function renderAdminDiscounts() {
  return `
    <div class="stack-lg">
      <div class="flex-between">
        <div>
          <h2 style="font-size:24px;font-weight:800;">Discounts &amp; Sale Pricing</h2>
          <p class="text-muted" style="font-size:13.5px;">Create deal campaigns or quickly adjust product markdown prices.</p>
        </div>
        <button type="button" class="btn btn-red" id="adm-new-dsc-btn">${icon('plus', 16)} New Deal Campaign</button>
      </div>

      ${
        store.discounts.length > 0
          ? `<div class="grid-2">
              ${store.discounts
                .map(
                  (d) => `
                <div class="card-panel flex-between">
                  <div>
                    <span class="badge badge-red">${d.discount_percentage}% OFF</span>
                    <strong style="display:block;margin-top:6px;">${escapeHtml(d.title)}</strong>
                    <span class="text-muted" style="font-size:12.5px;">${escapeHtml(d.description || '')}</span>
                  </div>
                  <button type="button" class="btn btn-ghost btn-sm" data-del-dsc="${escapeHtml(d.id)}" style="color:var(--red);">${icon('trash', 15)}</button>
                </div>
              `
                )
                .join('')}
            </div>`
          : ''
      }

      <div class="table-card">
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);">
          <strong>Quick Product Sale Price Control</strong>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr><th>Product</th><th>Regular PKR</th><th>Sale Price PKR</th><th>Discount</th><th class="text-right">Apply</th></tr>
            </thead>
            <tbody>
              ${store.products
                .map((p) => {
                  const pct = getDiscountPercent(p);
                  return `
                    <tr>
                      <td><strong>${escapeHtml(p.name)}</strong></td>
                      <td class="tabular-nums">${formatPKR(p.price)}</td>
                      <td>
                        <input type="number" class="form-input tabular-nums" style="height:34px;width:130px;" id="sale-inp-${escapeHtml(p.id)}" value="${p.sale_price || ''}" placeholder="No sale" />
                      </td>
                      <td>${pct > 0 ? `<span class="badge badge-red">-${pct}%</span>` : '<span class="text-subtle">0%</span>'}</td>
                      <td class="text-right">
                        <button type="button" class="btn btn-sm btn-black" data-save-sale="${escapeHtml(p.id)}">Update</button>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// MODULE 8: REVIEWS MODERATION
// ----------------------------------------------------------------------------
function renderAdminReviews() {
  return `
    <div class="stack-md">
      <div>
        <h2 style="font-size:24px;font-weight:800;">Customer Reviews Moderation</h2>
        <p class="text-muted" style="font-size:13.5px;">Genuine Google Business reviews (read-only) + website customer reviews.</p>
      </div>

      <div class="stack-sm">
        ${adminAllReviews
          .map(
            (r) => `
          <div class="card-panel flex-between">
            <div class="stack-sm" style="max-width:720px;">
              <div class="flex-row">
                ${renderStars(r.rating, 14)}
                <strong>${escapeHtml(r.reviewer_name)}</strong>
                <span class="badge ${r.source === 'Google' ? 'badge-gray' : r.is_approved ? 'badge-green' : 'badge-amber'}">
                  ${r.source === 'Google' ? 'Google Business' : r.is_approved ? 'Published' : 'Pending Approval'}
                </span>
              </div>
              <p style="font-size:14px;">&ldquo;${escapeHtml(r.comment)}&rdquo;</p>
            </div>
            ${
              r.source === 'Website'
                ? `<div class="flex-row">
                    <button type="button" class="btn btn-sm ${r.is_approved ? 'btn-outline' : 'btn-whatsapp'}" data-toggle-rev="${escapeHtml(r.id)}" data-rev-state="${r.is_approved ? '1' : '0'}">
                      ${r.is_approved ? 'Unpublish' : 'Approve'}
                    </button>
                    <button type="button" class="btn btn-ghost btn-sm" data-del-rev="${escapeHtml(r.id)}" style="color:var(--red);">${icon('trash', 15)}</button>
                  </div>`
                : '<span class="text-subtle" style="font-size:12px;">Verified Google Listing</span>'
            }
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// MODULE 9: INVENTORY CONTROL
// ----------------------------------------------------------------------------
function renderAdminInventory() {
  const list = store.products.filter((p) => {
    if (invFilter === 'low') return Number(p.stock) > 0 && Number(p.stock) <= 5;
    if (invFilter === 'out') return Number(p.stock) <= 0 || p.availability === 'out_of_stock';
    return true;
  });

  return `
    <div class="stack-md">
      <div class="flex-between">
        <div>
          <h2 style="font-size:24px;font-weight:800;">Inventory &amp; Stock Control</h2>
          <p class="text-muted" style="font-size:13.5px;">Update SKU quantities and stock statuses inline.</p>
        </div>
        <div class="tab-pills">
          <button type="button" class="tab-pill ${invFilter === 'all' ? 'active' : ''}" data-inv-f="all">All SKUs</button>
          <button type="button" class="tab-pill ${invFilter === 'low' ? 'active' : ''}" data-inv-f="low">Low Stock</button>
          <button type="button" class="tab-pill ${invFilter === 'out' ? 'active' : ''}" data-inv-f="out">Out of Stock</button>
        </div>
      </div>

      <div class="table-card">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr><th>Product &amp; SKU</th><th>Stock Qty</th><th>Availability</th><th class="text-right">Save</th></tr>
            </thead>
            <tbody>
              ${list
                .map(
                  (p) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(p.name)}</strong>
                    <div class="font-mono text-subtle" style="font-size:11.5px;">${escapeHtml(p.sku)}</div>
                  </td>
                  <td>
                    <input type="number" min="0" class="form-input tabular-nums" style="height:36px;width:96px;" id="inv-qty-${escapeHtml(p.id)}" value="${p.stock}" />
                  </td>
                  <td>
                    <select class="form-select" style="height:36px;width:150px;" id="inv-av-${escapeHtml(p.id)}">
                      <option value="in_stock" ${p.availability === 'in_stock' ? 'selected' : ''}>In Stock</option>
                      <option value="low_stock" ${p.availability === 'low_stock' ? 'selected' : ''}>Low Stock</option>
                      <option value="out_of_stock" ${p.availability === 'out_of_stock' ? 'selected' : ''}>Out of Stock</option>
                      <option value="preorder" ${p.availability === 'preorder' ? 'selected' : ''}>Pre-Order</option>
                    </select>
                  </td>
                  <td class="text-right">
                    <button type="button" class="btn btn-sm btn-red" data-save-inv="${escapeHtml(p.id)}">Save</button>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// MODULE 10: SITE SETTINGS
// ----------------------------------------------------------------------------
function renderAdminSettings() {
  const s = store.siteSettings;
  return `
    <form id="adm-settings-form" class="stack-lg">
      <div class="flex-between">
        <div>
          <h2 style="font-size:24px;font-weight:800;">Site Settings &amp; Storefront Config</h2>
          <p class="text-muted" style="font-size:13.5px;">Control WhatsApp ordering number, announcement bar, optional free delivery, and hero banner.</p>
        </div>
        <button type="button" class="btn btn-outline" id="adm-reset-settings">Restore Defaults</button>
      </div>

      <div class="card-panel stack-md">
        <h3 style="font-size:16px;font-weight:800;">Business Contact &amp; WhatsApp Ordering</h3>
        <div class="grid-3">
          <div class="form-group">
            <label class="form-label">Store Name</label>
            <input type="text" id="st-name" class="form-input" value="${escapeHtml(s.store_name)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="text" id="st-phone" class="form-input tabular-nums" value="${escapeHtml(s.phone_number)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">WhatsApp Ordering Number</label>
            <input type="text" id="st-wa" class="form-input tabular-nums" value="${escapeHtml(s.whatsapp_number)}" required />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Karachi Store Address</label>
          <input type="text" id="st-addr" class="form-input" value="${escapeHtml(s.address)}" required />
        </div>
      </div>

      <div class="card-panel stack-md">
        <h3 style="font-size:16px;font-weight:800;">Announcement Bar &amp; Delivery Rules</h3>
        <div class="form-group">
          <label class="form-label">Announcement Message</label>
          <input type="text" id="st-ann" class="form-input" value="${escapeHtml(s.announcement_text)}" required />
        </div>
        <div class="grid-2">
          <label class="checkbox-row">
            <input type="checkbox" id="st-freedel" ${s.free_delivery_enabled ? 'checked' : ''} />
            <span>Enable Free Delivery Promotion (Off by default)</span>
          </label>
          <div class="form-group">
            <label class="form-label">Free Delivery Minimum Order (PKR)</label>
            <input type="number" id="st-freethresh" class="form-input tabular-nums" value="${Number(s.free_delivery_threshold || 0)}" />
          </div>
        </div>
      </div>

      <div class="card-panel stack-md">
        <h3 style="font-size:16px;font-weight:800;">Homepage Hero Banner &amp; Social Profiles</h3>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Hero Heading</label>
            <input type="text" id="st-hero-h" class="form-input" value="${escapeHtml(s.hero_heading)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Hero Image URL / Upload to Supabase Storage</label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="st-hero-img" class="form-input" value="${escapeHtml(s.hero_image_url)}" />
              <label class="btn btn-black" style="cursor:pointer;">
                ${icon('upload', 15)} Upload
                <input type="file" id="st-hero-file" accept="image/*" style="display:none;" />
              </label>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Hero Subheading</label>
          <input type="text" id="st-hero-sub" class="form-input" value="${escapeHtml(s.hero_subheading)}" />
        </div>
        <div class="grid-3">
          <div class="form-group">
            <label class="form-label">Facebook URL</label>
            <input type="url" id="st-fb" class="form-input" value="${escapeHtml(s.facebook_url)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Instagram URL</label>
            <input type="url" id="st-ig" class="form-input" value="${escapeHtml(s.instagram_url)}" />
          </div>
          <div class="form-group">
            <label class="form-label">YouTube URL</label>
            <input type="url" id="st-yt" class="form-input" value="${escapeHtml(s.youtube_url)}" />
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;">
        <button type="submit" class="btn btn-lg btn-red">Save Storefront Settings</button>
      </div>
    </form>
  `;
}

// ============================================================================
// ADMIN INTERACTIVE EVENT BINDINGS & MODALS
// ============================================================================
function openProductEditorModal(existingProd, rerenderFn) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;

  const isEdit = Boolean(existingProd?.id);
  const p = existingProd || {
    name: '',
    sku: generateSku('Helmets'),
    category_name: store.categories[0]?.name || 'Helmets',
    brand: 'Rock Danish Selection',
    price: 5000,
    sale_price: '',
    stock: 10,
    availability: 'in_stock',
    sizes: ['M', 'L', 'XL'],
    colors: ['Black'],
    images: ['/images/products/helmet-pro.jpg'],
    short_description: '',
    description: '',
    specifications: { Material: 'High-Grade Protective Shell' },
    featured: true,
    best_seller: false,
    new_arrival: true,
  };

  let galleryImages = [...(p.images || ['/images/products/helmet-pro.jpg'])];
  const specString = Object.entries(p.specifications || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  modalRoot.innerHTML = `
    <div class="backdrop-overlay backdrop-center" id="prod-modal-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <h3 style="font-size:18px;font-weight:800;">${isEdit ? 'Edit Product' : 'Add New Product'}</h3>
          <button type="button" class="btn btn-ghost btn-sm" id="close-prod-modal">${icon('x', 18)}</button>
        </div>
        <form id="prod-editor-form" class="modal-body stack-md">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Product Name *</label>
              <input type="text" id="pe-name" class="form-input" required value="${escapeHtml(p.name)}" />
            </div>
            <div class="form-group">
              <label class="form-label">SKU Reference *</label>
              <input type="text" id="pe-sku" class="form-input font-mono" required value="${escapeHtml(p.sku)}" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Category</label>
              <select id="pe-cat" class="form-select">
                ${store.categories
                  .map(
                    (c) => `<option value="${escapeHtml(c.name)}" ${p.category_name === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
                  )
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Brand</label>
              <input type="text" id="pe-brand" class="form-input" value="${escapeHtml(p.brand)}" />
            </div>
          </div>

          <div class="grid-3">
            <div class="form-group">
              <label class="form-label">Regular Price (PKR) *</label>
              <input type="number" id="pe-price" class="form-input tabular-nums" required value="${p.price}" />
            </div>
            <div class="form-group">
              <label class="form-label">Sale Price (PKR)</label>
              <input type="number" id="pe-sale" class="form-input tabular-nums" value="${p.sale_price ?? ''}" placeholder="Optional" />
            </div>
            <div class="form-group">
              <label class="form-label">Stock Quantity *</label>
              <input type="number" id="pe-stock" class="form-input tabular-nums" required value="${p.stock}" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Sizes (comma separated)</label>
              <input type="text" id="pe-sizes" class="form-input" value="${escapeHtml((p.sizes || []).join(', '))}" placeholder="M, L, XL" />
            </div>
            <div class="form-group">
              <label class="form-label">Colors (comma separated)</label>
              <input type="text" id="pe-colors" class="form-input" value="${escapeHtml((p.colors || []).join(', '))}" placeholder="Black, Red" />
            </div>
          </div>

          <div class="form-group">
            <div class="flex-between">
              <label class="form-label">Product Images (Supabase Storage)</label>
              <label class="btn btn-sm btn-black" style="cursor:pointer;">
                ${icon('upload', 14)} Upload Images
                <input type="file" id="pe-files" accept="image/*" multiple style="display:none;" />
              </label>
            </div>
            <div id="pe-gallery-preview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;"></div>
          </div>

          <div class="form-group">
            <label class="form-label">Short Summary</label>
            <input type="text" id="pe-short" class="form-input" value="${escapeHtml(p.short_description || '')}" />
          </div>

          <div class="form-group">
            <label class="form-label">Full Description</label>
            <textarea id="pe-desc" class="form-textarea">${escapeHtml(p.description || '')}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Specifications (One per line: Key: Value)</label>
            <textarea id="pe-specs" class="form-textarea font-mono" style="font-size:12.5px;">${escapeHtml(specString)}</textarea>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:16px;">
            <label class="checkbox-row"><input type="checkbox" id="pe-feat" ${p.featured ? 'checked' : ''} /><span>Featured</span></label>
            <label class="checkbox-row"><input type="checkbox" id="pe-best" ${p.best_seller ? 'checked' : ''} /><span>Best Seller</span></label>
            <label class="checkbox-row"><input type="checkbox" id="pe-new" ${p.new_arrival ? 'checked' : ''} /><span>New Arrival</span></label>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:10px;border-top:1px solid var(--border);">
            <button type="button" class="btn btn-outline" id="cancel-prod-modal">Cancel</button>
            <button type="submit" class="btn btn-red">Save Product</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const renderGalleryThumbs = () => {
    const wrap = document.getElementById('pe-gallery-preview');
    if (!wrap) return;
    wrap.innerHTML = galleryImages
      .map(
        (url, i) => `
      <div style="position:relative;width:64px;height:64px;border:1px solid var(--border);border-radius:8px;padding:3px;">
        <img src="${escapeHtml(url)}" alt="" style="width:100%;height:100%;object-fit:contain;" />
        <button type="button" data-rm-gimg="${i}" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:999px;border:none;background:var(--red);color:#fff;font-size:11px;">&times;</button>
      </div>
    `
      )
      .join('');
    wrap.querySelectorAll('[data-rm-gimg]').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = Number(b.getAttribute('data-rm-gimg'));
        galleryImages.splice(idx, 1);
        renderGalleryThumbs();
      });
    });
  };
  renderGalleryThumbs();

  document.getElementById('pe-files')?.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    try {
      showToast('Uploading images...', 'info');
      const uploaded = await uploadMultipleImagesToSupabase(files, 'product-images', 'products');
      galleryImages = [...galleryImages, ...uploaded];
      renderGalleryThumbs();
      showToast('Images uploaded!', 'success');
    } catch (err) {
      showToast(err.message || 'Upload failed.', 'error');
    }
  });

  document.getElementById('close-prod-modal')?.addEventListener('click', closeModalRoot);
  document.getElementById('cancel-prod-modal')?.addEventListener('click', closeModalRoot);

  document.getElementById('prod-editor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const specsObj = {};
    (document.getElementById('pe-specs')?.value || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        const idx = line.indexOf(':');
        if (idx > 0) {
          specsObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      });

    const catName = document.getElementById('pe-cat')?.value || 'Helmets';
    const matchedCat = store.categories.find((c) => c.name === catName);

    try {
      await saveProduct({
        id: existingProd?.id,
        name: document.getElementById('pe-name')?.value || '',
        sku: document.getElementById('pe-sku')?.value || '',
        slug: slugify(document.getElementById('pe-name')?.value || ''),
        category_id: matchedCat?.id || null,
        category_name: catName,
        brand: document.getElementById('pe-brand')?.value || 'Rock Danish',
        price: Number(document.getElementById('pe-price')?.value || 0),
        sale_price: document.getElementById('pe-sale')?.value || null,
        stock: Number(document.getElementById('pe-stock')?.value || 0),
        sizes: (document.getElementById('pe-sizes')?.value || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        colors: (document.getElementById('pe-colors')?.value || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        images: galleryImages.length ? galleryImages : ['/images/products/helmet-pro.jpg'],
        short_description: document.getElementById('pe-short')?.value || '',
        description: document.getElementById('pe-desc')?.value || '',
        specifications: specsObj,
        featured: Boolean(document.getElementById('pe-feat')?.checked),
        best_seller: Boolean(document.getElementById('pe-best')?.checked),
        new_arrival: Boolean(document.getElementById('pe-new')?.checked),
      });
      closeModalRoot();
      await refreshStoreData();
      showToast('Product saved!', 'success');
      rerenderFn();
    } catch (err) {
      showToast(err.message || 'Could not save product.', 'error');
    }
  });
}

function openCategoryModal(existingCat, rerenderFn) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;
  const c = existingCat || {
    name: '',
    short_description: '',
    image_url: '/images/products/helmet-pro.jpg',
    display_order: store.categories.length + 1,
    is_active: true,
  };

  modalRoot.innerHTML = `
    <div class="backdrop-overlay backdrop-center">
      <div class="modal-card modal-sm">
        <div class="modal-header">
          <h3 style="font-size:17px;font-weight:800;">${existingCat ? 'Edit Category' : 'Add Category'}</h3>
          <button type="button" class="btn btn-ghost btn-sm" id="close-cat-modal">${icon('x', 18)}</button>
        </div>
        <form id="cat-editor-form" class="modal-body stack-md">
          <div class="form-group">
            <label class="form-label">Category Name *</label>
            <input type="text" id="ce-name" class="form-input" required value="${escapeHtml(c.name)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea id="ce-desc" class="form-textarea">${escapeHtml(c.short_description)}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Category Image URL / Upload</label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="ce-img" class="form-input" value="${escapeHtml(c.image_url)}" />
              <label class="btn btn-black" style="cursor:pointer;">
                Upload
                <input type="file" id="ce-file" accept="image/*" style="display:none;" />
              </label>
            </div>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Display Order</label>
              <input type="number" id="ce-order" class="form-input tabular-nums" value="${c.display_order}" />
            </div>
            <label class="checkbox-row" style="padding-top:22px;">
              <input type="checkbox" id="ce-active" ${c.is_active ? 'checked' : ''} />
              <span>Visible on Store</span>
            </label>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button type="submit" class="btn btn-red">Save Category</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('close-cat-modal')?.addEventListener('click', closeModalRoot);
  document.getElementById('ce-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImageToSupabase(file, 'category-images', 'categories');
      const inp = document.getElementById('ce-img');
      if (inp) inp.value = url;
      showToast('Category image uploaded!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('cat-editor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await saveCategory({
        id: existingCat?.id,
        name: document.getElementById('ce-name')?.value || '',
        short_description: document.getElementById('ce-desc')?.value || '',
        image_url: document.getElementById('ce-img')?.value || '/images/products/helmet-pro.jpg',
        display_order: Number(document.getElementById('ce-order')?.value || 1),
        is_active: Boolean(document.getElementById('ce-active')?.checked),
      });
      closeModalRoot();
      await refreshStoreData();
      showToast('Category saved!', 'success');
      rerenderFn();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function openCouponModal(rerenderFn) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;

  modalRoot.innerHTML = `
    <div class="backdrop-overlay backdrop-center">
      <div class="modal-card modal-sm">
        <div class="modal-header">
          <h3 style="font-size:17px;font-weight:800;">Create Coupon Code</h3>
          <button type="button" class="btn btn-ghost btn-sm" id="close-cpn-modal">${icon('x', 18)}</button>
        </div>
        <form id="cpn-editor-form" class="modal-body stack-md">
          <div class="form-group">
            <label class="form-label">Coupon Code *</label>
            <input type="text" id="cp-code" class="form-input font-mono" required placeholder="e.g. RIDE10" style="text-transform:uppercase;" />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Type</label>
              <select id="cp-type" class="form-select">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed PKR</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Discount Value *</label>
              <input type="number" id="cp-val" class="form-input tabular-nums" required value="10" min="1" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Minimum Order Amount (PKR)</label>
            <input type="number" id="cp-min" class="form-input tabular-nums" value="0" />
          </div>
          <button type="submit" class="btn btn-red btn-block">Create Active Coupon</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('close-cpn-modal')?.addEventListener('click', closeModalRoot);
  document.getElementById('cpn-editor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await saveCoupon({
        code: document.getElementById('cp-code')?.value || '',
        discount_type: document.getElementById('cp-type')?.value || 'percentage',
        discount_value: Number(document.getElementById('cp-val')?.value || 10),
        min_order_amount: Number(document.getElementById('cp-min')?.value || 0),
        is_active: true,
      });
      closeModalRoot();
      await refreshStoreData();
      showToast('Coupon created!', 'success');
      rerenderFn();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function openDiscountModal(rerenderFn) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;

  modalRoot.innerHTML = `
    <div class="backdrop-overlay backdrop-center">
      <div class="modal-card modal-sm">
        <div class="modal-header">
          <h3 style="font-size:17px;font-weight:800;">New Deal Campaign</h3>
          <button type="button" class="btn btn-ghost btn-sm" id="close-dsc-modal">${icon('x', 18)}</button>
        </div>
        <form id="dsc-editor-form" class="modal-body stack-md">
          <div class="form-group">
            <label class="form-label">Campaign Title *</label>
            <input type="text" id="ds-title" class="form-input" required placeholder="Weekend Riding Jacket Offer" />
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <input type="text" id="ds-desc" class="form-input" placeholder="Special markdown for Karachi riders" />
          </div>
          <div class="form-group">
            <label class="form-label">Discount Percentage (%)</label>
            <input type="number" id="ds-pct" class="form-input tabular-nums" value="15" min="1" max="90" required />
          </div>
          <button type="submit" class="btn btn-red btn-block">Save Deal Campaign</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('close-dsc-modal')?.addEventListener('click', closeModalRoot);
  document.getElementById('dsc-editor-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await saveDiscount({
        title: document.getElementById('ds-title')?.value || '',
        description: document.getElementById('ds-desc')?.value || '',
        discount_percentage: Number(document.getElementById('ds-pct')?.value || 15),
        featured_deal: true,
        is_active: true,
      });
      closeModalRoot();
      await refreshStoreData();
      showToast('Deal campaign saved!', 'success');
      rerenderFn();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

export function bindAdminEvents(rerenderFn, navigateFn) {
  document.getElementById('open-admin-mobile')?.addEventListener('click', () => {
    adminMobileSidebar = true;
    rerenderFn();
  });
  document.getElementById('close-admin-mobile')?.addEventListener('click', () => {
    adminMobileSidebar = false;
    rerenderFn();
  });
  document.getElementById('admin-mobile-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'admin-mobile-backdrop') {
      adminMobileSidebar = false;
      rerenderFn();
    }
  });

  document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
    await signOutCurrentUser();
    showToast('Signed out of Admin Dashboard', 'info');
    navigateFn('/login');
  });

  // Products
  document.getElementById('adm-prod-search')?.addEventListener('input', (e) => {
    prodSearch = e.target.value;
    rerenderFn();
  });
  document.getElementById('adm-new-prod-btn')?.addEventListener('click', () => {
    openProductEditorModal(null, rerenderFn);
  });
  document.querySelectorAll('[data-edit-prod]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = store.products.find((x) => x.id === btn.getAttribute('data-edit-prod'));
      if (p) openProductEditorModal(p, rerenderFn);
    });
  });
  document.querySelectorAll('[data-dup-prod]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = store.products.find((x) => x.id === btn.getAttribute('data-dup-prod'));
      if (p) {
        openProductEditorModal(
          { ...p, id: undefined, name: `${p.name} (Copy)`, sku: generateSku(p.category_name) },
          rerenderFn
        );
      }
    });
  });
  document.querySelectorAll('[data-del-prod]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = store.products.find((x) => x.id === btn.getAttribute('data-del-prod'));
      if (!p) return;
      openConfirmModal({
        title: 'Delete Product',
        description: `Permanently delete "${p.name}"?`,
        confirmLabel: 'Delete',
        onConfirm: async () => {
          await deleteProductById(p.id);
          await refreshStoreData();
          showToast('Product deleted', 'info');
          rerenderFn();
        },
      });
    });
  });

  // Categories
  document.getElementById('adm-new-cat-btn')?.addEventListener('click', () => {
    openCategoryModal(null, rerenderFn);
  });
  document.querySelectorAll('[data-edit-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = store.categories.find((c) => c.id === btn.getAttribute('data-edit-cat'));
      if (cat) openCategoryModal(cat, rerenderFn);
    });
  });
  document.querySelectorAll('[data-del-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = store.categories.find((c) => c.id === btn.getAttribute('data-del-cat'));
      if (!cat) return;
      openConfirmModal({
        title: 'Delete Category',
        description: `Remove category "${cat.name}"?`,
        confirmLabel: 'Delete',
        onConfirm: async () => {
          await deleteCategoryById(cat.id);
          await refreshStoreData();
          showToast('Category deleted', 'info');
          rerenderFn();
        },
      });
    });
  });

  // Orders
  document.getElementById('adm-order-filter')?.addEventListener('change', (e) => {
    orderStatusFilter = e.target.value;
    rerenderFn();
  });
  document.querySelectorAll('[data-ord-status]').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const id = sel.getAttribute('data-ord-status');
      await updateOrderStatus(id, sel.value);
      await loadAdminDatasets();
      showToast(`Order status updated to ${sel.value}`, 'success');
      rerenderFn();
    });
  });

  // Coupons
  document.getElementById('adm-new-cpn-btn')?.addEventListener('click', () => {
    openCouponModal(rerenderFn);
  });
  document.querySelectorAll('[data-toggle-cpn]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const cpn = store.coupons.find((c) => c.id === btn.getAttribute('data-toggle-cpn'));
      if (!cpn) return;
      await saveCoupon({ ...cpn, is_active: !cpn.is_active });
      await refreshStoreData();
      rerenderFn();
    });
  });
  document.querySelectorAll('[data-del-cpn]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-cpn');
      await deleteCouponById(id);
      await refreshStoreData();
      showToast('Coupon deleted', 'info');
      rerenderFn();
    });
  });

  // Discounts
  document.getElementById('adm-new-dsc-btn')?.addEventListener('click', () => {
    openDiscountModal(rerenderFn);
  });
  document.querySelectorAll('[data-del-dsc]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteDiscountById(btn.getAttribute('data-del-dsc'));
      await refreshStoreData();
      rerenderFn();
    });
  });
  document.querySelectorAll('[data-save-sale]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-save-sale');
      const prod = store.products.find((p) => p.id === id);
      const val = document.getElementById(`sale-inp-${id}`)?.value || '';
      if (!prod) return;
      const saleNum = val.trim() ? Number(val) : null;
      if (saleNum !== null && saleNum >= prod.price) {
        showToast('Sale price must be lower than regular price.', 'error');
        return;
      }
      await saveProduct({ ...prod, sale_price: saleNum, featured_deal: Boolean(saleNum) });
      await refreshStoreData();
      showToast('Sale price updated!', 'success');
      rerenderFn();
    });
  });

  // Reviews
  document.querySelectorAll('[data-toggle-rev]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-toggle-rev');
      const currently = btn.getAttribute('data-rev-state') === '1';
      await updateReviewApproval(id, !currently);
      await Promise.all([loadAdminDatasets(), refreshStoreData()]);
      showToast(!currently ? 'Review approved!' : 'Review unpublished', 'success');
      rerenderFn();
    });
  });
  document.querySelectorAll('[data-del-rev]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteReviewById(btn.getAttribute('data-del-rev'));
      await Promise.all([loadAdminDatasets(), refreshStoreData()]);
      showToast('Review deleted', 'info');
      rerenderFn();
    });
  });

  // Inventory
  document.querySelectorAll('[data-inv-f]').forEach((btn) => {
    btn.addEventListener('click', () => {
      invFilter = btn.getAttribute('data-inv-f') || 'all';
      rerenderFn();
    });
  });
  document.querySelectorAll('[data-save-inv]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-save-inv');
      const prod = store.products.find((p) => p.id === id);
      if (!prod) return;
      const stock = Math.max(0, Number(document.getElementById(`inv-qty-${id}`)?.value || 0));
      const availability = document.getElementById(`inv-av-${id}`)?.value || 'in_stock';
      await saveProduct({ ...prod, stock, availability });
      await refreshStoreData();
      showToast(`Inventory updated for ${prod.sku}`, 'success');
      rerenderFn();
    });
  });

  // Site Settings
  document.getElementById('st-hero-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImageToSupabase(file, 'promo-images', 'hero');
      const inp = document.getElementById('st-hero-img');
      if (inp) inp.value = url;
      showToast('Hero banner uploaded!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
  document.getElementById('adm-reset-settings')?.addEventListener('click', async () => {
    await updateSiteSettings(DEFAULT_SITE_SETTINGS);
    await refreshStoreData();
    showToast('Restored default store settings', 'info');
    rerenderFn();
  });
  document.getElementById('adm-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await updateSiteSettings({
        ...store.siteSettings,
        id: 1,
        store_name: document.getElementById('st-name')?.value || 'Rock Danish Biker Stuff',
        phone_number: document.getElementById('st-phone')?.value || '0333 3817028',
        whatsapp_number: document.getElementById('st-wa')?.value || '0333 3817028',
        address: document.getElementById('st-addr')?.value || '',
        announcement_text: document.getElementById('st-ann')?.value || '',
        free_delivery_enabled: Boolean(document.getElementById('st-freedel')?.checked),
        free_delivery_threshold: Number(document.getElementById('st-freethresh')?.value || 0),
        hero_heading: document.getElementById('st-hero-h')?.value || '',
        hero_subheading: document.getElementById('st-hero-sub')?.value || '',
        hero_image_url: document.getElementById('st-hero-img')?.value || '/images/banners/hero-rider.jpg',
        facebook_url: document.getElementById('st-fb')?.value || '',
        instagram_url: document.getElementById('st-ig')?.value || '',
        youtube_url: document.getElementById('st-yt')?.value || '',
      });
      await refreshStoreData();
      showToast('Storefront settings saved!', 'success');
      rerenderFn();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
