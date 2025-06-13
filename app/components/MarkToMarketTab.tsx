import React, { useState, useEffect, useMemo } from 'react';

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
    pricingType: 'fixed' as const,
    lwpPercentage: 95 // NEW: 95% LWP
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
    pricingType: 'fixed' as const,
    lwpPercentage: 98 // NEW: 98% LWP
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
    escalationRate: 2.5,
    lwpPercentage: 100 // NEW: 100% LWP (default)
  },
  {
    _id: '4',
    name: 'Wholesale Cap NSW',
    type: 'wholesale' as const,
    category: 'Cap',
    state: 'NSW',
    counterparty: 'Energy Trader Pty',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    annualVolume: 15000,
    strikePrice: 120,
    unit: 'Energy',
    contractType: 'Energy',
    direction: 'sell' as const,
    volumeShape: 'flat' as const,
    status: 'active' as const,
    pricingType: 'fixed' as const,
    lwpPercentage: 105 // NEW: 105% LWP
  }
];

// Segmentation interfaces
interface SegmentData {
  segmentName: string;
  contracts: MtMCalculationResult[];
  totalMtM: number;
  totalVolume: number;
  contractCount: number;
  avgLWPPrice: number;
  avgContractPrice: number;
  avgMarketPrice: number;
}

interface StreamlinedMtMTabProps {
  contracts?: Contract[];
}

export default function StreamlinedMtMTab({ contracts = mockContracts }: StreamlinedMtMTabProps) {
  const [selectedYear, setSelectedYear] = useState(2025);
  const [mtmResults, setMtmResults] = useState<MtMCalculationResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState<string>('');
  const [selectedSegment, setSelectedSegment] = useState<'contractType' | 'category'>('contractType');
  const [selectedContract, setSelectedContract] = useState<string>('');

  // Filter active contracts
  const activeContracts = contracts.filter(c => c.status === 'active');

  // Auto-calculate MtM when year changes
  useEffect(() => {
    handleCalculateMtM();
  }, [selectedYear, contracts]);

  // Calculate MtM for all active contracts
  const handleCalculateMtM = async () => {
    if (activeContracts.length === 0) {
      setMtmResults([]);
      return;
    }

    setIsCalculating(true);
    setCalculationError('');
    
    try {
      const options: MtMCalculationOptions = {
        selectedYear,
        curve: 'Aurora Jan 2025 Intervals',
        scenario: 'Central'
      };

      console.log('🔄 Starting MtM calculation with LWP support:', options);
      const results = await streamlinedMtMEngine.calculatePortfolioMtM(activeContracts, options);
      console.log('✅ MtM calculation completed with LWP, results:', results);
      
      // Ensure results is an array
      if (Array.isArray(results)) {
        setMtmResults(results);
        
        if (results.length > 0 && !selectedContract) {
          setSelectedContract(results[0].contractId);
        }
      } else {
        console.error('❌ MtM calculation returned non-array:', results);
        setMtmResults([]);
        setCalculationError('MtM calculation returned invalid data');
      }
    } catch (error) {
      console.error('❌ Error calculating MtM:', error);
      setCalculationError(error instanceof Error ? error.message : 'Unknown error occurred');
      setMtmResults([]);
    } finally {
      setIsCalculating(false);
    }
  };

  // NEW: Segment results by Contract Type (Energy/Green)
  const contractTypeSegments = useMemo((): SegmentData[] => {
    if (!Array.isArray(mtmResults) || mtmResults.length === 0) return [];

    const segments: { [key: string]: MtMCalculationResult[] } = {};
    
    mtmResults.forEach(result => {
      const contractType = result.contractType || 'Energy';
      if (!segments[contractType]) {
        segments[contractType] = [];
      }
      segments[contractType].push(result);
    });

    return Object.entries(segments).map(([contractType, contracts]) => ({
      segmentName: contractType,
      contracts,
      totalMtM: contracts.reduce((sum, c) => sum + (c.totalMtMPnL || 0), 0),
      totalVolume: contracts.reduce((sum, c) => sum + Math.abs(c.totalVolume || 0), 0),
      contractCount: contracts.length,
      avgLWPPrice: contracts.reduce((sum, c) => sum + (c.weightedAvgLWPPrice || 0), 0) / contracts.length,
      avgContractPrice: contracts.reduce((sum, c) => sum + (c.weightedAvgContractPrice || 0), 0) / contracts.length,
      avgMarketPrice: contracts.reduce((sum, c) => sum + (c.weightedAvgMarketPrice || 0), 0) / contracts.length
    }));
  }, [mtmResults]);

  // NEW: Segment results by Category (Customer/Offtake/Wholesale)
  const categorySegments = useMemo((): SegmentData[] => {
    if (!Array.isArray(mtmResults) || mtmResults.length === 0) return [];

    const segments: { [key: string]: MtMCalculationResult[] } = {};
    
    mtmResults.forEach(result => {
      // Map contract types to business categories
      let businessCategory = '';
      if (result.category.includes('Customer') || result.category.includes('Retail') || result.category.includes('Industrial')) {
        businessCategory = 'Customer';
      } else if (result.category.includes('Farm') || result.category.includes('Solar') || result.category.includes('Wind') || result.category.includes('Battery')) {
        businessCategory = 'Offtake';
      } else if (result.category.includes('Cap') || result.category.includes('Swap') || result.category.includes('Forward')) {
        businessCategory = 'Wholesale';
      } else {
        businessCategory = result.category || 'Other';
      }
      
      if (!segments[businessCategory]) {
        segments[businessCategory] = [];
      }
      segments[businessCategory].push(result);
    });

    return Object.entries(segments).map(([category, contracts]) => ({
      segmentName: category,
      contracts,
      totalMtM: contracts.reduce((sum, c) => sum + (c.totalMtMPnL || 0), 0),
      totalVolume: contracts.reduce((sum, c) => sum + Math.abs(c.totalVolume || 0), 0),
      contractCount: contracts.length,
      avgLWPPrice: contracts.reduce((sum, c) => sum + (c.weightedAvgLWPPrice || 0), 0) / contracts.length,
      avgContractPrice: contracts.reduce((sum, c) => sum + (c.weightedAvgContractPrice || 0), 0) / contracts.length,
      avgMarketPrice: contracts.reduce((sum, c) => sum + (c.weightedAvgMarketPrice || 0), 0) / contracts.length
    }));
  }, [mtmResults]);

  // Get current segments based on selection
  const currentSegments = selectedSegment === 'contractType' ? contractTypeSegments : categorySegments;

  // Portfolio summary stats using calculation engine with safety checks
  const portfolioStats = useMemo(() => {
    if (!Array.isArray(mtmResults)) {
      return {
        totalMtM: 0,
        totalVolume: 0,
        totalRevenue: 0,
        totalMarketValue: 0,
        totalLWPValue: 0,
        avgContractPrice: 0,
        avgMarketPrice: 0,
        avgLWPPrice: 0,
        contractCount: 0
      };
    }

    try {
      const stats = streamlinedMtMEngine.calculatePortfolioStats(mtmResults);
      return stats;
    } catch (error) {
      console.error('❌ Error calculating portfolio stats:', error);
      return {
        totalMtM: 0,
        totalVolume: 0,
        totalRevenue: 0,
        totalMarketValue: 0,
        totalLWPValue: 0,
        avgContractPrice: 0,
        avgMarketPrice: 0,
        avgLWPPrice: 0,
        contractCount: 0
      };
    }
  }, [mtmResults]);

  // Individual contract data for monthly breakdown
  const individualContractData = useMemo(() => {
    if (!Array.isArray(mtmResults) || mtmResults.length === 0 || !selectedContract) {
      return [];
    }

    try {
      const result = mtmResults.find(r => r && r.contractId === selectedContract);
      if (!result || !Array.isArray(result.timeSeriesData)) {
        return [];
      }

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const contractData = result.timeSeriesData.map((point, index) => ({
        month: months[index] || point.period.split('-')[1],
        ...point,
        mtmPnL: Math.round(point.mtmPnL),
        cumulativeMtM: Math.round(point.cumulativeMtM),
        lwpPrice: Math.round(point.lwpPrice * 100) / 100,
        lwpPercentage: Math.round(point.lwpPercentage * 10) / 10
      }));
      
      return contractData;
    } catch (error) {
      console.error('❌ Error calculating individual contract data:', error);
      return [];
    }
  }, [mtmResults, selectedContract]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              💹 Mark-to-Market Analysis with LWP
            </h2>
            <p className="text-gray-600 mt-2">
              Portfolio valuation using Load Weighted Pricing (LWP) for {activeContracts.length} active contracts
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Segment By</label>
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value as 'contractType' | 'category')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="contractType">Energy/Green</option>
                <option value="category">Business Category</option>
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

      {/* Error Display */}
      {calculationError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">
            <strong>Error:</strong> {calculationError}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isCalculating && (
        <div className="bg-white rounded-xl p-12 shadow-md border border-gray-200 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Calculating Mark-to-Market with LWP...</p>
        </div>
      )}

      {/* MtM Results */}
      {Array.isArray(mtmResults) && mtmResults.length > 0 && (
        <>
          {/* Portfolio Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200 text-center">
              <div className={`text-2xl font-bold ${
                portfolioStats.totalMtM >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {portfolioStats.totalMtM >= 0 ? '+' : ''}${portfolioStats.totalMtM.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total MtM P&L</div>
              <div className="text-xs text-gray-500 mt-1">Based on LWP</div>
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

            <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200 text-center">
              <div className="text-2xl font-bold text-green-600">
                ${portfolioStats.avgLWPPrice.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Avg LWP Price</div>
              <div className="text-xs text-gray-500 mt-1">Market × LWP%</div>
            </div>
          </div>

          {/* Segment Analysis Table */}
          {currentSegments.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-6">
                📊 {selectedSegment === 'contractType' ? 'Energy vs Green' : 'Business Category'} Analysis
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-4 font-semibold text-gray-700">
                        {selectedSegment === 'contractType' ? 'Contract Type' : 'Business Category'}
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-700">Contract Count</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Total Volume (MWh)</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Avg Contract Price</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Avg Market Price</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Avg LWP %</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Avg LWP Price</th>
                      <th className="text-left p-4 font-semibold text-gray-700">Total MtM P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentSegments.map((segment) => (
                      <tr key={segment.segmentName} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-4 font-medium text-gray-900">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            selectedSegment === 'contractType' 
                              ? segment.segmentName === 'Green' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                              : segment.segmentName === 'Customer' ? 'bg-orange-100 text-orange-800' :
                                segment.segmentName === 'Offtake' ? 'bg-purple-100 text-purple-800' :
                                segment.segmentName === 'Wholesale' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                          }`}>
                            {segment.segmentName}
                          </span>
                        </td>
                        <td className="p-4 text-gray-700">{segment.contractCount}</td>
                        <td className="p-4 text-gray-700">{segment.totalVolume.toLocaleString()}</td>
                        <td className="p-4 text-gray-700">${segment.avgContractPrice.toFixed(2)}</td>
                        <td className="p-4 text-gray-700">${segment.avgMarketPrice.toFixed(2)}</td>
                        <td className="p-4 text-blue-700 font-medium">
                          {/* Calculate average LWP % for the segment */}
                          {segment.contracts.length > 0 
                            ? (segment.contracts.reduce((sum, contract) => {
                                if (contract.timeSeriesData && contract.timeSeriesData.length > 0) {
                                  const avgLWP = contract.timeSeriesData.reduce((s, p) => s + p.lwpPercentage, 0) / contract.timeSeriesData.length;
                                  return sum + avgLWP;
                                }
                                return sum + 100; // Default LWP if no time series
                              }, 0) / segment.contracts.length).toFixed(1)
                            : '100.0'
                          }%
                        </td>
                        <td className="p-4 text-green-700 font-medium">${segment.avgLWPPrice.toFixed(2)}</td>
                        <td className={`p-4 font-semibold ${
                          segment.totalMtM >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {segment.totalMtM >= 0 ? '+' : ''}${segment.totalMtM.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Contract Summary Table */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Contract MtM Summary (LWP-based)</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-3 font-semibold text-gray-700">Contract</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Direction</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Type</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Category</th>
                    <th className="text-left p-3 font-semibold text-gray-700">State</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Volume (MWh)</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Avg Contract Price</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Avg Market Price</th>
                    <th className="text-left p-3 font-semibold text-gray-700">LWP %</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Avg LWP Price</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Total MtM P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {mtmResults.map((result) => (
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
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          result.category.includes('Customer') ? 'bg-orange-100 text-orange-800' :
                          result.category.includes('Farm') ? 'bg-purple-100 text-purple-800' :
                          result.category.includes('Cap') ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {result.category}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">{result.state}</td>
                      <td className="p-3 text-gray-700">{Math.abs(result.totalVolume).toLocaleString()}</td>
                      <td className="p-3 text-gray-700">${result.weightedAvgContractPrice.toFixed(2)}</td>
                      <td className="p-3 text-gray-700">${result.weightedAvgMarketPrice.toFixed(2)}</td>
                      <td className="p-3 text-blue-700 font-medium">
                        {result.timeSeriesData && result.timeSeriesData.length > 0 
                          ? (result.timeSeriesData.reduce((sum, point) => sum + point.lwpPercentage, 0) / result.timeSeriesData.length).toFixed(1)
                          : '100.0'
                        }%
                      </td>
                      <td className="p-3 text-green-700 font-medium">${result.weightedAvgLWPPrice.toFixed(2)}</td>
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
          </div>

          {/* Monthly Breakdown Table */}
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-800">Monthly Contract Breakdown</h3>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Select Contract:</label>
                <select
                  value={selectedContract}
                  onChange={(e) => setSelectedContract(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {mtmResults.map(result => (
                    <option key={result.contractId} value={result.contractId}>
                      {result.contractName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {individualContractData.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-3 font-semibold text-gray-700">Month</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Volume (MWh)</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Contract Price</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Market Price</th>
                      <th className="text-left p-3 font-semibold text-gray-700">LWP %</th>
                      <th className="text-left p-3 font-semibold text-gray-700">LWP Price</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Contract Revenue</th>
                      <th className="text-left p-3 font-semibold text-gray-700">LWP Value</th>
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
                        <td className="p-3 text-blue-700 font-medium">{data.lwpPercentage.toFixed(1)}%</td>
                        <td className="p-3 text-green-700 font-medium">${data.lwpPrice.toFixed(2)}</td>
                        <td className="p-3 text-gray-700">${Math.round(data.contractRevenue).toLocaleString()}</td>
                        <td className="p-3 text-green-700">${Math.round(data.lwpValue).toLocaleString()}</td>
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
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {!Array.isArray(mtmResults) || (mtmResults.length === 0 && !isCalculating && !calculationError) && (
        <div className="bg-white rounded-xl p-12 shadow-md border border-gray-200 text-center">
          <div className="text-6xl mb-4">💹</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Ready to Calculate MtM with LWP</h3>
          <p className="text-gray-600 mb-4">
            {activeContracts.length === 0 
              ? 'No active contracts found. Add contracts to see MtM analysis.'
              : `Found ${activeContracts.length} active contracts. Click "Refresh MtM" to calculate.`
            }
          </p>
        </div>
      )}

      {/* LWP Information Panel */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
        <h3 className="text-lg font-semibold text-green-800 mb-4">💡 Load Weighted Price (LWP) Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-semibold mb-2 text-green-700">How LWP Works</h4>
            <ul className="space-y-1 text-green-600">
              <li>• <strong>Market Price:</strong> Base market price from price curves</li>
              <li>• <strong>LWP %:</strong> Load weighting percentage (default: 100%)</li>
              <li>• <strong>LWP Price:</strong> Market Price × LWP% = Load Weighted Price</li>
              <li>• <strong>MtM Calculation:</strong> Now uses LWP Price instead of Market Price</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2 text-blue-700">Current Settings</h4>
            <ul className="space-y-1 text-blue-600">
              <li>• <strong>Default LWP:</strong> 100% (no adjustment)</li>
              <li>• <strong>Contract Override:</strong> Individual contracts can set custom LWP%</li>
              <li>• <strong>Future Enhancement:</strong> Monthly LWP% time series support</li>
              <li>• <strong>Calculation Base:</strong> All MtM now uses LWP instead of raw market prices</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Integration Notes */}
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-800 mb-4">🔗 Integration Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-700">
          <div>
            <h4 className="font-semibold mb-2">✅ Connected Features</h4>
            <ul className="space-y-1">
              <li>• <strong>Price Curves API:</strong> Fetching real market prices</li>
              <li>• <strong>LWP Calculation:</strong> Market Price × LWP% = LWP Price</li>
              <li>• <strong>Segmentation:</strong> Energy/Green and Business Category analysis</li>
              <li>• <strong>Error Handling:</strong> Graceful failure handling</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">🔄 Current Status</h4>
            <ul className="space-y-1">
              <li>• <strong>MtM Results:</strong> {Array.isArray(mtmResults) ? mtmResults.length : 0} contracts calculated</li>
              <li>• <strong>Cache Status:</strong> {streamlinedMtMEngine.getCacheStats().size} cached price series</li>
              <li>• <strong>Segments:</strong> {currentSegments.length} {selectedSegment === 'contractType' ? 'contract types' : 'categories'}</li>
              <li>• <strong>LWP Support:</strong> Active with individual contract settings</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}