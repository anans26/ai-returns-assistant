import { useState } from 'react'
import TopNav from './components/TopNav'
import StepSidebar from './components/StepSidebar'
import OrderVerification from './screens/OrderVerification'
import ProductSelection from './screens/ProductSelection'
import ReturnDetails from './screens/ReturnDetails'
import Confirmation from './screens/Confirmation'

export default function App() {
  const [step, setStep] = useState(1)
  // { order: {id, name, email, created_at}, eligible, days_since_order, return_window_days, products: [...] }
  const [orderData, setOrderData] = useState(null)
  // [{ line_item_id, product_id, variant_id, title, variant_title, quantity, price, returnQty }]
  const [selectedItems, setSelectedItems] = useState([])
  // { return_type, return_reason, images: File[], return_id, uploaded_count }
  const [returnDetails, setReturnDetails] = useState(null)

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 min-h-0">
        <StepSidebar currentStep={step} onCancel={step < 4 ? handleCancel : undefined} />
        <main className="flex-1 overflow-auto">
          {step === 1 && (
            <OrderVerification onSuccess={handleOrderVerified} />
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
    </div>
  )
}
