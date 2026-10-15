import { useEffect, useState } from 'react'
import { StaticCanvas } from 'fabric'
import {
  createDivisoriaDesign,
  DIVISORIA_BACKGROUND,
  DIVISORIA_PREVIEW_SIZE,
  loadDivisoriaFonts,
} from '../utils/premadeAssets'

export default function PremadeAssets({ onClose, onUseDivisoria }) {
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    let active = true

    const renderPreview = async () => {
      await loadDivisoriaFonts()
      const objects = await createDivisoriaDesign(
        DIVISORIA_PREVIEW_SIZE.width,
        DIVISORIA_PREVIEW_SIZE.height,
      )
      if (!active) return

      const preview = new StaticCanvas(null, {
        width: DIVISORIA_PREVIEW_SIZE.width,
        height: DIVISORIA_PREVIEW_SIZE.height,
        backgroundColor: DIVISORIA_BACKGROUND,
        renderOnAddRemove: false,
      })
      try {
        preview.add(...objects)
        preview.renderAll()
        if (active) setPreviewUrl(preview.toDataURL({ format: 'png' }))
      } finally {
        preview.dispose()
      }
    }

    renderPreview().catch(() => {})
    return () => { active = false }
  }, [])

  return <div className="modal-backdrop" role="presentation">
    <div aria-labelledby="premade-assets-title" aria-modal="true"
      className="confirm-modal premade-assets-modal" role="dialog">
      <h2 id="premade-assets-title">Premade Assets</h2>
      <p>Choose a design to place on your sign. You can edit its layers afterward.</p>
      <div className="premade-assets-grid">
        <button className="premade-asset-card" type="button" onClick={onUseDivisoria}>
          <div className="premade-asset-preview">
            {previewUrl && <img src={previewUrl} alt="" />}
          </div>
          <span className="premade-asset-name">Divisoria City Hall</span>
          <small>Fits current board · Replaces layers · Undo available</small>
        </button>
      </div>
      <div className="modal-actions">
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>
}
