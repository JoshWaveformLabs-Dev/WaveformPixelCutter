import logo from '../assets/Logo.png'

type HeaderProps = {
  onExport: () => void
  exportDisabled: boolean
}

export default function Header({ onExport, exportDisabled }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <img className="app-logo" src={logo} alt="WaveformOS logo" />
        <div className="app-title">
          <h1>WaveformOS Pixel Cutter</h1>
          <p>Deterministic UI image cropping for WaveformOS themes</p>
        </div>
      </div>
      <div className="app-header-actions">
        <button className="button button-subtle" type="button">
          Help
        </button>
        <button
          className="button button-primary"
          type="button"
          onClick={onExport}
          disabled={exportDisabled}
        >
          Export
        </button>
      </div>
    </header>
  )
}
