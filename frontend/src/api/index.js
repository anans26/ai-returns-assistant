const BASE = '/api'

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || `Server error (${res.status})`)
  }
  return data
}

export async function verifyOrder(orderId, email) {
  const res = await fetch(`${BASE}/verify-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, email }),
  })
  return handleResponse(res)
}

export async function getRules() {
  const res = await fetch(`${BASE}/rules`)
  return handleResponse(res)
}

export async function submitReturn(payload) {
  const res = await fetch(`${BASE}/submit-return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function uploadImage(returnId, file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/upload-image/${returnId}`, {
    method: 'POST',
    body: form,
  })
  return handleResponse(res)
}
