function PlaceholderImage() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    </div>
  )
}

export default function ProductCard({ product, selected, returnQty, onToggle, onQtyChange }) {
  const { title, variant_title, quantity, image } = product

  return (
    <button
      type="button"
      onClick={() => onToggle(product)}
      className={[
        'w-full text-left rounded-lg border transition-colors overflow-hidden',
        selected
          ? 'border-brand-500 bg-brand-50'
          : 'border-gray-200 bg-white hover:border-gray-300',
      ].join(' ')}
    >
      {/* Product image */}
      <div className="w-full h-28 overflow-hidden bg-gray-50">
        {image ? (
          <img src={image} alt={title} className="w-full h-full object-cover" />
        ) : (
          <PlaceholderImage />
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">{title}</p>
        {variant_title && (
          <p className="text-xs text-gray-500 mt-0.5">{variant_title}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">Ordered: {quantity}</p>

        {selected && (
          <div
            className="mt-2 flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs text-gray-500">Return:</span>
            <button
              type="button"
              onClick={() => onQtyChange(product, Math.max(1, returnQty - 1))}
              className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100"
            >
              −
            </button>
            <span className="text-xs font-semibold text-gray-900 w-4 text-center">{returnQty}</span>
            <button
              type="button"
              onClick={() => onQtyChange(product, Math.min(quantity, returnQty + 1))}
              className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100"
            >
              +
            </button>
          </div>
        )}
      </div>

      {selected && (
        <div className="mx-3 mb-3">
          <span className="inline-block w-full text-center text-xs font-medium text-brand-700 bg-brand-100 rounded py-1">
            Selected
          </span>
        </div>
      )}
    </button>
  )
}
