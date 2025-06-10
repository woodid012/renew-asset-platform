'use client';

import { useState, useMemo } from 'react';
import { Contract, SettingsData } from '@/app/types';

// Enhanced time series data structure
interface TimeSeriesVariable {
  id: string;
  name: string;
  type: 'volume' | 'price' | 'capacity' | 'temperature' | 'custom';
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

interface VariableFormula {
  id: string;
  name: string;
  description: string;
  operation: MathOperation;
  variables: string[]; // Array of variable IDs
  unit: string;
  formula: string; // Human readable formula
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

  // Generate available variables from contracts and market data
  const availableVariables = useMemo((): TimeSeriesVariable[] => {
    const variables: TimeSeriesVariable[] = [];

    // 1. Extract contract volume data
    contracts.forEach(contract => {
      if (contract.timeSeriesData?.length) {
        variables.push({
          id: `contract_volume_${contract._id}`,
          name: `${contract.name} - Volume`,
          type: 'volume',
          unit: 'MWh',
          source: 'contract',
          contractId: contract._id,
          description: `Volume data from ${contract.name} (${contract.type})`,
          timeSeriesData: contract.timeSeriesData.map(d => ({
            period: d.period,
            value: d.volume,
            metadata: { contractType: contract.type, state: contract.state }
          }))
        });
      }

      // Contract strike prices (if time series)
      if (contract.priceTimeSeries?.length) {
        variables.push({
          id: `contract_price_${contract._id}`,
          name: `${contract.name} - Strike Price`,
          type: 'price',
          unit: '$/MWh',
          source: 'contract',
          contractId: contract._id,
          description: `Strike price time series from ${contract.name}`,
          timeSeriesData: contract.priceTimeSeries.map((price, index) => {
            const startDate = new Date(contract.startDate);
            startDate.setMonth(startDate.getMonth() + index);
            return {
              period: `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`,
              value: price,
              metadata: { interval: contract.priceInterval }
            };
          })
        });
      }
    });

    // 2. Extract market price data
    Object.entries(marketPrices).forEach(([state, prices]) => {
      variables.push({
        id: `market_price_${state}`,
        name: `${state} - Market Price`,
        type: 'price',
        unit: '$/MWh',
        source: 'market',
        description: `Market price curve for ${state}`,
        timeSeriesData: prices.map((price, index) => ({
          period: `2025-${(index + 1).toString().padStart(2, '0')}`, // Assuming 2025 monthly data
          value: price,
          metadata: { state, source: 'Aurora Jan 2025' }
        }))
      });
    });

    // 3. Add calculated variables
    calculatedVariables.forEach(variable => {
      variables.push(variable);
    });

    return variables;
  }, [contracts, marketPrices, calculatedVariables]);

  // Time series alignment utilities
  const alignTimeSeries = (variables: TimeSeriesVariable[]): Array<{
    period: string;
    values: { [variableId: string]: number };
    metadata: Record<string, any>;
  }> => {
    if (variables.length === 0) return [];

    // Get all unique periods
    const allPeriods = new Set<string>();
    variables.forEach(variable => {
      variable.timeSeriesData.forEach(point => {
        allPeriods.add(point.period);
      });
    });

    const sortedPeriods = Array.from(allPeriods).sort();

    // Align data for each period
    return sortedPeriods.map(period => {
      const values: { [variableId: string]: number } = {};
      const metadata: Record<string, any> = { period };

      variables.forEach(variable => {
        const dataPoint = variable.timeSeriesData.find(d => d.period === period);
        if (dataPoint) {
          values[variable.id] = dataPoint.value;
          metadata[`${variable.id}_meta`] = dataPoint.metadata;
        } else {
          values[variable.id] = 0; // or interpolate
        }
      });

      return { period, values, metadata };
    });
  };

  // Calculate new variable based on operation
  const calculateNewVariable = (
    name: string,
    operation: MathOperation,
    selectedVarIds: string[]
  ): TimeSeriesVariable | null => {
    if (selectedVarIds.length < 2 && operation !== 'average') {
      return null;
    }

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

    // Determine unit for new variable
    const getResultUnit = (): string => {
      const firstVar = selectedVars[0];
      const secondVar = selectedVars[1];

      if (operation === 'multiply' && firstVar?.unit === 'MWh' && secondVar?.unit === '$/MWh') {
        return '$'; // Revenue
      }
      if (operation === 'multiply' && firstVar?.unit === '$/MWh' && secondVar?.unit === 'MWh') {
        return '$'; // Revenue
      }
      if (operation === 'divide' && firstVar?.unit === '$' && secondVar?.unit === 'MWh') {
        return '$/MWh'; // Price
      }
      
      return selectedVars[0]?.unit || 'units';
    };

    return {
      id: `calculated_${Date.now()}`,
      name,
      type: 'custom',
      unit: getResultUnit(),
      source: 'calculated',
      description: `${operation} of: ${selectedVars.map(v => v.name).join(', ')}`,
      timeSeriesData: newTimeSeriesData
    };
  };

  // Create new variable
  const handleCreateVariable = () => {
    if (!newVariableName.trim() || selectedVariables.length < 1) {
      alert('Please enter a name and select at least one variable');
      return;
    }

    const newVariable = calculateNewVariable(newVariableName, selectedOperation, selectedVariables);
    if (newVariable) {
      setCalculatedVariables(prev => [...prev, newVariable]);
      setNewVariableName('');
      setSelectedVariables([]);
      setShowFormulaBuilder(false);
    }
  };

  // Get suggested formulas based on selected variables
  const getSuggestedFormulas = (): VariableFormula[] => {
    const suggestions: VariableFormula[] = [];

    // Look for volume + price combinations for revenue
    const volumeVars = availableVariables.filter(v => v.type === 'volume');
    const priceVars = availableVariables.filter(v => v.type === 'price');

    volumeVars.forEach(vol => {
      priceVars.forEach(price => {
        // Match by state or contract
        const volumeState = vol.timeSeriesData[0]?.metadata?.state;
        const priceState = price.timeSeriesData[0]?.metadata?.state;
        const sameContract = vol.contractId && vol.contractId === price.contractId;

        if (volumeState === priceState || sameContract) {
          suggestions.push({
            id: `revenue_${vol.id}_${price.id}`,
            name: `Revenue: ${vol.name.split(' - ')[0]} × ${price.name.split(' - ')[1]}`,
            description: `Calculate revenue by multiplying ${vol.name} by ${price.name}`,
            operation: 'multiply',
            variables: [vol.id, price.id],
            unit: '$',
            formula: `${vol.name} × ${price.name}`
          });
        }
      });
    });

    return suggestions;
  };

  const suggestedFormulas = getSuggestedFormulas();

  // Filter variables for display
  const getFilteredVariables = () => {
    if (selectedTimePeriod === 'all') return availableVariables;
    
    return availableVariables.filter(variable => 
      variable.timeSeriesData.some(point => point.period.startsWith(selectedTimePeriod))
    );
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
              Create new variables by combining time series data with smart matching
            </p>
          </div>
          <button
            onClick={() => setShowFormulaBuilder(!showFormulaBuilder)}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            {showFormulaBuilder ? 'Hide' : 'Show'} Formula Builder
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
          <div className="text-2xl font-bold text-purple-600">{suggestedFormulas.length}</div>
          <div className="text-sm text-gray-600">Smart Suggestions</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center border border-orange-200">
          <div className="text-2xl font-bold text-orange-600">{availableTimePeriods.length}</div>
          <div className="text-sm text-gray-600">Time Periods</div>
        </div>
      </div>

      {/* Formula Builder */}
      {showFormulaBuilder && (
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Create New Variable</h3>
          
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
                placeholder="e.g., Market Revenue"
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

          <button
            onClick={handleCreateVariable}
            disabled={!newVariableName.trim() || selectedVariables.length === 0}
            className="bg-green-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Variable
          </button>
        </div>
      )}

      {/* Smart Suggestions */}
      {suggestedFormulas.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">💡 Smart Suggestions</h3>
          <div className="space-y-3">
            {suggestedFormulas.slice(0, 5).map((formula) => (
              <div key={formula.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-purple-800">{formula.name}</h4>
                    <p className="text-sm text-purple-600 mt-1">{formula.description}</p>
                    <p className="text-xs text-gray-600 mt-2 font-mono">{formula.formula}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedVariables(formula.variables);
                      setSelectedOperation(formula.operation);
                      setNewVariableName(formula.name);
                      setShowFormulaBuilder(true);
                    }}
                    className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 transition-colors"
                  >
                    Use
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Variables */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">Available Variables</h3>
        
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
            <p>No variables found for the selected time period</p>
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
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Calculated Variables</h3>
          
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
    </div>
  );
}