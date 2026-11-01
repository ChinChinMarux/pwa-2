import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Upload,
  X,
  Plus,
  Loader,
  Save,
  CheckCircle,
  AlertCircle,
  Star,
  Images,
} from 'lucide-react'
import gunService from '../services/gunService'
import uploadService from '../services/uploadService'
import {
  saveDraft,
  loadDraft,
  deleteDraft,
  hasDraft,
  getDraftTimestamp,
  formatDraftTime,
} from '../utils/draftStorage'
import {
  MAX_GALLERY_IMAGES,
  normalizeGallery,
  getSavedGallery,
} from '../utils/imageStore'
import { resolveGunImages } from '../utils/helpers'
import ConfirmModal from '../components/modals/ConfirmModal'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

/**
 * EditGunPage — edit an existing hardware item, including its image gallery.
 * Supports updating specs, steps, cover image, and draft management.
 */
export default function EditGunPage({ gun, gunId, onBack, onSuccess }) {
  const targetId = gunId || gun?.id

  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    type: 'Pistol',
    caliber: '9mm',
    category: 'makanan',
    difficulty: 'mudah',
    price: 599,
    description: '',
    servings: 1,
    is_featured: false,
  })

  const [gallery, setGallery] = useState([])
  const [uploading, setUploading] = useState(false)

  // Specs & Steps
  const [specs, setSpecs] = useState([{ name: '', quantity: '' }])
  const [steps, setSteps] = useState([''])

  // Draft modal
  const [showDraftModal, setShowDraftModal] = useState(() => (targetId ? hasDraft(targetId) : false))
  const [draftTimestamp, setDraftTimestamp] = useState(() => (targetId ? getDraftTimestamp(targetId) : null))

  // Fetch initial data
  useEffect(() => {
    const fetchGun = async () => {
      try {
        setLoading(true)
        setError('')

        // If gun was passed directly and has full details, use it; else fetch from API
        let data = gun
        if (!data || !data.ingredients || !data.steps) {
          if (targetId && !String(targetId).startsWith('local-')) {
            const res = await gunService.getGunById(targetId)
            if (res.success && res.data) {
              data = res.data
            }
          }
        }

        if (data) {
          setFormData({
            name: data.name || '',
            type: data.type || (data.category === 'makanan' ? 'Pistol' : 'Rifle'),
            caliber: data.caliber || '9mm',
            category: data.category || 'makanan',
            difficulty: data.difficulty || 'mudah',
            price: data.price ?? data.cook_time ?? 599,
            description: data.description || '',
            servings: data.servings || 1,
            is_featured: Boolean(data.is_featured),
          })

          const localGallery = getSavedGallery(targetId)
          setGallery(
            localGallery.length > 0
              ? localGallery
              : resolveGunImages(data),
          )

          if (data.ingredients && data.ingredients.length > 0) {
            setSpecs(data.ingredients.map((ing) => ({
              name: ing.name || '',
              quantity: ing.quantity || '',
            })))
          } else {
            setSpecs([
              { name: 'Platform', quantity: data.type || 'Pistol' },
              { name: 'Caliber', quantity: data.caliber || '9mm' },
            ])
          }

          if (data.steps && data.steps.length > 0) {
            setSteps(data.steps.map((step) => (typeof step === 'string' ? step : step.instruction || '')))
          } else {
            setSteps(['Standard manufacturer maintenance and cleaning protocol.'])
          }
        } else {
          setError('Hardware record could not be loaded.')
        }
      } catch (err) {
        setError(err.message || 'Failed to load hardware record from server.')
      } finally {
        setLoading(false)
      }
    }

    if (targetId) {
      fetchGun()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId])

  // Draft operations
  const handleLoadDraft = () => {
    const draft = loadDraft(targetId)
    if (draft) {
      if (draft.formData) setFormData(draft.formData)
      if (draft.specs) setSpecs(draft.specs)
      if (draft.steps) setSteps(draft.steps)
      if (Array.isArray(draft.gallery) && draft.gallery.length > 0) {
        setGallery(normalizeGallery(draft.gallery))
      } else if (draft.imagePreview) {
        setGallery([draft.imagePreview])
      }
      setShowDraftModal(false)
      setSuccessMsg('Saved draft restored.')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  const handleDiscardDraft = () => {
    deleteDraft(targetId)
    setShowDraftModal(false)
    setDraftTimestamp(null)
  }

  const handleManualSaveDraft = () => {
    const draftData = {
      formData,
      specs,
      steps,
      gallery,
    }
    const saved = saveDraft(draftData, targetId)
    if (saved) {
      const timestamp = getDraftTimestamp(targetId)
      setDraftTimestamp(timestamp)
      setSuccessMsg(`Draft saved (${formatDraftTime(timestamp)})`)
      setTimeout(() => setSuccessMsg(''), 3000)
    }
  }

  // ---------------------------------------------------------------------
  // Gallery handlers
  // ---------------------------------------------------------------------
  const handleAddImages = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return

    const remaining = MAX_GALLERY_IMAGES - gallery.length
    if (remaining <= 0) {
      setError(`Maximum ${MAX_GALLERY_IMAGES} images per product.`)
      return
    }

    const accepted = []
    for (const file of files.slice(0, remaining)) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name}: file size exceeds 5MB limit.`)
        continue
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`${file.name}: allowed formats are .jpg, .jpeg, .png, .webp`)
        continue
      }
      accepted.push(file)
    }

    if (accepted.length === 0) return

    try {
      setUploading(true)
      setError('')
      const uploaded = []
      for (const file of accepted) {
        try {
          const result = await uploadService.uploadImage(file)
          uploaded.push(result?.data?.url || URL.createObjectURL(file))
        } catch {
          uploaded.push(URL.createObjectURL(file))
        }
      }
      setGallery((previous) => normalizeGallery([...previous, ...uploaded]))
      setSuccessMsg(`${uploaded.length} image(s) added. Save changes to persist.`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } finally {
      setUploading(false)
    }
  }

  const removeGalleryImage = (index) => {
    setGallery((previous) => previous.filter((_, position) => position !== index))
  }

  const makePrimary = (index) => {
    setGallery((previous) => {
      if (index <= 0 || index >= previous.length) return previous
      const copy = [...previous]
      const [picked] = copy.splice(index, 1)
      return [picked, ...copy]
    })
  }

  // Specs & Steps
  const handleSpecChange = (index, field, value) => {
    setSpecs((previous) => {
      const copy = [...previous]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const addSpec = () => setSpecs((previous) => [...previous, { name: '', quantity: '' }])
  const removeSpec = (index) => {
    if (specs.length <= 1) return
    setSpecs((previous) => previous.filter((_, position) => position !== index))
  }

  const handleStepChange = (index, value) => {
    setSteps((previous) => {
      const copy = [...previous]
      copy[index] = value
      return copy
    })
  }

  const addStep = () => setSteps((previous) => [...previous, ''])
  const removeStep = (index) => {
    if (steps.length <= 1) return
    setSteps((previous) => previous.filter((_, position) => position !== index))
  }

  // Submit update
  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!formData.name.trim() || formData.name.trim().length < 3) {
      setError('Product name must be at least 3 characters.')
      return
    }

    const cleanSpecs = specs
      .filter((spec) => spec.name.trim())
      .map((spec) => ({
        name: spec.name.trim(),
        quantity: spec.quantity.trim() || 'Standard',
      }))

    if (cleanSpecs.length === 0) {
      setError('Please provide at least one specification.')
      return
    }

    const cleanSteps = steps
      .filter((step) => step.trim())
      .map((step) => step.trim())

    if (cleanSteps.length === 0) {
      setError('Please provide at least one maintenance step.')
      return
    }

    const images = gallery.length > 0 ? gallery : ['/guns/pistol.svg']

    const payload = {
      name: formData.name.trim(),
      type: formData.type || (formData.category === 'minuman' ? 'Rifle' : 'Pistol'),
      caliber: formData.caliber || '9mm',
      price: Number(formData.price) || 500,
      category: formData.category || 'makanan',
      description: formData.description.trim() || `${formData.type} caliber ${formData.caliber}.`,
      image_url: images[0],
      images,
      prep_time: 15,
      cook_time: Number(formData.price) || 500,
      servings: Number(formData.servings) || 1,
      difficulty: formData.difficulty || 'mudah',
      is_featured: Boolean(formData.is_featured),
      ingredients: cleanSpecs,
      steps: cleanSteps,
    }

    try {
      setUpdating(true)
      const res = await gunService.updateGun(targetId, payload)
      if (res.success || res.data) {
        deleteDraft(targetId)
        if (onSuccess) {
          onSuccess(res.data)
        } else if (onBack) {
          onBack()
        }
      } else {
        throw new Error(res.message || 'Failed to update record on server.')
      }
    } catch (err) {
      setError(err.message || 'Error occurred while updating record.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="state-box">
        <Loader size={32} className="spin" />
        <p>Loading hardware details for editing…</p>
      </div>
    )
  }

  return (
    <div className="form-page">
      {/* Head */}
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back
        </button>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={handleManualSaveDraft}
          title="Save draft"
        >
          <Save size={14} /> Save Draft
        </button>
      </div>

      <div className="form-title-group">
        <h1 className="display">Modify Hardware Record</h1>
        <p className="lede">
          Updating record ID: <code className="mono-badge">{targetId}</code>
        </p>
      </div>

      {error && (
        <div className="toast toast--error">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {successMsg && (
        <div className="toast toast--success">
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="entry-form">
        {/* Gallery Section */}
        <div className="card-box">
          <h2 className="card-box-title">
            <Images size={18} /> Visual Assets
          </h2>
          <p className="card-box-desc">
            {gallery.length}/{MAX_GALLERY_IMAGES} images. The cover image is shown on
            the catalog card; use the star to promote an image.
          </p>

          <div className="gallery-grid gallery-grid--edit">
            {gallery.map((url, index) => (
              <div key={`${url}-${index}`} className="gallery-tile">
                <img src={url} alt={`Hardware image ${index + 1}`} />
                {index === 0 ? (
                  <span className="gallery-tile__primary">
                    <Star size={12} /> Cover
                  </span>
                ) : (
                  <button
                    type="button"
                    className="gallery-tile__action"
                    onClick={() => makePrimary(index)}
                    title="Set as cover image"
                    aria-label="Set as cover image"
                  >
                    <Star size={13} />
                  </button>
                )}
                <button
                  type="button"
                  className="gallery-tile__remove"
                  onClick={() => removeGalleryImage(index)}
                  title="Remove image"
                  aria-label="Remove image"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {gallery.length < MAX_GALLERY_IMAGES && (
              <label className="gallery-tile gallery-tile--add" htmlFor="edit-gun-images">
                {uploading ? (
                  <Loader size={20} className="spin" />
                ) : (
                  <Upload size={20} />
                )}
                <span>{uploading ? 'Uploading…' : 'Add images'}</span>
                <input
                  id="edit-gun-images"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={handleAddImages}
                  className="hidden-file-input"
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        </div>

        {/* Core fields */}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="edit-name" className="form-label">
              Model Designation <span className="req">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={(event) => setFormData((previous) => ({ ...previous, name: event.target.value }))}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-type" className="form-label">
              Platform / Category <span className="req">*</span>
            </label>
            <select
              id="edit-type"
              name="type"
              value={formData.type}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  type: event.target.value,
                  category: event.target.value === 'Pistol' ? 'makanan' : 'minuman',
                }))
              }
              className="form-select"
            >
              <option value="Pistol">Pistol (Sidearm)</option>
              <option value="Rifle">Rifle (Long Gun)</option>
              <option value="Shotgun">Shotgun (Smoothbore)</option>
              <option value="Submachine Gun">Submachine Gun</option>
            </select>
          </div>
        </div>

        <div className="form-grid form-grid--3">
          <div className="form-group">
            <label htmlFor="edit-caliber" className="form-label">
              Caliber / Chambering <span className="req">*</span>
            </label>
            <input
              id="edit-caliber"
              type="text"
              name="caliber"
              value={formData.caliber}
              onChange={(event) => setFormData((previous) => ({ ...previous, caliber: event.target.value }))}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-price" className="form-label">
              Price (USD) <span className="req">*</span>
            </label>
            <input
              id="edit-price"
              type="number"
              name="price"
              value={formData.price}
              onChange={(event) => setFormData((previous) => ({ ...previous, price: event.target.value }))}
              className="form-input"
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-difficulty" className="form-label">
              Grade / Build Quality <span className="req">*</span>
            </label>
            <select
              id="edit-difficulty"
              name="difficulty"
              value={formData.difficulty}
              onChange={(event) => setFormData((previous) => ({ ...previous, difficulty: event.target.value }))}
              className="form-select"
            >
              <option value="mudah">Commercial / Standard</option>
              <option value="sedang">Mil-Spec / Service Issue</option>
              <option value="sulit">Match Grade / Custom</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="edit-desc" className="form-label">
            Armory Description
          </label>
          <textarea
            id="edit-desc"
            name="description"
            value={formData.description}
            onChange={(event) => setFormData((previous) => ({ ...previous, description: event.target.value }))}
            rows={3}
            className="form-textarea"
          />
        </div>

        {/* Specs */}
        <div className="form-fieldset">
          <div className="fieldset-header">
            <label className="form-label">Specifications &amp; Components</label>
            <button type="button" className="btn btn--outline btn--sm" onClick={addSpec}>
              <Plus size={14} /> Add Spec
            </button>
          </div>
          <div className="multi-rows">
            {specs.map((spec, index) => (
              <div key={index} className="multi-row">
                <input
                  type="text"
                  placeholder="Attribute"
                  value={spec.name}
                  onChange={(event) => handleSpecChange(index, 'name', event.target.value)}
                  className="form-input"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={spec.quantity}
                  onChange={(event) => handleSpecChange(index, 'quantity', event.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => removeSpec(index)}
                  disabled={specs.length <= 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="form-fieldset">
          <div className="fieldset-header">
            <label className="form-label">Assembly &amp; Maintenance Protocol</label>
            <button type="button" className="btn btn--outline btn--sm" onClick={addStep}>
              <Plus size={14} /> Add Step
            </button>
          </div>
          <div className="multi-rows">
            {steps.map((step, index) => (
              <div key={index} className="step-row">
                <span className="step-num">{index + 1}</span>
                <input
                  type="text"
                  value={step}
                  onChange={(event) => handleStepChange(index, event.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={() => removeStep(index)}
                  disabled={steps.length <= 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Featured */}
        <div className="checkbox-row">
          <input
            id="edit-is-featured"
            type="checkbox"
            name="is_featured"
            checked={formData.is_featured}
            onChange={(event) => setFormData((previous) => ({ ...previous, is_featured: event.target.checked }))}
            className="form-checkbox"
          />
          <label htmlFor="edit-is-featured" className="checkbox-label">
            Feature in Armory Showcase
          </label>
        </div>

        {/* Submit */}
        <div className="form-actions-bar">
          <button type="button" className="btn btn--outline" onClick={onBack} disabled={updating}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={updating || uploading}>
            {updating ? (
              <>
                <Loader size={18} className="spin" /> Updating Record…
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>

      {/* Restore draft dialog */}
      <ConfirmModal
        open={showDraftModal}
        title="Resume Unsaved Changes?"
        message={`An unsaved draft for this product was saved on ${draftTimestamp ? formatDraftTime(draftTimestamp) : 'earlier'}. Would you like to restore it?`}
        confirmLabel="Restore Draft"
        cancelLabel="Discard"
        onConfirm={handleLoadDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  )
}
