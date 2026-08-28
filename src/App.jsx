import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActiveSelection,
  Circle,
  FabricImage,
  Gradient,
  IText,
  Line,
  Path,
  Pattern,
  Polygon,
  Rect,
  Textbox,
  Triangle,
  cache,
} from 'fabric'
import { Image, Lock, Square, Type, Unlock } from 'lucide-react'
import EditorCanvas from './components/EditorCanvas'
import ExportPanel from './components/ExportPanel'
import LeftSidebar from './components/LeftSidebar'
import PropertiesPanel from './components/PropertiesPanel'
import Toolbar from './components/Toolbar'
import blueMetalTexture from './assets/textures/blue-metal.jpg'
import brickTexture from './assets/textures/brick1.jpg'
import { getCanvasPixels, getSignLabel } from './utils/dimensions'
import { downloadPng, exportPdf, printCanvas } from './utils/exportUtils'
import { CUSTOM_FONTS, DEFAULT_FONT } from './utils/fonts'
import './index.css'

const FABRIC_CUSTOM_PROPS = [
  'autoFitText',
  'backgroundRemovalSoftness',
  'backgroundRemovalTolerance',
  'curveAmount',
  'editable',
  'gradientAngle',
  'hasControls',
  'isLocked',
  'lockMovementX',
  'lockMovementY',
  'lockRotation',
  'lockScalingFlip',
  'lockScalingX',
  'lockScalingY',
  'textureName',
  'warpType',
  'warpAmount',
]
const PROJECT_STORAGE_KEY = 'karatula-project-v1'
const TEXTURE_SOURCES = {
  'blue-metal': blueMetalTexture,
  brick: brickTexture,
}

function gradientCoords(width, height, angle = 0) {
  const radians = ((Number(angle) || 0) * Math.PI) / 180
  const half = Math.sqrt(width ** 2 + height ** 2) / 2
  const centerX = width / 2
  const centerY = height / 2
  const x = Math.cos(radians) * half
  const y = Math.sin(radians) * half

  return {
    x1: centerX - x,
    x2: centerX + x,
    y1: centerY - y,
    y2: centerY + y,
  }
}
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
  widthPx: 100,
  heightPx: 30,
}

function readSavedProject() {
  try {
    const savedProject = window.localStorage.getItem(PROJECT_STORAGE_KEY)
    return savedProject ? JSON.parse(savedProject) : null
  } catch {
    return null
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function readClipboardText(item) {
  return new Promise((resolve) => {
    item.getAsString((value) => resolve(value))
  })
}

function getImageSourceFromHtml(html) {
  const documentFromHtml = new DOMParser().parseFromString(html, 'text/html')
  return documentFromHtml.querySelector('img')?.src || null
}

async function getClipboardImageSource(clipboardData) {
  const files = Array.from(clipboardData.files || [])
  const imageFile = files.find((file) => file.type.startsWith('image/'))

  if (imageFile) return blobToDataUrl(imageFile)

  const items = Array.from(clipboardData.items || [])
  const imageItem = items.find((item) => item.type.startsWith('image/'))

  if (imageItem) {
    const imageBlob = imageItem.getAsFile()
    if (imageBlob) return blobToDataUrl(imageBlob)
  }

  const htmlItem = items.find((item) => item.type === 'text/html')
  if (htmlItem) {
    const imageSource = getImageSourceFromHtml(await readClipboardText(htmlItem))
    if (imageSource) return imageSource
  }

  const textItem = items.find((item) => item.type === 'text/plain')
  if (textItem) {
    const text = String(await readClipboardText(textItem)).trim()
    if (/^(https?:\/\/|data:image\/)/i.test(text)) return text
  }

  return null
}

function imageFromDataUrl(source) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = source
  })
}

function fitTextObjectToContent(object) {
  if (object.autoFitText === false) return

  if (object.fontFamily) {
    cache.clearFontCache(object.fontFamily)
  } else {
    cache.clearFontCache()
  }

  object.dirty = true
  object.initDimensions?.()

  const measureCanvas = document.createElement('canvas')
  const context = measureCanvas.getContext('2d')
  const fontSize = object.fontSize || 54
  const fontWeight = object.fontWeight || '400'
  const fontStyle = object.fontStyle || 'normal'
  const fontFamily = object.fontFamily || DEFAULT_FONT
  const lines = String(object.text || '').split('\n')

  context.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`

  const measuredWidth = Math.max(
    ...lines.map((line) => {
      const letterSpacing =
        Math.max(line.length - 1, 0) *
        fontSize *
        ((Number(object.charSpacing) || 0) / 1000)

      return context.measureText(line).width + letterSpacing
    }),
    0,
  )
  const neededWidth = Math.ceil(measuredWidth + (object.strokeWidth || 0) * 4)

  if (
    object.text &&
    !object.text.includes('\n') &&
    measuredWidth > 0 &&
    neededWidth > object.width
  ) {
    object.set({
      autoFitText: true,
      width: neededWidth,
    })
    object.initDimensions?.()
  }

  object.setCoords()
}

async function refreshCanvasTextFonts(canvas) {
  const textObjects = canvas
    .getObjects()
    .filter((object) => typeof object.text === 'string')

  if ('fonts' in document) {
    await Promise.all(
      textObjects.map((object) => {
        if (!CUSTOM_FONTS.includes(object.fontFamily)) {
          object.set({ fontFamily: DEFAULT_FONT })
        }

        const fontSize = object.fontSize || 54
        return document.fonts.load(`${fontSize}px "${object.fontFamily}"`)
      }),
    )
    await document.fonts.ready
  }

  textObjects.forEach(fitTextObjectToContent)
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

function getRulerMarks(size, preferredStep) {
  const end = Math.max(Number(size) || 0, 0)
  const step = Math.max(preferredStep, 1)
  const marks = []

  for (let value = 0; value < end; value += step) {
    marks.push(value)
  }

  if (!marks.includes(end)) marks.push(end)
  return marks
}

function App() {
  const [savedProject] = useState(readSavedProject)
  const savedProjectRef = useRef(savedProject)
  const [canvas, setCanvas] = useState(null)
  const [signSize, setSignSize] = useState(savedProject?.signSize || initialSize)
  const [activeObject, setActiveObject] = useState(null)
  const [, setActiveObjectVersion] = useState(0)
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isRestoring, setIsRestoring] = useState(false)
  const [message] = useState('By Baste')
  const [showSettings, setShowSettings] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [showRulers, setShowRulers] = useState(savedProject?.showRulers || false)
  const [siteBackground, setSiteBackground] = useState(
    savedProject?.siteBackground || DEFAULT_SITE_BACKGROUND,
  )
  const fileInputRef = useRef(null)
  const clipboardRef = useRef([])
  const hasLoadedProjectRef = useRef(false)
  const historyRef = useRef({ history: [], index: -1, isRestoring: false })

  useEffect(() => {
    historyRef.current = { history, index: historyIndex, isRestoring }
  }, [history, historyIndex, isRestoring])

  const saveProject = useCallback(
    (nextCanvas = canvas) => {
      if (!nextCanvas || !hasLoadedProjectRef.current) return

      try {
        window.localStorage.setItem(
          PROJECT_STORAGE_KEY,
          JSON.stringify({
            canvas: nextCanvas.toJSON(FABRIC_CUSTOM_PROPS),
            showRulers,
            signSize,
            siteBackground,
          }),
        )
      } catch {
        // localStorage can fill up if a design has huge uploaded images.
      }
    },
    [canvas, showRulers, signSize, siteBackground],
  )

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
      saveProject(nextCanvas)
    },
    [canvas, saveProject],
  )

  const restoreSnapshot = useCallback(
    async (index) => {
      if (!canvas || !history[index]) return

      historyRef.current.isRestoring = true
      setIsRestoring(true)
      canvas.discardActiveObject()
      await canvas.loadFromJSON(history[index])
      await refreshCanvasTextFonts(canvas)
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
    if (!canvas || hasLoadedProjectRef.current) return

    const loadProject = async () => {
      const savedCanvas = savedProjectRef.current?.canvas

      if (!savedCanvas) {
        hasLoadedProjectRef.current = true
        pushHistory(canvas)
        return
      }

      historyRef.current.isRestoring = true
      setIsRestoring(true)
      canvas.discardActiveObject()

      try {
        await canvas.loadFromJSON(savedCanvas)
        await refreshCanvasTextFonts(canvas)
        canvas.renderAll()

        const snapshot = JSON.stringify(canvas.toJSON(FABRIC_CUSTOM_PROPS))
        const nextHistory = [snapshot]
        setHistory(nextHistory)
        setHistoryIndex(0)
        historyRef.current = {
          history: nextHistory,
          index: 0,
          isRestoring: false,
        }
      } catch {
        const snapshot = JSON.stringify(canvas.toJSON(FABRIC_CUSTOM_PROPS))
        const nextHistory = [snapshot]
        setHistory(nextHistory)
        setHistoryIndex(0)
        historyRef.current = {
          history: nextHistory,
          index: 0,
          isRestoring: false,
        }
      } finally {
        setActiveObject(null)
        hasLoadedProjectRef.current = true
        saveProject(canvas)
        historyRef.current.isRestoring = false
        setIsRestoring(false)
      }
    }

    loadProject()
  }, [canvas, pushHistory, saveProject])

  useEffect(() => {
    saveProject(canvas)
  }, [canvas, saveProject, showRulers, signSize, siteBackground])

  const applyLockState = useCallback((object, isLocked) => {
    object.set({
      editable: typeof object.text === 'string' ? !isLocked : object.editable,
      hasControls: !isLocked,
      isLocked,
      lockMovementX: isLocked,
      lockMovementY: isLocked,
      lockRotation: isLocked,
      lockScalingFlip: isLocked,
      lockScalingX: isLocked,
      lockScalingY: isLocked,
    })
    object.setCoords()
  }, [])

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

  const toggleLockSelection = useCallback(() => {
    if (!canvas) return

    const selected = canvas.getActiveObjects()
    const targets = selected.length ? selected : contextMenu?.object ? [contextMenu.object] : []
    if (!targets.length) return

    const shouldLock = targets.some((object) => !object.isLocked)
    targets.forEach((object) => applyLockState(object, shouldLock))
    canvas.requestRenderAll()
    setActiveObjectVersion((version) => version + 1)
    setContextMenu(null)
    pushHistory(canvas)
  }, [applyLockState, canvas, contextMenu, pushHistory])

  useEffect(() => {
    if (!canvas) return

    const syncSelection = () => setActiveObject(canvas.getActiveObject() || null)
    const removeEmptyText = (object) => {
      if (typeof object?.text !== 'string') return false
      if (object.text.trim().length > 0) return false

      canvas.remove(object)
      canvas.discardActiveObject()
      setActiveObject(null)
      canvas.requestRenderAll()
      return true
    }
    const afterChange = () => {
      syncSelection()
      pushHistory(canvas)
    }
    const preventContextMenu = (event) => event.preventDefault()
    const handleMouseDown = (options) => {
      const event = options.e

      if (event.button === 2) {
        event.preventDefault()

        if (options.target) {
          canvas.setActiveObject(options.target)
          setActiveObject(options.target)
          setContextMenu({
            object: options.target,
            x: event.clientX,
            y: event.clientY,
          })
        } else {
          setContextMenu(null)
        }
        return
      }

      setContextMenu(null)
    }
    const handleTextChanged = (options) => {
      if (removeEmptyText(options.target)) {
        pushHistory(canvas)
      } else {
        syncSelection()
        saveProject(canvas)
      }
    }

    canvas.on('selection:created', syncSelection)
    canvas.on('selection:updated', syncSelection)
    canvas.on('selection:cleared', syncSelection)
    canvas.on('object:added', afterChange)
    canvas.on('object:modified', afterChange)
    canvas.on('object:removed', afterChange)
    canvas.on('text:changed', handleTextChanged)
    canvas.on('mouse:down', handleMouseDown)
    canvas.upperCanvasEl.addEventListener('contextmenu', preventContextMenu)

    if (historyRef.current.history.length === 0) pushHistory(canvas)

    return () => {
      canvas.off('selection:created', syncSelection)
      canvas.off('selection:updated', syncSelection)
      canvas.off('selection:cleared', syncSelection)
      canvas.off('object:added', afterChange)
      canvas.off('object:modified', afterChange)
      canvas.off('object:removed', afterChange)
      canvas.off('text:changed', handleTextChanged)
      canvas.off('mouse:down', handleMouseDown)
      canvas.upperCanvasEl.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [canvas, pushHistory, saveProject])

  useEffect(() => {
    const handleKeys = (event) => {
      const target = event.target
      const editingField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      if (editingField) return

      if (event.key === 'Escape') {
        setContextMenu(null)
      }

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

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        duplicateSelection()
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && canvas) {
        if (canvas.getActiveObject()?.isEditing) return

        const selected = canvas.getActiveObjects()
        const removable = selected.filter((object) => !object.isLocked)
        if (removable.length) {
          event.preventDefault()
          removable.forEach((object) => canvas.remove(object))
          canvas.discardActiveObject()
          canvas.requestRenderAll()
        }
      }
    }

    window.addEventListener('keydown', handleKeys)
    return () => window.removeEventListener('keydown', handleKeys)
  }, [canvas, copySelection, duplicateSelection, redo, undo])

  const centerObject = useCallback((object) => {
    if (!canvas) return object
    canvas.add(object)
    canvas.centerObject(object)
    canvas.setActiveObject(object)
    canvas.requestRenderAll()
    return object
  }, [canvas])

  const addText = async (text = 'Text') => {
    if ('fonts' in document) {
      await document.fonts.load(`54px "${DEFAULT_FONT}"`)
    }

    const textObject = new IText(text, {
      autoFitText: true,
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
    })
    textObject.initDimensions?.()
    centerObject(textObject)
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

    fitTextObjectToContent(object)
  }

  const createObjectGradient = (
    width,
    height,
    startColor,
    endColor,
    angle = 45,
  ) =>
    new Gradient({
      type: 'linear',
      gradientUnits: 'pixels',
      coords: gradientCoords(width, height, angle),
      colorStops: [
        { offset: 0, color: startColor },
        { offset: 1, color: endColor },
      ],
    })

  const getGradientStops = (fill, fallbackAngle = 45) => {
    if (fill?.type !== 'linear') return null
    return {
      angle: fill.gradientAngle ?? fallbackAngle,
      end: fill.colorStops?.[1]?.color || '#facc15',
      start: fill.colorStops?.[0]?.color || '#ffffff',
    }
  }

  const convertToTextbox = (object, width) => {
    const wrapWidth = Math.max(Number(width) || 560, 80)
    const gradientStops = getGradientStops(object.fill, object.gradientAngle)

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
      autoFitText: false,
      gradientAngle: gradientStops?.angle ?? object.gradientAngle,
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

  const setBackgroundGradient = ({ angle = 0, start, end }) => {
    if (!canvas) return

    canvas.set({
      backgroundColor: new Gradient({
        type: 'linear',
        gradientUnits: 'pixels',
        coords: gradientCoords(canvas.width, canvas.height, angle),
        colorStops: [
          { offset: 0, color: start },
          { offset: 1, color: end },
        ],
      }),
    })
    canvas.requestRenderAll()
    pushHistory(canvas)
  }

  const applyObjectGradient = (object, startColor, endColor, angle = 45) => {
    const width = Math.max(object.width || object.getScaledWidth(), 1)
    const height = Math.max(object.height || object.getScaledHeight(), 1)
    const gradient = createObjectGradient(width, height, startColor, endColor, angle)
    gradient.gradientAngle = angle

    object.set({
      fill: gradient,
      gradientAngle: angle,
    })
  }

  const loadTextureImage = (textureName) =>
    new Promise((resolve, reject) => {
      const image = new window.Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = TEXTURE_SOURCES[textureName]
    })

  const createTextureTile = (image, tileSize = 96) => {
    const tile = document.createElement('canvas')
    const context = tile.getContext('2d')
    const cropSize = Math.min(image.naturalWidth, image.naturalHeight)
    const cropX = (image.naturalWidth - cropSize) / 2
    const cropY = (image.naturalHeight - cropSize) / 2

    tile.width = tileSize
    tile.height = tileSize
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      image,
      cropX,
      cropY,
      cropSize,
      cropSize,
      0,
      0,
      tileSize,
      tileSize,
    )

    return tile
  }

  const applyObjectTexture = async (object, textureName) => {
    if (!textureName || textureName === 'none') {
      object.set({
        fill: '#ffffff',
        textureName: 'none',
      })
      return
    }

    const image = await loadTextureImage(textureName)
    object.set({
      dirty: true,
      fill: new Pattern({
        repeat: 'repeat',
        source: createTextureTile(image),
      }),
      objectCaching: false,
      textureName,
    })
  }

  const placeImageFromSource = useCallback(
    async (source) => {
      if (!canvas || !source) return false

      let image
      try {
        image = await FabricImage.fromURL(source, { crossOrigin: 'anonymous' })
      } catch {
        image = await FabricImage.fromURL(source)
      }

      image.set({ left: 80, opacity: 1, top: 50 })
      image.scaleToWidth(Math.min(canvas.width * 0.35, 280))
      centerObject(image)
      pushHistory(canvas)
      return true
    },
    [canvas, centerObject, pushHistory],
  )

  const removeWhiteBackground = async (
    object,
    { softness = 30, tolerance = 35 } = {},
  ) => {
    if (object?.type !== 'image') return

    const source = object.getElement()
    const sourceWidth = source?.naturalWidth || source?.width
    const sourceHeight = source?.naturalHeight || source?.height

    if (!sourceWidth || !sourceHeight) return

    const cleanupCanvas = document.createElement('canvas')
    const context = cleanupCanvas.getContext('2d', { willReadFrequently: true })
    const hardCutoff = 255 - Math.max(Number(tolerance) || 0, 0)
    const softCutoff = Math.max(
      hardCutoff - Math.max(Number(softness) || 0, 0),
      0,
    )

    if (!context) return

    cleanupCanvas.width = sourceWidth
    cleanupCanvas.height = sourceHeight

    try {
      context.drawImage(source, 0, 0, sourceWidth, sourceHeight)
      const imageData = context.getImageData(0, 0, sourceWidth, sourceHeight)
      const pixels = imageData.data

      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index]
        const green = pixels[index + 1]
        const blue = pixels[index + 2]
        const originalAlpha = pixels[index + 3]
        const brightness = Math.max(red, green, blue)
        const colorSpread = Math.max(red, green, blue) - Math.min(red, green, blue)
        const isMostlyWhite = colorSpread < 38

        if (red >= hardCutoff && green >= hardCutoff && blue >= hardCutoff) {
          pixels[index + 3] = 0
        } else if (isMostlyWhite && brightness > softCutoff) {
          const fade = (hardCutoff - brightness) / (hardCutoff - softCutoff || 1)
          const nextAlpha = Math.max(0, Math.min(originalAlpha, originalAlpha * fade))

          pixels[index] = Math.min(red, 245)
          pixels[index + 1] = Math.min(green, 245)
          pixels[index + 2] = Math.min(blue, 245)
          pixels[index + 3] = nextAlpha
        }
      }

      context.putImageData(imageData, 0, 0)
      const cleanedImage = await imageFromDataUrl(
        cleanupCanvas.toDataURL('image/png'),
      )
      object.setElement(cleanedImage)
      object.set({
        backgroundRemovalSoftness: softness,
        backgroundRemovalTolerance: tolerance,
        dirty: true,
      })
      object.setCoords()
      canvas.requestRenderAll()
      setActiveObjectVersion((version) => version + 1)
      pushHistory(canvas)
    } catch {
      object.set({
        backgroundRemovalSoftness: softness,
        backgroundRemovalTolerance: tolerance,
      })
      setActiveObjectVersion((version) => version + 1)
    }
  }

  const uploadImage = (event) => {
    const file = event.target.files?.[0]
    if (!file || !canvas) return

    const reader = new FileReader()
    reader.onload = async () => {
      await placeImageFromSource(reader.result)
      event.target.value = ''
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    const handlePaste = async (event) => {
      if (!canvas) return

      const target = event.target
      const editingField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      if (editingField) return

      const imageSource = await getClipboardImageSource(event.clipboardData)
      if (imageSource) {
        event.preventDefault()
        await placeImageFromSource(imageSource)
        return
      }

      if (clipboardRef.current.length) {
        event.preventDefault()
        pasteSelection()
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [canvas, pasteSelection, placeImageFromSource])

  const updateActiveObject = async (updates) => {
    if (!canvas || !activeObject) return
    if (activeObject.isLocked) return

    if ('text' in updates && updates.text.trim().length === 0) {
      canvas.remove(activeObject)
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      setActiveObject(null)
      pushHistory(canvas)
      return
    }

    let targetObject = activeObject

    if (
      'gradientFill' in updates &&
      typeof updates.gradientFill === 'object'
    ) {
      applyObjectGradient(
        activeObject,
        updates.gradientFill.start,
        updates.gradientFill.end,
        updates.gradientFill.angle ?? activeObject.gradientAngle ?? 45,
      )
      activeObject.set({ textureName: 'none' })
    } else if (
      'removeWhiteBackground' in updates &&
      activeObject.type === 'image'
    ) {
      await removeWhiteBackground(
        activeObject,
        typeof updates.removeWhiteBackground === 'object'
          ? updates.removeWhiteBackground
          : { tolerance: updates.removeWhiteBackground },
      )
      return
    } else if ('textureFill' in updates && typeof activeObject.text === 'string') {
      await applyObjectTexture(activeObject, updates.textureFill)
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
      const gradientStops = getGradientStops(activeObject.fill)
      activeObject.set({ autoFitText: false })
      targetObject = convertToTextbox(activeObject, Number(updates.wrapWidth))
      await refreshTextObject(targetObject)

      if (gradientStops) {
        applyObjectGradient(
          targetObject,
          gradientStops.start,
          gradientStops.end,
          gradientStops.angle,
        )
        await refreshTextObject(targetObject)
      }

      if (targetObject.warpType && targetObject.warpType !== 'none') {
        applyTextWarp(targetObject, targetObject.warpType, targetObject.warpAmount)
        await refreshTextObject(targetObject)
      } else if (targetObject.curveAmount && typeof targetObject.text === 'string') {
        applyTextCurve(targetObject, targetObject.curveAmount)
        await refreshTextObject(targetObject)
      }
    } else {
      activeObject.set(
        'fill' in updates
          ? { ...updates, textureName: 'none' }
          : updates,
      )
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
    saveProject(canvas)
  }

  const commitActiveObject = () => {
    if (!canvas) return
    if (canvas.getActiveObject()?.isLocked) return
    canvas.getActiveObject()?.setCoords()
    pushHistory(canvas)
  }

  const changeLayer = (action) => {
    if (!canvas || !activeObject) return
    if (activeObject.isLocked) return

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
    canvas
      .getActiveObjects()
      .filter((object) => !object.isLocked)
      .forEach((object) => canvas.remove(object))
    canvas.discardActiveObject()
    canvas.requestRenderAll()
  }

  const resetBoard = () => {
    if (!canvas) return

    canvas.discardActiveObject()
    canvas.getObjects().forEach((object) => canvas.remove(object))
    canvas.set({ backgroundColor: '#111111' })
    canvas.requestRenderAll()
    setActiveObject(null)
    setActiveObjectVersion((version) => version + 1)
    setShowResetModal(false)
    pushHistory(canvas)
  }

  const selectedPixels = getCanvasPixels(signSize)
  const rulerWidth = Math.max(Number(signSize.widthPx) || 0, 1)
  const rulerHeight = Math.max(Number(signSize.heightPx) || 0, 1)
  const horizontalRulerMarks = getRulerMarks(signSize.widthPx, 20)
  const verticalRulerMarks = getRulerMarks(signSize.heightPx, 10)

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
        onReset={() => setShowResetModal(true)}
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
              {signSize.widthPx}px x {signSize.heightPx}px
            </span>
          </div>

          <div className={`canvas-stage ${showRulers ? 'has-rulers' : ''}`}>
            <div
              className="ruler-wrap"
              style={{
                '--ruler-height': `${selectedPixels.height}px`,
                '--ruler-width': `${selectedPixels.width}px`,
              }}
            >
              {showRulers && (
                <>
                  <div className="ruler ruler-horizontal" aria-hidden="true">
                    {horizontalRulerMarks.map((mark) => (
                      <span
                        key={mark}
                        style={{
                          left: `${(mark / rulerWidth) * 100}%`,
                        }}
                      >
                        {mark}
                      </span>
                    ))}
                  </div>
                  <div className="ruler ruler-vertical" aria-hidden="true">
                    {verticalRulerMarks.map((mark) => (
                      <span
                        key={mark}
                        style={{
                          top: `${(mark / rulerHeight) * 100}%`,
                        }}
                      >
                        {mark}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <EditorCanvas
                height={selectedPixels.height}
                onCanvasReady={setCanvas}
                width={selectedPixels.width}
              />
            </div>
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

      {contextMenu && (
        <div
          className="canvas-context-menu"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button type="button" onClick={toggleLockSelection}>
            {contextMenu.object.isLocked ? (
              <Unlock size={16} />
            ) : (
              <Lock size={16} />
            )}
            {contextMenu.object.isLocked ? 'Unlock object' : 'Lock object'}
          </button>
        </div>
      )}

      {showResetModal && (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-labelledby="reset-board-title"
            aria-modal="true"
            className="confirm-modal"
            role="dialog"
          >
            <h2 id="reset-board-title">Reset board?</h2>
            <p>This will remove everything from the sign. Download your work before resetting.</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowResetModal(false)}>
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={resetBoard}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-backdrop" role="presentation">
          <div
            aria-labelledby="settings-title"
            aria-modal="true"
            className="confirm-modal settings-modal"
            role="dialog"
          >
            <h2 id="settings-title">Settings</h2>
            <label className="checkbox-row">
              <input
                checked={showRulers}
                type="checkbox"
                onChange={(event) => setShowRulers(event.target.checked)}
              />
              Show ruler
            </label>

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
