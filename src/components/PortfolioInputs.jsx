import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortfolio } from '@/contexts/PortfolioContext';
import {
  DEFAULT_PLATFORM_COSTS,
  DEFAULT_TAX_DEPRECIATION,
  DEFAULT_RISK_PARAMETERS,
  DEFAULT_PROJECT_FINANCE,
  UI_CONSTANTS,
  getDefaultValue
} from '@/lib/default_constants';

const PortfolioInputs = () => {
  const { assets, constants, updateConstants } = usePortfolio();
  
  // Platform operating parameters
  const platformOpex = constants.platformOpex ?? DEFAULT_PLATFORM_COSTS.platformOpex;
  const platformOpexEscalation = constants.platformOpexEscalation ?? DEFAULT_PLATFORM_COSTS.platformOpexEscalation;
  const otherOpex = constants.otherOpex ?? DEFAULT_PLATFORM_COSTS.otherOpex;
  
  // Cash management parameters
  const dividendPolicy = constants.dividendPolicy ?? DEFAULT_PLATFORM_COSTS.dividendPolicy;
  const minimumCashBalance = constants.minimumCashBalance ?? DEFAULT_PLATFORM_COSTS.minimumCashBalance;
  
  // Tax parameters
  const corporateTaxRate = constants.corporateTaxRate ?? DEFAULT_TAX_DEPRECIATION.corporateTaxRate;
  const deprecationPeriods = constants.deprecationPeriods ?? DEFAULT_TAX_DEPRECIATION.deprecationPeriods;

  // Risk parameters
  const volumeVariation = constants.volumeVariation ?? DEFAULT_RISK_PARAMETERS.volumeVariation;
  const greenPriceVariation = constants.greenPriceVariation ?? DEFAULT_RISK_PARAMETERS.greenPriceVariation;
  const energyPriceVariation = constants.EnergyPriceVariation ?? DEFAULT_RISK_PARAMETERS.EnergyPriceVariation;

  // Helper function to determine if a value is default (blue) or user-defined (black)
  const getValueStyle = (currentValue, defaultValue) => {
    const isDefault = currentValue === undefined || currentValue === null || currentValue === defaultValue;
    return isDefault ? UI_CONSTANTS.colors.defaultValue : UI_CONSTANTS.colors.userValue;
  };

  // Asset cost management
  const handleAssetCostChange = (assetName, field, value) => {
    const asset = Object.values(assets).find(a => a.name === assetName);
    if (!asset) return;

    // Process the value based on field type
    let processedValue;
    if (field === 'maxGearing' || field === 'interestRate') {
      processedValue = value === '' ? '' : parseFloat(value) / 100;
    } else {
      processedValue = value === '' ? '' : parseFloat(value);
    }
    
    const updatedAssetCosts = {
      ...constants.assetCosts,
      [assetName]: {
        ...constants.assetCosts[assetName],
        [field]: isNaN(processedValue) ? '' : processedValue
      }
    };
    
    updateConstants('assetCosts', updatedAssetCosts);
  };

  // Handle depreciation period changes
  const handleDepreciationChange = (assetType, value) => {
    const updatedPeriods = {
      ...deprecationPeriods,
      [assetType]: parseInt(value) || 0
    };
    updateConstants('deprecationPeriods', updatedPeriods);
  };

  // Get default value for asset cost field
  const getAssetCostDefault = (field, assetType, capacity) => {
    const parsedCapacity = parseFloat(capacity) || 100;
    
    switch(field) {
      case 'capex':
        return getDefaultValue('capex', 'default', assetType) * parsedCapacity;
      case 'operatingCosts':
        return getDefaultValue('opex', 'default', assetType) * parsedCapacity;
      case 'operatingCostEscalation':
        return DEFAULT_PROJECT_FINANCE.opexEscalation;
      case 'terminalValue':
        return getDefaultValue('terminal', 'default', assetType) * parsedCapacity;
      case 'maxGearing':
        return DEFAULT_PROJECT_FINANCE.maxGearing;
      case 'targetDSCRContract':
        return DEFAULT_PROJECT_FINANCE.targetDSCRContract;
      case 'targetDSCRMerchant':
        return DEFAULT_PROJECT_FINANCE.targetDSCRMerchant;
      case 'interestRate':
        return DEFAULT_PROJECT_FINANCE.interestRate;
      case 'tenorYears':
        return getDefaultValue('finance', 'tenorYears', assetType);
      default:
        return 0;
    }
  };

  return (
    <div className="w-full p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Portfolio Configuration</h1>
        <div className="text-sm text-gray-500">
          All settings auto-save and trigger recalculation
        </div>
      </div>

      <Tabs defaultValue="platform" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="platform">Platform & Tax</TabsTrigger>
          <TabsTrigger value="assets">Asset Costs</TabsTrigger>
          <TabsTrigger value="risk">Risk Parameters</TabsTrigger>
          <TabsTrigger value="finance">Project Finance</TabsTrigger>
        </TabsList>

        {/* Platform Management & Tax Settings */}
        <TabsContent value="platform" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Management Costs</CardTitle>
              <CardDescription>Corporate-level operational costs and cash management policies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <Label>Platform Management Opex ($M/year)</Label>
                    <Input 
                      type="number"
                      value={platformOpex}
                      onChange={(e) => updateConstants('platformOpex', parseFloat(e.target.value) || 0)}
                      placeholder="Annual cost in $M"
                      className={getValueStyle(platformOpex, DEFAULT_PLATFORM_COSTS.platformOpex)}
                    />
                    <p className="text-sm text-gray-500">Annual platform management cost</p>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label>Platform Opex Escalation (%/year)</Label>
                    <Input 
                      type="number"
                      value={platformOpexEscalation}
                      onChange={(e) => updateConstants('platformOpexEscalation', parseFloat(e.target.value) || 0)}
                      placeholder="Annual escalation %"
                      className={getValueStyle(platformOpexEscalation, DEFAULT_PLATFORM_COSTS.platformOpexEscalation)}
                    />
                    <p className="text-sm text-gray-500">Annual increase in platform costs</p>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label>Other Opex ($M/year)</Label>
                    <Input 
                      type="number"
                      value={otherOpex}
                      onChange={(e) => updateConstants('otherOpex', parseFloat(e.target.value) || 0)}
                      placeholder="Other annual costs in $M"
                      className={getValueStyle(otherOpex, DEFAULT_PLATFORM_COSTS.otherOpex)}
                    />
                    <p className="text-sm text-gray-500">Other annual operational costs</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <Label>Dividend Payout Ratio (%)</Label>
                    <Input 
                      type="number"
                      value={dividendPolicy}
                      onChange={(e) => updateConstants('dividendPolicy', parseFloat(e.target.value) || 0)}
                      placeholder="Dividend payout ratio %"
                      className={getValueStyle(dividendPolicy, DEFAULT_PLATFORM_COSTS.dividendPolicy)}
                    />
                    <p className="text-sm text-gray-500">Percentage of NPAT distributed as dividends</p>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <Label>Minimum Cash Balance ($M)</Label>
                    <Input 
                      type="number"
                      value={minimumCashBalance}
                      onChange={(e) => updateConstants('minimumCashBalance', parseFloat(e.target.value) || 0)}
                      placeholder="Minimum cash balance ($M)"
                      className={getValueStyle(minimumCashBalance, DEFAULT_PLATFORM_COSTS.minimumCashBalance)}
                    />
                    <p className="text-sm text-gray-500">Minimum cash balance before paying dividends</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax & Depreciation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Corporate Tax Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tax Rate (%)</label>
                  <Input 
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={corporateTaxRate}
                    onChange={(e) => updateConstants('corporateTaxRate', parseFloat(e.target.value) || 0)}
                    className="max-w-xs"
                  />
                  <p className="text-sm text-gray-500">
                    Corporate tax rate applied to taxable income
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Asset Depreciation Periods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Solar (Years)</label>
                    <Input 
                      type="number"
                      min="1"
                      max="40"
                      value={deprecationPeriods.solar}
                      onChange={(e) => handleDepreciationChange('solar', e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Wind (Years)</label>
                    <Input 
                      type="number"
                      min="1"
                      max="40"
                      value={deprecationPeriods.wind}
                      onChange={(e) => handleDepreciationChange('wind', e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Storage (Years)</label>
                    <Input 
                      type="number"
                      min="1"
                      max="40"
                      value={deprecationPeriods.storage}
                      onChange={(e) => handleDepreciationChange('storage', e.target.value)}
                      className="max-w-xs"
                    />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Asset depreciation periods for tax and accounting purposes
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Asset Costs & Project Finance */}
        <TabsContent value="assets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Costs & Project Finance</CardTitle>
              <CardDescription>Capital costs, operating costs, and debt parameters for each asset</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Capacity (MW)</TableHead>
                      <TableHead>CAPEX ($M)</TableHead>
                      <TableHead>Opex ($M/year)</TableHead>
                      <TableHead>Opex Escalation (%)</TableHead>
                      <TableHead>Terminal Value ($M)</TableHead>
                      <TableHead>Max Gearing (%)</TableHead>
                      <TableHead>DSCR Contract</TableHead>
                      <TableHead>DSCR Merchant</TableHead>
                      <TableHead>Interest Rate (%)</TableHead>
                      <TableHead>Tenor (years)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(assets).length > 0 ? (
                      Object.values(assets).map((asset) => {
                        const assetCost = constants.assetCosts?.[asset.name] || {};
                        return (
                          <TableRow key={asset.name}>
                            <TableCell className="font-medium">{asset.name}</TableCell>
                            <TableCell>{asset.type ? (asset.type.charAt(0).toUpperCase() + asset.type.slice(1)) : "-"}</TableCell>
                            <TableCell>{asset.capacity || "-"}</TableCell>
                            
                            <TableCell>
                              <Input
                                type="number"
                                value={assetCost.capex || ''}
                                onChange={(e) => handleAssetCostChange(asset.name, 'capex', e.target.value)}
                                className="w-24"
                                placeholder={getAssetCostDefault('capex', asset.type, asset.capacity).toFixed(1)}
                              />
                            </TableCell>
                            
                            <TableCell>
                              <Input
                                type="number"
                                value={assetCost.operatingCosts || ''}
                                onChange={(e) => handleAssetCostChange(asset.name, 'operatingCosts', e.target.value)}
                                className="w-24"
                                placeholder={getAssetCostDefault('operatingCosts', asset.type, asset.capacity).toFixed(2)}
                              />
                            </TableCell>
                            
                            <TableCell>
                              <Input
                                type="number"
                                value={assetCost.operatingCostEscalation || ''}
                                onChange={(e) => handleAssetCostChange(asset.name, 'operatingCostEscalation', e.target.value)}
                                className="w-20"
                                placeholder={getAssetCostDefault('operatingCostEscalation', asset.type, asset.capacity)}
                              />
                            </TableCell>
                            
                            <TableCell>
                              <Input
                                type="number"
                                value={assetCost.terminalValue || ''}
                                onChange={(e) => handleAssetCostChange(asset.name, 'terminalValue', e.target.value)}
                                className="w-24"
                                placeholder={getAssetCostDefault('terminalValue', asset.type, asset.capacity).toFixed(1)}
                              />
                            </TableCell>
                            
                            <TableCell>
                              <Input
                                type="number"
                                value={assetCost.maxGearing ? (assetCost.maxGearing * 100).toFixed(1) : ''}
                                onChange={(e) => handleAssetCostChange(asset.name, 'maxGearing', e.target.value)}
                                className="w-20"
                                placeholder={getAssetCostDefault('maxGearing', asset.type, asset.capacity)}
                              />
                            </TableCell>
                            
                            <TableCell>
                              <Input
                                type="number"
                                value={assetCost.targetDSCRContract || ''}
                                onChange={(e) => handleAssetCostChange(asset.name, 'targetDSCRContract', e.target.value)}
                                className="w-20"
                                placeholder={getAssetCostDefault('targetDSCRContract', asset.type, asset.capacity)}
                              />
                            </TableCell>
                            
                            <TableCell>
                              <Input
                                type="number"
                                value={assetCost.targetDSCRMerchant || ''}
                                onChange={(e) => handleAssetCostChange(asset.name, 'targetDSCRMerchant', e.target.value)}
                                className="w-20"
                                placeholder={getAssetCostDefault('targetDSCRMerchant', asset.type, asset.capacity)}
                              />
                            </TableCell>
                            
                            <TableCell>
                              <Input
                                type="number"
                                value={assetCost.interestRate ? (assetCost.interestRate * 100).toFixed(1) : ''}
                                onChange={(e) => handleAssetCostChange(asset.name, 'interestRate', e.target.value)}
                                className="w-20"
                                placeholder={getAssetCostDefault('interestRate', asset.type, asset.capacity)}
                              />
                            </TableCell>
                            
                            <TableCell>
                              <Input
                                type="number"
                                value={assetCost.tenorYears || ''}
                                onChange={(e) => handleAssetCostChange(asset.name, 'tenorYears', e.target.value)}
                                className="w-20"
                                placeholder={getAssetCostDefault('tenorYears', asset.type, asset.capacity)}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-4 text-muted-foreground">
                          No assets in portfolio
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Parameters */}
        <TabsContent value="risk" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Risk Analysis Parameters</CardTitle>
              <CardDescription>Monte Carlo simulation parameters for earnings at risk analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Volume Sensitivity (±%)</Label>
                  <Input 
                    type="number"
                    value={volumeVariation}
                    onChange={(e) => updateConstants('volumeVariation', parseInt(e.target.value) || 0)}
                    className={getValueStyle(volumeVariation, DEFAULT_RISK_PARAMETERS.volumeVariation)}
                  />
                  <p className="text-sm text-gray-500">Volume risk range for Monte Carlo analysis</p>
                </div>

                <div className="space-y-2">
                  <Label>Energy Price Sensitivity (±%)</Label>
                  <Input 
                    type="number"
                    value={energyPriceVariation}
                    onChange={(e) => updateConstants('EnergyPriceVariation', parseInt(e.target.value) || 0)}
                    className={getValueStyle(energyPriceVariation, DEFAULT_RISK_PARAMETERS.EnergyPriceVariation)}
                  />
                  <p className="text-sm text-gray-500">Energy price risk range for Monte Carlo analysis</p>
                </div>

                <div className="space-y-2">
                  <Label>Green Price Sensitivity (±%)</Label>
                  <Input 
                    type="number"
                    value={greenPriceVariation}
                    onChange={(e) => updateConstants('greenPriceVariation', parseInt(e.target.value) || 0)}
                    className={getValueStyle(greenPriceVariation, DEFAULT_RISK_PARAMETERS.greenPriceVariation)}
                  />
                  <p className="text-sm text-gray-500">Green certificate price risk range for Monte Carlo analysis</p>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">Risk Analysis Notes</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Merchant revenue affected by both volume and price risks</li>
                  <li>• Green and Energy prices vary independently</li>
                  <li>• PPA revenue affected by volume risk only</li>
                  <li>• Monte Carlo simulations use 1000 scenarios for statistical significance</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Project Finance */}
        <TabsContent value="finance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Finance Assumptions</CardTitle>
              <CardDescription>Default financing parameters applied to new assets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Maximum Gearing (%)</Label>
                    <Input 
                      type="number"
                      value={DEFAULT_PROJECT_FINANCE.maxGearing}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-sm text-gray-500">Default maximum debt-to-total ratio</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Target DSCR (Contracted) (x)</Label>
                    <Input 
                      type="number"
                      value={DEFAULT_PROJECT_FINANCE.targetDSCRContract}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-sm text-gray-500">Debt service coverage for contracted revenue</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Target DSCR (Merchant) (x)</Label>
                    <Input 
                      type="number"
                      value={DEFAULT_PROJECT_FINANCE.targetDSCRMerchant}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-sm text-gray-500">Debt service coverage for merchant revenue</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Interest Rate (%)</Label>
                    <Input 
                      type="number"
                      value={DEFAULT_PROJECT_FINANCE.interestRate}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-sm text-gray-500">Default project finance interest rate</p>
                  </div>

                  <div className="space-y-2">
                    <Label>OpEx Escalation (%)</Label>
                    <Input 
                      type="number"
                      value={DEFAULT_PROJECT_FINANCE.opexEscalation}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-sm text-gray-500">Annual operating cost escalation</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Default Loan Tenors</Label>
                    <div className="text-sm space-y-1">
                      <div>Solar: {DEFAULT_PROJECT_FINANCE.tenorYears.solar} years</div>
                      <div>Wind: {DEFAULT_PROJECT_FINANCE.tenorYears.wind} years</div>
                      <div>Storage: {DEFAULT_PROJECT_FINANCE.tenorYears.storage} years</div>
                    </div>
                    <p className="text-sm text-gray-500">Default loan terms by technology</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-medium text-amber-800 mb-2">Project Finance Notes</h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• Individual asset parameters can be modified in the Asset Costs tab above</li>
                  <li>• DSCR requirements vary based on revenue type (contracted vs merchant)</li>
                  <li>• Auto-gearing functionality optimizes debt levels to meet DSCR constraints</li>
                  <li>• Portfolio refinancing may offer improved terms for multiple assets</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PortfolioInputs;