const ROTATE_CURSOR = `url("${import.meta.env.BASE_URL}rotate-cursor.svg?v=5") 16 16, crosshair`

export function applyRotateCursor(object) {
  if (object?.controls?.mtr) {
    object.controls.mtr.cursorStyle = ROTATE_CURSOR
  }
}
