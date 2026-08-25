export const SIGN_PRESETS = {
  front: {
    id: 'front',
    name: 'Front Sign',
    widthPx: 120,
    heightPx: 30,
  },
  side: {
    id: 'side',
    name: 'Side Sign',
    widthPx: 150,
    heightPx: 30,
  },
  rear: {
    id: 'rear',
    name: 'Rear Sign',
    widthPx: 100,
    heightPx: 30,
  },
}

export function getCanvasPixels(signSize) {
  const widthPx = Math.max(Number(signSize.widthPx) || 120, 20)
  const heightPx = Math.max(Number(signSize.heightPx) || 30, 10)
  const aspectRatio = widthPx / heightPx
  const width = aspectRatio >= 4.5 ? 940 : 860

  return {
    width,
    height: Math.round(width / aspectRatio),
  }
}

export function getSignLabel(signSize) {
  if (signSize.type === 'fixed') return 'Jeepney Sign'
  if (signSize.type === 'custom') return 'Custom Sign'
  return SIGN_PRESETS[signSize.type]?.name || 'Jeepney Sign'
}
