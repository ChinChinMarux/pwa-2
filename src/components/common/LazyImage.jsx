import { useEffect, useRef, useState } from 'react'

/**
 * LazyImage — defers the <img> request until the element is near the viewport
 * using IntersectionObserver, and keeps the native `loading="lazy"` +
 * `decoding="async"` attributes as a second layer.
 *
 * A skeleton placeholder fills the box until the image finishes loading, and
 * a broken URL falls back to the product placeholder.
 */
export default function LazyImage({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  fallback = '/guns/pistol.svg',
  eager = false,
  width,
  height,
}) {
  const holderRef = useRef(null)
  const [shouldLoad, setShouldLoad] = useState(
    () => eager || typeof IntersectionObserver === 'undefined',
  )
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [src])

  useEffect(() => {
    if (shouldLoad) return undefined

    const node = holderRef.current
    if (!node) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '240px 0px', threshold: 0.01 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [shouldLoad])

  const finalSrc = failed ? fallback : src
  const isLoaded = loaded || !src

  return (
    <span
      ref={holderRef}
      className={`lazy-img${isLoaded ? ' is-loaded' : ''} ${className}`.trim()}
    >
      {!isLoaded && <span className="lazy-img__skeleton" aria-hidden="true" />}
      {shouldLoad && finalSrc ? (
        <img
          src={finalSrc}
          alt={alt}
          width={width}
          height={height}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className={`lazy-img__el${isLoaded ? ' is-loaded' : ''} ${imgClassName}`.trim()}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!failed) {
              setFailed(true)
              setLoaded(false)
            } else {
              // Placeholder also failed — stop the skeleton.
              setLoaded(true)
            }
          }}
        />
      ) : null}
    </span>
  )
}
