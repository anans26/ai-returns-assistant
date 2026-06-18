import { useState } from 'react'
import TopNav from './components/TopNav'
import StepSidebar from './components/StepSidebar'
import ModeToggle from './components/ModeToggle'
import AssistantPanel from './components/AssistantPanel'
import OrderVerification from './screens/OrderVerification'
import ProductSelection from './screens/ProductSelection'
import ReturnDetails from './screens/ReturnDetails'
import Confirmation from './screens/Confirmation'

export default function App() {
  const [step, setStep] = useState(1)
  const [orderData, setOrderData] = useState(null)
  const [selectedItems, setSelectedItems] = useState([])
  const [returnDetails, setReturnDetails] = useState(null)

  const [mode, setMode] = useState('portal')
  const [assistantOpen, setAssistantOpen] = useState(false)

  // Track partial step-1 inputs so assistant can pre-fill context
  const [portalOrderId, setPortalOrderId] = useState('')
  const [portalEmail, setPortalEmail] = useState('')

  const handleOrderVerified = (data) => {
    setOrderData(data)
    setSelectedItems([])
    setReturnDetails(null)
    setStep(2)
  }

  const handleItemsSelected = (items) => {
    setSelectedItems(items)
    setStep(3)
  }

  const handleReturnSubmitted = (details) => {
    setReturnDetails(details)
    setStep(4)
  }

  const handleCancel = () => {
    setStep(1)
    setOrderData(null)
    setSelectedItems([])
    setReturnDetails(null)
  }

  const handleModeChange = (next) => {
    setMode(next)
    setAssistantOpen(next === 'assistant')
  }

  const handleAssistantClose = () => {
    setAssistantOpen(false)
    setMode('portal')
  }

  // Build shared context object passed into the assistant
  const portalContext = (() => {
    if (orderData) {
      return {
        order_data: orderData,
        selected_items: selectedItems.length > 0 ? selectedItems : undefined,
      }
    }
    if (portalOrderId || portalEmail) {
      return {
        order_id: portalOrderId || undefined,
        email: portalEmail || undefined,
      }
    }
    return null
  })()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 min-h-0">
        <StepSidebar currentStep={step} onCancel={step < 4 ? handleCancel : undefined} />
        <main className="flex-1 overflow-auto">
          {step === 1 && (
            <OrderVerification
              onSuccess={handleOrderVerified}
              onOrderIdChange={setPortalOrderId}
              onEmailChange={setPortalEmail}
            />
          )}
          {step === 2 && orderData && (
            <ProductSelection
              orderData={orderData}
              onBack={() => setStep(1)}
              onNext={handleItemsSelected}
            />
          )}
          {step === 3 && orderData && (
            <ReturnDetails
              orderData={orderData}
              selectedItems={selectedItems}
              onBack={() => setStep(2)}
              onSubmitted={handleReturnSubmitted}
            />
          )}
          {step === 4 && returnDetails && (
            <Confirmation
              orderData={orderData}
              selectedItems={selectedItems}
              returnDetails={returnDetails}
              onStartNew={handleCancel}
            />
          )}
        </main>
      </div>

      {!assistantOpen && <ModeToggle mode={mode} onChange={handleModeChange} />}

      <AssistantPanel
        open={assistantOpen}
        onClose={handleAssistantClose}
        portalContext={portalContext}
        onReturnCompleted={(result) => {
          if (result && orderData) {
            setReturnDetails({
              return_id: result.return_id,
              return_type: 'refund',
              return_reason: 'other',
              images: [],
              uploaded_count: 0,
            })
            setStep(4)
            handleAssistantClose()
          }
        }}
      />
    </div>
  )
}
