import { useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, EyeOff,
  Folder, Lock, Paintbrush, Square, Type, Unlock,
} from 'lucide-react'
import { getLayerDropIndex } from '../utils/layerOrder'

const BLEND_MODES = [
  ['source-over', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'],
  ['overlay', 'Overlay'], ['darken', 'Darken'], ['lighten', 'Lighten'],
  ['color-dodge', 'Color Dodge'], ['color-burn', 'Color Burn'],
  ['hard-light', 'Hard Light'], ['soft-light', 'Soft Light'], ['difference', 'Difference'],
]

function layerKind(object) {
  if (typeof object.text === 'string') return 'Type'
  if (object.type === 'image') return 'Image'
  if (object.isBrushStroke) return 'Brush stroke'
  if (object.type === 'group') return 'Group'
  return 'Shape'
}

function layerEffects(object) {
  const effects = (object.filters || []).map((filter) => filter.type.replace(/([a-z])([A-Z])/g, '$1 $2'))
  if (object.shadow) effects.push('Drop Shadow')
  if (object.clipPath) effects.push('Mask')
  if (object.textureName && object.textureName !== 'none') effects.push('Texture')
  return effects
}

function LayerThumbnail({ object }) {
  const kind = layerKind(object)
  if (kind === 'Image') return <span className="layer-thumbnail layer-thumbnail-image"><img alt="" src={object.getSrc()} /></span>
  const Icon = kind === 'Type' ? Type : kind === 'Group' ? Folder : kind === 'Brush stroke' ? Paintbrush : Square
  const swatch = kind === 'Shape' && typeof object.fill === 'string' ? object.fill : undefined
  return <span className={`layer-thumbnail layer-thumbnail-${kind.toLowerCase().replace(' ', '-')}`}>
    <Icon aria-hidden="true" size={16} style={swatch ? { color: swatch } : undefined} />
  </span>
}

export default function LayersPanel({ canvas, onChange, onLock, onSelect }) {
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [dragging, setDragging] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const draggedRef = useRef(null)
  const objects = canvas?.getObjects() || []
  const selected = canvas?.getActiveObjects() || []
  const selectedLayer = selected.length === 1 ? selected[0] : null
  const selectedIndex = selectedLayer ? objects.indexOf(selectedLayer) : -1
  const toggleEffects = (object) => setCollapsed((current) => {
    const next = new Set(current)
    if (next.has(object)) next.delete(object)
    else next.add(object)
    return next
  })
  const clearDrag = () => {
    draggedRef.current = null
    setDragging(null)
    setDropTarget(null)
  }
  const dropSide = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return event.clientY < bounds.top + bounds.height / 2 ? 'above' : 'below'
  }
  const dragOver = (event, object) => {
    if (!draggedRef.current || draggedRef.current === object) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const side = dropSide(event)
    setDropTarget((current) => current?.object === object && current.side === side ? current : { object, side })
  }
  const dropLayer = (event, object) => {
    const dragged = draggedRef.current
    if (!dragged || dragged === object) return
    event.preventDefault()
    const destination = getLayerDropIndex(canvas.getObjects(), dragged, object, dropSide(event))
    if (destination >= 0 && destination !== canvas.getObjects().indexOf(dragged)) {
      onChange(() => canvas.moveObjectTo(dragged, destination))
    }
    clearDrag()
  }

  return <section className="layers-panel" aria-label="Layers">
    <div className="layers-heading"><h2>Layers</h2><span>{objects.length}</span></div>
    <div className="layers-options">
      <label className="layer-blend-mode">Blend
        <select aria-label="Layer blend mode" disabled={!selectedLayer || selectedLayer.isLocked}
          value={selectedLayer?.globalCompositeOperation || 'source-over'}
          onChange={(event) => onChange(() => selectedLayer.set('globalCompositeOperation', event.target.value))}>
          {BLEND_MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="layer-opacity">Opacity
        <span><input aria-label="Layer opacity" type="number" min="0" max="100" step="1"
          disabled={!selectedLayer || selectedLayer.isLocked} value={Math.round((selectedLayer?.opacity ?? 1) * 100)}
          onChange={(event) => onChange(() => selectedLayer.set('opacity', Math.max(0, Math.min(1, Number(event.target.value) / 100))))} />%</span>
      </label>
    </div>
    {!objects.length && <p className="empty-panel">Add text, shapes, or images to start your sign.</p>}
    <div className="layer-list">
      {[...objects].reverse().map((object, index) => {
        const name = object.layerName || object.text || `${object.type} ${objects.length - index}`
        const kind = layerKind(object)
        const effects = layerEffects(object)
        const isExpanded = !collapsed.has(object)
        return <div className={`layer-entry ${selected.includes(object) ? 'is-selected' : ''} ${object.visible ? '' : 'is-hidden'} ${dragging === object ? 'is-dragging' : ''} ${dropTarget?.object === object ? `drop-${dropTarget.side}` : ''}`}
          key={objects.length - index} draggable={!object.isLocked}
          onDragStart={(event) => {
            if (object.isLocked) { event.preventDefault(); return }
            draggedRef.current = object
            setDragging(object)
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', name)
          }}
          onDragOver={(event) => dragOver(event, object)}
          onDrop={(event) => dropLayer(event, object)}
          onDragEnd={clearDrag}>
          <div className="layer-row">
            <button className="layer-visibility" type="button" title={object.visible ? `Hide ${name}` : `Show ${name}`}
              aria-label={`${object.visible ? 'Hide' : 'Show'} ${name}`}
              onClick={() => onChange(() => { canvas.discardActiveObject(); object.set({ visible: !object.visible }) })}>
              {object.visible ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
            <button className="layer-main" type="button" title={name} onClick={() => onSelect(object)}>
              <LayerThumbnail object={object} />
              <span className="layer-description"><strong>{name}</strong><small>{kind}</small></span>
            </button>
            {effects.length > 0 && <button className="layer-fx-toggle" type="button"
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} effects for ${name}`} aria-expanded={isExpanded}
              onClick={() => toggleEffects(object)}>fx</button>}
            <button className={`layer-lock ${object.isLocked ? 'is-locked' : ''}`} type="button"
              title={object.isLocked ? `Unlock ${name}` : `Lock ${name}`}
              aria-label={`${object.isLocked ? 'Unlock' : 'Lock'} ${name}`}
              aria-pressed={Boolean(object.isLocked)}
              onClick={() => onChange(() => onLock(object, !object.isLocked))}>
              {object.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>
          {effects.length > 0 && isExpanded && <div className="layer-effects">
            <div className="layer-effects-heading"><ChevronDown size={13} /> Effects</div>
            {effects.map((effect, effectIndex) => <div className="layer-effect" key={`${effect}-${effectIndex}`}>
              <ChevronRight size={12} />{effect}
            </div>)}
          </div>}
        </div>
      })}
    </div>
    <div className="layers-footer">
      <span>{selectedLayer ? selectedLayer.layerName || selectedLayer.text || layerKind(selectedLayer) : 'Select a layer'}</span>
      <button type="button" aria-label="Raise selected layer" title="Move layer up"
        disabled={!selectedLayer || selectedLayer.isLocked || selectedIndex === objects.length - 1}
        onClick={() => onChange(() => canvas.bringObjectForward(selectedLayer))}><ArrowUp size={15} /></button>
      <button type="button" aria-label="Lower selected layer" title="Move layer down"
        disabled={!selectedLayer || selectedLayer.isLocked || selectedIndex === 0}
        onClick={() => onChange(() => canvas.sendObjectBackwards(selectedLayer))}><ArrowDown size={15} /></button>
    </div>
  </section>
}
