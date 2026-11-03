# Rock Danish Biker Stuff — E-Commerce Website (HTML + CSS + Vanilla JS)

Production e-commerce website and store administration dashboard for **Rock Danish Biker Stuff**, a motorcycle gear, biker clothing, and riding accessories store in Korangi, Karachi, Pakistan.

Built strictly with **pure HTML5, custom CSS3, and modular Vanilla JavaScript (ES Modules)**—no frontend UI frameworks—integrated with **Firebase Authentication**, **Supabase PostgreSQL Database**, and **Supabase Storage**, ready for GitHub and Vercel deployment.

- **Location**: Al Rahman Tower, 48 B, near Coast Guard Chowrangi, Taj Colony Sector 48 B Korangi, Karachi, Pakistan
- **WhatsApp Ordering & Phone**: `0333 3817028` (`+92 333 3817028`)
- **Tech Stack**: HTML5, CSS3, Vanilla JavaScript (ES6+ Modules), Vite, Firebase Authentication, Supabase PostgreSQL, Supabase Storage

---

## Project Architecture

```text
├── index.html                # Semantic HTML5 entry point + SEO / OpenGraph / JSON-LD
├── css/
│   └── styles.css            # Complete custom CSS3 stylesheet (White/Light theme + Red/Black accents)
├── js/
│   ├── main.js               # History API router & application bootstrap
│   ├── config.js             # Firebase Auth & Supabase client initialization via .env
│   ├── data.js               # Store info, owner allowlist, categories, genuine Google reviews & starter catalog
│   ├── utils.js              # PKR formatting, SKU/Order ID generators, WhatsApp builders & SVG icons
│   ├── services.js           # Firebase Auth, Admin RBAC, Supabase PostgreSQL CRUD & Supabase Storage uploads
│   ├── state.js              # Reactive store, cart manager, toast notifications & confirmation modals
│   ├── components.js         # Header, Instant Search, Announcement Bar, Product Cards, Cart Drawer & Footer
│   └── pages/
│       ├── home.js           # 16-section Homepage with unified panoramic Hero Banner
│       ├── catalog.js        # Shop filtering, Categories, Product Detail & Wishlist pages
│       ├── checkout.js       # Cart, WhatsApp Checkout, Order Tracking, About & Contact pages
│       ├── account.js        # Firebase Login/Register/Reset & Customer Account Dashboard
│       └── admin.js          # Protected 10-module Owner/Admin Dashboard
├── public/
│   ├── favicon.png
│   └── images/               # Official brand logos, panoramic hero banner & product photography
├── supabase/
│   └── schema.sql            # Complete PostgreSQL schema, RLS policies, RPCs & Storage buckets
├── .env.example              # Environment variable template (zero hardcoded secrets)
├── vite.config.js            # Clean Vanilla JS Vite configuration
└── vercel.json               # SPA route rewrites for Vercel deployment
```

---

## Setup & Deployment

### 1. Install Dependencies & Configure `.env`

```bash
npm install
cp .env.example .env
```

Fill in your public Firebase Web configuration and Supabase URL + public anon key in `.env`:

```env
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id

VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_public_anon_key
```

> **Security**: Never commit `.env` or place Firebase private credentials, Supabase `service_role` keys, or passwords in code. Authorized admin access is granted exclusively to verified Firebase sessions for `danish_rehman00@yahoo.com` and `sivexosoft@gmail.com`.

### 2. Firebase Authentication Setup
1. In the [Firebase Console](https://console.firebase.google.com/), open **Authentication -> Sign-in method** and enable **Email/Password** and **Google**.
2. Add `localhost` and your Vercel domain under **Authentication -> Settings -> Authorized domains**.

### 3. Supabase Database & Storage Setup
1. In the [Supabase Dashboard](https://supabase.com/dashboard), enable **Authentication -> Third-Party Auth -> Firebase** with your Firebase Project ID.
2. Open **SQL Editor**, paste [`supabase/schema.sql`](./supabase/schema.sql), and click **Run** to create all relational tables, Row-Level Security policies, `public.is_admin()`, `public.track_order_secure()`, and Storage buckets (`product-images`, `category-images`, `promo-images`).

### 4. Run Locally & Deploy to Vercel

```bash
npm run dev      # Local server on http://localhost:3000
npm run build    # Production static bundle in dist/
```

Push to GitHub, import into Vercel, add the `VITE_FIREBASE_*` and `VITE_SUPABASE_*` environment variables, and deploy.

---

© 2026 Rock Danish Biker Stuff. All Rights Reserved.  
Developed by [SivexoSoft](https://sivexosoft.com)
