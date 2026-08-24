import { useCallback, useEffect, useRef, useState } from 'react'
import { Circle, FabricImage, IText, Line, Path, Polygon, Rect, Triangle } from 'fabric'
import { Image, Square, Type } from 'lucide-react'
import EditorCanvas from './components/EditorCanvas'
import ExportPanel from './components/ExportPanel'
import LeftSidebar from './components/LeftSidebar'
import PropertiesPanel from './components/PropertiesPanel'
import Toolbar from './components/Toolbar'
import { getCanvasPixels, getSignLabel } from './utils/dimensions'
import { downloadPng, exportPdf, printCanvas } from './utils/exportUtils'
import { DEFAULT_FONT } from './utils/fonts'
import './index.css'

const STORAGE_KEY = 'jeepney-sign-maker-design'

const initialSize = {
  type: 'fixed',
  widthCm: 100,
  heightCm: 30,
}

function polygonPoints(sides, radius) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = (Math.PI * 2 * index) / sides - Math.PI / 2
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    }
  })
}

function starPoints(points, outerRadius, innerRadius) {
  return Array.from({ length: points * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    const angle = (Math.PI * index) / points - Math.PI / 2
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    }
  })
}

function App() {
  const [canvas, setCanvas] = useState(null)
  const [signSize, setSignSize] = useState(initialSize)
  const [activeObject, setActiveObject] = useState(null)
  const [, setActiveObjectVersion] = useState(0)
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isRestoring, setIsRestoring] = useState(false)
  const [message, setMessage] = useState('By Baste')
  const fileInputRef = useRef(null)
  const historyRef = useRef({ history: [], index: -1, isRestoring: false })

  useEffect(() => {
    historyRef.current = { history, index: historyIndex, isRestoring }
  }, [history, historyIndex, isRestoring])

  const pushHistory = useCallback(
    (nextCanvas = canvas) => {
      if (!nextCanvas || historyRef.current.isRestoring) return

      const snapshot = JSON.stringify(nextCanvas.toJSON(['curveAmount']))
      const current = historyRef.current.history[historyRef.current.index]

      if (snapshot === current) return

      const nextHistory = historyRef.current.history.slice(
        0,
        historyRef.current.index + 1,
      )
      nextHistory.push(snapshot)

      const limitedHistory = nextHistory.slice(-40)
      setHistory(limitedHistory)
      setHistoryIndex(limitedHistory.length - 1)
    },
    [canvas],
  )

  const restoreSnapshot = useCallback(
    async (index) => {
      if (!canvas || !history[index]) return

      historyRef.current.isRestoring = true
      setIsRestoring(true)
      canvas.discardActiveObject()
      await canvas.loadFromJSON(history[index])
      canvas.renderAll()
      setActiveObject(null)
      setHistoryIndex(index)
      historyRef.current.isRestoring = false
      setIsRestoring(false)
    },
    [canvas, history],
  )

  const undo = useCallback(() => {
    if (historyIndex > 0) restoreSnapshot(historyIndex - 1)
  }, [historyIndex, restoreSnapshot])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) restoreSnapshot(historyIndex + 1)
  }, [historyIndex, history.length, restoreSnapshot])

  useEffect(() => {
    if (!canvas) return

    const syncSelection = () => setActiveObject(canvas.getActiveObject() || null)
    const afterChange = () => {
      syncSelection()
      pushHistory(canvas)
    }

    canvas.on('selection:created', syncSelection)
    canvas.on('selection:updated', syncSelection)
    canvas.on('selection:cleared', syncSelection)
    canvas.on('object:added', afterChange)
    canvas.on('object:modified', afterChange)
    canvas.on('object:removed', afterChange)

    if (historyRef.current.history.length === 0) pushHistory(canvas)

    return () => {
      canvas.off('selection:created', syncSelection)
      canvas.off('selection:updated', syncSelection)
      canvas.off('selection:cleared', syncSelection)
      canvas.off('object:added', afterChange)
      canvas.off('object:modified', afterChange)
      canvas.off('object:removed', afterChange)
    }
  }, [canvas, pushHistory])

  useEffect(() => {
    const handleKeys = (event) => {
      const target = event.target
      const editingField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      if (editingField) return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && canvas) {
        if (canvas.getActiveObject()?.isEditing) return

        const selected = canvas.getActiveObjects()
        if (selected.length) {
          event.preventDefault()
          selected.forEach((object) => canvas.remove(object))
          canvas.discardActiveObject()
          canvas.requestRenderAll()
        }
      }
    }

    window.addEventListener('keydown', handleKeys)
    return () => window.removeEventListener('keydown', handleKeys)
  }, [canvas, redo, undo])

  const centerObject = (object) => {
    if (!canvas) return object
    canvas.add(object)
    canvas.centerObject(object)
    canvas.setActiveObject(object)
    canvas.requestRenderAll()
    return object
  }

  const addText = (text = 'NAIC -> PITX') => {
    centerObject(
      new IText(text, {
        left: 120,
        top: 90,
        fontFamily: DEFAULT_FONT,
        fontSize: 54,
        fontWeight: '700',
        fill: '#ffffff',
        stroke: '#111111',
        strokeWidth: 0,
        paintFirst: 'stroke',
        textAlign: 'center',
        opacity: 1,
      }),
    )
  }

  const addShape = (shape) => {
    if (!canvas) return

    const common = {
      fill: '#facc15',
      stroke: '#ffffff',
      strokeWidth: 3,
      opacity: 1,
    }

    if (shape === 'rectangle' || shape === 'square' || shape === 'process') {
      centerObject(new Rect({ width: 120, height: 120, ...common }))
    }

    if (shape === 'rounded-rectangle' || shape === 'terminator') {
      centerObject(new Rect({ width: 190, height: 90, rx: 16, ry: 16, ...common }))
    }

    if (shape === 'circle') {
      centerObject(new Circle({ radius: 56, ...common }))
    }

    if (shape === 'triangle') {
      centerObject(new Triangle({ width: 130, height: 120, ...common }))
    }

    if (shape === 'diamond' || shape === 'decision') {
      centerObject(
        new Polygon(
          [
            { x: 0, y: -70 },
            { x: 80, y: 0 },
            { x: 0, y: 70 },
            { x: -80, y: 0 },
          ],
          common,
        ),
      )
    }

    if (shape === 'trapezoid') {
      centerObject(
        new Polygon(
          [
            { x: -80, y: 60 },
            { x: 80, y: 60 },
            { x: 48, y: -60 },
            { x: -48, y: -60 },
          ],
          common,
        ),
      )
    }

    if (shape === 'pentagon') {
      centerObject(new Polygon(polygonPoints(5, 72), common))
    }

    if (shape === 'hexagon') {
      centerObject(new Polygon(polygonPoints(6, 72), common))
    }

    if (shape === 'octagon') {
      centerObject(new Polygon(polygonPoints(8, 72), common))
    }

    if (shape === 'star') {
      centerObject(new Polygon(starPoints(5, 78, 34), common))
    }

    if (shape === 'sparkle') {
      centerObject(new Polygon(starPoints(4, 78, 22), common))
    }

    if (shape === 'badge') {
      centerObject(new Polygon(starPoints(8, 78, 58), common))
    }

    if (shape === 'burst') {
      centerObject(new Polygon(starPoints(12, 80, 56), common))
    }

    if (shape === 'heart') {
      centerObject(
        new Path(
          'M 75 28 C 75 8 48 0 36 18 C 24 0 -3 8 -3 28 C -3 58 36 78 36 78 C 36 78 75 58 75 28 Z',
          common,
        ),
      )
    }

    if (shape === 'gradient-block') {
      centerObject(new Rect({ width: 120, height: 120, fill: '#facc15', opacity: 0.7 }))
    }

    if (shape === 'line') {
      centerObject(
        new Line([0, 0, 260, 0], {
          stroke: '#facc15',
          strokeWidth: 8,
          strokeLineCap: 'round',
        }),
      )
    }

    if (shape === 'dashed-line' || shape === 'dotted-line') {
      centerObject(
        new Line([0, 0, 260, 0], {
          stroke: '#facc15',
          strokeDashArray: shape === 'dashed-line' ? [18, 12] : [3, 12],
          strokeWidth: 8,
          strokeLineCap: 'round',
        }),
      )
    }

    if (shape === 'arrow' || shape === 'thin-arrow') {
      centerObject(
        new Path('M 0 20 L 210 20 M 170 0 L 210 20 L 170 40', {
          fill: '',
          stroke: '#facc15',
          strokeWidth: shape === 'thin-arrow' ? 4 : 8,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
        }),
      )
    }

    if (shape.startsWith('block-arrow')) {
      const paths = {
        'block-arrow-right':
          'M 0 30 L 120 30 L 120 0 L 190 65 L 120 130 L 120 100 L 0 100 Z',
        'block-arrow-left':
          'M 190 30 L 70 30 L 70 0 L 0 65 L 70 130 L 70 100 L 190 100 Z',
        'block-arrow-up':
          'M 30 190 L 30 70 L 0 70 L 65 0 L 130 70 L 100 70 L 100 190 Z',
        'block-arrow-down':
          'M 30 0 L 30 120 L 0 120 L 65 190 L 130 120 L 100 120 L 100 0 Z',
      }
      centerObject(new Path(paths[shape], common))
    }

    if (shape === 'document') {
      centerObject(
        new Path(
          'M 0 0 L 160 0 L 160 105 Q 120 85 80 105 Q 40 125 0 105 Z',
          common,
        ),
      )
    }
  }

  const applyTextCurve = (object, curveAmount) => {
    const curve = Number(curveAmount) || 0
    const center = object.getCenterPoint()

    if (curve === 0) {
      object.set({
        path: undefined,
        curveAmount: 0,
      })
    } else {
      const pathWidth = Math.max(object.width || object.getScaledWidth(), 140)
      const path = new Path(
        `M 0 0 Q ${pathWidth / 2} ${curve * -1} ${pathWidth} 0`,
        {
          visible: false,
          selectable: false,
          evented: false,
        },
      )

      object.set({
        path,
        pathAlign: 'center',
        pathSide: 'left',
        pathStartOffset: 0,
        curveAmount: curve,
      })
    }

    object.setPositionByOrigin(center, 'center', 'center')
  }

  const refreshTextObject = async (object) => {
    if (typeof object.text !== 'string') return

    if ('fonts' in document && object.fontFamily) {
      const fontSize = object.fontSize || 54
      await document.fonts.load(`${fontSize}px "${object.fontFamily}"`)
    }

    object.dirty = true
    object.initDimensions?.()
    object.setCoords()
  }

  const setBackground = (color) => {
    if (!canvas) return
    canvas.set({ backgroundColor: color })
    canvas.requestRenderAll()
    pushHistory(canvas)
  }

  const uploadImage = (event) => {
    const file = event.target.files?.[0]
    if (!file || !canvas) return

    const reader = new FileReader()
    reader.onload = async () => {
      const image = await FabricImage.fromURL(reader.result)
      image.set({ left: 80, top: 50, opacity: 1 })
      image.scaleToWidth(Math.min(canvas.width * 0.35, 280))
      centerObject(image)
      event.target.value = ''
    }
    reader.readAsDataURL(file)
  }

  const updateActiveObject = async (updates) => {
    if (!canvas || !activeObject) return

    if ('curveAmount' in updates && typeof activeObject.text === 'string') {
      applyTextCurve(activeObject, updates.curveAmount)
    } else {
      activeObject.set(updates)
      await refreshTextObject(activeObject)

      if (activeObject.curveAmount && typeof activeObject.text === 'string') {
        applyTextCurve(activeObject, activeObject.curveAmount)
        await refreshTextObject(activeObject)
      }
    }

    await refreshTextObject(activeObject)
    activeObject.setCoords()
    canvas.requestRenderAll()
    setActiveObject(activeObject)
    setActiveObjectVersion((version) => version + 1)
  }

  const commitActiveObject = () => {
    if (!canvas) return
    canvas.getActiveObject()?.setCoords()
    pushHistory(canvas)
  }

  const deleteActiveObject = () => {
    if (!canvas) return
    canvas.getActiveObjects().forEach((object) => canvas.remove(object))
    canvas.discardActiveObject()
    canvas.requestRenderAll()
  }

  const saveDesign = () => {
    if (!canvas) return
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        signSize,
        canvas: canvas.toJSON(['curveAmount']),
      }),
    )
    setMessage('Saved locally')
  }

  const restoreSavedDesign = async () => {
    if (!canvas) return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      setMessage('No saved design yet')
      return
    }

    const parsed = JSON.parse(saved)
    if (parsed.signSize) setSignSize(parsed.signSize)
    historyRef.current.isRestoring = true
    setIsRestoring(true)
    await canvas.loadFromJSON(parsed.canvas)
    canvas.requestRenderAll()
    historyRef.current.isRestoring = false
    setIsRestoring(false)
    pushHistory(canvas)
    setMessage('Restored saved design')
  }

  const selectedPixels = getCanvasPixels(signSize)

  return (
    <main className="app-shell">
      <Toolbar
        canRedo={historyIndex < history.length - 1}
        canUndo={historyIndex > 0}
        message={message}
        onExportPdf={() => canvas && exportPdf(canvas, signSize)}
        onExportPng={() => canvas && downloadPng(canvas, signSize)}
        onPrint={() => canvas && printCanvas(canvas, signSize)}
        onRedo={redo}
        onRestore={restoreSavedDesign}
        onSave={saveDesign}
        onUndo={undo}
      />

      <section className="editor-shell">
        <LeftSidebar
          customSize={signSize}
          onAddShape={addShape}
          onAddText={addText}
          onBackgroundChange={setBackground}
          onPickUpload={() => fileInputRef.current?.click()}
          onSizeChange={setSignSize}
        />

        <section className="workspace-panel">
          <div className="workspace-header">
            <div>
              <p className="eyebrow">Editing board</p>
              <h1>{getSignLabel(signSize)}</h1>
            </div>
            <span>
              {signSize.widthCm}cm x {signSize.heightCm}cm
            </span>
          </div>

          <div className="canvas-stage">
            <EditorCanvas
              height={selectedPixels.height}
              onCanvasReady={setCanvas}
              width={selectedPixels.width}
            />
          </div>
        </section>

        <PropertiesPanel
          activeObject={activeObject}
          onCommit={commitActiveObject}
          onDelete={deleteActiveObject}
          onUpdate={updateActiveObject}
        />
      </section>

      <ExportPanel
        onExportPdf={() => canvas && exportPdf(canvas, signSize)}
        onExportPng={() => canvas && downloadPng(canvas, signSize)}
        onPrint={() => canvas && printCanvas(canvas, signSize)}
      />

      <input
        ref={fileInputRef}
        accept="image/*"
        className="hidden-input"
        type="file"
        onChange={uploadImage}
      />

      <div className="mobile-actions">
        <button type="button" onClick={() => addText()}>
          <Type size={18} />
          Text
        </button>
        <button type="button" onClick={() => addShape('rectangle')}>
          <Square size={18} />
          Shape
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          <Image size={18} />
          Image
        </button>
      </div>
    </main>
  )
}

export default App
