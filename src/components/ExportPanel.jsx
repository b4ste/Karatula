import { Download, FileDown, Printer } from 'lucide-react'

function ExportPanel({ onExportPdf, onExportPng, onExportJpeg, onPrint }) {
  return (
    <div className="export-panel">
      <button type="button" onClick={onExportPng}>
        <Download size={18} />
        PNG
      </button>
      <button type="button" onClick={onExportJpeg}>
        <Download size={18} />
        JPG
      </button>
      <button type="button" onClick={onExportPdf}>
        <FileDown size={18} />
        PDF
      </button>
      <button type="button" onClick={onPrint}>
        <Printer size={18} />
        Print
      </button>
    </div>
  )
}

export default ExportPanel
