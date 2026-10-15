import { useEffect, useRef } from 'react'
import { Canvas } from 'fabric'
import { applyRotateCursor } from '../utils/rotateCursor'

function EditorCanvas({ width, height, onCanvasReady }) {
  const canvasElementRef = useRef(null)
  const fabricCanvasRef = useRef(null)

  useEffect(() => {
    const canvas = new Canvas(canvasElementRef.current, {
      backgroundColor: '#111111',
      preserveObjectStacking: true,
      selection: true,
    })

    canvas.on('object:added', ({ target }) => applyRotateCursor(target))
    canvas.on('selection:created', ({ selected }) => {
      selected?.forEach(applyRotateCursor)
      applyRotateCursor(canvas.getActiveObject())
    })
    canvas.on('selection:updated', ({ selected }) => {
      selected?.forEach(applyRotateCursor)
      applyRotateCursor(canvas.getActiveObject())
    })

    fabricCanvasRef.current = canvas
    onCanvasReady(canvas)

    return () => {
      onCanvasReady(null)
      canvas.dispose()
      fabricCanvasRef.current = null
    }
  }, [onCanvasReady])

  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    canvas.setDimensions({ width, height })
    canvas.calcOffset()
    canvas.requestRenderAll()
  }, [height, width])

  return (
    <div
      className="canvas-frame"
      style={{
        '--canvas-width': `${width}px`,
        '--canvas-height': `${height}px`,
      }}
    >
      <canvas ref={canvasElementRef} />
    </div>
  )
}

export default EditorCanvas
