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
const defaultRouteText = 'NAIC -> PITX'

const shapeSections = [
  {
    title: 'Recently used',
    shapes: ['square', 'rounded-rectangle', 'heart', 'line', 'gradient-block'],
  },
  {
    title: 'Lines',
    shapes: ['line', 'dashed-line', 'dotted-line', 'arrow', 'thin-arrow'],
  },
  {
    title: 'Basic shapes',
    shapes: ['square', 'rounded-rectangle', 'circle', 'triangle', 'diamond'],
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
    shapes: ['process', 'terminator', 'decision', 'document'],
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
  'gradient-block': 'Gradient block',
  heart: 'Heart',
  hexagon: 'Hexagon',
  line: 'Line',
  octagon: 'Octagon',
  pentagon: 'Pentagon',
  process: 'Process',
  'rounded-rectangle': 'Rounded rectangle',
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
  onPickUpload,
  onSizeChange,
}) {
  const [routeText, setRouteText] = useState(defaultRouteText)
  const [activePanel, setActivePanel] = useState('main')
  const [shapeSearch, setShapeSearch] = useState('')

  const updateCustomSize = (key, value) => {
    onSizeChange({
      type: 'custom',
      widthCm: key === 'widthCm' ? Number(value) : customSize.widthCm,
      heightCm: key === 'heightCm' ? Number(value) : customSize.heightCm,
    })
  }

  const filteredShapes = allShapes.filter((shape) =>
    (shapeLabels[shape] || shape)
      .toLowerCase()
      .includes(shapeSearch.toLowerCase()),
  )

  if (activePanel === 'shapes') {
    return (
      <aside className="sidebar left-sidebar shape-browser">
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
      </aside>
    )
  }

  return (
    <aside className="sidebar left-sidebar">
      <section>
        <h2>Size</h2>
        <div className="custom-size">
          <label>
            W cm
            <input
              min="20"
              type="number"
              value={customSize.widthCm}
              onChange={(event) =>
                updateCustomSize('widthCm', event.target.value)
              }
            />
          </label>
          <label>
            H cm
            <input
              min="10"
              type="number"
              value={customSize.heightCm}
              onChange={(event) =>
                updateCustomSize('heightCm', event.target.value)
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
          Add text
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
            Shapes
          </span>
          <MoveRight size={18} />
        </button>
      </section>

      <section>
        <h2>Upload</h2>
        <button type="button" onClick={onPickUpload}>
          <Image size={18} />
          Upload image
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
              onClick={() => onBackgroundChange(color)}
            />
          ))}
          <label className="color-picker">
            <Palette size={18} />
            <input
              type="color"
              defaultValue="#111111"
              onChange={(event) => onBackgroundChange(event.target.value)}
            />
          </label>
        </div>
      </section>
    </aside>
  )
}

export default LeftSidebar
