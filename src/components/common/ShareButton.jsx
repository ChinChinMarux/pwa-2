import { useEffect, useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { buildGunShareUrl } from '../../utils/helpers'

const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy copy path.
  }

  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(field)
    return ok
  } catch {
    return false
  }
}

/**
 * ShareButton — shares a deep link to a product.
 *
 * Uses the Web Share API when available (mobile / supported desktop), and
 * copies the link to the clipboard otherwise.  The link is `#/gun/<id>`, which
 * App.jsx resolves straight to the product detail view.
 */
export default function ShareButton({
  gun,
  showLabel = false,
  className = 'card-act-btn',
}) {
  const [status, setStatus] = useState('idle')
  const url = buildGunShareUrl(gun)

  useEffect(() => {
    if (status === 'idle') return undefined
    const timer = setTimeout(() => setStatus('idle'), 2500)
    return () => clearTimeout(timer)
  }, [status])

  const handleShare = async (event) => {
    event.stopPropagation()

    const title = gun?.name ? `${gun.name} — Bore & Barrel` : 'Bore & Barrel'
    const text = gun?.name
      ? `Check out ${gun.name} at Bore & Barrel.`
      : 'Check out Bore & Barrel.'

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url })
        setStatus('shared')
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
        // Share failed (permissions / unsupported) — copy instead.
      }
    }

    const copied = await copyText(url)
    setStatus(copied ? 'copied' : 'error')
  }

  const label =
    status === 'copied'
      ? 'Link copied'
      : status === 'shared'
        ? 'Link shared'
        : status === 'error'
          ? 'Copy failed'
          : 'Share link'

  return (
    <button
      type="button"
      className={className}
      onClick={handleShare}
      title={label}
      aria-label={`${label} for ${gun?.name || 'this product'}`}
    >
      {status === 'copied' || status === 'shared' ? (
        <Check size={16} />
      ) : (
        <Share2 size={16} />
      )}
      {showLabel && <span>{label}</span>}
      <span className="sr-only" aria-live="polite">
        {status === 'copied' ? 'Link copied to clipboard' : ''}
      </span>
    </button>
  )
}
