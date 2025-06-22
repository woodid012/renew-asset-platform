import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useMerchantPrices } from '@/contexts/MerchantPriceProvider';
import Papa from 'papaparse';
import { read, utils, writeFile } from 'xlsx';
import { Download, Upload } from 'lucide-react';
import {
  DEFAULT_PRICE_SETTINGS,
  UI_CONSTANTS
} from '@/lib/default_constants';

// PriceChart Component (previously separate)
const PriceChart = () => {
  const { constants, getMerchantPrice } = usePortfolio();
  const [selectedRegion, setSelectedRegion] = useState('All Regions');
  const [selectedType, setSelectedType] = useState('Baseload');
  const [selectedDuration, setSelectedDuration] = useState('0.5');
  const [interval, setInterval] = useState('yearly');
  const [chartData, setChartData] = useState([]);
  const [yAxisDomain, setYAxisDomain] = useState([0, 100]);
  const [globalPriceRange, setGlobalPriceRange] = useState({ min: Infinity, max: -Infinity });

  const states = ['All Regions', 'NSW', 'QLD', 'SA', 'VIC'];
  const types = ['All', 'Baseload', 'Solar', 'Wind', 'Green', 'Storage'];
  const durations = ['0.5', '1', '2', '4'];
  
  const handleRegionSelection = (region) => {
    setSelectedRegion(region);
    setSelectedType(region === 'All Regions' ? 'Baseload' : 'All');
  };

  const typeColors = {
    baseloadEnergy: '#000000',
    solarEnergy: '#FFD700',
    windEnergy: '#0000FF',
    green: '#00FF00',
    storage: '#FF00FF'
  };

  const regionColors = {
    NSW: '#1f77b4',
    QLD: '#ff7f0e',
    SA: '#2ca02c',
    VIC: '#d62728'
  };

  const getTimeString = (period) => {
    if (interval === 'yearly') {
      return period.year.toString();
    } else if (interval === 'quarterly') {
      return `${period.year}-Q${period.quarter}`;
    } else { // monthly
      return `1/${period.month.toString().padStart(2, '0')}/${period.year}`;
    }
  };

  const getLineName = (dataKey) => {
    const [region, type] = dataKey.split('_');
    let name = '';
    
    if (type === 'baseloadEnergy') name = 'Baseload';
    if (type === 'solarEnergy') name = 'Solar';
    if (type === 'windEnergy') name = 'Wind';
    if (type === 'green') name = 'Green Certificate';
    if (type === 'storage') name = `${selectedDuration}hr Storage`;
    
    return selectedRegion === 'All Regions' ? `${region} ${name}` : name;
  };

  useEffect(() => {
    let globalMax = -Infinity;
    let globalMin = Infinity;
    
    const regionsToProcess = ['NSW', 'QLD', 'SA', 'VIC'];
    const timePeriods = getTimePeriods();
    
    regionsToProcess.forEach(region => {
      timePeriods.forEach(period => {
        const timeStr = selectedType === 'Storage' ? period.year : getTimeString(period);
        const priceTypes = [
          { profile: 'baseload', type: 'Energy' },
          { profile: 'solar', type: 'Energy' },
          { profile: 'wind', type: 'Energy' },
          { profile: 'solar', type: 'green' }
        ];
        
        priceTypes.forEach(({ profile, type }) => {
          const realPrice = getMerchantPrice(profile, type, region, timeStr);
          if (realPrice) {
            const nominalPrice = constants.referenceYear && constants.escalation
              ? realPrice * Math.pow(1 + constants.escalation / 100, period.year - constants.referenceYear)
              : realPrice;
            
            globalMax = Math.max(globalMax, nominalPrice);
            globalMin = Math.min(globalMin, nominalPrice);
          }
        });

        if (selectedType === 'Storage') {
          const storagePrice = getMerchantPrice('storage', parseFloat(selectedDuration), region, timeStr);
          // Apply escalation to storage price too
          if (storagePrice) {
            const escalatedStoragePrice = constants.referenceYear && constants.escalation
              ? storagePrice * Math.pow(1 + constants.escalation / 100, period.year - constants.referenceYear)
              : storagePrice;
              
            globalMax = Math.max(globalMax, escalatedStoragePrice);
            globalMin = Math.min(globalMin, escalatedStoragePrice);
          }
        }
      });
    });
    
    const roundedMax = Math.ceil(globalMax / 50) * 50;
    const roundedMin = Math.floor(globalMin / 50) * 50;
    
    setGlobalPriceRange({
      min: roundedMin,
      max: roundedMax
    });
    setYAxisDomain([roundedMin, roundedMax]);
  }, [getMerchantPrice, constants, selectedType, selectedDuration, interval]);

  const getTimePeriods = () => {
    const years = Array.from(
      { length: constants.analysisEndYear - constants.analysisStartYear + 1 },
      (_, i) => constants.analysisStartYear + i
    );

    if (selectedType === 'Storage') {
      return years.map(year => ({ 
        year, 
        display: year.toString()
      }));
    } else if (interval === 'yearly') {
      return years.map(year => ({
        year,
        display: year.toString()
      }));
    } else if (interval === 'quarterly') {
      return years.flatMap(year => 
        [1, 2, 3, 4].map(quarter => ({
          year,
          quarter,
          display: `${year.toString().slice(-2)}-Q${quarter}`
        }))
      );
    } else { // monthly
      return years.flatMap(year => 
        Array.from({ length: 12 }, (_, i) => ({
          year,
          month: i + 1,
          display: `${year.toString().slice(-2)}-${(i + 1).toString().padStart(2, '0')}`
        }))
      );
    }
  };

  useEffect(() => {
    const timePeriods = getTimePeriods();
    const regionsToProcess = selectedRegion === 'All Regions' ? ['NSW', 'QLD', 'SA', 'VIC'] : [selectedRegion];

    const data = timePeriods.map(period => {
      const dataPoint = { 
        period: period.display,
        year: period.year
      };
      
      regionsToProcess.forEach(region => {
        if (selectedType === 'Storage') {
          // Get the base storage price
          const storagePrice = getMerchantPrice('storage', parseFloat(selectedDuration), region, period.year);
          
          // Apply escalation to storage price
          let escalatedStoragePrice = storagePrice;
          if (constants.referenceYear && constants.escalation) {
            const yearDiff = period.year - constants.referenceYear;
            escalatedStoragePrice = storagePrice * Math.pow(1 + constants.escalation / 100, yearDiff);
          }
          
          dataPoint[`${region}_storage`] = escalatedStoragePrice;
        } else {
          const priceTypes = [
            { key: 'baseloadEnergy', profile: 'baseload', type: 'Energy' },
            { key: 'solarEnergy', profile: 'solar', type: 'Energy' },
            { key: 'windEnergy', profile: 'wind', type: 'Energy' },
            { key: 'green', profile: 'solar', type: 'green' }
          ];

          priceTypes.forEach(({ key, profile, type }) => {
            const realPrice = getMerchantPrice(profile, type, region, getTimeString(period));
            if (realPrice) {
              const nominalPrice = constants.referenceYear && constants.escalation
                ? realPrice * Math.pow(1 + constants.escalation / 100, period.year - constants.referenceYear)
                : realPrice;
              
              dataPoint[`${region}_${key}`] = nominalPrice;
            }
          });
        }
      });
      
      return dataPoint;
    });

    setChartData(data);
  }, [selectedRegion, selectedType, selectedDuration, interval, getMerchantPrice, constants]);

  const getVisibleLines = () => {
    const regions = selectedRegion === 'All Regions' ? ['NSW', 'QLD', 'SA', 'VIC'] : [selectedRegion];
    const lines = [];
    
    if (selectedRegion === 'All Regions') {
      switch (selectedType) {
        case 'Storage':
          regions.forEach(region => lines.push(`${region}_storage`));
          break;
        case 'Baseload':
          regions.forEach(region => lines.push(`${region}_baseloadEnergy`));
          break;
        case 'Solar':
          regions.forEach(region => lines.push(`${region}_solarEnergy`));
          break;
        case 'Wind':
          regions.forEach(region => lines.push(`${region}_windEnergy`));
          break;
        case 'Green':
          regions.forEach(region => lines.push(`${region}_green`));
          break;
      }
    } else {
      if (selectedType === 'All') {
        lines.push(
          `${selectedRegion}_baseloadEnergy`,
          `${selectedRegion}_solarEnergy`,
          `${selectedRegion}_windEnergy`,
          `${selectedRegion}_green`,
          `${selectedRegion}_storage`
        );
      } else if (selectedType === 'Storage') {
        lines.push(`${selectedRegion}_storage`);
      } else {
        switch (selectedType) {
          case 'Baseload':
            lines.push(`${selectedRegion}_baseloadEnergy`);
            break;
          case 'Solar':
            lines.push(`${selectedRegion}_solarEnergy`);
            break;
          case 'Wind':
            lines.push(`${selectedRegion}_windEnergy`);
            break;
          case 'Green':
            lines.push(`${selectedRegion}_green`);
            break;
        }
      }
    }
    
    return lines;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} style={{ color: entry.color }} className="mb-1">
              <p className="font-medium">
                {`${getLineName(entry.dataKey)}: $${entry.value?.toFixed(2)}/MWh`}
              </p>
            </div>
          ))}
          <p className="text-xs text-gray-500 mt-2">
            Range across all regions: ${globalPriceRange.min} - ${globalPriceRange.max}/MWh
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <CardTitle>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                {states.map(state => (
                  <Button
                    key={state}
                    variant={selectedRegion === state ? "default" : "outline"}
                    onClick={() => handleRegionSelection(state)}
                    className="w-24"
                  >
                    {state}
                  </Button>
                ))}
              </div>
              {selectedType !== 'Storage' && (
                <div className="flex gap-2">
                  <Button
                    variant={interval === 'monthly' ? "default" : "outline"}
                    onClick={() => setInterval('monthly')}
                    className="w-24"
                  >
                    Monthly
                  </Button>
                  <Button
                    variant={interval === 'quarterly' ? "default" : "outline"}
                    onClick={() => setInterval('quarterly')}
                    className="w-24"
                  >
                    Quarterly
                  </Button>
                  <Button
                    variant={interval === 'yearly' ? "default" : "outline"}
                    onClick={() => setInterval('yearly')}
                    className="w-24"
                  >
                    Yearly
                  </Button>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {types.map(type => (
                <Button
                  key={type}
                  variant={selectedType === type ? "default" : "outline"}
                  onClick={() => setSelectedType(type)}
                  className="w-24"
                  disabled={selectedRegion === 'All Regions' && type === 'All'}
                >
                  {type}
                </Button>
              ))}
            </div>
            {selectedType === 'Storage' && (
              <div className="flex gap-2">
                {durations.map(duration => (
                  <Button
                    key={duration}
                    variant={selectedDuration === duration ? "default" : "outline"}
                    onClick={() => setSelectedDuration(duration)}
                    className="w-24"
                  >
                    {duration}hr
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96 w-full">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="period"
                padding={{ left: 20, right: 20 }}
              />
              <YAxis 
                domain={yAxisDomain}
                tickFormatter={(value) => Math.round(value)}
                label={{ 
                  value: selectedType === 'Storage' ? 'Price Spread ($/MWh)' : 'Price (Nominal $/MWh)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  offset: 0 
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {getVisibleLines().map((line) => {
                const [region, type] = line.split('_');
                const color = selectedRegion === 'All Regions' ? regionColors[region] : typeColors[type];
                return (
                  <Line 
                    key={line}
                    type="monotone" 
                    dataKey={line}
                    name={getLineName(line)}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Main InputsGlobal Component
const InputsGlobal = () => {
  const { 
    constants, 
    updateConstants, 
    getMerchantPrice, 
    setPriceCurveSource 
  } = usePortfolio();
  
  const { setMerchantPrices } = useMerchantPrices();
  const fileInputRef = useRef(null);

  // Helper function to determine if a value is default (blue) or user-defined (black)
  const getValueStyle = (currentValue, defaultValue) => {
    const isDefault = currentValue === undefined || currentValue === null || currentValue === defaultValue;
    return isDefault ? UI_CONSTANTS.colors.defaultValue : UI_CONSTANTS.colors.userValue;
  };

  const processData = (data) => {
    try {
      if (!data || data.length === 0) {
        throw new Error('No data found in file');
      }

      const firstRow = data[0];
      const availableColumns = Object.keys(firstRow);
      const columnMap = {};
      const requiredColumns = ['profile', 'type', 'state', 'time', 'price'];
      
      let missingColumns = [];
      requiredColumns.forEach(required => {
        const match = availableColumns.find(
          key => key.toLowerCase() === required.toLowerCase()
        );
        if (!match) {
          missingColumns.push(required);
        }
        columnMap[required] = match;
      });

      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      const transformedData = data
        .map((row) => {
          try {
            const profile = row[columnMap.profile];
            const type = row[columnMap.type];
            const state = row[columnMap.state];
            const time = row[columnMap.time];
            const rawPrice = row[columnMap.price];
            const price = typeof rawPrice === 'string' ? parseFloat(rawPrice.replace(/[^0-9.-]/g, '')) : parseFloat(rawPrice);
            
            if (!profile || !type || !state || !time || isNaN(price)) {
              return null;
            }

            return {
              profile: profile.toLowerCase(),
              type: type.toLowerCase(),
              state: state.toUpperCase(),
              time,
              price,
              source: 'imported'
            };
          } catch (err) {
            return null;
          }
        })
        .filter(row => row !== null);

      if (!transformedData.length) {
        throw new Error('No valid data rows found in file after processing');
      }

      setMerchantPrices(transformedData);
      setPriceCurveSource('imported');
      
    } catch (error) {
      alert(error.message || 'Error processing file. Please check the data format and try again.');
      throw error;
    }
  };

  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: ({ data }) => processData(data)
      });
     } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = read(data, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = utils.sheet_to_json(worksheet);
        processData(jsonData);
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Please upload a CSV or Excel file');
    }

    event.target.value = '';
  };

  const handleExport = () => {
    const rows = [];
    const profiles = ['solar', 'wind', 'baseload'];
    const types = ['Energy', 'green'];
    const states = ['NSW', 'QLD', 'SA', 'VIC'];
    const currentYear = new Date().getFullYear();
    
    profiles.forEach(profile => {
      types.forEach(type => {
        states.forEach(state => {
          for (let year = currentYear; year <= currentYear + 30; year++) {
            for (let month = 1; month <= 12; month++) {
              const time = `1/${month.toString().padStart(2, '0')}/${year}`;
              const price = getMerchantPrice(profile, type, state, time);
              if (price !== undefined && price !== null && price !== 0) {
                rows.push({
                  profile,
                  type,
                  state,
                  time,
                  price: price.toFixed(2)
                });
              }
            }
          }
        });
      });
    });
  
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Prices");
  
    ws['!cols'] = [
      { wch: 10 },  // profile
      { wch: 8 },   // type
      { wch: 6 },   // state
      { wch: 12 },  // time
      { wch: 10 }   // price
    ];
  
    writeFile(wb, 'merchant_prices_base_real.xlsx');
  };

  const getReferenceYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return Array.from(
      { length: 10 },
      (_, i) => currentYear - 5 + i
    );
  };

  // Get current values with defaults
  const currentEscalation = constants.escalation !== undefined ? constants.escalation : DEFAULT_PRICE_SETTINGS.escalation;
  const currentReferenceYear = constants.referenceYear !== undefined ? constants.referenceYear : DEFAULT_PRICE_SETTINGS.referenceYear;

  return (
    <div className="w-full p-4 space-y-4"> 
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Price Curve</span>
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Base Prices (pre-escalation)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-2" />
                Save Base Prices (pre-escalation)
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Adjust Real to Nominal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Indexation (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={currentEscalation}
                    onChange={e => updateConstants('escalation', parseFloat(e.target.value) || 0)}
                    placeholder="Enter escalation rate"
                    className={getValueStyle(currentEscalation, DEFAULT_PRICE_SETTINGS.escalation)}
                  />
                  <p className="text-sm text-gray-500">Applied indexation to real pricing</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reference Year</label>
                  <Select
                    value={String(currentReferenceYear)}
                    onValueChange={value => updateConstants('referenceYear', parseInt(value))}
                  >
                    <SelectTrigger className={getValueStyle(currentReferenceYear, DEFAULT_PRICE_SETTINGS.referenceYear)}>
                      <SelectValue placeholder="Select reference year" />
                    </SelectTrigger>
                    <SelectContent>
                      {getReferenceYearOptions().map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">Base year for real price calculations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Price Curves for Analysis ($nominal)</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceChart />
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default InputsGlobal;