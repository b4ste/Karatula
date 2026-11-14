import { useState } from 'react'

const COLORS = [
  '#000000', '#ffffff', '#808080', '#d9d9d9', '#7f1d1d', '#ef4444',
  '#f97316', '#facc15', '#84cc16', '#16a34a', '#14b8a6', '#06b6d4',
  '#2563eb', '#1d4ed8', '#7c3aed', '#ec4899', '#cf1424', '#ffdf00',
]

function normalizeHex(value) {
  const hex = value.trim().replace(/^#/, '')
  if (/^[\da-f]{3}$/i.test(hex)) return `#${[...hex].map((digit) => digit + digit).join('').toLowerCase()}`
  if (/^[\da-f]{6}$/i.test(hex)) return `#${hex.toLowerCase()}`
  return null
}

export default function ColorPicker({ label, value, onChange }) {
  const [edit, setEdit] = useState({ value, draft: value })
  const [expanded, setExpanded] = useState(false)
  const current = normalizeHex(value) || '#000000'
  const draft = edit.value === value ? edit.draft : value

  const selectColor = (color) => {
    setEdit({ value, draft: color })
    onChange(color)
  }

  return <div className="property-color-picker">
    <span className="property-label">{label}</span>
    <div className="color-picker-row">
      <button aria-label={`Choose ${label.toLowerCase()}`} aria-expanded={expanded}
        className="color-picker-preview" onClick={() => setExpanded((open) => !open)}
        style={{ backgroundColor: current }} type="button" />
      <input aria-label={`${label} hex code`} className="color-picker-hex" maxLength="7"
        onBlur={() => {
          const valid = normalizeHex(draft)
          if (valid) selectColor(valid)
          else setEdit({ value, draft: current })
        }}
        onChange={(event) => {
          const next = event.target.value
          setEdit({ value, draft: next })
          if (/^#[\da-f]{6}$/i.test(next)) onChange(next.toLowerCase())
        }}
        spellCheck="false" type="text" value={draft} />
      <button aria-expanded={expanded} className="color-picker-toggle"
        onClick={() => setExpanded((open) => !open)} type="button">
        {expanded ? 'Done' : 'Colors'}
      </button>
    </div>
    {expanded && <div className="color-picker-options">
      <div aria-label={`${label} quick colors`} className="color-picker-swatches">
        {COLORS.map((color) => <button aria-label={color} aria-pressed={current === color}
          className="color-picker-swatch" key={color} onClick={() => selectColor(color)}
          style={{ backgroundColor: color }} title={color} type="button" />)}
      </div>
      <label className="color-picker-custom">
        Custom color
        <input aria-label={`${label} custom color`} onChange={(event) => selectColor(event.target.value)}
          type="color" value={current} />
      </label>
    </div>}
  </div>
}
