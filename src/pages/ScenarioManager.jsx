// src/pages/ScenarioManager.jsx - Updated Scenario Manager with Global Context
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useScenarios } from '@/contexts/ScenarioContext';

const ScenarioManager = () => {
  const { assets, constants } = usePortfolio();
  const { 
    scenarios, 
    activeScenario, 
    createScenario, 
    deleteScenario, 
    updateScenarioValue,
    hasModifications 
  } = useScenarios();
  
  const [newScenarioName, setNewScenarioName] = useState('');
  const [hideUnchanged, setHideUnchanged] = useState(false);

  // Define all available parameters
  const allParameters = useMemo(() => {
    const params = [
      // Platform Parameters
      { 
        category: 'Platform', 
        key: 'platformOpex', 
        label: 'Platform Opex ($M/year)', 
        getValue: () => constants.platformOpex || 4.2 
      },
      { 
        category: 'Platform', 
        key: 'platformOpexEscalation', 
        label: 'Platform Opex Escalation (%)', 
        getValue: () => constants.platformOpexEscalation || 2.5 
      },
      { 
        category: 'Platform', 
        key: 'dividendPolicy', 
        label: 'Dividend Policy (%)', 
        getValue: () => constants.dividendPolicy || 85 
      },
      { 
        category: 'Platform', 
        key: 'minimumCashBalance', 
        label: 'Minimum Cash ($M)', 
        getValue: () => constants.minimumCashBalance || 5.0 
      },
      { 
        category: 'Platform', 
        key: 'corporateTaxRate', 
        label: 'Corporate Tax Rate (%)', 
        getValue: () => constants.corporateTaxRate || 0 
      },
      
      // Market Parameters
      { 
        category: 'Market', 
        key: 'escalation', 
        label: 'Price Escalation (%)', 
        getValue: () => constants.escalation || 2.5 
      },
      { 
        category: 'Market', 
        key: 'volumeVariation', 
        label: 'Volume Risk (±%)', 
        getValue: () => constants.volumeVariation || 20 
      },
      { 
        category: 'Market', 
        key: 'greenPriceVariation', 
        label: 'Green Price Risk (±%)', 
        getValue: () => constants.greenPriceVariation || 20 
      },
      { 
        category: 'Market', 
        key: 'EnergyPriceVariation', 
        label: 'Energy Price Risk (±%)', 
        getValue: () => constants.EnergyPriceVariation || 20 
      },
      
      // Discount Rates
      { 
        category: 'Finance', 
        key: 'discountRates.contract', 
        label: 'Contract Discount Rate (%)', 
        getValue: () => (constants.discountRates?.contract || 0.08) * 100 
      },
      { 
        category: 'Finance', 
        key: 'discountRates.merchant', 
        label: 'Merchant Discount Rate (%)', 
        getValue: () => (constants.discountRates?.merchant || 0.10) * 100 
      },
    ];

    // Add asset-specific parameters
    if (assets && typeof assets === 'object') {
      Object.values(assets).forEach(asset => {
        if (asset && asset.name) {
          params.push(
            { 
              category: 'Assets', 
              key: `assets.${asset.name}.capacity`, 
              label: `${asset.name} - Capacity (MW)`, 
              getValue: () => asset.capacity || 0 
            },
            { 
              category: 'Assets', 
              key: `assets.${asset.name}.volumeLossAdjustment`, 
              label: `${asset.name} - Volume Loss (%)`, 
              getValue: () => asset.volumeLossAdjustment || 95 
            },
            { 
              category: 'Assets', 
              key: `assetCosts.${asset.name}.capex`, 
              label: `${asset.name} - CAPEX ($M)`, 
              getValue: () => constants.assetCosts?.[asset.name]?.capex || 0 
            },
            { 
              category: 'Assets', 
              key: `assetCosts.${asset.name}.operatingCosts`, 
              label: `${asset.name} - Operating Costs ($M)`, 
              getValue: () => constants.assetCosts?.[asset.name]?.operatingCosts || 0 
            },
            { 
              category: 'Assets', 
              key: `assetCosts.${asset.name}.terminalValue`, 
              label: `${asset.name} - Terminal Value ($M)`, 
              getValue: () => constants.assetCosts?.[asset.name]?.terminalValue || 0 
            }
          );
        }
      });
    }

    return params;
  }, [assets, constants]);

  // Get value for a parameter in a specific scenario
  const getScenarioValue = (scenario, parameter) => {
    if (scenario.id === 'base') {
      return parameter.getValue();
    }
    
    return scenario.values[parameter.key] !== undefined 
      ? scenario.values[parameter.key] 
      : parameter.getValue();
  };

  // Create new scenario
  const handleCreateScenario = () => {
    if (!newScenarioName.trim()) return;

    createScenario(newScenarioName.trim());
    setNewScenarioName('');
  };

  // Check if parameter has any changes across scenarios
  const hasChanges = (parameter) => {
    const baseValue = parameter.getValue();
    return scenarios.some(scenario => {
      if (scenario.id === 'base') return false;
      const scenarioValue = scenario.values[parameter.key];
      return scenarioValue !== undefined && scenarioValue !== baseValue;
    });
  };

  // Filter parameters based on hideUnchanged setting
  const visibleParameters = hideUnchanged 
    ? allParameters.filter(hasChanges)
    : allParameters;

  // Group parameters by category
  const groupedParameters = visibleParameters.reduce((groups, param) => {
    if (!groups[param.category]) {
      groups[param.category] = [];
    }
    groups[param.category].push(param);
    return groups;
  }, {});

  // Check if we have any assets to work with
  const hasAssets = assets && typeof assets === 'object' && Object.keys(assets).length > 0;

  if (!hasAssets) {
    return (
      <div className="w-full p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Scenario Manager</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64">
            <p className="text-lg font-medium text-gray-500">No Assets Available</p>
            <p className="text-sm text-gray-400 mt-2">
              Please add assets in the Asset Definition tab before creating scenarios
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Scenario Manager</h1>
          <p className="text-gray-600">Compare different modeling scenarios side-by-side</p>
          <div className="mt-2">
            <Badge variant={activeScenario === 'base' ? 'default' : 'secondary'}>
              Active: {scenarios.find(s => s.id === activeScenario)?.name || 'Base'}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => setHideUnchanged(!hideUnchanged)}
            className="flex items-center gap-2"
          >
            {hideUnchanged ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {hideUnchanged ? 'Show All' : 'Hide Unchanged'}
          </Button>
          
          <Badge variant="outline">
            {Object.keys(assets).length} assets loaded
          </Badge>
        </div>
      </div>

      {/* Create New Scenario */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Scenario</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>Scenario Name</Label>
              <Input
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                placeholder="e.g., High Growth, Conservative, Stressed"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateScenario()}
              />
            </div>
            <Button onClick={handleCreateScenario} disabled={!newScenarioName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Scenario
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Scenario Comparison</CardTitle>
          <div className="text-sm text-gray-600">
            {hideUnchanged 
              ? `Showing ${visibleParameters.length} parameters with changes`
              : `Showing all ${allParameters.length} parameters`
            }
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-80">Parameter</TableHead>
                  {scenarios.map(scenario => (
                    <TableHead key={scenario.id} className="text-center min-w-40">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{scenario.name}</span>
                          {scenario.id === activeScenario && (
                            <Badge variant="secondary" className="text-xs">Active</Badge>
                          )}
                          {hasModifications(scenario.id) && (
                            <div className="w-2 h-2 bg-orange-400 rounded-full" title="Modified" />
                          )}
                        </div>
                        {scenario.id !== 'base' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteScenario(scenario.id)}
                            className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedParameters).map(([category, parameters]) => (
                  <React.Fragment key={category}>
                    <TableRow className="bg-gray-50">
                      <TableCell colSpan={scenarios.length + 1} className="font-semibold text-gray-700">
                        {category}
                      </TableCell>
                    </TableRow>
                    {parameters.map(parameter => {
                      const baseValue = parameter.getValue();
                      
                      return (
                        <TableRow key={parameter.key}>
                          <TableCell className="font-medium">{parameter.label}</TableCell>
                          {scenarios.map(scenario => {
                            const value = getScenarioValue(scenario, parameter);
                            const isChanged = scenario.id !== 'base' && 
                                             scenario.values[parameter.key] !== undefined;
                            
                            return (
                              <TableCell key={scenario.id} className="text-center">
                                {scenario.id === 'base' ? (
                                  <span className="text-blue-600 font-medium">
                                    {typeof value === 'number' ? value.toFixed(2) : value}
                                  </span>
                                ) : (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={scenario.values[parameter.key] !== undefined 
                                      ? scenario.values[parameter.key] 
                                      : baseValue}
                                    onChange={(e) => updateScenarioValue(scenario.id, parameter.key, parseFloat(e.target.value) || 0)}
                                    className={`w-full text-center ${isChanged ? 'bg-yellow-50 border-yellow-300' : ''}`}
                                  />
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium text-blue-800">Total Scenarios</div>
              <div className="text-blue-600">{scenarios.length}</div>
            </div>
            <div>
              <div className="font-medium text-blue-800">Active Scenario</div>
              <div className="text-blue-600">{scenarios.find(s => s.id === activeScenario)?.name || 'Base'}</div>
            </div>
            <div>
              <div className="font-medium text-blue-800">Modified Parameters</div>
              <div className="text-blue-600">
                {allParameters.filter(hasChanges).length} of {allParameters.length}
              </div>
            </div>
            <div>
              <div className="font-medium text-blue-800">Legend</div>
              <div className="text-blue-600 space-y-1">
                <div>🔵 Base values (current inputs)</div>
                <div>🟡 Modified values</div>
                <div>🟠 Modified indicator</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScenarioManager;