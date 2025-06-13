import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Import calculation engine (in real implementation, import from separate file)
import { 
  streamlinedMtMEngine, 
  MtMCalculationResult, 
  MtMTimeSeriesPoint,
  Contract,
  MtMCalculationOptions
} from './mtmCalculationEngine'; // This would be the actual import path

// Mock contracts for demonstration
const mockContracts = [
  {
    _id: '1',
    name: 'Solar Farm NSW PPA',
    type: 'offtake' as const,
    category: 'Solar Farm',
    state: 'NSW',
    counterparty: 'Green Energy Co',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    annualVolume: 50000,
    strikePrice: 65,
    unit: 'Energy',
    contractType: 'Energy',
    direction: 'buy' as const,
    volumeShape: 'solar' as const,
    status: 'active' as const,
    pricingType: 'fixed' as const
  },
  {
    _id: '2',
    name: 'Retail Customer QLD',
    type: 'retail' as const,
    category: 'Industrial Customer',
    state: 'QLD',
    counterparty: 'Manufacturing Corp',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    annualVolume: 25000,
    strikePrice: 85,
    unit: 'Energy',
    contractType: 'Energy',
    direction: 'sell' as const,
    volumeShape: 'flat' as const,
    status: 'active' as const,
    pricingType: 'fixed' as const
  },
  {
    _id: '3',
    name: 'Wind Farm VIC Green Certs',
    type: 'offtake' as const,
    category: 'Wind Farm',
    state: 'VIC',
    counterparty: 'Wind Power Ltd',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    annualVolume: 35000,
    strikePrice: 45,
    unit: 'Green',
    contractType: 'Green',
    direction: 'buy' as const,
    volumeShape: 'wind' as const,
    status: 'active' as const,
    pricingType: 'escalation' as const,
    escalationRate: 2.5
  }
];

interface StreamlinedMtMTabProps {
  contracts?: Contract[];
}

export default function StreamlinedMtMTab({ contracts = mockContracts }: StreamlinedMtMTabProps) {
  const [selectedYear, setSelectedYear] = useState(2025);
  const [mtmResults, setMtmResults] = useState<MtMCalculationResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [viewMode, setViewMode] = useState<'portfolio' | 'individual'>('portfolio');
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [showSummaryTable, setShowSummaryTable] = useState(false);

  // Filter active contracts
  const activeContracts = contracts.filter(c => c.status === 'active');

  // Auto-calculate MtM when year changes
  useEffect(() => {
    handleCalculateMtM();
  }, [selectedYear, contracts]);

  // Calculate MtM for all active contracts using real price data
  const handleCalculateMtM = async () => {
    if (activeContracts.length === 0) return;

    setIsCalculating(true);
    
    try {
      const options: MtMCalculationOptions = {
        selectedYear,
        curve: 'Aurora Jan 2025' // You can make this configurable
      };

      console.log(`🚀 Starting MtM calculation for ${activeContracts.length} contracts, year ${selectedYear}`);
      
      // Use the API-enabled calculation engine
      const results = await streamlinedMtMEngine.calculatePortfolioMtM(activeContracts, options);
      setMtmResults(results);
      
      if (results.length > 0 && !selectedContract) {
        setSelectedContract(results[0].contractId);
      }
      
      console.log(`✅ MtM calculation completed: ${results.length} contracts processed`);
    } catch (error) {
      console.error('❌ Error calculating MtM:', error);
      // Show error message to user
      alert('Error calculating Mark-to-Market. Check console for details.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Portfolio aggregation using calculation engine
  const portfolioData = useMemo(() => {
    if (mtmResults.length === 0) return [];
    return streamlinedMtMEngine.calculatePortfolioAggregation(mtmResults, selectedYear);
  }, [mtmResults, selectedYear]);

  // Individual contract data for charts
  const individualContractData = useMemo(() => {
    const result = mtmResults.find(r => r.contractId === selectedContract);
    if (!result) return [];

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return result.timeSeriesData.map((point, index) => ({
      month: months[index] || point.period.split('-')[1],
      ...point,
      mtmPnL: Math.round(point.mtmPnL),
      cumulativeMtM: Math.round(point.cumulativeMtM)
    }));
  }, [mtmResults, selectedContract]);

  // Portfolio summary stats using calculation engine
  const portfolioStats = useMemo(() => {
    return streamlinedMtMEngine.calculatePortfolioStats(mtmResults);
  }, [mtmResults]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              💹 Mark-to-Market Analysis
            </h2>
            <p className="text-gray-600 mt-2">
              Real-time portfolio valuation and P&L analysis for {activeContracts.length} active contracts
            </p>
          </div>
          
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">View</label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'portfolio' | 'individual')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="portfolio">Portfolio View</option>
                <option value="individual">Individual Contract</option>
              </select>
            </div>

            <button
              onClick={handleCalculateMtM}
              disabled={isCalculating}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {isCalculating ? 'Calculating...' : 'Refresh MtM'}
            </button>
          </div>
        </div>
      </div>

      {/* MtM Results */}
      {mtmResults.length > 0 && (
        <>
          {/* Portfolio Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200 text-center">
              <div className={`text-2xl font-bold ${
                portfolioStats.totalMtM >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {portfolioStats.totalMtM >= 0 ? '+' : ''}${portfolioStats.totalMtM.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total MtM P&L</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {portfolioStats.totalVolume.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Volume (MWh)</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200 text-center">
              <div className="text-2xl font-bold text-purple-600">
                ${portfolioStats.avgContractPrice.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Avg Contract Price</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200 text-center">
              <div className="text-2xl font-bold text-orange-600">
                ${portfolioStats.avgMarketPrice.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Avg Market Price</div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Monthly MtM Chart */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                {viewMode === 'portfolio' ? 'Portfolio Monthly MtM' : 'Contract Monthly MtM'}
              </h3>
              
              {viewMode === 'individual' && (
                <div className="mb-4">
                  <select
                    value={selectedContract}
                    onChange={(e) => setSelectedContract(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {mtmResults.map(result => (
                      <option key={result.contractId} value={result.contractId}>
                        {result.contractName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={viewMode === 'portfolio' ? portfolioData : individualContractData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'MtM P&L']}
                    />
                    <Bar 
                      dataKey={viewMode === 'portfolio' ? 'totalMtM' : 'mtmPnL'} 
                      fill="#3B82F6"
                      name="MtM P&L"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cumulative MtM Chart */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                {viewMode === 'portfolio' ? 'Portfolio Cumulative MtM' : 'Contract Cumulative MtM'}
              </h3>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={viewMode === 'portfolio' ? portfolioData : individualContractData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cumulative MtM']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey={viewMode === 'portfolio' ? 'cumulativeMtM' : 'cumulativeMtM'}
                      stroke="#10B981" 
                      strokeWidth={3}
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                      name="Cumulative MtM"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Collapsible Contract MtM Summary */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Contract MtM Summary</h3>
              <button
                onClick={() => setShowSummaryTable(!showSummaryTable)}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {showSummaryTable ? '🔼 Collapse' : '🔽 Expand'}
                <span className="text-gray-600">({mtmResults.length} contracts)</span>
              </button>
            </div>
            
            {showSummaryTable && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-3 font-semibold text-gray-700">Contract</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Direction</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Type</th>
                      <th className="text-left p-3 font-semibold text-gray-700">State</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Volume (MWh)</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Avg Contract Price</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Avg Market Price</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Total MtM P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mtmResults.map((result, index) => (
                      <tr key={result.contractId} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{result.contractName}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${
                            result.direction === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {result.direction}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            result.contractType === 'Green' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {result.contractType}
                          </span>
                        </td>
                        <td className="p-3 text-gray-700">{result.state}</td>
                        <td className="p-3 text-gray-700">{Math.abs(result.totalVolume).toLocaleString()}</td>
                        <td className="p-3 text-gray-700">${result.weightedAvgContractPrice.toFixed(2)}</td>
                        <td className="p-3 text-gray-700">${result.weightedAvgMarketPrice.toFixed(2)}</td>
                        <td className={`p-3 font-semibold ${
                          result.totalMtMPnL >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {result.totalMtMPnL >= 0 ? '+' : ''}${result.totalMtMPnL.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Monthly Breakdown Table */}
          {viewMode === 'individual' && selectedContract && (
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Monthly Breakdown - {mtmResults.find(r => r.contractId === selectedContract)?.contractName}
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-3 font-semibold text-gray-700">Month</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Volume (MWh)</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Contract Price</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Market Price</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Contract Revenue</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Market Value</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Monthly MtM</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {individualContractData.map((data, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{data.month}</td>
                        <td className="p-3 text-gray-700">{Math.round(data.contractVolume).toLocaleString()}</td>
                        <td className="p-3 text-gray-700">${data.contractPrice.toFixed(2)}</td>
                        <td className="p-3 text-gray-700">${data.marketPrice.toFixed(2)}</td>
                        <td className="p-3 text-gray-700">${Math.round(data.contractRevenue).toLocaleString()}</td>
                        <td className="p-3 text-gray-700">${Math.round(data.marketValue).toLocaleString()}</td>
                        <td className={`p-3 font-medium ${
                          data.mtmPnL >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {data.mtmPnL >= 0 ? '+' : ''}${data.mtmPnL.toLocaleString()}
                        </td>
                        <td className={`p-3 font-medium ${
                          data.cumulativeMtM >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {data.cumulativeMtM >= 0 ? '+' : ''}${data.cumulativeMtM.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading State */}
      {isCalculating && (
        <div className="bg-white rounded-xl p-12 shadow-md border border-gray-200 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Calculating Mark-to-Market...</p>
        </div>
      )}

      {/* Empty State */}
      {mtmResults.length === 0 && !isCalculating && (
        <div className="bg-white rounded-xl p-12 shadow-md border border-gray-200 text-center">
          <div className="text-6xl mb-4">💹</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Ready to Calculate MtM</h3>
          <p className="text-gray-600 mb-4">
            {activeContracts.length === 0 
              ? 'No active contracts found. Add contracts to see MtM analysis.'
              : `Found ${activeContracts.length} active contracts. Click "Refresh MtM" to calculate.`
            }
          </p>
        </div>
      )}

      {/* Integration Notes */}
      <div className="bg-green-50 rounded-xl p-6 border border-green-200">
        <h3 className="text-lg font-semibold text-green-800 mb-4">🔗 Live Price Data Integration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-green-700">
          <div>
            <h4 className="font-semibold mb-2">✅ API Integration Active</h4>
            <ul className="space-y-1">
              <li>• <strong>Real Price Data:</strong> Fetching from /api/price-curves endpoint</li>
              <li>• <strong>Smart Caching:</strong> 5-minute cache to optimize performance</li>
              <li>• <strong>Bulk Fetching:</strong> Efficiently loads all required price series</li>
              <li>• <strong>Fallback Protection:</strong> Uses default prices if API fails</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">📊 Price Curve Features</h4>
            <ul className="space-y-1">
              <li>• <strong>Energy Prices:</strong> State-specific baseload pricing</li>
              <li>• <strong>Green Certificates:</strong> Renewable energy credit pricing</li>
              <li>• <strong>Aurora Jan 2025:</strong> Using latest forward curve</li>
              <li>• <strong>Monthly Granularity:</strong> 12-month price profiles</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-green-100 rounded-lg">
          <div className="flex items-center gap-2 text-green-800 text-sm">
            <span>🎯</span>
            <strong>Cache Status:</strong> 
            <span className="ml-2">Ready to fetch live market data from your price curve database</span>
          </div>
        </div>
      </div>
    </div>
  );
}