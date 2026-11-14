import { cache, util } from 'fabric'
import divisoriaProject from '../assets/premade/divisoria-city-hall.json' with { type: 'json' }
import bicutanProject from '../assets/premade/sm-bicutan-dost.json' with { type: 'json' }
import { getCanvasPixels } from './dimensions.js'

export const PREMADE_ASSETS = [
  { id: 'divisoria', name: 'Divisoria City Hall', project: divisoriaProject },
  { id: 'sm-bicutan-dost', name: 'SM Bicutan', project: bicutanProject },
]

const sourceSize = getCanvasPixels(divisoriaProject.signSize)

export const DIVISORIA_PREVIEW_SIZE = sourceSize
export const DIVISORIA_BACKGROUND = divisoriaProject.canvas.background

export async function loadPremadeFonts(asset) {
  if (typeof document === 'undefined' || !document.fonts) return
  if (asset.id === 'divisoria') {
    await Promise.all([
      document.fonts.load('700 111px "Kawit Extended Italic"'),
      document.fonts.load('700 47px "Quiapo"'),
    ])
    await document.fonts.ready
    cache.clearFontCache('Kawit Extended Italic')
    cache.clearFontCache('Quiapo')
    return
  }
  const fontObjects = asset.project.canvas.objects.filter((object) => typeof object.text === 'string')
  await Promise.all(fontObjects.map((object) =>
    document.fonts.load(`${object.fontWeight || 'normal'} ${Math.round(object.fontSize || 54)}px "${object.fontFamily}"`),
  ))
  await document.fonts.ready
  new Set(fontObjects.map((object) => object.fontFamily)).forEach((family) => cache.clearFontCache(family))
}

export function getPremadeLayout(asset, previewWidth, previewHeight) {
  const size = getCanvasPixels(asset.project.signSize)
  const scale = Math.min(previewWidth / size.width, previewHeight / size.height)
  const offsetX = (previewWidth - size.width * scale) / 2
  const offsetY = (previewHeight - size.height * scale) / 2
  return { scale, offsetX, offsetY }
}

export function getDivisoriaLayout(previewWidth, previewHeight) {
  return getPremadeLayout(PREMADE_ASSETS[0], previewWidth, previewHeight)
}

export async function loadDivisoriaFonts() {
  return loadPremadeFonts(PREMADE_ASSETS[0])
}

export async function createPremadeDesign(asset, previewWidth, previewHeight) {
  const objects = await util.enlivenObjects(asset.project.canvas.objects)
  const { scale, offsetX, offsetY } = getPremadeLayout(asset, previewWidth, previewHeight)

  objects.forEach((object, index) => {
    const saved = asset.project.canvas.objects[index]
    const textScaleX = typeof saved.text === 'string'
      ? saved.width / Math.max(object.width, 1)
      : 1
    const textScaleY = typeof saved.text === 'string'
      ? saved.height / Math.max(object.height, 1)
      : 1

    object.set({
      left: offsetX + object.left * scale,
      top: offsetY + object.top * scale,
      scaleX: saved.scaleX * textScaleX * scale,
      scaleY: saved.scaleY * textScaleY * scale,
    })
    object.setCoords()
  })

  return objects
}

export async function createDivisoriaDesign(previewWidth, previewHeight) {
  return createPremadeDesign(PREMADE_ASSETS[0], previewWidth, previewHeight)
}
