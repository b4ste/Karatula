export function canvasToPrintDataUrl(canvas) {
  return canvas.toDataURL({
    format: 'png',
    multiplier: 3,
    enableRetinaScaling: true,
  })
}

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}
