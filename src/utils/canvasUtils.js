export function canvasToPrintDataUrl(canvas, signSize, format = 'image/png', quality) {
  const width = Math.round(Number(signSize?.widthPx) || canvas.width)
  const height = Math.round(Number(signSize?.heightPx) || canvas.height)
  if (width < 20 || height < 10 || width > 16000 || height > 16000 || width * height > 32000000) {
    throw new Error('Export size must be 20–16,000 pixels wide, 10–16,000 high, up to 32 megapixels.')
  }
  const rendered = canvas.toCanvasElement(Math.max(width / canvas.width, height / canvas.height))
  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  output.getContext('2d').drawImage(rendered, 0, 0, width, height)
  return output.toDataURL(format, quality)
}

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}
