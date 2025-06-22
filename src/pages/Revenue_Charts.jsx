import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePortfolio } from '@/contexts/PortfolioContext';
import { generatePortfolioData, processPortfolioData } from '@/components/RevCalculations';
import { 
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, 
  ResponsiveContainer, CartesianGrid 
} from 'recharts';

// Shared utilities and constants
const assetColors = {
  asset1: { base: '#22C55E', faded: '#86EFAC' },
  asset2: { base: '#0EA5E9', faded: '#7DD3FC' },
  asset3: { base: '#F97316', faded: '#FDBA74' },
  asset4: { base: '#06B6D4', faded: '#67E8F9' },
  asset5: { base: '#EAB308', faded: '#FDE047' }
};

const roundNumber = (num) => Number(Number(num).toFixed(2));

const generateTimeIntervals = (intervalType) => {
  const intervals = [];
  const currentYear = new Date().getFullYear();
  const endYear = currentYear + 35;
  
  for (let year = currentYear; year <= endYear; year++) {
    if (intervalType === 'yearly') {
      intervals.push(year.toString());
    } else if (intervalType === 'quarterly') {
      for (let quarter = 1; quarter <= 4; quarter++) {
        intervals.push(`${year}-Q${quarter}`);
      }
    } else if (intervalType === 'monthly') {
      for (let month = 1; month <= 12; month++) {
        const monthStr = month.toString().padStart(2, '0');
        intervals.push(`${monthStr}/01/${year}`);
      }
    }
  }
  return intervals;
};

const getXAxisConfig = (intervalType) => ({
  tickFormatter: (value) => {
    if (intervalType === 'yearly') return value;
    if (intervalType === 'quarterly') {
      const [yearPart, quarter] = value.split('-');
      return quarter === 'Q1' ? yearPart : '';
    }
    if (intervalType === 'monthly') {
      const [month] = value.split('/');
      return month === '01' ? value.split('/')[2] : '';
    }
  },
  interval: 0,
  axisLine: { strokeWidth: 2 },
  tick: { fontSize: 12 },
  tickLine: { strokeWidth: 2 },
  minorTick: true,
  minorTickSize: 4,
  minorTickLine: { strokeWidth: 1 },
  dy: 10
});

const getTooltipFormatter = (intervalType) => (label) => {
  if (intervalType === 'quarterly') {
    const [year, quarter] = label.split('-');
    return `${quarter} ${year}`;
  }
  if (intervalType === 'monthly') {
    const [month, , year] = label.split('/');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }
  return `Year ${label}`;
};

// Portfolio Overview Chart Component
const PortfolioOverviewChart = ({
  assets,
  processedData,
  visibleAssets,
  setVisibleAssets,
  assetColors,
  intervalType,
  xAxisConfig,
  tooltipLabelFormatter,
  roundNumber,
}) => {
  const { constants } = usePortfolio();
  const [viewMode, setViewMode] = useState('all');
  const [colorMode, setColorMode] = useState('all');

  console.log("Analysis Period:", {
    start: constants.analysisStartYear,
    end: constants.analysisEndYear,
    firstDataPoint: processedData[0]?.timeInterval,
    lastDataPoint: processedData[processedData.length - 1]?.timeInterval,
    totalPoints: processedData.length
  });
  
  const toggleAsset = (assetName) => {
    setVisibleAssets(prev => ({
      ...prev,
      [assetName]: !prev[assetName]
    }));
  };

  // Filter the data based on analysis period
  const filteredData = processedData.filter(data => {
    let year;
    if (data.timeInterval.includes('-')) {
      year = parseInt(data.timeInterval.split('-')[0]);
    } else if (data.timeInterval.includes('/')) {
      year = parseInt(data.timeInterval.split('/')[2]);
    } else {
      year = parseInt(data.timeInterval);
    }
    return year >= constants.analysisStartYear && year <= constants.analysisEndYear;
  });

  const renderBars = () => {
    return Object.values(assets).map((asset, index) => {
      if (!visibleAssets[asset.name]) return null;

      const bars = [];
      
      if (colorMode === 'all') {
        if (viewMode === 'all' || viewMode === 'contracted') {
          bars.push(
            <Bar 
              key={`${asset.id}-contracted`}
              yAxisId="left"
              dataKey={`${asset.name} Contracted`}
              stackId="stack"
              fill={Object.values(assetColors)[index % 5].base}
              name={`${asset.name} Contracted`}
              isAnimationActive={false}
            />
          );
        }
        if (viewMode === 'all' || viewMode === 'merchant') {
          bars.push(
            <Bar 
              key={`${asset.id}-merchant`}
              yAxisId="left"
              dataKey={`${asset.name} Merchant`}
              stackId="stack"
              fill={Object.values(assetColors)[index % 5].faded}
              name={`${asset.name} Merchant`}
              isAnimationActive={false}
            />
          );
        }
      } else {
        if ((viewMode === 'all' || viewMode === 'contracted')) {
          if (colorMode === 'Energy') {
            bars.push(
              <Bar 
                key={`${asset.id}-contracted-Energy`}
                yAxisId="left"
                dataKey={`${asset.name} Contracted Energy`}
                stackId="stack"
                fill={Object.values(assetColors)[index % 5].base}
                name={`${asset.name} Contracted Energy`}
                isAnimationActive={false}
              />
            );
          }
          if (colorMode === 'green') {
            bars.push(
              <Bar 
                key={`${asset.id}-contracted-green`}
                yAxisId="left"
                dataKey={`${asset.name} Contracted Green`}
                stackId="stack"
                fill={Object.values(assetColors)[index % 5].base}
                name={`${asset.name} Contracted Green`}
                isAnimationActive={false}
                opacity={0.7}
              />
            );
          }
        }

        if ((viewMode === 'all' || viewMode === 'merchant')) {
          if (colorMode === 'Energy') {
            bars.push(
              <Bar 
                key={`${asset.id}-merchant-Energy`}
                yAxisId="left"
                dataKey={`${asset.name} Merchant Energy`}
                stackId="stack"
                fill={Object.values(assetColors)[index % 5].faded}
                name={`${asset.name} Merchant Energy`}
                isAnimationActive={false}
              />
            );
          }
          if (colorMode === 'green') {
            bars.push(
              <Bar 
                key={`${asset.id}-merchant-green`}
                yAxisId="left"
                dataKey={`${asset.name} Merchant Green`}
                stackId="stack"
                fill={Object.values(assetColors)[index % 5].faded}
                name={`${asset.name} Merchant Green`}
                isAnimationActive={false}
                opacity={0.7}
              />
            );
          }
        }
      }

      return bars;
    });
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length > 0) {
      return (
        <div className="bg-white p-4 border rounded-lg shadow-lg">
          <p className="font-medium">{tooltipLabelFormatter(label)}</p>
          {payload.map((entry, index) => {
            let value = roundNumber(entry.value);
            let displayName = entry.name;
            if (colorMode === 'all') {
              displayName = displayName.replace(' Energy', '').replace(' Green', '');
            }
            return (
              <p key={index} className="font-medium" style={{ color: entry.color }}>
                {`${displayName}: ${value}M`}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <CardTitle>Portfolio Revenue and Contract Percentage</CardTitle>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'all' ? "default" : "outline"}
                onClick={() => setViewMode('all')}
                className="w-24"
              >
                All
              </Button>
              <Button
                variant={viewMode === 'contracted' ? "default" : "outline"}
                onClick={() => setViewMode('contracted')}
                className="w-24"
              >
                Contracted
              </Button>
              <Button
                variant={viewMode === 'merchant' ? "default" : "outline"}
                onClick={() => setViewMode('merchant')}
                className="w-24"
              >
                Merchant
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant={colorMode === 'all' ? "default" : "outline"}
                onClick={() => setColorMode('all')}
                className="w-24"
              >
                All
              </Button>
              <Button
                variant={colorMode === 'Energy' ? "default" : "outline"}
                onClick={() => setColorMode('Energy')}
                className="w-24"
              >
                Energy
              </Button>
              <Button
                variant={colorMode === 'green' ? "default" : "outline"}
                onClick={() => setColorMode('green')}
                className="w-24"
              >
                Green
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timeInterval" 
                {...xAxisConfig} 
                domain={[constants.analysisStartYear, constants.analysisEndYear]}
              />
              <YAxis 
                yAxisId="left"
                label={{ value: 'Revenue (Million $)', angle: -90, position: 'insideLeft' }} 
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                label={{ value: 'Contracted (%)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {renderBars()}
              {(colorMode === 'all' || colorMode === 'green') && (
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="weightedGreenPercentage" 
                  stroke="#16A34A" 
                  name="Green Contracted %"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              )}
              {(colorMode === 'all' || colorMode === 'Energy') && (
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="weightedEnergyPercentage" 
                  stroke="#171717" 
                  name="Energy Contracted %"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="border-t pt-6">
          <div className="flex flex-wrap justify-center gap-6">
            {Object.values(assets).map((asset, index) => (
              <div key={asset.id} className="flex items-center gap-2">
                <Checkbox
                  id={`asset-${asset.id}`}
                  checked={visibleAssets[asset.name]}
                  onCheckedChange={() => toggleAsset(asset.name)}
                />
                <Label 
                  htmlFor={`asset-${asset.id}`}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: Object.values(assetColors)[index % 5].base }}
                  />
                  <span>{asset.name}</span>
                </Label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Asset Detail Chart Component
const AssetDetailChart = ({
  assets,
  selectedAsset,
  setSelectedAsset,
  processedData,
  getMerchantPrice,
  intervalType,
  xAxisConfig,
  tooltipLabelFormatter,
  roundNumber,
}) => {
  const { constants } = usePortfolio();
  const selectedAssetData = assets[selectedAsset];
  const isStorage = selectedAssetData?.type === 'storage';

  const processedDataWithPrices = useMemo(() => {
    return processedData
      .filter(periodData => {
        let year;
        if (periodData.timeInterval.includes('-')) {
          year = parseInt(periodData.timeInterval.split('-')[0]);
        } else if (periodData.timeInterval.includes('/')) {
          year = parseInt(periodData.timeInterval.split('/')[2]);
        } else {
          year = parseInt(periodData.timeInterval);
        }
        return year >= constants.analysisStartYear && year <= constants.analysisEndYear;
      })
      .map(periodData => {
        if (!selectedAssetData) return periodData;

        if (isStorage) {
          const calculatedDuration = selectedAssetData.volume / selectedAssetData.capacity;
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

          const lowerPrice = getMerchantPrice('storage', lowerDuration, selectedAssetData.state, periodData.timeInterval);
          const upperPrice = getMerchantPrice('storage', upperDuration, selectedAssetData.state, periodData.timeInterval);
          
          const merchantPriceSpread = (lowerPrice * (1 - interpolationRatio)) + (upperPrice * interpolationRatio);
          
          return {
            ...periodData,
            merchantPriceSpread: roundNumber(merchantPriceSpread)
          };
        } else {
          const merchantGreenPrice = getMerchantPrice(
            selectedAssetData.type, 
            'green', 
            selectedAssetData.state, 
            periodData.timeInterval
          );
          const merchantEnergyPrice = getMerchantPrice(
            selectedAssetData.type, 
            'Energy', 
            selectedAssetData.state, 
            periodData.timeInterval
          );
          const bundledPrice = merchantGreenPrice + merchantEnergyPrice;
          
          return {
            ...periodData,
            merchantGreenPrice: roundNumber(merchantGreenPrice),
            merchantEnergyPrice: roundNumber(merchantEnergyPrice),
            bundledPrice: roundNumber(bundledPrice)
          };
        }
      });
  }, [processedData, selectedAsset, assets, getMerchantPrice, roundNumber, isStorage, selectedAssetData, constants]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Asset Detail View</CardTitle>
        <Select 
          value={selectedAsset} 
          onValueChange={setSelectedAsset}
        >
          <SelectTrigger className="w-64 hover:bg-slate-50 border-slate-200 shadow-sm">
            <SelectValue placeholder="Select Asset" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(assets).map((asset) => (
              <SelectItem key={asset.id} value={asset.id.toString()}>
                {asset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={processedDataWithPrices}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timeInterval" {...xAxisConfig} />
              <YAxis 
                yAxisId="left"
                label={{ value: 'Revenue (Million $)', angle: -90, position: 'insideLeft' }} 
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                label={{ value: 'Price ($/MWh)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip 
                formatter={(value, name) => {
                  if (name.includes('Price')) {
                    return [`$${roundNumber(value)}/MWh`, name];
                  }
                  return [roundNumber(value), name];
                }}
                labelFormatter={tooltipLabelFormatter}
              />
              <Legend />
              <Bar 
                yAxisId="left"
                dataKey={`${selectedAssetData?.name} Contracted Energy`} 
                stackId="a"
                fill="#171717"
                name="Energy Contracted"
                isAnimationActive={false}
              />
              {!isStorage && (
                <Bar 
                  yAxisId="left"
                  dataKey={`${selectedAssetData?.name} Contracted Green`} 
                  stackId="a"
                  fill="#16A34A"
                  name="Green Contracted"
                  isAnimationActive={false}
                />
              )}
              <Bar 
                yAxisId="left"
                dataKey={`${selectedAssetData?.name} Merchant Energy`} 
                stackId="a"
                fill="#737373"
                name="Energy Merchant"
                isAnimationActive={false}
              />
              {!isStorage && (
                <Bar 
                  yAxisId="left"
                  dataKey={`${selectedAssetData?.name} Merchant Green`} 
                  stackId="a"
                  fill="#86EFAC"
                  name="Green Merchant"
                  isAnimationActive={false}
                />
              )}
              {isStorage ? (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="merchantPriceSpread"
                  stroke="#171717"
                  strokeWidth={2}
                  name="Merchant Price Spread"
                  dot={false}
                  isAnimationActive={false}
                />
              ) : (
                <>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="merchantGreenPrice"
                    stroke="#16A34A"
                    strokeWidth={2}
                    name="Merchant Green Price"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="merchantEnergyPrice"
                    stroke="#171717"
                    strokeWidth={2}
                    name="Merchant Energy Price"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="bundledPrice"
                    stroke="#EF4444"
                    strokeWidth={2}
                    name="Bundled Price"
                    dot={false}
                    isAnimationActive={false}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Portfolio Dashboard Component
const PortfolioDashboard = () => {
  const { assets, constants, getMerchantPrice } = usePortfolio();
  const [intervalType, setIntervalType] = useState('yearly');
  const [visibleAssets, setVisibleAssets] = useState({});
  const [selectedAsset, setSelectedAsset] = useState(null);

  const timeIntervals = useMemo(() => 
    generateTimeIntervals(intervalType),
    [intervalType]
  );

  const portfolioData = useMemo(() => 
    generatePortfolioData(assets, timeIntervals, constants, getMerchantPrice),
    [assets, timeIntervals, constants, getMerchantPrice]
  );

  const processedData = useMemo(() => {
    const rawData = processPortfolioData(portfolioData, assets, visibleAssets);
    return rawData.map(periodData => {
      const newData = { timeInterval: periodData.timeInterval };
      
      Object.entries(periodData).forEach(([key, value]) => {
        if (typeof value === 'number') {
          newData[key] = roundNumber(value);
        } else {
          newData[key] = value;
        }
      });
      
      Object.values(assets).forEach(asset => {
        if (visibleAssets[asset.name]) {
          newData[`${asset.name} Contracted`] = roundNumber(
            (periodData[`${asset.name} Contracted Energy`] || 0) + 
            (periodData[`${asset.name} Contracted Green`] || 0)
          );
          newData[`${asset.name} Merchant`] = roundNumber(
            (periodData[`${asset.name} Merchant Energy`] || 0) + 
            (periodData[`${asset.name} Merchant Green`] || 0)
          );
        }
      });

      return newData;
    });
  }, [portfolioData, assets, visibleAssets]);

  useEffect(() => {
    const newVisibleAssets = {};
    Object.values(assets).forEach(asset => {
      newVisibleAssets[asset.name] = true;
    });
    setVisibleAssets(newVisibleAssets);
    if (Object.keys(assets).length > 0 && !selectedAsset) {
      setSelectedAsset(Object.values(assets)[0].id.toString());
    }
  }, [assets, selectedAsset]);

  if (Object.keys(assets).length === 0) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-gray-500">No assets in portfolio to visualize</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sharedChartProps = {
    intervalType,
    xAxisConfig: getXAxisConfig(intervalType),
    tooltipLabelFormatter: getTooltipFormatter(intervalType),
    roundNumber,
  };

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="interval-select" className="whitespace-nowrap">
              Chart Interval
            </Label>
            <Select 
              value={intervalType} 
              onValueChange={setIntervalType}
            >
              <SelectTrigger id="interval-select" className="w-48">
                <SelectValue placeholder="Select Interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <PortfolioOverviewChart
        {...sharedChartProps}
        assets={assets}
        processedData={processedData}
        visibleAssets={visibleAssets}
        setVisibleAssets={setVisibleAssets}
        assetColors={assetColors}
      />

      <AssetDetailChart
        {...sharedChartProps}
        assets={assets}
        selectedAsset={selectedAsset}
        setSelectedAsset={setSelectedAsset}
        processedData={processedData}
        getMerchantPrice={getMerchantPrice}
      />
    </div>
  );
};

export default PortfolioDashboard;