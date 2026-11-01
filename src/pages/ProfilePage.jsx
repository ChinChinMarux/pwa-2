import { useState } from 'react'
import {
  Archive,
  Check,
  Copy,
  FileText,
  Heart,
  MapPin,
  Pencil,
  Play,
  Shield,
  Star,
} from 'lucide-react'
import userService from '../services/userService'
import { useFavorites } from '../hooks/useFavorites'
import { listDrafts } from '../utils/draftStorage'
import { countArchived } from '../utils/archiveStore'
import ContactSection from '../components/profile/ContactSection.jsx'

/**
 * ProfilePage — read-only operator overview plus the armory contact section.
 * Editing moved to the dedicated EditProfilePage (route #/profile/edit).
 * Drafts and archive moved to their own pages; contact moved here from the
 * removed Contact page.
 */
export default function ProfilePage({
  onEditProfile,
  onOpenDrafts,
  onOpenArchived,
  onReplaySplash,
}) {
  const [profile] = useState(() => userService.getUserProfile())
  const [copied, setCopied] = useState(false)
  const { favorites } = useFavorites()
  const [draftCount] = useState(() => listDrafts().length)
  const [archivedCount] = useState(() => countArchived())

  const handleCopyId = () => {
    if (!profile.userId) return
    navigator.clipboard?.writeText(profile.userId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="profile-page">
      <section
        className="masthead"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 className="display">Operator Profile</h1>
          <p className="lede">
            Operator credentials, procurement statistics, and armorer details.
          </p>
        </div>

        <div className="profile-actions">
          {onReplaySplash && (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={onReplaySplash}
              title="Replay introductory splash animation"
            >
              <Play size={14} /> Replay Intro
            </button>
          )}
          {onEditProfile && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={onEditProfile}
            >
              <Pencil size={14} /> Edit Profile
            </button>
          )}
        </div>
      </section>

      {/* Operator Card */}
      <div className="profile-card">
        <div className="profile-card-top">
          <div className="avatar-wrap">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.username} className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">
                <Shield size={36} stroke="var(--brass)" />
              </div>
            )}
          </div>

          <div className="profile-identity">
            <h2 className="display">{profile.username || 'Shooter'}</h2>
            <div className="profile-id-row">
              <span className="mono-badge">{profile.userId}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={handleCopyId}
                title="Copy User ID to clipboard"
              >
                {copied ? <Check size={14} color="var(--brass)" /> : <Copy size={14} />}
              </button>
            </div>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats">
          <div className="stat-item">
            <Heart size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">{favorites.length}</div>
            <div className="stat-label">Procurement Favorites</div>
          </div>
          <div className="stat-item">
            <FileText size={20} className="stat-icon" stroke="var(--steel)" />
            <div className="stat-val">{draftCount}</div>
            <div className="stat-label">Saved Offline Drafts</div>
          </div>
          <div className="stat-item">
            <Archive size={20} className="stat-icon" stroke="var(--steel)" />
            <div className="stat-val">{archivedCount}</div>
            <div className="stat-label">Archived Records</div>
          </div>
          <div className="stat-item">
            <Star size={20} className="stat-icon" stroke="var(--brass)" />
            <div className="stat-val">Local</div>
            <div className="stat-label">Operator Identity</div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="profile-links">
        {onEditProfile && (
          <button type="button" className="profile-link" onClick={onEditProfile}>
            <Pencil size={16} />
            <span>
              <strong>Edit profile</strong>
              <small>Callsign, bio, avatar, identity</small>
            </span>
          </button>
        )}
        {onOpenDrafts && (
          <button type="button" className="profile-link" onClick={onOpenDrafts}>
            <FileText size={16} />
            <span>
              <strong>Drafts</strong>
              <small>Resume or discard unfinished forms</small>
            </span>
          </button>
        )}
        {onOpenArchived && (
          <button type="button" className="profile-link" onClick={onOpenArchived}>
            <Archive size={16} />
            <span>
              <strong>Archive</strong>
              <small>Restore or permanently delete records</small>
            </span>
          </button>
        )}
        <button
          type="button"
          className="profile-link"
          onClick={() =>
            document
              .getElementById('armory-contact')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          <MapPin size={16} />
          <span>
            <strong>Contact &amp; visit</strong>
            <small>Address, hours, counter notes</small>
          </span>
        </button>
      </div>

      <ContactSection />
    </div>
  )
}
