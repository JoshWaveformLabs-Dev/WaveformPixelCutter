import { convertFileSrc } from '@tauri-apps/api/core'
import type { PointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

type PreviewPaneProps = {
  imageSrc: string
  imageLabel: string
  shape: 'rectangle' | 'rounded'
  cornerRadiusPx: number
  insetPx: number
  showMaskOutline: boolean
  dimMaskedArea: boolean
  cropRect: null | { x: number; y: number; w: number; h: number }
  setCropRect: (rect: null | { x: number; y: number; w: number; h: number }) => void
  isSelecting: boolean
  setIsSelecting: (value: boolean) => void
}

export default function PreviewPane({
  imageSrc,
  imageLabel,
  shape,
  cornerRadiusPx,
  insetPx,
  showMaskOutline,
  dimMaskedArea,
  cropRect,
  setCropRect,
  isSelecting,
  setIsSelecting,
}: PreviewPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [naturalSize, setNaturalSize] = useState({ width: 1600, height: 1200 })
  const [anchor, setAnchor] = useState<null | { x: number; y: number }>(null)
  const [current, setCurrent] = useState<null | { x: number; y: number }>(null)
  const pointerIdRef = useRef<number | null>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const clearSelectionState = () => {
    setAnchor(null)
    setCurrent(null)
    setIsSelecting(false)
    if (pointerIdRef.current !== null && containerRef.current) {
      if (containerRef.current.hasPointerCapture(pointerIdRef.current)) {
        containerRef.current.releasePointerCapture(pointerIdRef.current)
      }
      pointerIdRef.current = null
    }
  }

  useEffect(() => {
    if (!isSelecting && anchor) {
      clearSelectionState()
    }
  }, [isSelecting, anchor])

  const displayRect = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) {
      return { x: 0, y: 0, w: 0, h: 0, scale: 1 }
    }
    const scale = Math.min(
      containerSize.width / naturalSize.width,
      containerSize.height / naturalSize.height,
    )
    const w = naturalSize.width * scale
    const h = naturalSize.height * scale
    return {
      x: (containerSize.width - w) / 2,
      y: (containerSize.height - h) / 2,
      w,
      h,
      scale,
    }
  }, [containerSize, naturalSize])

  const mapPointerToOriginal = (clientX: number, clientY: number) => {
    if (!containerRef.current || displayRect.scale === 0) return null
    const bounds = containerRef.current.getBoundingClientRect()
    const localX = clientX - bounds.left
    const localY = clientY - bounds.top
    const minX = displayRect.x
    const maxX = displayRect.x + displayRect.w
    const minY = displayRect.y
    const maxY = displayRect.y + displayRect.h
    const clampedX = Math.min(Math.max(localX, minX), maxX)
    const clampedY = Math.min(Math.max(localY, minY), maxY)
    const imageLocalX = clampedX - displayRect.x
    const imageLocalY = clampedY - displayRect.y
    const x = imageLocalX / displayRect.scale
    const y = imageLocalY / displayRect.scale
    return { x, y }
  }

  const outlineInset = shape === 'rounded' ? insetPx * displayRect.scale : 0
  const outlineRadius =
    shape === 'rounded' ? cornerRadiusPx * displayRect.scale : 8

  const resolvedSrc = useMemo(() => {
    if (/^(https?:|data:|blob:)/.test(imageSrc)) {
      return imageSrc
    }
    if (/^[a-zA-Z]:\\/.test(imageSrc) || imageSrc.startsWith('\\\\')) {
      return convertFileSrc(imageSrc)
    }
    return imageSrc
  }, [imageSrc])

  const normalizeRect = (
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) => {
    const minX = Math.min(start.x, end.x)
    const minY = Math.min(start.y, end.y)
    const maxX = Math.max(start.x, end.x)
    const maxY = Math.max(start.y, end.y)
    // Deterministic rounding:
    // - floor for top-left
    // - ceil for bottom-right
    // Clamp to image bounds before deriving width/height.
    const x = Math.max(0, Math.floor(minX))
    const y = Math.max(0, Math.floor(minY))
    const x2 = Math.min(naturalSize.width, Math.ceil(maxX))
    const y2 = Math.min(naturalSize.height, Math.ceil(maxY))
    const w = Math.max(0, x2 - x)
    const h = Math.max(0, y2 - y)
    return { x, y, w, h }
  }

  const toPreviewRect = (rect: { x: number; y: number; w: number; h: number }) => ({
    left: displayRect.x + rect.x * displayRect.scale,
    top: displayRect.y + rect.y * displayRect.scale,
    width: rect.w * displayRect.scale,
    height: rect.h * displayRect.scale,
  })

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!anchor || !containerRef.current || !isSelecting) return
    const point = mapPointerToOriginal(event.clientX, event.clientY)
    if (!point) return
    setCurrent(point)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const point = mapPointerToOriginal(event.clientX, event.clientY)
    if (!point) return

    if (!anchor) {
      if (cropRect) {
        setCropRect(null)
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      pointerIdRef.current = event.pointerId
      setAnchor(point)
      setCurrent(point)
      setIsSelecting(true)
      return
    }

    const nextRect = normalizeRect(anchor, point)
    setCropRect(nextRect)
    setAnchor(null)
    setCurrent(null)
    setIsSelecting(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pointerIdRef.current = null
  }

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (pointerIdRef.current === event.pointerId) {
      pointerIdRef.current = null
    }
  }

  const activeRect =
    anchor && current ? normalizeRect(anchor, current) : cropRect
  const activePreviewRect =
    activeRect && displayRect.w > 0 ? toPreviewRect(activeRect) : null

  const outlineRect = showMaskOutline
    ? {
        left: displayRect.x + outlineInset,
        top: displayRect.y + outlineInset,
        width: Math.max(displayRect.w - outlineInset * 2, 0),
        height: Math.max(displayRect.h - outlineInset * 2, 0),
        borderRadius: outlineRadius,
      }
    : null

  return (
    <div className="card preview-card">
      <h3>Preview</h3>
      <div
        className="preview-area"
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
      >
        <img
          className="preview-image"
          src={resolvedSrc}
          alt={imageLabel}
          draggable={false}
          onError={() => {
            console.warn('Preview image failed to load:', resolvedSrc)
          }}
          onLoad={(event) => {
            const target = event.currentTarget
            setNaturalSize({
              width: target.naturalWidth,
              height: target.naturalHeight,
            })
          }}
          style={{
            left: `${displayRect.x}px`,
            top: `${displayRect.y}px`,
            width: `${displayRect.w}px`,
            height: `${displayRect.h}px`,
          }}
        />
        {outlineRect ? (
          <div
            className="preview-outline"
            style={{
              left: `${outlineRect.left}px`,
              top: `${outlineRect.top}px`,
              width: `${outlineRect.width}px`,
              height: `${outlineRect.height}px`,
              borderRadius: `${outlineRect.borderRadius}px`,
            }}
          />
        ) : null}
        {dimMaskedArea && outlineRect ? (
          <div
            className="preview-dim"
            style={{
              left: `${outlineRect.left}px`,
              top: `${outlineRect.top}px`,
              width: `${outlineRect.width}px`,
              height: `${outlineRect.height}px`,
              borderRadius: `${outlineRect.borderRadius}px`,
            }}
          />
        ) : null}
        {activePreviewRect ? (
          <div
            className="crop-rect"
            style={{
              left: `${activePreviewRect.left}px`,
              top: `${activePreviewRect.top}px`,
              width: `${activePreviewRect.width}px`,
              height: `${activePreviewRect.height}px`,
            }}
          >
            <span className="crop-handle is-tl" />
            <span className="crop-handle is-tr" />
            <span className="crop-handle is-br" />
            <span className="crop-handle is-bl" />
          </div>
        ) : null}
      </div>
      <div className="preview-footer">
        <span>Preview</span>
        <span className="preview-meta">{imageLabel}</span>
        <span>4:3</span>
      </div>
    </div>
  )
}
