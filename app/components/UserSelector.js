'use client'

import { useState } from 'react'
import { useUser } from '../contexts/UserContext'
import { 
  Building2,
  Plus, 
  Check, 
  ChevronDown,
  X
} from 'lucide-react'

export default function UserSelector() {
  const { 
    currentUser, 
    currentPortfolio, 
    selectPortfolio, 
    createPortfolio 
  } = useUser()
  
  const [showPortfolioDropdown, setShowPortfolioDropdown] = useState(false)
  const [showPortfolioForm, setShowPortfolioForm] = useState(false)
  
  const [portfolioForm, setPortfolioForm] = useState({
    portfolioId: '',
    portfolioName: ''
  })

  const handlePortfolioSubmit = async (e) => {
    e.preventDefault()
    try {
      await createPortfolio(portfolioForm)
      setShowPortfolioForm(false)
      setPortfolioForm({ portfolioId: '', portfolioName: '' })
    } catch (error) {
      alert(`Error creating portfolio: ${error.message}`)
    }
  }

  if (!currentUser) {
    return (
      <div className="flex items-center space-x-2 text-gray-500">
        <Building2 className="w-4 h-4" />
        <span>Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-4">
      {/* Portfolio Selector */}
      {currentUser.portfolios && currentUser.portfolios.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowPortfolioDropdown(!showPortfolioDropdown)}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <Building2 className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700">
              {currentPortfolio?.portfolioId || 'Select Portfolio'}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {showPortfolioDropdown && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowPortfolioDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 mb-2">SELECT PORTFOLIO</div>
                  {currentUser.portfolios.map((portfolio) => (
                    <button
                      key={portfolio.portfolioId}
                      onClick={() => {
                        selectPortfolio(portfolio.portfolioId)
                        setShowPortfolioDropdown(false)
                      }}
                      className={`w-full flex items-center justify-between p-2 text-left rounded hover:bg-gray-50 ${
                        currentPortfolio?.portfolioId === portfolio.portfolioId ? 'bg-green-50 text-green-700' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4" />
                        <div>
                          <div className="text-sm font-medium">{portfolio.portfolioId}</div>
                          <div className="text-xs text-gray-500">
                            {portfolio.portfolioName} • {portfolio.assetCount} assets
                          </div>
                        </div>
                      </div>
                      {currentPortfolio?.portfolioId === portfolio.portfolioId && (
                        <Check className="w-4 h-4 text-green-600" />
                      )}
                    </button>
                  ))}
                  
                  <div className="border-t border-gray-200 mt-2 pt-2">
                    <button
                      onClick={() => {
                        setShowPortfolioForm(true)
                        setShowPortfolioDropdown(false)
                      }}
                      className="w-full flex items-center space-x-2 p-2 text-sm text-green-600 hover:bg-green-50 rounded"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Portfolio</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Portfolio Creation Form */}
      {showPortfolioForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Portfolio</h3>
              <button
                onClick={() => setShowPortfolioForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handlePortfolioSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio ID</label>
                <input
                  type="text"
                  value={portfolioForm.portfolioId}
                  onChange={(e) => setPortfolioForm({...portfolioForm, portfolioId: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="e.g. zebre"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio Name</label>
                <input
                  type="text"
                  value={portfolioForm.portfolioName}
                  onChange={(e) => setPortfolioForm({...portfolioForm, portfolioName: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="e.g. ZEBRE Portfolio"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPortfolioForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Create Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}