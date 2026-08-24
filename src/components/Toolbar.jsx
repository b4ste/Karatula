import {
  Download,
  FileDown,
  Printer,
  Redo2,
  RotateCcw,
  Save,
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
  onRestore,
  onSave,
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
        <button type="button" disabled={!canUndo} title="Undo" onClick={onUndo}>
          <Undo2 size={18} />
        </button>
        <button type="button" disabled={!canRedo} title="Redo" onClick={onRedo}>
          <Redo2 size={18} />
        </button>
        <button type="button" title="Restore saved design" onClick={onRestore}>
          <RotateCcw size={18} />
          Restore
        </button>
        <button type="button" title="Save locally" onClick={onSave}>
          <Save size={18} />
          Save
        </button>
        <button type="button" title="Download PNG" onClick={onExportPng}>
          <Download size={18} />
          PNG
        </button>
        <button type="button" title="Export PDF" onClick={onExportPdf}>
          <FileDown size={18} />
          PDF
        </button>
        <button type="button" title="Print sign" onClick={onPrint}>
          <Printer size={18} />
          Print
        </button>
      </div>
    </header>
  )
}

export default Toolbar
