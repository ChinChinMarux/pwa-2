import { useState, useEffect, useCallback } from 'react'
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
import { MAX_GALLERY_IMAGES, normalizeGallery } from '../utils/imageStore'
import ConfirmModal from '../components/modals/ConfirmModal'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const PRESETS = [
  { label: 'Pistol Vector', url: '/guns/pistol.svg' },
  { label: 'Rifle Vector', url: '/guns/rifle.svg' },
  { label: 'Shotgun Vector', url: '/guns/shotgun.svg' },
]

/**
 * CreateGunPage — create a new hardware item with a multi-image gallery,
 * draft persistence (auto-save), specs, and assembly steps.
 */
export default function CreateGunPage({ onBack, onSuccess }) {
  // Step state: 'upload' (choose images) or 'form' (enter details)
  const [currentStep, setCurrentStep] = useState('upload')

  const [formData, setFormData] = useState({
    name: '',
    type: 'Pistol',
    caliber: '9mm',
    category: 'makanan', // API validation expects 'makanan' or 'minuman'
    difficulty: 'mudah', // 'mudah' (Standard) | 'sedang' (Service) | 'sulit' (Match)
    price: 599,
    description: '',
    servings: 1,
    is_featured: false,
  })

  // Committed gallery URLs
  const [gallery, setGallery] = useState([])
  // Files chosen but not uploaded yet: [{ file, preview }]
  const [pendingFiles, setPendingFiles] = useState([])

  // Specifications (ingredients in API)
  const [specs, setSpecs] = useState([
    { name: 'Frame', quantity: 'Polymer' },
    { name: 'Action', quantity: 'Striker-Fired' },
    { name: 'Capacity', quantity: '17 rounds' },
  ])

  // Maintenance / Assembly Steps (steps in API)
  const [steps, setSteps] = useState([
    'Verify firearm is completely unloaded and point in safe direction.',
    'Disassemble slide assembly from receiver frame for routine maintenance.',
  ])

  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Draft management
  const [showDraftModal, setShowDraftModal] = useState(() => hasDraft('create'))
  const [draftTimestamp, setDraftTimestamp] = useState(() => getDraftTimestamp('create'))

  const totalImages = gallery.length + pendingFiles.length

  const handleSaveDraft = useCallback(
    (notify = true) => {
      const draftData = {
        formData,
        specs,
        steps,
        gallery,
      }
      const saved = saveDraft(draftData, 'create')
      if (saved) {
        const timestamp = getDraftTimestamp('create')
        setDraftTimestamp(timestamp)
        if (notify) {
          setSuccessMsg(`Draft saved (${formatDraftTime(timestamp)})`)
          setTimeout(() => setSuccessMsg(''), 3000)
        }
      }
    },
    [formData, specs, steps, gallery],
  )

  // Auto-save draft every 30 seconds while in form step
  useEffect(() => {
    if (currentStep !== 'form') return undefined

    const interval = setInterval(() => {
      handleSaveDraft(false)
    }, 30000)

    return () => clearInterval(interval)
  }, [handleSaveDraft, currentStep])

  const handleLoadDraft = () => {
    const draft = loadDraft('create')
    if (draft) {
      if (draft.formData) setFormData(draft.formData)
      if (draft.specs) setSpecs(draft.specs)
      if (draft.steps) setSteps(draft.steps)

      const draftGallery = Array.isArray(draft.gallery)
        ? draft.gallery
        : draft.uploadedImageUrl
          ? [draft.uploadedImageUrl]
          : []
      if (draftGallery.length > 0) {
        setGallery(normalizeGallery(draftGallery))
        setCurrentStep('form')
      }

      setShowDraftModal(false)
      setSuccessMsg('Draft successfully loaded.')
      setTimeout(() => setSuccessMsg(''), 4000)
    }
  }

  const handleDiscardDraft = () => {
    deleteDraft('create')
    setShowDraftModal(false)
    setDraftTimestamp(null)
  }

  // ---------------------------------------------------------------------
  // Gallery handlers
  // ---------------------------------------------------------------------
  const validateFile = (file) => {
    if (file.size > 5 * 1024 * 1024) {
      setError(`${file.name}: file size exceeds 5MB limit.`)
      return false
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`${file.name}: allowed formats are .jpg, .jpeg, .png, .webp`)
      return false
    }
    return true
  }

  const handleImageChange = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return

    const remaining = MAX_GALLERY_IMAGES - totalImages
    if (remaining <= 0) {
      setError(`Maximum ${MAX_GALLERY_IMAGES} images per product.`)
      return
    }
    if (files.length > remaining) {
      setError(`Only ${remaining} more image(s) can be added (max ${MAX_GALLERY_IMAGES}).`)
    } else {
      setError('')
    }

    const accepted = files.slice(0, remaining).filter(validateFile)
    setPendingFiles((previous) => [
      ...previous,
      ...accepted.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ])
  }

  const handleSelectPreset = (url) => {
    if (totalImages >= MAX_GALLERY_IMAGES) {
      setError(`Maximum ${MAX_GALLERY_IMAGES} images per product.`)
      return
    }
    setGallery((previous) => normalizeGallery([...previous, url]))
    setError('')
  }

  const removeGalleryImage = (index) => {
    setGallery((previous) => previous.filter((_, position) => position !== index))
  }

  const removePendingFile = (index) => {
    setPendingFiles((previous) => previous.filter((_, position) => position !== index))
  }

  const makePrimary = (index) => {
    setGallery((previous) => {
      if (index <= 0 || index >= previous.length) return previous
      const copy = [...previous]
      const [picked] = copy.splice(index, 1)
      return [picked, ...copy]
    })
  }

  // Upload pending files, then advance to the form step.
  const handleContinue = async () => {
    if (totalImages === 0) {
      setError('Please select at least one image (file or preset).')
      return
    }

    if (pendingFiles.length === 0) {
      setCurrentStep('form')
      return
    }

    try {
      setUploading(true)
      setError('')

      const uploaded = []
      for (const item of pendingFiles) {
        try {
          const result = await uploadService.uploadImage(item.file)
          uploaded.push(result?.data?.url || item.preview)
        } catch {
          // Keep the local preview so the form can still be completed.
          uploaded.push(item.preview)
        }
      }

      setGallery((previous) => normalizeGallery([...previous, ...uploaded]))
      setPendingFiles([])
      setCurrentStep('form')
    } catch (err) {
      setError(err?.message || 'Image upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // Specs handlers
  const handleSpecChange = (index, field, value) => {
    setSpecs((previous) => {
      const copy = [...previous]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const addSpec = () => {
    setSpecs((previous) => [...previous, { name: '', quantity: '' }])
  }

  const removeSpec = (index) => {
    if (specs.length <= 1) return
    setSpecs((previous) => previous.filter((_, position) => position !== index))
  }

  // Steps handlers
  const handleStepChange = (index, value) => {
    setSteps((previous) => {
      const copy = [...previous]
      copy[index] = value
      return copy
    })
  }

  const addStep = () => {
    setSteps((previous) => [...previous, ''])
  }

  const removeStep = (index) => {
    if (steps.length <= 1) return
    setSteps((previous) => previous.filter((_, position) => position !== index))
  }

  // Submit create product
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
      setError('Please provide at least one maintenance / assembly step.')
      return
    }

    const images = gallery.length > 0 ? gallery : ['/guns/pistol.svg']

    // Prepare payload compliant with backend /api/v1/recipes schema
    const payload = {
      name: formData.name.trim(),
      category: formData.category || 'makanan',
      description: formData.description.trim() || `${formData.type} caliber ${formData.caliber}.`,
      image_url: images[0],
      images,
      prep_time: 15,
      cook_time: Number(formData.price) || 500, // Price stored in cook_time
      servings: Number(formData.servings) || 1,
      difficulty: formData.difficulty || 'mudah',
      is_featured: Boolean(formData.is_featured),
      ingredients: cleanSpecs,
      steps: cleanSteps,
    }

    try {
      setCreating(true)
      const response = await gunService.createGun(payload)
      if (response.success || response.data) {
        deleteDraft('create')
        if (onSuccess) {
          onSuccess(response.data)
        } else if (onBack) {
          onBack()
        }
      } else {
        throw new Error(response.message || 'Failed to create product.')
      }
    } catch (err) {
      setError(err.message || 'Error occurred while saving product to server.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="form-page">
      {/* Header */}
      <div className="form-head">
        <button type="button" className="detail-back" onClick={onBack}>
          <ArrowLeft size={18} /> Back to Catalog
        </button>
        <div className="form-head-actions">
          {currentStep === 'form' && (
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => handleSaveDraft(true)}
              title="Save draft"
            >
              <Save size={14} /> Save Draft
            </button>
          )}
        </div>
      </div>

      <div className="form-title-group">
        <h1 className="display">Register New Hardware</h1>
        <p className="lede">
          Add a firearm or accessory to the catalog. Data will be synchronized with the
          university RESTful backend.
        </p>
      </div>

      {/* Notifications */}
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

      {/* Step Indicators */}
      <div className="form-steps-nav">
        <div className={`step-badge ${currentStep === 'upload' ? 'step-badge--active' : 'step-badge--done'}`}>
          1. Imagery
        </div>
        <div className="step-badge-connector" />
        <div className={`step-badge ${currentStep === 'form' ? 'step-badge--active' : ''}`}>
          2. Specifications &amp; Details
        </div>
      </div>

      {/* STEP 1: Gallery */}
      {currentStep === 'upload' && (
        <div className="card-box">
          <h2 className="card-box-title">
            <Images size={18} /> Weapon Imagery
          </h2>
          <p className="card-box-desc">
            Add up to {MAX_GALLERY_IMAGES} photographs or blueprints (max 5MB each), or
            select armory presets. The first image is the card cover.
          </p>

          <div className="upload-dropzone">
            <input
              id="gun-image-input"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handleImageChange}
              className="hidden-file-input"
            />
            <label htmlFor="gun-image-input" className="upload-label">
              <Upload size={36} className="upload-icon" />
              <span className="upload-main-text">Click to choose image files</span>
              <span className="upload-sub-text">
                JPG, PNG, or WebP up to 5MB · {totalImages}/{MAX_GALLERY_IMAGES} added
              </span>
            </label>

            <div className="preset-selector">
              <span className="preset-title">Or add a stock preset:</span>
              <div className="preset-pills">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    className="pill"
                    onClick={() => handleSelectPreset(preset.url)}
                    disabled={totalImages >= MAX_GALLERY_IMAGES}
                  >
                    <Plus size={12} /> {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(gallery.length > 0 || pendingFiles.length > 0) && (
            <div className="gallery-editor">
              <div className="gallery-grid">
                {gallery.map((url, index) => (
                  <div key={`${url}-${index}`} className="gallery-tile">
                    <img src={url} alt={`Gallery ${index + 1}`} />
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

                {pendingFiles.map((item, index) => (
                  <div key={item.preview} className="gallery-tile gallery-tile--pending">
                    <img src={item.preview} alt={`Pending upload ${index + 1}`} />
                    <span className="gallery-tile__pending-label">Not uploaded</span>
                    <button
                      type="button"
                      className="gallery-tile__remove"
                      onClick={() => removePendingFile(index)}
                      title="Remove image"
                      aria-label="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn btn--primary"
                onClick={handleContinue}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader size={18} className="spin" /> Uploading imagery…
                  </>
                ) : (
                  <>
                    <Upload size={18} /> Confirm {totalImages} image
                    {totalImages !== 1 ? 's' : ''} &amp; Continue
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Product Form */}
      {currentStep === 'form' && (
        <form onSubmit={handleSubmit} className="entry-form">
          {/* Active gallery strip */}
          <div className="selected-thumb-bar">
            <div className="selected-thumb-gallery">
              {gallery.slice(0, 4).map((url, index) => (
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt={`Selected ${index + 1}`}
                  className="thumb-small"
                />
              ))}
              {gallery.length > 4 && (
                <span className="thumb-more">+{gallery.length - 4}</span>
              )}
            </div>
            <div className="thumb-info">
              <span className="thumb-title">
                {gallery.length} image{gallery.length !== 1 ? 's' : ''} assigned
              </span>
              <span className="thumb-sub">First image is the catalog cover</span>
            </div>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setCurrentStep('upload')}
            >
              Manage Images
            </button>
          </div>

          {/* Core Info */}
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Model Designation <span className="req">*</span>
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="e.g. Glock 19 Gen 5, Colt M4A1..."
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="type" className="form-label">
                Platform / Category <span className="req">*</span>
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={(event) => {
                  handleFormChange(event)
                  // Map category for backend schema
                  setFormData((previous) => ({
                    ...previous,
                    category: event.target.value === 'Pistol' ? 'makanan' : 'minuman',
                  }))
                }}
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
              <label htmlFor="caliber" className="form-label">
                Caliber / Chambering <span className="req">*</span>
              </label>
              <input
                id="caliber"
                type="text"
                name="caliber"
                value={formData.caliber}
                onChange={handleFormChange}
                placeholder="e.g. 9mm, 5.56mm, 12 Gauge"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="price" className="form-label">
                Price (USD) <span className="req">*</span>
              </label>
              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleFormChange}
                placeholder="599"
                min="0"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="difficulty" className="form-label">
                Grade / Build Quality <span className="req">*</span>
              </label>
              <select
                id="difficulty"
                name="difficulty"
                value={formData.difficulty}
                onChange={handleFormChange}
                className="form-select"
              >
                <option value="mudah">Commercial / Standard</option>
                <option value="sedang">Mil-Spec / Service Issue</option>
                <option value="sulit">Match Grade / Custom</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Armory Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              placeholder="Operational background, ergonomics, intended mission profile..."
              rows={3}
              className="form-textarea"
            />
          </div>

          {/* Specifications (Ingredients) */}
          <div className="form-fieldset">
            <div className="fieldset-header">
              <label className="form-label">Specifications &amp; Components</label>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={addSpec}
              >
                <Plus size={14} /> Add Spec
              </button>
            </div>
            <div className="multi-rows">
              {specs.map((spec, index) => (
                <div key={index} className="multi-row">
                  <input
                    type="text"
                    placeholder="Attribute (e.g. Barrel Length, Action)"
                    value={spec.name}
                    onChange={(event) => handleSpecChange(index, 'name', event.target.value)}
                    className="form-input"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 16 inch, Striker-fired)"
                    value={spec.quantity}
                    onChange={(event) => handleSpecChange(index, 'quantity', event.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => removeSpec(index)}
                    disabled={specs.length <= 1}
                    title="Remove item"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Assembly / Maintenance Steps */}
          <div className="form-fieldset">
            <div className="fieldset-header">
              <label className="form-label">Assembly &amp; Maintenance Protocol</label>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={addStep}
              >
                <Plus size={14} /> Add Step
              </button>
            </div>
            <div className="multi-rows">
              {steps.map((step, index) => (
                <div key={index} className="step-row">
                  <span className="step-num">{index + 1}</span>
                  <input
                    type="text"
                    placeholder="e.g. Clear the chamber and lock slide back..."
                    value={step}
                    onChange={(event) => handleStepChange(index, event.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="btn btn--danger-ghost"
                    onClick={() => removeStep(index)}
                    disabled={steps.length <= 1}
                    title="Remove step"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Featured checkbox */}
          <div className="checkbox-row">
            <input
              id="is_featured"
              type="checkbox"
              name="is_featured"
              checked={formData.is_featured}
              onChange={handleFormChange}
              className="form-checkbox"
            />
            <label htmlFor="is_featured" className="checkbox-label">
              Feature in Armory Showcase (Highlight product on catalog)
            </label>
          </div>

          {/* Submit bar */}
          <div className="form-actions-bar">
            <button
              type="button"
              className="btn btn--outline"
              onClick={onBack}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader size={18} className="spin" /> Registering Hardware…
                </>
              ) : (
                'Commit to Armory'
              )}
            </button>
          </div>
        </form>
      )}

      {/* Restore Draft Modal */}
      <ConfirmModal
        open={showDraftModal}
        title="Resume Previous Draft?"
        message={`An unfinished draft from ${draftTimestamp ? formatDraftTime(draftTimestamp) : 'earlier'} was detected. Would you like to resume editing?`}
        confirmLabel="Load Draft"
        cancelLabel="Discard"
        onConfirm={handleLoadDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  )
}
