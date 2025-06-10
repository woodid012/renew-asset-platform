'use client';

import { useState, useMemo } from 'react';
import { Contract, SettingsData } from '@/app/types';

// Enhanced time series data structure
interface TimeSeriesVariable {
  id: string;
  name: string;
  type: 'volume' | 'price' | 'capacity' | 'temperature' | 'custom' | 'revenue' | 'mtm';
  unit: string;
  source: 'contract' | 'market' | 'external' | 'calculated';
  timeSeriesData: Array<{
    period: string; // YYYY-MM format
    value: number;
    metadata?: Record<string, any>;
  }>;
  contractId?: string; // If from contract
  description?: string;
}

// Mathematical operations for creating new variables
type MathOperation = 'multiply' | 'add' | 'subtract' | 'divide' | 'average' | 'max' | 'min';

interface GenericFormula {
  id: string;
  name: string;
  description: string;
  operation: MathOperation;
  formula: string;
  category: 'revenue' | 'mtm' | 'analysis' | 'custom';
  unit: string;
  icon: string;
}

interface VariablesCreationTabProps {
  contracts: Contract[];
  marketPrices: { [key: string]: number[] };
  settings: SettingsData | null;
}

export default function VariablesCreationTab({
  contracts,
  marketPrices,
  settings,
}: VariablesCreationTabProps) {
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [newVariableName, setNewVariableName] = useState('');
  const [selectedOperation, setSelectedOperation] = useState<MathOperation>('multiply');
  const [calculatedVariables, setCalculatedVariables] = useState<TimeSeriesVariable[]>([]);
  const [selectedTimePeriod, setSelectedTimePeriod] = useState<'all' | string>('all');
  const [showFormulaBuilder, setShowFormulaBuilder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | string>('all');

  // Generic formula templates that can be applied to any contract
  const genericFormulas: GenericFormula[] = [
    {
      id: 'floating_revenue',
      name: 'Floating Revenue',
      description: 'Market Price × Volume for all contracts',
      operation: 'multiply',
      formula: 'Market Price × Contract Volume',
      category: 'revenue',
      unit: '$',
      icon: '💰'
    },
    {
      id: 'fixed_revenue',
      name: 'Fixed Revenue',
      description: 'Contract Strike Price × Volume for all contracts',
      operation: 'multiply',
      formula: 'Contract Strike Price × Contract Volume',
      category: 'revenue',
      unit: '$',
      icon: '📊'
    },
    {
      id: 'mtm_pnl',
      name: 'Mark-to-Market P&L',
      description: 'Floating Revenue - Fixed Revenue (for all contracts)',
      operation: 'subtract',
      formula: 'Floating Revenue - Fixed Revenue',
      category: 'mtm',
      unit: '$',
      icon: '📈'
    },
    {
      id: 'total_portfolio_volume',
      name: 'Total Portfolio Volume',
      description: 'Sum of all contract volumes by period',
      operation: 'add',
      formula: 'Sum(All Contract Volumes)',
      category: 'analysis',
      unit: 'MWh',
      icon: '⚡'
    },
    {
      id: 'weighted_avg_strike',
      name: 'Volume-Weighted Average Strike',
      description: 'Portfolio average strike price weighted by volume',
      operation: 'average',
      formula: '(Strike Price × Volume) / Total Volume',
      category: 'analysis',
      unit: '$/MWh',
      icon: '⚖️'
    },
    {
      id: 'weighted_avg_market',
      name: 'Volume-Weighted Average Market Price',
      description: 'Portfolio average market price weighted by volume',
      operation: 'average',
      formula: '(Market Price × Volume) / Total Volume',
      category: 'analysis',
      unit: '$/MWh',
      icon: '🏷️'
    },
    {
      id: 'price_spread',
      name: 'Average Price Spread',
      description: 'Difference between market price and strike price',
      operation: 'subtract',
      formula: 'Volume-Weighted Market Price - Volume-Weighted Strike Price',
      category: 'analysis',
      unit: '$/MWh',
      icon: '📏'
    },
    {
      id: 'portfolio_value_at_risk',
      name: 'Portfolio Value at Risk',
      description: 'Maximum potential loss based on price volatility',
      operation: 'multiply',
      formula: 'Total Volume × (Max Market Price - Current Market Price)',
      category: 'mtm',
      unit: '$',
      icon: '⚠️'
    }
  ];

  // Generate available variables from contracts and market data
  const availableVariables = useMemo((): TimeSeriesVariable[] => {
    const variables: TimeSeriesVariable[] = [];

    // 1. Extract contract volume data (aggregated by state/type)
    const contractsByState: { [state: string]: Contract[] } = {};
    contracts.forEach(contract => {
      if (!contractsByState[contract.state]) {
        contractsByState[contract.state] = [];
      }
      contractsByState[contract.state].push(contract);
    });

    // Create aggregated volume variables by state
    Object.entries(contractsByState).forEach(([state, stateContracts]) => {
      // Calculate total volume for this state by period
      const volumeData: { [period: string]: number } = {};
      
      stateContracts.forEach(contract => {
        if (contract.timeSeriesData?.length) {
          contract.timeSeriesData.forEach(data => {
            if (!volumeData[data.period]) volumeData[data.period] = 0;
            volumeData[data.period] += data.volume;
          });
        } else {
          // Use percentage-based calculation for 2025
          const volumeShapes = {
            flat: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33],
            solar: [6.5, 7.2, 8.8, 9.5, 10.2, 8.9, 9.1, 9.8, 8.6, 7.4, 6.8, 7.2],
            wind: [11.2, 10.8, 9.2, 7.8, 6.5, 5.9, 6.2, 7.1, 8.4, 9.6, 10.8, 11.5],
            custom: [5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 13.0, 12.0, 10.5, 8.5, 7.0, 6.0]
          };
          const percentages = volumeShapes[contract.volumeShape] || volumeShapes.flat;
          percentages.forEach((pct, index) => {
            const period = `2025-${(index + 1).toString().padStart(2, '0')}`;
            if (!volumeData[period]) volumeData[period] = 0;
            volumeData[period] += (contract.annualVolume * pct) / 100;
          });
        }
      });

      if (Object.keys(volumeData).length > 0) {
        variables.push({
          id: `total_volume_${state}`,
          name: `${state} - Total Volume`,
          type: 'volume',
          unit: 'MWh',
          source: 'calculated',
          description: `Aggregated volume for all contracts in ${state}`,
          timeSeriesData: Object.entries(volumeData).map(([period, value]) => ({
            period,
            value,
            metadata: { state, contractCount: stateContracts.length }
          }))
        });
      }
    });

    // 2. Create aggregated strike price variables by state
    Object.entries(contractsByState).forEach(([state, stateContracts]) => {
      const priceData: { [period: string]: { totalValue: number; totalVolume: number } } = {};
      
      stateContracts.forEach(contract => {
        if (contract.timeSeriesData?.length) {
          contract.timeSeriesData.forEach(data => {
            if (!priceData[data.period]) {
              priceData[data.period] = { totalValue: 0, totalVolume: 0 };
            }
            priceData[data.period].totalValue += data.volume * contract.strikePrice;
            priceData[data.period].totalVolume += data.volume;
          });
        } else {
          // Use percentage-based calculation
          const volumeShapes = {
            flat: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33],
            solar: [6.5, 7.2, 8.8, 9.5, 10.2, 8.9, 9.1, 9.8, 8.6, 7.4, 6.8, 7.2],
            wind: [11.2, 10.8, 9.2, 7.8, 6.5, 5.9, 6.2, 7.1, 8.4, 9.6, 10.8, 11.5],
            custom: [5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 13.0, 12.0, 10.5, 8.5, 7.0, 6.0]
          };
          const percentages = volumeShapes[contract.volumeShape] || volumeShapes.flat;
          percentages.forEach((pct, index) => {
            const period = `2025-${(index + 1).toString().padStart(2, '0')}`;
            const volume = (contract.annualVolume * pct) / 100;
            if (!priceData[period]) {
              priceData[period] = { totalValue: 0, totalVolume: 0 };
            }
            priceData[period].totalValue += volume * contract.strikePrice;
            priceData[period].totalVolume += volume;
          });
        }
      });

      if (Object.keys(priceData).length > 0) {
        variables.push({
          id: `avg_strike_${state}`,
          name: `${state} - Volume-Weighted Strike Price`,
          type: 'price',
          unit: '$/MWh',
          source: 'calculated',
          description: `Volume-weighted average strike price for ${state}`,
          timeSeriesData: Object.entries(priceData).map(([period, data]) => ({
            period,
            value: data.totalVolume > 0 ? data.totalValue / data.totalVolume : 0,
            metadata: { state, totalVolume: data.totalVolume }
          }))
        });
      }
    });

    // 3. Extract market price data
    Object.entries(marketPrices).forEach(([state, prices]) => {
      variables.push({
        id: `market_price_${state}`,
        name: `${state} - Market Price`,
        type: 'price',
        unit: '$/MWh',
        source: 'market',
        description: `Market price curve for ${state}`,
        timeSeriesData: prices.map((price, index) => ({
          period: `2025-${(index + 1).toString().padStart(2, '0')}`,
          value: price,
          metadata: { state, source: 'Aurora Jan 2025' }
        }))
      });
    });

    // 4. Add calculated variables
    calculatedVariables.forEach(variable => {
      variables.push(variable);
    });

    return variables;
  }, [contracts, marketPrices, calculatedVariables]);

  // Apply generic formula to generate new variable
  const applyGenericFormula = (formula: GenericFormula) => {
    const states = [...new Set(contracts.map(c => c.state))];
    const newVariables: TimeSeriesVariable[] = [];

    states.forEach(state => {
      const stateVariables = availableVariables.filter(v => 
        v.id.includes(state) || v.timeSeriesData[0]?.metadata?.state === state
      );

      let result: TimeSeriesVariable | null = null;

      switch (formula.id) {
        case 'floating_revenue':
          const volumeVar = stateVariables.find(v => v.id === `total_volume_${state}`);
          const marketVar = stateVariables.find(v => v.id === `market_price_${state}`);
          if (volumeVar && marketVar) {
            result = createCalculatedVariable(
              `${state} - ${formula.name}`,
              formula.operation,
              [volumeVar.id, marketVar.id],
              formula.unit,
              formula.description + ` for ${state}`
            );
          }
          break;

        case 'fixed_revenue':
          const volumeVar2 = stateVariables.find(v => v.id === `total_volume_${state}`);
          const strikeVar = stateVariables.find(v => v.id === `avg_strike_${state}`);
          if (volumeVar2 && strikeVar) {
            result = createCalculatedVariable(
              `${state} - ${formula.name}`,
              formula.operation,
              [volumeVar2.id, strikeVar.id],
              formula.unit,
              formula.description + ` for ${state}`
            );
          }
          break;

        case 'mtm_pnl':
          const floatingVar = calculatedVariables.find(v => v.name === `${state} - Floating Revenue`);
          const fixedVar = calculatedVariables.find(v => v.name === `${state} - Fixed Revenue`);
          if (floatingVar && fixedVar) {
            result = createCalculatedVariable(
              `${state} - ${formula.name}`,
              formula.operation,
              [floatingVar.id, fixedVar.id],
              formula.unit,
              formula.description + ` for ${state}`
            );
          }
          break;

        // Add more formula implementations...
      }

      if (result) {
        newVariables.push(result);
      }
    });

    setCalculatedVariables(prev => [...prev, ...newVariables]);
  };

  // Time series alignment utilities
  const alignTimeSeries = (variables: TimeSeriesVariable[]): Array<{
    period: string;
    values: { [variableId: string]: number };
    metadata: Record<string, any>;
  }> => {
    if (variables.length === 0) return [];

    const allPeriods = new Set<string>();
    variables.forEach(variable => {
      variable.timeSeriesData.forEach(point => {
        allPeriods.add(point.period);
      });
    });

    const sortedPeriods = Array.from(allPeriods).sort();

    return sortedPeriods.map(period => {
      const values: { [variableId: string]: number } = {};
      const metadata: Record<string, any> = { period };

      variables.forEach(variable => {
        const dataPoint = variable.timeSeriesData.find(d => d.period === period);
        if (dataPoint) {
          values[variable.id] = dataPoint.value;
          metadata[`${variable.id}_meta`] = dataPoint.metadata;
        } else {
          values[variable.id] = 0;
        }
      });

      return { period, values, metadata };
    });
  };

  // Create calculated variable
  const createCalculatedVariable = (
    name: string,
    operation: MathOperation,
    selectedVarIds: string[],
    unit: string,
    description?: string
  ): TimeSeriesVariable | null => {
    if (selectedVarIds.length < 1) return null;

    const selectedVars = availableVariables.filter(v => selectedVarIds.includes(v.id));
    const alignedData = alignTimeSeries(selectedVars);

    const newTimeSeriesData = alignedData.map(({ period, values }) => {
      let result = 0;
      const varValues = selectedVarIds.map(id => values[id] || 0);

      switch (operation) {
        case 'multiply':
          result = varValues.reduce((acc, val) => acc * val, 1);
          break;
        case 'add':
          result = varValues.reduce((acc, val) => acc + val, 0);
          break;
        case 'subtract':
          result = varValues.reduce((acc, val, index) => index === 0 ? val : acc - val);
          break;
        case 'divide':
          result = varValues.reduce((acc, val, index) => {
            if (index === 0) return val;
            return val !== 0 ? acc / val : 0;
          });
          break;
        case 'average':
          result = varValues.reduce((acc, val) => acc + val, 0) / varValues.length;
          break;
        case 'max':
          result = Math.max(...varValues);
          break;
        case 'min':
          result = Math.min(...varValues);
          break;
      }

      return {
        period,
        value: result,
        metadata: {
          operation,
          sourceVariables: selectedVarIds,
          calculation: `${operation}(${varValues.join(', ')}) = ${result}`
        }
      };
    });

    return {
      id: `calculated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type: 'custom',
      unit,
      source: 'calculated',
      description: description || `${operation} of: ${selectedVars.map(v => v.name).join(', ')}`,
      timeSeriesData: newTimeSeriesData
    };
  };

  // Create new variable manually
  const handleCreateVariable = () => {
    if (!newVariableName.trim() || selectedVariables.length < 1) {
      alert('Please enter a name and select at least one variable');
      return;
    }

    const newVariable = createCalculatedVariable(
      newVariableName, 
      selectedOperation, 
      selectedVariables,
      'units', // Default unit
      `Custom calculation: ${selectedOperation} of selected variables`
    );
    
    if (newVariable) {
      setCalculatedVariables(prev => [...prev, newVariable]);
      setNewVariableName('');
      setSelectedVariables([]);
      setShowFormulaBuilder(false);
    }
  };

  // Filter variables for display
  const getFilteredVariables = () => {
    let filtered = availableVariables;
    
    if (selectedTimePeriod !== 'all') {
      filtered = filtered.filter(variable => 
        variable.timeSeriesData.some(point => point.period.startsWith(selectedTimePeriod))
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(variable => variable.type === selectedCategory);
    }
    
    return filtered;
  };

  // Get available time periods
  const getAvailableTimePeriods = (): string[] => {
    const periods = new Set<string>();
    availableVariables.forEach(variable => {
      variable.timeSeriesData.forEach(point => {
        periods.add(point.period.substring(0, 4)); // Get year
      });
    });
    return Array.from(periods).sort();
  };

  const availableTimePeriods = getAvailableTimePeriods();
  const filteredVariables = getFilteredVariables();

  // Get category colors
  const getCategoryColor = (category: string) => {
    const colors = {
      revenue: 'bg-green-100 text-green-800 border-green-200',
      mtm: 'bg-blue-100 text-blue-800 border-blue-200',
      analysis: 'bg-purple-100 text-purple-800 border-purple-200',
      custom: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[category as keyof typeof colors] || colors.custom;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              🧮 Variables Creation Lab
            </h2>
            <p className="text-gray-600 mt-2">
              Create portfolio-wide variables using generic formulas that apply to all contracts
            </p>
          </div>
          <button
            onClick={() => setShowFormulaBuilder(!showFormulaBuilder)}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            {showFormulaBuilder ? 'Hide' : 'Show'} Custom Builder
          </button>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{filteredVariables.length}</div>
          <div className="text-sm text-gray-600">Available Variables</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
          <div className="text-2xl font-bold text-green-600">{calculatedVariables.length}</div>
          <div className="text-sm text-gray-600">Calculated Variables</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
          <div className="text-2xl font-bold text-purple-600">{genericFormulas.length}</div>
          <div className="text-sm text-gray-600">Generic Formulas</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-200">
          <div className="text-2xl font-bold text-orange-600">{contracts.length}</div>
          <div className="text-sm text-gray-600">Active Contracts</div>
        </div>
      </div>

      {/* Generic Formula Templates */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">⚡ Generic Formula Templates</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {genericFormulas.map((formula) => (
            <div key={formula.id} className={`border-2 rounded-lg p-4 transition-all hover:shadow-md ${getCategoryColor(formula.category)}`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{formula.icon}</span>
                  <h4 className="font-semibold">{formula.name}</h4>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-50 uppercase font-medium">
                  {formula.category}
                </span>
              </div>
              
              <p className="text-sm mb-3">{formula.description}</p>
              <p className="text-xs font-mono bg-white bg-opacity-50 p-2 rounded mb-3">{formula.formula}</p>
              
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Result: {formula.unit}</span>
                <button
                  onClick={() => applyGenericFormula(formula)}
                  className="bg-white bg-opacity-80 hover:bg-opacity-100 px-3 py-1 rounded text-sm font-medium transition-colors"
                >
                  Apply to All States
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Formula Builder */}
      {showFormulaBuilder && (
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">🔧 Custom Formula Builder</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variable Name
              </label>
              <input
                type="text"
                value={newVariableName}
                onChange={(e) => setNewVariableName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Custom Analysis"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Operation
              </label>
              <select
                value={selectedOperation}
                onChange={(e) => setSelectedOperation(e.target.value as MathOperation)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="multiply">Multiply (×)</option>
                <option value="add">Add (+)</option>
                <option value="subtract">Subtract (−)</option>
                <option value="divide">Divide (÷)</option>
                <option value="average">Average</option>
                <option value="max">Maximum</option>
                <option value="min">Minimum</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Period Filter
              </label>
              <select
                value={selectedTimePeriod}
                onChange={(e) => setSelectedTimePeriod(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Periods</option>
                {availableTimePeriods.map(period => (
                  <option key={period} value={period}>{period}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Filter
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="volume">Volume</option>
                <option value="price">Price</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleCreateVariable}
            disabled={!newVariableName.trim() || selectedVariables.length === 0}
            className="bg-green-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Custom Variable
          </button>
        </div>
      )}

      {/* Available Variables */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">📊 Available Variables</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVariables.map((variable) => (
            <div
              key={variable.id}
              onClick={() => {
                if (selectedVariables.includes(variable.id)) {
                  setSelectedVariables(prev => prev.filter(id => id !== variable.id));
                } else {
                  setSelectedVariables(prev => [...prev, variable.id]);
                }
              }}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                selectedVariables.includes(variable.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-gray-800 text-sm">{variable.name}</h4>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  variable.type === 'volume' ? 'bg-green-100 text-green-800' :
                  variable.type === 'price' ? 'bg-blue-100 text-blue-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {variable.type}
                </span>
              </div>
              
              <div className="text-xs text-gray-600 space-y-1">
                <div><strong>Unit:</strong> {variable.unit}</div>
                <div><strong>Source:</strong> {variable.source}</div>
                <div><strong>Data Points:</strong> {variable.timeSeriesData.length}</div>
                {variable.description && (
                  <div><strong>Description:</strong> {variable.description}</div>
                )}
              </div>

              {/* Preview of first few data points */}
              <div className="mt-3 text-xs">
                <strong>Sample Data:</strong>
                <div className="bg-gray-50 rounded p-2 mt-1 max-h-20 overflow-y-auto">
                  {variable.timeSeriesData.slice(0, 3).map((point, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{point.period}</span>
                      <span>{point.value.toFixed(2)} {variable.unit}</span>
                    </div>
                  ))}
                  {variable.timeSeriesData.length > 3 && (
                    <div className="text-gray-500">... +{variable.timeSeriesData.length - 3} more</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredVariables.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No variables found for the selected filters</p>
          </div>
        )}
      </div>

      {/* Selected Variables Summary */}
      {selectedVariables.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">
            Selected Variables ({selectedVariables.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {selectedVariables.map(varId => {
              const variable = availableVariables.find(v => v.id === varId);
              return variable ? (
                <span
                  key={varId}
                  className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  {variable.name}
                  <button
                    onClick={() => setSelectedVariables(prev => prev.filter(id => id !== varId))}
                    className="hover:bg-yellow-300 rounded-full w-4 h-4 flex items-center justify-center"
                  >
                    ×
                  </button>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* Calculated Variables */}
      {calculatedVariables.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">🧮 Calculated Variables</h3>
          
          <div className="space-y-4">
            {calculatedVariables.map((variable) => (
              <div key={variable.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-800">{variable.name}</h4>
                    <p className="text-sm text-gray-600">{variable.description}</p>
                  </div>
                  <button
                    onClick={() => setCalculatedVariables(prev => prev.filter(v => v.id !== variable.id))}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="text-left p-2">Period</th>
                        <th className="text-left p-2">Value</th>
                        <th className="text-left p-2">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variable.timeSeriesData.slice(0, 5).map((point, index) => (
                        <tr key={index} className="border-t border-gray-200">
                          <td className="p-2">{point.period}</td>
                          <td className="p-2 font-medium">{point.value.toLocaleString()}</td>
                          <td className="p-2">{variable.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {variable.timeSeriesData.length > 5 && (
                    <div className="text-gray-500 text-center py-2">
                      ... and {variable.timeSeriesData.length - 5} more periods
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-800 mb-4">💡 How to Use Generic Formulas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-700">
          <div>
            <h4 className="font-semibold mb-2">Step 1: Choose a Generic Formula</h4>
            <p>Select from pre-built formulas like "Floating Revenue" or "Mark-to-Market P&L" that automatically apply to all contracts.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Step 2: Apply to Portfolio</h4>
            <p>Click "Apply to All States" to generate the calculation for each state in your portfolio automatically.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Step 3: View Results</h4>
            <p>Review the calculated variables section to see your portfolio-wide metrics and analysis.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Step 4: Build Custom Formulas</h4>
            <p>Use the custom builder to create your own calculations by selecting variables and mathematical operations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}