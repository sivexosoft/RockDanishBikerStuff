import { BUSINESS_INFO, PAKISTAN_CITIES } from '../data.js';
import { createOrderRecord, trackOrderByNumberAndPhone } from '../services.js';
import {
  applyCouponToCart,
  clearCart,
  getCartTotals,
  removeCouponFromCart,
  removeFromCart,
  showToast,
  store,
  updateCartQuantity,
} from '../state.js';
import {
  buildGeneralSupportWhatsAppUrl,
  buildOrderWhatsAppMessage,
  escapeHtml,
  formatDateShort,
  formatPKR,
  getEffectivePrice,
  icon,
} from '../utils.js';

let completedOrder = null;
let trackedOrderResult = null;
let trackSearched = false;

export function resetCompletedOrder() {
  completedOrder = null;
}

// ============================================================================
// 1. FULL SHOPPING CART PAGE (/cart)
// ============================================================================
export function renderCartPage() {
  const { subtotal, discountAmount, total, itemCount } = getCartTotals();

  return `
    <div class="page-banner">
      <div class="container">
        <h1 style="font-size:clamp(1.65rem,3vw,2.2rem);font-weight:800;">Shopping Cart (${itemCount})</h1>
        <p class="text-muted" style="font-size:14px;margin-top:4px;">Review your selected gear before completing your WhatsApp order.</p>
      </div>
    </div>

    <div class="container">
      ${
        store.cart.length === 0
          ? `
        <div style="padding:56px 0;">
          <div class="empty-box">
            <h2 style="font-size:20px;font-weight:800;">Your Shopping Cart Is Empty</h2>
            <p class="text-muted" style="margin:8px 0 20px;">Browse helmets, jackets, gloves, boots, and motorcycle accessories.</p>
            <a href="/shop" data-link class="btn btn-red">Start Shopping</a>
          </div>
        </div>
      `
          : `
        <div class="checkout-grid">
          <div class="table-card">
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit Price</th>
                    <th>Quantity</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${store.cart
                    .map((item) => {
                      const unit = getEffectivePrice(item.product);
                      return `
                        <tr>
                          <td>
                            <div class="flex-row">
                              <img
                                src="${escapeHtml(item.product.images?.[0] || '/images/products/helmet-pro.jpg')}"
                                alt="${escapeHtml(item.product.name)}"
                                style="width:58px;height:58px;object-fit:contain;border:1px solid var(--border);border-radius:8px;padding:4px;"
                              />
                              <div>
                                <a href="/product/${escapeHtml(item.product.slug)}" data-link style="font-weight:700;">${escapeHtml(item.product.name)}</a>
                                <div class="text-subtle" style="font-size:12px;">
                                  SKU: <span class="font-mono">${escapeHtml(item.product.sku)}</span>
                                  ${item.selectedSize ? ` &middot; Size: ${escapeHtml(item.selectedSize)}` : ''}
                                  ${item.selectedColor ? ` &middot; Color: ${escapeHtml(item.selectedColor)}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td class="tabular-nums">${formatPKR(unit)}</td>
                          <td>
                            <div class="qty-control" style="height:34px;">
                              <button type="button" data-cart-dec="${escapeHtml(item.cartItemId)}">-</button>
                              <span class="tabular-nums">${item.quantity}</span>
                              <button type="button" data-cart-inc="${escapeHtml(item.cartItemId)}">+</button>
                            </div>
                          </td>
                          <td style="font-weight:800;color:var(--red);" class="tabular-nums">${formatPKR(unit * item.quantity)}</td>
                          <td>
                            <button type="button" class="btn btn-ghost btn-sm" data-cart-rm="${escapeHtml(item.cartItemId)}">${icon('trash', 16)}</button>
                          </td>
                        </tr>
                      `;
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card-panel stack-md">
            <h2 style="font-size:18px;font-weight:800;">Order Summary</h2>

            <form id="cart-coupon-form" style="display:flex;gap:8px;">
              <input
                type="text"
                id="cart-coupon-input"
                class="form-input font-mono"
                placeholder="Coupon code (optional)"
                value="${escapeHtml(store.appliedCoupon?.code || '')}"
                style="text-transform:uppercase;"
              />
              <button type="submit" class="btn btn-black">Apply</button>
            </form>
            ${
              store.appliedCoupon
                ? `<div class="flex-between" style="font-size:12.5px;color:var(--green);">
                    <span>Active coupon: <strong>${escapeHtml(store.appliedCoupon.code)}</strong></span>
                    <button type="button" class="btn btn-ghost btn-sm" id="cart-rm-coupon">Remove</button>
                  </div>`
                : ''
            }

            <div class="stack-sm" style="padding-top:8px;border-top:1px solid var(--border);font-size:14px;">
              <div class="flex-between">
                <span class="text-muted">Subtotal</span>
                <strong class="tabular-nums">${formatPKR(subtotal)}</strong>
              </div>
              ${
                discountAmount > 0
                  ? `<div class="flex-between" style="color:var(--green);">
                      <span>Coupon Discount</span>
                      <strong class="tabular-nums">-${formatPKR(discountAmount)}</strong>
                    </div>`
                  : ''
              }
              <div class="flex-between" style="font-size:18px;padding-top:10px;border-top:1px solid var(--border);">
                <strong>Total</strong>
                <strong style="color:var(--red);" class="tabular-nums">${formatPKR(total)}</strong>
              </div>
            </div>

            <a href="/checkout" data-link class="btn btn-lg btn-red btn-block">
              <span>Proceed to Checkout</span>
              ${icon('arrowRight', 17)}
            </a>
          </div>
        </div>
      `
      }
    </div>
  `;
}

export function bindCartPageEvents(rerenderFn) {
  document.querySelectorAll('[data-cart-dec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cart-dec');
      const item = store.cart.find((c) => c.cartItemId === id);
      if (item) updateCartQuantity(id, item.quantity - 1);
    });
  });
  document.querySelectorAll('[data-cart-inc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cart-inc');
      const item = store.cart.find((c) => c.cartItemId === id);
      if (item) updateCartQuantity(id, item.quantity + 1);
    });
  });
  document.querySelectorAll('[data-cart-rm]').forEach((btn) => {
    btn.addEventListener('click', () => {
      removeFromCart(btn.getAttribute('data-cart-rm'));
    });
  });

  document.getElementById('cart-coupon-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('cart-coupon-input')?.value || '';
    await applyCouponToCart(code);
    rerenderFn();
  });

  document.getElementById('cart-rm-coupon')?.addEventListener('click', () => {
    removeCouponFromCart();
    rerenderFn();
  });
}

// ============================================================================
// 2. CHECKOUT & WHATSAPP ORDER GENERATION (/checkout)
// ============================================================================
export function renderCheckoutPage() {
  if (completedOrder) {
    const waUrl = buildOrderWhatsAppMessage(
      completedOrder,
      store.siteSettings.whatsapp_number
    );
    return `
      <div class="container" style="padding:56px 16px;max-width:680px;">
        <div class="card-panel stack-md" style="text-align:center;">
          <div style="width:56px;height:56px;border-radius:999px;background:var(--green-soft);color:var(--green);display:flex;align-items:center;justify-content:center;margin:0 auto;">
            ${icon('check', 28)}
          </div>
          <h1 style="font-size:26px;font-weight:800;">Order Recorded!</h1>
          <p class="text-muted">
            Your order reference is <strong class="font-mono" style="color:var(--black);">${escapeHtml(completedOrder.order_number)}</strong>.
            Send your pre-filled order message on WhatsApp now so Rock Danish Biker Stuff can confirm dispatch.
          </p>

          <a
            href="${waUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-lg btn-whatsapp btn-block"
          >
            ${icon('whatsapp', 20)}
            <span>Send Order on WhatsApp (${escapeHtml(store.siteSettings.whatsapp_number)})</span>
          </a>

          <div class="grid-2" style="padding-top:8px;">
            <a href="/track-order" data-link class="btn btn-outline btn-block">Track Order Status</a>
            <a href="/shop" data-link class="btn btn-black btn-block">Continue Shopping</a>
          </div>
        </div>
      </div>
    `;
  }

  if (store.cart.length === 0) {
    return `
      <div class="container" style="padding:64px 16px;">
        <div class="empty-box">
          <h1 style="font-size:22px;font-weight:800;">No Items to Checkout</h1>
          <p class="text-muted" style="margin:8px 0 20px;">Add motorcycle gear to your cart before proceeding to checkout.</p>
          <a href="/shop" data-link class="btn btn-red">Browse Store</a>
        </div>
      </div>
    `;
  }

  const { subtotal, discountAmount, total } = getCartTotals();
  const prof = store.profile;

  return `
    <div class="page-banner">
      <div class="container">
        <h1 style="font-size:clamp(1.65rem,3vw,2.2rem);font-weight:800;">Checkout &amp; WhatsApp Order</h1>
        <p class="text-muted" style="font-size:14px;margin-top:4px;">
          Complete your delivery details to save your order and send it directly to Rock Danish Biker Stuff (${escapeHtml(store.siteSettings.whatsapp_number)}).
        </p>
      </div>
    </div>

    <div class="container">
      <form id="checkout-form" class="checkout-grid">
        <div class="card-panel stack-md">
          <h2 style="font-size:18px;font-weight:800;">Customer &amp; Delivery Information</h2>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="co-name" class="form-input" required value="${escapeHtml(prof?.full_name || '')}" placeholder="Muhammad Ali" />
            </div>
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" id="co-email" class="form-input" value="${escapeHtml(prof?.email || '')}" placeholder="ali@example.com" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Phone Number *</label>
              <input type="tel" id="co-phone" class="form-input tabular-nums" required value="${escapeHtml(prof?.phone || '')}" placeholder="0300 1234567" />
            </div>
            <div class="form-group">
              <label class="form-label">WhatsApp Number *</label>
              <input type="tel" id="co-whatsapp" class="form-input tabular-nums" required value="${escapeHtml(prof?.whatsapp || prof?.phone || '')}" placeholder="0300 1234567" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">City *</label>
            <select id="co-city" class="form-select" required>
              ${PAKISTAN_CITIES.map(
                (city) => `<option value="${escapeHtml(city)}" ${(prof?.city || 'Karachi') === city ? 'selected' : ''}>${escapeHtml(city)}</option>`
              ).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Complete Delivery Address *</label>
            <textarea id="co-address" class="form-textarea" required placeholder="House / Flat No, Block, Area, Nearest Landmark...">${escapeHtml(prof?.address || '')}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Order Notes (Optional)</label>
            <input type="text" id="co-notes" class="form-input" placeholder="Preferred delivery timing or helmet/jacket fit note..." />
          </div>
        </div>

        <div class="card-panel stack-md">
          <h2 style="font-size:18px;font-weight:800;">Your Items (${store.cart.length})</h2>

          <div class="stack-sm">
            ${store.cart
              .map((item) => {
                const unit = getEffectivePrice(item.product);
                return `
                  <div class="flex-between" style="font-size:13px;padding-bottom:10px;border-bottom:1px solid var(--border);">
                    <div>
                      <strong>${escapeHtml(item.product.name)}</strong> &times; ${item.quantity}
                      <div class="text-subtle font-mono" style="font-size:11px;">
                        ${escapeHtml(item.product.sku)} ${item.selectedSize ? `| ${escapeHtml(item.selectedSize)}` : ''} ${item.selectedColor ? `| ${escapeHtml(item.selectedColor)}` : ''}
                      </div>
                    </div>
                    <strong class="tabular-nums">${formatPKR(unit * item.quantity)}</strong>
                  </div>
                `;
              })
              .join('')}
          </div>

          <div style="display:flex;gap:8px;">
            <input type="text" id="co-coupon-input" class="form-input font-mono" placeholder="Coupon code" value="${escapeHtml(store.appliedCoupon?.code || '')}" style="text-transform:uppercase;" />
            <button type="button" class="btn btn-black" id="co-apply-coupon">Apply</button>
          </div>

          <div class="stack-sm" style="padding-top:8px;border-top:1px solid var(--border);font-size:14px;">
            <div class="flex-between">
              <span class="text-muted">Subtotal</span>
              <strong class="tabular-nums">${formatPKR(subtotal)}</strong>
            </div>
            <div class="flex-between">
              <span class="text-muted">Discount</span>
              <strong class="tabular-nums" style="color:var(--green);">-${formatPKR(discountAmount)}</strong>
            </div>
            <div class="flex-between" style="font-size:19px;padding-top:10px;border-top:1px solid var(--border);">
              <strong>Total Payable</strong>
              <strong style="color:var(--red);" class="tabular-nums">${formatPKR(total)}</strong>
            </div>
          </div>

          <button type="submit" id="co-submit-btn" class="btn btn-lg btn-whatsapp btn-block">
            ${icon('whatsapp', 19)}
            <span>Place Order via WhatsApp</span>
          </button>
        </div>
      </form>
    </div>
  `;
}

export function bindCheckoutPageEvents(rerenderFn) {
  document.getElementById('co-apply-coupon')?.addEventListener('click', async () => {
    const code = document.getElementById('co-coupon-input')?.value || '';
    await applyCouponToCart(code);
    rerenderFn();
  });

  document.getElementById('checkout-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('co-submit-btn');
    if (submitBtn) submitBtn.disabled = true;

    const { subtotal, discountAmount, total } = getCartTotals();
    const items = store.cart.map((c) => {
      const unit = getEffectivePrice(c.product);
      return {
        product_id: c.product.id,
        product_name: c.product.name,
        product_sku: c.product.sku,
        product_image: c.product.images?.[0] || '/images/products/helmet-pro.jpg',
        size: c.selectedSize || '',
        color: c.selectedColor || '',
        quantity: c.quantity,
        unit_price: unit,
        total_price: unit * c.quantity,
      };
    });

    try {
      const savedOrder = await createOrderRecord({
        user_id: store.firebaseUser?.uid || null,
        customer_name: document.getElementById('co-name')?.value || '',
        customer_email: document.getElementById('co-email')?.value || '',
        phone: document.getElementById('co-phone')?.value || '',
        whatsapp: document.getElementById('co-whatsapp')?.value || '',
        city: document.getElementById('co-city')?.value || 'Karachi',
        delivery_address: document.getElementById('co-address')?.value || '',
        notes: document.getElementById('co-notes')?.value || '',
        subtotal,
        discount_amount: discountAmount,
        coupon_code: store.appliedCoupon?.code || '',
        total,
        items,
      });

      completedOrder = savedOrder;
      clearCart();

      const waUrl = buildOrderWhatsAppMessage(
        savedOrder,
        store.siteSettings.whatsapp_number
      );
      const anchor = document.createElement('a');
      anchor.href = waUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      rerenderFn();
    } catch (err) {
      showToast(err.message || 'Failed to place order.', 'error');
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// ============================================================================
// 3. TRACK ORDER PAGE (/track-order)
// ============================================================================
export function renderTrackOrderPage() {
  return `
    <div class="page-banner">
      <div class="container">
        <h1 style="font-size:clamp(1.65rem,3vw,2.2rem);font-weight:800;">Track Your Order</h1>
        <p class="text-muted" style="font-size:14px;margin-top:4px;">Enter your Order ID (e.g. RDBS-20261103-1234) and phone number to check live dispatch status.</p>
      </div>
    </div>

    <div class="container" style="padding:44px 16px;max-width:640px;">
      <form id="track-order-form" class="card-panel stack-md">
        <div class="form-group">
          <label class="form-label">Order Number *</label>
          <input type="text" id="trk-no" class="form-input font-mono" required placeholder="RDBS-20261103-1234" style="text-transform:uppercase;" />
        </div>
        <div class="form-group">
          <label class="form-label">Customer Phone / WhatsApp Number *</label>
          <input type="tel" id="trk-phone" class="form-input tabular-nums" required placeholder="0300 1234567" />
        </div>
        <button type="submit" class="btn btn-red btn-lg btn-block">Check Order Status</button>
      </form>

      ${
        trackSearched
          ? trackedOrderResult
            ? `
            <div class="card-panel stack-sm" style="margin-top:24px;">
              <div class="flex-between">
                <strong class="font-mono" style="font-size:16px;">${escapeHtml(trackedOrderResult.order_number)}</strong>
                <span class="badge badge-red">${escapeHtml(trackedOrderResult.status)}</span>
              </div>
              <p class="text-muted" style="font-size:13.5px;">
                Customer: <strong>${escapeHtml(trackedOrderResult.customer_name)}</strong> &middot;
                City: <strong>${escapeHtml(trackedOrderResult.city || 'Karachi')}</strong>
              </p>
              <p class="text-muted tabular-nums" style="font-size:13.5px;">
                Order Total: <strong style="color:var(--red);">${formatPKR(trackedOrderResult.total)}</strong> &middot;
                Placed on ${formatDateShort(trackedOrderResult.created_at)}
              </p>
            </div>
          `
            : `
            <div class="card-panel" style="margin-top:24px;text-align:center;">
              <p style="font-weight:700;">No matching order found</p>
              <p class="text-muted" style="font-size:13px;margin-top:4px;">Verify your RDBS Order Number and phone number, or contact us on WhatsApp (${escapeHtml(store.siteSettings.whatsapp_number)}).</p>
            </div>
          `
          : ''
      }
    </div>
  `;
}

export function bindTrackOrderEvents(rerenderFn) {
  document.getElementById('track-order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const no = document.getElementById('trk-no')?.value || '';
    const ph = document.getElementById('trk-phone')?.value || '';
    trackedOrderResult = await trackOrderByNumberAndPhone(no, ph);
    trackSearched = true;
    rerenderFn();
  });
}

// ============================================================================
// 4. ABOUT US & CONTACT US PAGES (/about, /contact)
// ============================================================================
export function renderAboutPage() {
  const s = store.siteSettings;
  return `
    <div class="page-banner">
      <div class="container">
        <h1 style="font-size:clamp(1.7rem,3vw,2.25rem);font-weight:800;">About Rock Danish Biker Stuff</h1>
        <p class="text-muted" style="font-size:14.5px;margin-top:4px;">Motorcycle Gear, Biker Clothing &amp; Riding Accessories in Karachi, Pakistan.</p>
      </div>
    </div>

    <div class="container" style="padding:44px 16px 64px;">
      <div class="checkout-grid" style="padding:0;">
        <div class="stack-md">
          <h2 style="font-size:24px;font-weight:800;">Dedicated to Everyday Riders &amp; Highway Tourers</h2>
          <p class="text-muted" style="line-height:1.7;">
            Located at Al Rahman Tower, Sector 48-B Korangi near Coast Guard Chowrangi in Karachi, <strong>Rock Danish Biker Stuff</strong> supplies protective helmets, armored riding jackets, riding gloves, touring boots, weatherproof bike covers, and everyday motorcycle accessories at fair, transparent PKR prices.
          </p>
          <p class="text-muted" style="line-height:1.7;">
            Whether you ride daily across Karachi or plan long highway journeys across Pakistan, our focus is practical safety gear, honest pricing, and fast, direct communication via WhatsApp (${escapeHtml(s.whatsapp_number)}).
          </p>
          <div class="grid-2" style="padding-top:8px;">
            <div class="card-panel">
              <strong style="font-size:24px;color:var(--red);" class="tabular-nums">${escapeHtml(s.google_rating)} / 5</strong>
              <p class="text-muted" style="font-size:13px;margin-top:4px;">Google Business Rating (${escapeHtml(s.google_review_count)} Reviews)</p>
            </div>
            <div class="card-panel">
              <strong style="font-size:20px;">Karachi Store</strong>
              <p class="text-muted" style="font-size:13px;margin-top:4px;">Sector 48-B Korangi, near Coast Guard Chowrangi</p>
            </div>
          </div>
        </div>

        <div>
          <img
            src="/images/banners/mountain-riders.jpg"
            alt="Motorcycle riders on mountain highway"
            style="width:100%;border-radius:16px;border:1px solid var(--border);object-fit:cover;"
            onerror="this.src='/images/banners/hero-rider.jpg'"
          />
        </div>
      </div>
    </div>
  `;
}

export function renderContactPage() {
  const s = store.siteSettings;
  return `
    <div class="page-banner">
      <div class="container">
        <h1 style="font-size:clamp(1.7rem,3vw,2.25rem);font-weight:800;">Contact &amp; Store Location</h1>
        <p class="text-muted" style="font-size:14.5px;margin-top:4px;">Visit our Korangi shop in Karachi or reach out directly on WhatsApp.</p>
      </div>
    </div>

    <div class="container checkout-grid">
      <div class="card-panel stack-md">
        <h2 style="font-size:20px;font-weight:800;">Store Details</h2>
        <div class="stack-md" style="font-size:14.5px;">
          <div style="display:flex;gap:12px;">
            <span style="color:var(--red);">${icon('mapPin', 20)}</span>
            <div>
              <strong>Physical Address</strong>
              <p class="text-muted" style="margin-top:3px;">${escapeHtml(s.address)}</p>
            </div>
          </div>
          <div style="display:flex;gap:12px;">
            <span style="color:var(--red);">${icon('phone', 20)}</span>
            <div>
              <strong>Phone / Call</strong>
              <p class="text-muted tabular-nums" style="margin-top:3px;">${escapeHtml(s.phone_number)}</p>
            </div>
          </div>
          <div style="display:flex;gap:12px;">
            <span style="color:var(--green);">${icon('whatsapp', 20)}</span>
            <div>
              <strong>WhatsApp Ordering &amp; Support</strong>
              <p class="text-muted tabular-nums" style="margin-top:3px;">${escapeHtml(s.whatsapp_number)}</p>
            </div>
          </div>
        </div>

        <div class="flex-row" style="flex-wrap:wrap;padding-top:10px;">
          <a href="${buildGeneralSupportWhatsAppUrl('', s.whatsapp_number)}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp">
            ${icon('whatsapp', 16)}
            <span>Message on WhatsApp</span>
          </a>
          <a href="${BUSINESS_INFO.googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-black">
            ${icon('mapPin', 16)}
            <span>Directions on Google Maps</span>
          </a>
        </div>
      </div>

      <form id="contact-wa-form" class="card-panel stack-md">
        <h2 style="font-size:20px;font-weight:800;">Send a Quick Inquiry</h2>
        <div class="form-group">
          <label class="form-label">Your Name *</label>
          <input type="text" id="cnt-name" class="form-input" required placeholder="Your full name" />
        </div>
        <div class="form-group">
          <label class="form-label">Message / Gear Inquiry *</label>
          <textarea id="cnt-msg" class="form-textarea" required placeholder="Ask about helmet sizes, jacket availability, or delivery..."></textarea>
        </div>
        <button type="submit" class="btn btn-red btn-lg btn-block">Send Inquiry via WhatsApp</button>
      </form>
    </div>
  `;
}

export function bindContactPageEvents() {
  document.getElementById('contact-wa-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('cnt-name')?.value || '';
    const msg = document.getElementById('cnt-msg')?.value || '';
    const url = buildGeneralSupportWhatsAppUrl(
      `Hello Rock Danish Biker Stuff,\nName: ${name}\nInquiry: ${msg}`,
      store.siteSettings.whatsapp_number
    );
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}
