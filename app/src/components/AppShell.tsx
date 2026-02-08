import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useState } from 'react'
import logo from '../assets/Logo.png'
import sampleImage from '../assets/sample.png'
import Card from './Card'
import FieldRow from './FieldRow'
import PreviewPane from './PreviewPane'
import Toggle from './Toggle'

type ImageEntry = {
  path: string
  name: string
  ext: string
}

type ExportProgress = {
  currentIndex: number
  total: number
  fileName: string
}

type ExportSummary = {
  exported: number
  skipped: number
  errors: string[]
}

export default function AppShell() {
  const [shape, setShape] = useState<'rectangle' | 'rounded'>('rounded')
  const [cornerRadiusPx, setCornerRadiusPx] = useState(18)
  const [insetPx, setInsetPx] = useState(0)
  const [transparentPng, setTransparentPng] = useState(true)
  const [showMaskOutline, setShowMaskOutline] = useState(true)
  const [dimMaskedArea, setDimMaskedArea] = useState(false)
  const [targetSize, setTargetSize] = useState({ w: 1600, h: 1200 })
  const [filenameMode, setFilenameMode] = useState<'ui' | 'cropped'>('ui')
  const [cropRect, setCropRect] = useState<null | {
    x: number
    y: number
    w: number
    h: number
  }>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [inputDir, setInputDir] = useState<string | null>(null)
  const [outputDir, setOutputDir] = useState<string | null>(null)
  const [imageList, setImageList] = useState<ImageEntry[]>([])
  const [selectedImagePath, setSelectedImagePath] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [lastExportPath, setLastExportPath] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(
    null,
  )
  const [toast, setToast] = useState<null | { type: 'success' | 'error'; message: string }>(null)
  const [thumbFallbackDataUrl, setThumbFallbackDataUrl] = useState<string | null>(
    null,
  )

  const cropValue = (value: number) => (cropRect ? String(value) : '--')

  const selectedImage =
    imageList.find((entry) => entry.path === selectedImagePath) ?? null
  const previewSrc = selectedImagePath
    ? convertFileSrc(selectedImagePath)
    : sampleImage
  const previewLabel = selectedImage?.name ?? 'Sample input'
  const isLocalPath = (value: string) =>
    value.startsWith('\\\\?\\') ||
    /^[a-zA-Z]:[\\/]/.test(value) ||
    value.startsWith('\\\\')
  const thumbSrc = !selectedImagePath
    ? sampleImage
    : isLocalPath(selectedImagePath)
      ? convertFileSrc(selectedImagePath)
      : selectedImagePath
  const sampleSubtext =
    !selectedImagePath || imageList.length === 0 || !inputDir
      ? 'Built-in sample'
      : 'From input folder'

  const inputHelper = !inputDir
    ? 'Select a folder to load images.'
    : imageList.length > 0
      ? `${imageList.length} images found.`
      : 'No supported images found.'

  const progressRatio =
    exportProgress && exportProgress.total > 0
      ? exportProgress.currentIndex / exportProgress.total
      : 0

  const statusText = exportMessage
    ? exportMessage
    : isExporting && exportProgress
      ? `Exporting ${exportProgress.currentIndex}/${exportProgress.total}: ${exportProgress.fileName}`
      : isSelecting
        ? 'Selecting crop...'
        : !inputDir
          ? 'No input selected'
          : cropRect
            ? `Crop selected: ${cropRect.w}x${cropRect.h}`
            : 'No crop selected'

  const exportDisabled =
    !cropRect || !inputDir || !outputDir || imageList.length === 0 || isExporting

  const handleExport = async () => {
    if (!cropRect || !inputDir || !outputDir || imageList.length === 0) return
    if (isExporting) return
    try {
      setIsExporting(true)
      setIsCancelling(false)
      setExportMessage('Exporting...')
      setExportProgress({ currentIndex: 0, total: imageList.length, fileName: '' })

      const summary = await invoke<ExportSummary>('export_batch', {
        inputDir,
        outputDir,
        crop: cropRect,
        shape,
        radiusPx: cornerRadiusPx,
        insetPx,
        targetW: targetSize.w,
        targetH: targetSize.h,
        transparentPng,
        filenameMode,
      })

      const errorCount = summary.errors.length
      setExportMessage(
        `Exported ${summary.exported}, skipped ${summary.skipped}${
          errorCount ? `, errors ${errorCount}` : ''
        }`,
      )
      setLastExportPath(outputDir)
      if (errorCount > 0) {
        setToast({
          type: 'error',
          message: `Exported ${summary.exported}, skipped ${summary.skipped}, errors ${errorCount}`,
        })
      } else {
        setToast({ type: 'success', message: 'Exported PNGs' })
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? 'Export failed')
      setExportMessage('Export failed')
      setToast({ type: 'error', message })
    } finally {
      setIsExporting(false)
      setIsCancelling(false)
      setExportProgress(null)
    }
  }

  const handleCancelExport = async () => {
    if (!isExporting || isCancelling) return
    setIsCancelling(true)
    setExportMessage('Cancelling...')
    try {
      await invoke('cancel_export')
    } catch {
      setIsCancelling(false)
    }
  }

  const handleChooseInput = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Choose input folder',
      })
      if (!selected || Array.isArray(selected)) return
      setInputDir(selected)
      const images = await invoke<ImageEntry[]>('list_images_in_dir', {
        inputDir: selected,
      })
      setImageList(images)
      setSelectedImagePath(images[0]?.path ?? null)
      setCropRect(null)
      setIsSelecting(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? 'Failed to load folder')
      setToast({ type: 'error', message })
    }
  }

  const handleChooseOutput = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Choose output folder',
      })
      if (!selected || Array.isArray(selected)) return
      setOutputDir(selected)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? 'Failed to select output folder')
      setToast({ type: 'error', message })
    }
  }

  const handleCopySampleName = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard unavailable')
      }
      await navigator.clipboard.writeText(previewLabel)
      setToast({ type: 'success', message: 'Filename copied' })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? 'Copy failed')
      setToast({ type: 'error', message })
    }
  }

  const handlePreviewCrop = () => {
    setToast({ type: 'success', message: 'Preview Crop coming soon' })
  }

  useEffect(() => {
    let unlisten: null | (() => void) = null
    listen<ExportProgress>('export_progress', (event) => {
      setExportProgress(event.payload)
    })
      .then((unsub) => {
        unlisten = unsub
      })
      .catch(() => {})
    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [])

  useEffect(() => {
    setCropRect(null)
    setIsSelecting(false)
  }, [selectedImagePath])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setToast(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-left">
          <img className="app-logo app-logo-small" src={logo} alt="WaveformOS logo" />
        </div>
        <div className="topbar-actions">
          <button className="button icon-button icon-button-circle" type="button">
            ?
          </button>
          <button
            className="button button-primary button-pill"
            type="button"
            onClick={handleExport}
            disabled={exportDisabled}
          >
            Export
          </button>
        </div>
      </header>
      <main className="app-main">
        <aside className="left-rail">
          <section className="panel-stack">
            <Card title="Input Folder">
            <FieldRow label="Input folder">
              <input
                className="input"
                type="text"
                value={inputDir ?? 'No folder selected'}
                readOnly
              />
              <button className="button" type="button" onClick={handleChooseInput}>
                Choose...
              </button>
            </FieldRow>
              <p className="helper-text">{inputHelper}</p>
            </Card>

            <Card title="Sample Image">
              <FieldRow label="Sample image">
                <select
                  className="input"
                  value={selectedImagePath ?? ''}
                  onChange={(event) => setSelectedImagePath(event.target.value)}
                  disabled={imageList.length === 0}
                >
                  {imageList.length === 0 ? (
                    <option value="">No images</option>
                  ) : null}
                  {imageList.map((entry) => (
                    <option key={entry.path} value={entry.path}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <div className="sample-row">
                <img
                  className="sample-thumb"
                  src={thumbFallbackDataUrl ?? thumbSrc}
                  alt={previewLabel}
                  draggable={false}
                  onLoad={() => {
                    setThumbFallbackDataUrl(null)
                  }}
                  onError={() => {
                    console.warn(
                      'Sample thumb failed to load, requesting data url:',
                      thumbSrc,
                    )
                    if (!selectedImagePath || !isLocalPath(selectedImagePath)) {
                      return
                    }
                    invoke<string>('read_image_data_url', {
                      path: selectedImagePath,
                    })
                      .then((dataUrl) => {
                        setThumbFallbackDataUrl(dataUrl)
                      })
                      .catch((error) => {
                        console.warn('Sample thumb data url failed:', error)
                      })
                  }}
                />
                <div className="sample-selected-meta">
                  <span className="sample-selected-name">{previewLabel}</span>
                  <span className="sample-selected-sub">{sampleSubtext}</span>
                </div>
                <button
                  className="button icon-button"
                  type="button"
                  onClick={handleCopySampleName}
                  aria-label="Copy filename"
                >
                  ⧉
                </button>
              </div>
            </Card>

            <Card title="Define Crop">
            <FieldRow label="Region">
              <div className="field-group">
                <input
                  className="input input-short"
                  value={cropValue(cropRect?.x ?? 0)}
                  readOnly
                />
                <input
                  className="input input-short"
                  value={cropValue(cropRect?.y ?? 0)}
                  readOnly
                />
                <input
                  className="input input-short"
                  value={cropValue(cropRect?.w ?? 0)}
                  readOnly
                />
                <input
                  className="input input-short"
                  value={cropValue(cropRect?.h ?? 0)}
                  readOnly
                />
              </div>
            </FieldRow>
            <p className="helper-text">Click top-left then bottom-right</p>
            <div className="crop-actions">
              <button
                className="button button-subtle"
                type="button"
                onClick={() => {
                  setCropRect(null)
                  setIsSelecting(false)
                }}
                disabled={!cropRect}
              >
                Clear selection
              </button>
                <button className="button" type="button" disabled>
                  Center to safe area
                </button>
              </div>
            </Card>

            <Card title="Screen Shape">
              <FieldRow label="Shape">
                <select
                  className="input"
                  value={shape}
                  onChange={(event) =>
                    setShape(event.target.value as 'rectangle' | 'rounded')
                  }
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="rounded">Rounded Screen</option>
                </select>
              </FieldRow>
              <FieldRow label="Corner radius">
                <input
                  className="input"
                  type="number"
                  value={cornerRadiusPx}
                  min={0}
                  disabled={shape !== 'rounded'}
                  onChange={(event) => setCornerRadiusPx(Number(event.target.value))}
                />
              </FieldRow>
              <FieldRow label="Inset (px)">
                <input
                  className="input"
                  type="number"
                  value={insetPx}
                  min={0}
                  disabled={shape !== 'rounded'}
                  onChange={(event) => setInsetPx(Number(event.target.value))}
                />
              </FieldRow>
              <p className="helper-text">Affects preview + export mask.</p>
              <Toggle
                label="Transparent PNG"
                checked={transparentPng}
                onChange={setTransparentPng}
              />
              <Toggle
                label="Show mask outline"
                checked={showMaskOutline}
                onChange={setShowMaskOutline}
              />
              <Toggle
                label="Dim masked area"
                checked={dimMaskedArea}
                onChange={setDimMaskedArea}
              />
            </Card>

            <Card title="Output">
              <FieldRow label="Output folder">
                <input
                  className="input"
                  type="text"
                  value={outputDir ?? 'Not set'}
                  readOnly
                />
                <button className="button" type="button" onClick={handleChooseOutput}>
                  Choose...
                </button>
              </FieldRow>
              <FieldRow label="Filename mode">
                <select
                  className="input"
                  value={filenameMode}
                  onChange={(event) =>
                    setFilenameMode(event.target.value as 'ui' | 'cropped')
                  }
                >
                  <option value="ui">UI (keep name)</option>
                  <option value="cropped">Cropped suffix</option>
                </select>
              </FieldRow>
            </Card>
          </section>
        </aside>

        <section className="right-pane">
          <PreviewPane
            imageSrc={previewSrc}
            imageLabel={previewLabel}
            shape={shape}
            cornerRadiusPx={cornerRadiusPx}
            insetPx={insetPx}
            showMaskOutline={showMaskOutline}
            dimMaskedArea={dimMaskedArea}
            cropRect={cropRect}
            setCropRect={setCropRect}
            isSelecting={isSelecting}
            setIsSelecting={setIsSelecting}
          />
        </section>
      </main>

      <footer className="bottom-strip">
        <div className="bottom-strip-left">
          <span className="bottom-status">{statusText}</span>
        </div>
        <div className="bottom-strip-center">
          <span className="crop-chip">
            {cropRect ? `${cropRect.w} x ${cropRect.h}` : '-- x --'}
          </span>
          <div className="preset-row">
            <button
              className="button button-small"
              type="button"
              onClick={() => setTargetSize({ w: 1600, h: 1200 })}
            >
              1600x1200
            </button>
            <button
              className="button button-small"
              type="button"
              onClick={() => setTargetSize({ w: 1024, h: 768 })}
            >
              1024x768
            </button>
            <button
              className="button button-small"
              type="button"
              onClick={() => setTargetSize({ w: 640, h: 480 })}
            >
              640x480
            </button>
            <span className="preset-chip">4:3</span>
          </div>
          <div className="lock-toggle">
            <span className="lock-label">Lock 4:3</span>
            <div className="lock-switch" aria-hidden="true">
              <span className="lock-knob" />
            </div>
          </div>
        </div>
        <div className="bottom-strip-right">
          <button className="button button-subtle" type="button" onClick={handlePreviewCrop}>
            Preview Crop
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={handleExport}
            disabled={exportDisabled}
          >
            Batch Export
          </button>
          {isExporting ? (
            <button
              className="button button-subtle button-small"
              type="button"
              onClick={handleCancelExport}
              disabled={!isExporting || isCancelling}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </footer>

      <div className="toast-host" aria-live="polite">
        {toast ? (
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
