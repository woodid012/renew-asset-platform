// components/AssetSummaryInputs.jsx - Streamlined version inspired by Portfolio Configuration
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save } from 'lucide-react';
import { useAssetSummary } from '@/hooks/useAssetSummary';
import { getDefaultValue } from '@/lib/default_constants';

const AssetSummaryInputs = () => {
  const {
    assets,
    editState,
    constants,
    corporateTaxRate,
    deprecationPeriods,
    handleFieldUpdate,
    handleContractUpdate,
    handleAssetCostChange,
    handleTaxRateChange,
    handleDepreciationChange,
    addContractToAll,
    getAllContractIds,
    saveChanges,
    isOpsStartValid,
    isContractStartValid,
    calculateContractTenor,
    getValueStyle,
    getAssetCostDefault,
    formatNumericValue,
  } = useAssetSummary();

  const [activeTab, setActiveTab] = useState("basic");
  const assetCosts = constants.assetCosts || {};

  // Helper function to render different input types
  const renderTableInput = (assetId, field, type, options = []) => {
    const asset = editState[assetId];
    if (!asset) return null;

    const value = asset[field.field];
    let defaultValue = null;
    let cellStyle = '';

    // Get default values for color coding
    if (field.field === 'constructionDuration') {
      const defaultDuration = getDefaultValue('performance', 'constructionDuration', asset.type);
      defaultValue = defaultDuration;
      cellStyle = getValueStyle(value, defaultValue);
    } else if (field.field === 'annualDegradation') {
      defaultValue = getDefaultValue('performance', 'annualDegradation', asset.type);
      cellStyle = getValueStyle(value, defaultValue);
    } else if (field.field.startsWith('qtrCapacityFactor_')) {
      const quarter = field.field.split('_')[1].toUpperCase();
      const defaultFactor = constants.capacityFactors_qtr?.[asset.type]?.[asset.state]?.[quarter];
      defaultValue = defaultFactor ? String(Math.round(defaultFactor * 100)) : '';
      cellStyle = getValueStyle(value, defaultValue);
    }

    switch (type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleFieldUpdate(assetId, field.field, e.target.value)}
            className={`w-full h-8 ${cellStyle}`}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={formatNumericValue(value)}
            onChange={(e) => handleFieldUpdate(assetId, field.field, e.target.value, { min: 0 })}
            className={`w-full h-8 ${cellStyle}`}
          />
        );
      case 'date':
        const opsStartStyle = field.field === 'assetStartDate' 
          ? { 
              backgroundColor: isOpsStartValid(asset)
                ? 'rgba(0, 255, 0, 0.1)' 
                : 'rgba(255, 0, 0, 0.1)'  
            }
          : {};
          
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => handleFieldUpdate(assetId, field.field, e.target.value)}
            className={`w-full h-8 ${cellStyle}`}
            style={opsStartStyle}
          />
        );
      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={(value) => handleFieldUpdate(assetId, field.field, value)}
          >
            <SelectTrigger className={`w-full h-8 ${cellStyle}`}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {options.map(option => (
                <SelectItem key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return value;
    }
  };

  // Asset field definitions
  const basicFields = [
    { field: 'name', label: 'Asset Name', type: 'text' },
    { field: 'state', label: 'State', type: 'select', options: ['NSW', 'VIC', 'SA', 'QLD'] },
    { field: 'type', label: 'Technology', type: 'select', options: ['wind', 'solar', 'storage'] },
    { field: 'capacity', label: 'Capacity (MW)', type: 'number' },
    { field: 'volume', label: 'Storage Volume (MWh)', type: 'number' },
    { field: 'assetLife', label: 'Asset Life (years)', type: 'number' },
    { field: 'volumeLossAdjustment', label: 'Volume Loss Adj (%)', type: 'number' },
  ];

  const timelineFields = [
    { field: 'constructionStartDate', label: 'Construction Start', type: 'date' },
    { field: 'constructionDuration', label: 'Construction Duration (months)', type: 'number' },
    { field: 'assetStartDate', label: 'Operations Start', type: 'date' },
  ];

  const performanceFields = [
    { field: 'annualDegradation', label: 'Annual Degradation (%)', type: 'number' },
    { field: 'qtrCapacityFactor_q1', label: 'Q1 Capacity Factor (%)', type: 'number' },
    { field: 'qtrCapacityFactor_q2', label: 'Q2 Capacity Factor (%)', type: 'number' },
    { field: 'qtrCapacityFactor_q3', label: 'Q3 Capacity Factor (%)', type: 'number' },
    { field: 'qtrCapacityFactor_q4', label: 'Q4 Capacity Factor (%)', type: 'number' },
  ];

  const costFields = [
    { field: 'capex', label: 'CAPEX ($M)', type: 'number' },
    { field: 'operatingCosts', label: 'Operating Costs ($M/year)', type: 'number' },
    { field: 'operatingCostEscalation', label: 'OpEx Escalation (%)', type: 'number' },
    { field: 'terminalValue', label: 'Terminal Value ($M)', type: 'number' },
  ];

  const financeFields = [
    { field: 'maxGearing', label: 'Max Gearing (%)', type: 'number' },
    { field: 'targetDSCRContract', label: 'Target DSCR Contract (x)', type: 'number' },
    { field: 'targetDSCRMerchant', label: 'Target DSCR Merchant (x)', type: 'number' },
    { field: 'interestRate', label: 'Interest Rate (%)', type: 'number' },
    { field: 'tenorYears', label: 'Loan Tenor (years)', type: 'number' },
  ];

  // Check if assets have any contracts
  const hasContracts = Object.values(assets).some(asset => asset.contracts.length > 0);
  const allContractIds = getAllContractIds();

  const contractFields = [
    { field: 'counterparty', label: 'Counterparty', type: 'text' },
    { field: 'type', label: 'Contract Type', type: 'select' },
    { field: 'strikePrice', label: 'Strike Price', type: 'number' },
    { field: 'buyersPercentage', label: 'Buyer %', type: 'number' },
    { field: 'startDate', label: 'Start Date', type: 'date' },
    { field: 'endDate', label: 'End Date', type: 'date' },
  ];

  const renderContractInput = (assetId, contractId, field, type) => {
    const asset = editState[assetId];
    if (!asset) return null;

    const contract = asset.contracts.find(c => c.id === contractId);
    if (!contract) return <span className="text-gray-300 text-sm">-</span>;

    const value = contract[field.field];

    switch (type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleContractUpdate(assetId, contractId, field.field, e.target.value)}
            className="w-full h-8"
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={formatNumericValue(value)}
            onChange={(e) => handleContractUpdate(assetId, contractId, field.field, e.target.value, { min: 0 })}
            className="w-full h-8"
          />
        );
      case 'date':
        const isValid = field.field === 'startDate' 
          ? isContractStartValid(asset, contract)
          : null;
          
        let cellStyle = {};
        
        if (field.field === 'startDate' && isValid !== null) {
          cellStyle = {
            backgroundColor: isValid 
              ? 'rgba(0, 255, 0, 0.1)'  
              : 'rgba(255, 165, 0, 0.1)' 
          };
        }
        
        return (
          <div>
            <Input
              type="date"
              value={value || ''}
              onChange={(e) => handleContractUpdate(assetId, contractId, field.field, e.target.value)}
              className="w-full h-8 mb-1"
              style={cellStyle}
            />
            {field.field === 'endDate' && (
              <div className="text-xs text-gray-500 mt-1">
                {calculateContractTenor(contract) ? `${calculateContractTenor(contract)} years` : ''}
              </div>
            )}
          </div>
        );
      case 'select':
        const contractType = asset.type === 'storage' ? 
          ['cfd', 'fixed', 'tolling'] : 
          ['bundled', 'green', 'Energy', 'fixed'];
            
        return (
          <Select
            value={value || ''}
            onValueChange={(value) => handleContractUpdate(assetId, contractId, field.field, value)}
          >
            <SelectTrigger className="w-full h-8">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {contractType.map(option => (
                <SelectItem key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return value;
    }
  };

  return (
    <div className="w-full p-4 space-y-4">
      <Card className="w-full">
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <CardTitle>Asset Summary Inputs</CardTitle>
            <Button size="sm" onClick={saveChanges} variant="default">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full flex justify-start bg-gray-100">
              <TabsTrigger value="basic">Basic Details</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="costs">Costs & Finance</TabsTrigger>
              <TabsTrigger value="contracts">Contracts</TabsTrigger>
              <TabsTrigger value="taxation">Tax & Depreciation</TabsTrigger>
            </TabsList>
            
            {/* Basic Details */}
            <TabsContent value="basic">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      {Object.values(assets).map(asset => (
                        <TableHead key={`asset-${asset.id}`} className="min-w-32">
                          {asset.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {basicFields.map(field => (
                      <TableRow key={field.field}>
                        <TableCell className="font-medium min-w-48">
                          {field.label}
                        </TableCell>
                        {Object.values(assets).map(asset => (
                          <TableCell key={`${asset.id}-${field.field}`}>
                            {renderTableInput(asset.id, field, field.type, field.options)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            {/* Timeline */}
            <TabsContent value="timeline">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      {Object.values(assets).map(asset => (
                        <TableHead key={`asset-${asset.id}`} className="min-w-32">
                          {asset.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timelineFields.map(field => (
                      <TableRow key={field.field}>
                        <TableCell className="font-medium min-w-48">
                          {field.label}
                          {(field.field === 'constructionStartDate' || field.field === 'assetStartDate') && (
                            <div className="text-xs text-gray-500 mt-1">
                              (rounds to 1st of month)
                            </div>
                          )}
                        </TableCell>
                        {Object.values(assets).map(asset => (
                          <TableCell key={`${asset.id}-${field.field}`}>
                            {renderTableInput(asset.id, field, field.type, field.options)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            {/* Performance */}
            <TabsContent value="performance">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      {Object.values(assets).map(asset => (
                        <TableHead key={`asset-${asset.id}`} className="min-w-32">
                          {asset.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceFields.map(field => (
                      <TableRow key={field.field}>
                        <TableCell className="font-medium min-w-48">
                          {field.label}
                        </TableCell>
                        {Object.values(assets).map(asset => (
                          <TableCell key={`${asset.id}-${field.field}`}>
                            {/* Hide quarterly capacity factors for storage assets */}
                            {field.field.startsWith('qtrCapacityFactor_') && asset.type === 'storage' ? (
                              <span className="text-gray-400 text-sm">N/A</span>
                            ) : (
                              renderTableInput(asset.id, field, field.type, field.options)
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            {/* Costs & Finance */}
            <TabsContent value="costs">
              <div className="space-y-6">
                {/* Costs Section */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Asset Costs</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field</TableHead>
                          {Object.values(assets).map(asset => (
                            <TableHead key={`asset-${asset.id}`} className="min-w-32">
                              {asset.name}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {costFields.map(field => (
                          <TableRow key={field.field}>
                            <TableCell className="font-medium min-w-48">
                              {field.label}
                            </TableCell>
                            {Object.values(assets).map(asset => {
                              const currentValue = assetCosts[asset.name]?.[field.field];
                              const defaultValue = getAssetCostDefault(field.field, asset.type, asset.capacity);
                              return (
                                <TableCell key={`${field.field}-${asset.id}`}>
                                  <Input
                                    type="number"
                                    value={field.field === 'maxGearing' || field.field === 'interestRate' 
                                      ? (currentValue ? (currentValue * 100).toFixed(1) : '') 
                                      : (currentValue ?? '')}
                                    onChange={(e) => handleAssetCostChange(asset.name, field.field, e.target.value)}
                                    className={`w-32 h-8 ${getValueStyle(currentValue, defaultValue)}`}
                                    placeholder={field.field === 'maxGearing' || field.field === 'interestRate' 
                                      ? (defaultValue * 100).toFixed(1) 
                                      : defaultValue?.toFixed(2)}
                                  />
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                
                {/* Project Finance Section */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Project Finance Parameters</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field</TableHead>
                          {Object.values(assets).map(asset => (
                            <TableHead key={`asset-${asset.id}`} className="min-w-32">
                              {asset.name}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financeFields.map(field => (
                          <TableRow key={field.field}>
                            <TableCell className="font-medium min-w-48">
                              {field.label}
                            </TableCell>
                            {Object.values(assets).map(asset => {
                              const currentValue = assetCosts[asset.name]?.[field.field];
                              const defaultValue = getAssetCostDefault(field.field, asset.type, asset.capacity);
                              return (
                                <TableCell key={`${field.field}-${asset.id}`}>
                                  <Input
                                    type="number"
                                    value={field.field === 'maxGearing' || field.field === 'interestRate' 
                                      ? (currentValue ? (currentValue * 100).toFixed(1) : '') 
                                      : (currentValue ?? '')}
                                    onChange={(e) => handleAssetCostChange(asset.name, field.field, e.target.value)}
                                    className={`w-32 h-8 ${getValueStyle(currentValue, defaultValue)}`}
                                    placeholder={field.field === 'maxGearing' || field.field === 'interestRate' 
                                      ? (defaultValue * 100).toFixed(1) 
                                      : defaultValue?.toString()}
                                  />
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* Contracts */}
            <TabsContent value="contracts">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Contract Summary</h3>
                  <Button onClick={addContractToAll} size="sm">
                    Add Contract to All Assets
                  </Button>
                </div>
                
                {hasContracts ? (
                  <div className="space-y-6">
                    {allContractIds.map(contractId => (
                      <div key={contractId}>
                        <h4 className="text-md font-medium mb-3">Contract {contractId}</h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Field</TableHead>
                                {Object.values(assets).map(asset => (
                                  <TableHead key={`asset-${asset.id}`} className="min-w-32">
                                    {asset.name}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {contractFields.map(field => (
                                <TableRow key={field.field}>
                                  <TableCell className="font-medium min-w-48">
                                    {field.label}
                                  </TableCell>
                                  {Object.values(assets).map(asset => (
                                    <TableCell key={`${asset.id}-${field.field}`}>
                                      {renderContractInput(asset.id, contractId, field, field.type)}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No contracts have been added yet. Add contracts to individual assets or use "Add Contract to All Assets" button.
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* Tax & Depreciation */}
            <TabsContent value="taxation">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
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
                            onChange={(e) => handleTaxRateChange(e.target.value)}
                            className="max-w-xs"
                          />
                          <p className="text-sm text-gray-500">
                            Corporate tax rate applied to taxable income
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="space-y-4">
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
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssetSummaryInputs;