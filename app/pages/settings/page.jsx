'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/app/contexts/UserContext'
import { useSaveContext } from '@/app/layout'
import { 
  Building2,
  Settings as SettingsIcon,
  Trash2,
  Edit3,
  Plus,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Zap,
  Calculator,
  TrendingUp,
  BarChart3,
  RefreshCw
} from 'lucide-react'
import { 
  DEFAULT_CAPEX_RATES,
  DEFAULT_OPEX_RATES,
  DEFAULT_PROJECT_FINANCE,
  DEFAULT_PLATFORM_COSTS,
  DEFAULT_DISCOUNT_RATES,
  DEFAULT_RISK_PARAMETERS,
  DEFAULT_PRICE_SETTINGS,
  DEFAULT_ASSET_PERFORMANCE,
  DEFAULT_TERMINAL_RATES
} from '@/lib/default_constants'

export default function SettingsPage() {
  const { currentUser, currentPortfolio, refreshUserPortfolios } = useUser()
  const { setHasUnsavedChanges, setSaveFunction } = useSaveContext()
  
  // State management
  const [portfolios, setPortfolios] = useState([])
  const [constants, setConstants] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('portfolios')
  
  // Portfolio management state
  const [editingPortfolio, setEditingPortfolio] = useState(null)
  const [deletingPortfolio, setDeletingPortfolio] = useState(null)
  const [editForm, setEditForm] = useState({ portfolioName: '' })
  
  // Constants state
  const [editingConstants, setEditingConstants] = useState(false)
  const [constantsForm, setConstantsForm] = useState({})

  // Load data on mount
  useEffect(() => {
    if (currentUser) {
      loadSettingsData()
    }
  }, [currentUser])

  // Set up save function
  useEffect(() => {
    setSaveFunction(() => saveAllChanges)
    return () => setSaveFunction(null)
  }, [setSaveFunction, constants, constantsForm])

  const loadSettingsData = async () => {
    if (!currentUser) return
    
    setLoading(true)
    try {
      // Load user portfolios
      const userResponse = await fetch(`/api/users?userId=${currentUser.id}`)
      if (userResponse.ok) {
        const userData = await userResponse.json()
        setPortfolios(userData.portfolios || [])
      }

      // Load constants from current portfolio or defaults
      if (currentPortfolio) {
        const portfolioResponse = await fetch(
          `/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`
        )
        if (portfolioResponse.ok) {
          const portfolioData = await portfolioResponse.json()
          const loadedConstants = portfolioData.constants || {}
          setConstants(loadedConstants)
          setConstantsForm(initializeConstantsForm(loadedConstants))
        }
      } else {
        // Initialize with defaults if no portfolio
        const defaultConstants = {}
        setConstants(defaultConstants)
        setConstantsForm(initializeConstantsForm(defaultConstants))
      }
    } catch (error) {
      console.error('Error loading settings data:', error)
    } finally {
      setLoading(false)
    }
  }

  const initializeConstantsForm = (loadedConstants) => {
    return {
      // CAPEX rates
      capex_solar: loadedConstants.capex_solar || DEFAULT_CAPEX_RATES.solar,
      capex_wind: loadedConstants.capex_wind || DEFAULT_CAPEX_RATES.wind,
      capex_storage: loadedConstants.capex_storage || DEFAULT_CAPEX_RATES.storage,
      
      // OPEX rates
      opex_solar: loadedConstants.opex_solar || DEFAULT_OPEX_RATES.solar,
      opex_wind: loadedConstants.opex_wind || DEFAULT_OPEX_RATES.wind,
      opex_storage: loadedConstants.opex_storage || DEFAULT_OPEX_RATES.storage,
      
      // Project finance
      maxGearing: loadedConstants.maxGearing || DEFAULT_PROJECT_FINANCE.maxGearing,
      targetDSCRContract: loadedConstants.targetDSCRContract || DEFAULT_PROJECT_FINANCE.targetDSCRContract,
      targetDSCRMerchant: loadedConstants.targetDSCRMerchant || DEFAULT_PROJECT_FINANCE.targetDSCRMerchant,
      interestRate: loadedConstants.interestRate || DEFAULT_PROJECT_FINANCE.interestRate,
      
      // Platform costs
      platformOpex: loadedConstants.platformOpex || DEFAULT_PLATFORM_COSTS.platformOpex,
      dividendPolicy: loadedConstants.dividendPolicy || DEFAULT_PLATFORM_COSTS.dividendPolicy,
      
      // Discount rates
      contractDiscountRate: loadedConstants.contractDiscountRate || DEFAULT_DISCOUNT_RATES.contract,
      merchantDiscountRate: loadedConstants.merchantDiscountRate || DEFAULT_DISCOUNT_RATES.merchant,
      
      // Risk parameters
      volumeVariation: loadedConstants.volumeVariation || DEFAULT_RISK_PARAMETERS.volumeVariation,
      EnergyPriceVariation: loadedConstants.EnergyPriceVariation || DEFAULT_RISK_PARAMETERS.EnergyPriceVariation,
      greenPriceVariation: loadedConstants.greenPriceVariation || DEFAULT_RISK_PARAMETERS.greenPriceVariation,
      
      // Price settings
      escalation: loadedConstants.escalation || DEFAULT_PRICE_SETTINGS.escalation,
      referenceYear: loadedConstants.referenceYear || DEFAULT_PRICE_SETTINGS.referenceYear,
      
      // Asset performance
      degradation_solar: loadedConstants.degradation_solar || DEFAULT_ASSET_PERFORMANCE.annualDegradation.solar,
      degradation_wind: loadedConstants.degradation_wind || DEFAULT_ASSET_PERFORMANCE.annualDegradation.wind,
      degradation_storage: loadedConstants.degradation_storage || DEFAULT_ASSET_PERFORMANCE.annualDegradation.storage,
      
      // Terminal values
      terminal_solar: loadedConstants.terminal_solar || DEFAULT_TERMINAL_RATES.solar,
      terminal_wind: loadedConstants.terminal_wind || DEFAULT_TERMINAL_RATES.wind,
      terminal_storage: loadedConstants.terminal_storage || DEFAULT_TERMINAL_RATES.storage
    }
  }

  const handlePortfolioEdit = (portfolio) => {
    setEditingPortfolio(portfolio.portfolioId)
    setEditForm({ portfolioName: portfolio.portfolioName })
  }

  const handlePortfolioSave = async (portfolioId) => {
    try {
      setSaving(true)
      
      // Load current portfolio data
      const response = await fetch(
        `/api/portfolio?userId=${currentUser.id}&portfolioId=${portfolioId}`
      )
      
      if (response.ok) {
        const portfolioData = await response.json()
        
        // Update with new name
        const updatedData = {
          ...portfolioData,
          portfolioName: editForm.portfolioName
        }
        
        const updateResponse = await fetch('/api/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        })
        
        if (updateResponse.ok) {
          await refreshUserPortfolios()
          await loadSettingsData()
          setEditingPortfolio(null)
        } else {
          throw new Error('Failed to update portfolio')
        }
      }
    } catch (error) {
      console.error('Error updating portfolio:', error)
      alert('Error updating portfolio: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePortfolioDelete = async (portfolioId) => {
    try {
      setSaving(true)
      
      const response = await fetch(
        `/api/portfolio?userId=${currentUser.id}&portfolioId=${portfolioId}`,
        { method: 'DELETE' }
      )
      
      if (response.ok) {
        await refreshUserPortfolios()
        await loadSettingsData()
        setDeletingPortfolio(null)
      } else {
        throw new Error('Failed to delete portfolio')
      }
    } catch (error) {
      console.error('Error deleting portfolio:', error)
      alert('Error deleting portfolio: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleConstantsChange = (key, value) => {
    setConstantsForm(prev => ({ ...prev, [key]: value }))
    setHasUnsavedChanges(true)
  }

  const resetToDefaults = () => {
    setConstantsForm(initializeConstantsForm({}))
    setHasUnsavedChanges(true)
  }

  const saveAllChanges = async () => {
    if (!currentPortfolio) return
    
    try {
      setSaving(true)
      
      // Load current portfolio data
      const response = await fetch(
        `/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`
      )
      
      if (response.ok) {
        const portfolioData = await response.json()
        
        // Update constants
        const updatedData = {
          ...portfolioData,
          constants: {
            ...portfolioData.constants,
            ...constantsForm
          }
        }
        
        const updateResponse = await fetch('/api/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedData)
        })
        
        if (updateResponse.ok) {
          setConstants(updatedData.constants)
          setHasUnsavedChanges(false)
        } else {
          throw new Error('Failed to save constants')
        }
      }
    } catch (error) {
      console.error('Error saving constants:', error)
      alert('Error saving constants: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <SettingsIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No User Selected</h3>
          <p className="text-gray-600">Please select a user to access settings</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage portfolios and configure default values</p>
        <p className="text-sm text-gray-500">
          User: {currentUser.name} • Current Portfolio: {currentPortfolio?.portfolioId || 'None'}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('portfolios')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'portfolios'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            Portfolio Management
          </button>
          <button
            onClick={() => setActiveTab('constants')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'constants'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calculator className="w-4 h-4 inline mr-2" />
            Default Values
          </button>
        </nav>
      </div>

      {/* Portfolio Management Tab */}
      {activeTab === 'portfolios' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow border">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Portfolio Management</h3>
              <p className="text-sm text-gray-600 mt-1">
                Rename or delete portfolios for {currentUser.name}
              </p>
            </div>
            
            <div className="p-6">
              {portfolios.length > 0 ? (
                <div className="space-y-4">
                  {portfolios.map((portfolio) => (
                    <div key={portfolio.portfolioId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <div>
                          {editingPortfolio === portfolio.portfolioId ? (
                            <input
                              type="text"
                              value={editForm.portfolioName}
                              onChange={(e) => setEditForm({ portfolioName: e.target.value })}
                              className="text-lg font-medium border border-gray-300 rounded px-2 py-1"
                              autoFocus
                            />
                          ) : (
                            <p className="text-lg font-medium text-gray-900">{portfolio.portfolioName}</p>
                          )}
                          <p className="text-sm text-gray-500">
                            ID: {portfolio.portfolioId} • {portfolio.assetCount} assets • 
                            Last updated: {new Date(portfolio.lastUpdated).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {editingPortfolio === portfolio.portfolioId ? (
                          <>
                            <button
                              onClick={() => handlePortfolioSave(portfolio.portfolioId)}
                              disabled={saving}
                              className="p-2 text-green-600 hover:bg-green-100 rounded"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingPortfolio(null)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handlePortfolioEdit(portfolio)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {portfolios.length > 1 && (
                              <button
                                onClick={() => setDeletingPortfolio(portfolio.portfolioId)}
                                className="p-2 text-red-600 hover:bg-red-100 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No portfolios found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Default Values Tab */}
      {activeTab === 'constants' && (
        <div className="space-y-6">
          {/* Constants Header */}
          <div className="bg-white rounded-lg shadow border">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Default Values Configuration</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Configure default constants for portfolio: {currentPortfolio?.portfolioId || 'None selected'}
                  </p>
                </div>
                <button
                  onClick={resetToDefaults}
                  className="flex items-center space-x-2 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Reset to Defaults</span>
                </button>
              </div>
            </div>

            {currentPortfolio ? (
              <div className="p-6 space-y-8">
                {/* CAPEX Rates */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <h4 className="text-lg font-semibold">CAPEX Rates ($M/MW)</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Solar</label>
                      <input
                        type="number"
                        step="0.1"
                        value={constantsForm.capex_solar || ''}
                        onChange={(e) => handleConstantsChange('capex_solar', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_CAPEX_RATES.solar.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Wind</label>
                      <input
                        type="number"
                        step="0.1"
                        value={constantsForm.capex_wind || ''}
                        onChange={(e) => handleConstantsChange('capex_wind', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_CAPEX_RATES.wind.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Storage</label>
                      <input
                        type="number"
                        step="0.1"
                        value={constantsForm.capex_storage || ''}
                        onChange={(e) => handleConstantsChange('capex_storage', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_CAPEX_RATES.storage.toString()}
                      />
                    </div>
                  </div>
                </div>

                {/* OPEX Rates */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Zap className="w-5 h-5 text-blue-600" />
                    <h4 className="text-lg font-semibold">OPEX Rates ($M/MW/year)</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Solar</label>
                      <input
                        type="number"
                        step="0.001"
                        value={constantsForm.opex_solar || ''}
                        onChange={(e) => handleConstantsChange('opex_solar', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_OPEX_RATES.solar.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Wind</label>
                      <input
                        type="number"
                        step="0.001"
                        value={constantsForm.opex_wind || ''}
                        onChange={(e) => handleConstantsChange('opex_wind', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_OPEX_RATES.wind.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Storage</label>
                      <input
                        type="number"
                        step="0.001"
                        value={constantsForm.opex_storage || ''}
                        onChange={(e) => handleConstantsChange('opex_storage', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_OPEX_RATES.storage.toString()}
                      />
                    </div>
                  </div>
                </div>

                {/* Project Finance */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Calculator className="w-5 h-5 text-purple-600" />
                    <h4 className="text-lg font-semibold">Project Finance</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Gearing (%)</label>
                      <input
                        type="number"
                        value={constantsForm.maxGearing || ''}
                        onChange={(e) => handleConstantsChange('maxGearing', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_PROJECT_FINANCE.maxGearing.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={constantsForm.interestRate || ''}
                        onChange={(e) => handleConstantsChange('interestRate', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_PROJECT_FINANCE.interestRate.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target DSCR (Contract)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={constantsForm.targetDSCRContract || ''}
                        onChange={(e) => handleConstantsChange('targetDSCRContract', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_PROJECT_FINANCE.targetDSCRContract.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Target DSCR (Merchant)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={constantsForm.targetDSCRMerchant || ''}
                        onChange={(e) => handleConstantsChange('targetDSCRMerchant', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_PROJECT_FINANCE.targetDSCRMerchant.toString()}
                      />
                    </div>
                  </div>
                </div>

                {/* Platform Costs */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-lg font-semibold">Platform Costs</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Platform OPEX ($M/year)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={constantsForm.platformOpex || ''}
                        onChange={(e) => handleConstantsChange('platformOpex', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_PLATFORM_COSTS.platformOpex.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dividend Policy (%)</label>
                      <input
                        type="number"
                        value={constantsForm.dividendPolicy || ''}
                        onChange={(e) => handleConstantsChange('dividendPolicy', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_PLATFORM_COSTS.dividendPolicy.toString()}
                      />
                    </div>
                  </div>
                </div>

                {/* Discount Rates */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    <h4 className="text-lg font-semibold">Discount Rates (%)</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contract Discount Rate</label>
                      <input
                        type="number"
                        step="0.1"
                        value={constantsForm.contractDiscountRate || ''}
                        onChange={(e) => handleConstantsChange('contractDiscountRate', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_DISCOUNT_RATES.contract.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Discount Rate</label>
                      <input
                        type="number"
                        step="0.1"
                        value={constantsForm.merchantDiscountRate || ''}
                        onChange={(e) => handleConstantsChange('merchantDiscountRate', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_DISCOUNT_RATES.merchant.toString()}
                      />
                    </div>
                  </div>
                </div>

                {/* Risk Parameters */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-red-600" />
                    <h4 className="text-lg font-semibold">Risk Parameters (%)</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Volume Variation</label>
                      <input
                        type="number"
                        value={constantsForm.volumeVariation || ''}
                        onChange={(e) => handleConstantsChange('volumeVariation', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_RISK_PARAMETERS.volumeVariation.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Energy Price Variation</label>
                      <input
                        type="number"
                        value={constantsForm.EnergyPriceVariation || ''}
                        onChange={(e) => handleConstantsChange('EnergyPriceVariation', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_RISK_PARAMETERS.EnergyPriceVariation.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Green Price Variation</label>
                      <input
                        type="number"
                        value={constantsForm.greenPriceVariation || ''}
                        onChange={(e) => handleConstantsChange('greenPriceVariation', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_RISK_PARAMETERS.greenPriceVariation.toString()}
                      />
                    </div>
                  </div>
                </div>

                {/* Price Settings */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    <h4 className="text-lg font-semibold">Price Settings</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Escalation (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={constantsForm.escalation || ''}
                        onChange={(e) => handleConstantsChange('escalation', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_PRICE_SETTINGS.escalation.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reference Year</label>
                      <input
                        type="number"
                        value={constantsForm.referenceYear || ''}
                        onChange={(e) => handleConstantsChange('referenceYear', parseInt(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_PRICE_SETTINGS.referenceYear.toString()}
                      />
                    </div>
                  </div>
                </div>

                {/* Asset Performance */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    <h4 className="text-lg font-semibold">Asset Performance</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Solar Degradation (%/year)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={constantsForm.degradation_solar || ''}
                        onChange={(e) => handleConstantsChange('degradation_solar', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_ASSET_PERFORMANCE.annualDegradation.solar.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Wind Degradation (%/year)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={constantsForm.degradation_wind || ''}
                        onChange={(e) => handleConstantsChange('degradation_wind', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_ASSET_PERFORMANCE.annualDegradation.wind.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Storage Degradation (%/year)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={constantsForm.degradation_storage || ''}
                        onChange={(e) => handleConstantsChange('degradation_storage', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_ASSET_PERFORMANCE.annualDegradation.storage.toString()}
                      />
                    </div>
                  </div>
                </div>

                {/* Terminal Values */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <h4 className="text-lg font-semibold">Terminal Values ($M/MW)</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Solar</label>
                      <input
                        type="number"
                        step="0.01"
                        value={constantsForm.terminal_solar || ''}
                        onChange={(e) => handleConstantsChange('terminal_solar', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_TERMINAL_RATES.solar.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Wind</label>
                      <input
                        type="number"
                        step="0.01"
                        value={constantsForm.terminal_wind || ''}
                        onChange={(e) => handleConstantsChange('terminal_wind', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_TERMINAL_RATES.wind.toString()}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Storage</label>
                      <input
                        type="number"
                        step="0.01"
                        value={constantsForm.terminal_storage || ''}
                        onChange={(e) => handleConstantsChange('terminal_storage', parseFloat(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder={DEFAULT_TERMINAL_RATES.storage.toString()}
                      />
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                <Calculator className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Select a portfolio to configure default values</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Portfolio Confirmation Modal */}
      {deletingPortfolio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold">Delete Portfolio</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete portfolio &quot;{portfolios.find(p => p.portfolioId === deletingPortfolio)?.portfolioName}&quot;? 
              This action cannot be undone and will permanently delete all assets and configurations.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingPortfolio(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePortfolioDelete(deletingPortfolio)}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete Portfolio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Summary */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-800 font-medium">
              Settings Page Ready
            </span>
          </div>
          <div className="text-green-600 text-sm">
            {portfolios.length} portfolios • {activeTab === 'constants' ? 'Default values' : 'Portfolio management'} active
          </div>
        </div>
        <div className="mt-2 text-sm text-green-700">
          Use the Portfolio Management tab to rename or delete portfolios. 
          Use the Default Values tab to configure constants that will be used as defaults throughout the application.
          All changes are automatically saved to the current portfolio.
        </div>
      </div>
    </div>
  )
}