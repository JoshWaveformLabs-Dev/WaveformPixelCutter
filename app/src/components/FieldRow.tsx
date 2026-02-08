import type { ReactNode } from 'react'

type FieldRowProps = {
  label: string
  children: ReactNode
}

export default function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <div className="field-control">{children}</div>
    </div>
  )
}
