import { useId, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Bold,
  Eraser,
  Italic,
  RotateCcw,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { CUSTOM_FONTS, DEFAULT_FONT } from '../utils/fonts'

function numberValue(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback
}

function colorValue(value, fallback = '#ffffff') {
  return typeof value === 'string' && value.startsWith('#') ? value : fallback
}

function gradientColor(value, index, fallback) {
  return value?.colorStops?.[index]?.color || fallback
}

function gradientAngle(activeObject) {
  return numberValue(
    activeObject.gradientAngle ?? activeObject.fill?.gradientAngle,
    45,
  )
}

const WARP_OPTIONS = [
  ['none', 'None'],
  ['arc', 'Arc'],
  ['arc-lower', 'Arc Lower'],
  ['arc-upper', 'Arc Upper'],
  ['arch', 'Arch'],
  ['bulge', 'Bulge'],
  ['shell-lower', 'Shell Lower'],
  ['shell-upper', 'Shell Upper'],
  ['flag', 'Flag'],
  ['wave', 'Wave'],
  ['fish', 'Fish'],
  ['rise', 'Rise'],
  ['fisheye', 'FishEye'],
  ['inflate', 'Inflate'],
  ['squeeze', 'Squeeze'],
  ['twist', 'Twist'],
]

const TEXTURE_OPTIONS = [
  ['none', 'None'],
  ['blue-metal', 'Blue metal'],
  ['brick', 'Brick'],
]

function getWarpPreviewPath(type) {
  const paths = {
    arc: 'M 12 24 Q 62 6 112 24',
    'arc-lower': 'M 12 14 Q 62 30 112 14',
    'arc-upper': 'M 12 24 Q 62 4 112 24',
    arch: 'M 12 28 Q 62 -2 112 28',
    bulge: 'M 12 18 C 36 5 88 5 112 18',
    'shell-lower': 'M 12 14 Q 62 34 112 14',
    'shell-upper': 'M 12 26 Q 62 0 112 26',
    flag: 'M 12 20 C 34 5 58 32 112 16',
    wave: 'M 12 20 C 32 6 42 34 62 20 S 92 6 112 20',
    fish: 'M 12 18 C 42 2 82 34 112 18',
    rise: 'M 12 28 L 112 8',
    fisheye: 'M 12 18 C 34 32 90 4 112 18',
    inflate: 'M 12 26 Q 62 -2 112 26',
    squeeze: 'M 12 12 Q 62 32 112 12',
    twist: 'M 12 20 C 28 0 46 36 62 18 S 94 0 112 20',
  }

  return paths[type] || 'M 12 20 L 112 20'
}

function WarpPreview({ label, type }) {
  const previewId = useId()
  const pathId = `warp-preview-${type}-${previewId}`

  if (type === 'none') {
    return <span className="warp-preview-plain">WARP</span>
  }

  return (
    <svg aria-hidden="true" className="warp-preview" viewBox="0 0 124 36">
      <path d={getWarpPreviewPath(type)} fill="none" id={pathId} />
      <text>
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          WARP
        </textPath>
      </text>
      <title>{label}</title>
    </svg>
  )
}

function PropertiesPanel({
  activeObject,
  onCommit,
  onDelete,
  onLayerChange,
  onUpdate,
}) {
  const [showCurveResetModal, setShowCurveResetModal] = useState(false)
  const [showWarpResetModal, setShowWarpResetModal] = useState(false)
  const [showWarpPicker, setShowWarpPicker] = useState(false)
  const isText = typeof activeObject?.text === 'string'
  const isImage = activeObject?.type === 'image'
  const isLine = activeObject?.type?.toLowerCase() === 'line'
  const isLineLike = isLine || activeObject?.arrowLine || activeObject?.curvedLine
  const supportsLinePointEditing = Boolean(
    activeObject?.arrowLine || activeObject?.curvedLine,
  )
  const isRectangle = activeObject?.type?.toLowerCase() === 'rect'

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
  const hasFillGradient = activeObject.fill?.type === 'linear'
  const maxCornerRoundness = Math.floor(
    Math.min(scaledWidth || 0, scaledHeight || 0) / 2,
  )
  const cornerRoundness = numberValue(
    Math.min(
      (activeObject.rx || 0) * (activeObject.scaleX || 1),
      (activeObject.ry || 0) * (activeObject.scaleY || 1),
    ),
  )
  const selectedWarp =
    WARP_OPTIONS.find(([value]) => value === (activeObject.warpType || 'none')) ||
    WARP_OPTIONS[0]

  const setScaledSize = (key, value) => {
    const next = Math.max(Number(value), 1)
    if (isRectangle) {
      const updates = { [key]: next }
      const radius = Math.min(
        cornerRoundness,
        (key === 'width' ? next : scaledWidth) / 2,
        (key === 'height' ? next : scaledHeight) / 2,
      )

      updates.rx = radius
      updates.ry = radius
      updates.scaleX = 1
      updates.scaleY = 1
      onUpdate(updates)
      return
    }

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
        {activeObject.isLocked && (
          <p className="locked-note">Locked. Right-click the object to unlock it.</p>
        )}
        <fieldset className="property-stack" disabled={activeObject.isLocked}>
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
                  step="5"
                  type="range"
                  value={numberValue(activeObject.charSpacing, 0)}
                  onBlur={onCommit}
                  onChange={(event) =>
                    onUpdate({ charSpacing: Number(event.target.value) })
                  }
                />
              </label>

              <label>
                Text box width
                <input
                  min="80"
                  type="number"
                  value={numberValue(activeObject.width, 160)}
                  onBlur={onCommit}
                  onChange={(event) =>
                    onUpdate({ wrapWidth: Number(event.target.value) })
                  }
                />
              </label>

              <label>
                Letter texture
                <select
                  value={activeObject.textureName || 'none'}
                  onBlur={onCommit}
                  onChange={(event) => {
                    onUpdate({ textureFill: event.target.value })
                    onCommit()
                  }}
                >
                  {TEXTURE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="property-group">
                <div className="warp-style-picker">
                  <span className="property-label">Warp style</span>
                  <button
                    aria-expanded={showWarpPicker}
                    className="warp-selected"
                    type="button"
                    onClick={() => setShowWarpPicker((isOpen) => !isOpen)}
                  >
                    <WarpPreview label={selectedWarp[1]} type={selectedWarp[0]} />
                    <span>{selectedWarp[1]}</span>
                  </button>

                  {showWarpPicker && (
                    <div className="warp-options">
                      {WARP_OPTIONS.map(([value, label]) => (
                        <button
                          className={
                            value === (activeObject.warpType || 'none')
                              ? 'is-active'
                              : ''
                          }
                          key={value}
                          type="button"
                          onClick={() => {
                            onUpdate({
                              warpAmount: activeObject.warpAmount || 80,
                              warpType: value,
                            })
                            onCommit()
                            setShowWarpPicker(false)
                          }}
                        >
                          <WarpPreview label={label} type={value} />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <label>
                  Warp strength
                  <input
                    max="160"
                    min="0"
                    step="5"
                    type="range"
                    value={numberValue(activeObject.warpAmount, 0)}
                    onBlur={onCommit}
                    onChange={(event) =>
                      onUpdate({ warpAmount: Number(event.target.value) })
                    }
                  />
                </label>

                <div className="inline-property">
                  <label>
                    Distort X
                    <input
                      max="45"
                      min="-45"
                      step="1"
                      type="range"
                      value={numberValue(activeObject.skewX, 0)}
                      onBlur={onCommit}
                      onChange={(event) =>
                        onUpdate({ skewX: Number(event.target.value) })
                      }
                    />
                  </label>
                  <button
                    aria-label="Reset warp"
                    className="icon-button"
                    title="Reset warp"
                    type="button"
                    onClick={() => setShowWarpResetModal(true)}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>

                <label>
                  Distort Y
                  <input
                    max="45"
                    min="-45"
                    step="1"
                    type="range"
                    value={numberValue(activeObject.skewY, 0)}
                    onBlur={onCommit}
                    onChange={(event) =>
                      onUpdate({ skewY: Number(event.target.value) })
                    }
                  />
                </label>
              </div>

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

          {isImage && (
            <div className="property-group">
              <span className="property-label">Background remover</span>
              <label>
                White tolerance
                <input
                  max="120"
                  min="0"
                  step="5"
                  type="range"
                  value={numberValue(activeObject.backgroundRemovalTolerance, 35)}
                  onChange={(event) =>
                    onUpdate({
                      backgroundRemovalTolerance: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Edge soften
                <input
                  max="80"
                  min="0"
                  step="5"
                  type="range"
                  value={numberValue(activeObject.backgroundRemovalSoftness, 30)}
                  onChange={(event) =>
                    onUpdate({
                      backgroundRemovalSoftness: Number(event.target.value),
                    })
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  onUpdate({
                    removeWhiteBackground: {
                      softness: activeObject.backgroundRemovalSoftness ?? 30,
                      tolerance: activeObject.backgroundRemovalTolerance ?? 35,
                    },
                  })
                  onCommit()
                }}
              >
                <Eraser size={18} />
                Erase white bg
              </button>
            </div>
          )}

          {!isImage && (
            <>
              <label>
                Text / fill color
                <input
                  type="color"
                  value={colorValue(activeObject.fill, '#ffffff')}
                  onBlur={onCommit}
                  onChange={(event) => onUpdate({ fill: event.target.value })}
                />
              </label>

              <label className="checkbox-row">
                <input
                  checked={hasFillGradient}
                  type="checkbox"
                  onChange={(event) => {
                    if (event.target.checked) {
                      onUpdate({
                        gradientFill: {
                          angle: gradientAngle(activeObject),
                          end: gradientColor(activeObject.fill, 1, '#facc15'),
                          start: colorValue(activeObject.fill, '#ffffff'),
                        },
                      })
                    } else {
                      onUpdate({
                        fill: gradientColor(activeObject.fill, 0, '#ffffff'),
                      })
                    }
                    onCommit()
                  }}
                />
                Gradient
              </label>

              {hasFillGradient && (
                <div className="property-group">
                  <span className="property-label">Fill gradient</span>
                  <div className="gradient-pickers">
                    <label>
                      From
                      <input
                        type="color"
                        value={gradientColor(activeObject.fill, 0, '#ffffff')}
                        onBlur={onCommit}
                        onChange={(event) =>
                          onUpdate({
                            gradientFill: {
                              angle: gradientAngle(activeObject),
                              end: gradientColor(
                                activeObject.fill,
                                1,
                                '#facc15',
                              ),
                              start: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      To
                      <input
                        type="color"
                        value={gradientColor(activeObject.fill, 1, '#facc15')}
                        onBlur={onCommit}
                        onChange={(event) =>
                          onUpdate({
                            gradientFill: {
                              angle: gradientAngle(activeObject),
                              end: event.target.value,
                              start: gradientColor(
                                activeObject.fill,
                                0,
                                '#ffffff',
                              ),
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Angle
                    <input
                      max="360"
                      min="0"
                      step="5"
                      type="range"
                      value={gradientAngle(activeObject)}
                      onBlur={onCommit}
                      onChange={(event) =>
                        onUpdate({
                          gradientFill: {
                            angle: Number(event.target.value),
                            end: gradientColor(
                              activeObject.fill,
                              1,
                              '#facc15',
                            ),
                            start: gradientColor(
                              activeObject.fill,
                              0,
                              '#ffffff',
                            ),
                          },
                        })
                      }
                    />
                  </label>
                </div>
              )}

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

              {isRectangle && (
                <label>
                  Corner roundness
                  <input
                    max={maxCornerRoundness}
                    min="0"
                    step="1"
                    type="range"
                    value={cornerRoundness}
                    onBlur={onCommit}
                    onChange={(event) => {
                      const radius = Number(event.target.value)
                      onUpdate({
                        rx: radius / (activeObject.scaleX || 1),
                        ry: radius / (activeObject.scaleY || 1),
                      })
                    }}
                  />
                </label>
              )}

              <div className="inline-property">
                <label>
                  Outline color
                  <input
                    type="color"
                    value={activeObject.stroke || '#111111'}
                    onBlur={onCommit}
                    onChange={(event) =>
                      onUpdate({ stroke: event.target.value })
                    }
                  />
                </label>
                <button
                  aria-label="Sync outline color with fill color"
                  className="icon-button"
                  title="Sync outline color with fill color"
                  type="button"
                  onClick={() => {
                    onUpdate({
                      stroke:
                        typeof activeObject.fill === 'string'
                          ? activeObject.fill
                          : '#ffffff',
                    })
                    onCommit()
                  }}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </>
          )}

          <div className="property-group">
            <h3>Layer</h3>
            <div className="layer-controls">
              <button
                aria-label="Send to back"
                title="Send to back"
                type="button"
                onClick={() => onLayerChange('back')}
              >
                <ArrowDownToLine size={16} />
              </button>
              <button
                aria-label="Send backward"
                title="Send backward"
                type="button"
                onClick={() => onLayerChange('backward')}
              >
                <ArrowDown size={16} />
              </button>
              <button
                aria-label="Bring forward"
                title="Bring forward"
                type="button"
                onClick={() => onLayerChange('forward')}
              >
                <ArrowUp size={16} />
              </button>
              <button
                aria-label="Bring to front"
                title="Bring to front"
                type="button"
                onClick={() => onLayerChange('front')}
              >
                <ArrowUpToLine size={16} />
              </button>
            </div>
          </div>

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

          {isLineLike ? (
            <div className="property-stack">
              <label>
                Length
                <input
                  min="1"
                  type="number"
                  value={scaledWidth}
                  onBlur={onCommit}
                  onChange={(event) => setScaledSize('width', event.target.value)}
                />
              </label>

              {supportsLinePointEditing && (
                <label className="switch-row">
                  <span>Point editing</span>
                  <input
                    checked={Boolean(activeObject.linePointEditing)}
                    type="checkbox"
                    onBlur={onCommit}
                    onChange={(event) =>
                      onUpdate({ linePointEditing: event.target.checked })
                    }
                  />
                  <span className="switch-control" />
                </label>
              )}
            </div>
          ) : (
            <div className="two-column">
              <label>
                Width
                <input
                  min="1"
                  type="number"
                  value={scaledWidth}
                  onBlur={onCommit}
                  onChange={(event) =>
                    setScaledSize('width', event.target.value)
                  }
                />
              </label>
              <label>
                Height
                <input
                  min="1"
                  type="number"
                  value={scaledHeight}
                  onBlur={onCommit}
                  onChange={(event) =>
                    setScaledSize('height', event.target.value)
                  }
                />
              </label>
            </div>
          )}

          <button className="danger-button" type="button" onClick={onDelete}>
            <Trash2 size={18} />
            Delete object
          </button>
        </fieldset>
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

      {showWarpResetModal && (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-labelledby="warp-reset-title"
            aria-modal="true"
            className="confirm-modal"
            role="dialog"
          >
            <h2 id="warp-reset-title">Reset warp?</h2>
            <p>This will remove the selected text distortion.</p>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setShowWarpResetModal(false)}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={() => {
                  onUpdate({
                    skewX: 0,
                    skewY: 0,
                    warpAmount: 0,
                    warpType: 'none',
                  })
                  onCommit()
                  setShowWarpResetModal(false)
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
