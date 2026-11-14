import { Point } from 'fabric'

function selectionYBounds(object, dimensionHeight) {
  const bounds = object.__textInkBounds
  if (!bounds || !object.height) return null

  const padding = object.padding || 0
  const scale = (dimensionHeight - padding * 2) / object.height
  return {
    top: bounds.top * scale - padding,
    bottom: bounds.bottom * scale + padding,
  }
}

export function measureTextInkBounds(object, context) {
  if (
    !object.text || object.path || !object.height ||
    Object.keys(object.styles || {}).length
  ) return null

  context.font = `${object.fontStyle || 'normal'} ${object.fontWeight || '400'} ${object.fontSize}px "${object.fontFamily}"`
  const lines = object._textLines?.map((line) => line.join('')) || object.text.split('\n')
  let lineTop = -object.height / 2
  let top = Infinity
  let bottom = -Infinity

  lines.forEach((line, index) => {
    const lineHeight = object.getHeightOfLineImpl(index)
    const baseline = lineTop + lineHeight * (1 - object._fontSizeFraction)
    const metrics = context.measureText(line)
    if (line.trim() && Number.isFinite(metrics.actualBoundingBoxAscent) && Number.isFinite(metrics.actualBoundingBoxDescent)) {
      top = Math.min(top, baseline - metrics.actualBoundingBoxAscent)
      bottom = Math.max(bottom, baseline + metrics.actualBoundingBoxDescent)
    }
    lineTop += object.getHeightOfLine(index)
  })

  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) return null
  const margin = Math.max(3, (object.strokeWidth || 0) / 2 + 2)
  return { top: top - margin, bottom: bottom + margin }
}

export function tightenTextSelection(object, context) {
  if (typeof object.text !== 'string') return
  object.__textInkBounds = measureTextInkBounds(object, context)
  if (object.__tightTextSelectionInstalled) {
    object.setCoords()
    return
  }

  object.__tightTextSelectionInstalled = true
  const originalDrawBorders = object.drawBorders
  object.drawBorders = function drawTightTextBorders(ctx, options, styleOverride) {
    if (!this.__textInkBounds || this.group || styleOverride?.forActiveSelection) {
      return originalDrawBorders.call(this, ctx, options, styleOverride)
    }

    const size = this._calculateCurrentDimensions().scalarAdd(this.borderScaleFactor)
    const bounds = selectionYBounds(this, size.y - this.borderScaleFactor)
    const tightSize = new Point(size.x, bounds.bottom - bounds.top + this.borderScaleFactor)
    ctx.save()
    ctx.translate(0, (bounds.top + bounds.bottom) / 2)
    this._drawBorders(ctx, tightSize, styleOverride)
    ctx.restore()
  }

  Object.values(object.controls).forEach((control) => {
    const originalPositionHandler = control.positionHandler
    control.positionHandler = function tightTextControlPosition(dim, matrix, target, currentControl) {
      const bounds = selectionYBounds(target, dim.y)
      if (!bounds) return originalPositionHandler.call(this, dim, matrix, target, currentControl)

      const y = this.y < 0 ? bounds.top : this.y > 0 ? bounds.bottom : (bounds.top + bounds.bottom) / 2
      return new Point(this.x * dim.x + this.offsetX, y + this.offsetY).transform(matrix)
    }
  })

  object.setCoords()
}
