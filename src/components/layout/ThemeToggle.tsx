'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const useDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', useDark)
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    const saved = (localStorage.getItem('cdg-theme') as Theme | null) ?? 'system'
    setTheme(saved)
    applyTheme(saved)
  }, [])

  function nextTheme() {
    const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
    localStorage.setItem('cdg-theme', next)
    applyTheme(next)
  }

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const label = theme === 'light' ? 'Tema claro' : theme === 'dark' ? 'Tema escuro' : 'Tema do sistema'

  return (
    <button
      type="button"
      onClick={nextTheme}
      title={label}
      className="p-2 text-gray-500 hover:text-cdg-blue hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"
    >
      <Icon className="w-5 h-5" />
    </button>
  )
}
