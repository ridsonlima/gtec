'use client'

interface Option { value: string; label: string }

interface Props {
  paramName: string
  value: string
  otherParams: Record<string, string>
  baseHref: string
  options: Option[]
  placeholder: string
  className?: string
}

export function FiltroSelect({ paramName, value, otherParams, baseHref, options, placeholder, className }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const all = { ...otherParams, [paramName]: e.target.value }
    const qs = Object.entries(all).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    window.location.href = `${baseHref}${qs ? '?' + qs : ''}`
  }
  return (
    <select onChange={handleChange} defaultValue={value} className={className}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
