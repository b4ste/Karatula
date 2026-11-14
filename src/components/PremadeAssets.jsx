import { PREMADE_ASSETS } from '../utils/premadeAssets'
import divisoriaPicture from '../assets/premadepic/divisoria.png'
import bicutanPicture from '../assets/premadepic/bicutan.png'
import pasayPicture from '../assets/premadepic/pasayrotonda.png'

const previewPictures = {
  divisoria: divisoriaPicture,
  'sm-bicutan-dost': bicutanPicture,
  'pasay-rotonda': pasayPicture,
}

export default function PremadeAssets({ onClose, onUseAsset }) {
  return <div className="modal-backdrop" role="presentation">
    <div aria-labelledby="premade-assets-title" aria-modal="true"
      className="confirm-modal premade-assets-modal" role="dialog">
      <h2 id="premade-assets-title">Premade Assets</h2>
      <p>Choose a design to place on your sign. You can edit its layers afterward.</p>
      <div className="premade-assets-grid">
        {PREMADE_ASSETS.map((asset) => <button className="premade-asset-card" type="button" onClick={() => onUseAsset(asset)} key={asset.id}>
          <div className="premade-asset-preview"><img src={previewPictures[asset.id]} alt="" /></div>
          <span className="premade-asset-name">{asset.name}</span>
          <small>Fits current board · Replaces layers · Undo available</small>
        </button>)}
      </div>
      <div className="modal-actions">
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>
}
