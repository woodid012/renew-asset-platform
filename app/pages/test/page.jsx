// app/pages/test/page.jsx
'use client'

import React, { useState, useEffect } from 'react'
import { useUser } from '@/app/contexts/UserContext'
import { 
  Play, 
  Download, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  BarChart3,
  FileText,
  Settings,
  Zap
} from 'lucide-react'

export default function EnhancedBackendTestPage() {
  const { currentUser, currentPortfolio } = useUser()
  
  // Test configuration
  const [testConfig, setTestConfig] = useState({
    intervalType: 'annual',
    startYear: 2025,
    periods: 10,
    includeProjectFinance: true,
    includeSensitivity: true,
    scenario: 'base'
  })
  
  // Test states
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState(null)
  const [error, setError] = useState(null)
  const [testStage, setTestStage] = useState('')
  const [configOptions, setConfigOptions] = useState(null)
  
  // Load configuration options
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadConfigOptions()
    }
  }, [currentUser, currentPortfolio])

  const loadConfigOptions = async () => {
    try {
      const response = await fetch(
        `/api/portfolio-analysis?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`
      )
      
      if (response.ok) {
        const options = await response.json()
        setConfigOptions(options)
        
        // Update test config with smart defaults
        setTestConfig(prev => ({
          ...prev,
          startYear: options.defaultConfig?.startYear || prev.startYear,
          periods: Math.min(prev.periods, 30) // Limit for testing
        }))
      }
    } catch (err) {
      console.error('Failed to load config options:', err)
    }
  }

  const runEnhancedTest = async () => {
    if (!currentUser || !currentPortfolio) {
      setError('No user or portfolio selected')
      return
    }

    setTesting(true)
    setError(null)
    setTestResults(null)
    
    try {
      setTestStage('Validating portfolio data...')
      
      const requestBody = {
        userId: currentUser.id,
        portfolioId: currentPortfolio.portfolioId,
        analysisConfig: testConfig
      }
      
      console.log('Sending enhanced analysis request:', requestBody)
      
      setTestStage('Running enhanced calculations...')
      
      const response = await fetch('/api/portfolio-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      setTestStage('Processing results...')
      
      const results = await response.json()
      console.log('Enhanced analysis results:', results)
      
      setTestResults(results)
      setTestStage('Test completed successfully!')
      
    } catch (err) {
      console.error('Enhanced test failed:', err)
      setError(err.message)
      setTestStage('Test failed')
    } finally {
      setTesting(false)
    }
  }

  const exportResults = () => {
    if (!testResults) return
    
    const dataStr = JSON.stringify(testResults, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `enhanced_analysis_${currentPortfolio?.portfolioId}_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const renderTestResults = () => {
    if (!testResults) return null

    const { metadata, summary, timeSeries, projectFinance, sensitivity, diagnostics } = testResults

    return (
      <div className="space-y-6">
        {/* Test Overview */}
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            Enhanced Analysis Results
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">{metadata.totalAssets}</div>
              <div className="text-sm text-blue-700">Assets Analyzed</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-900">{metadata.timeSeriesLength}</div>
              <div className="text-sm text-green-700">Time Periods</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-900">{metadata.analysisConfig.intervalType}</div>
              <div className="text-sm text-purple-700">Interval Type</div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              <strong>Portfolio:</strong> {metadata.portfolioName} • 
              <strong>Data Version:</strong> {metadata.dataStructureVersion} • 
              <strong>Scenario:</strong> {metadata.analysisConfig.scenario}
            </div>
          </div>
        </div>

        {/* Portfolio Summary */}
        {summary && (
          <div className="bg-white rounded-lg shadow border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 text-blue-500 mr-2" />
              Portfolio Summary
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-xl font-bold text-gray-900">
                  {summary.totalCapacity?.toFixed(0) || 0} MW
                </div>
                <div className="text-sm text-gray-600">Total Capacity</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-xl font-bold text-gray-900">
                  ${summary.averageAnnualRevenue?.toFixed(1) || 0}M
                </div>
                <div className="text-sm text-gray-600">Avg Annual Revenue</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-xl font-bold text-gray-900">
                  ${summary.totalProjectedRevenue?.toFixed(1) || 0}M
                </div>
                <div className="text-sm text-gray-600">Total Projected</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-xl font-bold text-gray-900">
                  {summary.averageContractedPercentage?.toFixed(0) || 0}%
                </div>
                <div className="text-sm text-gray-600">Contracted</div>
              </div>
            </div>
          </div>
        )}

        {/* Time Series Sample */}
        {timeSeries && timeSeries.length > 0 && (
          <div className="bg-white rounded-lg shadow border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Clock className="w-5 h-5 text-green-500 mr-2" />
              Enhanced Time Series Structure (First 5 Periods)
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Period</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-right py-2 px-3">Portfolio Revenue ($M)</th>
                    <th className="text-right py-2 px-3">Total Volume (MWh)</th>
                    <th className="text-right py-2 px-3">Contracted %</th>
                    <th className="text-center py-2 px-3">Assets</th>
                  </tr>
                </thead>
                <tbody>
                  {timeSeries.slice(0, 5).map((period, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">
                        {period.timeDimension.periodLabel}
                      </td>
                      <td className="py-2 px-3 text-gray-600 capitalize">
                        {period.timeDimension.intervalType}
                      </td>
                      <td className="text-right py-2 px-3">
                        {period.portfolio.totalRevenue?.toFixed(2) || '0.00'}
                      </td>
                      <td className="text-right py-2 px-3">
                        {period.portfolio.totalVolume?.toFixed(0) || '0'}
                      </td>
                      <td className="text-right py-2 px-3">
                        {period.portfolio.contractedPercentage?.toFixed(1) || '0.0'}%
                      </td>
                      <td className="text-center py-2 px-3">
                        {Object.keys(period.assets).length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {timeSeries.length > 5 && (
              <div className="text-center mt-3 text-sm text-gray-500">
                ... and {timeSeries.length - 5} more periods
              </div>
            )}
          </div>
        )}

        {/* Asset Detail Sample */}
        {timeSeries && timeSeries.length > 0 && (
          <div className="bg-white rounded-lg shadow border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Zap className="w-5 h-5 text-yellow-500 mr-2" />
              Enhanced Asset Structure (First Asset, First Period)
            </h3>
            
            {(() => {
              const firstPeriod = timeSeries[0]
              const firstAssetName = Object.keys(firstPeriod.assets)[0]
              const firstAsset = firstPeriod.assets[firstAssetName]
              
              if (!firstAsset) return <div className="text-gray-500">No asset data available</div>
              
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Asset Metadata */}
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Asset Metadata</h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>Name:</strong> {firstAsset.assetMetadata.assetName}</div>
                        <div><strong>Type:</strong> {firstAsset.assetMetadata.assetType}</div>
                        <div><strong>Capacity:</strong> {firstAsset.assetMetadata.assetCapacity}MW</div>
                        <div><strong>State:</strong> {firstAsset.assetMetadata.assetState}</div>
                        <div><strong>Start Year:</strong> {firstAsset.assetMetadata.assetStartYear}</div>
                      </div>
                    </div>
                    
                    {/* Volume Data */}
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-900 mb-2">Volume Analysis</h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>Adjusted Volume:</strong> {firstAsset.volume.adjustedVolume?.toFixed(0) || 0} MWh</div>
                        <div><strong>Capacity Factor:</strong> {(firstAsset.volume.capacityFactor * 100)?.toFixed(1) || 0}%</div>
                        <div><strong>Degradation Factor:</strong> {firstAsset.volume.degradationFactor?.toFixed(4) || 1}</div>
                        <div><strong>Volume Efficiency:</strong> {firstAsset.volume.volumeEfficiency?.toFixed(1) || 0}%</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Price Data */}
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <h4 className="font-medium text-yellow-900 mb-2">Price Analysis</h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>Blended Price:</strong> ${firstAsset.prices.blendedPrice?.toFixed(2) || 0}/MWh</div>
                        <div><strong>Merchant Green:</strong> ${firstAsset.prices.merchantGreenPrice?.toFixed(2) || 0}/MWh</div>
                        <div><strong>Merchant Energy:</strong> ${firstAsset.prices.merchantEnergyPrice?.toFixed(2) || 0}/MWh</div>
                      </div>
                    </div>
                    
                    {/* Revenue Data */}
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium text-purple-900 mb-2">Revenue Analysis</h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>Total Revenue:</strong> ${firstAsset.revenue.totalRevenue?.toFixed(2) || 0}M</div>
                        <div><strong>Revenue/MW:</strong> ${firstAsset.revenue.revenuePerMW?.toFixed(2) || 0}M</div>
                        <div><strong>Revenue/MWh:</strong> ${firstAsset.revenue.revenuePerMWh?.toFixed(2) || 0}</div>
                        <div><strong>Contracted Green:</strong> ${firstAsset.revenue.contractedGreenRevenue?.toFixed(2) || 0}M</div>
                        <div><strong>Contracted Energy:</strong> ${firstAsset.revenue.contractedEnergyRevenue?.toFixed(2) || 0}M</div>
                        <div><strong>Merchant Green:</strong> ${firstAsset.revenue.merchantGreenRevenue?.toFixed(2) || 0}M</div>
                        <div><strong>Merchant Energy:</strong> ${firstAsset.revenue.merchantEnergyRevenue?.toFixed(2) || 0}M</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contract Data */}
                  {firstAsset.contracts && firstAsset.contracts.activeContracts.length > 0 && (
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h4 className="font-medium text-orange-900 mb-2">
                        Active Contracts ({firstAsset.contracts.contractCount})
                      </h4>
                      <div className="space-y-2 text-sm">
                        {firstAsset.contracts.activeContracts.slice(0, 3).map((contract, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{contract.counterparty || 'Unknown'} ({contract.type})</span>
                            <span>{contract.buyersPercentage}% • {contract.remainingTerm}y remaining</span>
                          </div>
                        ))}
                        {firstAsset.contracts.activeContracts.length > 3 && (
                          <div className="text-gray-500">
                            ... and {firstAsset.contracts.activeContracts.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Project Finance Results */}
        {projectFinance && (
          <div className="bg-white rounded-lg shadow border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FileText className="w-5 h-5 text-blue-500 mr-2" />
              Project Finance Results
            </h3>
            
            {projectFinance.calculationComplete ? (
              <div className="space-y-6">
                {/* Portfolio Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-xl font-bold text-blue-900">
                      ${projectFinance.summary.totalCapex?.toFixed(1) || 0}M
                    </div>
                    <div className="text-sm text-blue-700">Total CAPEX</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-xl font-bold text-red-900">
                      ${projectFinance.summary.totalDebt?.toFixed(1) || 0}M
                    </div>
                    <div className="text-sm text-red-700">Total Debt</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-900">
                      ${projectFinance.summary.totalEquity?.toFixed(1) || 0}M
                    </div>
                    <div className="text-sm text-green-700">Total Equity</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-xl font-bold text-purple-900">
                      {projectFinance.summary.portfolioIRR?.toFixed(1) || 0}%
                    </div>
                    <div className="text-sm text-purple-700">Portfolio IRR</div>
                  </div>
                </div>

                {/* Asset Finance Summary */}
                {Object.keys(projectFinance.assetFinance).length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Asset Finance Summary</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3">Asset</th>
                            <th className="text-right py-2 px-3">CAPEX ($M)</th>
                            <th className="text-right py-2 px-3">Gearing (%)</th>
                            <th className="text-right py-2 px-3">Debt ($M)</th>
                            <th className="text-right py-2 px-3">Equity IRR (%)</th>
                            <th className="text-right py-2 px-3">Min DSCR</th>
                            <th className="text-center py-2 px-3">Debt Structure</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(projectFinance.assetFinance).map((asset, index) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-3 font-medium">{asset.assetName}</td>
                              <td className="text-right py-2 px-3">{asset.capex?.toFixed(1)}</td>
                              <td className="text-right py-2 px-3">{(asset.gearing * 100)?.toFixed(1)}</td>
                              <td className="text-right py-2 px-3">{asset.debtAmount?.toFixed(1)}</td>
                              <td className="text-right py-2 px-3 font-medium">
                                {asset.equityIRR?.toFixed(1) || 'N/A'}
                              </td>
                              <td className="text-right py-2 px-3">
                                {asset.minDSCR?.toFixed(2) || 'N/A'}x
                              </td>
                              <td className="text-center py-2 px-3 capitalize">
                                {asset.debtStructure}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Portfolio Finance Details */}
                {projectFinance.portfolioFinance && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-3">Portfolio-Level Financing</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-blue-700">Portfolio Gearing:</div>
                        <div className="font-semibold text-blue-900">
                          {(projectFinance.portfolioFinance.gearing * 100)?.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-blue-700">Portfolio IRR:</div>
                        <div className="font-semibold text-blue-900">
                          {projectFinance.portfolioFinance.portfolioIRR?.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-blue-700">Refinance Start:</div>
                        <div className="font-semibold text-blue-900">
                          {projectFinance.portfolioFinance.refinanceStartYear}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sample Asset Detail */}
                {(() => {
                  const firstAsset = Object.values(projectFinance.assetFinance)[0]
                  if (!firstAsset) return null
                  
                  return (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">
                        Sample Asset Detail: {firstAsset.assetName}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600">Construction:</div>
                          <div className="space-y-1">
                            <div>Duration: {firstAsset.constructionDuration} months</div>
                            <div>Equity Timing: {firstAsset.equityTimingUpfront ? 'Upfront' : 'Pro-rata'}</div>
                            <div>Terminal Value: ${firstAsset.terminalValue?.toFixed(1)}M</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Debt Structure:</div>
                          <div className="space-y-1">
                            <div>Tenor: {firstAsset.tenorYears} years</div>
                            <div>Interest Rate: {(firstAsset.interestRate * 100)?.toFixed(1)}%</div>
                            <div>Avg Debt Service: ${firstAsset.avgDebtService?.toFixed(1)}M</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600">Returns:</div>
                          <div className="space-y-1">
                            <div>Equity IRR: {firstAsset.equityIRR?.toFixed(1)}%</div>
                            <div>Project NPV: ${firstAsset.projectNPV?.toFixed(1)}M</div>
                            <div>Payback: {firstAsset.paybackPeriod || 'N/A'} years</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-sm text-yellow-800">
                  {projectFinance.error ? (
                    <div className="flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Project finance calculation failed: {projectFinance.error}
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      Project finance calculations in progress...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sensitivity Results */}
        {sensitivity && (
          <div className="bg-white rounded-lg shadow border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 text-orange-500 mr-2" />
              Sensitivity Analysis Results
            </h3>
            
            {sensitivity.calculationComplete ? (
              <div className="space-y-6">
                {/* Summary */}
                {sensitivity.summary && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="text-xl font-bold text-orange-900">
                        {sensitivity.summary.baseIRR?.toFixed(1)}%
                      </div>
                      <div className="text-sm text-orange-700">Base IRR</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-xl font-bold text-green-900">
                        +{sensitivity.summary.maxUpside?.toFixed(1)}pp
                      </div>
                      <div className="text-sm text-green-700">Max Upside</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-xl font-bold text-red-900">
                        {sensitivity.summary.maxDownside?.toFixed(1)}pp
                      </div>
                      <div className="text-sm text-red-700">Max Downside</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-xl font-bold text-purple-900">
                        {sensitivity.summary.mostSensitiveParameter}
                      </div>
                      <div className="text-sm text-purple-700">Most Sensitive</div>
                    </div>
                  </div>
                )}

                {/* Tornado Chart Data */}
                {sensitivity.tornadoData && sensitivity.tornadoData.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">IRR Sensitivity Tornado</h4>
                    <div className="space-y-3">
                      {sensitivity.tornadoData.map((item, index) => (
                        <div key={index} className="flex items-center">
                          <div className="w-24 text-right pr-4 text-xs font-medium text-gray-700">
                            {item.parameter}
                          </div>
                          
                          <div className="flex-1 relative">
                            <div className="flex items-center justify-center h-full">
                              {/* Left side (downside) */}
                              <div className="flex items-center justify-end" style={{ width: '150px' }}>
                                <span className="text-xs font-medium text-red-600 mr-2">
                                  {item.downside?.toFixed(1)}pp
                                </span>
                                <div 
                                  className="bg-red-500 h-6 rounded-l"
                                  style={{ 
                                    width: `${Math.abs(item.downside || 0) * 3}px`,
                                    maxWidth: '75px'
                                  }}
                                />
                              </div>
                              
                              {/* Right side (upside) */}
                              <div className="flex items-center justify-start" style={{ width: '150px' }}>
                                <div 
                                  className="bg-green-500 h-6 rounded-r"
                                  style={{ 
                                    width: `${Math.abs(item.upside || 0) * 3}px`,
                                    maxWidth: '75px'
                                  }}
                                />
                                <span className="text-xs font-medium text-green-600 ml-2">
                                  +{item.upside?.toFixed(1)}pp
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="w-16 text-center">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              item.impact === 'High' ? 'bg-red-100 text-red-800' :
                              item.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {item.impact}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 flex justify-center space-x-6">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                        <span className="text-xs text-gray-700">Downside Impact</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span className="text-xs text-gray-700">Upside Impact</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scenario Analysis */}
                {sensitivity.scenarios && Object.keys(sensitivity.scenarios).length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Scenario Analysis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {Object.entries(sensitivity.scenarios).map(([key, scenario]) => (
                        <div key={key} className="p-3 border rounded-lg">
                          <div className="font-medium text-gray-900">{scenario.name}</div>
                          <div className="text-lg font-bold text-blue-600">
                            {scenario.irr?.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-600">{scenario.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="text-sm text-orange-800">
                  {sensitivity.error ? (
                    <div className="flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Sensitivity analysis failed: {sensitivity.error}
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      Sensitivity analysis in progress...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Diagnostics */}
        {diagnostics && (
          <div className="bg-white rounded-lg shadow border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Settings className="w-5 h-5 text-gray-500 mr-2" />
              Performance Diagnostics
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Memory Usage</div>
                <div className="text-lg font-bold text-gray-900">
                  {(diagnostics.memoryUsage?.heapUsed / 1024 / 1024)?.toFixed(1) || 0} MB
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Warnings</div>
                <div className="text-lg font-bold text-gray-900">
                  {diagnostics.warnings?.length || 0}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Calculation Time</div>
                <div className="text-lg font-bold text-gray-900">
                  {diagnostics.calculationTime ? new Date(diagnostics.calculationTime).toLocaleTimeString() : 'N/A'}
                </div>
              </div>
            </div>
            
            {diagnostics.warnings && diagnostics.warnings.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <div className="text-sm font-medium text-yellow-800 mb-2">Warnings:</div>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {diagnostics.warnings.map((warning, idx) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!currentUser || !currentPortfolio) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
            <div className="text-yellow-800">
              Please select a user and portfolio to run enhanced backend tests
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Enhanced Backend Test Suite
        </h1>
        <p className="text-gray-600">
          Test the new unified backend API with enhanced timeseries calculations
        </p>
        <div className="mt-4 text-sm text-gray-500">
          <strong>Portfolio:</strong> {currentPortfolio.portfolioId} • 
          <strong>User:</strong> {currentUser.name}
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <Settings className="w-5 h-5 text-gray-600 mr-2" />
          Test Configuration
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Interval Type
            </label>
            <select
              value={testConfig.intervalType}
              onChange={(e) => setTestConfig(prev => ({...prev, intervalType: e.target.value}))}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="annual">Annual</option>
              <option value="quarterly">Quarterly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Year
            </label>
            <input
              type="number"
              value={testConfig.startYear}
              onChange={(e) => setTestConfig(prev => ({...prev, startYear: parseInt(e.target.value)}))}
              className="w-full p-2 border border-gray-300 rounded-md"
              min="2020"
              max="2030"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Periods
            </label>
            <input
              type="number"
              value={testConfig.periods}
              onChange={(e) => setTestConfig(prev => ({...prev, periods: parseInt(e.target.value)}))}
              className="w-full p-2 border border-gray-300 rounded-md"
              min="1"
              max="50"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scenario
            </label>
            <select
              value={testConfig.scenario}
              onChange={(e) => setTestConfig(prev => ({...prev, scenario: e.target.value}))}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="base">Base Case</option>
              <option value="worst">Worst Case</option>
              <option value="volume">Volume Stress</option>
              <option value="price">Price Stress</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={testConfig.includeProjectFinance}
                onChange={(e) => setTestConfig(prev => ({...prev, includeProjectFinance: e.target.checked}))}
                className="mr-2"
              />
              <span className="text-sm">Project Finance</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={testConfig.includeSensitivity}
                onChange={(e) => setTestConfig(prev => ({...prev, includeSensitivity: e.target.checked}))}
                className="mr-2"
              />
              <span className="text-sm">Sensitivity</span>
            </label>
          </div>
        </div>
        
        {configOptions && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-800">
              <strong>Portfolio Capabilities:</strong> {configOptions.capabilities.totalAssets} assets, 
              Types: {configOptions.capabilities.assetTypes.join(', ')}, 
              States: {configOptions.capabilities.assetStates.join(', ')},
              {configOptions.capabilities.hasContracts && ' Has Contracts,'} 
              {configOptions.capabilities.hasProjectFinance && ' Has Finance Data'}
            </div>
          </div>
        )}
      </div>

      {/* Test Controls */}
      <div className="bg-white rounded-lg shadow border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Run Enhanced Analysis</h2>
            <p className="text-sm text-gray-600">Execute comprehensive backend calculations</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {testResults && (
              <button
                onClick={exportResults}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                <span>Export Results</span>
              </button>
            )}
            
            <button
              onClick={runEnhancedTest}
              disabled={testing}
              className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              <span>{testing ? 'Running...' : 'Run Test'}</span>
            </button>
          </div>
        </div>
        
        {testing && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-3"></div>
              <span className="text-yellow-800 font-medium">{testStage}</span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
              <span className="text-red-800 font-medium">Test Failed:</span>
            </div>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        )}
      </div>

      {/* Test Results */}
      {renderTestResults()}
    </div>
  )
}