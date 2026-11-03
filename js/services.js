import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  firebaseAuth,
  googleProvider,
  isFirebaseConfigured,
  isSupabaseConfigured,
  supabase,
} from './config.js';
import {
  AUTHORIZED_ADMIN_EMAILS,
  DEFAULT_SITE_SETTINGS,
  GENUINE_GOOGLE_REVIEWS,
  INITIAL_CATEGORIES,
  SAMPLE_PRODUCTS,
} from './data.js';
import { generateOrderNumber, slugify } from './utils.js';

const LS_KEYS = {
  products: 'rdbs_local_products_v1',
  categories: 'rdbs_local_categories_v1',
  coupons: 'rdbs_local_coupons_v1',
  discounts: 'rdbs_local_discounts_v1',
  reviews: 'rdbs_local_reviews_v1',
  settings: 'rdbs_local_settings_v1',
  wishlist: 'rdbs_local_wishlist_v1',
  orders: 'rdbs_local_orders_v1',
  profiles: 'rdbs_local_profiles_v1',
};

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage quota issues
  }
}

// ============================================================================
// 1. FIREBASE AUTHENTICATION & ADMIN ROLE AUTHORIZATION
// ============================================================================
function friendlyAuthError(err) {
  const msg = String(err?.message || '');
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
    return 'Incorrect email or password. Please verify your credentials.';
  }
  if (msg.includes('auth/user-not-found')) {
    return 'No account found with this email address.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'Password should be at least 6 characters long.';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completing login.';
  }
  if (msg.includes('auth/unauthorized-domain')) {
    return 'This domain is not yet authorized in Firebase Console -> Authentication -> Settings -> Authorized domains.';
  }
  return msg || 'Authentication failed. Please try again.';
}

export async function resolveUserRoleSecurely(fbUser) {
  if (!fbUser || !fbUser.email) return 'customer';
  const normalizedEmail = fbUser.email.trim().toLowerCase();

  try {
    const tokenResult = await fbUser.getIdTokenResult();
    if (tokenResult?.claims?.admin === true || tokenResult?.claims?.role === 'admin') {
      return 'admin';
    }
  } catch {
    // Continue to server/allowlist check
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('is_admin');
      if (!error && data === true) {
        return 'admin';
      }
    } catch {
      // Fallback to allowlist check
    }
  }

  const isAllowlisted = AUTHORIZED_ADMIN_EMAILS.some(
    (allowed) => allowed.toLowerCase() === normalizedEmail
  );
  return isAllowlisted ? 'admin' : 'customer';
}

export async function syncOrFetchUserProfile(fbUser, displayNameFallback = '') {
  const role = await resolveUserRoleSecurely(fbUser);
  const email = (fbUser.email || '').trim().toLowerCase();
  const fullName =
    displayNameFallback.trim() || fbUser.displayName || email.split('@')[0] || 'Rider';

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', fbUser.uid)
        .maybeSingle();

      if (existing) {
        if (existing.role !== role) {
          await supabase.from('profiles').update({ role }).eq('id', fbUser.uid);
        }
        return { ...existing, role };
      }

      const newProfile = {
        id: fbUser.uid,
        email,
        full_name: fullName,
        phone: '',
        whatsapp: '',
        address: '',
        city: 'Karachi',
        role,
      };
      const { data: created, error } = await supabase
        .from('profiles')
        .upsert(newProfile)
        .select('*')
        .single();
      if (!error && created) return created;
    } catch {
      // Fallback to local profile cache
    }
  }

  const profiles = readLocal(LS_KEYS.profiles, {});
  const cached = profiles[fbUser.uid] || {
    id: fbUser.uid,
    email,
    full_name: fullName,
    phone: '',
    whatsapp: '',
    address: '',
    city: 'Karachi',
    role,
    created_at: new Date().toISOString(),
  };
  const merged = { ...cached, email, role, full_name: cached.full_name || fullName };
  profiles[fbUser.uid] = merged;
  writeLocal(LS_KEYS.profiles, profiles);
  return merged;
}

export function subscribeToFirebaseAuth(callback) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(firebaseAuth, callback);
}

export async function registerCustomerEmail(fullName, email, password) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error(
      'Firebase Authentication is not configured yet. Add VITE_FIREBASE_* keys in .env to enable sign-up.'
    );
  }
  try {
    const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
    if (fullName.trim()) {
      await updateProfile(cred.user, { displayName: fullName.trim() });
    }
    return await syncOrFetchUserProfile(cred.user, fullName);
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function signInCustomerEmail(email, password) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error(
      'Firebase Authentication is not configured yet. Add VITE_FIREBASE_* keys in .env to enable sign-in.'
    );
  }
  try {
    const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    return await syncOrFetchUserProfile(cred.user);
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function signInCustomerGoogle() {
  if (!isFirebaseConfigured || !firebaseAuth || !googleProvider) {
    throw new Error(
      'Google Sign-In requires VITE_FIREBASE_* configuration in your .env file.'
    );
  }
  try {
    const cred = await signInWithPopup(firebaseAuth, googleProvider);
    return await syncOrFetchUserProfile(cred.user);
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function sendCustomerPasswordReset(email) {
  if (!isFirebaseConfigured || !firebaseAuth) {
    throw new Error('Firebase Authentication is not configured yet.');
  }
  try {
    await sendPasswordResetEmail(firebaseAuth, email.trim());
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

export async function signOutCurrentUser() {
  if (isFirebaseConfigured && firebaseAuth) {
    await signOut(firebaseAuth);
  }
}

export async function updateCustomerProfile(userId, updates) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: updates.full_name,
        phone: updates.phone,
        whatsapp: updates.whatsapp,
        address: updates.address,
        city: updates.city,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const profiles = readLocal(LS_KEYS.profiles, {});
  const updated = {
    ...(profiles[userId] || {}),
    ...updates,
    id: userId,
    updated_at: new Date().toISOString(),
  };
  profiles[userId] = updated;
  writeLocal(LS_KEYS.profiles, profiles);
  return updated;
}

export async function fetchAllCustomersForAdmin() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) return data;
  }
  const profiles = readLocal(LS_KEYS.profiles, {});
  return Object.values(profiles);
}

// ============================================================================
// 2. SUPABASE STORAGE UPLOAD SERVICE
// ============================================================================
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadImageToSupabase(
  file,
  bucket = 'product-images',
  folder = 'uploads'
) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Only valid image files (JPG, PNG, WEBP) are allowed.');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Image size must be under 8 MB.');
  }

  if (!isSupabaseConfigured || !supabase) {
    return fileToDataUrl(file);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeBase = file.name
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .slice(0, 40);
  const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function uploadMultipleImagesToSupabase(
  files,
  bucket = 'product-images',
  folder = 'gallery'
) {
  const list = Array.from(files || []);
  const urls = [];
  for (const file of list) {
    const url = await uploadImageToSupabase(file, bucket, folder);
    urls.push(url);
  }
  return urls;
}

// ============================================================================
// 3. CATALOG, COUPONS, DISCOUNTS, REVIEWS, WISHLIST & SITE SETTINGS
// ============================================================================
function normalizeProductRow(row) {
  const price = Number(row.price ?? 0);
  const salePrice =
    row.sale_price !== null && row.sale_price !== undefined && row.sale_price !== ''
      ? Number(row.sale_price)
      : null;
  const stock = Number(row.stock ?? 0);
  return {
    id: String(row.id),
    sku: String(row.sku || ''),
    name: String(row.name || ''),
    slug: String(row.slug || slugify(String(row.name || ''))),
    description: String(row.description || ''),
    short_description: String(row.short_description || ''),
    category_id: row.category_id ? String(row.category_id) : null,
    category_name: String(row.category_name || 'Other Gear'),
    brand: String(row.brand || 'Rock Danish'),
    price,
    sale_price: salePrice,
    discount_percentage: Number(row.discount_percentage ?? 0),
    stock,
    availability:
      row.availability ||
      (stock <= 0 ? 'out_of_stock' : stock <= 5 ? 'low_stock' : 'in_stock'),
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    colors: Array.isArray(row.colors) ? row.colors : [],
    images:
      Array.isArray(row.images) && row.images.length > 0
        ? row.images
        : ['/images/products/helmet-pro.jpg'],
    specifications:
      row.specifications && typeof row.specifications === 'object' ? row.specifications : {},
    featured: Boolean(row.featured),
    best_seller: Boolean(row.best_seller),
    new_arrival: Boolean(row.new_arrival),
    featured_deal: Boolean(row.featured_deal),
    deal_start_date: row.deal_start_date ? String(row.deal_start_date) : null,
    deal_end_date: row.deal_end_date ? String(row.deal_end_date) : null,
    rating: Number(row.rating ?? 4.5),
    review_count: Number(row.review_count ?? 0),
    is_sample: Boolean(row.is_sample),
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

export async function fetchProducts() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return {
        products: data.map((r) => normalizeProductRow(r)),
        usingSampleCatalog: false,
      };
    }
  }

  const localProducts = readLocal(LS_KEYS.products, null);
  if (localProducts && localProducts.length > 0) {
    return {
      products: localProducts,
      usingSampleCatalog: localProducts.every((p) => p.is_sample),
    };
  }

  return { products: SAMPLE_PRODUCTS, usingSampleCatalog: true };
}

async function syncProductImagesTable(productId, productName, images) {
  if (!isSupabaseConfigured || !supabase || !images?.length) return;
  try {
    await supabase.from('product_images').delete().eq('product_id', productId);
    const rows = images.map((url, idx) => ({
      product_id: productId,
      image_url: url,
      alt_text: `${productName} - View ${idx + 1}`,
      is_primary: idx === 0,
      sort_order: idx,
    }));
    await supabase.from('product_images').insert(rows);
  } catch {
    // Non-fatal mirror sync
  }
}

export async function saveProduct(payload) {
  const now = new Date().toISOString();
  const stock = Number(payload.stock ?? 0);
  const price = Number(payload.price ?? 0);
  const salePrice =
    payload.sale_price !== null &&
    payload.sale_price !== undefined &&
    payload.sale_price !== '' &&
    Number(payload.sale_price) > 0
      ? Number(payload.sale_price)
      : null;

  const computedAvailability =
    payload.availability ||
    (stock <= 0 ? 'out_of_stock' : stock <= 5 ? 'low_stock' : 'in_stock');

  const computedDiscount =
    salePrice && salePrice < price
      ? Math.round(((price - salePrice) / price) * 100)
      : Number(payload.discount_percentage || 0);

  const cleanSlug = slugify(payload.slug || payload.name);

  if (isSupabaseConfigured && supabase) {
    const dbRecord = {
      sku: String(payload.sku || '').trim(),
      name: String(payload.name || '').trim(),
      slug: cleanSlug,
      description: String(payload.description || '').trim(),
      short_description: String(payload.short_description || '').trim(),
      category_id:
        payload.category_id && !String(payload.category_id).startsWith('cat-')
          ? payload.category_id
          : null,
      category_name: payload.category_name || 'Helmets',
      brand: String(payload.brand || '').trim() || 'Rock Danish',
      price,
      sale_price: salePrice,
      discount_percentage: computedDiscount,
      stock,
      availability: computedAvailability,
      sizes: payload.sizes || [],
      colors: payload.colors || [],
      images: payload.images?.length ? payload.images : ['/images/products/helmet-pro.jpg'],
      specifications: payload.specifications || {},
      featured: Boolean(payload.featured),
      best_seller: Boolean(payload.best_seller),
      new_arrival: Boolean(payload.new_arrival),
      featured_deal: Boolean(payload.featured_deal),
      deal_start_date: payload.deal_start_date || null,
      deal_end_date: payload.deal_end_date || null,
      rating: Number(payload.rating || 4.5),
      review_count: Number(payload.review_count || 0),
    };

    if (payload.id && !String(payload.id).startsWith('sample-')) {
      const { data, error } = await supabase
        .from('products')
        .update(dbRecord)
        .eq('id', payload.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      const saved = normalizeProductRow(data);
      await syncProductImagesTable(saved.id, saved.name, saved.images);
      return saved;
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert(dbRecord)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      const saved = normalizeProductRow(data);
      await syncProductImagesTable(saved.id, saved.name, saved.images);
      return saved;
    }
  }

  const current = readLocal(LS_KEYS.products, SAMPLE_PRODUCTS);
  const existingIdx = payload.id ? current.findIndex((p) => p.id === payload.id) : -1;
  const savedProduct = {
    ...payload,
    id: payload.id && existingIdx >= 0 ? payload.id : `prod-${Date.now()}`,
    slug: cleanSlug,
    price,
    sale_price: salePrice,
    stock,
    discount_percentage: computedDiscount,
    availability: computedAvailability,
    is_sample: false,
    created_at: existingIdx >= 0 ? current[existingIdx].created_at : now,
    updated_at: now,
  };

  const next =
    existingIdx >= 0
      ? current.map((p, idx) => (idx === existingIdx ? savedProduct : p))
      : [savedProduct, ...current.filter((p) => !p.is_sample)];

  writeLocal(LS_KEYS.products, next);
  return savedProduct;
}

export async function deleteProductById(productId) {
  if (isSupabaseConfigured && supabase && !String(productId).startsWith('sample-')) {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw new Error(error.message);
    return;
  }
  const current = readLocal(LS_KEYS.products, SAMPLE_PRODUCTS);
  writeLocal(
    LS_KEYS.products,
    current.filter((p) => p.id !== productId)
  );
}

export async function fetchCategories() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });
    if (!error && data && data.length > 0) return data;
  }
  return readLocal(LS_KEYS.categories, INITIAL_CATEGORIES);
}

export async function saveCategory(payload) {
  const cleanSlug = slugify(payload.slug || payload.name);
  if (isSupabaseConfigured && supabase) {
    const record = {
      name: payload.name.trim(),
      slug: cleanSlug,
      short_description: payload.short_description.trim(),
      image_url: payload.image_url,
      display_order: Number(payload.display_order) || 1,
      is_active: Boolean(payload.is_active),
    };
    if (payload.id && !String(payload.id).startsWith('cat-')) {
      const { data, error } = await supabase
        .from('categories')
        .update(record)
        .eq('id', payload.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      const { data, error } = await supabase
        .from('categories')
        .insert(record)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
  }

  const current = readLocal(LS_KEYS.categories, INITIAL_CATEGORIES);
  const idx = payload.id ? current.findIndex((c) => c.id === payload.id) : -1;
  const saved = {
    ...payload,
    id: payload.id && idx >= 0 ? payload.id : `cat-custom-${Date.now()}`,
    slug: cleanSlug,
  };
  const next = idx >= 0 ? current.map((c, i) => (i === idx ? saved : c)) : [...current, saved];
  writeLocal(LS_KEYS.categories, next);
  return saved;
}

export async function deleteCategoryById(categoryId) {
  if (isSupabaseConfigured && supabase && !String(categoryId).startsWith('cat-')) {
    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    if (error) throw new Error(error.message);
    return;
  }
  const current = readLocal(LS_KEYS.categories, INITIAL_CATEGORIES);
  writeLocal(
    LS_KEYS.categories,
    current.filter((c) => c.id !== categoryId)
  );
}

export async function fetchCoupons() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) return data;
  }
  return readLocal(LS_KEYS.coupons, []);
}

export async function validateCouponCode(code, orderSubtotal) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) {
    return { valid: false, discountAmount: 0, message: 'Please enter a coupon code.' };
  }

  const coupons = await fetchCoupons();
  const coupon = coupons.find((c) => String(c.code).toUpperCase() === normalized && c.is_active);
  if (!coupon) {
    return { valid: false, discountAmount: 0, message: 'Invalid or inactive coupon code.' };
  }
  if (coupon.expiry_date && new Date(coupon.expiry_date).getTime() < Date.now()) {
    return { valid: false, discountAmount: 0, message: 'This coupon has expired.' };
  }
  if (coupon.max_usage && coupon.used_count >= coupon.max_usage) {
    return { valid: false, discountAmount: 0, message: 'This coupon has reached its usage limit.' };
  }
  if (coupon.min_order_amount > 0 && orderSubtotal < coupon.min_order_amount) {
    return {
      valid: false,
      discountAmount: 0,
      message: `Minimum order of Rs. ${Number(coupon.min_order_amount).toLocaleString()} required for ${coupon.code}.`,
    };
  }

  const rawDiscount =
    coupon.discount_type === 'percentage'
      ? Math.round((orderSubtotal * Number(coupon.discount_value)) / 100)
      : Math.round(Number(coupon.discount_value));
  const discountAmount = Math.min(rawDiscount, orderSubtotal);
  return {
    valid: true,
    coupon,
    discountAmount,
    message: `Coupon ${coupon.code} applied!`,
  };
}

export async function saveCoupon(payload) {
  const cleanCode = String(payload.code || '').trim().toUpperCase();
  if (isSupabaseConfigured && supabase) {
    const record = {
      code: cleanCode,
      discount_type: payload.discount_type,
      discount_value: Number(payload.discount_value),
      min_order_amount: Number(payload.min_order_amount || 0),
      max_usage: payload.max_usage ? Number(payload.max_usage) : null,
      expiry_date: payload.expiry_date || null,
      is_active: Boolean(payload.is_active),
    };
    if (payload.id && !String(payload.id).startsWith('cpn-')) {
      const { data, error } = await supabase
        .from('coupons')
        .update(record)
        .eq('id', payload.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      const { data, error } = await supabase
        .from('coupons')
        .insert(record)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
  }

  const current = readLocal(LS_KEYS.coupons, []);
  const idx = payload.id ? current.findIndex((c) => c.id === payload.id) : -1;
  const saved = {
    id: payload.id && idx >= 0 ? payload.id : `cpn-${Date.now()}`,
    code: cleanCode,
    discount_type: payload.discount_type,
    discount_value: Number(payload.discount_value),
    min_order_amount: Number(payload.min_order_amount || 0),
    max_usage: payload.max_usage ? Number(payload.max_usage) : null,
    used_count: payload.used_count ?? (idx >= 0 ? current[idx].used_count : 0),
    expiry_date: payload.expiry_date || null,
    is_active: Boolean(payload.is_active),
    created_at: idx >= 0 ? current[idx].created_at : new Date().toISOString(),
  };
  const next = idx >= 0 ? current.map((c, i) => (i === idx ? saved : c)) : [saved, ...current];
  writeLocal(LS_KEYS.coupons, next);
  return saved;
}

export async function deleteCouponById(couponId) {
  if (isSupabaseConfigured && supabase && !String(couponId).startsWith('cpn-')) {
    const { error } = await supabase.from('coupons').delete().eq('id', couponId);
    if (error) throw new Error(error.message);
    return;
  }
  const current = readLocal(LS_KEYS.coupons, []);
  writeLocal(
    LS_KEYS.coupons,
    current.filter((c) => c.id !== couponId)
  );
}

export async function fetchDiscounts() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) return data;
  }
  return readLocal(LS_KEYS.discounts, []);
}

export async function saveDiscount(payload) {
  if (isSupabaseConfigured && supabase) {
    const record = {
      title: payload.title.trim(),
      description: (payload.description || '').trim(),
      product_id:
        payload.product_id && !String(payload.product_id).startsWith('sample-')
          ? payload.product_id
          : null,
      discount_percentage: Number(payload.discount_percentage || 0),
      sale_price: payload.sale_price ? Number(payload.sale_price) : null,
      start_date: payload.start_date || null,
      end_date: payload.end_date || null,
      featured_deal: Boolean(payload.featured_deal),
      is_active: Boolean(payload.is_active),
    };
    if (payload.id && !String(payload.id).startsWith('dsc-')) {
      const { data, error } = await supabase
        .from('discounts')
        .update(record)
        .eq('id', payload.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      const { data, error } = await supabase
        .from('discounts')
        .insert(record)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
  }

  const current = readLocal(LS_KEYS.discounts, []);
  const idx = payload.id ? current.findIndex((d) => d.id === payload.id) : -1;
  const saved = {
    ...payload,
    id: payload.id && idx >= 0 ? payload.id : `dsc-${Date.now()}`,
    created_at: idx >= 0 ? current[idx].created_at : new Date().toISOString(),
  };
  const next = idx >= 0 ? current.map((d, i) => (i === idx ? saved : d)) : [saved, ...current];
  writeLocal(LS_KEYS.discounts, next);
  return saved;
}

export async function deleteDiscountById(id) {
  if (isSupabaseConfigured && supabase && !String(id).startsWith('dsc-')) {
    const { error } = await supabase.from('discounts').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  const current = readLocal(LS_KEYS.discounts, []);
  writeLocal(
    LS_KEYS.discounts,
    current.filter((d) => d.id !== id)
  );
}

export async function fetchReviews(includeUnapproved = false) {
  let websiteReviews = [];
  if (isSupabaseConfigured && supabase) {
    let query = supabase.from('reviews').select('*').order('created_at', { ascending: false });
    if (!includeUnapproved) query = query.eq('is_approved', true);
    const { data, error } = await query;
    if (!error && data) websiteReviews = data;
  } else {
    const local = readLocal(LS_KEYS.reviews, []);
    websiteReviews = includeUnapproved ? local : local.filter((r) => r.is_approved);
  }
  return [...GENUINE_GOOGLE_REVIEWS, ...websiteReviews];
}

export async function submitCustomerReview(payload) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        product_id:
          payload.product_id && !String(payload.product_id).startsWith('sample-')
            ? payload.product_id
            : null,
        user_id: payload.user_id,
        reviewer_name: payload.reviewer_name.trim(),
        city: (payload.city || 'Karachi').trim(),
        rating: Number(payload.rating || 5),
        comment: payload.comment.trim(),
        source: 'Website',
        is_approved: false,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const current = readLocal(LS_KEYS.reviews, []);
  const created = {
    id: `rev-${Date.now()}`,
    product_id: payload.product_id || null,
    user_id: payload.user_id,
    reviewer_name: payload.reviewer_name.trim(),
    city: (payload.city || 'Karachi').trim(),
    rating: Number(payload.rating || 5),
    comment: payload.comment.trim(),
    source: 'Website',
    is_approved: false,
    created_at: new Date().toISOString(),
  };
  writeLocal(LS_KEYS.reviews, [created, ...current]);
  return created;
}

export async function updateReviewApproval(reviewId, isApproved) {
  if (String(reviewId).startsWith('google-rev-')) return;
  if (isSupabaseConfigured && supabase && !String(reviewId).startsWith('rev-')) {
    const { error } = await supabase
      .from('reviews')
      .update({ is_approved: isApproved })
      .eq('id', reviewId);
    if (error) throw new Error(error.message);
    return;
  }
  const current = readLocal(LS_KEYS.reviews, []);
  writeLocal(
    LS_KEYS.reviews,
    current.map((r) => (r.id === reviewId ? { ...r, is_approved: isApproved } : r))
  );
}

export async function deleteReviewById(reviewId) {
  if (String(reviewId).startsWith('google-rev-')) return;
  if (isSupabaseConfigured && supabase && !String(reviewId).startsWith('rev-')) {
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
    if (error) throw new Error(error.message);
    return;
  }
  const current = readLocal(LS_KEYS.reviews, []);
  writeLocal(
    LS_KEYS.reviews,
    current.filter((r) => r.id !== reviewId)
  );
}

export async function fetchUserWishlistIds(userId) {
  if (userId && isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('wishlist')
      .select('product_id')
      .eq('user_id', userId);
    if (!error && data) return data.map((r) => String(r.product_id));
  }
  const key = userId ? `${LS_KEYS.wishlist}_${userId}` : LS_KEYS.wishlist;
  return readLocal(key, []);
}

export async function toggleWishlistProduct(productId, currentlyWishlisted, userId) {
  if (
    userId &&
    isSupabaseConfigured &&
    supabase &&
    !String(productId).startsWith('sample-') &&
    !String(productId).startsWith('prod-')
  ) {
    if (currentlyWishlisted) {
      await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);
      return false;
    } else {
      await supabase.from('wishlist').upsert({ user_id: userId, product_id: productId });
      return true;
    }
  }
  const key = userId ? `${LS_KEYS.wishlist}_${userId}` : LS_KEYS.wishlist;
  const current = readLocal(key, []);
  const next = currentlyWishlisted
    ? current.filter((id) => id !== productId)
    : Array.from(new Set([...current, productId]));
  writeLocal(key, next);
  return !currentlyWishlisted;
}

export async function fetchSiteSettings() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (!error && data) return { ...DEFAULT_SITE_SETTINGS, ...data };
  }
  return readLocal(LS_KEYS.settings, DEFAULT_SITE_SETTINGS);
}

export async function updateSiteSettings(settings) {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('site_settings')
      .upsert({ ...settings, id: 1 })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
  writeLocal(LS_KEYS.settings, settings);
  return settings;
}

// ============================================================================
// 4. ORDERS & ORDER TRACKING
// ============================================================================
export async function createOrderRecord(payload) {
  const orderNumber = generateOrderNumber();
  const now = new Date().toISOString();

  if (isSupabaseConfigured && supabase) {
    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: payload.user_id || null,
        customer_name: payload.customer_name.trim(),
        customer_email: (payload.customer_email || '').trim(),
        phone: payload.phone.trim(),
        whatsapp: (payload.whatsapp || payload.phone).trim(),
        delivery_address: payload.delivery_address.trim(),
        city: payload.city || 'Karachi',
        notes: (payload.notes || '').trim(),
        subtotal: payload.subtotal,
        discount_amount: payload.discount_amount || 0,
        coupon_code: payload.coupon_code || '',
        total: payload.total,
        status: 'Pending',
      })
      .select('*')
      .single();

    if (orderError) throw new Error(orderError.message);

    const itemRows = payload.items.map((item) => ({
      order_id: orderRow.id,
      product_id:
        item.product_id &&
        !String(item.product_id).startsWith('sample-') &&
        !String(item.product_id).startsWith('prod-')
          ? item.product_id
          : null,
      product_name: item.product_name,
      product_sku: item.product_sku,
      product_image: item.product_image,
      size: item.size || '',
      color: item.color || '',
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }));

    await supabase.from('order_items').insert(itemRows);
    return { ...orderRow, items: payload.items };
  }

  const localOrders = readLocal(LS_KEYS.orders, []);
  const created = {
    id: `ord-${Date.now()}`,
    order_number: orderNumber,
    user_id: payload.user_id || null,
    customer_name: payload.customer_name.trim(),
    customer_email: (payload.customer_email || '').trim(),
    phone: payload.phone.trim(),
    whatsapp: (payload.whatsapp || payload.phone).trim(),
    delivery_address: payload.delivery_address.trim(),
    city: payload.city || 'Karachi',
    notes: (payload.notes || '').trim(),
    subtotal: payload.subtotal,
    discount_amount: payload.discount_amount || 0,
    coupon_code: payload.coupon_code || '',
    total: payload.total,
    status: 'Pending',
    items: payload.items,
    created_at: now,
    updated_at: now,
  };
  writeLocal(LS_KEYS.orders, [created, ...localOrders]);
  return created;
}

export async function fetchCustomerOrders(userId, email) {
  if (isSupabaseConfigured && supabase && userId) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) {
      return data.map((row) => ({ ...row, items: row.order_items || [] }));
    }
  }

  const localOrders = readLocal(LS_KEYS.orders, []);
  return localOrders.filter(
    (o) =>
      (userId && o.user_id === userId) ||
      (email && o.customer_email?.toLowerCase() === email.toLowerCase())
  );
}

export async function fetchAllOrdersForAdmin() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });
    if (!error && data) {
      return data.map((row) => ({ ...row, items: row.order_items || [] }));
    }
  }
  return readLocal(LS_KEYS.orders, []);
}

export async function updateOrderStatus(orderId, status) {
  if (isSupabaseConfigured && supabase && !String(orderId).startsWith('ord-')) {
    const { error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) throw new Error(error.message);
    return;
  }
  const localOrders = readLocal(LS_KEYS.orders, []);
  writeLocal(
    LS_KEYS.orders,
    localOrders.map((o) =>
      o.id === orderId ? { ...o, status, updated_at: new Date().toISOString() } : o
    )
  );
}

export async function trackOrderByNumberAndPhone(orderNumber, phone) {
  const cleanOrderNo = String(orderNumber || '').trim().toUpperCase();
  const cleanDigits = String(phone || '').replace(/[^0-9]/g, '');

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('track_order_secure', {
        p_order_number: cleanOrderNo,
        p_phone: phone.trim(),
      });
      if (!error && data && data.length > 0) {
        return data[0];
      }
    } catch {
      // Fallback to local lookup
    }
  }

  const localOrders = readLocal(LS_KEYS.orders, []);
  return (
    localOrders.find((o) => {
      const sameNo = String(o.order_number || '').toUpperCase() === cleanOrderNo;
      const orderDigits = String(o.phone || '').replace(/[^0-9]/g, '');
      const waDigits = String(o.whatsapp || '').replace(/[^0-9]/g, '');
      return (
        sameNo &&
        cleanDigits.length >= 7 &&
        (orderDigits.endsWith(cleanDigits.slice(-7)) || waDigits.endsWith(cleanDigits.slice(-7)))
      );
    }) || null
  );
}
