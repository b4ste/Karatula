import { useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { CUSTOM_FONTS, DEFAULT_FONT } from '../utils/fonts'

function numberValue(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback
}

function PropertiesPanel({ activeObject, onCommit, onDelete, onUpdate }) {
  const [showCurveResetModal, setShowCurveResetModal] = useState(false)
  const isText = typeof activeObject?.text === 'string'

  if (!activeObject) {
    return (
      <aside className="sidebar properties-panel">
        <section className="empty-panel">
          <h2>Object properties</h2>
          <p>Select text, a shape, or an image on the sign to edit it.</p>
        </section>
      </aside>
    )
  }

  const scaledWidth = numberValue(activeObject.width * activeObject.scaleX)
  const scaledHeight = numberValue(activeObject.height * activeObject.scaleY)

  const setScaledSize = (key, value) => {
    const next = Math.max(Number(value), 1)
    if (key === 'width') {
      onUpdate({ scaleX: next / activeObject.width })
    } else {
      onUpdate({ scaleY: next / activeObject.height })
    }
  }

  return (
    <aside className="sidebar properties-panel">
      <section>
        <h2>Object properties</h2>
        <div className="property-stack">
          {isText && (
            <>
              <label>
                Text
                <textarea
                  rows="3"
                  value={activeObject.text}
                  onBlur={onCommit}
                  onChange={(event) => onUpdate({ text: event.target.value })}
                />
              </label>

              <label>
                Font family
                <select
                  style={{ fontFamily: activeObject.fontFamily || DEFAULT_FONT }}
                  value={activeObject.fontFamily || DEFAULT_FONT}
                  onBlur={onCommit}
                  onChange={(event) => onUpdate({ fontFamily: event.target.value })}
                >
                  {CUSTOM_FONTS.map((font) => (
                    <option key={font} style={{ fontFamily: font }}>
                      {font}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Font size
                <input
                  min="8"
                  type="number"
                  value={numberValue(activeObject.fontSize, 32)}
                  onBlur={onCommit}
                  onChange={(event) => onUpdate({ fontSize: Number(event.target.value) })}
                />
              </label>

              <div className="segmented">
                <button
                  className={activeObject.fontWeight === '700' ? 'is-active' : ''}
                  title="Bold"
                  type="button"
                  onClick={() => {
                    onUpdate({
                      fontWeight: activeObject.fontWeight === '700' ? '400' : '700',
                    })
                    onCommit()
                  }}
                >
                  <Bold size={16} />
                </button>
                <button
                  className={activeObject.fontStyle === 'italic' ? 'is-active' : ''}
                  title="Italic"
                  type="button"
                  onClick={() => {
                    onUpdate({
                      fontStyle:
                        activeObject.fontStyle === 'italic' ? 'normal' : 'italic',
                    })
                    onCommit()
                  }}
                >
                  <Italic size={16} />
                </button>
              </div>

              <div className="segmented">
                <button
                  className={activeObject.textAlign === 'left' ? 'is-active' : ''}
                  title="Align left"
                  type="button"
                  onClick={() => {
                    onUpdate({ textAlign: 'left' })
                    onCommit()
                  }}
                >
                  <AlignLeft size={16} />
                </button>
                <button
                  className={activeObject.textAlign === 'center' ? 'is-active' : ''}
                  title="Align center"
                  type="button"
                  onClick={() => {
                    onUpdate({ textAlign: 'center' })
                    onCommit()
                  }}
                >
                  <AlignCenter size={16} />
                </button>
                <button
                  className={activeObject.textAlign === 'right' ? 'is-active' : ''}
                  title="Align right"
                  type="button"
                  onClick={() => {
                    onUpdate({ textAlign: 'right' })
                    onCommit()
                  }}
                >
                  <AlignRight size={16} />
                </button>
              </div>

              <label>
                Letter spacing
                <input
                  max="500"
                  min="0"
                  type="number"
                  value={numberValue(activeObject.charSpacing, 0)}
                  onBlur={onCommit}
                  onChange={(event) =>
                    onUpdate({ charSpacing: Number(event.target.value) })
                  }
                />
              </label>

              <div className="inline-property">
                <label>
                  Curve
                  <input
                    max="160"
                    min="-160"
                    step="5"
                    type="range"
                    value={numberValue(activeObject.curveAmount, 0)}
                    onBlur={onCommit}
                    onChange={(event) =>
                      onUpdate({ curveAmount: Number(event.target.value) })
                    }
                  />
                </label>
                <button
                  aria-label="Reset curve"
                  className="icon-button"
                  title="Reset curve"
                  type="button"
                  onClick={() => setShowCurveResetModal(true)}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </>
          )}

          <label>
            Text / fill color
            <input
              type="color"
              value={activeObject.fill || '#111111'}
              onBlur={onCommit}
              onChange={(event) => onUpdate({ fill: event.target.value })}
            />
          </label>

          <label>
            Outline
            <input
              min="0"
              type="number"
              value={numberValue(activeObject.strokeWidth, 0)}
              onBlur={onCommit}
              onChange={(event) =>
                onUpdate({ strokeWidth: Number(event.target.value) })
              }
            />
          </label>

          <label>
            Outline color
            <input
              type="color"
              value={activeObject.stroke || '#111111'}
              onBlur={onCommit}
              onChange={(event) => onUpdate({ stroke: event.target.value })}
            />
          </label>

          <label>
            Opacity
            <input
              max="1"
              min="0.05"
              step="0.05"
              type="range"
              value={activeObject.opacity ?? 1}
              onBlur={onCommit}
              onChange={(event) => onUpdate({ opacity: Number(event.target.value) })}
            />
          </label>

          <label>
            Rotation
            <input
              max="360"
              min="-360"
              type="number"
              value={numberValue(activeObject.angle, 0)}
              onBlur={onCommit}
              onChange={(event) => onUpdate({ angle: Number(event.target.value) })}
            />
          </label>

          <div className="two-column">
            <label>
              X
              <input
                type="number"
                value={numberValue(activeObject.left, 0)}
                onBlur={onCommit}
                onChange={(event) => onUpdate({ left: Number(event.target.value) })}
              />
            </label>
            <label>
              Y
              <input
                type="number"
                value={numberValue(activeObject.top, 0)}
                onBlur={onCommit}
                onChange={(event) => onUpdate({ top: Number(event.target.value) })}
              />
            </label>
          </div>

          <div className="two-column">
            <label>
              Width
              <input
                min="1"
                type="number"
                value={scaledWidth}
                onBlur={onCommit}
                onChange={(event) => setScaledSize('width', event.target.value)}
              />
            </label>
            <label>
              Height
              <input
                min="1"
                type="number"
                value={scaledHeight}
                onBlur={onCommit}
                onChange={(event) => setScaledSize('height', event.target.value)}
              />
            </label>
          </div>

          <button className="danger-button" type="button" onClick={onDelete}>
            <Trash2 size={18} />
            Delete object
          </button>
        </div>
      </section>

      {showCurveResetModal && (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-labelledby="curve-reset-title"
            aria-modal="true"
            className="confirm-modal"
            role="dialog"
          >
            <h2 id="curve-reset-title">Reset curve?</h2>
            <p>This will make the selected text straight again.</p>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setShowCurveResetModal(false)}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => {
                  onUpdate({ curveAmount: 0 })
                  onCommit()
                  setShowCurveResetModal(false)
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

export default PropertiesPanel
