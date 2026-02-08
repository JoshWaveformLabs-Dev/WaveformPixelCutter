type ToggleProps = {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

export default function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: ToggleProps) {
  return (
    <div className="toggle">
      <button
        type="button"
        className={`toggle-switch ${checked ? 'is-on' : 'is-off'} ${
          disabled ? 'is-disabled' : ''
        }`}
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          onChange(!checked)
        }}
      >
        <span className="toggle-knob" />
      </button>
      <span className="toggle-label">{label}</span>
    </div>
  )
}
