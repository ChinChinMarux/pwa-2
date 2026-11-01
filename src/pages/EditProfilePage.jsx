import { useState } from 'react'
import {
  ArrowLeft,
  Camera,
  Check,
  Save,
  Shield,
  ShieldAlert,
  UserRound,
} from 'lucide-react'
import ConfirmModal from '../components/modals/ConfirmModal'
import userService from '../services/userService'
import { formatDateTime } from '../utils/helpers'

/**
 * EditProfilePage — dedicated profile editing page.
 * The read-only overview stays on ProfilePage; all edits happen here.
 */
export default function EditProfilePage({ onBack, onSaved }) {
  const [profile, setProfile] = useState(() => userService.getUserProfile())
  const [username, setUsername] = useState(profile.username || 'Shooter')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatar, setAvatar] = useState(profile.avatar || null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Avatar must be an image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Avatar image must be under 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      setAvatar(loadEvent.target.result)
      setError('')
      setFeedback('Avatar ready — save to apply.')
    }
    reader.readAsDataURL(file)
  }

  const handleSave = (event) => {
    event.preventDefault()
    setError('')
    setFeedback('')

    const result = userService.saveUserProfile({
      ...profile,
      username: username.trim() || 'Shooter',
      bio: bio.trim(),
      avatar,
    })

    if (result.success) {
      setProfile(result.data)
      setFeedback('Profile successfully updated.')
      if (onSaved) onSaved(result.data)
    } else {
      setError(result.message || 'Failed to save profile.')
    }
  }

  const handleResetIdentity = () => {
    userService.resetUserIdentifier()
    setResetOpen(false)
    setProfile(userService.getUserProfile())
    setFeedback('New anonymous identity generated. Reload the app to see fresh data.')
  }

  return (
    <div className="page profile-page">
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Profile
        </button>
      </div>

      <section className="masthead">
        <h1 className="display">Edit Armorer Profile</h1>
        <p className="lede">
          Callsign, station bio, and avatar. Saved to this device against your
          anonymous operator id.
        </p>
      </section>

      {feedback && (
        <div className="toast toast--success">
          <Check size={18} /> {feedback}
        </div>
      )}
      {error && <div className="toast toast--error">{error}</div>}

      <form onSubmit={handleSave} className="profile-form">
        <div className="profile-card-top">
          <div className="avatar-wrap">
            {avatar ? (
              <img src={avatar} alt={username || 'Operator avatar'} className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">
                <Shield size={36} stroke="var(--brass)" />
              </div>
            )}
            <label
              htmlFor="edit-avatar-file"
              className="avatar-upload-btn"
              title="Upload avatar"
            >
              <Camera size={14} />
              <input
                id="edit-avatar-file"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden-file-input"
              />
            </label>
          </div>

          <div className="profile-identity">
            <h2 className="display">{username || 'Shooter'}</h2>
            <div className="profile-id-row">
              <span className="mono-badge">{profile.userId}</span>
            </div>
            <span className="list-item-meta">
              Last updated {formatDateTime(profile.updatedAt) || 'never'}
            </span>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="prof-name" className="form-label">
            Callsign / Operator Alias
          </label>
          <input
            id="prof-name"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="e.g. Operator Delta, Master Gunsmith"
            className="form-input"
            maxLength={40}
          />
        </div>

        <div className="form-group">
          <label htmlFor="prof-bio" className="form-label">
            Armory Notes / Station Bio
          </label>
          <textarea
            id="prof-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Qualifications, preferred calibers, unit assignment..."
            rows={4}
            className="form-textarea"
            maxLength={280}
          />
          <span className="form-hint">{bio.length}/280 characters</span>
        </div>

        <div className="profile-actions">
          <button type="button" className="btn btn--outline" onClick={onBack}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            <Save size={16} /> Save Profile
          </button>
        </div>
      </form>

      <section className="profile-danger-zone">
        <h3 className="section-title">
          <ShieldAlert size={18} /> Identity
        </h3>
        <p className="lede">
          Favorites and reviews are keyed to the anonymous operator id above.
          Resetting it starts a fresh identity on this device.
        </p>
        <div className="danger-actions">
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => setResetOpen(true)}
          >
            <UserRound size={15} /> Reset local identity
          </button>
        </div>
      </section>

      <ConfirmModal
        open={resetOpen}
        title="Reset Local Identity?"
        message="A new anonymous operator id will be generated. Existing favorites and reviews stay on the server but will no longer be linked to you."
        confirmLabel="Reset identity"
        danger
        onConfirm={handleResetIdentity}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  )
}
