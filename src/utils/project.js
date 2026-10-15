export function validateProject(value) {
  if (!value || !value.canvas || !Array.isArray(value.canvas.objects)) {
    throw new Error('Choose a KARATULA project JSON file.')
  }
  if (value.formatVersion && value.formatVersion !== 1) {
    throw new Error('This project version is not supported.')
  }
  const { widthPx, heightPx } = value.signSize || {}
  if (![widthPx, heightPx].every((n) => Number.isInteger(n) && n <= 16000) || widthPx < 20 || heightPx < 10 || widthPx * heightPx > 32000000) {
    throw new Error('Project dimensions must be 20–16,000 pixels, up to 32 megapixels.')
  }
  return value
}

export function downloadProject(project) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'karatula-project.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
