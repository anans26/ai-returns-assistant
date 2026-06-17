export default function Input({ label, id, error, hint, prefixIcon, className = '', ...props }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {prefixIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            {prefixIcon}
          </div>
        )}
        <input
          id={id}
          {...props}
          className={[
            'block w-full rounded-lg border text-sm py-2.5 pr-3',
            prefixIcon ? 'pl-9' : 'pl-3',
            'placeholder-gray-400 text-gray-900',
            'transition focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-red-300 bg-red-50 focus:ring-red-400 focus:border-red-400'
              : 'border-gray-300 bg-white focus:ring-brand-500 focus:border-brand-500',
          ].join(' ')}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}
