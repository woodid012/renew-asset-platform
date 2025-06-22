import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortfolio } from '@/contexts/PortfolioContext';
import { calculateAssetRevenue, applyEscalation } from '@/components/RevCalculations';

const ConsolidatedPPATables = () => {
  const { assets, constants, getMerchantPrice } = usePortfolio();
  const [selectedScenario, setSelectedScenario] = useState('base');
  const yearLimit = 30;

  // Helper functions
  const capitalizeType = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', { 
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const calculateCapacityFactor = (asset) => {
    if (!asset) return "-";
    const q1 = parseFloat(asset.qtrCapacityFactor_q1 || 0);
    const q2 = parseFloat(asset.qtrCapacityFactor_q2 || 0);
    const q3 = parseFloat(asset.qtrCapacityFactor_q3 || 0);
    const q4 = parseFloat(asset.qtrCapacityFactor_q4 || 0);
    
    if (q1 + q2 + q3 + q4 === 0) {
      if (asset.type && asset.state && constants.capacityFactors?.[asset.type]?.[asset.state]) {
        return (constants.capacityFactors[asset.type][asset.state] * 100).toFixed(1);
      }
      return "-";
    }
    
    return ((q1 + q2 + q3 + q4) / 4).toFixed(1);
  };

  const calculateVolume = (asset, includeAdjustment = false) => {
    if (!asset) return "-";
    const volumeLossAdjustment = includeAdjustment ? (parseFloat(asset.volumeLossAdjustment || 95) / 100) : 1;
    
    if (asset.type === 'storage') {
      const storageMWh = parseFloat(asset.volume || 0);
      const annualGeneration = storageMWh * 365 * volumeLossAdjustment;
      return annualGeneration.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    
    const capacityMW = asset.capacity || 0;
    const getQuarterValue = (quarter) => {
      const value = parseFloat(asset[`qtrCapacityFactor_q${quarter}`] || 0);
      if (value === 0 && asset.type && asset.state) {
        return (constants.capacityFactors_qtr?.[asset.type]?.[asset.state]?.[`Q${quarter}`] || 0) * 100;
      }
      return value;
    };
    
    const q1 = getQuarterValue(1) / 100;
    const q2 = getQuarterValue(2) / 100;
    const q3 = getQuarterValue(3) / 100;
    const q4 = getQuarterValue(4) / 100;
    
    const avgCapacityFactor = (q1 + q2 + q3 + q4) / 4;
    const annualGeneration = (capacityMW * avgCapacityFactor * 8760 * volumeLossAdjustment);
    
    return annualGeneration.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Summary Sheet Component
  const SummarySheet = () => (
    <Card>
      <CardHeader>
        <CardTitle>Asset Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-b-0">
              <TableHead colSpan={7} className="text-center bg-gray-50 h-8">
                Details
              </TableHead>
              <TableHead colSpan={4} className="text-center bg-gray-50 h-8">
                Year 1 Volume
              </TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="w-64">Asset Name</TableHead>
              <TableHead className="w-32">Type</TableHead>
              <TableHead className="w-24">MW</TableHead>
              <TableHead className="w-32">State</TableHead>
              <TableHead className="w-32">Cons Start</TableHead>
              <TableHead className="w-32">Cons Duration</TableHead>
              <TableHead className="w-32">Ops Start</TableHead>
              <TableHead className="w-32">Asset Life</TableHead>
              <TableHead className="w-40">Annual Capacity Factor</TableHead>
              <TableHead className="w-32">Volume (MWh)</TableHead>
              <TableHead className="w-40">Volume Loss Adj.</TableHead>
              <TableHead className="w-48">Adj. Volume (MWh)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.values(assets).map((asset) => (
              <TableRow key={asset.name}>
                <TableCell className="font-medium">{asset.name}</TableCell>
                <TableCell>{capitalizeType(asset.type) || "-"}</TableCell>
                <TableCell>{asset.capacity || "-"}</TableCell>
                <TableCell>{asset.state || "-"}</TableCell>
                <TableCell>{formatDate(asset.constructionStartDate)}</TableCell>
                <TableCell>{asset.constructionDuration ? `${asset.constructionDuration} months` : "-"}</TableCell>
                <TableCell>{formatDate(asset.assetStartDate)}</TableCell>
                <TableCell>{asset.assetLife ? `${asset.assetLife} years` : "35 years"}</TableCell>
                <TableCell>{`${calculateCapacityFactor(asset)}%`}</TableCell>
                <TableCell>{calculateVolume(asset)}</TableCell>
                <TableCell>
                  {asset.volumeLossAdjustment 
                    ? `${parseFloat(asset.volumeLossAdjustment).toFixed(1)}%` 
                    : "-"}
                </TableCell>
                <TableCell>{calculateVolume(asset, true)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  // Generate inputs data
  const generateInputsData = () => {
    const yearlyData = [];
    const endYear = yearLimit 
      ? constants.analysisStartYear + yearLimit - 1 
      : constants.analysisEndYear;

    Object.values(assets).forEach(asset => {
      const assetStartDate = new Date(asset.assetStartDate);
      const assetStartYear = assetStartDate instanceof Date && !isNaN(assetStartDate) 
        ? assetStartDate.getFullYear() 
        : constants.analysisStartYear;

      for (let year = assetStartYear; year <= endYear; year++) {
        const revenueCalc = calculateAssetRevenue(asset, year, constants, getMerchantPrice);
        const annualGeneration = revenueCalc.annualGeneration;

        // Process contracts
        asset.contracts.forEach(contract => {
          const contractStartDate = new Date(contract.startDate);
          const contractEndDate = new Date(contract.endDate);
          
          const contractStart = contractStartDate instanceof Date && !isNaN(contractStartDate)
            ? contractStartDate.getFullYear()
            : assetStartYear;
          const contractEnd = contractEndDate instanceof Date && !isNaN(contractEndDate)
            ? contractEndDate.getFullYear()
            : endYear;

          if (year >= contractStart && year <= contractEnd) {
            const yearsSinceStart = year - contractStart;
            const indexationFactor = Math.pow(1 + contract.indexation / 100, yearsSinceStart);
            
            let basePrice = 0;
            let contractType = contract.type;

            if (asset.type === 'storage') {
              if (contract.type === 'fixed' || contract.type === 'cfd' || contract.type === 'tolling') {
                basePrice = parseFloat(contract.strikePrice);
              }
            } else {
              if (contract.type === 'bundled') {
                basePrice = parseFloat(contract.greenPrice) + parseFloat(contract.EnergyPrice);
              } else {
                basePrice = parseFloat(contract.strikePrice);
              }
            }

            const indexedPrice = basePrice * indexationFactor;
            const contractedVolume = annualGeneration * (contract.buyersPercentage / 100);

            yearlyData.push({
              year,
              assetName: asset.name,
              state: asset.state,
              type: capitalizeType(asset.type),
              ppaNumber: contract.id,
              contractType,
              buyerPercentage: contract.buyersPercentage,
              basePrice: basePrice.toFixed(2),
              indexation: contract.indexation,
              indexedPrice: indexedPrice.toFixed(2),
              term: `${contractStart}-${contractEnd}`,
              volume: Math.round(contractedVolume)
            });
          }
        });

        // Handle merchant entries
        if (asset.type === 'storage') {
          const merchantPercentage = 100 - asset.contracts.reduce((sum, contract) => {
            const contractStart = new Date(contract.startDate).getFullYear();
            const contractEnd = new Date(contract.endDate).getFullYear();
            if (year >= contractStart && year <= contractEnd) {
              return sum + parseFloat(contract.buyersPercentage);
            }
            return sum;
          }, 0);

          if (merchantPercentage > 0) {
            const merchantVolume = annualGeneration * (merchantPercentage / 100);
            const calculatedDuration = asset.volume / asset.capacity;
            const standardDurations = [0.5, 1, 2, 4];
            
            let lowerDuration = standardDurations[0];
            let upperDuration = standardDurations[standardDurations.length - 1];
            let interpolationRatio = 0.5;
            
            for (let i = 0; i < standardDurations.length - 1; i++) {
              if (calculatedDuration >= standardDurations[i] && calculatedDuration <= standardDurations[i + 1]) {
                lowerDuration = standardDurations[i];
                upperDuration = standardDurations[i + 1];
                interpolationRatio = (calculatedDuration - lowerDuration) / (upperDuration - lowerDuration);
                break;
              }
            }

            const lowerPrice = getMerchantPrice('storage', lowerDuration, asset.state, year);
            const upperPrice = getMerchantPrice('storage', upperDuration, asset.state, year);
            const basePrice = (lowerPrice * (1 - interpolationRatio)) + (upperPrice * interpolationRatio);
            const escalatedPrice = applyEscalation(basePrice, year, constants);

            yearlyData.push({
              year,
              assetName: asset.name,
              state: asset.state,
              type: capitalizeType(asset.type),
              ppaNumber: 'Merchant',
              contractType: 'Energy',
              buyerPercentage: merchantPercentage,
              basePrice: basePrice.toFixed(2),
              indexation: constants.escalation,
              indexedPrice: escalatedPrice.toFixed(2),
              term: `${year}`,
              volume: Math.round(merchantVolume)
            });
          }
        } else {
          // Handle non-storage merchant entries for green and Energy
          const contractedGreenPercentage = asset.contracts.reduce((sum, contract) => {
            const contractStart = new Date(contract.startDate).getFullYear();
            const contractEnd = new Date(contract.endDate).getFullYear();
            if (year >= contractStart && year <= contractEnd) {
              if (contract.type === 'bundled' || contract.type === 'green') {
                return sum + parseFloat(contract.buyersPercentage);
              }
            }
            return sum;
          }, 0);

          const contractedEnergyPercentage = asset.contracts.reduce((sum, contract) => {
            const contractStart = new Date(contract.startDate).getFullYear();
            const contractEnd = new Date(contract.endDate).getFullYear();
            if (year >= contractStart && year <= contractEnd) {
              if (contract.type === 'bundled' || contract.type === 'Energy') {
                return sum + parseFloat(contract.buyersPercentage);
              }
            }
            return sum;
          }, 0);

          const merchantGreenPercentage = 100 - contractedGreenPercentage;
          const merchantEnergyPercentage = 100 - contractedEnergyPercentage;

          if (merchantGreenPercentage > 0) {
            const merchantGreenVolume = annualGeneration * (merchantGreenPercentage / 100);
            const baseGreenPrice = getMerchantPrice(asset.type, 'green', asset.state, year);
            const escalatedGreenPrice = applyEscalation(baseGreenPrice, year, constants);

            yearlyData.push({
              year,
              assetName: asset.name,
              state: asset.state,
              type: capitalizeType(asset.type),
              ppaNumber: 'Merchant',
              contractType: 'green',
              buyerPercentage: merchantGreenPercentage,
              basePrice: baseGreenPrice.toFixed(2),
              indexation: constants.escalation,
              indexedPrice: escalatedGreenPrice.toFixed(2),
              term: `${year}`,
              volume: Math.round(merchantGreenVolume)
            });
          }

          if (merchantEnergyPercentage > 0) {
            const merchantEnergyVolume = annualGeneration * (merchantEnergyPercentage / 100);
            const baseEnergyPrice = getMerchantPrice(asset.type, 'Energy', asset.state, year);
            const escalatedEnergyPrice = applyEscalation(baseEnergyPrice, year, constants);

            yearlyData.push({
              year,
              assetName: asset.name,
              state: asset.state,
              type: capitalizeType(asset.type),
              ppaNumber: 'Merchant',
              contractType: 'Energy',
              buyerPercentage: merchantEnergyPercentage,
              basePrice: baseEnergyPrice.toFixed(2),
              indexation: constants.escalation,
              indexedPrice: escalatedEnergyPrice.toFixed(2),
              term: `${year}`,
              volume: Math.round(merchantEnergyVolume)
            });
          }
        }
      }
    });

    return yearlyData.sort((a, b) => 
      a.year - b.year || 
      a.assetName.localeCompare(b.assetName) || 
      (a.ppaNumber === 'Merchant' ? 1 : -1)
    );
  };

  // Generate outputs data with stress scenarios
  const calculateStressRevenue = (baseRevenue, scenario) => {
    const volumeVar = constants.volumeVariation || 0;
    const greenVar = constants.greenPriceVariation || 0;
    const EnergyVar = constants.EnergyPriceVariation || 0;

    switch (scenario) {
      case 'worst':
        return {
          ...baseRevenue,
          annualGeneration: baseRevenue.annualGeneration * (1 - volumeVar/100),
          merchantGreen: baseRevenue.merchantGreen * (1 - volumeVar/100) * (1 - greenVar/100),
          merchantEnergy: baseRevenue.merchantEnergy * (1 - volumeVar/100) * (1 - EnergyVar/100),
          contractedGreen: baseRevenue.contractedGreen * (1 - volumeVar/100),
          contractedEnergy: baseRevenue.contractedEnergy * (1 - volumeVar/100),
        };
      case 'volume':
        return {
          ...baseRevenue,
          annualGeneration: baseRevenue.annualGeneration * (1 - volumeVar/100),
          merchantGreen: baseRevenue.merchantGreen * (1 - volumeVar/100),
          merchantEnergy: baseRevenue.merchantEnergy * (1 - volumeVar/100),
          contractedGreen: baseRevenue.contractedGreen * (1 - volumeVar/100),
          contractedEnergy: baseRevenue.contractedEnergy * (1 - volumeVar/100),
        };
      case 'price':
        return {
          ...baseRevenue,
          merchantGreen: baseRevenue.merchantGreen * (1 - greenVar/100),
          merchantEnergy: baseRevenue.merchantEnergy * (1 - EnergyVar/100),
        };
      default:
        return baseRevenue;
    }
  };

  const generateOutputsData = () => {
    const startYear = constants.analysisStartYear;
    const endYear = yearLimit 
      ? startYear + yearLimit - 1 
      : constants.analysisEndYear;
    const outputData = [];

    Object.values(assets).forEach(asset => {
      for (let year = startYear; year <= endYear; year++) {
        const baseRevenue = calculateAssetRevenue(asset, year, constants, getMerchantPrice);
        const assetRevenue = calculateStressRevenue(baseRevenue, selectedScenario);
        
        // Handle contracted outputs
        asset.contracts.forEach(contract => {
          const startYear = new Date(contract.startDate).getFullYear();
          const endYear = new Date(contract.endDate).getFullYear();
          
          if (year >= startYear && year <= endYear) {
            const buyersPercentage = parseFloat(contract.buyersPercentage) || 0;
            const contractedVolume = assetRevenue.annualGeneration * (buyersPercentage / 100);
            
            let revenue = 0;
            let price = 0;
            
            if (asset.type === 'storage') {
              revenue = assetRevenue.contractedEnergy * (buyersPercentage / 100);
              price = revenue * 1000000 / contractedVolume;
              contract = { ...contract, type: 'Energy' };
            } else {
              if (contract.type === 'bundled') {
                revenue = (assetRevenue.contractedGreen + assetRevenue.contractedEnergy) * 
                         (buyersPercentage / assetRevenue.greenPercentage);
              } else if (contract.type === 'green') {
                revenue = assetRevenue.contractedGreen * (buyersPercentage / assetRevenue.greenPercentage);
              } else if (contract.type === 'Energy') {
                revenue = assetRevenue.contractedEnergy * (buyersPercentage / assetRevenue.EnergyPercentage);
              }
              price = revenue * 1000000 / contractedVolume;
            }

            outputData.push({
              year,
              assetName: asset.name,
              state: asset.state,
              contractId: contract.id || 'Contract',
              category: 'Contracted',
              type: contract.type,
              volume: Math.round(contractedVolume),
              price: price.toFixed(2),
              revenue: revenue.toFixed(2)
            });
          }
        });

        // Handle merchant outputs
        if (asset.type === 'storage') {
          const merchantVolume = assetRevenue.annualGeneration * 
                               ((100 - assetRevenue.EnergyPercentage) / 100);
          
          if (merchantVolume > 0) {
            outputData.push({
              year,
              assetName: asset.name,
              state: asset.state,
              contractId: 'Merchant',
              category: 'Merchant',
              type: 'Energy',
              volume: Math.round(merchantVolume),
              price: ((assetRevenue.merchantEnergy * 1000000) / merchantVolume).toFixed(2),
              revenue: assetRevenue.merchantEnergy.toFixed(2)
            });
          }
        } else {
          const merchantGreenVolume = assetRevenue.annualGeneration * 
                                    ((100 - assetRevenue.greenPercentage) / 100);
          const merchantEnergyVolume = assetRevenue.annualGeneration * 
                                    ((100 - assetRevenue.EnergyPercentage) / 100);

          if (merchantGreenVolume > 0) {
            outputData.push({
              year,
              assetName: asset.name,
              state: asset.state,
              contractId: 'Merchant',
              category: 'Merchant',
              type: 'green',
              volume: Math.round(merchantGreenVolume),
              price: ((assetRevenue.merchantGreen * 1000000) / merchantGreenVolume).toFixed(2),
              revenue: assetRevenue.merchantGreen.toFixed(2)
            });
          }

          if (merchantEnergyVolume > 0) {
            outputData.push({
              year,
              assetName: asset.name,
              state: asset.state,
              contractId: 'Merchant',
              category: 'Merchant',
              type: 'Energy',
              volume: Math.round(merchantEnergyVolume),
              price: ((assetRevenue.merchantEnergy * 1000000) / merchantEnergyVolume).toFixed(2),
              revenue: assetRevenue.merchantEnergy.toFixed(2)
            });
          }
        }
      }
    });

    return outputData.sort((a, b) => 
      a.year - b.year || 
      a.assetName.localeCompare(b.assetName) || 
      a.contractId.localeCompare(b.contractId)
    );
  };

  const inputsData = useMemo(() => generateInputsData(), [assets, constants, yearLimit]);
  const outputsData = useMemo(() => generateOutputsData(), [assets, constants, yearLimit, selectedScenario]);

  // Export functions
  const exportInputsToCSV = () => {
    const headers = [
      'Year', 'Asset Name', 'State', 'Type', 'PPA #', 'Contract Type',
      'Buyer %', 'Base Price ($/MWh)', 'Indexation/Escalation %',
      'Indexed/Escalated Price ($/MWh)', 'Adj. Volume (MWh)'
    ];

    const csvData = inputsData.map(row => [
      row.year, row.assetName, row.state, row.type, row.ppaNumber,
      row.contractType, row.buyerPercentage, row.basePrice,
      row.indexation, row.indexedPrice, row.volume
    ]);

    csvData.unshift(headers);
    const csvString = csvData.map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ppa_inputs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportOutputsToCSV = () => {
    const headers = [
      'Year', 'Asset Name', 'State', 'Contract ID', 'Category',
      'Type', 'Volume (MWh)', 'Price ($/MWh)', 'Revenue ($M)'
    ];

    const csvData = outputsData.map(row => [
      row.year, row.assetName, row.state, row.contractId,
      row.category, row.type, row.volume, row.price, row.revenue
    ]);

    csvData.unshift(headers);
    const csvString = csvData.map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ppa_outputs_${selectedScenario}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Asset Details and Year 1 Summary</h2>
      <SummarySheet />
      
      <Tabs defaultValue="outputs" className="w-full">
        <div className="flex justify-between items-center mb-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Datatable Exports</h2>
            <p className="text-sm text-gray-500">Showing first {yearLimit} years of data</p>
          </div>
          <TabsList>
            <TabsTrigger value="inputs">Inputs</TabsTrigger>
            <TabsTrigger value="outputs">Outputs</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inputs">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Button onClick={exportInputsToCSV} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export to CSV
              </Button>
            </div>

            <Card>
              <CardContent className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Year</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Asset Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">State</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">PPA #</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Contract Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Buyer %</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Base Price</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Index %</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Indexed Price</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Adj. Volume (MWh)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {inputsData.length === 0 ? (
                      <tr>
                        <td colSpan="11" className="px-4 py-3 text-sm text-gray-500 text-center">
                          No data available for the selected period
                        </td>
                      </tr>
                    ) : (
                      inputsData.map((row, index) => (
                        <tr 
                          key={`${row.year}-${row.assetName}-${row.ppaNumber}-${row.contractType}`}
                          className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          <td className="px-4 py-3 text-sm text-gray-900">{row.year}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.assetName}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.state}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.type}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.ppaNumber}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 capitalize">{row.contractType}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.buyerPercentage}%</td>
                          <td className="px-4 py-3 text-sm text-gray-900">${row.basePrice}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.indexation}%</td>
                          <td className="px-4 py-3 text-sm text-gray-900">${row.indexedPrice}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{row.volume.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="outputs">
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Button onClick={exportOutputsToCSV} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export to CSV
              </Button>
              
              <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select scenario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base">Base Case</SelectItem>
                  <SelectItem value="worst">Combined Downside Case</SelectItem>
                  <SelectItem value="volume">Volume Stress</SelectItem>
                  <SelectItem value="price">Price Stress</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Year</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Asset Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">State</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Contract ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Category</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Adj.Volume (MWh)</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Price ($/MWh)</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Revenue ($M)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {outputsData.map((row, index) => (
                      <tr 
                        key={`${row.year}-${row.assetName}-${row.contractId}-${row.type}`}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">{row.year}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.assetName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.state}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.contractId}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.category}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 capitalize">{row.type}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.volume.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">${row.price}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">${row.revenue}M</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConsolidatedPPATables;