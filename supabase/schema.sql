-- ============================================================================
-- ROCK DANISH BIKER STUFF — COMPLETE SUPABASE POSTGRESQL SCHEMA & RLS POLICIES
-- ============================================================================
-- Run this SQL script inside your Supabase Dashboard -> SQL Editor -> New Query.
--
-- IMPORTANT AUTHENTICATION SETUP:
-- Enable Firebase as a Third-Party Auth provider in Supabase:
--   Supabase Dashboard -> Authentication -> Third-Party Auth -> Add Integration -> Firebase
--   Enter your Firebase Project ID (same as VITE_FIREBASE_PROJECT_ID).
-- This allows Supabase PostgreSQL & Storage RLS policies to cryptographically
-- validate Firebase ID tokens via `auth.jwt()`.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ADMIN ALLOWLIST & SECURITY DEFINER AUTHORIZATION FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;

-- Seed the two authorized owner/admin accounts (idempotent)
INSERT INTO public.admin_allowlist (email)
VALUES
  ('danish_rehman00@yahoo.com'),
  ('sivexosoft@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- Helper: Returns current authenticated Firebase UID from verified JWT
CREATE OR REPLACE FUNCTION public.current_firebase_uid()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(COALESCE(auth.jwt() ->> 'sub', auth.jwt() ->> 'user_id'), '');
$$;

-- Helper: Returns current verified email (lowercased) from Firebase JWT
CREATE OR REPLACE FUNCTION public.current_verified_email()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT CASE
    WHEN COALESCE((auth.jwt() ->> 'email_verified')::BOOLEAN, FALSE) = TRUE
    THEN LOWER(NULLIF(auth.jwt() ->> 'email', ''))
    ELSE NULL
  END;
$$;

-- Helper: Secure backend check whether current caller is an authorized Admin.
-- Evaluates custom claims (`role = 'admin'`) OR verified email against `admin_allowlist`.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  jwt_role TEXT;
  v_email TEXT;
BEGIN
  jwt_role := COALESCE(
    auth.jwt() ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    ''
  );

  IF jwt_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  v_email := public.current_verified_email();
  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = v_email
  );
END;
$$;

-- Only admins can view or manage admin_allowlist
DROP POLICY IF EXISTS "Admins read admin_allowlist" ON public.admin_allowlist;
CREATE POLICY "Admins read admin_allowlist"
  ON public.admin_allowlist FOR SELECT
  USING (public.is_admin());

-- Updated timestamp trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. PROFILES (Customers & Owners linked to Firebase UID)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY, -- Firebase Auth UID (`sub`)
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Karachi',
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to prevent privilege escalation on `profiles.role`
CREATE OR REPLACE FUNCTION public.enforce_profile_role_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    -- If the owner signs in, ensure their role is synced to 'admin'
    IF EXISTS (SELECT 1 FROM public.admin_allowlist WHERE LOWER(email) = LOWER(NEW.email)) THEN
      NEW.role := 'admin';
    END IF;
    RETURN NEW;
  END IF;

  -- Non-admins can NEVER assign or keep 'admin' role
  NEW.role := 'customer';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_role_security ON public.profiles;
CREATE TRIGGER trg_profiles_role_security
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_role_security();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile or admin reads all" ON public.profiles;
CREATE POLICY "Users read own profile or admin reads all"
  ON public.profiles FOR SELECT
  USING (id = public.current_firebase_uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = public.current_firebase_uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users update own profile or admin updates" ON public.profiles;
CREATE POLICY "Users update own profile or admin updates"
  ON public.profiles FOR UPDATE
  USING (id = public.current_firebase_uid() OR public.is_admin())
  WITH CHECK (id = public.current_firebase_uid() OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. CATEGORIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  short_description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active categories" ON public.categories;
CREATE POLICY "Public read active categories"
  ON public.categories FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. PRODUCTS, PRODUCT IMAGES & PRODUCT VARIANTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  short_description TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT 'Rock Danish',
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  sale_price NUMERIC(12, 2) CHECK (sale_price IS NULL OR sale_price >= 0),
  discount_percentage INTEGER NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 95),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  availability TEXT NOT NULL DEFAULT 'in_stock' CHECK (availability IN ('in_stock', 'low_stock', 'out_of_stock', 'preorder')),
  sizes TEXT[] NOT NULL DEFAULT '{}',
  colors TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  specifications JSONB NOT NULL DEFAULT '{}'::JSONB,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  best_seller BOOLEAN NOT NULL DEFAULT FALSE,
  new_arrival BOOLEAN NOT NULL DEFAULT FALSE,
  featured_deal BOOLEAN NOT NULL DEFAULT FALSE,
  deal_start_date TIMESTAMPTZ,
  deal_end_date TIMESTAMPTZ,
  rating NUMERIC(3, 2) NOT NULL DEFAULT 4.5,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category_name ON public.products(category_name);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products"
  ON public.products FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products"
  ON public.products FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read product_images" ON public.product_images;
CREATE POLICY "Public read product_images"
  ON public.product_images FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins manage product_images" ON public.product_images;
CREATE POLICY "Admins manage product_images"
  ON public.product_images FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku_variant TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  price_override NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read product_variants" ON public.product_variants;
CREATE POLICY "Public read product_variants"
  ON public.product_variants FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins manage product_variants" ON public.product_variants;
CREATE POLICY "Admins manage product_variants"
  ON public.product_variants FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. COUPONS & DISCOUNTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),
  min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  max_usage INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  expiry_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active coupons" ON public.coupons;
CREATE POLICY "Public read active coupons"
  ON public.coupons FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;
CREATE POLICY "Admins manage coupons"
  ON public.coupons FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  discount_percentage INTEGER NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 95),
  sale_price NUMERIC(12, 2),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  featured_deal BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active discounts" ON public.discounts;
CREATE POLICY "Public read active discounts"
  ON public.discounts FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage discounts" ON public.discounts;
CREATE POLICY "Admins manage discounts"
  ON public.discounts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. ORDERS & ORDER ITEMS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  user_id TEXT, -- Optional so both signed-in and guest WhatsApp customers can place orders
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Karachi',
  notes TEXT NOT NULL DEFAULT '',
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  coupon_code TEXT NOT NULL DEFAULT '',
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (
    status IN ('Pending', 'Confirmed', 'Processing', 'Ready', 'Out for Delivery', 'Completed', 'Cancelled')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Customers can read ONLY their own orders; Admins can read ALL orders
DROP POLICY IF EXISTS "Customers read own orders or admin reads all" ON public.orders;
CREATE POLICY "Customers read own orders or admin reads all"
  ON public.orders FOR SELECT
  USING (
    (user_id IS NOT NULL AND user_id = public.current_firebase_uid())
    OR public.is_admin()
  );

-- Customers (including guest WhatsApp checkout) can create orders; if user_id is set it must match caller UID
DROP POLICY IF EXISTS "Customers create orders" ON public.orders;
CREATE POLICY "Customers create orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    (user_id IS NULL OR user_id = public.current_firebase_uid() OR public.is_admin())
    AND status = 'Pending'
  );

-- Only Admins can update or delete orders (e.g., changing order status)
DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
CREATE POLICY "Admins update orders"
  ON public.orders FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;
CREATE POLICY "Admins delete orders"
  ON public.orders FOR DELETE
  USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  product_image TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers read own order_items or admin reads all" ON public.order_items;
CREATE POLICY "Customers read own order_items or admin reads all"
  ON public.order_items FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id IS NOT NULL
        AND o.user_id = public.current_firebase_uid()
    )
  );

DROP POLICY IF EXISTS "Customers insert order_items" ON public.order_items;
CREATE POLICY "Customers insert order_items"
  ON public.order_items FOR INSERT
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Admins manage order_items" ON public.order_items;
CREATE POLICY "Admins manage order_items"
  ON public.order_items FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Secure Order Tracking RPC (requires matching BOTH order_number AND phone last 7 digits so PII isn't leaked)
CREATE OR REPLACE FUNCTION public.track_order_secure(p_order_number TEXT, p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_items JSONB;
  v_clean_phone TEXT;
BEGIN
  v_clean_phone := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF LENGTH(v_clean_phone) < 7 THEN
    RETURN NULL;
  END IF;

  SELECT id, order_number, customer_name, city, subtotal, discount_amount, coupon_code, total, status, created_at, updated_at
  INTO v_order
  FROM public.orders
  WHERE UPPER(order_number) = UPPER(TRIM(p_order_number))
    AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 7) = RIGHT(v_clean_phone, 7)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
    'product_name', product_name,
    'product_sku', product_sku,
    'quantity', quantity,
    'size', size,
    'color', color,
    'unit_price', unit_price,
    'total_price', total_price
  )), '[]'::JSONB)
  INTO v_items
  FROM public.order_items
  WHERE order_id = v_order.id;

  RETURN JSONB_BUILD_OBJECT(
    'order_number', v_order.order_number,
    'customer_name', v_order.customer_name,
    'city', v_order.city,
    'subtotal', v_order.subtotal,
    'discount_amount', v_order.discount_amount,
    'coupon_code', v_order.coupon_code,
    'total', v_order.total,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'items', v_items
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. WISHLIST
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own wishlist" ON public.wishlist;
CREATE POLICY "Users manage own wishlist"
  ON public.wishlist FOR ALL
  USING (user_id = public.current_firebase_uid() OR public.is_admin())
  WITH CHECK (user_id = public.current_firebase_uid() OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 8. REVIEWS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  user_id TEXT,
  reviewer_name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Karachi',
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'Website',
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read approved reviews" ON public.reviews;
CREATE POLICY "Public read approved reviews"
  ON public.reviews FOR SELECT
  USING (is_approved = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Signed-in users submit reviews" ON public.reviews;
CREATE POLICY "Signed-in users submit reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (
    public.current_firebase_uid() IS NOT NULL
    AND user_id = public.current_firebase_uid()
    AND is_approved = FALSE
  );

DROP POLICY IF EXISTS "Admins manage reviews" ON public.reviews;
CREATE POLICY "Admins manage reviews"
  ON public.reviews FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. SITE SETTINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name TEXT NOT NULL DEFAULT 'Rock Danish Biker Stuff',
  announcement_text TEXT NOT NULL DEFAULT 'Quality Biker Gear • Competitive Prices • Easy WhatsApp Ordering',
  free_delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  free_delivery_threshold NUMERIC(12, 2) NOT NULL DEFAULT 0,
  whatsapp_number TEXT NOT NULL DEFAULT '0333 3817028',
  phone_number TEXT NOT NULL DEFAULT '0333 3817028',
  address TEXT NOT NULL DEFAULT 'Al Rahman Tower, 48 B, near Coast Guard Chowrangi, Taj Colony Sector 48 B Korangi, Karachi, Pakistan',
  hero_heading TEXT NOT NULL DEFAULT 'Gear Up. Ride Hard. Ride Safe.',
  hero_subheading TEXT NOT NULL DEFAULT 'Premium biker gear, riding essentials and motorcycle accessories under one roof.',
  hero_image_url TEXT NOT NULL DEFAULT '/images/banners/hero-rider.jpg',
  google_rating NUMERIC(2, 1) NOT NULL DEFAULT 4.4,
  google_review_count INTEGER NOT NULL DEFAULT 27,
  facebook_url TEXT NOT NULL DEFAULT 'https://www.facebook.com/p/Rock-Danish-Biker-Stuff-100057666720409/',
  instagram_url TEXT NOT NULL DEFAULT 'https://www.instagram.com/rock_danish_biker_stuff/',
  youtube_url TEXT NOT NULL DEFAULT 'https://www.youtube.com/@RockDanish-Safety-Gears',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read site_settings" ON public.site_settings;
CREATE POLICY "Public read site_settings"
  ON public.site_settings FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins update site_settings" ON public.site_settings;
CREATE POLICY "Admins update site_settings"
  ON public.site_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 10. SUPABASE STORAGE BUCKETS & POLICIES
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-images', 'product-images', TRUE),
  ('category-images', 'category-images', TRUE),
  ('promo-images', 'promo-images', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public view store images" ON storage.objects;
CREATE POLICY "Public view store images"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('product-images', 'category-images', 'promo-images'));

DROP POLICY IF EXISTS "Admins upload store images" ON storage.objects;
CREATE POLICY "Admins upload store images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('product-images', 'category-images', 'promo-images')
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Admins update store images" ON storage.objects;
CREATE POLICY "Admins update store images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id IN ('product-images', 'category-images', 'promo-images')
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Admins delete store images" ON storage.objects;
CREATE POLICY "Admins delete store images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id IN ('product-images', 'category-images', 'promo-images')
    AND public.is_admin()
  );
