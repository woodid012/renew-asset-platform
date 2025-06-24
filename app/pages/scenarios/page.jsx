'use client'

import { useState } from 'react'
import { 
  BarChart3,
  Settings,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  Copy
} from 'lucide-react'

export default function ScenarioManagerPage() {
  const [activeScenario, setActiveScenario] = useState('base')

  // Dummy scenario data
  const scenarios = [
    {
      id: 'base',
      name: 'Base Case',
      description: 'Standard assumptions and market conditions',
      status: 'completed',
      variables: {
        electricityPrice: 100,
        capacityFactor: 100,
        capex: 100,
        opex: 100,
        interestRate: 100
      }
    },
    {
      id: 'optimistic',
      name: 'Optimistic Case',
      description: 'Favorable market conditions and performance',
      status: 'running',
      variables: {
        electricityPrice: 115,
        capacityFactor: 110,
        capex: 95,
        opex: 95,
        interestRate: 90
      }
    },
    {
      id: 'stress',
      name: 'Stress Case',
      description: 'Conservative assumptions and challenging conditions',
      status: 'pending',
      variables: {
        electricityPrice: 85,
        capacityFactor: 90,
        capex: 110,
        opex: 105,
        interestRate: 110
      }
    }
  ]

  const variableLabels = {
    electricityPrice: 'Electricity Price',
    capacityFactor: 'Capacity Factor',
    capex: 'CAPEX',
    opex: 'OPEX',
    interestRate: 'Interest Rate'
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'running':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'running':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Scenario Manager</h1>
        <p className="text-gray-600">Change multiple variables and compare portfolio performance</p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <span className="text-blue-800 font-medium">Work in Progress</span>
          </div>
          <p className="text-blue-700 text-sm mt-2">
            This feature is under development. The interface shown below represents the planned functionality 
            for scenario analysis and variable sensitivity testing.
          </p>
        </div>
      </div>

      {/* Scenario Controls */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Scenario Controls</h3>
            <div className="flex space-x-2">
              <button className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Plus className="w-4 h-4" />
                <span>New Scenario</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Play className="w-4 h-4" />
                <span>Run All</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  activeScenario === scenario.id
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setActiveScenario(scenario.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{scenario.name}</h4>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(scenario.status)}
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(scenario.status)}`}>
                      {scenario.status}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">{scenario.description}</p>
                
                {/* Variable Preview */}
                <div className="space-y-2">
                  {Object.entries(scenario.variables).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-gray-500">{variableLabels[key]}:</span>
                      <span className={value === 100 ? 'text-gray-700' : value > 100 ? 'text-green-600' : 'text-red-600'}>
                        {value}%
                      </span>
                    </div>
                  ))}
                  {Object.keys(scenario.variables).length > 3 && (
                    <div className="text-xs text-gray-400">
                      +{Object.keys(scenario.variables).length - 3} more variables
                    </div>
                  )}
                </div>

                <div className="flex justify-between mt-3 pt-3 border-t border-gray-200">
                  <button className="text-xs text-blue-600 hover:text-blue-800">
                    <Copy className="w-3 h-3 inline mr-1" />
                    Duplicate
                  </button>
                  {scenario.id !== 'base' && (
                    <button className="text-xs text-red-600 hover:text-red-800">
                      <Trash2 className="w-3 h-3 inline mr-1" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Variable Editor */}
      {activeScenario && (
        <div className="bg-white rounded-lg shadow border">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Variable Editor - {scenarios.find(s => s.id === activeScenario)?.name}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Adjust variables as percentage of base case (100% = no change)
            </p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(scenarios.find(s => s.id === activeScenario)?.variables || {}).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {variableLabels[key]}
                  </label>
                  <div className="relative">
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={value}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      disabled
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>50%</span>
                      <span className={`font-medium ${value === 100 ? 'text-gray-700' : value > 100 ? 'text-green-600' : 'text-red-600'}`}>
                        {value}%
                      </span>
                      <span>150%</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {value > 100 ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : value < 100 ? (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    ) : (
                      <div className="w-4 h-4" />
                    )}
                    <span className="text-xs text-gray-600">
                      {value > 100 ? `+${value - 100}% increase` : value < 100 ? `${100 - value}% decrease` : 'Base case value'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-between">
              <div className="flex space-x-2">
                <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset to Base</span>
                </button>
              </div>
              <div className="flex space-x-2">
                <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Save & Run Scenario
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Preview */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Scenario Comparison</h3>
          <p className="text-sm text-gray-600 mt-1">
            Portfolio IRR and key metrics across different scenarios
          </p>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-gray-900">Scenario</th>
                  <th className="text-right py-2 font-medium text-gray-900">Portfolio IRR</th>
                  <th className="text-right py-2 font-medium text-gray-900">NPV ($M)</th>
                  <th className="text-right py-2 font-medium text-gray-900">Year 10 Revenue ($M)</th>
                  <th className="text-right py-2 font-medium text-gray-900">Max Gearing</th>
                  <th className="text-center py-2 font-medium text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 font-medium">Base Case</td>
                  <td className="text-right py-3">12.5%</td>
                  <td className="text-right py-3">$245.2</td>
                  <td className="text-right py-3">$89.4</td>
                  <td className="text-right py-3">70%</td>
                  <td className="text-center py-3">
                    <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 font-medium">Optimistic Case</td>
                  <td className="text-right py-3 text-green-600">15.8%</td>
                  <td className="text-right py-3 text-green-600">$312.7</td>
                  <td className="text-right py-3 text-green-600">$108.2</td>
                  <td className="text-right py-3 text-green-600">75%</td>
                  <td className="text-center py-3">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
                <tr>
                  <td className="py-3 font-medium">Stress Case</td>
                  <td className="text-right py-3 text-red-600">8.9%</td>
                  <td className="text-right py-3 text-red-600">$178.3</td>
                  <td className="text-right py-3 text-red-600">$71.8</td>
                  <td className="text-right py-3 text-red-600">62%</td>
                  <td className="text-center py-3">
                    <AlertCircle className="w-4 h-4 text-yellow-500 mx-auto" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Status Footer */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            <span className="text-orange-800 font-medium">
              Scenario Manager - Development Preview
            </span>
          </div>
          <div className="text-orange-600 text-sm">
            Coming Soon: Monte Carlo analysis, correlation modeling, batch runs
          </div>
        </div>
        <div className="mt-2 text-sm text-orange-700">
          This will enable testing multiple variable combinations simultaneously, 
          automated sensitivity analysis, and portfolio risk assessment across different market scenarios.
        </div>
      </div>
    </div>
  )
}