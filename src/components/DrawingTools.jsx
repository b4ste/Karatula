import { MousePointer2, Paintbrush, Eraser, Scan } from 'lucide-react'

export default function DrawingTools({ tool, onTool, color, onColor, size, onSize, opacity, onOpacity, brushStyle, onBrushStyle, canMask }) {
  return <div className="drawing-tools" role="toolbar" aria-label="Editing tools">
    <div className="tool-buttons">
      {[[ 'select', 'Move / select', MousePointer2 ], [ 'brush', 'Brush', Paintbrush ], [ 'erase', 'Stroke eraser', Eraser ], [ 'marquee', 'Rectangle mask', Scan ]].map(([id, label, Icon]) =>
        <button key={id} type="button" disabled={id === 'marquee' && !canMask && tool !== 'marquee'} aria-pressed={tool === id} title={label} onClick={() => onTool(id)}><Icon size={17} />{label}</button>)}
    </div>
    {tool === 'brush' && <div className="brush-options">
      <label>Brush <select aria-label="Brush style" value={brushStyle} onChange={(event) => onBrushStyle(event.target.value)}>
        <option value="pencil">Pencil</option>
        <option value="spray">Spray</option>
      </select></label>
      <label>Color <input aria-label="Brush color" type="color" value={color} onChange={(event) => onColor(event.target.value)} /></label>
      <label>Size <input aria-label="Brush size" type="range" min="1" max="100" value={size} onChange={(event) => onSize(Number(event.target.value))} /><output>{size}</output></label>
      <label>Opacity <input aria-label="Brush opacity" type="range" min="5" max="100" value={opacity} onChange={(event) => onOpacity(Number(event.target.value))} /><output>{opacity}%</output></label>
    </div>}
    <p>{tool === 'brush' ? 'Drag on the board to paint. Each stroke is an editable layer.' : tool === 'erase' ? 'Click a brush stroke to remove it. Locked strokes are protected.' : tool === 'marquee' ? 'Drag a rectangle over the selected image to keep that area visible.' : 'Select and transform objects. Select an image for crop and adjustments.'}</p>
  </div>
}
