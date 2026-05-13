export function CDGLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex items-center h-9 leading-none font-black tracking-tight" aria-label="CDG Engenharia">
        <span className="text-[28px] text-cdg-blue">C</span>
        <span className="text-[28px] text-cdg-gold -ml-1">D</span>
        <span className="text-[28px] text-cdg-blue -ml-1">G</span>
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.38em] text-cdg-blue dark:text-white">ENGENHARIA</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Gestao Tecnica</p>
        </div>
      )}
    </div>
  )
}
