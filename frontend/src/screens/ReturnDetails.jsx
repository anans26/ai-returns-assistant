import { useState, useEffect, useRef } from 'react'
import Button from '../components/Button'
import { getRules, submitReturn, uploadImage } from '../api'

const RETURN_TYPES = [
  {
    value: 'refund',
    label: 'Refund',
    description: 'Full payment refund',
    always: true,
  },
  {
    value: 'exchange',
    label: 'Exchange',
    description: 'Swap for same item',
    rule: 'allow_exchange',
  },
  {
    value: 'store_credit',
    label: 'Store Credit',
    description: 'Wallet credit you can use',
    rule: 'allow_store_credit',
  },
]

const RETURN_REASONS = [
  { value: 'damaged_product', label: 'Damaged Product', requiresImages: true },
  { value: 'wrong_size', label: 'Wrong Size', requiresImages: false },
  { value: 'wrong_item_received', label: 'Wrong Item Received', requiresImages: true },
  { value: 'changed_mind', label: 'Changed Mind', requiresImages: false },
  { value: 'other', label: 'Other', requiresImages: false },
]

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_IMAGES = 5

function validateFile(file, current) {
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  if (!ALLOWED_EXTS.includes(ext) && !ALLOWED_TYPES.includes(file.type)) {
    return `"${file.name}" is not a supported type. Use JPG, JPEG, PNG, or WebP.`
  }
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`
  }
  if (current.length >= MAX_IMAGES) {
    return `Maximum ${MAX_IMAGES} images allowed.`
  }
  return null
}

function ProductIcon() {
  return (
    <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    </div>
  )
}

export default function ReturnDetails({ orderData, selectedItems, onBack, onSubmitted }) {
  const [rules, setRules] = useState({ allow_exchange: true, allow_store_credit: true })
  const [returnType, setReturnType] = useState(null)
  const [returnReason, setReturnReason] = useState(null)
  const [notes, setNotes] = useState('')
  const [images, setImages] = useState([])
  const [imageErrors, setImageErrors] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [validationErrors, setValidationErrors] = useState({})
  const fileInputRef = useRef(null)

  useEffect(() => {
    getRules()
      .then(setRules)
      .catch(() => {})
  }, [])

  const selectedReason = RETURN_REASONS.find((r) => r.value === returnReason)
  const showImages = selectedReason?.requiresImages ?? false

  const availableTypes = RETURN_TYPES.filter(
    (t) => t.always || (rules && rules[t.rule])
  )

  const addFiles = (fileList) => {
    const files = Array.from(fileList)
    const errs = []
    const valid = []
    files.forEach((f) => {
      const err = validateFile(f, [...images, ...valid])
      if (err) {
        errs.push(err)
      } else {
        valid.push(f)
      }
    })
    setImages((prev) => [...prev, ...valid])
    setImageErrors(errs)
  }

  const removeImage = (idx) => {
    setImages((prev) => prev.filter((_, i) => i !== idx))
    setImageErrors([])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(e.dataTransfer.files)
  }

  const validate = () => {
    const errs = {}
    if (!returnType) errs.returnType = 'Select a return type.'
    if (!returnReason) errs.returnReason = 'Select a return reason.'
    if (showImages && images.length === 0) {
      errs.images = 'At least one image is required for this reason.'
    }
    return errs
  }

  const handleSubmit = async () => {
    setError(null)
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs)
      return
    }
    setValidationErrors({})
    setLoading(true)

    try {
      // 1. Create the return
      const payload = {
        order_id: orderData.order.id,
        order_name: orderData.order.name,
        customer_email: orderData.order.email,
        return_type: returnType,
        return_reason: returnReason,
        items: selectedItems.map((item) => ({
          line_item_id: item.line_item_id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_title: item.title,
          variant_title: item.variant_title ?? null,
          quantity: item.returnQty,
        })),
      }

      const result = await submitReturn(payload)
      const returnId = result.return_id

      // 2. Upload images (best-effort)
      let uploadedCount = 0
      for (const file of images) {
        try {
          await uploadImage(returnId, file)
          uploadedCount++
        } catch {
          // continue uploading remaining files even if one fails
        }
      }

      onSubmitted({
        return_id: returnId,
        return_type: returnType,
        return_reason: returnReason,
        notes,
        images,
        uploaded_count: uploadedCount,
      })
    } catch (err) {
      if (err.message.includes('Server error') || err.message.includes('fetch')) {
        setError('Unable to reach the server. Check your connection and try again.')
      } else {
        setError(err.message || 'Failed to submit the return. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Step 3: Return Details</h1>
      <p className="text-sm text-gray-500 mb-8">
        Specify the type of return and the reason, then add any supporting documentation.
      </p>

      {/* Product Details */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Product Details
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {selectedItems.map((item) => (
            <div key={item.line_item_id} className="flex items-center gap-3 p-3">
              <ProductIcon />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                {item.variant_title && (
                  <p className="text-xs text-gray-400">{item.variant_title}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500">Returning {item.returnQty} of {item.quantity}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Return Type */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Return Type
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {availableTypes.map((type) => {
            const selected = returnType === type.value
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => {
                  setReturnType(type.value)
                  setValidationErrors((e) => ({ ...e, returnType: undefined }))
                }}
                className={[
                  'text-left p-4 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1',
                  selected
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 bg-white hover:border-gray-300',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={[
                      'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0',
                      selected ? 'border-brand-500 bg-brand-500' : 'border-gray-300',
                    ].join(' ')}
                  >
                    {selected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                    )}
                  </span>
                  <span className={`text-sm font-medium ${selected ? 'text-brand-700' : 'text-gray-900'}`}>
                    {type.label}
                  </span>
                </div>
                <p className={`text-xs ml-5 ${selected ? 'text-brand-600' : 'text-gray-400'}`}>
                  {type.description}
                </p>
              </button>
            )
          })}
        </div>
        {validationErrors.returnType && (
          <p className="mt-2 text-xs text-red-600">{validationErrors.returnType}</p>
        )}
      </section>

      {/* Return Reason */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Reason for Return
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {RETURN_REASONS.map((reason) => {
            const selected = returnReason === reason.value
            return (
              <label
                key={reason.value}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="radio"
                  name="return-reason"
                  value={reason.value}
                  checked={selected}
                  onChange={() => {
                    setReturnReason(reason.value)
                    setImages([])
                    setImageErrors([])
                    setValidationErrors((e) => ({ ...e, returnReason: undefined, images: undefined }))
                  }}
                  className="w-4 h-4 border-gray-300 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-800">{reason.label}</span>
                {reason.requiresImages && (
                  <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    photos required
                  </span>
                )}
              </label>
            )
          })}
        </div>
        {validationErrors.returnReason && (
          <p className="mt-2 text-xs text-red-600">{validationErrors.returnReason}</p>
        )}
      </section>

      {/* Additional Notes */}
      <section className="mb-6">
        <label htmlFor="notes" className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Additional Details <span className="font-normal normal-case tracking-normal text-gray-400">(Optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional details about the return..."
          rows={3}
          className="block w-full rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
        />
      </section>

      {/* Image Upload (conditional) */}
      {showImages && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Visual Documentation
          </h2>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={[
              'rounded-lg border-2 border-dashed p-8 text-center transition-colors',
              dragOver ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-gray-50',
            ].join(' ')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-600 mb-1">Drag &amp; drop item photos</p>
            <p className="text-xs text-gray-400 mb-4">
              Up to {MAX_IMAGES} images of the item and its packaging. (Max 10 MB each) · JPG, PNG, WebP
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Browse Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
            />
          </div>

          {/* File errors */}
          {imageErrors.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {imageErrors.map((err, i) => (
                <p key={i} className="text-xs text-red-600">{err}</p>
              ))}
            </div>
          )}

          {/* Thumbnails */}
          {images.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {images.map((file, idx) => {
                const url = URL.createObjectURL(file)
                return (
                  <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group">
                    <img
                      src={url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      onLoad={() => URL.revokeObjectURL(url)}
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Remove ${file.name}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )
              })}

              {images.length < MAX_IMAGES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
                  type="button"
                  aria-label="Add more images"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {validationErrors.images && (
            <p className="mt-2 text-xs text-red-600">{validationErrors.images}</p>
          )}
        </section>
      )}

      {/* Submission error */}
      {error && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
        <Button variant="secondary" onClick={onBack} disabled={loading}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          Back to Items
        </Button>
        <Button loading={loading} onClick={handleSubmit}>
          {loading ? 'Submitting…' : 'Continue to Review'}
          {!loading && (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          )}
        </Button>
      </div>
    </div>
  )
}
