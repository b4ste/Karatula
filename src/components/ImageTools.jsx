import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { adjustImage, cropImage, resetImageCrop, setImageMask } from '../utils/imageEditing'

export default function ImageTools({ image, onEdit, onError }) {
  const [edges, setEdges] = useState({ left: 0, right: 0, top: 0, bottom: 0 })
  const applyCrop = () => {
    try {
      onEdit(() => cropImage(image, edges))
      setEdges({ left: 0, right: 0, top: 0, bottom: 0 })
    } catch (error) { onError(error.message) }
  }
  return <section className="image-tools" aria-label="Image editing tools">
    <details className="image-settings">
      <summary><span>Image settings</span><ChevronDown aria-hidden="true" size={17} /></summary>
      <fieldset disabled={image.isLocked}>
      <h3>Adjustments</h3>
      {[['brightness', 'Brightness'], ['contrast', 'Contrast'], ['saturation', 'Saturation'], ['vibrance', 'Vibrance'], ['hue', 'HueRotation'], ['blur', 'Blur'], ['pixelate', 'Pixelate']].map(([key, type]) => {
        const property = key === 'hue' ? 'rotation' : key === 'pixelate' ? 'blocksize' : key
        const current = image.filters?.find((filter) => filter.type === type)?.[property] || 0
        const isPixelate = key === 'pixelate'
        return <label key={key}>{key === 'hue' ? 'Hue' : type} <output>{isPixelate ? `${current}px` : `${Math.round(current * 100)}%`}</output>
          <input aria-label={key === 'hue' ? 'Hue' : type} type="range" min={key === 'blur' || isPixelate ? 0 : -100} max={isPixelate ? 50 : 100} step="1" value={isPixelate ? current : Math.round(current * 100)}
            onChange={(event) => onEdit(() => adjustImage(image, key, isPixelate ? (Number(event.target.value) < 2 ? 0 : Number(event.target.value)) : Number(event.target.value) / 100))} />
        </label>
      })}
      <div className="arrange-grid">
        {['Grayscale', 'Sepia', 'Invert'].map((type) => {
          const enabled = image.filters?.some((filter) => filter.type === type)
          return <button key={type} type="button" aria-pressed={Boolean(enabled)} onClick={() => onEdit(() => adjustImage(image, type, !enabled))}>{type}</button>
        })}
      </div>
      <button type="button" onClick={() => onEdit(() => { image.filters = []; image.applyFilters(); image.set('dirty', true) })}>Reset adjustments</button>
      <h3>Image mask</h3>
      <p>Hide parts of this image without changing its pixels.</p>
      <label>Shape
        <select aria-label="Image mask shape" value={image.maskShape || 'none'}
          onChange={(event) => onEdit(() => setImageMask(image, event.target.value, image.maskInset || 0, image.maskInverted || false))}>
          <option value="none">None</option>
          <option value="rectangle">Rectangle</option>
          <option value="ellipse">Ellipse</option>
          {image.maskShape === 'marquee' && <option value="marquee">Canvas selection</option>}
        </select>
      </label>
      {['rectangle', 'ellipse'].includes(image.maskShape) && <>
        <label>Inset <output>{image.maskInset || 0}%</output>
          <input aria-label="Mask inset" type="range" min="0" max="45" value={image.maskInset || 0}
            onChange={(event) => onEdit(() => setImageMask(image, image.maskShape, Number(event.target.value), image.maskInverted || false))} />
        </label>
        <label className="mask-invert"><input type="checkbox" checked={Boolean(image.maskInverted)}
          onChange={(event) => onEdit(() => setImageMask(image, image.maskShape, image.maskInset || 0, event.target.checked))} /> Invert mask</label>
      </>}
      <h3>Crop image</h3>
      <p>Trim a percentage from each edge. The original stays available.</p>
      <div className="two-column">
        {Object.entries(edges).map(([edge, value]) => <label key={edge}>{edge} %
          <input aria-label={`Crop ${edge} percent`} type="number" min="0" max="99" value={value} onChange={(event) => setEdges({ ...edges, [edge]: event.target.value })} />
        </label>)}
      </div>
      <div className="two-column">
        <button type="button" onClick={applyCrop}>Apply crop</button>
        <button type="button" disabled={!image.originalCrop} onClick={() => onEdit(() => resetImageCrop(image))}>Reset crop</button>
      </div>
      </fieldset>
    </details>
  </section>
}
