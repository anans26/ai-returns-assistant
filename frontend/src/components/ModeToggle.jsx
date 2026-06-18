export default function ModeToggle({ mode, onChange }) {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
        <button
          onClick={() => onChange('portal')}
          className={[
            'px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none',
            mode === 'portal'
              ? 'bg-brand-500 text-white'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
          ].join(' ')}
        >
          Portal
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <button
          onClick={() => onChange('assistant')}
          className={[
            'px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none',
            mode === 'assistant'
              ? 'bg-brand-500 text-white'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
          ].join(' ')}
        >
          Assistant
        </button>
      </div>
    </div>
  )
}
