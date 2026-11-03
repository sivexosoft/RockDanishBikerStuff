import {
  bindSharedStorefrontEvents,
  renderAnnouncementBar,
  renderDrawers,
  renderFooter,
  renderHeader,
} from './components.js';
import {
  bindAuthPageEvents,
  bindCustomerAccountEvents,
  ensureCustomerOrdersLoaded,
  renderAuthPage,
  renderCustomerAccountPage,
  setAuthPageMode,
} from './pages/account.js';
import {
  bindAdminEvents,
  loadAdminDatasets,
  renderAdminShell,
} from './pages/admin.js';
import {
  bindProductDetailEvents,
  bindShopPageEvents,
  renderCategoriesPage,
  renderProductDetailPage,
  renderShopPage,
  renderWishlistPage,
  syncShopFiltersFromUrl,
} from './pages/catalog.js';
import {
  bindCartPageEvents,
  bindCheckoutPageEvents,
  bindContactPageEvents,
  bindTrackOrderEvents,
  renderAboutPage,
  renderCartPage,
  renderCheckoutPage,
  renderContactPage,
  renderTrackOrderPage,
  resetCompletedOrder,
} from './pages/checkout.js';
import { bindHomePageEvents, renderHomePage } from './pages/home.js';
import { subscribeToFirebaseAuth, syncOrFetchUserProfile } from './services.js';
import {
  notify,
  refreshStoreData,
  refreshWishlist,
  store,
  subscribe,
} from './state.js';

let lastPathRendered = '';

export function navigate(to) {
  const url = new URL(to, window.location.origin);
  if (url.pathname + url.search !== window.location.pathname + window.location.search) {
    window.history.pushState({}, '', url.pathname + url.search);
  }
  store.cartDrawerOpen = false;
  store.mobileMenuOpen = false;

  if (url.pathname === '/checkout') {
    resetCompletedOrder();
  }

  handleRouteChange(true);
}

async function handleRouteChange(scrollToTop = false) {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  if (scrollToTop || path !== lastPathRendered) {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  lastPathRendered = path;

  if (path === '/shop' || path === '/new-arrivals' || path === '/best-sellers' || path === '/deals') {
    const preset = path === '/shop' ? 'all' : path.slice(1);
    syncShopFiltersFromUrl(preset);
  }

  if (path === '/account' && store.firebaseUser) {
    await ensureCustomerOrdersLoaded();
  }

  if (path.startsWith('/admin') && store.isAdmin) {
    await loadAdminDatasets();
  }

  renderApp();
}

function renderNotFound() {
  return `
    <div class="container" style="padding:72px 16px;text-align:center;">
      <p style="font-size:12px;font-weight:800;color:var(--red);text-transform:uppercase;letter-spacing:0.08em;">404 Not Found</p>
      <h1 style="font-size:32px;font-weight:800;margin-top:6px;">Road Ends Here</h1>
      <p class="text-muted" style="margin:10px auto 24px;max-width:420px;">The page or gear item you are looking for may have moved or is no longer available.</p>
      <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
        <a href="/shop" data-link class="btn btn-red">Browse All Gear</a>
        <a href="/" data-link class="btn btn-outline">Back to Home</a>
      </div>
    </div>
  `;
}

function renderApp() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  // Admin Dashboard Shell
  if (path.startsWith('/admin')) {
    appEl.innerHTML = renderAdminShell(path);
    bindAdminEvents(renderApp, navigate);
    renderDrawers(navigate);
    return;
  }

  // Storefront Layout
  let mainHtml = '';
  let postBind = null;

  if (path === '/') {
    mainHtml = renderHomePage();
    postBind = () => bindHomePageEvents(renderApp);
  } else if (path === '/shop') {
    mainHtml = renderShopPage('all');
    postBind = () => bindShopPageEvents(renderApp);
  } else if (path === '/new-arrivals') {
    mainHtml = renderShopPage('new-arrivals');
    postBind = () => bindShopPageEvents(renderApp);
  } else if (path === '/best-sellers') {
    mainHtml = renderShopPage('best-sellers');
    postBind = () => bindShopPageEvents(renderApp);
  } else if (path === '/deals') {
    mainHtml = renderShopPage('deals');
    postBind = () => bindShopPageEvents(renderApp);
  } else if (path === '/categories') {
    mainHtml = renderCategoriesPage();
  } else if (path.startsWith('/category/')) {
    const slug = decodeURIComponent(path.replace('/category/', ''));
    const cat = store.categories.find((c) => c.slug === slug);
    navigate(cat ? `/shop?category=${encodeURIComponent(cat.name)}` : '/categories');
    return;
  } else if (path.startsWith('/product/')) {
    const slug = decodeURIComponent(path.replace('/product/', ''));
    mainHtml = renderProductDetailPage(slug);
    postBind = () => bindProductDetailEvents(slug, renderApp, navigate);
  } else if (path === '/wishlist') {
    mainHtml = renderWishlistPage();
  } else if (path === '/cart') {
    mainHtml = renderCartPage();
    postBind = () => bindCartPageEvents(renderApp);
  } else if (path === '/checkout') {
    mainHtml = renderCheckoutPage();
    postBind = () => bindCheckoutPageEvents(renderApp);
  } else if (path === '/track-order') {
    mainHtml = renderTrackOrderPage();
    postBind = () => bindTrackOrderEvents(renderApp);
  } else if (path === '/about') {
    mainHtml = renderAboutPage();
  } else if (path === '/contact') {
    mainHtml = renderContactPage();
    postBind = () => bindContactPageEvents();
  } else if (path === '/login' || path === '/register' || path === '/forgot-password') {
    if (store.firebaseUser) {
      navigate(store.isAdmin ? '/admin' : '/account');
      return;
    }
    setAuthPageMode(path === '/register' ? 'register' : path === '/forgot-password' ? 'forgot' : 'login');
    mainHtml = renderAuthPage();
    postBind = () => bindAuthPageEvents(navigate);
  } else if (path === '/account') {
    mainHtml = renderCustomerAccountPage();
    postBind = () => bindCustomerAccountEvents(renderApp, navigate);
  } else {
    mainHtml = renderNotFound();
  }

  appEl.innerHTML = `
    ${renderAnnouncementBar()}
    ${renderHeader(path)}
    <main>${mainHtml}</main>
    ${renderFooter()}
  `;

  bindSharedStorefrontEvents(appEl, navigate);
  if (postBind) postBind();
  renderDrawers(navigate);
}

// Intercept internal [data-link] navigation globally (zero full-page reloads)
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-link]');
  if (!link) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return;
  }
  e.preventDefault();
  navigate(href);
});

// Close instant search dropdown when clicking outside
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('desktop-search-wrap');
  const dropdown = document.getElementById('header-search-dropdown');
  if (dropdown && wrap && !wrap.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

window.addEventListener('popstate', () => {
  handleRouteChange(false);
});

// Subscribe UI rerender to store updates
subscribe(() => {
  renderApp();
});

// Bootstrap Auth + Catalog Data
async function initApp() {
  renderApp();

  subscribeToFirebaseAuth(async (fbUser) => {
    store.firebaseUser = fbUser;
    if (fbUser) {
      const profile = await syncOrFetchUserProfile(fbUser);
      store.profile = profile;
      store.isAdmin = profile?.role === 'admin';
      if (store.isAdmin && window.location.pathname.startsWith('/admin')) {
        await loadAdminDatasets();
      }
    } else {
      store.profile = null;
      store.isAdmin = false;
    }
    store.authLoading = false;
    await refreshWishlist();
    notify();
  });

  await Promise.all([refreshStoreData(), refreshWishlist()]);
}

initApp();
