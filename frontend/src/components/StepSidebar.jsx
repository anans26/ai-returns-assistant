const STEPS = [
  { id: 1, label: 'Verify Order' },
  { id: 2, label: 'Select Items' },
  { id: 3, label: 'Return Reason' },
  { id: 4, label: 'Finalize' },
]

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )
}

export default function StepSidebar({ currentStep, onCancel }) {
  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col py-6 px-5">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
          Return Request
        </p>
        <p className="text-xs text-gray-400">
          Workflow Step {currentStep} of {STEPS.length}
        </p>
      </div>

      {/* Steps */}
      <ol className="flex flex-col gap-1">
        {STEPS.map((step, idx) => {
          const isCompleted = currentStep > step.id
          const isActive = currentStep === step.id
          const isPending = currentStep < step.id

          return (
            <li key={step.id} className="flex items-center gap-3 py-2">
              {/* Step indicator */}
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors
                  ${isCompleted ? 'bg-brand-500 text-white' : ''}
                  ${isActive ? 'bg-brand-500 text-white ring-4 ring-brand-100' : ''}
                  ${isPending ? 'border-2 border-gray-200 text-gray-400' : ''}
                `}
              >
                {isCompleted ? <CheckIcon /> : step.id}
              </span>

              {/* Label */}
              <span
                className={`text-sm transition-colors
                  ${isActive ? 'font-semibold text-gray-900' : ''}
                  ${isCompleted ? 'font-medium text-gray-600' : ''}
                  ${isPending ? 'text-gray-400' : ''}
                `}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>

      {/* Cancel */}
      {currentStep < 4 && onCancel && (
        <div className="mt-auto pt-6 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="w-full flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 transition-colors py-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel Request
          </button>
        </div>
      )}
    </aside>
  )
}
