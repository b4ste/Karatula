export function restoreSavedTextSize(objects, savedObjects = []) {
  objects.forEach((object, index) => {
    const saved = savedObjects[index]
    if (!saved) return

    if (typeof object.text === 'string' && saved.autoFitText === false) {
      const savedWidth = Number(saved.width) * Number(saved.scaleX)
      const savedHeight = Number(saved.height) * Number(saved.scaleY)

      if (Number.isFinite(savedWidth) && savedWidth > 0 && object.width > 0) {
        object.set('scaleX', savedWidth / object.width)
      }
      if (Number.isFinite(savedHeight) && savedHeight > 0 && object.height > 0) {
        object.set('scaleY', savedHeight / object.height)
      }
      object.setCoords()
    }

    if (Array.isArray(saved.objects) && typeof object.getObjects === 'function') {
      restoreSavedTextSize(object.getObjects(), saved.objects)
    }
  })
}
