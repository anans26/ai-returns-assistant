import Button from '../components/Button'

const TYPE_LABELS = {
  refund: 'Full Refund',
  exchange: 'Exchange',
  store_credit: 'Store Credit',
}

const REASON_LABELS = {
  damaged_product: 'Damaged Product',
  wrong_size: 'Wrong Size',
  wrong_item_received: 'Wrong Item Received',
  changed_mind: 'Changed Mind',
  other: 'Other',
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  )
}

export default function Confirmation({ orderData, selectedItems, returnDetails, onStartNew }) {
  const { return_id, return_type, return_reason, images, uploaded_count } = returnDetails
  const { order } = orderData

  const shortId = return_id ? return_id.split('-')[0].toUpperCase() : '—'

  const imageCount = images?.length ?? 0
  const uploadFailed = imageCount > 0 && uploaded_count < imageCount

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Success header */}
      <div className="flex flex-col items-center text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-brand-50 border-4 border-brand-100 flex items-center justify-center mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-brand-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Return Request Submitted</h1>
        <p className="text-sm text-gray-500 max-w-sm">
          The return process for order{' '}
          <span className="font-medium text-gray-700">{order.name}</span> has been initiated.
          Our team will review this request and follow up with next steps.
        </p>
      </div>

      {/* Important notice */}
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p className="text-sm text-amber-700">
          <span className="font-semibold">This is a request for review, not an automatic approval.</span>
          {' '}No refund, exchange, or order change has been processed. A team member will assess
          your request and contact you within 2–3 business days.
        </p>
      </div>

      {/* Return details card */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Return Details</h2>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
            Requested
          </span>
        </div>

        <SummaryRow label="Reference ID" value={`#${shortId}`} />
        <SummaryRow label="Order" value={order.name} />
        <SummaryRow label="Order Date" value={formatDate(order.created_at)} />

        {/* Items */}
        <div className="py-2.5 border-b border-gray-100">
          <p className="text-sm text-gray-500 mb-2">Item(s) Returning</p>
          {selectedItems.map((item) => (
            <div key={item.line_item_id} className="flex items-center justify-between mb-1 last:mb-0">
              <span className="text-sm font-medium text-gray-900">
                {item.title}
                {item.variant_title && (
                  <span className="font-normal text-gray-500"> – {item.variant_title}</span>
                )}
              </span>
              <span className="text-sm text-gray-600 ml-4 shrink-0">Qty: {item.returnQty}</span>
            </div>
          ))}
        </div>

        <SummaryRow label="Return Type" value={TYPE_LABELS[return_type] ?? return_type} />
        <SummaryRow label="Reason" value={REASON_LABELS[return_reason] ?? return_reason} />

        {imageCount > 0 && (
          <div className="pt-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Images Attached</span>
              <span className="text-sm font-medium text-gray-900">
                {uploaded_count} of {imageCount} uploaded
                {uploadFailed && (
                  <span className="ml-1 text-xs text-amber-600">(some failed)</span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {uploadFailed && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-amber-700">
            {imageCount - uploaded_count} image{imageCount - uploaded_count > 1 ? 's' : ''} failed to upload.
            Your return was still submitted — contact support with reference <span className="font-mono">#{shortId}</span> if you need to add them.
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="flex justify-center pt-2">
        <Button onClick={onStartNew} size="lg">
          Start New Return
        </Button>
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        Keep reference ID <span className="font-mono">#{shortId}</span> for your records.
      </p>
    </div>
  )
}
