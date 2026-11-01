import { Suspense, lazy, useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import Catalog from './pages/Catalog.jsx'
import FavoritesPage from './pages/FavoritesPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import PWABadge from './components/PWABadge.jsx'
import SplashScreen from './components/common/SplashScreen.jsx'
import { useHashRoute } from './hooks/useHashRoute.js'
import './App.css'

// ---------------------------------------------------------------------------
// Route-level code splitting (lazy load): heavy views are only downloaded the
// first time the user opens them.
// ---------------------------------------------------------------------------
const GunDetailPage = lazy(() => import('./pages/GunDetailPage.jsx'))
const CreateGunPage = lazy(() => import('./pages/CreateGunPage.jsx'))
const EditGunPage = lazy(() => import('./pages/EditGunPage.jsx'))
const DraftsPage = lazy(() => import('./pages/DraftsPage.jsx'))
const ArchivedPage = lazy(() => import('./pages/ArchivedPage.jsx'))
const EditProfilePage = lazy(() => import('./pages/EditProfilePage.jsx'))

const TAB_FOR_ROUTE = {
  catalog: 'catalog',
  gun: 'catalog',
  create: 'catalog',
  edit: 'catalog',
  favorites: 'favorites',
  drafts: 'drafts',
  archived: 'archived',
  profile: 'profile',
  'profile-edit': 'profile',
}

function RouteFallback() {
  return (
    <div className="state-box">
      <span className="route-loader" aria-hidden="true" />
      <p>Loading view…</p>
    </div>
  )
}

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const { route, navigate } = useHashRoute()

  // Remember the card object so detail/edit render instantly when navigated
  // from the catalog; deep links fetch by id instead.
  const [selectedGun, setSelectedGun] = useState(null)

  const rememberedGun =
    selectedGun && String(selectedGun.id) === String(route.id)
      ? selectedGun
      : null

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [route.name, route.id])

  const openDetail = (gun) => {
    if (!gun) return
    setSelectedGun(gun)
    navigate(`gun/${gun.id ?? gun.name}`)
  }

  const openEdit = (gun) => {
    if (!gun) return
    setSelectedGun(gun)
    navigate(`edit/${gun.id ?? gun.name}`)
  }

  const handleNavigate = (target, payload) => {
    if (target === 'Detail') openDetail(payload)
    else if (target === 'Edit') openEdit(payload)
    else if (target === 'Create') navigate('create')
    else navigate(String(target || 'catalog').toLowerCase())
  }

  const goCatalog = () => navigate('catalog')

  const renderRoute = () => {
    switch (route.name) {
      case 'gun':
        return (
          <GunDetailPage
            gun={rememberedGun}
            gunId={route.id}
            onBack={goCatalog}
            onEdit={openEdit}
          />
        )

      case 'create':
        return (
          <CreateGunPage
            onBack={goCatalog}
            onSuccess={() => {
              goCatalog()
            }}
          />
        )

      case 'edit':
        return (
          <EditGunPage
            gun={rememberedGun}
            gunId={route.id}
            onBack={goCatalog}
            onSuccess={() => {
              goCatalog()
            }}
          />
        )

      case 'favorites':
        return (
          <FavoritesPage
            onSelectGun={openDetail}
            onNavigateCatalog={goCatalog}
          />
        )

      case 'drafts':
        return (
          <DraftsPage
            onBack={goCatalog}
            onCreate={() => navigate('create')}
            onResume={(draft) =>
              navigate(draft.kind === 'create' ? 'create' : `edit/${draft.id}`)
            }
          />
        )

      case 'archived':
        return <ArchivedPage onBack={goCatalog} />

      case 'profile':
        return (
          <ProfilePage
            onEditProfile={() => navigate('profile/edit')}
            onOpenDrafts={() => navigate('drafts')}
            onOpenArchived={() => navigate('archived')}
            onReplaySplash={() => setShowSplash(true)}
          />
        )

      case 'profile-edit':
        return (
          <EditProfilePage
            onBack={() => navigate('profile')}
            onSaved={() => navigate('profile')}
          />
        )

      case 'catalog':
      default:
        return <Catalog onNavigate={handleNavigate} />
    }
  }

  return (
    <div className="shell">
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      <Header
        tab={TAB_FOR_ROUTE[route.name] || 'catalog'}
        onTab={(tabId) => navigate(tabId)}
        onNavigateCreate={() => navigate('create')}
      />

      <main className="main">
        <Suspense fallback={<RouteFallback />}>{renderRoute()}</Suspense>
      </main>

      <PWABadge />
      <Footer />
    </div>
  )
}

export default App
