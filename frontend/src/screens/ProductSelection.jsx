import { useState } from 'react'
import Button from '../components/Button'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}


function ProductIcon() {
  return (
    <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    </div>
  )
}

export default function ProductSelection({ orderData, onBack, onNext }) {
  const { order, eligible, days_since_order, return_window_days, products } = orderData

  const [checked, setChecked] = useState({})   // line_item_id -> bool
  const [quantities, setQuantities] = useState({})  // line_item_id -> number
  const [submitError, setSubmitError] = useState(null)

  const toggleItem = (item) => {
    const id = item.line_item_id
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      if (next[id] && !quantities[id]) {
        setQuantities((q) => ({ ...q, [id]: 1 }))
      }
      return next
    })
    setSubmitError(null)
  }

  const setQty = (id, val, max) => {
    const n = Math.max(1, Math.min(max, Number(val) || 1))
    setQuantities((prev) => ({ ...prev, [id]: n }))
  }

  const allSelected = products.length > 0 && products.every((p) => checked[p.line_item_id])

  const handleSelectAll = () => {
    if (allSelected) {
      setChecked({})
    } else {
      const next = {}
      const nextQty = { ...quantities }
      products.forEach((p) => {
        next[p.line_item_id] = true
        if (!nextQty[p.line_item_id]) nextQty[p.line_item_id] = 1
      })
      setChecked(next)
      setQuantities(nextQty)
    }
  }

  const handleContinue = () => {
    const selected = products.filter((p) => checked[p.line_item_id])
    if (selected.length === 0) {
      setSubmitError('Select at least one item to return.')
      return
    }
    const items = selected.map((p) => ({
      ...p,
      returnQty: quantities[p.line_item_id] ?? 1,
    }))
    onNext(items)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Order header */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 mb-2 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Verified Order
            </div>
            <h1 className="text-xl font-semibold text-gray-900">{order.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDate(order.created_at)}
              {order.email && <> &bull; {order.email}</>}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">Day {days_since_order} of {return_window_days}-day window</p>
          </div>
        </div>

        {/* Ineligibility banner */}
        {!eligible && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">Outside Return Window</p>
              <p className="text-sm text-red-600 mt-0.5">
                This order was placed {days_since_order} days ago. The return window for this store is {return_window_days} days.
                Returns can no longer be initiated for this order.
              </p>
            </div>
          </div>
        )}
      </div>

      {eligible && (
        <>
          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Select Items</h2>
              <p className="text-sm text-gray-500">Choose the products you wish to return.</p>
            </div>
            {products.length > 1 && (
              <button
                onClick={handleSelectAll}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {/* Product list */}
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 bg-white">
            {products.map((product) => {
              const isChecked = !!checked[product.line_item_id]
              const qty = quantities[product.line_item_id] ?? 1
              return (
                <div
                  key={product.line_item_id}
                  className={`flex items-start gap-4 p-4 transition-colors ${isChecked ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                >
                  {/* Checkbox */}
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      id={`item-${product.line_item_id}`}
                      checked={isChecked}
                      onChange={() => toggleItem(product)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
                    />
                  </div>

                  <ProductIcon />

                  <label
                    htmlFor={`item-${product.line_item_id}`}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <p className="text-sm font-medium text-gray-900 leading-snug">{product.title}</p>
                    {product.variant_title && (
                      <p className="text-xs text-gray-500 mt-0.5">{product.variant_title}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Ordered: {product.quantity} unit{product.quantity !== 1 ? 's' : ''}
                    </p>
                  </label>

                  {/* Quantity controls */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {isChecked && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400 mr-1">Return qty:</span>
                        <button
                          onClick={() => setQty(product.line_item_id, qty - 1, product.quantity)}
                          className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors text-sm"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-medium text-gray-900">
                          {qty}
                        </span>
                        <button
                          onClick={() => setQty(product.line_item_id, qty + 1, product.quantity)}
                          className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors text-sm"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-3 text-xs text-gray-400">
            The quantity shown above is what was originally ordered and will not be changed by this request.
          </p>

          {submitError && (
            <p className="mt-3 text-sm text-red-600 font-medium">{submitError}</p>
          )}
        </>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
        <Button variant="secondary" onClick={onBack}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Back to Order
        </Button>
        {eligible && (
          <Button onClick={handleContinue}>
            Continue to Reasons
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  )
}
