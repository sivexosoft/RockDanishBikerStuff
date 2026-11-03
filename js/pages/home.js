import { renderProductCard } from '../components.js';
import { BUSINESS_INFO } from '../data.js';
import { submitCustomerReview } from '../services.js';
import { showToast, store } from '../state.js';
import {
  buildGeneralSupportWhatsAppUrl,
  escapeHtml,
  getDiscountPercent,
  icon,
  renderStars,
} from '../utils.js';

let activeFeaturedTab = 'featured';
let showReviewForm = false;

export function renderHomePage() {
  const s = store.siteSettings;
  const activeCategories = store.categories.filter((c) => c.is_active);
  const products = store.products;

  const featuredList = products.filter((p) => p.featured).slice(0, 4);
  const bestSellers = products.filter((p) => p.best_seller).slice(0, 4);
  const newArrivals = products.filter((p) => p.new_arrival).slice(0, 4);
  const dealProducts = products
    .filter((p) => getDiscountPercent(p) > 0 || p.featured_deal)
    .slice(0, 4);

  let tabItems = featuredList.length ? featuredList : products.slice(0, 4);
  if (activeFeaturedTab === 'best') {
    tabItems = bestSellers.length ? bestSellers : products.slice(0, 4);
  } else if (activeFeaturedTab === 'new') {
    tabItems = newArrivals.length ? newArrivals : products.slice(0, 4);
  } else if (activeFeaturedTab === 'deals') {
    tabItems = dealProducts.length ? dealProducts : products.slice(0, 4);
  }

  const heroHeadingHtml = s.hero_heading.includes('Ride Safe.')
    ? `Gear Up.<br />Ride Hard.<br /><span class="text-red">Ride Safe.</span>`
    : escapeHtml(s.hero_heading);

  return `
    <!-- 1. UNIFIED PANORAMIC HERO BANNER (Rider Integrated on Right, Never Stacked Below) -->
    <section class="hero-banner">
      <div class="hero-bg" aria-hidden="true">
        <img
          src="${escapeHtml(s.hero_image_url || '/images/banners/hero-rider.jpg')}"
          alt="Sportbike rider in protective red and black helmet, jacket, and gloves"
          onerror="this.src='/images/banners/hero-rider.jpg'"
        />
      </div>
      <div class="hero-overlay" aria-hidden="true"></div>

      <div class="container hero-content-wrap">
        <div class="hero-copy">
          <p class="hero-eyebrow">Motorcycle Gear &amp; Accessories &middot; Karachi, Pakistan</p>
          <h1 class="hero-title">${heroHeadingHtml}</h1>
          <p class="hero-subtitle">${escapeHtml(s.hero_subheading)}</p>

          <div class="hero-cta-row">
            <a href="/shop" data-link class="btn btn-lg btn-pill btn-red">
              <span>Shop Now</span>
              ${icon('arrowRight', 17)}
            </a>
            <a href="/categories" data-link class="btn btn-lg btn-pill btn-outline">
              <span>Explore Categories</span>
            </a>
          </div>

          <div class="hero-meta">
            <span style="display:inline-flex;align-items:center;gap:6px;font-weight:600;">
              ${icon('starFill', 15)}
              <strong class="tabular-nums">${escapeHtml(s.google_rating)} / 5</strong>
              Google Rating (${escapeHtml(s.google_review_count)} Reviews)
            </span>
            <span aria-hidden="true">&middot;</span>
            <span style="font-weight:600;">Korangi Sector 48-B, Karachi</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. TRUST FEATURES (Clean White Section) -->
    <section class="section-white section-tight">
      <div class="container">
        <div class="trust-grid">
          <div class="trust-card">
            <div class="icon-box-red">${icon('shield', 20)}</div>
            <div>
              <h2 style="font-size:14.5px;font-weight:800;">Quality Biker Gear</h2>
              <p class="text-muted" style="font-size:12.5px;margin-top:3px;">
                Protective helmets, armored jackets, gloves, and durable riding accessories.
              </p>
            </div>
          </div>

          <div class="trust-card">
            <div class="icon-box-red">${icon('tag', 20)}</div>
            <div>
              <h2 style="font-size:14.5px;font-weight:800;">Competitive Prices</h2>
              <p class="text-muted" style="font-size:12.5px;margin-top:3px;">
                Honest, rider-friendly PKR pricing across essential daily and touring gear.
              </p>
            </div>
          </div>

          <div class="trust-card">
            <div class="icon-box-red">${icon('whatsapp', 20)}</div>
            <div>
              <h2 style="font-size:14.5px;font-weight:800;">Easy WhatsApp Ordering</h2>
              <p class="text-muted" style="font-size:12.5px;margin-top:3px;">
                Order with exact SKU references directly on ${escapeHtml(s.whatsapp_number)}.
              </p>
            </div>
          </div>

          <div class="trust-card">
            <div class="icon-box-red">${icon('headphones', 20)}</div>
            <div>
              <h2 style="font-size:14.5px;font-weight:800;">Customer Support</h2>
              <p class="text-muted" style="font-size:12.5px;margin-top:3px;">
                Sizing guidance and availability help from our Korangi, Karachi store.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. SHOP BY CATEGORY (Light Gray #F5F5F5) -->
    <section class="section-gray">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="section-title">Shop By Category</h2>
            <p class="section-desc">Explore helmets, jackets, gloves, boots, covers, and motorcycle accessories.</p>
          </div>
          <a href="/categories" data-link class="section-link">
            <span>View All Categories</span>
            ${icon('arrowRight', 16)}
          </a>
        </div>

        <div class="category-grid">
          ${activeCategories
            .slice(0, 8)
            .map((cat) => {
              const count = products.filter((p) => p.category_name === cat.name).length;
              return `
                <div class="category-card">
                  <a href="/shop?category=${encodeURIComponent(cat.name)}" data-link>
                    <img
                      src="${escapeHtml(cat.image_url)}"
                      alt="${escapeHtml(cat.name)}"
                      class="category-thumb"
                      loading="lazy"
                      onerror="this.src='/images/products/helmet-pro.jpg'"
                    />
                  </a>
                  <h3 class="category-name">${escapeHtml(cat.name)}</h3>
                  <p class="category-desc">${escapeHtml(cat.short_description)}</p>
                  <span class="text-subtle tabular-nums" style="font-size:11.5px;">${count} ${count === 1 ? 'product' : 'products'}</span>
                  <a href="/shop?category=${encodeURIComponent(cat.name)}" data-link class="btn btn-sm btn-red">
                    <span>View Products</span>
                    ${icon('arrowRight', 13)}
                  </a>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    </section>

    <!-- 4. FEATURED PRODUCTS WITH TABS (Clean White Section) -->
    <section class="section-white">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="section-title">Featured Products</h2>
            <p class="section-desc">
              Handpicked helmets, riding jackets, gloves, and touring essentials.${
                store.usingSampleCatalog
                  ? ' (Sample catalog shown until live store items are added)'
                  : ''
              }
            </p>
          </div>

          <div class="tab-pills">
            <button type="button" class="tab-pill ${activeFeaturedTab === 'featured' ? 'active' : ''}" data-home-tab="featured">Featured</button>
            <button type="button" class="tab-pill ${activeFeaturedTab === 'best' ? 'active' : ''}" data-home-tab="best">Best Sellers</button>
            <button type="button" class="tab-pill ${activeFeaturedTab === 'new' ? 'active' : ''}" data-home-tab="new">New Arrivals</button>
            <button type="button" class="tab-pill ${activeFeaturedTab === 'deals' ? 'active' : ''}" data-home-tab="deals">Special Deals</button>
          </div>
        </div>

        <div class="product-grid">
          ${tabItems.map((p) => renderProductCard(p)).join('')}
        </div>
      </div>
    </section>

    <!-- 5. BEST SELLERS (Light Gray #F5F5F5) -->
    <section class="section-gray">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="section-title">Best Sellers</h2>
            <p class="section-desc">Popular riding gear frequently ordered by bikers in Karachi and across Pakistan.</p>
          </div>
          <a href="/best-sellers" data-link class="section-link">
            <span>View All Best Sellers</span>
            ${icon('arrowRight', 16)}
          </a>
        </div>

        <div class="product-grid">
          ${(bestSellers.length ? bestSellers : products.slice(0, 4)).map((p) => renderProductCard(p)).join('')}
        </div>
      </div>
    </section>

    <!-- 6. PROMOTIONAL BANNERS (Clean White Section) -->
    <section class="section-white">
      <div class="container">
        <div class="promo-grid">
          <div class="promo-card">
            <div>
              <span style="font-size:12px;font-weight:800;color:var(--red);">Seasonal Offers</span>
              <h3 style="font-size:22px;font-weight:800;margin-top:4px;">Exclusive Deals on Riding Protection</h3>
              <p class="text-muted" style="font-size:13.5px;margin-top:8px;">
                Save on selected full-face helmets, armored jackets, and touring boots while stock lasts.
              </p>
            </div>
            <div class="promo-bottom">
              <a href="/deals" data-link class="btn btn-red">
                <span>Shop Deals</span>
                ${icon('arrowRight', 15)}
              </a>
              <img src="/images/products/helmet-pro.jpg" alt="Full face helmet" class="promo-thumb" />
            </div>
          </div>

          <div class="promo-card promo-white">
            <div>
              <span style="font-size:12px;font-weight:800;color:var(--black);">Touring &amp; Commute</span>
              <h3 style="font-size:22px;font-weight:800;margin-top:4px;">Gear Up For Your Next Ride</h3>
              <p class="text-muted" style="font-size:13.5px;margin-top:8px;">
                From daily Korangi &amp; Shahrah-e-Faisal commutes to northern highway tours, ride prepared.
              </p>
            </div>
            <div class="promo-bottom">
              <a href="/shop?category=Riding%20Jackets" data-link class="btn btn-black">
                <span>Explore Jackets</span>
                ${icon('arrowRight', 15)}
              </a>
              <img src="/images/products/jacket-armored.jpg" alt="Riding jacket" class="promo-thumb" />
            </div>
          </div>

          <div class="promo-card">
            <div>
              <span style="font-size:12px;font-weight:800;color:var(--red);">Everyday Essentials</span>
              <h3 style="font-size:22px;font-weight:800;margin-top:4px;">Ride Ready. Every Time.</h3>
              <p class="text-muted" style="font-size:13.5px;margin-top:8px;">
                Explore weatherproof bike covers, alloy phone mounts, carbon gloves, and body armor rigs.
              </p>
            </div>
            <div class="promo-bottom">
              <a href="/new-arrivals" data-link class="btn btn-red">
                <span>Latest Gear</span>
                ${icon('arrowRight', 15)}
              </a>
              <img src="/images/products/gloves-carbon.jpg" alt="Riding gloves" class="promo-thumb" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 7. NEW ARRIVALS (Light Gray #F5F5F5) -->
    <section class="section-gray">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="section-title">New Arrivals</h2>
            <p class="section-desc">Explore our latest biker gear, protective apparel, and motorcycle add-ons.</p>
          </div>
          <a href="/new-arrivals" data-link class="section-link">
            <span>See All New Arrivals</span>
            ${icon('arrowRight', 16)}
          </a>
        </div>

        <div class="product-grid">
          ${(newArrivals.length ? newArrivals : products.slice(4, 8)).map((p) => renderProductCard(p)).join('')}
        </div>
      </div>
    </section>

    <!-- 8. DEALS / DISCOUNTS (Clean White Section) -->
    ${
      dealProducts.length > 0
        ? `
      <section class="section-white">
        <div class="container">
          <div class="section-header">
            <div>
              <h2 class="section-title">Deals &amp; Special Offers</h2>
              <p class="section-desc">Discounted motorcycle gear and value items currently available in store.</p>
            </div>
            <a href="/deals" data-link class="section-link">
              <span>View All Deals</span>
              ${icon('arrowRight', 16)}
            </a>
          </div>
          <div class="product-grid">
            ${dealProducts.map((p) => renderProductCard(p)).join('')}
          </div>
        </div>
      </section>
    `
        : ''
    }

    <!-- 9. WHY CHOOSE US (Light Gray #F5F5F5) -->
    <section class="section-gray">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="section-title">Why Choose Rock Danish Biker Stuff</h2>
            <p class="section-desc">Practical motorcycle gear backed by straightforward service and direct rider communication.</p>
          </div>
        </div>

        <div class="features-grid-3">
          <div class="feature-box">
            <div class="icon-box-red">${icon('shield', 20)}</div>
            <div>
              <h3 style="font-size:15.5px;font-weight:800;">Quality Products</h3>
              <p class="text-muted" style="font-size:13.5px;margin-top:4px;">Carefully selected jackets, helmets, gloves, boots, and armor built for real road use.</p>
            </div>
          </div>
          <div class="feature-box">
            <div class="icon-box-red">${icon('tag', 20)}</div>
            <div>
              <h3 style="font-size:15.5px;font-weight:800;">Competitive Pricing</h3>
              <p class="text-muted" style="font-size:13.5px;margin-top:4px;">Fair, accessible PKR pricing so riders can invest in proper safety gear.</p>
            </div>
          </div>
          <div class="feature-box">
            <div class="icon-box-red">${icon('truck', 20)}</div>
            <div>
              <h3 style="font-size:15.5px;font-weight:800;">Easy Ordering</h3>
              <p class="text-muted" style="font-size:13.5px;margin-top:4px;">Add products to your cart and generate an itemized WhatsApp order with exact SKUs in seconds.</p>
            </div>
          </div>
          <div class="feature-box">
            <div class="icon-box-red">${icon('headphones', 20)}</div>
            <div>
              <h3 style="font-size:15.5px;font-weight:800;">Customer Support</h3>
              <p class="text-muted" style="font-size:13.5px;margin-top:4px;">Direct responses regarding sizing, stock availability, and order confirmation via phone or WhatsApp.</p>
            </div>
          </div>
          <div class="feature-box">
            <div class="icon-box-red">${icon('mapPin', 20)}</div>
            <div>
              <h3 style="font-size:15.5px;font-weight:800;">Karachi Based</h3>
              <p class="text-muted" style="font-size:13.5px;margin-top:4px;">Visit our shop at Al Rahman Tower, Sector 48-B Korangi, near Coast Guard Chowrangi, Karachi.</p>
            </div>
          </div>
          <div class="feature-box">
            <div class="icon-box-red">${icon('package', 20)}</div>
            <div>
              <h3 style="font-size:15.5px;font-weight:800;">Biker Focused</h3>
              <p class="text-muted" style="font-size:13.5px;margin-top:4px;">Curated specifically around the everyday needs of Pakistani street commuters and highway tourers.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 10. GENUINE GOOGLE & CUSTOMER REVIEWS (Clean White Section) -->
    <section class="section-white">
      <div class="container">
        <div class="section-header">
          <div>
            <h2 class="section-title">What Riders Say</h2>
            <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:6px;font-size:13.5px;">
              ${renderStars(s.google_rating, 16)}
              <strong class="tabular-nums">${escapeHtml(s.google_rating)} / 5 on Google Business</strong>
              <span class="text-subtle">&middot;</span>
              <span class="text-muted tabular-nums">Based on ${escapeHtml(s.google_review_count)} Google Reviews</span>
            </div>
          </div>

          ${
            store.firebaseUser
              ? `<button type="button" class="btn btn-outline" id="toggle-review-form-btn">${
                  showReviewForm ? 'Close Review Form' : 'Write a Customer Review'
                }</button>`
              : `<a href="/login" data-link class="btn btn-outline">Sign In to Leave a Review</a>`
          }
        </div>

        ${
          showReviewForm && store.firebaseUser
            ? `
          <form id="home-review-form" class="card-panel stack-md" style="max-width:600px;margin-bottom:28px;background:var(--gray-bg);">
            <h3 style="font-size:16px;font-weight:800;">Share Your Experience</h3>
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Rating</label>
                <select id="rev-rating" class="form-select">
                  <option value="5">5 Stars - Excellent</option>
                  <option value="4">4 Stars - Very Good</option>
                  <option value="3">3 Stars - Good</option>
                  <option value="2">2 Stars - Fair</option>
                  <option value="1">1 Star - Poor</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">City</label>
                <input type="text" id="rev-city" class="form-input" value="${escapeHtml(store.profile?.city || 'Karachi')}" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Your Review *</label>
              <textarea id="rev-comment" class="form-textarea" required placeholder="Tell fellow riders about the gear quality and your experience..."></textarea>
            </div>
            <div>
              <button type="submit" class="btn btn-red">Submit Review</button>
            </div>
          </form>
        `
            : ''
        }

        <div class="features-grid-3">
          ${store.reviews
            .slice(0, 6)
            .map(
              (rev) => `
            <div class="review-card">
              <div class="stack-sm">
                <div class="flex-between">
                  ${renderStars(rev.rating, 14)}
                  <span class="badge ${rev.source === 'Google' ? 'badge-gray' : 'badge-green'}">
                    ${rev.source === 'Google' ? 'Google Review' : 'Store Customer'}
                  </span>
                </div>
                <p style="font-size:14.5px;font-weight:600;line-height:1.55;">&ldquo;${escapeHtml(rev.comment)}&rdquo;</p>
              </div>
              <div class="flex-between" style="padding-top:12px;border-top:1px solid var(--border);font-size:12px;">
                <strong>${escapeHtml(rev.reviewer_name)}</strong>
                <span class="text-muted">${escapeHtml(rev.city || 'Karachi')}</span>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </section>

    <!-- 11. WHATSAPP ORDERING CTA (Strategic Dark Section) -->
    <section class="section-dark">
      <div class="container flex-between" style="gap:24px;">
        <div style="max-width:620px;">
          <h2 style="color:#fff;font-size:clamp(1.45rem,2.4vw,1.9rem);font-weight:800;">Need Help Choosing Your Gear?</h2>
          <p style="color:#D4D4D4;font-size:14.5px;margin-top:6px;">
            Talk to Rock Danish Biker Stuff on WhatsApp for sizing advice, live stock checks, or instant ordering.
          </p>
        </div>
        <div class="flex-row" style="flex-wrap:wrap;">
          <a
            href="${buildGeneralSupportWhatsAppUrl('', s.whatsapp_number)}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-lg btn-whatsapp"
          >
            ${icon('whatsapp', 19)}
            <span>Chat on WhatsApp</span>
          </a>
          <a
            href="tel:${escapeHtml(s.phone_number.replace(/\s+/g, ''))}"
            class="btn btn-lg"
            style="border:1px solid #404040;color:#fff;background:#1C1C1C;"
          >
            <span style="color:var(--red);">${icon('phone', 17)}</span>
            <span class="tabular-nums">${escapeHtml(s.phone_number)}</span>
          </a>
        </div>
      </div>
    </section>

    <!-- 12. COMMUNITY UPDATES & KARACHI STORE LOCATION (Light Gray #F5F5F5) -->
    <section class="section-gray">
      <div class="container community-split">
        <div class="card-panel stack-md" style="justify-content:space-between;display:flex;flex-direction:column;">
          <div class="stack-sm">
            <span style="font-size:12px;font-weight:800;color:var(--red);">Rider Updates</span>
            <h2 style="font-size:22px;font-weight:800;">Join the Rider Community</h2>
            <p class="text-muted" style="font-size:13.5px;">
              Stay updated on new helmet drops, riding jacket restocks, and seasonal offers from Rock Danish Biker Stuff.
            </p>
            <form id="community-form" style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
              <input
                type="email"
                id="community-email"
                class="form-input"
                style="flex:1;min-width:200px;background:var(--gray-bg);"
                placeholder="Enter your email address"
                required
              />
              <button type="submit" class="btn btn-red">Get Updates</button>
            </form>
          </div>

          <div style="padding-top:16px;border-top:1px solid var(--border);font-size:12.5px;display:flex;gap:12px;flex-wrap:wrap;">
            <strong>Follow Us:</strong>
            <a href="${escapeHtml(s.facebook_url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;">Facebook</a>
            <span>&middot;</span>
            <a href="${escapeHtml(s.instagram_url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;">Instagram</a>
            <span>&middot;</span>
            <a href="${escapeHtml(s.youtube_url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;">YouTube</a>
          </div>
        </div>

        <div class="card-panel stack-md" style="justify-content:space-between;display:flex;flex-direction:column;">
          <div class="stack-sm">
            <span style="font-size:12px;font-weight:800;color:var(--red);">Visit Our Karachi Shop</span>
            <h2 style="font-size:22px;font-weight:800;">${escapeHtml(BUSINESS_INFO.name)}</h2>
            <div class="stack-sm" style="margin-top:8px;font-size:14px;">
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <span style="color:var(--red);margin-top:2px;">${icon('mapPin', 18)}</span>
                <div>
                  <strong>Store Address</strong>
                  <p class="text-muted" style="margin-top:2px;">${escapeHtml(s.address)}</p>
                </div>
              </div>
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <span style="color:var(--red);margin-top:2px;">${icon('phone', 18)}</span>
                <div>
                  <strong>Phone &amp; WhatsApp</strong>
                  <p class="text-muted tabular-nums" style="margin-top:2px;">
                    Phone: ${escapeHtml(s.phone_number)} &middot; WhatsApp: ${escapeHtml(s.whatsapp_number)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style="padding-top:16px;border-top:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap;">
            <a href="${BUSINESS_INFO.googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-black">
              ${icon('mapPin', 15)}
              <span>Open in Google Maps</span>
            </a>
            <a href="${buildGeneralSupportWhatsAppUrl('', s.whatsapp_number)}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp">
              ${icon('whatsapp', 15)}
              <span>WhatsApp Store</span>
            </a>
            <a href="/contact" data-link class="btn btn-outline">Full Contact Details</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function bindHomePageEvents(rerenderFn) {
  document.querySelectorAll('[data-home-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeFeaturedTab = btn.getAttribute('data-home-tab') || 'featured';
      rerenderFn();
    });
  });

  document.getElementById('toggle-review-form-btn')?.addEventListener('click', () => {
    showReviewForm = !showReviewForm;
    rerenderFn();
  });

  document.getElementById('home-review-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!store.firebaseUser || !store.profile) {
      showToast('Please sign in to submit a review.', 'error');
      return;
    }
    const rating = Number(document.getElementById('rev-rating')?.value || 5);
    const city = document.getElementById('rev-city')?.value || 'Karachi';
    const comment = document.getElementById('rev-comment')?.value || '';
    if (comment.trim().length < 8) {
      showToast('Please write at least 8 characters.', 'error');
      return;
    }
    try {
      await submitCustomerReview({
        user_id: store.firebaseUser.uid,
        reviewer_name: store.profile.full_name || store.profile.email.split('@')[0],
        city,
        rating,
        comment,
      });
      showReviewForm = false;
      showToast('Thank you! Your review has been submitted for approval.', 'success');
      rerenderFn();
    } catch (err) {
      showToast(err.message || 'Could not submit review.', 'error');
    }
  });

  document.getElementById('community-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('community-email');
    if (input && input.value.includes('@')) {
      showToast('Joined Rock Danish rider updates list!', 'success');
      input.value = '';
    }
  });
}
