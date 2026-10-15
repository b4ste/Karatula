import { canvasToPrintDataUrl, downloadDataUrl } from './canvasUtils'
import { getSignLabel } from './dimensions'

function filenameFor(signSize, extension) {
  return `${getSignLabel(signSize).toLowerCase().replaceAll(' ', '-')}.${extension}`
}

export function downloadPng(canvas, signSize) {
  downloadDataUrl(canvasToPrintDataUrl(canvas, signSize), filenameFor(signSize, 'png'))
}

export function downloadJpeg(canvas, signSize) {
  downloadDataUrl(canvasToPrintDataUrl(canvas, signSize, 'image/jpeg', 0.92), filenameFor(signSize, 'jpg'))
}

export async function exportPdf(canvas, signSize) {
  const { jsPDF } = await import('jspdf')
  const image = canvasToPrintDataUrl(canvas, signSize)
  const pdf = new jsPDF({
    orientation: signSize.widthPx >= signSize.heightPx ? 'landscape' : 'portrait',
    unit: 'px',
    hotfixes: ['px_scaling'],
    format: [signSize.widthPx, signSize.heightPx],
  })

  pdf.addImage(image, 'PNG', 0, 0, signSize.widthPx, signSize.heightPx)
  pdf.save(filenameFor(signSize, 'pdf'))
}

export function printCanvas(canvas, signSize) {
  const image = canvasToPrintDataUrl(canvas, signSize)
  const printWindow = window.open('', '_blank', 'width=1100,height=700')

  if (!printWindow) throw new Error('Allow popups to print your sign.')

  printWindow.onload = () => { printWindow.focus(); printWindow.print() }
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Print ${getSignLabel(signSize)}</title>
        <style>
          @page {
            size: ${signSize.widthPx}px ${signSize.heightPx}px;
            margin: 0;
          }

          html,
          body {
            margin: 0;
            min-height: 100%;
            background: white;
          }

          body {
            display: grid;
            place-items: center;
          }

          img {
            width: ${signSize.widthPx}px;
            height: ${signSize.heightPx}px;
            object-fit: contain;
            display: block;
          }
        </style>
      </head>
      <body>
        <img src="${image}" alt="Jeepney sign design" />
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()

}
