import { cache, util } from 'fabric'
import divisoriaProject from '../assets/premade/divisoria-city-hall.json' with { type: 'json' }
import { getCanvasPixels } from './dimensions.js'

const sourceSize = getCanvasPixels(divisoriaProject.signSize)

export const DIVISORIA_PREVIEW_SIZE = sourceSize
export const DIVISORIA_BACKGROUND = divisoriaProject.canvas.background

export async function loadDivisoriaFonts() {
  if (typeof document === 'undefined' || !document.fonts) return
  await Promise.all([
    document.fonts.load('700 111px "Kawit Extended Italic"'),
    document.fonts.load('700 47px "Quiapo"'),
  ])
  await document.fonts.ready
  cache.clearFontCache('Kawit Extended Italic')
  cache.clearFontCache('Quiapo')
}

export function getDivisoriaLayout(previewWidth, previewHeight) {
  const scale = Math.min(previewWidth / sourceSize.width, previewHeight / sourceSize.height)
  const offsetX = (previewWidth - sourceSize.width * scale) / 2
  const offsetY = (previewHeight - sourceSize.height * scale) / 2
  return { scale, offsetX, offsetY }
}

export async function createDivisoriaDesign(previewWidth, previewHeight) {
  const objects = await util.enlivenObjects(divisoriaProject.canvas.objects)
  const { scale, offsetX, offsetY } = getDivisoriaLayout(previewWidth, previewHeight)

  objects.forEach((object, index) => {
    const saved = divisoriaProject.canvas.objects[index]
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
