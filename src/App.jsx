import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActiveSelection,
  Circle,
  FabricImage,
  Gradient,
  Line,
  Path,
  Polygon,
  Rect,
  Textbox,
  Triangle,
} from 'fabric'
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

const FABRIC_CUSTOM_PROPS = ['curveAmount', 'warpType', 'warpAmount']
const DEFAULT_SITE_BACKGROUND = '#071426'
const siteBackgrounds = [
  '#071426',
  '#0b1b30',
  '#111111',
  '#ffffff',
  '#dc2626',
  '#facc15',
  '#2563eb',
]

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
  const [message] = useState('By Baste')
  const [showSettings, setShowSettings] = useState(false)
  const [siteBackground, setSiteBackground] = useState(DEFAULT_SITE_BACKGROUND)
  const fileInputRef = useRef(null)
  const clipboardRef = useRef([])
  const historyRef = useRef({ history: [], index: -1, isRestoring: false })

  useEffect(() => {
    historyRef.current = { history, index: historyIndex, isRestoring }
  }, [history, historyIndex, isRestoring])

  const pushHistory = useCallback(
    (nextCanvas = canvas) => {
      if (!nextCanvas || historyRef.current.isRestoring) return

      const snapshot = JSON.stringify(nextCanvas.toJSON(FABRIC_CUSTOM_PROPS))
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

  const copySelection = useCallback(async () => {
    if (!canvas) return

    const selected = canvas.getActiveObjects()
    if (!selected.length) return

    clipboardRef.current = await Promise.all(
      selected.map((object) => object.clone(FABRIC_CUSTOM_PROPS)),
    )
  }, [canvas])

  const pasteSelection = useCallback(async () => {
    if (!canvas || !clipboardRef.current.length) return

    canvas.discardActiveObject()

    const pastedObjects = await Promise.all(
      clipboardRef.current.map(async (object) => {
        const clone = await object.clone(FABRIC_CUSTOM_PROPS)
        clone.set({
          left: (clone.left || 0) + 24,
          top: (clone.top || 0) + 24,
        })
        clone.setCoords()
        canvas.add(clone)
        return clone
      }),
    )

    if (pastedObjects.length === 1) {
      canvas.setActiveObject(pastedObjects[0])
    } else {
      canvas.setActiveObject(new ActiveSelection(pastedObjects, { canvas }))
    }

    clipboardRef.current = await Promise.all(
      pastedObjects.map((object) => object.clone(FABRIC_CUSTOM_PROPS)),
    )
    canvas.requestRenderAll()
    pushHistory(canvas)
  }, [canvas, pushHistory])

  const duplicateSelection = useCallback(async () => {
    await copySelection()
    await pasteSelection()
  }, [copySelection, pasteSelection])

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

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        copySelection()
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        pasteSelection()
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        duplicateSelection()
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
  }, [canvas, copySelection, duplicateSelection, pasteSelection, redo, undo])

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
      new Textbox(text, {
        left: 120,
        top: 90,
        width: 560,
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
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeWidth: 3,
      opacity: 1,
    }

    if (shape === 'square' || shape === 'process') {
      centerObject(new Rect({ width: 120, height: 120, ...common }))
    }

    if (shape === 'rectangle') {
      centerObject(new Rect({ width: 190, height: 90, ...common }))
    }

    if (shape === 'half-rectangle') {
      centerObject(
        new Polygon(
          [
            { x: -95, y: -45 },
            { x: 95, y: -45 },
            { x: 0, y: 45 },
            { x: -95, y: 45 },
          ],
          common,
        ),
      )
    }

    if (shape === 'rounded-rectangle' || shape === 'terminator') {
      centerObject(new Rect({ width: 190, height: 90, rx: 16, ry: 16, ...common }))
    }

    if (shape === 'circle') {
      centerObject(new Circle({ radius: 56, ...common }))
    }

    if (shape === 'half-circle') {
      centerObject(
        new Path('M 0 70 A 70 70 0 0 1 140 70 L 0 70 Z', common),
      )
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
      centerObject(new Rect({ width: 120, height: 120, fill: '#ffffff', opacity: 0.7 }))
    }

    if (shape === 'line') {
      centerObject(
        new Line([0, 0, 260, 0], {
          stroke: '#ffffff',
          strokeWidth: 8,
          strokeLineCap: 'round',
        }),
      )
    }

    if (shape === 'dashed-line' || shape === 'dotted-line') {
      centerObject(
        new Line([0, 0, 260, 0], {
          stroke: '#ffffff',
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
          stroke: '#ffffff',
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
        warpAmount: 0,
        warpType: 'none',
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
        warpAmount: 0,
        warpType: 'none',
      })
    }

    object.setPositionByOrigin(center, 'center', 'center')
  }

  const getWarpPath = (warpType, pathWidth, warpAmount) => {
    const bend = Math.max(Number(warpAmount) || 0, 0)
    const high = bend * -1
    const low = bend

    const paths = {
      arc: `M 0 0 Q ${pathWidth / 2} ${high} ${pathWidth} 0`,
      'arc-lower': `M 0 0 Q ${pathWidth / 2} ${low} ${pathWidth} 0`,
      'arc-upper': `M 0 ${bend / 2} Q ${pathWidth / 2} ${high} ${pathWidth} ${bend / 2}`,
      arch: `M 0 ${bend / 2} Q ${pathWidth / 2} ${high * 1.25} ${pathWidth} ${bend / 2}`,
      bulge: `M 0 0 C ${pathWidth * 0.25} ${high} ${pathWidth * 0.75} ${high} ${pathWidth} 0`,
      'shell-lower': `M 0 ${low / 2} Q ${pathWidth / 2} ${low * 1.45} ${pathWidth} ${low / 2}`,
      'shell-upper': `M 0 ${high / 2} Q ${pathWidth / 2} ${high * 1.45} ${pathWidth} ${high / 2}`,
      flag: `M 0 0 C ${pathWidth * 0.25} ${high} ${pathWidth * 0.5} ${low} ${pathWidth} 0`,
      wave: `M 0 0 C ${pathWidth * 0.25} ${high} ${pathWidth * 0.35} ${low} ${pathWidth * 0.5} 0 S ${pathWidth * 0.75} ${high} ${pathWidth} 0`,
      fish: `M 0 0 C ${pathWidth * 0.3} ${high * 1.2} ${pathWidth * 0.7} ${low * 1.2} ${pathWidth} 0`,
      rise: `M 0 ${bend} L ${pathWidth} ${high}`,
      fisheye: `M 0 0 C ${pathWidth * 0.2} ${low} ${pathWidth * 0.8} ${high} ${pathWidth} 0`,
      inflate: `M 0 0 Q ${pathWidth / 2} ${high * 1.6} ${pathWidth} 0`,
      squeeze: `M 0 0 Q ${pathWidth / 2} ${low * 1.1} ${pathWidth} 0`,
      twist: `M 0 0 C ${pathWidth * 0.2} ${high * 1.4} ${pathWidth * 0.35} ${low * 1.4} ${pathWidth * 0.5} 0 S ${pathWidth * 0.8} ${high * 1.4} ${pathWidth} 0`,
    }

    return paths[warpType]
  }

  const applyTextWarp = (object, warpType, warpAmount) => {
    const type = warpType || 'none'
    const amount = Math.max(Number(warpAmount) || 0, 0)
    const center = object.getCenterPoint()

    if (type === 'none' || amount === 0) {
      object.set({
        path: undefined,
        curveAmount: 0,
        warpAmount: 0,
        warpType: type,
      })
      object.setPositionByOrigin(center, 'center', 'center')
      return
    }

    const pathWidth = Math.max(object.width || object.getScaledWidth(), 140)
    const pathData = getWarpPath(type, pathWidth, amount)

    if (!pathData) return

    object.set({
      path: new Path(pathData, {
        visible: false,
        selectable: false,
        evented: false,
      }),
      pathAlign: 'center',
      pathSide: 'left',
      pathStartOffset: 0,
      curveAmount: 0,
      warpAmount: amount,
      warpType: type,
    })
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

  const convertToTextbox = (object, width) => {
    const wrapWidth = Math.max(Number(width) || 560, 80)

    if (object.type === 'Textbox' || object.type === 'textbox') {
      object.set({ width: wrapWidth, scaleX: 1 })
      return object
    }

    const index = canvas.getObjects().indexOf(object)
    const textbox = new Textbox(object.text, {
      angle: object.angle,
      charSpacing: object.charSpacing,
      fill: object.fill,
      fontFamily: object.fontFamily,
      fontSize: object.fontSize,
      fontStyle: object.fontStyle,
      fontWeight: object.fontWeight,
      left: object.left,
      lineHeight: object.lineHeight,
      opacity: object.opacity,
      originX: object.originX,
      originY: object.originY,
      paintFirst: object.paintFirst,
      scaleX: 1,
      scaleY: object.scaleY,
      skewX: object.skewX,
      skewY: object.skewY,
      stroke: object.stroke,
      strokeWidth: object.strokeWidth,
      textAlign: object.textAlign,
      top: object.top,
      warpAmount: object.warpAmount,
      warpType: object.warpType,
      width: wrapWidth,
    })

    canvas.remove(object)
    canvas.insertAt(Math.max(index, 0), textbox)
    canvas.setActiveObject(textbox)
    setActiveObject(textbox)
    return textbox
  }

  const setBackground = (color) => {
    if (!canvas) return
    canvas.set({ backgroundColor: color })
    canvas.requestRenderAll()
    pushHistory(canvas)
  }

  const setBackgroundGradient = (startColor, endColor) => {
    if (!canvas) return

    canvas.set({
      backgroundColor: new Gradient({
        type: 'linear',
        gradientUnits: 'pixels',
        coords: {
          x1: 0,
          y1: 0,
          x2: canvas.width,
          y2: 0,
        },
        colorStops: [
          { offset: 0, color: startColor },
          { offset: 1, color: endColor },
        ],
      }),
    })
    canvas.requestRenderAll()
    pushHistory(canvas)
  }

  const applyObjectGradient = (object, startColor, endColor) => {
    const width = Math.max(object.width || object.getScaledWidth(), 1)

    object.set({
      fill: new Gradient({
        type: 'linear',
        gradientUnits: 'pixels',
        coords: {
          x1: -width / 2,
          y1: 0,
          x2: width / 2,
          y2: 0,
        },
        colorStops: [
          { offset: 0, color: startColor },
          { offset: 1, color: endColor },
        ],
      }),
    })
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
    let targetObject = activeObject

    if (
      'gradientFill' in updates &&
      typeof updates.gradientFill === 'object'
    ) {
      applyObjectGradient(
        activeObject,
        updates.gradientFill.start,
        updates.gradientFill.end,
      )
    } else if (
      ('warpType' in updates || 'warpAmount' in updates) &&
      typeof activeObject.text === 'string'
    ) {
      activeObject.set({
        skewX: updates.skewX ?? activeObject.skewX,
        skewY: updates.skewY ?? activeObject.skewY,
      })
      applyTextWarp(
        activeObject,
        updates.warpType ?? activeObject.warpType ?? 'arc',
        updates.warpAmount ?? activeObject.warpAmount ?? 80,
      )
    } else if ('curveAmount' in updates && typeof activeObject.text === 'string') {
      applyTextCurve(activeObject, updates.curveAmount)
    } else if ('wrapWidth' in updates && typeof activeObject.text === 'string') {
      targetObject = convertToTextbox(activeObject, Number(updates.wrapWidth))
      await refreshTextObject(targetObject)

      if (targetObject.warpType && targetObject.warpType !== 'none') {
        applyTextWarp(targetObject, targetObject.warpType, targetObject.warpAmount)
        await refreshTextObject(targetObject)
      } else if (targetObject.curveAmount && typeof targetObject.text === 'string') {
        applyTextCurve(targetObject, targetObject.curveAmount)
        await refreshTextObject(targetObject)
      }
    } else {
      activeObject.set(updates)
      await refreshTextObject(activeObject)

      if (activeObject.warpType && activeObject.warpType !== 'none') {
        applyTextWarp(activeObject, activeObject.warpType, activeObject.warpAmount)
        await refreshTextObject(activeObject)
      } else if (activeObject.curveAmount && typeof activeObject.text === 'string') {
        applyTextCurve(activeObject, activeObject.curveAmount)
        await refreshTextObject(activeObject)
      }
    }

    await refreshTextObject(targetObject)
    targetObject.setCoords()
    canvas.requestRenderAll()
    setActiveObject(targetObject)
    setActiveObjectVersion((version) => version + 1)
  }

  const commitActiveObject = () => {
    if (!canvas) return
    canvas.getActiveObject()?.setCoords()
    pushHistory(canvas)
  }

  const changeLayer = (action) => {
    if (!canvas || !activeObject) return

    const layerActions = {
      backward: () => canvas.sendObjectBackwards(activeObject),
      back: () => canvas.sendObjectToBack(activeObject),
      forward: () => canvas.bringObjectForward(activeObject),
      front: () => canvas.bringObjectToFront(activeObject),
    }

    layerActions[action]?.()
    canvas.setActiveObject(activeObject)
    canvas.requestRenderAll()
    setActiveObjectVersion((version) => version + 1)
    pushHistory(canvas)
  }

  const deleteActiveObject = () => {
    if (!canvas) return
    canvas.getActiveObjects().forEach((object) => canvas.remove(object))
    canvas.discardActiveObject()
    canvas.requestRenderAll()
  }

  const selectedPixels = getCanvasPixels(signSize)

  return (
    <main
      className="app-shell"
      style={{ '--site-background': siteBackground }}
    >
      <Toolbar
        canRedo={historyIndex < history.length - 1}
        canUndo={historyIndex > 0}
        message={message}
        onExportPdf={() => canvas && exportPdf(canvas, signSize)}
        onExportPng={() => canvas && downloadPng(canvas, signSize)}
        onPrint={() => canvas && printCanvas(canvas, signSize)}
        onRedo={redo}
        onSettings={() => setShowSettings(true)}
        onUndo={undo}
      />

      <section className="editor-shell">
        <LeftSidebar
          customSize={signSize}
          onAddShape={addShape}
          onAddText={addText}
          onBackgroundChange={setBackground}
          onBackgroundGradientChange={setBackgroundGradient}
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
          onLayerChange={changeLayer}
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

      {showSettings && (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-labelledby="settings-title"
            aria-modal="true"
            className="confirm-modal settings-modal"
            role="dialog"
          >
            <h2 id="settings-title">Settings</h2>
            <div className="settings-field">
              <span className="property-label">Site background</span>
              <div className="swatches">
                {siteBackgrounds.map((color) => (
                  <button
                    aria-label={`Set site background ${color}`}
                    className={siteBackground === color ? 'is-selected' : ''}
                    key={color}
                    style={{ background: color }}
                    type="button"
                    onClick={() => setSiteBackground(color)}
                  />
                ))}
                <label className="color-picker">
                  <Image size={18} />
                  <input
                    type="color"
                    value={siteBackground}
                    onChange={(event) => setSiteBackground(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setSiteBackground(DEFAULT_SITE_BACKGROUND)
                }}
              >
                Reset
              </button>
              <button type="button" onClick={() => setShowSettings(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
