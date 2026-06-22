import type { Config } from 'tailwindcss'

export default <Config>{
  content: [
    './components/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      },
      colors: {
        primary: '#2563eb',
        'primary-light': '#3b82f6',
        bg: '#f8fafc',
        'bg-card': '#ffffff',
        'bg-panel': '#f1f5f9',
        'text-primary': '#1e293b',
        'text-secondary': '#64748b',
        border: '#e2e8f0',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      borderRadius: {
        DEFAULT: '12px',
      },
      boxShadow: {
        DEFAULT: '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06)',
      },
      keyframes: {
        'msg-fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        'pulse-stop': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'msg-fade-in': 'msg-fade-in 0.25s ease-out',
        'cursor-blink': 'cursor-blink 0.8s ease-in-out infinite',
        'pulse-stop': 'pulse-stop 1.2s ease-in-out infinite',
        spin: 'spin 1s linear infinite',
      },
    },
  },
}
