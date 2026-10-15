import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ActiveSelection,
  Circle,
  PencilBrush,
  SprayBrush,
  Color,
  Group,
  Control,
  FabricImage,
  Gradient,
  IText,
  Path,
  Pattern,
  Point,
  Polygon,
  Rect,
  Textbox,
  Triangle,
  cache,
  controlsUtils,
  util,
} from 'fabric'
import { Image, Lock, Square, Type, Unlock, ZoomIn, ZoomOut } from 'lucide-react'
import DrawingTools from './components/DrawingTools'
import ImageTools from './components/ImageTools'
import LayersPanel from './components/LayersPanel'
import { downloadProject, validateProject } from './utils/project'
import EditorCanvas from './components/EditorCanvas'
import ExportPanel from './components/ExportPanel'
import LeftSidebar from './components/LeftSidebar'
import PropertiesPanel from './components/PropertiesPanel'
import Toolbar from './components/Toolbar'
import blueMetalTexture from './assets/textures/blue-metal.jpg'
import brickTexture from './assets/textures/brick1.jpg'
import { getCanvasPixels, getSignLabel } from './utils/dimensions'
import { downloadJpeg, downloadPng, exportPdf, printCanvas } from './utils/exportUtils'
import { setImageMarqueeMask } from './utils/imageEditing'
import { getRulerScale } from './utils/ruler'
import { CUSTOM_FONTS, DEFAULT_FONT } from './utils/fonts'
import './index.css'

const FABRIC_CUSTOM_PROPS = [
  'layerName',
  'isBrushStroke',
  'originalCrop',
  'maskShape',
  'maskInset',
  'maskInverted',
  'arrowHeadSize',
  'arrowHeight',
  'arrowLine',
  'autoFitText',
  'backgroundRemovalSoftness',
  'backgroundRemovalTolerance',
  'curveAmount',
  'curvedLine',
  'editable',
  'gradientAngle',
  'hasControls',
  'isLocked',
  'lineBend',
  'linePointEditing',
  'lockMovementX',
  'lockMovementY',
  'lockRotation',
  'lockScalingFlip',
  'lockScalingX',
  'lockScalingY',
  'padding',
  'strokeUniform',
  'textureName',
  'warpType',
  'warpAmount',
]
const PROJECT_STORAGE_KEY = 'karatula-project-v1'
const ALIGN_SNAP_THRESHOLD = 6
const MIN_VIEW_ZOOM = 0.5
const MAX_VIEW_ZOOM = 3
const VIEW_ZOOM_STEP = 0.1
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
  widthPx: 1920,
  heightPx: 720,
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

function getObjectGuidePositions(object) {
  const bounds = object.getBoundingRect()

  return {
    x: [
      { value: bounds.left },
      { value: bounds.left + bounds.width / 2 },
      { value: bounds.left + bounds.width },
    ],
    y: [
      { value: bounds.top },
      { value: bounds.top + bounds.height / 2 },
      { value: bounds.top + bounds.height },
    ],
  }
}

function getAlignmentGuides(canvas, activeObject) {
  const activePositions = getObjectGuidePositions(activeObject)
  const targetPositions = {
    x: [
      { value: 0 },
      { value: canvas.width / 2 },
      { value: canvas.width },
    ],
    y: [
      { value: 0 },
      { value: canvas.height / 2 },
      { value: canvas.height },
    ],
  }

  canvas
    .getObjects()
    .filter((object) => object !== activeObject)
    .forEach((object) => {
      const objectPositions = getObjectGuidePositions(object)
      targetPositions.x.push(...objectPositions.x)
      targetPositions.y.push(...objectPositions.y)
    })

  const guides = { x: null, y: null }

  for (const axis of ['x', 'y']) {
    for (const activePosition of activePositions[axis]) {
      for (const targetPosition of targetPositions[axis]) {
        const distance = targetPosition.value - activePosition.value

        if (
          Math.abs(distance) <= ALIGN_SNAP_THRESHOLD &&
          (!guides[axis] || Math.abs(distance) < Math.abs(guides[axis].distance))
        ) {
          guides[axis] = {
            distance,
            value: targetPosition.value,
          }
        }
      }
    }
  }

  return guides
}

function drawAlignmentGuides(canvas, guides) {
  if (!canvas.contextTop) return

  const context = canvas.contextTop
  const zoom = canvas.getZoom()
  const viewport = canvas.viewportTransform || [1, 0, 0, 1, 0, 0]

  canvas.clearContext(context)
  context.save()
  context.transform(...viewport)
  context.strokeStyle = '#facc15'
  context.lineWidth = 1.25 / zoom
  context.setLineDash([8 / zoom, 5 / zoom])

  if (guides.x) {
    context.beginPath()
    context.moveTo(guides.x.value, 0)
    context.lineTo(guides.x.value, canvas.height)
    context.stroke()
  }

  if (guides.y) {
    context.beginPath()
    context.moveTo(0, guides.y.value)
    context.lineTo(canvas.width, guides.y.value)
    context.stroke()
  }

  context.restore()
}

function clearAlignmentGuides(canvas) {
  if (canvas?.contextTop) canvas.clearContext(canvas.contextTop)
}

function isLineObject(object) {
  return object?.type?.toLowerCase() === 'line'
}

function isArrowLineObject(object) {
  return Boolean(object?.arrowLine)
}

function isCurvedLineObject(object) {
  return Boolean(object?.curvedLine)
}

function createArrowPath(length, headSize = 40, arrowHeight = 40, bend = 0) {
  const lineLength = Math.max(Number(length) || 0, headSize + 20)
  const curveBend = Number(bend) || 0
  const halfHeadHeight = arrowHeight / 2
  const verticalPadding = Math.abs(curveBend) + halfHeadHeight + 12
  const y = verticalPadding
  const tipX = lineLength
  const tipY = y
  const tangentX = lineLength / 2
  const tangentY = curveBend
  const tangentLength = Math.hypot(tangentX, tangentY) || 1
  const unitX = tangentX / tangentLength
  const unitY = tangentY / tangentLength
  const baseX = tipX - unitX * headSize
  const baseY = tipY - unitY * headSize
  const normalX = -unitY
  const normalY = unitX
  const headTopX = baseX + normalX * halfHeadHeight
  const headTopY = baseY + normalY * halfHeadHeight
  const headBottomX = baseX - normalX * halfHeadHeight
  const headBottomY = baseY - normalY * halfHeadHeight

  return `M 0 ${y} Q ${lineLength / 2} ${y - curveBend} ${tipX} ${tipY} M ${headTopX} ${headTopY} L ${tipX} ${tipY} L ${headBottomX} ${headBottomY}`
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function setArrowBend(object, bend) {
  if (!isArrowLineObject(object)) return

  const curveCommand = object.path?.find((command) => command[0] === 'Q')
  if (!curveCommand) return

  const headSize = Number(object.arrowHeadSize) || 40
  const arrowHeight = Number(object.arrowHeight) || 40
  const length = Math.max(Number(curveCommand[3]) || object.width || 0, headSize + 20)
  const maxBend = Math.max(20, Math.min(length * 0.35, 160))
  const nextBend = clampNumber(Number(bend) || 0, -maxBend, maxBend)

  object.lineBend = nextBend
  object._setPath(createArrowPath(length, headSize, arrowHeight, nextBend))
  object.set({ dirty: true })
}

function createArrowBendControl(object) {
  return new Control({
    actionName: 'bendArrow',
    cursorStyle: 'ns-resize',
    offsetY: -(Number(object.lineBend) || 0),
    positionHandler: (dimensions, finalMatrix, target) => {
      const curveCommand = target.path?.find((command) => command[0] === 'Q')
      if (!curveCommand) return new Point(0, 0).transform(finalMatrix)

      const point = new Point(
        Number(curveCommand[1]) - target.pathOffset.x,
        Number(curveCommand[2]) - target.pathOffset.y,
      )

      return point.transform(finalMatrix)
    },
    actionHandler: (eventData, transform, x, y) => {
      const target = transform.target
      const inverseMatrix = util.invertTransform(target.calcTransformMatrix())
      const localPoint = new Point(x, y).transform(inverseMatrix)
      const objectPoint = localPoint.add(target.pathOffset)
      const curveCommand = target.path?.find((command) => command[0] === 'Q')
      const endY = Number(curveCommand?.[4]) || Number(target.arrowHeight) / 2 || 20

      setArrowBend(target, endY - objectPoint.y)
      target.setCoords()
      target.canvas?.requestRenderAll()
      return true
    },
  })
}

function createCurvedLinePath(length, bend = 0) {
  const lineLength = Math.max(Number(length) || 0, 20)
  const curveBend = Number(bend) || 0
  const verticalPadding = Math.abs(curveBend) + 12
  const y = verticalPadding

  return `M 0 ${y} Q ${lineLength / 2} ${y - curveBend} ${lineLength} ${y}`
}

function applyLinePointControls(object) {
  if (!isCurvedLineObject(object) && !isArrowLineObject(object)) return object

  const enabled = Boolean(object.linePointEditing)
  const defaultControls = controlsUtils.createObjectDefaultControls()
  const pathControls = controlsUtils.createPathControls(object, {
    sizeX: 14,
    sizeY: 14,
  })
  let controls = pathControls

  if (enabled && isArrowLineObject(object)) {
    controls = { ...defaultControls, bend: createArrowBendControl(object) }
  }

  object.set({
    controls: enabled ? controls : defaultControls,
    objectCaching: false,
  })
  return object
}

function allCanvasObjects(container) {
  return (container?.getObjects() || []).flatMap((object) =>
    object.type === 'group' ? [object, ...allCanvasObjects(object)] : [object],
  )
}

function refreshLinePointControls(canvas) {
  allCanvasObjects(canvas).forEach((object) => applyLinePointControls(object))
}

function normalizeLineStretch(object) {
  if (!isLineObject(object)) return

  const center = object.getCenterPoint()
  const length = Math.max((object.width || 1) * Math.abs(object.scaleX || 1), 1)
  const direction = object.x2 >= object.x1 ? 1 : -1

  object.set({
    dirty: true,
    lockScalingY: false,
    objectCaching: false,
    padding: 10,
    scaleX: 1,
    scaleY: 1,
    strokeUniform: true,
    x1: direction === 1 ? 0 : length,
    x2: direction === 1 ? length : 0,
    y1: 0,
    y2: 0,
  })
  object.setPositionByOrigin(center, 'center', 'center')
  object.setCoords()
}

function normalizeRectScale(object) {
  if (object?.type?.toLowerCase() !== 'rect') return

  const scaleX = object.scaleX || 1
  const scaleY = object.scaleY || 1

  if (scaleX === 1 && scaleY === 1) return

  const center = object.getCenterPoint()
  const visualRadius = Math.min(
    (object.rx || 0) * Math.abs(scaleX),
    (object.ry || 0) * Math.abs(scaleY),
  )
  const width = Math.max((object.width || 1) * Math.abs(scaleX), 1)
  const height = Math.max((object.height || 1) * Math.abs(scaleY), 1)
  const radius = Math.min(visualRadius, width / 2, height / 2)

  object.set({
    width,
    height,
    rx: radius,
    ry: radius,
    scaleX: 1,
    scaleY: 1,
  })
  object.setPositionByOrigin(center, 'center', 'center')
  object.setCoords()
}

function stretchLineLive(object, event) {
  if (!isLineObject(object) || !event) return

  const transform = object.canvas?._currentTransform
  const corner = transform?.corner

  if (corner !== 'ml' && corner !== 'mr') return

  const canvas = object.canvas
  const pointer = canvas.getScenePoint(event)
  const fixedOrigin = corner === 'mr' ? 'left' : 'right'
  const anchor = object.getPointByOrigin(fixedOrigin, 'center')
  const angle = ((object.angle || 0) * Math.PI) / 180
  const axis = {
    x: Math.cos(angle) * (corner === 'mr' ? 1 : -1),
    y: Math.sin(angle) * (corner === 'mr' ? 1 : -1),
  }
  const projectedLength = Math.max(
    (pointer.x - anchor.x) * axis.x + (pointer.y - anchor.y) * axis.y,
    1,
  )

  object.set({
    dirty: true,
    lockScalingY: false,
    objectCaching: false,
    padding: 10,
    scaleX: 1,
    scaleY: 1,
    strokeUniform: true,
    x1: 0,
    x2: projectedLength,
    y1: 0,
    y2: 0,
  })
  object.setPositionByOrigin(anchor, fixedOrigin, 'center')
  object.setCoords()
  canvas.requestRenderAll()
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
  const textObjects = allCanvasObjects(canvas).filter((object) => typeof object.text === 'string')

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

function clampViewZoom(value) {
  return Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, value))
}

function App() {
  const [savedProject] = useState(readSavedProject)
  const savedProjectRef = useRef(savedProject)
  const [canvas, setCanvas] = useState(null)
  const [tool, setTool] = useState('select')
  const [brushColor, setBrushColor] = useState('#ffffff')
  const [brushSize, setBrushSize] = useState(12)
  const [brushOpacity, setBrushOpacity] = useState(100)
  const [brushStyle, setBrushStyle] = useState('pencil')
  const [signSize, setSignSizeState] = useState(savedProject?.signSize || initialSize)
  const signSizeRef = useRef(signSize)
  const setSignSize = useCallback((size) => {
    signSizeRef.current = size
    setSignSizeState(size)
  }, [])
  const [activeObject, setActiveObject] = useState(null)
  const [, setActiveObjectVersion] = useState(0)
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isRestoring, setIsRestoring] = useState(false)
  const [message, setMessage] = useState('By Baste')
  const projectInputRef = useRef(null)
  const transactionRef = useRef(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [alignmentAssist, setAlignmentAssist] = useState(
    savedProject?.alignmentAssist || false,
  )
  const [showRulers, setShowRulers] = useState(savedProject?.showRulers || false)
  const [siteBackground, setSiteBackground] = useState(
    savedProject?.siteBackground || DEFAULT_SITE_BACKGROUND,
  )
  const [viewZoom, setViewZoom] = useState(1)
  const canvasStageRef = useRef(null)
  const fileInputRef = useRef(null)
  const maskTargetRef = useRef(null)
  const marqueeRef = useRef(null)
  const clipboardRef = useRef([])
  const panRef = useRef(null)
  const zoomAnchorRef = useRef(null)
  const viewZoomRef = useRef(viewZoom)
  const hasLoadedProjectRef = useRef(false)
  const historyRef = useRef({ history: [], index: -1, isRestoring: false })

  useEffect(() => {
    viewZoomRef.current = viewZoom
  }, [viewZoom])

  useEffect(() => {
    historyRef.current = { history, index: historyIndex, isRestoring }
  }, [history, historyIndex, isRestoring])

  const saveProject = useCallback(
    (nextCanvas = canvas) => {
      if (!nextCanvas || !hasLoadedProjectRef.current || historyRef.current.isRestoring) return

      try {
        window.localStorage.setItem(
          PROJECT_STORAGE_KEY,
          JSON.stringify({
            canvas: nextCanvas.toObject(FABRIC_CUSTOM_PROPS),
            alignmentAssist,
            showRulers,
            signSize: signSizeRef.current,
            siteBackground,
          }),
        )
      } catch {
        setMessage('Autosave unavailable. Save a project file to keep your work.')
      }
    },
    [alignmentAssist, canvas, showRulers, siteBackground],
  )

  const pushHistory = useCallback(
    (nextCanvas = canvas) => {
      if (!nextCanvas || historyRef.current.isRestoring || transactionRef.current) return

      const snapshot = JSON.stringify({ canvas: nextCanvas.toObject(FABRIC_CUSTOM_PROPS), signSize: signSizeRef.current })
      const current = historyRef.current.history[historyRef.current.index]

      if (snapshot === current) return
      setActiveObjectVersion((version) => version + 1)

      const nextHistory = historyRef.current.history.slice(
        0,
        historyRef.current.index + 1,
      )
      nextHistory.push(snapshot)

      const limitedHistory = nextHistory.slice(-40)
      historyRef.current = { history: limitedHistory, index: limitedHistory.length - 1, isRestoring: false }
      setHistory(limitedHistory)
      setHistoryIndex(limitedHistory.length - 1)
      saveProject(nextCanvas)
    },
    [canvas, saveProject],
  )

  const restoreSnapshot = useCallback(
    async (index) => {
      if (!canvas || !history[index] || historyRef.current.isRestoring) return

      historyRef.current.isRestoring = true
      setIsRestoring(true)
      canvas.discardActiveObject()
      try {
      const snapshot = JSON.parse(history[index])
      await canvas.loadFromJSON(snapshot.canvas)
      setSignSize(snapshot.signSize)
      await refreshCanvasTextFonts(canvas)
      refreshLinePointControls(canvas)
      canvas.renderAll()
      setActiveObject(null)
      setHistoryIndex(index)
      } catch {
        setMessage('Could not restore this undo step.')
      } finally {
        historyRef.current.isRestoring = false
        setIsRestoring(false)
        saveProject(canvas)
      }
    },
    [canvas, history, saveProject, setSignSize],
  )

  const undo = useCallback(() => {
    if (historyIndex > 0) restoreSnapshot(historyIndex - 1)
  }, [historyIndex, restoreSnapshot])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) restoreSnapshot(historyIndex + 1)
  }, [historyIndex, history.length, restoreSnapshot])

  const changeViewZoom = useCallback((direction) => {
    const stage = canvasStageRef.current
    const currentZoom = viewZoomRef.current
    const nextZoom = clampViewZoom(
      Number((currentZoom + direction * VIEW_ZOOM_STEP).toFixed(2)),
    )

    if (nextZoom === currentZoom) return

    if (stage) {
      zoomAnchorRef.current = {
        x: (stage.scrollLeft + stage.clientWidth / 2) / currentZoom,
        y: (stage.scrollTop + stage.clientHeight / 2) / currentZoom,
      }
    }

    setViewZoom(nextZoom)
  }, [])

  const zoomIn = useCallback(() => {
    changeViewZoom(1)
  }, [changeViewZoom])

  const zoomOut = useCallback(() => {
    changeViewZoom(-1)
  }, [changeViewZoom])

  const resetViewZoom = useCallback(() => {
    setViewZoom(1)
    if (canvasStageRef.current) {
      canvasStageRef.current.scrollLeft = 0
      canvasStageRef.current.scrollTop = 0
    }
  }, [])

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
        refreshLinePointControls(canvas)
        canvas.renderAll()

        const snapshot = JSON.stringify({ canvas: canvas.toObject(FABRIC_CUSTOM_PROPS), signSize: signSizeRef.current })
        const nextHistory = [snapshot]
        setHistory(nextHistory)
        setHistoryIndex(0)
        historyRef.current = {
          history: nextHistory,
          index: 0,
          isRestoring: false,
        }
      } catch {
        const snapshot = JSON.stringify({ canvas: canvas.toObject(FABRIC_CUSTOM_PROPS), signSize: signSizeRef.current })
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
    const timer = window.setTimeout(() => {
      saveProject(canvas)
      if (hasLoadedProjectRef.current) pushHistory(canvas)
    }, 150)
    return () => window.clearTimeout(timer)
  }, [
    pushHistory,
    alignmentAssist,
    canvas,
    saveProject,
    showRulers,
    signSize,
    siteBackground,
  ])

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
      selected.map(async (object) => {
        const clone = await object.clone(FABRIC_CUSTOM_PROPS)
        util.applyTransformToObject(clone, object.calcTransformMatrix())
        return clone
      }),
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
        applyLinePointControls(clone)
        clone.setCoords()
        return clone
      }),
    )

    transactionRef.current = true
    canvas.add(...pastedObjects)
    transactionRef.current = false

    if (pastedObjects.length === 1) {
      canvas.setActiveObject(pastedObjects[0])
    } else {
      canvas.setActiveObject(new ActiveSelection(pastedObjects, { canvas }))
    }

    clipboardRef.current = await Promise.all(
      pastedObjects.map(async (object) => {
        const clone = await object.clone(FABRIC_CUSTOM_PROPS)
        util.applyTransformToObject(clone, object.calcTransformMatrix())
        return clone
      }),
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
      const selectedObject = canvas.getActiveObject()
      normalizeLineStretch(selectedObject)
      normalizeRectScale(selectedObject)
      syncSelection()
      clearAlignmentGuides(canvas)
      pushHistory(canvas)
    }
    const preventContextMenu = (event) => event.preventDefault()
    const startPan = (event) => {
      const stage = canvasStageRef.current
      if (!stage || viewZoomRef.current <= 1 || tool !== 'select') return false

      panRef.current = {
        x: event.clientX,
        y: event.clientY,
        scrollLeft: stage.scrollLeft,
        scrollTop: stage.scrollTop,
      }
      canvas.set({
        defaultCursor: 'grabbing',
        selection: false,
      })
      event.preventDefault()
      return true
    }
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

      if (!options.target && event.button === 0) {
        startPan(event)
      }
    }
    const handleMouseMove = (options) => {
      const pan = panRef.current
      const stage = canvasStageRef.current
      if (!pan || !stage) return

      stage.scrollLeft = pan.scrollLeft - (options.e.clientX - pan.x)
      stage.scrollTop = pan.scrollTop - (options.e.clientY - pan.y)
      options.e.preventDefault()
    }
    const stopPan = () => {
      if (!panRef.current) return

      panRef.current = null
      canvas.set({
        defaultCursor: viewZoomRef.current > 1 ? 'grab' : 'default',
        selection: true,
      })
    }
    const handleTextChanged = (options) => {
      if (removeEmptyText(options.target)) {
        pushHistory(canvas)
      } else {
        syncSelection()
        saveProject(canvas)
      }
    }
    const showAlignmentAssist = (options) => {
      if (!alignmentAssist) {
        clearAlignmentGuides(canvas)
        return
      }

      const target = options.target
      if (!target) return

      const guides = getAlignmentGuides(canvas, target)

      if (guides.x || guides.y) {
        drawAlignmentGuides(canvas, guides)
      } else {
        clearAlignmentGuides(canvas)
      }
    }
    const handleObjectScaling = (options) => {
      stretchLineLive(options.target, options.e)
      showAlignmentAssist(options)
    }

    canvas.on('selection:created', syncSelection)
    canvas.on('selection:updated', syncSelection)
    canvas.on('selection:cleared', syncSelection)
    canvas.on('object:added', afterChange)
    canvas.on('object:modified', afterChange)
    canvas.on('object:moving', showAlignmentAssist)
    canvas.on('object:removed', afterChange)
    canvas.on('object:scaling', handleObjectScaling)
    canvas.on('text:changed', handleTextChanged)
    canvas.on('mouse:down', handleMouseDown)
    canvas.on('mouse:move', handleMouseMove)
    canvas.on('mouse:up', stopPan)
    canvas.upperCanvasEl.addEventListener('contextmenu', preventContextMenu)

    if (historyRef.current.history.length === 0) pushHistory(canvas)

    return () => {
      canvas.off('selection:created', syncSelection)
      canvas.off('selection:updated', syncSelection)
      canvas.off('selection:cleared', syncSelection)
      canvas.off('object:added', afterChange)
      canvas.off('object:modified', afterChange)
      canvas.off('object:moving', showAlignmentAssist)
      canvas.off('object:removed', afterChange)
      canvas.off('object:scaling', handleObjectScaling)
      canvas.off('text:changed', handleTextChanged)
      canvas.off('mouse:down', handleMouseDown)
      canvas.off('mouse:move', handleMouseMove)
      canvas.off('mouse:up', stopPan)
      canvas.upperCanvasEl.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [alignmentAssist, canvas, pushHistory, saveProject, tool])

  useEffect(() => {
    if (!alignmentAssist) clearAlignmentGuides(canvas)
  }, [alignmentAssist, canvas])

  useEffect(() => {
    if (!canvas) return
    canvas.set({
      defaultCursor: viewZoom > 1 ? 'grab' : 'default',
      hoverCursor: 'move',
    })
    canvas.requestRenderAll()
  }, [canvas, viewZoom])

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current
    const stage = canvasStageRef.current
    if (!anchor || !stage) return

    stage.scrollLeft = anchor.x * viewZoom - stage.clientWidth / 2
    stage.scrollTop = anchor.y * viewZoom - stage.clientHeight / 2
    zoomAnchorRef.current = null
  }, [viewZoom])

  useEffect(() => {
    const handleKeys = (event) => {
      const target = event.target
      const editingField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      if (editingField || canvas?.getActiveObject()?.isEditing || historyRef.current.isRestoring) return

      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const shortcut = { v: 'select', b: 'brush', e: 'erase' }[event.key.toLowerCase()]
        if (shortcut) { event.preventDefault(); setTool(shortcut) }
      }

      if (event.key === 'Escape') {
        setTool('select')
        setContextMenu(null)
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
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

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && canvas) {
        event.preventDefault()
        canvas.discardActiveObject()
        const objects = canvas.getObjects().filter((object) => object.visible && !object.isLocked)
        if (objects.length) canvas.setActiveObject(new ActiveSelection(objects, { canvas }))
        canvas.requestRenderAll()
      }
      const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      if (offsets[event.key] && !event.ctrlKey && !event.metaKey && canvas?.getActiveObject()) {
        const object = canvas.getActiveObject()
        if (canvas.getActiveObjects().some((item) => item.isLocked)) return
        event.preventDefault()
        const [x, y] = offsets[event.key]
        const step = event.shiftKey ? 10 : 1
        object.set({ left: object.left + x * step, top: object.top + y * step })
        object.setCoords()
        canvas.requestRenderAll()
        setActiveObjectVersion((version) => version + 1)
        pushHistory(canvas)
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && canvas) {
        if (canvas.getActiveObject()?.isEditing) return

        const selected = canvas.getActiveObjects()
        const removable = selected.filter((object) => !object.isLocked)
        if (removable.length) {
          event.preventDefault()
          transactionRef.current = true
          removable.forEach((object) => canvas.remove(object))
          transactionRef.current = false
          pushHistory(canvas)
          canvas.discardActiveObject()
          canvas.requestRenderAll()
        }
      }
    }

    window.addEventListener('keydown', handleKeys)
    return () => window.removeEventListener('keydown', handleKeys)
  }, [canvas, copySelection, duplicateSelection, pushHistory, redo, undo])

  const centerObject = useCallback((object) => {
    if (!canvas) return object
    canvas.centerObject(object)
    canvas.add(object)
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
      strokeWidth: 0,
      opacity: 1,
    }

    if (shape === 'square') {
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

    if (shape === 'line') {
      centerObject(
        applyLinePointControls(new Path(createCurvedLinePath(260, 0), {
          curvedLine: true,
          fill: '',
          linePointEditing: false,
          objectCaching: false,
          padding: 10,
          stroke: '#ffffff',
          strokeWidth: 1,
          strokeLineCap: 'round',
          strokeUniform: true,
        })),
      )
    }

    if (shape === 'dashed-line' || shape === 'dotted-line') {
      centerObject(
        applyLinePointControls(new Path(createCurvedLinePath(260, 0), {
          curvedLine: true,
          fill: '',
          linePointEditing: false,
          objectCaching: false,
          padding: 10,
          stroke: '#ffffff',
          strokeDashArray: shape === 'dashed-line' ? [18, 12] : [3, 12],
          strokeWidth: 8,
          strokeLineCap: 'round',
          strokeUniform: true,
        })),
      )
    }

    if (shape === 'arrow' || shape === 'thin-arrow') {
      const strokeWidth = shape === 'thin-arrow' ? 4 : 8
      centerObject(
        applyLinePointControls(new Path(createArrowPath(210, 40, 40), {
          arrowHeadSize: 40,
          arrowHeight: 40,
          arrowLine: true,
          fill: '',
          linePointEditing: false,
          lineBend: 0,
          objectCaching: false,
          padding: 10,
          stroke: '#ffffff',
          strokeWidth,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
          strokeUniform: true,
        })),
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

      if (editingField || canvas?.getActiveObject()?.isEditing || historyRef.current.isRestoring) return

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
    if (activeObject.isLocked || historyRef.current.isRestoring || canvas.getActiveObjects().some((object) => object.isLocked)) return

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
    normalizeLineStretch(targetObject)
    normalizeRectScale(targetObject)
    applyLinePointControls(targetObject)
    targetObject.setCoords()
    canvas.requestRenderAll()
    setActiveObject(targetObject)
    setActiveObjectVersion((version) => version + 1)
    pushHistory(canvas)
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
    transactionRef.current = true
    canvas
      .getActiveObjects()
      .filter((object) => !object.isLocked)
      .forEach((object) => canvas.remove(object))
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    transactionRef.current = false
    pushHistory(canvas)
  }

  const resetBoard = () => {
    if (!canvas) return

    transactionRef.current = true
    canvas.discardActiveObject()
    canvas.getObjects().forEach((object) => canvas.remove(object))
    canvas.set({ backgroundColor: '#111111' })
    canvas.requestRenderAll()
    setActiveObject(null)
    setActiveObjectVersion((version) => version + 1)
    setShowResetModal(false)
    transactionRef.current = false
    pushHistory(canvas)
  }

  const editLayers = (action) => {
    if (!canvas || historyRef.current.isRestoring) return
    action()
    canvas.requestRenderAll()
    setActiveObject(canvas.getActiveObject() || null)
    setActiveObjectVersion((version) => version + 1)
    pushHistory(canvas)
  }

  const transformSelection = (action) => {
    const object = canvas?.getActiveObject()
    if (!object || canvas.getActiveObjects().some((item) => item.isLocked)) return
    editLayers(() => {
      const bounds = object.getBoundingRect()
      const positions = {
        left: [-bounds.left, 0], right: [canvas.width - bounds.left - bounds.width, 0],
        center: [(canvas.width - bounds.width) / 2 - bounds.left, 0],
        top: [0, -bounds.top], bottom: [0, canvas.height - bounds.top - bounds.height],
        middle: [0, (canvas.height - bounds.height) / 2 - bounds.top],
      }
      if (positions[action]) {
        const [x, y] = positions[action]
        object.set({ left: object.left + x, top: object.top + y })
      } else object.set(action, !object[action])
      object.setCoords()
    })
  }

  const saveProjectFile = () => {
    if (!canvas) return
    downloadProject({ formatVersion: 1, signSize, canvas: canvas.toObject(FABRIC_CUSTOM_PROPS) })
    setMessage('Project file downloaded')
  }

  const openProjectFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !canvas || historyRef.current.isRestoring) return
    const previous = canvas.toObject(FABRIC_CUSTOM_PROPS)
    try {
      if (file.size > 50000000) throw new Error('Project files must be smaller than 50 MB.')
      const project = validateProject(JSON.parse(await file.text()))
      historyRef.current.isRestoring = true
      setIsRestoring(true)
      await canvas.loadFromJSON(project.canvas)
      await refreshCanvasTextFonts(canvas)
      refreshLinePointControls(canvas)
      setSignSize(project.signSize)
      canvas.discardActiveObject()
      setActiveObject(null)
      setMessage('Project opened')
    } catch (error) {
      if (historyRef.current.isRestoring) {
        await canvas.loadFromJSON(previous)
        refreshLinePointControls(canvas)
      }
      setMessage(error.message || 'Could not open project.')
    } finally {
      historyRef.current.isRestoring = false
      setIsRestoring(false)
      canvas.requestRenderAll()
      pushHistory(canvas)
    }
  }

  const runExport = async (action) => {
    try { if (canvas) await action(canvas, signSize) }
    catch (error) { setMessage(error.message || 'Export failed. Try a smaller sign size.') }
  }

  const groupSelection = () => {
    if (!canvas || canvas.getActiveObjects().some((object) => object.isLocked)) return
    const objects = canvas.getActiveObjects()
    if (objects.length < 2) return
    transactionRef.current = true
    canvas.discardActiveObject()
    const position = Math.max(...objects.map((object) => canvas.getObjects().indexOf(object))) - objects.length + 1
    canvas.remove(...objects)
    const group = new Group(objects, { layerName: 'Group' })
    canvas.insertAt(Math.max(0, position), group)
    canvas.setActiveObject(group)
    transactionRef.current = false
    editLayers(() => {})
  }

  const ungroupSelection = () => {
    const group = canvas?.getActiveObject()
    if (group?.type !== 'group' || group.isLocked) return
    transactionRef.current = true
    const position = canvas.getObjects().indexOf(group)
    canvas.discardActiveObject()
    const objects = group.removeAll()
    canvas.remove(group)
    canvas.insertAt(position, ...objects)
    canvas.setActiveObject(new ActiveSelection(objects, { canvas }))
    transactionRef.current = false
    editLayers(() => {})
  }

  useEffect(() => {
    if (!canvas) return
    canvas.set({ isDrawingMode: tool === 'brush', selection: tool === 'select' })
    canvas.set('skipTargetFind', tool === 'marquee')
    if (tool !== 'select') {
      canvas.discardActiveObject()
    }
    if (tool === 'brush') {
      const brush = brushStyle === 'spray' ? new SprayBrush(canvas) : new PencilBrush(canvas)
      brush.color = new Color(brushColor).setAlpha(brushOpacity / 100).toRgba()
      brush.width = brushSize
      if (brushStyle === 'spray') {
        brush.density = 8
        brush.dotWidth = Math.max(1, Math.round(brushSize / 8))
        brush.dotWidthVariance = 0
      }
      brush.limitedToCanvasSize = true
      canvas.set('freeDrawingBrush', brush)
    }
    const preparePath = ({ path }) => path.set({ isBrushStroke: true, layerName: brushStyle === 'spray' ? 'Spray stroke' : 'Brush stroke' })
    const eraseStroke = ({ target, e }) => {
      if (tool === 'erase' && e.button === 0 && target?.isBrushStroke && !target.isLocked) {
        canvas.remove(target)
        canvas.requestRenderAll()
      }
    }
    const beginMarquee = ({ e }) => {
      const target = maskTargetRef.current
      if (tool !== 'marquee' || e.button !== 0 || !target || !canvas.getObjects().includes(target)) return
      const start = canvas.getScenePoint(e)
      const preview = new Rect({ left: start.x, top: start.y, width: 1, height: 1,
        fill: 'rgba(255,255,255,0.15)', stroke: '#facc15', strokeDashArray: [6, 4],
        selectable: false, evented: false, excludeFromExport: true })
      marqueeRef.current = { start, preview, target }
      transactionRef.current = true
      canvas.add(preview)
    }
    const moveMarquee = ({ e }) => {
      if (tool !== 'marquee' || !marqueeRef.current) return
      const { start, preview } = marqueeRef.current
      const point = canvas.getScenePoint(e)
      preview.set({ left: Math.min(start.x, point.x), top: Math.min(start.y, point.y),
        width: Math.abs(start.x - point.x), height: Math.abs(start.y - point.y) })
      canvas.requestRenderAll()
    }
    const finishMarquee = ({ e }) => {
      if (tool !== 'marquee' || !marqueeRef.current) return
      const { start, preview, target } = marqueeRef.current
      marqueeRef.current = null
      canvas.remove(preview)
      let applied = false
      try {
        applied = setImageMarqueeMask(target, start, canvas.getScenePoint(e))
      } catch {
        setMessage('Could not make a mask from that selection.')
      } finally {
        transactionRef.current = false
      }
      if (applied) {
        canvas.setActiveObject(target)
        canvas.requestRenderAll()
        pushHistory(canvas)
        setTool('select')
      }
    }
    canvas.on('before:path:created', preparePath)
    canvas.on('mouse:down', eraseStroke)
    canvas.on('mouse:down', beginMarquee)
    canvas.on('mouse:move', moveMarquee)
    canvas.on('mouse:up', finishMarquee)
    canvas.requestRenderAll()
    return () => {
      canvas.set({ isDrawingMode: false, selection: true })
      canvas.set('skipTargetFind', false)
      canvas.off('before:path:created', preparePath)
      canvas.off('mouse:down', eraseStroke)
      canvas.off('mouse:down', beginMarquee)
      canvas.off('mouse:move', moveMarquee)
      canvas.off('mouse:up', finishMarquee)
      if (marqueeRef.current) {
        canvas.remove(marqueeRef.current.preview)
        marqueeRef.current = null
        transactionRef.current = false
      }
    }
  }, [canvas, tool, brushColor, brushSize, brushOpacity, brushStyle, pushHistory])

  const selectedPixels = getCanvasPixels(signSize)
  const rulerWidth = Math.max(Number(signSize.widthPx) || 0, 1)
  const rulerHeight = Math.max(Number(signSize.heightPx) || 0, 1)
  const horizontalRuler = getRulerScale(rulerWidth, selectedPixels.width, 65)
  const verticalRuler = getRulerScale(rulerHeight, selectedPixels.height, 32)

  return (
    <main
      className="app-shell"
      style={{ '--site-background': siteBackground }}
    >
      <Toolbar
        canRedo={!isRestoring && historyIndex < history.length - 1}
        canUndo={!isRestoring && historyIndex > 0}
        message={message}
        onSaveProject={saveProjectFile}
        onOpenProject={() => projectInputRef.current?.click()}
        onExportPdf={() => runExport(exportPdf)}
        onExportPng={() => runExport(downloadPng)}
        onPrint={() => runExport(printCanvas)}
        onRedo={redo}
        onReset={() => setShowResetModal(true)}
        onSettings={() => setShowSettings(true)}
        onUndo={undo}
      />

      <section className="editor-shell" inert={isRestoring} aria-busy={isRestoring}>
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

          <DrawingTools tool={tool} onTool={(nextTool) => {
            if (nextTool === 'marquee') maskTargetRef.current = canvas?.getActiveObject()
            setTool(nextTool)
          }} canMask={activeObject?.type === 'image' && !activeObject.isLocked}
            color={brushColor} onColor={setBrushColor}
            size={brushSize} onSize={setBrushSize} opacity={brushOpacity} onOpacity={setBrushOpacity}
            brushStyle={brushStyle} onBrushStyle={setBrushStyle} />
          <div
            className={`canvas-stage ${showRulers ? 'has-rulers' : ''} ${
              viewZoom > 1 ? 'is-zoomed' : ''
            }`}
            ref={canvasStageRef}
          >
            <div
              className="zoom-shell"
              style={{
                '--canvas-height': `${selectedPixels.height}px`,
                '--canvas-width': `${selectedPixels.width}px`,
                '--ruler-height': `${selectedPixels.height}px`,
                '--ruler-width': `${selectedPixels.width}px`,
                '--view-zoom': viewZoom,
                '--zoomed-canvas-height': `${selectedPixels.height * viewZoom}px`,
                '--zoomed-canvas-width': `${selectedPixels.width * viewZoom}px`,
              }}
            >
              <div className="ruler-wrap">
                {showRulers && (
                  <>
                    <div className="ruler ruler-horizontal" aria-hidden="true" style={{
                      '--ruler-major-spacing': `${(horizontalRuler.step / rulerWidth) * selectedPixels.width}px`,
                      '--ruler-minor-spacing': `${(horizontalRuler.step / rulerWidth) * selectedPixels.width / 5}px`,
                    }}>
                      {horizontalRuler.marks.map((mark) => (
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
                    <div className="ruler ruler-vertical" aria-hidden="true" style={{
                      '--ruler-major-spacing': `${(verticalRuler.step / rulerHeight) * selectedPixels.height}px`,
                      '--ruler-minor-spacing': `${(verticalRuler.step / rulerHeight) * selectedPixels.height / 5}px`,
                    }}>
                      {verticalRuler.marks.map((mark) => (
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
          </div>

          <div className="board-zoom-controls" aria-label="Canvas zoom controls">
            <button
              aria-label="Zoom out"
              type="button"
              title="Zoom out"
              onClick={zoomOut}
            >
              <ZoomOut size={18} />
            </button>
            <button
              aria-label="Reset zoom"
              className="zoom-level-button"
              type="button"
              title="Reset zoom"
              onClick={resetViewZoom}
            >
              {Math.round(viewZoom * 100)}%
            </button>
            <button
              aria-label="Zoom in"
              type="button"
              title="Zoom in"
              onClick={zoomIn}
            >
              <ZoomIn size={18} />
            </button>
          </div>
        </section>

        <div className="inspector">
          <LayersPanel canvas={canvas} onChange={editLayers} onLock={applyLockState} onSelect={(object) => {
            setTool('select')
            canvas.discardActiveObject()
            if (object.visible) canvas.setActiveObject(object)
            canvas.requestRenderAll()
          }} />
          <div className="inspector-details">
            {activeObject?.type === 'image' && <ImageTools image={activeObject} onEdit={editLayers} onError={setMessage} />}
            {activeObject && <section className="selection-actions" aria-label="Arrange selection">
            <h2>Arrange</h2>
            {activeObject.type !== 'activeselection' && <label>Layer name
              <input aria-label="Layer name" maxLength={80} value={activeObject.layerName || ''} placeholder="Name this layer"
                onChange={(event) => editLayers(() => activeObject.set('layerName', event.target.value))} />
            </label>}
            <div className="arrange-grid">
              {['left', 'center', 'right', 'top', 'middle', 'bottom'].map((action) => <button key={action} type="button" disabled={canvas.getActiveObjects().some((item) => item.isLocked)} onClick={() => transformSelection(action)}>{action}</button>)}
              <button type="button" onClick={() => transformSelection('flipX')}>Flip horizontal</button>
              <button type="button" onClick={() => transformSelection('flipY')}>Flip vertical</button>
              <button type="button" onClick={duplicateSelection}>Duplicate</button>
              <button type="button" disabled={canvas.getActiveObjects().length < 2} onClick={groupSelection}>Group</button>
              <button type="button" disabled={activeObject.type !== 'group'} onClick={ungroupSelection}>Ungroup</button>
            </div>
            </section>}
            <PropertiesPanel
              activeObject={activeObject}
              onCommit={commitActiveObject}
              onDelete={deleteActiveObject}
              onLayerChange={changeLayer}
              onUpdate={updateActiveObject}
            />
          </div>
        </div>
      </section>

      <ExportPanel
        onExportPdf={() => runExport(exportPdf)}
        onExportPng={() => runExport(downloadPng)}
        onExportJpeg={() => runExport(downloadJpeg)}
        onPrint={() => runExport(printCanvas)}
      />

      <input ref={projectInputRef} accept=".json,application/json" className="hidden-input" type="file" onChange={openProjectFile} />
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
            <label className="switch-row">
              <span>Show ruler</span>
              <input
                checked={showRulers}
                type="checkbox"
                onChange={(event) => setShowRulers(event.target.checked)}
              />
              <span className="switch-control" />
            </label>
            <label className="switch-row">
              <span>Alignment assist</span>
              <input
                checked={alignmentAssist}
                type="checkbox"
                onChange={(event) => setAlignmentAssist(event.target.checked)}
              />
              <span className="switch-control" />
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
