# Bore & Barrel

A dummy gunshop storefront built as a Progressive Web App. It runs offline
with an app shell, a web app manifest, and a service worker, and uses React +
Vite.

## Setup

```bash
npm install
npm run dev      # dev server with HMR
```

Other scripts:

```bash
npm run build    # production build to dist/
npm run preview  # serve the production build
npm run lint     # oxlint
```

## Features

| Feature | Where |
| --- | --- |
| Catalog pagination (page size 6/12/24/48, filter/sort aware) | `src/components/common/Pagination.jsx`, `src/pages/Catalog.jsx` |
| Share link button (Web Share API + clipboard fallback) | `src/components/common/ShareButton.jsx` |
| Lazy loading (route chunks + IntersectionObserver images) | `src/App.jsx`, `src/components/common/LazyImage.jsx` |
| Query caching (TTL + stale-while-revalidate + invalidation) | `src/utils/queryCache.js`, `src/services/gunService.js`, `src/hooks/useGuns.js` |
| About + Contact section inside the profile page | `src/pages/ProfilePage.jsx`, `src/components/profile/ContactSection.jsx` |
| Dedicated drafts page | `src/pages/DraftsPage.jsx` |
| Dedicated edit-profile page | `src/pages/EditProfilePage.jsx` |
| Soft delete / archive, restore, hard delete | `src/services/archiveService.js`, `src/pages/ArchivedPage.jsx` |
| Review CRUD + thumbs up/down | `src/components/gun/GunDetail.jsx`, `src/services/reviewService.js` |
| Multiple images per product + card gallery | `src/components/gun/GunCard.jsx`, `src/pages/CreateGunPage.jsx`, `src/pages/EditGunPage.jsx` |

## Routes

Hash routing keeps deep links working on any static host:

```
#/catalog          #/favorites       #/drafts        #/archived
#/profile          #/profile/edit
#/create           #/edit/:id        #/gun/:id
```

Share links point at `#/gun/<id>`, so opening one loads the product detail
directly (and works after a reload). The old `#/contact` link now redirects to
the profile page, where the About and Contact sections live.

## Storage notes

- The deployed `products` table has a single `image_url` column, so extra
  gallery images are stored per product in `localStorage`
  (`bore_barrel_gun_images`) and merged onto every product read. The services
  already understand an `images` column if the backend adds one.
- Archive records live in `localStorage` (`bore_barrel_archived_records`)
  because the table has no `archived_at` column. Set
  `VITE_ARCHIVE_REMOTE=true` once that column exists to mirror archive /
  restore with a PATCH.
- Reviews that the API rejects (offline, RLS) are saved in
  `bore_barrel_local_reviews`; thumb reactions live in
  `bore_barrel_review_reactions`.

## Structure

```
.
├── index.html
├── vite.config.js          # Vite + vite-plugin-pwa (manifest + service worker)
├── public/                 # static assets served at /
│   ├── icon-192.png / icon-512.png / icon.svg
│   └── guns/               # product images
└── src/
    ├── main.jsx            # entry, mounts <App/>
    ├── App.jsx             # app shell + hash router + lazy routes
    ├── App.css             # app styles
    ├── index.css           # global styles
    ├── components/
    │   ├── Header.jsx
    │   ├── Footer.jsx
    │   ├── common/         # AdvancedFilter, FavoriteButton, LazyImage,
    │   │                   # Pagination, ShareButton, SplashScreen
    │   ├── gun/            # GunCard, GunDetail
    │   ├── profile/        # ContactSection
    │   └── modals/         # ConfirmModal
    ├── data/
    │   └── guns.js         # offline fallback catalog
    ├── hooks/              # useGuns, useReviews, useFavorites, useHashRoute
    ├── pages/              # Catalog, DraftsPage, ArchivedPage, ProfilePage,
    │                       # EditProfilePage, GunDetailPage, CreateGunPage,
    │                       # EditGunPage, FavoritesPage
    ├── services/           # gun, archive, review, favorite, upload, user
    └── utils/              # helpers, queryCache, imageStore, archiveStore,
                            # reviewStore, draftStorage
```
