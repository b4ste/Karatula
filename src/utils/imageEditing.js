import { Ellipse, Point, Polygon, Rect, filters, util } from 'fabric'

const adjustmentTypes = {
  brightness: ['Brightness', 'brightness'],
  contrast: ['Contrast', 'contrast'],
  saturation: ['Saturation', 'saturation'],
  blur: ['Blur', 'blur'],
  vibrance: ['Vibrance', 'vibrance'],
  hue: ['HueRotation', 'rotation'],
  pixelate: ['Pixelate', 'blocksize'],
}

export function adjustImage(image, key, value) {
  const [type, property] = adjustmentTypes[key] || [key]
  if (!filters[type]) throw new Error('Unsupported image adjustment')
  const remaining = (image.filters || []).filter((filter) => filter.type !== type)
  if (value) {
    const amount = key === 'pixelate'
      ? Math.max(2, Math.min(50, Math.round(Number(value) || 2)))
      : Math.max(key === 'blur' ? 0 : -1, Math.min(1, Number(value) || 0))
    remaining.push(new filters[type](property ? { [property]: amount } : {}))
  }
  image.filters = remaining
  image.applyFilters()
  image.set('dirty', true)
}

export function cropImage(image, edges) {
  const values = ['left', 'right', 'top', 'bottom'].map((key) => Number(edges[key]) || 0)
  if (values.some((value) => value < 0 || value >= 100) || values[0] + values[1] >= 100 || values[2] + values[3] >= 100) {
    throw new Error('Keep some of the image: opposite crop edges must total less than 100%.')
  }
  const [left, right, top, bottom] = values.map((value) => value / 100)
  const center = image.getCenterPoint()
  if (!image.originalCrop) image.originalCrop = { width: image.width, height: image.height, cropX: image.cropX, cropY: image.cropY }
  image.set({
    cropX: image.cropX + image.width * left,
    cropY: image.cropY + image.height * top,
    width: Math.max(1, image.width * (1 - left - right)),
    height: Math.max(1, image.height * (1 - top - bottom)),
    dirty: true,
  })
  image.setPositionByOrigin(center, 'center', 'center')
  image.setCoords()
  if (image.maskShape === 'rectangle' || image.maskShape === 'ellipse') setImageMask(image, image.maskShape, image.maskInset, image.maskInverted)
}

export function resetImageCrop(image) {
  if (!image.originalCrop) return
  const center = image.getCenterPoint()
  image.set({ ...image.originalCrop, originalCrop: null, dirty: true })
  image.setPositionByOrigin(center, 'center', 'center')
  image.setCoords()
  if (image.maskShape === 'rectangle' || image.maskShape === 'ellipse') setImageMask(image, image.maskShape, image.maskInset, image.maskInverted)
}

export function setImageMask(image, shape, inset = 0, inverted = false) {
  if (!['none', 'rectangle', 'ellipse'].includes(shape)) throw new Error('Unsupported mask shape')
  const safeInset = Math.max(0, Math.min(45, Number(inset) || 0))
  if (shape === 'none') {
    image.set({ clipPath: undefined, maskShape: 'none', maskInset: 0, maskInverted: false, dirty: true })
    return
  }
  const width = Math.max(1, image.width * (1 - safeInset / 50))
  const height = Math.max(1, image.height * (1 - safeInset / 50))
  const options = { left: 0, top: 0, originX: 'center', originY: 'center', fill: '#000000', inverted: Boolean(inverted) }
  const clipPath = shape === 'ellipse'
    ? new Ellipse({ ...options, rx: width / 2, ry: height / 2 })
    : new Rect({ ...options, width, height })
  image.set({ clipPath, maskShape: shape, maskInset: safeInset, maskInverted: Boolean(inverted), dirty: true })
}

export function setImageMarqueeMask(image, start, end) {
  const left = Math.min(start.x, end.x)
  const right = Math.max(start.x, end.x)
  const top = Math.min(start.y, end.y)
  const bottom = Math.max(start.y, end.y)
  if (right - left < 4 || bottom - top < 4) return false
  const inverse = util.invertTransform(image.calcTransformMatrix())
  const points = [
    [left, top], [right, top], [right, bottom], [left, bottom],
  ].map(([x, y]) => util.transformPoint(new Point(x, y), inverse))
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const clipPath = new Polygon(points, {
    left: (Math.min(...xs) + Math.max(...xs)) / 2,
    top: (Math.min(...ys) + Math.max(...ys)) / 2,
    originX: 'center',
    originY: 'center',
    fill: '#000000',
  })
  image.set({ clipPath, maskShape: 'marquee', maskInset: 0, maskInverted: false, dirty: true })
  return true
}
