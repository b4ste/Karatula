import { jsPDF } from 'jspdf'
import { canvasToPrintDataUrl, downloadDataUrl } from './canvasUtils'
import { getSignLabel } from './dimensions'

function filenameFor(signSize, extension) {
  return `${getSignLabel(signSize).toLowerCase().replaceAll(' ', '-')}.${extension}`
}

export function downloadPng(canvas, signSize) {
  downloadDataUrl(canvasToPrintDataUrl(canvas), filenameFor(signSize, 'png'))
}

export function exportPdf(canvas, signSize) {
  const image = canvasToPrintDataUrl(canvas)
  const pdf = new jsPDF({
    orientation: signSize.widthPx >= signSize.heightPx ? 'landscape' : 'portrait',
    unit: 'px',
    format: [signSize.widthPx, signSize.heightPx],
  })

  pdf.addImage(image, 'PNG', 0, 0, signSize.widthPx, signSize.heightPx)
  pdf.save(filenameFor(signSize, 'pdf'))
}

export function printCanvas(canvas, signSize) {
  const image = canvasToPrintDataUrl(canvas)
  const printWindow = window.open('', '_blank', 'width=1100,height=700')

  if (!printWindow) return

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
  printWindow.onload = () => {
    printWindow.print()
  }
}
