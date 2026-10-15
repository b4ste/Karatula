import { useState } from 'react'
import {
  ArrowLeft,
  Image,
  MoveRight,
  Palette,
  Search,
  Square,
  Type,
} from 'lucide-react'

const backgrounds = ['#111111', '#ffffff', '#dc2626', '#facc15', '#2563eb']
const defaultRouteText = 'Text'

const shapeSections = [
  {
    title: 'Recently used',
    shapes: ['square', 'rectangle', 'heart', 'line'],
  },
  {
    title: 'Lines',
    shapes: ['line', 'dashed-line', 'dotted-line', 'arrow', 'thin-arrow'],
  },
  {
    title: 'Basic shapes',
    shapes: [
      'square',
      'half-rectangle',
      'circle',
      'half-circle',
      'triangle',
      'diamond',
    ],
  },
  {
    title: 'Polygons',
    shapes: ['pentagon', 'hexagon', 'octagon', 'trapezoid'],
  },
  {
    title: 'Stars',
    shapes: ['sparkle', 'star', 'badge', 'burst'],
  },
  {
    title: 'Arrows',
    shapes: ['block-arrow-right', 'block-arrow-left', 'block-arrow-up', 'block-arrow-down'],
  },
  {
    title: 'Flowchart shapes',
    shapes: ['decision', 'document'],
  },
]

const shapeLabels = {
  arrow: 'Arrow',
  badge: 'Badge',
  'block-arrow-down': 'Down arrow',
  'block-arrow-left': 'Left arrow',
  'block-arrow-right': 'Right arrow',
  'block-arrow-up': 'Up arrow',
  burst: 'Burst',
  circle: 'Circle',
  'dashed-line': 'Dashed line',
  decision: 'Decision',
  diamond: 'Diamond',
  document: 'Document',
  'dotted-line': 'Dotted line',
  heart: 'Heart',
  'half-circle': 'Half circle',
  'half-rectangle': 'Half rectangle',
  hexagon: 'Hexagon',
  line: 'Line',
  octagon: 'Octagon',
  pentagon: 'Pentagon',
  rectangle: 'Rectangle',
  sparkle: 'Sparkle',
  square: 'Square',
  star: 'Star',
  'thin-arrow': 'Thin arrow',
  trapezoid: 'Trapezoid',
  triangle: 'Triangle',
}

const allShapes = [...new Set(shapeSections.flatMap((section) => section.shapes))]

function LeftSidebar({
  customSize,
  onAddShape,
  onAddText,
  onBackgroundChange,
  onBackgroundGradientChange,
  onPickUpload,
  onSizeChange,
}) {
  const [routeText, setRouteText] = useState(defaultRouteText)
  const [activePanel, setActivePanel] = useState('main')
  const [shapeSearch, setShapeSearch] = useState('')
  const [useBackgroundGradient, setUseBackgroundGradient] = useState(false)
  const [backgroundGradient, setBackgroundGradient] = useState({
    angle: 0,
    end: '#4b5563',
    start: '#111111',
  })

  const updateCustomSize = (key, value) => {
    onSizeChange({
      type: 'custom',
      widthPx: key === 'widthPx' ? Math.min(16000, Math.max(20, Math.round(Number(value) || 20))) : customSize.widthPx,
      heightPx: key === 'heightPx' ? Math.min(16000, Math.max(10, Math.round(Number(value) || 10))) : customSize.heightPx,
    })
  }

  const filteredShapes = allShapes.filter((shape) =>
    (shapeLabels[shape] || shape)
      .toLowerCase()
      .includes(shapeSearch.toLowerCase()),
  )

  const updateBackgroundGradient = (key, value) => {
    const nextGradient = { ...backgroundGradient, [key]: value }
    setBackgroundGradient(nextGradient)
    onBackgroundGradientChange(nextGradient)
  }

  const toggleBackgroundGradient = (checked) => {
    setUseBackgroundGradient(checked)
    if (checked) {
      onBackgroundGradientChange(backgroundGradient)
    } else {
      onBackgroundChange(backgroundGradient.start)
    }
  }

  return (
    <aside className="sidebar left-sidebar sidebar-slider">
      <div className={`sidebar-track is-${activePanel}`}>
        <div className="sidebar-panel">
          <section>
            <h2>Size</h2>
            <div className="custom-size">
              <label>
                W px
                <input
                  min="20"
                  type="number"
                  value={customSize.widthPx}
                  onChange={(event) =>
                    updateCustomSize('widthPx', event.target.value)
                  }
                />
              </label>
              <label>
                H px
                <input
                  min="10"
                  type="number"
                  value={customSize.heightPx}
                  onChange={(event) =>
                    updateCustomSize('heightPx', event.target.value)
                  }
                />
              </label>
            </div>
          </section>

          <section>
            <h2>Text</h2>
            <label>
              Route text
              <textarea
                rows="3"
                value={routeText}
                onChange={(event) => setRouteText(event.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => onAddText(routeText.trim() || defaultRouteText)}
            >
              <Type size={18} />
              <span className="add-text-button-text">Add text</span>
            </button>
          </section>

          <section>
            <button
              className="section-toggle"
              type="button"
              onClick={() => setActivePanel('shapes')}
            >
              <span>
                <Square size={18} />
                <span className="shapes-button-text">Shapes</span>
              </span>
              <MoveRight size={18} />
            </button>
          </section>

          <section>
            <h2>Upload</h2>
            <button type="button" onClick={onPickUpload}>
              <Image size={18} />
              <span className="upload-button-text">Upload image</span>
            </button>
          </section>

          <section>
            <h2>Background</h2>
            <div className="swatches">
              {backgrounds.map((color) => (
                <button
                  aria-label={`Set background ${color}`}
                  key={color}
                  style={{ background: color }}
                  type="button"
                  onClick={() => {
                    setUseBackgroundGradient(false)
                    onBackgroundChange(color)
                  }}
                />
              ))}
              <label className="color-picker">
                <Palette size={18} />
                <input
                  type="color"
                  defaultValue="#111111"
                  onChange={(event) => {
                    setUseBackgroundGradient(false)
                    onBackgroundChange(event.target.value)
                  }}
                />
              </label>
            </div>
            <label className="checkbox-row">
              <input
                checked={useBackgroundGradient}
                type="checkbox"
                onChange={(event) =>
                  toggleBackgroundGradient(event.target.checked)
                }
              />
              Gradient
            </label>
            {useBackgroundGradient && (
              <div className="property-group">
                <div className="gradient-pickers">
                  <label>
                    From
                    <input
                      type="color"
                      value={backgroundGradient.start}
                      onChange={(event) =>
                        updateBackgroundGradient('start', event.target.value)
                      }
                    />
                  </label>
                  <label>
                    To
                    <input
                      type="color"
                      value={backgroundGradient.end}
                      onChange={(event) =>
                        updateBackgroundGradient('end', event.target.value)
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
                    value={backgroundGradient.angle}
                    onChange={(event) =>
                      updateBackgroundGradient(
                        'angle',
                        Number(event.target.value),
                      )
                    }
                  />
                </label>
              </div>
            )}
          </section>
        </div>

        <div className="sidebar-panel shape-browser">
          <div className="panel-header">
            <button
              aria-label="Back"
              className="ghost-icon-button"
              type="button"
              onClick={() => setActivePanel('main')}
            >
              <ArrowLeft size={18} />
            </button>
            <h2>Shapes</h2>
          </div>

          <label className="shape-search">
            <Search size={16} />
            <input
              placeholder="Search shapes"
              type="search"
              value={shapeSearch}
              onChange={(event) => setShapeSearch(event.target.value)}
            />
          </label>

          <div className="shape-grid">
            {filteredShapes.map((shape) => (
              <button
                aria-label={shapeLabels[shape] || shape}
                className="shape-choice"
                key={shape}
                title={shapeLabels[shape] || shape}
                type="button"
                onClick={() => onAddShape(shape)}
              >
                <span className={`shape-preview shape-${shape}`} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}

export default LeftSidebar
