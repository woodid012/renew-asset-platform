// components/AssetFormContract.jsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContractForm } from '@/hooks/useContractForm';

const AssetFormContract = ({ 
  contract, 
  updateContract, 
  removeContract, 
  isStorage = false, 
  capacity,
  capacityFactor = 0,
  volumeLossAdjustment = 95,
  volume
}) => {
  const {
    handleNumericInput,
    handleContractTypeChange,
    calculateTenor,
    calculateAnnualRevenue,
    getContractTypeOptions,
    getRevenueLabel,
    shouldShowBuyersPercentage,
    isBuyersPercentageDisabled
  } = useContractForm({
    contract,
    updateContract,
    isStorage,
    capacity,
    capacityFactor,
    volumeLossAdjustment,
    volume
  });

  const contractTypeOptions = getContractTypeOptions();
  const revenueLabel = getRevenueLabel();
  const showBuyersPercentage = shouldShowBuyersPercentage();
  const buyersPercentageDisabled = isBuyersPercentageDisabled();
  const annualRevenue = calculateAnnualRevenue();

  return (
    <Card className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2"
        onClick={removeContract}
      >
        <X className="h-4 w-4" />
      </Button>
      <CardContent className="pt-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Counterparty</label>
            <Input
              value={contract.counterparty || ''}
              onChange={(e) => updateContract('counterparty', e.target.value)}
              placeholder="Counterparty Name"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Contract Type</label>
            <Select 
              value={contract.type || ''}
              onValueChange={handleContractTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                {contractTypeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{revenueLabel}</label>
            <Input
              type="number"
              value={contract.strikePrice || ''}
              onChange={(e) => handleNumericInput('strikePrice', e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            {showBuyersPercentage ? (
              <>
                <label className="text-sm font-medium">Buyer's Percentage (%)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={buyersPercentageDisabled ? 100 : (contract.buyersPercentage || '')}
                  onChange={(e) => handleNumericInput('buyersPercentage', e.target.value)}
                  disabled={buyersPercentageDisabled}
                />
              </>
            ) : (
              <div className="invisible">
                <label className="text-sm font-medium">Placeholder</label>
                <Input type="number" disabled />
              </div>
            )}
          </div>

          {/* Bundled PPA specific fields */}
          {!isStorage && contract.type === 'bundled' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Energy Price ($)</label>
                <Input
                  type="number"
                  value={contract.EnergyPrice || ''}
                  onChange={(e) => handleNumericInput('EnergyPrice', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Green Price ($)</label>
                <Input
                  type="number"
                  value={contract.greenPrice || ''}
                  onChange={(e) => handleNumericInput('greenPrice', e.target.value)}
                  disabled
                  className="bg-gray-100"
                />
              </div>
            </>
          )}

          {/* Annual Revenue Calculation */}
          {annualRevenue && (
            <div className="col-span-2 bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-medium mb-2">Annual Revenue Calculation</h4>
              <div className="text-lg font-semibold">
                {annualRevenue.display}
              </div>
              <p className="text-xs text-gray-500">
                {annualRevenue.description}
              </p>
            </div>
          )}

          {/* Date Section */}
          <div className="col-span-2 grid grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={contract.startDate || ''}
                  onChange={(e) => updateContract('startDate', e.target.value)}
                />
                <p className="text-xs text-gray-500">Default as Asset Start</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={contract.endDate || ''}
                  onChange={(e) => updateContract('endDate', e.target.value)}
                />
                <p className="text-xs text-gray-500">Default +10 years</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Contract Tenor</label>
              <div className="h-10 flex items-center px-3 border rounded-md bg-gray-50">
                <span className="text-sm">{calculateTenor() ? `${calculateTenor()} years` : 'N/A'}</span>
              </div>
              <p className="text-xs text-gray-500">Calculated from dates</p>
            </div>
          </div>

          {/* Indexation Section */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Indexation (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={contract.indexation || ''}
                  onChange={(e) => handleNumericInput('indexation', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Reference Year</label>
                <Input
                  type="number"
                  value={contract.indexationReferenceYear || ''}
                  onChange={(e) => handleNumericInput('indexationReferenceYear', e.target.value)}
                  min="2000"
                  max="2100"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssetFormContract;