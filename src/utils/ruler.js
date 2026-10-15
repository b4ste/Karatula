export function getRulerScale(size, previewSize, minLabelSpacing) {
  const end = Math.max(Number(size) || 0, 0)
  if (!end) return { marks: [0], step: 1 }

  const pixelsPerUnit = Math.max(Number(previewSize) || 0, 1) / end
  const targetStep = Math.max(1, minLabelSpacing / pixelsPerUnit)
  const magnitude = 10 ** Math.floor(Math.log10(targetStep))
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= targetStep)
  const marks = []

  for (let value = 0; value <= end; value += step) marks.push(value)
  if (marks.at(-1) !== end) {
    if (marks.length > 1 && (end - marks.at(-1)) * pixelsPerUnit < minLabelSpacing) {
      marks[marks.length - 1] = end
    } else {
      marks.push(end)
    }
  }

  return { marks, step }
}
