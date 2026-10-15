export function getLayerDropIndex(objects, dragged, target, side) {
  if (dragged === target || !objects.includes(dragged) || !objects.includes(target)) return -1
  const displayOrder = [...objects].reverse().filter((object) => object !== dragged)
  const targetPosition = displayOrder.indexOf(target)
  const displayIndex = targetPosition + (side === 'below' ? 1 : 0)
  return objects.length - 1 - displayIndex
}
