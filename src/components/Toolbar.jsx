import {
  Download,
  FileDown,
  Printer,
  Redo2,
  Settings,
  Undo2,
} from 'lucide-react'

function Toolbar({
  canRedo,
  canUndo,
  message,
  onExportPdf,
  onExportPng,
  onPrint,
  onRedo,
  onSettings,
  onUndo,
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div>
          <strong>KARATULA</strong>
          <small>{message}</small>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          aria-label="Undo"
          type="button"
          disabled={!canUndo}
          title="Undo"
          onClick={onUndo}
        >
          <Undo2 size={18} />
        </button>
        <button
          aria-label="Redo"
          type="button"
          disabled={!canRedo}
          title="Redo"
          onClick={onRedo}
        >
          <Redo2 size={18} />
        </button>
        <button
          aria-label="Download PNG"
          type="button"
          title="Download PNG"
          onClick={onExportPng}
        >
          <Download size={18} />
        </button>
        <button
          aria-label="Export PDF"
          type="button"
          title="Export PDF"
          onClick={onExportPdf}
        >
          <FileDown size={18} />
        </button>
        <button
          aria-label="Print sign"
          type="button"
          title="Print sign"
          onClick={onPrint}
        >
          <Printer size={18} />
        </button>
        <button
          aria-label="Settings"
          type="button"
          title="Settings"
          onClick={onSettings}
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  )
}

export default Toolbar
