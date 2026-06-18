import { useState } from 'react'
import Button from '../components/Button'
import Input from '../components/Input'
import { verifyOrder } from '../api'

function validateForm(orderId, email) {
  const errors = {}
  if (!orderId.trim()) {
    errors.orderId = 'Order ID is required.'
  } else if (!/^\d+$/.test(orderId.trim())) {
    errors.orderId = 'Order ID must be numeric (e.g. 5678901234567).'
  }
  if (!email.trim()) {
    errors.email = 'Email address is required.'
  } else if (!email.includes('@') || !email.includes('.')) {
    errors.email = 'Enter a valid email address.'
  }
  return errors
}

export default function OrderVerification({ onSuccess, onOrderIdChange, onEmailChange }) {
  const [orderId, setOrderId] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [networkError, setNetworkError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError(null)
    setNetworkError(null)

    const validationErrors = validateForm(orderId, email)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setLoading(true)

    try {
      const data = await verifyOrder(orderId.trim(), email.trim())
      if (!data.verified) {
        setApiError(data.error || 'Verification failed.')
      } else {
        onSuccess(data)
      }
    } catch (err) {
      setNetworkError(
        'Unable to reach the server. Check your connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-1">
          Start a Return
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          Enter your details to locate your order and begin the verification process.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {/* Network error — distinct from validation errors */}
          {networkError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-amber-700">{networkError}</p>
            </div>
          )}

          {/* API error — verification specific */}
          {apiError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-700">Verification Failed</p>
                <p className="text-sm text-red-600 mt-0.5">{apiError}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <Input
              id="order-id"
              label="Order ID"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 5678901234567"
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value)
                onOrderIdChange?.(e.target.value)
                setErrors((prev) => ({ ...prev, orderId: undefined }))
              }}
              error={errors.orderId}
              prefixIcon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              }
              autoComplete="off"
              disabled={loading}
            />

            <Input
              id="email"
              label="Email Address"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                onEmailChange?.(e.target.value)
                setErrors((prev) => ({ ...prev, email: undefined }))
              }}
              error={errors.email}
              prefixIcon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            loading={loading}
            className="w-full mt-6"
            size="lg"
          >
            Verify Order
            {!loading && (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-5">
          Having trouble?{' '}
          <a href="#" className="text-brand-600 hover:text-brand-700 underline">
            Contact Support
          </a>
        </p>

        {/* Bottom stats strip */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-8">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Fast Process
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Secure
          </div>
        </div>
      </div>
    </div>
  )
}
