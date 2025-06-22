// components/AssetForm.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAssetForm } from '@/hooks/useAssetForm';
import { useAssetTemplates } from '@/hooks/useAssetTemplates';
import { useAssetManagement } from '@/hooks/useAssetManagement';
import AssetFormContract from './AssetFormContract';
import { formatNumericValue } from '@/utils/assetUtils';

const AssetForm = ({ assetId }) => {
  const { assets, removeAsset, addContract, removeContract, updateContract } = useAssetManagement();
  const { getSortedTemplates } = useAssetTemplates();
  const asset = assets[assetId];
  
  const {
    assetCosts,
    year1Volume,
    selectedTemplate,
    outOfSync,
    handleAssetFieldUpdate,
    handleAssetDateUpdate,
    handleAssetConstructionDurationUpdate,
    handleAssetCostUpdate,
    handleTemplateSelection,
    isOpsStartValid,
    getValueStyle,
    getFieldDefault,
    getQuarterlyDefaults,
    getAssetCostDefault,
  } = useAssetForm(asset);

  if (!asset) {
    return <div>Asset not found</div>;
  }

  const sortedTemplates = getSortedTemplates();
  const quarterlyDefaults = getQuarterlyDefaults();

  const handleRemove = () => {
    removeAsset(assetId);
  };

  const handleAddContract = () => {
    addContract(assetId);
  };

  const handleRemoveContract = (contractId) => {
    removeContract(assetId, contractId);
  };

  const handleUpdateContract = (contractId, field, value) => {
    updateContract(assetId, contractId, field, value);
  };

  return (
    <div className="w-full p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Asset Configuration: {asset.name}</h1>
        <Button variant="ghost" size="icon" onClick={handleRemove} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Details</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="finance">Finance & Costs</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
        </TabsList>

        {/* Basic Asset Details */}
        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Information</CardTitle>
              <CardDescription>Basic asset details and configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {/* Template Selection */}
                  {!selectedTemplate && asset.name === `Default Asset ${asset.id}` && (
                    <div className="space-y-2">
                      <Label>Template</Label>
                      <Select onValueChange={handleTemplateSelection}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an existing renewable" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {sortedTemplates.map(renewable => (
                              <SelectItem key={renewable.id} value={renewable.id}>
                                {renewable.name} ({renewable.capacity} MW, {renewable.type})
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-gray-500">Start with existing asset template</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Asset Name</Label>
                    <Input
                      value={asset.name || ''}
                      onChange={(e) => handleAssetFieldUpdate('name', e.target.value)}
                      className={outOfSync.name ? "text-red-500" : ""}
                    />
                    <p className="text-sm text-gray-500">Unique identifier for this asset</p>
                  </div>

                  <div className="space-y-2">
                    <Label>State</Label>
                    <Select 
                      value={asset.state || ''} 
                      onValueChange={(value) => handleAssetFieldUpdate('state', value)}
                    >
                      <SelectTrigger className={outOfSync.state ? "text-red-500" : ""}>
                        <SelectValue placeholder="Select State" />
                      </SelectTrigger>
                      <SelectContent>
                        {['NSW', 'VIC', 'SA', 'QLD'].map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-500">Location affects capacity factors and pricing</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Technology Type</Label>
                    <Select 
                      value={asset.type || ''} 
                      onValueChange={(value) => handleAssetFieldUpdate('type', value)}
                    >
                      <SelectTrigger className={outOfSync.type ? "text-red-500" : ""}>
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: 'wind', label: 'Wind' },
                          { value: 'solar', label: 'Solar' },
                          { value: 'storage', label: 'Storage' }
                        ].map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-gray-500">Technology affects costs and performance defaults</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Capacity (MW)</Label>
                    <Input
                      type="number"
                      value={formatNumericValue(asset.capacity)}
                      onChange={(e) => handleAssetFieldUpdate('capacity', e.target.value, { round: true })}
                      className={outOfSync.capacity ? "text-red-500" : ""}
                    />
                    <p className="text-sm text-gray-500">Nameplate capacity for generation/storage</p>
                  </div>

                  {asset.type === 'storage' && (
                    <div className="space-y-2">
                      <Label>Storage Volume (MWh)</Label>
                      <Input
                        type="number"
                        value={formatNumericValue(asset.volume)}
                        onChange={(e) => handleAssetFieldUpdate('volume', e.target.value)}
                        placeholder="Volume (MWh)"
                      />
                      <p className="text-sm text-gray-500">Storage capacity in MWh</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Asset Life (years)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formatNumericValue(asset.assetLife)}
                      onChange={(e) => handleAssetFieldUpdate('assetLife', e.target.value, { round: true })}
                    />
                    <p className="text-sm text-gray-500">Expected operational lifetime</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Volume Loss Adjustment (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formatNumericValue(asset.volumeLossAdjustment)}
                      onChange={(e) => handleAssetFieldUpdate('volumeLossAdjustment', e.target.value, { min: 0, max: 100 })}
                      className={outOfSync.volumeLossAdjustment ? "text-red-500" : ""}
                    />
                    <p className="text-sm text-gray-500">Include MLF, availability and constraints</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Construction & Operations Timeline</CardTitle>
              <CardDescription>Project development and operational dates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Construction Start</Label>
                  <Input
                    type="date"
                    value={asset.constructionStartDate || ''}
                    onChange={(e) => handleAssetDateUpdate('constructionStartDate', e.target.value)}
                    className={outOfSync.constructionStartDate ? "text-red-500" : ""}
                  />
                  <p className="text-sm text-gray-500">When construction begins (rounded to 1st of month)</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Construction Duration (months)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formatNumericValue(asset.constructionDuration)}
                    onChange={(e) => handleAssetConstructionDurationUpdate(e.target.value)}
                    className={`${outOfSync.constructionDuration ? "text-red-500" : ""} ${getValueStyle(asset.constructionDuration, getFieldDefault('constructionDuration'))}`}
                  />
                  <p className="text-sm text-gray-500">Construction period length</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Operations Start</Label>
                  <Input
                    type="date"
                    value={asset.assetStartDate || ''}
                    onChange={(e) => handleAssetDateUpdate('assetStartDate', e.target.value)}
                    className={outOfSync.assetStartDate ? "text-red-500" : ""}
                    style={{
                      backgroundColor: isOpsStartValid()
                        ? 'rgba(0, 255, 0, 0.1)' // Light green
                        : 'rgba(255, 0, 0, 0.1)'  // Light red
                    }}
                  />
                  <p className="text-sm text-gray-500">When operations begin (rounded to 1st of month)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Parameters */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Parameters</CardTitle>
              <CardDescription>Capacity factors and generation performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Annual Degradation (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formatNumericValue(asset.annualDegradation)}
                      onChange={(e) => handleAssetFieldUpdate('annualDegradation', e.target.value, { min: 0, max: 100 })}
                      className={getValueStyle(asset.annualDegradation, getFieldDefault('annualDegradation'))}
                    />
                    <p className="text-sm text-gray-500">Annual reduction in output (e.g. 0.4% per year)</p>
                  </div>

                  {/* Performance Factors */}
                  {asset.type !== 'storage' && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Quarterly Capacity Factors (%)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter) => {
                          const currentValue = asset[`qtrCapacityFactor_${quarter.toLowerCase()}`];
                          const defaultValue = quarterlyDefaults[quarter.toLowerCase()];
                          
                          return (
                            <div key={quarter} className="space-y-2">
                              <Label>{quarter}</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={currentValue || ''}
                                onChange={(e) => handleAssetFieldUpdate(
                                  `qtrCapacityFactor_${quarter.toLowerCase()}`, 
                                  e.target.value,
                                  { min: 0, max: 100, round: true, asString: true }
                                )}
                                className={getValueStyle(currentValue, defaultValue)}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-sm text-gray-500">Defaults from global settings based on State and Type</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h4 className="text-sm font-medium mb-2">Year 1 Volume</h4>
                    {year1Volume ? (
                      <>
                        <div className="text-lg font-semibold">
                          {year1Volume.toFixed(0).toLocaleString()} GWh
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                          {asset.type === 'storage' ? (
                            `Based on ${asset.volume} MWh × 365 days × ${asset.volumeLossAdjustment || 0}% volume loss adjustment`
                          ) : (
                            `Based on ${asset.capacity} MW × ${asset.capacityFactor}% CF × 8,760 hours × ${asset.volumeLossAdjustment || 0}% volume loss adjustment`
                          )}
                        </p>
                      </>
                    ) : (
                      <div className="text-lg font-semibold">Not calculated</div>
                    )}
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-800 mb-2">Performance Notes</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Quarterly capacity factors are averaged for annual calculations</li>
                      <li>• Volume loss includes MLF, availability, and constraint factors</li>
                      <li>• Degradation applies annually from operations start</li>
                      {asset.type === 'storage' && (
                        <li>• Storage volume determines daily energy throughput capacity</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Finance & Costs */}
        <TabsContent value="finance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Capital & Operating Costs</CardTitle>
              <CardDescription>Investment costs and ongoing operational expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>CAPEX ($M)</Label>
                    <Input
                      type="number"
                      value={assetCosts.capex ?? ''}
                      onChange={(e) => handleAssetCostUpdate('capex', e.target.value)}
                      className={getValueStyle(assetCosts.capex, getAssetCostDefault('capex', asset.type, asset.capacity))}
                    />
                    <p className="text-sm text-gray-500">Total capital expenditure</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Operating Costs ($M/year)</Label>
                    <Input
                      type="number"
                      value={assetCosts.operatingCosts ?? ''}
                      onChange={(e) => handleAssetCostUpdate('operatingCosts', e.target.value)}
                      className={getValueStyle(assetCosts.operatingCosts, getAssetCostDefault('operatingCosts', asset.type, asset.capacity))}
                    />
                    <p className="text-sm text-gray-500">Annual operating costs</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>OpEx Escalation (%/year)</Label>
                    <Input
                      type="number"
                      value={assetCosts.operatingCostEscalation ?? ''}
                      onChange={(e) => handleAssetCostUpdate('operatingCostEscalation', e.target.value)}
                      className={getValueStyle(assetCosts.operatingCostEscalation, getAssetCostDefault('operatingCostEscalation', asset.type, asset.capacity))}
                    />
                    <p className="text-sm text-gray-500">Annual increase in operating costs</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Terminal Value ($M)</Label>
                    <Input
                      type="number"
                      value={assetCosts.terminalValue ?? ''}
                      onChange={(e) => handleAssetCostUpdate('terminalValue', e.target.value)}
                      className={getValueStyle(assetCosts.terminalValue, getAssetCostDefault('terminalValue', asset.type, asset.capacity))}
                    />
                    <p className="text-sm text-gray-500">Asset value at end of modeling period</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Project Finance Parameters</CardTitle>
              <CardDescription>Debt financing structure and requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Maximum Gearing (%)</Label>
                    <Input
                      type="number"
                      value={(assetCosts.maxGearing * 100) ?? ''}
                      onChange={(e) => handleAssetCostUpdate('maxGearing', e.target.value)}
                      className={getValueStyle(assetCosts.maxGearing, getAssetCostDefault('maxGearing', asset.type, asset.capacity))}
                    />
                    <p className="text-sm text-gray-500">Maximum debt-to-total capital ratio</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Target DSCR - Contracted (x)</Label>
                    <Input
                      type="number"
                      value={assetCosts.targetDSCRContract ?? ''}
                      onChange={(e) => handleAssetCostUpdate('targetDSCRContract', e.target.value)}
                      className={getValueStyle(assetCosts.targetDSCRContract, getAssetCostDefault('targetDSCRContract', asset.type, asset.capacity))}
                    />
                    <p className="text-sm text-gray-500">Debt service coverage for contracted revenue</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Target DSCR - Merchant (x)</Label>
                    <Input
                      type="number"
                      value={assetCosts.targetDSCRMerchant ?? ''}
                      onChange={(e) => handleAssetCostUpdate('targetDSCRMerchant', e.target.value)}
                      className={getValueStyle(assetCosts.targetDSCRMerchant, getAssetCostDefault('targetDSCRMerchant', asset.type, asset.capacity))}
                    />
                    <p className="text-sm text-gray-500">Debt service coverage for merchant revenue</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Interest Rate (%)</Label>
                    <Input
                      type="number"
                      value={(assetCosts.interestRate * 100) ?? ''}
                      onChange={(e) => handleAssetCostUpdate('interestRate', e.target.value)}
                      className={getValueStyle(assetCosts.interestRate, getAssetCostDefault('interestRate', asset.type, asset.capacity))}
                    />
                    <p className="text-sm text-gray-500">Annual interest rate on debt</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Loan Tenor (years)</Label>
                    <Input
                      type="number"
                      value={assetCosts.tenorYears ?? ''}
                      onChange={(e) => handleAssetCostUpdate('tenorYears', e.target.value)}
                      className={getValueStyle(assetCosts.tenorYears, getAssetCostDefault('tenorYears', asset.type, asset.capacity))}
                    />
                    <p className="text-sm text-gray-500">Loan repayment period</p>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <h4 className="font-medium text-amber-800 mb-2">Finance Notes</h4>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• DSCR requirements vary by revenue type</li>
                      <li>• Auto-gearing optimizes debt to meet DSCR constraints</li>
                      <li>• Portfolio refinancing may offer improved terms</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contracts */}
        <TabsContent value="contracts" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Revenue Contracts</CardTitle>
                <CardDescription>Long-term agreements and pricing arrangements</CardDescription>
              </div>
              <Button onClick={handleAddContract}>
                <Plus className="h-4 w-4 mr-2" />Add Contract
              </Button>
            </CardHeader>
            <CardContent>
              {asset.contracts.map((contract) => (
                <AssetFormContract
                  key={contract.id}
                  contract={contract}
                  updateContract={(field, value) => handleUpdateContract(contract.id, field, value)}
                  removeContract={() => handleRemoveContract(contract.id)}
                  isStorage={asset.type === 'storage'}
                  capacity={asset.capacity}
                  capacityFactor={asset.capacityFactor}
                  volumeLossAdjustment={asset.volumeLossAdjustment || 95}
                  volume={asset.volume}
                />
              ))}
              {asset.contracts.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-2">No contracts added yet</p>
                  <p className="text-sm">Add revenue contracts to define pricing and commercial arrangements</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AssetForm;