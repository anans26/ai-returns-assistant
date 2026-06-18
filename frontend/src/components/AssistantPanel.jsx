import { useState, useRef, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import ProductCard from './ProductCard'
import { verifyOrder, submitReturn, uploadImage } from '../api'

// ── constants (mirrors portal validation) ─────────────────────────────────────
const RETURN_TYPES = [
  { value: 'refund', label: 'Refund', description: 'Full payment refund' },
  { value: 'exchange', label: 'Exchange', description: 'Swap for same item' },
  { value: 'store_credit', label: 'Store Credit', description: 'Wallet credit' },
]

const RETURN_REASONS = [
  { value: 'damaged_product', label: 'Damaged Product', requiresImages: true },
  { value: 'wrong_size', label: 'Wrong Size', requiresImages: false },
  { value: 'wrong_item_received', label: 'Wrong Item Received', requiresImages: true },
  { value: 'defective_product', label: 'Defective Product', requiresImages: true },
  { value: 'changed_mind', label: 'Changed Mind', requiresImages: false },
  { value: 'other', label: 'Other', requiresImages: false },
]

const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp']
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_IMAGES = 5

// ── PDF ───────────────────────────────────────────────────────────────────────
function generatePDF({ shortId, orderName, orderEmail, items, returnTypeLabel, returnReasonLabel }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 20
  let y = 20
  const ln = (y0) => doc.line(M, y0, W - M, y0)

  doc.setFillColor(46, 93, 75)
  doc.rect(0, 0, W, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.text('RETURN SHIPPING LABEL', M, 9.5)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal')
  doc.text(`Ref #${shortId}`, W - M, 9.5, { align: 'right' })

  y = 28
  doc.setFillColor(240, 247, 244)
  doc.roundedRect(M, y, W - M * 2, 18, 2, 2, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80)
  doc.text('Reference ID', M + 5, y + 7)
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(46, 93, 75)
  doc.text(`#${shortId}`, M + 5, y + 14)
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80)
  doc.text('Status: Pending Review', W - M - 5, y + 7, { align: 'right' })
  y += 26

  const section = (title) => {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100)
    doc.text(title, M, y); y += 5
    doc.setDrawColor(220, 220, 220); ln(y); y += 6
  }
  const row = (label, value) => {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120); doc.setFontSize(9)
    doc.text(label, M, y)
    doc.setTextColor(30, 30, 30); doc.setFont('helvetica', 'bold')
    doc.text(String(value || ''), M + 45, y); y += 7
  }

  doc.setTextColor(30, 30, 30)
  section('ORDER DETAILS')
  row('Order', orderName)
  if (orderEmail) row('Email', orderEmail)
  row('Return Type', returnTypeLabel)
  row('Reason', returnReasonLabel)
  y += 4

  section('ITEMS RETURNING')
  items.forEach((p) => {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30); doc.setFontSize(9)
    doc.text(p.title || p.product_title || '', M, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100)
    doc.text([p.variant_title, `Qty: ${p.returnQty ?? p.quantity}`].filter(Boolean).join('  ·  '), M, y + 5)
    y += 13
  })
  y += 4

  section('INSTRUCTIONS')
  doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60); doc.setFontSize(9)
  ;['1. Pack item(s) securely in original packaging if available.',
    '2. Attach this label to the outside of the package.',
    '3. Drop off at your nearest courier location.',
    '4. Our team will review and contact you within 2–3 business days.',
  ].forEach((l) => { doc.text(l, M, y); y += 6 })

  doc.setDrawColor(200, 200, 200); ln(275)
  doc.setFontSize(8); doc.setTextColor(160, 160, 160); doc.setFont('helvetica', 'normal')
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}  ·  Keep this label for your records`,
    W / 2, 280, { align: 'center' }
  )
  doc.save(`return-label-${shortId}.pdf`)
}

// ── bubble components ─────────────────────────────────────────────────────────
function AssistantBubble({ text }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed text-gray-800 bg-white border border-gray-200 whitespace-pre-wrap">
        {text}
      </div>
    </div>
  )
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm leading-relaxed text-white bg-brand-500">
        {text}
      </div>
    </div>
  )
}

function LockedWidget({ summary }) {
  return (
    <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-brand-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      <span className="text-xs text-gray-500 truncate">{summary}</span>
    </div>
  )
}

// ── step widgets ──────────────────────────────────────────────────────────────
function OrderVerifyWidget({ prefillOrderId, prefillEmail, onVerified }) {
  const [orderId, setOrderId] = useState(prefillOrderId || '')
  const [email, setEmail] = useState(prefillEmail || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!orderId.trim() || !email.trim()) return
    setError(null); setLoading(true)
    try {
      const data = await verifyOrder(orderId.trim(), email.trim())
      if (!data.verified) setError(data.error || 'Verification failed.')
      else onVerified(data)
    } catch { setError('Unable to reach the server.') }
    finally { setLoading(false) }
  }

  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Order Verification</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input type="text" placeholder="Order ID (e.g. 5678901234567)" value={orderId}
          onChange={(e) => setOrderId(e.target.value)} disabled={loading}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <input type="email" placeholder="Email address" value={email}
          onChange={(e) => setEmail(e.target.value)} disabled={loading}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={!orderId.trim() || !email.trim() || loading}
          className="w-full py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-40">
          {loading ? 'Verifying…' : 'Verify Order'}
        </button>
      </form>
    </div>
  )
}

function ProductSelectionWidget({ products, onConfirm }) {
  const [selected, setSelected] = useState({})
  const [quantities, setQuantities] = useState({})

  const toggle = (p) => {
    const id = p.line_item_id
    setSelected((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      if (next[id] && !quantities[id]) setQuantities((q) => ({ ...q, [id]: 1 }))
      return next
    })
  }
  const setQty = (p, qty) =>
    setQuantities((prev) => ({ ...prev, [p.line_item_id]: Math.max(1, Math.min(p.quantity, qty)) }))

  const hasSelected = Object.values(selected).some(Boolean)

  return (
    <div className="mb-3">
      <div className="grid grid-cols-2 gap-2">
        {products.map((p) => (
          <ProductCard key={p.line_item_id} product={p}
            selected={!!selected[p.line_item_id]}
            returnQty={quantities[p.line_item_id] ?? 1}
            onToggle={toggle}
            onQtyChange={(p, qty) => setQty(p, qty)} />
        ))}
      </div>
      {hasSelected && (
        <button onClick={() => onConfirm(products.filter((p) => selected[p.line_item_id]).map((p) => ({ ...p, returnQty: quantities[p.line_item_id] ?? 1 })))}
          className="mt-2 w-full py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors">
          Continue with Selected Items
        </button>
      )}
    </div>
  )
}

function ReturnTypeWidget({ onSelect }) {
  return (
    <div className="mb-3 flex flex-col gap-2">
      {RETURN_TYPES.map((t) => (
        <button key={t.value} onClick={() => onSelect(t)}
          className="w-full text-left rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-brand-400 hover:bg-brand-50 transition-colors">
          <p className="text-sm font-medium text-gray-900">{t.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>
        </button>
      ))}
    </div>
  )
}

function ReturnReasonWidget({ onSelect }) {
  return (
    <div className="mb-3 flex flex-col gap-2">
      {RETURN_REASONS.map((r) => (
        <button key={r.value} onClick={() => onSelect(r)}
          className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-brand-400 hover:bg-brand-50 transition-colors text-left">
          <span className="text-sm font-medium text-gray-900">{r.label}</span>
          {r.requiresImages && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0 ml-2">photos required</span>
          )}
        </button>
      ))}
    </div>
  )
}

function ImageUploadWidget({ required, onSubmit, onSkip }) {
  const [images, setImages] = useState([])
  const [errors, setErrors] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const addFiles = (fileList) => {
    const files = Array.from(fileList)
    const errs = [], valid = []
    files.forEach((f) => {
      const ext = '.' + f.name.split('.').pop().toLowerCase()
      if (!ALLOWED_EXTS.includes(ext) && !ALLOWED_TYPES.includes(f.type)) errs.push(`"${f.name}" not supported.`)
      else if (f.size > MAX_FILE_SIZE) errs.push(`"${f.name}" exceeds 10 MB.`)
      else if (images.length + valid.length >= MAX_IMAGES) errs.push(`Max ${MAX_IMAGES} images.`)
      else valid.push(f)
    })
    setImages((prev) => [...prev, ...valid])
    setErrors(errs)
  }

  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-white p-4">
      {required
        ? <p className="text-xs text-red-600 font-medium mb-3">Photos are required for this return reason.</p>
        : <p className="text-xs text-gray-500 mb-3">Photos are optional but can help speed up your return.</p>
      }

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
        onClick={() => fileRef.current?.click()}
        className={['rounded-lg border-2 border-dashed p-5 text-center cursor-pointer transition-colors',
          dragOver ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-gray-300'].join(' ')}>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-300 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-xs text-gray-500">Drag & drop or click to browse</p>
        <p className="text-xs text-gray-400">JPG, PNG, WebP · max 10 MB · up to {MAX_IMAGES}</p>
        <input ref={fileRef} type="file" className="hidden"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </div>

      {errors.map((e, i) => <p key={i} className="mt-1 text-xs text-red-600">{e}</p>)}

      {images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((file, idx) => {
            const url = URL.createObjectURL(file)
            return (
              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group">
                <img src={url} alt={file.name} className="w-full h-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
                <button onClick={() => { setImages((p) => p.filter((_, i) => i !== idx)); setErrors([]) }}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {images.length > 0 && (
        <p className="mt-2 text-xs text-green-600 font-medium">✓ {images.length} image{images.length > 1 ? 's' : ''} ready</p>
      )}

      <div className="mt-3 flex gap-2">
        <button onClick={() => onSubmit(images)} disabled={required && images.length === 0}
          className="flex-1 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {images.length > 0 ? `Continue with ${images.length} photo${images.length > 1 ? 's' : ''}` : required ? 'Upload Required' : 'Continue'}
        </button>
        {!required && (
          <button onClick={onSkip} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

function ReviewWidget({ workflow, loading, error, onSubmit, onEdit }) {
  const { selectedProducts, returnType, returnReason, images } = workflow
  const type = RETURN_TYPES.find((t) => t.value === returnType)
  const reason = RETURN_REASONS.find((r) => r.value === returnReason)

  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Review Return</p>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs text-gray-400 mb-2">Item(s)</p>
          {(selectedProducts || []).map((p) => (
            <div key={p.line_item_id} className="flex items-center gap-3 mb-2 last:mb-0">
              <div className="w-10 h-10 rounded bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                {p.image
                  ? <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                  : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.title}</p>
                {p.variant_title && <p className="text-xs text-gray-400">{p.variant_title}</p>}
                <p className="text-xs text-gray-400">Qty: {p.returnQty}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Return Type</span>
            <span className="font-medium text-gray-900">{type?.label}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Reason</span>
            <span className="font-medium text-gray-900">{reason?.label}</span>
          </div>
          {images && images.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Photos</span>
              <span className="font-medium text-gray-900">{images.length} attached</span>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onEdit} disabled={loading}
            className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40">
            Edit Return
          </button>
          <button onClick={onSubmit} disabled={loading}
            className="flex-1 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {loading
              ? <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Submitting…</>
              : 'Submit Return'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ConfirmationWidget({ returnId, orderName, orderEmail, selectedProducts, returnType, returnReason, onStartNew }) {
  const shortId = returnId ? returnId.split('-')[0].toUpperCase() : '—'
  const type = RETURN_TYPES.find((t) => t.value === returnType)
  const reason = RETURN_REASONS.find((r) => r.value === returnReason)

  return (
    <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50 overflow-hidden">
      <div className="bg-brand-500 px-4 py-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-semibold text-white">Return Submitted</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex justify-between"><span className="text-xs text-gray-500">Reference ID</span><span className="text-sm font-mono font-semibold text-gray-900">#{shortId}</span></div>
        <div className="flex justify-between"><span className="text-xs text-gray-500">Order</span><span className="text-sm font-medium text-gray-900">{orderName}</span></div>
        <div className="flex justify-between">
          <span className="text-xs text-gray-500">Status</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Pending Review
          </span>
        </div>

        <div className="pt-2 border-t border-brand-200">
          {(selectedProducts || []).map((p, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5 last:mb-0">
              <div className="w-8 h-8 rounded bg-gray-100 border border-gray-200 shrink-0 overflow-hidden flex items-center justify-center">
                {p.image ? <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                  : <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{p.title}</p>
                {p.variant_title && <p className="text-xs text-gray-400">{p.variant_title}</p>}
              </div>
              <span className="text-xs text-gray-500 ml-auto shrink-0">×{p.returnQty}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => generatePDF({ shortId, orderName, orderEmail, items: selectedProducts, returnTypeLabel: type?.label ?? returnType, returnReasonLabel: reason?.label ?? returnReason })}
          className="w-full py-2 rounded-lg border border-brand-400 text-brand-700 text-sm font-medium hover:bg-brand-100 transition-colors flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Shipping Label (PDF)
        </button>
        <button onClick={onStartNew} className="w-full py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors">
          Start New Return
        </button>
      </div>
    </div>
  )
}

// ── main panel ────────────────────────────────────────────────────────────────
export default function AssistantPanel({ open, onClose, portalContext, onReturnCompleted }) {
  const [messages, setMessages] = useState([])
  // reviewState tracks loading/error for the review widget without remounting it
  const [reviewState, setReviewState] = useState({ loading: false, error: null })
  const workflowRef = useRef({})
  const bottomRef = useRef(null)
  const initialized = useRef(false)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const push = (...items) =>
    setMessages((prev) => [...prev, ...items.map((m, i) => ({ id: Date.now() + i + Math.random(), ...m }))])

  const lockLast = (widgetName, summary) =>
    setMessages((prev) => {
      const copy = [...prev]
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].kind === 'widget' && copy[i].widget === widgetName) {
          copy[i] = { ...copy[i], locked: true, summary }
          break
        }
      }
      return copy
    })

  // ── step handlers ─────────────────────────────────────────────────────────

  const onVerified = (data) => {
    workflowRef.current = { ...workflowRef.current, orderData: data }
    lockLast('order_verify', `Order ${data.order.name} verified`)
    push(
      { kind: 'text', role: 'assistant', text: `I found ${data.order.name}. Which item(s) would you like to return?` },
      { kind: 'widget', widget: 'product_selection', products: data.products }
    )
  }

  const onProductsConfirmed = (selectedProducts) => {
    workflowRef.current = { ...workflowRef.current, selectedProducts }
    const labels = selectedProducts.map((p) => `${p.title} ×${p.returnQty}`).join(', ')
    lockLast('product_selection', labels)
    push(
      { kind: 'text', role: 'user', text: labels },
      { kind: 'text', role: 'assistant', text: 'Choose your return type:' },
      { kind: 'widget', widget: 'return_type' }
    )
  }

  const onReturnTypeSelected = (type) => {
    workflowRef.current = { ...workflowRef.current, returnType: type.value }
    lockLast('return_type', type.label)
    push(
      { kind: 'text', role: 'user', text: `✓ ${type.label}` },
      { kind: 'text', role: 'assistant', text: 'What is the reason for the return?' },
      { kind: 'widget', widget: 'return_reason' }
    )
  }

  const onReturnReasonSelected = (reason) => {
    workflowRef.current = { ...workflowRef.current, returnReason: reason.value }
    lockLast('return_reason', reason.label)
    push({ kind: 'text', role: 'user', text: `✓ ${reason.label}` })
    if (reason.requiresImages) {
      push(
        { kind: 'text', role: 'assistant', text: 'Please upload supporting photos.\nImages are required for this return reason.' },
        { kind: 'widget', widget: 'image_upload', required: true }
      )
    } else {
      push(
        { kind: 'text', role: 'assistant', text: 'Would you like to upload supporting photos?' },
        { kind: 'widget', widget: 'image_upload', required: false }
      )
    }
  }

  const onImagesSubmitted = (images) => {
    workflowRef.current = { ...workflowRef.current, images }
    const summary = images.length > 0 ? `${images.length} photo${images.length > 1 ? 's' : ''} attached` : 'No photos'
    lockLast('image_upload', summary)
    push(
      { kind: 'text', role: 'user', text: images.length > 0 ? `✓ ${images.length} photo${images.length > 1 ? 's' : ''} uploaded` : 'Skipped photos' },
      { kind: 'text', role: 'assistant', text: 'Review your return before submitting:' },
      { kind: 'widget', widget: 'review' }
    )
    setReviewState({ loading: false, error: null })
  }

  const onEditReturn = () => {
    setMessages((prev) => {
      // Slice back to just after the product selection locked widget
      let cutAt = 0
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].kind === 'widget' && prev[i].widget === 'product_selection') {
          cutAt = i + 1; break
        }
      }
      return prev.slice(0, cutAt)
    })
    workflowRef.current = { ...workflowRef.current, returnType: null, returnReason: null, images: [] }
    push(
      { kind: 'text', role: 'assistant', text: "Let's update your return. Choose your return type:" },
      { kind: 'widget', widget: 'return_type' }
    )
  }

  const onSubmitReturn = async () => {
    const { orderData, selectedProducts, returnType, returnReason, images } = workflowRef.current
    setReviewState({ loading: true, error: null })
    try {
      const result = await submitReturn({
        order_id: orderData.order.id,
        order_name: orderData.order.name,
        customer_email: orderData.order.email,
        return_type: returnType,
        return_reason: returnReason,
        items: selectedProducts.map((p) => ({
          line_item_id: p.line_item_id,
          product_id: p.product_id,
          variant_id: p.variant_id,
          product_title: p.title,
          variant_title: p.variant_title ?? null,
          quantity: p.returnQty,
        })),
      })
      const returnId = result.return_id
      for (const file of (images || [])) {
        try { await uploadImage(returnId, file) } catch {}
      }
      lockLast('review', `Return #${returnId.split('-')[0].toUpperCase()} submitted`)
      push(
        { kind: 'text', role: 'assistant', text: "Your return has been submitted. Here's your confirmation:" },
        {
          kind: 'widget', widget: 'confirmation',
          returnId, orderName: orderData.order.name, orderEmail: orderData.order.email,
          selectedProducts, returnType, returnReason,
        }
      )
      setReviewState({ loading: false, error: null })
      onReturnCompleted?.({ return_id: returnId })
    } catch (err) {
      setReviewState({ loading: false, error: err.message || 'Submission failed. Please try again.' })
    }
  }

  const handleStartNew = () => {
    initialized.current = false
    setMessages([])
    workflowRef.current = {}
    setReviewState({ loading: false, error: null })
    setTimeout(() => initWorkflow(), 0)
  }

  // ── init ─────────────────────────────────────────────────────────────────

  const initWorkflow = () => {
    initialized.current = true
    const ctx = portalContext
    if (ctx?.order_data) {
      workflowRef.current = { orderData: ctx.order_data }
      const od = ctx.order_data
      if (ctx.selected_items?.length > 0) {
        workflowRef.current.selectedProducts = ctx.selected_items
        push(
          { kind: 'text', role: 'assistant', text: `Hi! I can see you've verified order ${od.order.name} and selected items. Choose your return type:` },
          { kind: 'widget', widget: 'return_type' }
        )
      } else {
        push(
          { kind: 'text', role: 'assistant', text: `Hi! I can see you've verified order ${od.order.name}. Which item(s) would you like to return?` },
          { kind: 'widget', widget: 'product_selection', products: od.products }
        )
      }
    } else {
      push(
        { kind: 'text', role: 'assistant', text: "Hi! I'm here to help you start a return.\nPlease enter your order details below:" },
        { kind: 'widget', widget: 'order_verify', prefillOrderId: ctx?.order_id, prefillEmail: ctx?.email }
      )
    }
  }

  useEffect(() => {
    if (open && !initialized.current) initWorkflow()
    if (!open) initialized.current = false
  }, [open])

  // ── renderer ──────────────────────────────────────────────────────────────

  const renderMsg = (msg) => {
    if (msg.kind === 'text') {
      return msg.role === 'user' ? <UserBubble key={msg.id} text={msg.text} /> : <AssistantBubble key={msg.id} text={msg.text} />
    }
    if (msg.kind !== 'widget') return null
    if (msg.locked) return <LockedWidget key={msg.id} summary={msg.summary} />

    switch (msg.widget) {
      case 'order_verify':
        return <div key={msg.id}><OrderVerifyWidget prefillOrderId={msg.prefillOrderId} prefillEmail={msg.prefillEmail} onVerified={onVerified} /></div>
      case 'product_selection':
        return <div key={msg.id}><ProductSelectionWidget products={msg.products} onConfirm={onProductsConfirmed} /></div>
      case 'return_type':
        return <div key={msg.id}><ReturnTypeWidget onSelect={onReturnTypeSelected} /></div>
      case 'return_reason':
        return <div key={msg.id}><ReturnReasonWidget onSelect={onReturnReasonSelected} /></div>
      case 'image_upload':
        return <div key={msg.id}><ImageUploadWidget required={msg.required} onSubmit={onImagesSubmitted} onSkip={() => onImagesSubmitted([])} /></div>
      case 'review':
        return <div key={msg.id}><ReviewWidget workflow={workflowRef.current} loading={reviewState.loading} error={reviewState.error} onSubmit={onSubmitReturn} onEdit={onEditReturn} /></div>
      case 'confirmation':
        return <div key={msg.id}><ConfirmationWidget returnId={msg.returnId} orderName={msg.orderName} orderEmail={msg.orderEmail} selectedProducts={msg.selectedProducts} returnType={msg.returnType} returnReason={msg.returnReason} onStartNew={handleStartNew} /></div>
      default:
        return null
    }
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={onClose} />}
      <div className={['fixed top-0 right-0 h-full z-40 bg-white border-l border-gray-200 flex flex-col transition-transform duration-300 ease-in-out w-full lg:w-[440px]',
        open ? 'translate-x-0 shadow-2xl' : 'translate-x-full'].join(' ')}>

        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-none">Returns Assistant</p>
              <p className="text-xs text-gray-400 mt-0.5">Step-by-step guided return</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleStartNew} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">New</button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.map(renderMsg)}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  )
}
