export const SIGN_PRESETS = {
  front: {
    id: 'front',
    name: 'Front Sign',
    widthCm: 120,
    heightCm: 30,
  },
  side: {
    id: 'side',
    name: 'Side Sign',
    widthCm: 150,
    heightCm: 30,
  },
  rear: {
    id: 'rear',
    name: 'Rear Sign',
    widthCm: 100,
    heightCm: 30,
  },
}

export function getCanvasPixels(signSize) {
  const widthCm = Math.max(Number(signSize.widthCm) || 120, 20)
  const heightCm = Math.max(Number(signSize.heightCm) || 30, 10)
  const aspectRatio = widthCm / heightCm
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
