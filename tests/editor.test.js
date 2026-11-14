import test from 'node:test'
import assert from 'node:assert/strict'
import { Rect, StaticCanvas, util } from 'fabric'
import { validateProject } from '../src/utils/project.js'
import { getCanvasPixels } from '../src/utils/dimensions.js'
import { canvasToPrintDataUrl } from '../src/utils/canvasUtils.js'
import { getLayerDropIndex } from '../src/utils/layerOrder.js'
import { getRulerScale } from '../src/utils/ruler.js'
import { fitRectangleToBoard } from '../src/utils/fitToBoard.js'
import { restoreSavedTextSize } from '../src/utils/textLayout.js'
import { measureTextInkBounds } from '../src/utils/textSelection.js'
import { DIVISORIA_PREVIEW_SIZE, getDivisoriaLayout, getPremadeLayout, PREMADE_ASSETS } from '../src/utils/premadeAssets.js'
import divisoriaProject from '../src/assets/premade/divisoria-city-hall.json' with { type: 'json' }

const project = { formatVersion: 1, signSize: { widthPx: 1920, heightPx: 720 }, canvas: { objects: [] } }

test('project files accept supported documents and reject invalid sizes or formats', () => {
  assert.equal(validateProject(project), project)
  for (const invalid of [null, {}, { ...project, formatVersion: 2 }, { ...project, signSize: { widthPx: -1, heightPx: 720 } }, { ...project, signSize: { widthPx: 16000, heightPx: 16000 } }]) {
    assert.throws(() => validateProject(invalid))
  }
  assert.doesNotThrow(() => validateProject({ ...project, signSize: { widthPx: 120, heightPx: 10 } }))
})

test('portrait and panoramic previews stay bounded and nonzero', () => {
  for (const size of [{ widthPx: 20, heightPx: 16000 }, { widthPx: 16000, heightPx: 10 }, project.signSize]) {
    const preview = getCanvasPixels(size)
    assert.ok(preview.width > 0 && preview.width <= 940)
    assert.ok(preview.height > 0 && preview.height <= 600)
  }
})

test('premade design uses the saved layers and scales uniformly without changing the board', () => {
  const preview = getCanvasPixels(project.signSize)
  assert.deepEqual(DIVISORIA_PREVIEW_SIZE, preview)
  assert.deepEqual(getDivisoriaLayout(preview.width, preview.height), {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  })
  const smaller = getDivisoriaLayout(430, 300)
  assert.equal(smaller.scale, 0.5)
  assert.equal(smaller.offsetX, 0)
  assert.equal(smaller.offsetY, (300 - preview.height / 2) / 2)
  assert.deepEqual(
    divisoriaProject.canvas.objects.map(({ layerName }) => layerName),
    ['Border', 'Light sign panel', 'Yellow accent', 'DIVISORIA', 'CITY HALL'],
  )
})

test('SM Bicutan project is available as an editable premade design', () => {
  const asset = PREMADE_ASSETS.find(({ id }) => id === 'sm-bicutan-dost')
  assert.ok(asset)
  assert.equal(asset.name, 'SM Bicutan')
  assert.equal(validateProject(asset.project), asset.project)
  assert.equal(asset.project.canvas.background, '#ffffff')
  assert.deepEqual(asset.project.canvas.objects.map(({ text }) => text).filter(Boolean), ['SM', 'BICUTAN', 'dost'])
  assert.deepEqual(getPremadeLayout(asset, 430, 300), { scale: 0.5, offsetX: 0, offsetY: 69.25 })
})

test('reloaded premade text keeps its saved visual size after font metrics change', () => {
  const saved = divisoriaProject.canvas.objects.slice(-2)
  const restored = saved.map((source) => ({
    text: source.text,
    width: source.width * 1.5,
    height: source.height * 1.2,
    scaleX: source.scaleX,
    scaleY: source.scaleY,
    set(key, value) { this[key] = value },
    setCoords() { this.coordsUpdated = true },
  }))

  restoreSavedTextSize(restored, saved)

  restored.forEach((object, index) => {
    assert.ok(Math.abs(object.width * object.scaleX - saved[index].width * saved[index].scaleX) < 0.0001)
    assert.ok(Math.abs(object.height * object.scaleY - saved[index].height * saved[index].scaleY) < 0.0001)
    assert.equal(object.coordsUpdated, true)
  })
})

test('text selection bounds follow visible glyph height instead of the font line box', () => {
  const object = {
    text: 'SM',
    fontFamily: 'Test',
    fontSize: 100,
    fontWeight: '700',
    fontStyle: 'normal',
    height: 113,
    strokeWidth: 0,
    _fontSizeFraction: 0.222,
    getHeightOfLineImpl: () => 113,
    getHeightOfLine: () => 113,
  }
  const context = { measureText: () => ({ actualBoundingBoxAscent: 75, actualBoundingBoxDescent: 5 }) }

  const bounds = measureTextInkBounds(object, context)

  assert.ok(bounds.top > -object.height / 2)
  assert.ok(bounds.bottom < object.height / 2)
  assert.ok(bounds.bottom - bounds.top < object.height)
})

test('fit to board aligns a rotated rectangle outline with every board edge', () => {
  const rectangle = new Rect({
    left: 100,
    top: 60,
    width: 250,
    height: 100,
    stroke: '#000000',
    strokeWidth: 10,
    angle: 18,
    scaleX: 1.7,
    scaleY: 1.4,
  })

  fitRectangleToBoard(rectangle, 1920, 720)

  assert.deepEqual(rectangle.getBoundingRect(), {
    left: 0,
    top: 0,
    width: 1920,
    height: 720,
  })
  assert.equal(rectangle.strokeWidth, 10)
})

test('ruler labels stay spaced at the displayed canvas size', () => {
  const horizontal = getRulerScale(1920, 860, 65)
  const vertical = getRulerScale(720, 322, 32)
  assert.equal(horizontal.step, 200)
  assert.equal(vertical.step, 100)
  assert.deepEqual(horizontal.marks.slice(0, 4), [0, 200, 400, 600])
  assert.equal(horizontal.marks.at(-1), 1920)
  assert.equal(vertical.marks.at(-1), 720)
  for (const [scale, size, preview, spacing] of [[horizontal, 1920, 860, 65], [vertical, 720, 322, 32]]) {
    for (let index = 1; index < scale.marks.length; index += 1) {
      assert.ok((scale.marks[index] - scale.marks[index - 1]) * preview / size >= spacing)
    }
  }
})

test('Fabric canvas serialization retains editor metadata', async () => {
  const rect = new Rect({ width: 100, height: 50, isLocked: true, layerName: 'Header', linePointEditing: true })
  const properties = ['isLocked', 'layerName', 'linePointEditing']
  // Exercise the actual canvas serializer without requiring a browser canvas.
  const canvas = Object.create(StaticCanvas.prototype)
  canvas._objects = [rect]
  const data = canvas.toObject(properties)
  assert.equal(data.objects[0].isLocked, true)
  assert.equal(data.objects[0].layerName, 'Header')
  const [restored] = await util.enlivenObjects(data.objects)
  assert.equal(restored.isLocked, true)
  assert.equal(restored.linePointEditing, true)
})

test('export renders the exact requested pixel dimensions, independent of preview size', () => {
  const original = globalThis.document
  let output
  const draws = []
  globalThis.document = { createElement: () => (output = { getContext: () => ({ drawImage: (...args) => draws.push(args) }), toDataURL: () => 'data:image/png;test' }) }
  try {
    const canvas = { width: 860, height: 323, toCanvasElement: (scale) => ({ scale }) }
    assert.equal(canvasToPrintDataUrl(canvas, project.signSize), 'data:image/png;test')
    assert.equal(output.width, 1920)
    assert.equal(output.height, 720)
    assert.deepEqual(draws[0].slice(1), [0, 0, 1920, 720])
    assert.throws(() => canvasToPrintDataUrl(canvas, { widthPx: 16000, heightPx: 16000 }))
  } finally { globalThis.document = original }
})


test('crop preserves the image center and supports restoring the original crop', async () => {
  const { cropImage, resetImageCrop } = await import('../src/utils/imageEditing.js')
  const image = new Rect({ width: 400, height: 200, cropX: 0, cropY: 0, left: 40, top: 80, angle: 35 })
  const center = image.getCenterPoint()
  cropImage(image, { left: 25, right: 0, top: 10, bottom: 10 })
  assert.equal(image.width, 300)
  assert.equal(image.height, 160)
  assert.equal(image.cropX, 100)
  assert.equal(image.cropY, 20)
  assert.ok(image.getCenterPoint().distanceFrom(center) < 0.001)
  assert.throws(() => cropImage(image, { left: 60, right: 40 }))
  resetImageCrop(image)
  assert.equal(image.width, 400)
  assert.equal(image.height, 200)
  assert.equal(image.cropX, 0)
})

test('editable image masks survive serialization and follow crop dimensions', async () => {
  const { setImageMask, cropImage, resetImageCrop } = await import('../src/utils/imageEditing.js')
  const image = new Rect({ width: 400, height: 200 })
  setImageMask(image, 'ellipse', 10, true)
  assert.equal(image.clipPath.rx, 160)
  assert.equal(image.clipPath.ry, 80)
  assert.equal(image.clipPath.inverted, true)
  cropImage(image, { left: 25, right: 0, top: 0, bottom: 0 })
  assert.equal(image.clipPath.rx, 120)
  resetImageCrop(image)
  assert.equal(image.clipPath.rx, 160)
  const [restored] = await util.enlivenObjects([image.toObject(['maskShape', 'maskInset', 'maskInverted'])])
  assert.equal(restored.maskShape, 'ellipse')
  assert.equal(restored.maskInset, 10)
  assert.equal(restored.clipPath.inverted, true)
  setImageMask(restored, 'none')
  assert.equal(restored.clipPath, undefined)
  assert.equal(restored.width, 400)
})

test('drag selection creates a movable image-local mask', async () => {
  const { setImageMarqueeMask, cropImage } = await import('../src/utils/imageEditing.js')
  const image = new Rect({ width: 200, height: 100, left: 40, top: 30, scaleX: 2, angle: 15 })
  assert.equal(setImageMarqueeMask(image, { x: 100, y: 50 }, { x: 102, y: 52 }), false)
  assert.equal(setImageMarqueeMask(image, { x: 100, y: 50 }, { x: 180, y: 110 }), true)
  assert.equal(image.maskShape, 'marquee')
  assert.equal(image.clipPath.type, 'polygon')
  const originalClip = image.clipPath.toObject()
  image.set({ left: 80, top: 70 })
  assert.deepEqual(image.clipPath.toObject(), originalClip)
  cropImage(image, { left: 10, right: 0, top: 0, bottom: 0 })
  assert.equal(image.maskShape, 'marquee')
})

test('image adjustments stack, update without duplicates, and reset independently', async () => {
  const { adjustImage } = await import('../src/utils/imageEditing.js')
  const image = { filters: [], applyFilters() {}, set() {} }
  adjustImage(image, 'brightness', 0.3)
  adjustImage(image, 'contrast', -0.2)
  adjustImage(image, 'brightness', 0.7)
  assert.equal(image.filters.length, 2)
  assert.equal(image.filters.find((filter) => filter.type === 'Brightness').brightness, 0.7)
  adjustImage(image, 'brightness', 0)
  assert.equal(image.filters.length, 1)
  assert.equal(image.filters[0].type, 'Contrast')
  adjustImage(image, 'Grayscale', true)
  assert.equal(image.filters[1].type, 'Grayscale')
  adjustImage(image, 'Grayscale', false)
  assert.equal(image.filters.length, 1)
  adjustImage(image, 'hue', 0.25)
  adjustImage(image, 'vibrance', 0.4)
  adjustImage(image, 'pixelate', 12)
  assert.equal(image.filters.find((filter) => filter.type === 'HueRotation').rotation, 0.25)
  assert.equal(image.filters.find((filter) => filter.type === 'Vibrance').vibrance, 0.4)
  assert.equal(image.filters.find((filter) => filter.type === 'Pixelate').blocksize, 12)
  adjustImage(image, 'pixelate', 0)
  assert.equal(image.filters.some((filter) => filter.type === 'Pixelate'), false)
})

test('export can request JPEG at the selected sign dimensions', () => {
  const original = globalThis.document
  let output
  globalThis.document = { createElement: () => (output = { getContext: () => ({ drawImage() {} }), toDataURL: (...args) => args.join(':') }) }
  try {
    const canvas = { width: 860, height: 323, toCanvasElement: () => ({}) }
    assert.equal(canvasToPrintDataUrl(canvas, project.signSize, 'image/jpeg', 0.92), 'image/jpeg:0.92')
    assert.equal(output.width, 1920)
    assert.equal(output.height, 720)
  } finally { globalThis.document = original }
})

test('group and ungroup preserve transformed object coordinates', async () => {
  const { Group } = await import('fabric')
  const objects = [new Rect({ width: 30, height: 40, left: 20, top: 10 }), new Rect({ width: 10, height: 10, left: 80, top: 60 })]
  const group = new Group(objects)
  group.set({ angle: 30, scaleX: 1.5, scaleY: 1.5 })
  const before = objects.map((object) => object.calcTransformMatrix())
  const ungrouped = group.removeAll()
  ungrouped.forEach((object, index) => object.calcTransformMatrix().forEach((value, axis) => assert.ok(Math.abs(value - before[index][axis]) < 0.00001)))
})

test('dragging layer rows maps visible drop positions to canvas stacking order', () => {
  const [bottom, middle, top] = [{}, {}, {}]
  const objects = [bottom, middle, top]
  assert.equal(getLayerDropIndex(objects, bottom, top, 'above'), 2)
  assert.equal(getLayerDropIndex(objects, top, bottom, 'below'), 0)
  assert.equal(getLayerDropIndex(objects, bottom, middle, 'above'), 1)
  assert.equal(getLayerDropIndex(objects, middle, middle, 'above'), -1)
})


test('brush and crop metadata survive serialization inside a group', async () => {
  const { Group, Path } = await import('fabric')
  const stroke = new Path('M 0 0 L 20 30', { isBrushStroke: true, layerName: 'Brush stroke' })
  const cropped = new Rect({ width: 50, height: 50, originalCrop: { width: 100, height: 100, cropX: 0, cropY: 0 } })
  const group = new Group([stroke, cropped])
  const data = group.toObject(['isBrushStroke', 'layerName', 'originalCrop'])
  const [restored] = await util.enlivenObjects([data])
  assert.equal(restored.getObjects()[0].isBrushStroke, true)
  assert.equal(restored.getObjects()[1].originalCrop.width, 100)
})

