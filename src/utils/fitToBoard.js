export function fitRectangleToBoard(rectangle, boardWidth, boardHeight) {
  const outline = Math.min(
    Math.max(0, Number(rectangle.strokeWidth) || 0),
    boardWidth - 1,
    boardHeight - 1,
  )

  rectangle.set({
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    width: boardWidth - outline,
    height: boardHeight - outline,
    strokeWidth: outline,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    skewX: 0,
    skewY: 0,
    flipX: false,
    flipY: false,
  })
  rectangle.setCoords()
}
