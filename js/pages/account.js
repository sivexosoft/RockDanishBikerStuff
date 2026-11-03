import { renderProductCard } from '../components.js';
import { isFirebaseConfigured } from '../config.js';
import { PAKISTAN_CITIES } from '../data.js';
import {
  fetchCustomerOrders,
  registerCustomerEmail,
  sendCustomerPasswordReset,
  signInCustomerEmail,
  signInCustomerGoogle,
  signOutCurrentUser,
  updateCustomerProfile,
} from '../services.js';
import { notify, showToast, store } from '../state.js';
import {
  buildOrderWhatsAppMessage,
  escapeHtml,
  formatDateShort,
  formatPKR,
  icon,
} from '../utils.js';

let authMode = 'login';
let accountTab = 'profile';
let customerOrdersCache = [];
let ordersLoadedForUid = null;

export function setAuthPageMode(mode) {
  authMode = mode;
}

export function renderAuthPage() {
  const titleMap = {
    login: 'Sign In to Your Account',
    register: 'Create Customer Account',
    forgot: 'Reset Your Password',
  };

  return `
    <div style="background:var(--gray-bg);min-height:74vh;display:flex;align-items:center;justify-content:center;padding:44px 16px;">
      <div class="card-panel stack-md" style="max-width:450px;width:100%;">
        <div style="text-align:center;">
          <img src="/images/logo-on-white.png" alt="Rock Danish Biker Stuff" style="height:54px;margin:0 auto 12px;" />
          <h1 style="font-size:22px;font-weight:800;">${escapeHtml(titleMap[authMode])}</h1>
          <p class="text-muted" style="font-size:13px;margin-top:4px;">
            Manage your orders, saved wishlist, and delivery details.
          </p>
        </div>

        ${
          !isFirebaseConfigured
            ? `<div style="padding:12px;border-radius:8px;background:var(--amber-soft);border:1px solid #FDE68A;font-size:12.5px;color:#92400E;">
                <strong>Setup Notice:</strong> Add your public <code>VITE_FIREBASE_*</code> keys in <code>.env</code> to activate live Firebase Sign-In and Google Authentication.
              </div>`
            : ''
        }

        <div id="auth-error-box" style="display:none;padding:11px 13px;border-radius:8px;background:var(--red-soft);border:1px solid var(--red-border);color:#991B1B;font-size:13px;font-weight:600;"></div>

        ${
          authMode !== 'forgot'
            ? `
          <button type="button" id="google-login-btn" class="btn btn-lg btn-outline btn-block">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            <span>Continue with Google</span>
          </button>

          <div style="display:flex;align-items:center;gap:12px;font-size:12px;color:var(--text-subtle);">
            <span style="flex:1;height:1px;background:var(--border);"></span>
            <strong>OR</strong>
            <span style="flex:1;height:1px;background:var(--border);"></span>
          </div>
        `
            : ''
        }

        <form id="auth-main-form" class="stack-md">
          ${
            authMode === 'register'
              ? `
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="auth-name" class="form-input" required placeholder="Your full name" />
            </div>
          `
              : ''
          }

          <div class="form-group">
            <label class="form-label">Email Address *</label>
            <input type="email" id="auth-email" class="form-input" required placeholder="you@example.com" />
          </div>

          ${
            authMode !== 'forgot'
              ? `
            <div class="form-group">
              <div class="flex-between">
                <label class="form-label">Password *</label>
                ${
                  authMode === 'login'
                    ? `<a href="/forgot-password" data-link style="font-size:12px;font-weight:700;color:var(--red);">Forgot Password?</a>`
                    : ''
                }
              </div>
              <input type="password" id="auth-password" class="form-input" required minlength="6" placeholder="••••••••" />
            </div>
          `
              : ''
          }

          <button type="submit" id="auth-submit-btn" class="btn btn-lg btn-red btn-block">
            ${authMode === 'login' ? 'Sign In' : authMode === 'register' ? 'Create Account' : 'Send Password Reset Link'}
          </button>
        </form>

        <div style="text-align:center;font-size:13px;padding-top:8px;border-top:1px solid var(--border);">
          ${
            authMode === 'login'
              ? `New customer? <a href="/register" data-link style="font-weight:700;color:var(--red);">Create Account</a>`
              : `Already have an account? <a href="/login" data-link style="font-weight:700;color:var(--red);">Sign In</a>`
          }
        </div>
      </div>
    </div>
  `;
}

export function bindAuthPageEvents(navigateFn) {
  const showErr = (msg) => {
    const box = document.getElementById('auth-error-box');
    if (box) {
      box.textContent = msg;
      box.style.display = 'block';
    }
  };

  document.getElementById('google-login-btn')?.addEventListener('click', async () => {
    try {
      const prof = await signInCustomerGoogle();
      showToast(`Signed in as ${prof.full_name || prof.email}`, 'success');
      navigateFn(prof.role === 'admin' ? '/admin' : '/account');
    } catch (err) {
      showErr(err.message);
    }
  });

  document.getElementById('auth-main-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('auth-submit-btn');
    if (btn) btn.disabled = true;

    const email = document.getElementById('auth-email')?.value || '';
    const password = document.getElementById('auth-password')?.value || '';
    const name = document.getElementById('auth-name')?.value || '';

    try {
      if (authMode === 'forgot') {
        await sendCustomerPasswordReset(email);
        showToast('Password reset email sent! Check your inbox.', 'success');
        navigateFn('/login');
      } else if (authMode === 'register') {
        const prof = await registerCustomerEmail(name, email, password);
        showToast('Account created!', 'success');
        navigateFn(prof.role === 'admin' ? '/admin' : '/account');
      } else {
        const prof = await signInCustomerEmail(email, password);
        showToast(`Welcome back, ${prof.full_name || prof.email}`, 'success');
        navigateFn(prof.role === 'admin' ? '/admin' : '/account');
      }
    } catch (err) {
      showErr(err.message);
      if (btn) btn.disabled = false;
    }
  });
}

// ============================================================================
// PROTECTED CUSTOMER ACCOUNT DASHBOARD (/account)
// ============================================================================
export async function ensureCustomerOrdersLoaded() {
  if (!store.firebaseUser) return;
  if (ordersLoadedForUid === store.firebaseUser.uid) return;
  customerOrdersCache = await fetchCustomerOrders(
    store.firebaseUser.uid,
    store.profile?.email || store.firebaseUser.email
  );
  ordersLoadedForUid = store.firebaseUser.uid;
}

export function renderCustomerAccountPage() {
  if (!store.firebaseUser) {
    return `
      <div class="container" style="padding:64px 16px;text-align:center;">
        <h1 style="font-size:22px;font-weight:800;">Please Sign In</h1>
        <p class="text-muted" style="margin:8px 0 20px;">Sign in to view your profile, order history, and wishlist.</p>
        <a href="/login" data-link class="btn btn-red">Go to Login</a>
      </div>
    `;
  }

  const prof = store.profile || {};
  const wishProducts = store.products.filter((p) => store.wishlistIds.includes(p.id));

  return `
    <div class="page-banner">
      <div class="container flex-between">
        <div>
          <h1 style="font-size:clamp(1.6rem,3vw,2.1rem);font-weight:800;">My Rider Account</h1>
          <p class="text-muted" style="font-size:13.5px;margin-top:3px;">Signed in as <strong>${escapeHtml(prof.email || store.firebaseUser.email)}</strong></p>
        </div>
        <div class="flex-row">
          ${
            store.isAdmin
              ? `<a href="/admin" data-link class="btn btn-red">${icon('shield', 16)}<span>Open Admin Dashboard</span></a>`
              : ''
          }
          <button type="button" id="acc-logout-btn" class="btn btn-outline">${icon('logout', 16)}<span>Logout</span></button>
        </div>
      </div>
    </div>

    <div class="container" style="padding:32px 16px 64px;">
      <div class="tab-pills" style="margin-bottom:24px;">
        <button type="button" class="tab-pill ${accountTab === 'profile' ? 'active' : ''}" data-acc-tab="profile">Profile &amp; Address</button>
        <button type="button" class="tab-pill ${accountTab === 'orders' ? 'active' : ''}" data-acc-tab="orders">My Orders (${customerOrdersCache.length})</button>
        <button type="button" class="tab-pill ${accountTab === 'wishlist' ? 'active' : ''}" data-acc-tab="wishlist">Saved Wishlist (${wishProducts.length})</button>
      </div>

      ${
        accountTab === 'profile'
          ? `
        <form id="acc-profile-form" class="card-panel stack-md" style="max-width:680px;">
          <h2 style="font-size:18px;font-weight:800;">Update Delivery &amp; Contact Profile</h2>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="prof-name" class="form-input" value="${escapeHtml(prof.full_name || '')}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Email (Verified Login)</label>
              <input type="email" class="form-input" value="${escapeHtml(prof.email || store.firebaseUser.email)}" disabled style="background:var(--gray-bg);" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="tel" id="prof-phone" class="form-input tabular-nums" value="${escapeHtml(prof.phone || '')}" placeholder="0300 1234567" />
            </div>
            <div class="form-group">
              <label class="form-label">WhatsApp Number</label>
              <input type="tel" id="prof-wa" class="form-input tabular-nums" value="${escapeHtml(prof.whatsapp || '')}" placeholder="0300 1234567" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">City</label>
            <select id="prof-city" class="form-select">
              ${PAKISTAN_CITIES.map(
                (c) => `<option value="${escapeHtml(c)}" ${(prof.city || 'Karachi') === c ? 'selected' : ''}>${escapeHtml(c)}</option>`
              ).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Default Delivery Address</label>
            <textarea id="prof-addr" class="form-textarea">${escapeHtml(prof.address || '')}</textarea>
          </div>

          <div>
            <button type="submit" class="btn btn-red">Save Profile Changes</button>
          </div>
        </form>
      `
          : accountTab === 'orders'
            ? customerOrdersCache.length === 0
              ? `<div class="empty-box"><p style="font-weight:700;">No orders placed yet</p><p class="text-muted" style="margin:6px 0 16px;font-size:13.5px;">Orders placed while signed in appear here automatically.</p><a href="/shop" data-link class="btn btn-red">Shop Gear</a></div>`
              : `<div class="stack-md">
                  ${customerOrdersCache
                    .map((ord) => {
                      const waLink = buildOrderWhatsAppMessage(
                        ord,
                        store.siteSettings.whatsapp_number
                      );
                      return `
                        <div class="card-panel stack-sm">
                          <div class="flex-between">
                            <div>
                              <strong class="font-mono">${escapeHtml(ord.order_number)}</strong>
                              <span class="text-subtle" style="font-size:12px;margin-left:8px;">${formatDateShort(ord.created_at)}</span>
                            </div>
                            <span class="badge badge-red">${escapeHtml(ord.status)}</span>
                          </div>
                          <div class="flex-between" style="padding-top:8px;border-top:1px solid var(--border);">
                            <span class="tabular-nums">Total: <strong style="color:var(--red);">${formatPKR(ord.total)}</strong></span>
                            <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-whatsapp">
                              ${icon('whatsapp', 14)}
                              <span>Send on WhatsApp</span>
                            </a>
                          </div>
                        </div>
                      `;
                    })
                    .join('')}
                </div>`
            : wishProducts.length === 0
              ? `<div class="empty-box"><p style="font-weight:700;">No saved wishlist items</p></div>`
              : `<div class="product-grid">${wishProducts.map((p) => renderProductCard(p)).join('')}</div>`
      }
    </div>
  `;
}

export function bindCustomerAccountEvents(rerenderFn, navigateFn) {
  document.querySelectorAll('[data-acc-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      accountTab = btn.getAttribute('data-acc-tab') || 'profile';
      rerenderFn();
    });
  });

  document.getElementById('acc-logout-btn')?.addEventListener('click', async () => {
    await signOutCurrentUser();
    ordersLoadedForUid = null;
    showToast('Signed out', 'info');
    navigateFn('/');
  });

  document.getElementById('acc-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!store.firebaseUser) return;
    try {
      const updated = await updateCustomerProfile(store.firebaseUser.uid, {
        full_name: document.getElementById('prof-name')?.value || '',
        phone: document.getElementById('prof-phone')?.value || '',
        whatsapp: document.getElementById('prof-wa')?.value || '',
        city: document.getElementById('prof-city')?.value || 'Karachi',
        address: document.getElementById('prof-addr')?.value || '',
      });
      store.profile = { ...store.profile, ...updated };
      notify();
      showToast('Profile saved!', 'success');
    } catch (err) {
      showToast(err.message || 'Could not update profile.', 'error');
    }
  });
}
