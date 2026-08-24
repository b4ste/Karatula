const templates = [
  { id: 'simple', name: 'Simple Route', preview: 'NAIC -> PITX' },
  {
    id: 'cavite',
    name: 'Cavite Route',
    preview: 'NAIC -> DASMARINAS -> BACOOR -> PITX',
  },
  { id: 'destination', name: 'Destination Only', preview: 'PITX' },
  { id: 'two-line', name: 'Two-Line Sign', preview: 'NAIC / PITX' },
]

function TemplatePanel({ onLoadTemplate }) {
  return (
    <section>
      <h2>Templates</h2>
      <div className="template-list">
        {templates.map((template) => (
          <button
            className="template-button"
            key={template.id}
            type="button"
            onClick={() => onLoadTemplate(template.id)}
          >
            <strong>{template.name}</strong>
            <span>{template.preview}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default TemplatePanel
