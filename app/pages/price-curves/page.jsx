'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { useMerchantPrices } from '@/app/contexts/MerchantPriceProvider';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  TrendingUp, 
  Download, 
  Calendar,
  DollarSign,
  Zap,
  AlertCircle,
  CheckCircle,
  Upload,
  Database,
  FileText
} from 'lucide-react';

const PriceCurvesPage = () => {
  const { getMerchantPrice, priceSource, setPriceSource, setMerchantPrices, spreadSource, setSpreadSource } = useMerchantPrices();
  
  // State management
  const [priceData, setPriceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Chart configuration - Updated defaults
  const [viewMode, setViewMode] = useState('regions'); // Changed from 'profiles' to 'regions'
  const [selectedRegion, setSelectedRegion] = useState('QLD');
  const [selectedProfile, setSelectedProfile] = useState('baseload'); // Changed from 'solar' to 'baseload'
  const [selectedType, setSelectedType] = useState('ALL'); // Already correct
  const [timeRange, setTimeRange] = useState('all'); // Changed from '2025' to 'all'
  const [aggregationLevel, setAggregationLevel] = useState('yearly'); // Changed from 'monthly' to 'yearly'
  const [showRawData, setShowRawData] = useState(false);

  // Available options
  const availableRegions = ['QLD', 'NSW', 'VIC', 'SA'];
  const availableProfiles = ['solar', 'wind', 'baseload', 'storage'];
  const availableTypes = ['ALL', 'Energy', 'green'];
  const availableYears = ['2025', '2026', '2027', '2028', '2029', '2030', '2035', '2040', '2045', '2050', 'all'];

  // Initialize storage type properly
  useEffect(() => {
    if (selectedProfile === 'storage' && !['0.5', '1', '2', '4'].includes(selectedType)) {
      setSelectedType('2'); // Default to 2 hour for storage
    } else if (selectedProfile !== 'storage' && !['ALL', 'Energy', 'green'].includes(selectedType)) {
      setSelectedType('ALL'); // Default to ALL for other profiles
    }
  }, [selectedProfile, selectedType]);

  // Colors for different series
  const profileColors = {
    solar: '#F59E0B', // Yellow/Orange
    wind: '#3B82F6', // Blue
    baseload: '#000000', // Black
    storage: '#8B5CF6' // Purple
  };

  const regionColors = {
    QLD: '#F59E0B',
    NSW: '#3B82F6',
    VIC: '#10B981',
    SA: '#EF4444'
  };

  const typeColors = {
    Energy: '#3B82F6',
    green: '#10B981'
  };

  // Generate time intervals for the selected year or all years
  const generateTimeIntervals = (timeSelection) => {
    const intervals = [];
    
    if (timeSelection === 'all') {
      // Generate intervals from 1/1/2025 to 12/31/2050 (26 years)
      const startYear = 2025;
      const endYear = 2050;
      
      if (aggregationLevel === 'monthly') {
        for (let year = startYear; year <= endYear; year++) {
          for (let month = 1; month <= 12; month++) {
            // Use D/MM/YYYY format to match your CSV (no zero-padding on day, zero-padding on month)
            intervals.push(`1/${month.toString().padStart(2, '0')}/${year}`);
          }
        }
      } else if (aggregationLevel === 'quarterly') {
        for (let year = startYear; year <= endYear; year++) {
          for (let quarter = 1; quarter <= 4; quarter++) {
            intervals.push(`${year}-Q${quarter}`);
          }
        }
      } else { // yearly
        for (let year = startYear; year <= endYear; year++) {
          intervals.push(year.toString());
        }
      }
    } else {
      // Single year selection
      const year = parseInt(timeSelection);
      
      if (aggregationLevel === 'monthly') {
        for (let month = 1; month <= 12; month++) {
          // Use D/MM/YYYY format to match your CSV (no zero-padding on day, zero-padding on month)
          intervals.push(`1/${month.toString().padStart(2, '0')}/${year}`);
        }
      } else if (aggregationLevel === 'quarterly') {
        for (let quarter = 1; quarter <= 4; quarter++) {
          intervals.push(`${year}-Q${quarter}`);
        }
      } else { // yearly
        intervals.push(year.toString());
      }
    }
    
    return intervals;
  };

  // Fetch and process price data
  const fetchPriceData = () => {
    setLoading(true);
    setError('');
    
    try {
      const timeIntervals = generateTimeIntervals(timeRange);
      const chartData = [];
      
      console.log(`Generating price data for ${timeIntervals.length} time intervals from ${timeIntervals[0]} to ${timeIntervals[timeIntervals.length - 1]}`);
      
      timeIntervals.forEach((timeInterval, index) => {
        const dataPoint = { 
          time: timeInterval,
          // Add a sortable index for proper chart ordering
          sortIndex: index 
        };
        
        if (viewMode === 'profiles') {
          // Compare different profiles for selected region and type
          if (selectedType === 'ALL') {
            // Show Solar, Baseload, Wind, Green, and 2HR Storage
            const profilesWithStorage = ['solar', 'wind', 'baseload'];
            
            profilesWithStorage.forEach(profile => {
              try {
                const price = getMerchantPrice(profile, 'Energy', selectedRegion, timeInterval);
                dataPoint[profile] = price || 0;
              } catch (err) {
                console.warn(`Error getting price for ${profile} at ${timeInterval}:`, err);
                dataPoint[profile] = 0;
              }
            });
            
            // Add green certificates for baseload
            try {
              const greenPrice = getMerchantPrice('baseload', 'green', selectedRegion, timeInterval);
              dataPoint['green'] = greenPrice || 0;
            } catch (err) {
              console.warn(`Error getting green price at ${timeInterval}:`, err);
              dataPoint['green'] = 0;
            }
            
            // Add 2HR Storage
            try {
              const storagePrice = getMerchantPrice('storage', '2', selectedRegion, timeInterval);
              dataPoint['2hr_storage'] = storagePrice || 0;
            } catch (err) {
              console.warn(`Error getting 2HR storage price at ${timeInterval}:`, err);
              dataPoint['2hr_storage'] = 0;
            }
            
          } else if (selectedType === 'green') {
            // For green, only show profiles that have green certificates (no storage)
            const greenProfiles = ['solar', 'wind', 'baseload'];
            greenProfiles.forEach(profile => {
              try {
                const price = getMerchantPrice(profile, 'green', selectedRegion, timeInterval);
                dataPoint[profile] = price || 0;
              } catch (err) {
                console.warn(`Error getting green price for ${profile} at ${timeInterval}:`, err);
                dataPoint[profile] = 0;
              }
            });
            
          } else {
            // Energy type - show all profiles including storage
            availableProfiles.forEach(profile => {
              try {
                let price;
                if (profile === 'storage') {
                  // Use 2 hour duration for storage in profiles comparison
                  price = getMerchantPrice(profile, '2', selectedRegion, timeInterval);
                } else {
                  price = getMerchantPrice(profile, selectedType, selectedRegion, timeInterval);
                }
                dataPoint[profile] = price || 0;
              } catch (err) {
                console.warn(`Error getting price for ${profile} at ${timeInterval}:`, err);
                dataPoint[profile] = 0;
              }
            });
          }
        } else if (viewMode === 'regions') {
          // Compare different regions for selected profile and type
          if (selectedType === 'ALL' && selectedProfile === 'baseload') {
            // For baseload with ALL type, show both Energy and Green across regions
            availableRegions.forEach(region => {
              try {
                const energyPrice = getMerchantPrice('baseload', 'Energy', region, timeInterval);
                dataPoint[`${region}_Energy`] = energyPrice || 0;
              } catch (err) {
                console.warn(`Error getting energy price for ${region} at ${timeInterval}:`, err);
                dataPoint[`${region}_Energy`] = 0;
              }
            });
            
            // For green certificates, since they're the same across regions, just show one line
            try {
              const greenPrice = getMerchantPrice('baseload', 'green', 'QLD', timeInterval);
              dataPoint['Green'] = greenPrice || 0;
            } catch (err) {
              console.warn(`Error getting green price at ${timeInterval}:`, err);
              dataPoint['Green'] = 0;
            }
          } else {
            // Standard region comparison
            availableRegions.forEach(region => {
              try {
                let price;
                if (selectedProfile === 'storage') {
                  // For storage, the type parameter is actually the duration (Energy/Green becomes duration)
                  // Use the timeInterval as the year parameter for spreads lookup
                  price = getMerchantPrice('storage', selectedType, region, timeInterval);
                } else {
                  price = getMerchantPrice(selectedProfile, selectedType, region, timeInterval);
                }
                dataPoint[region] = price || 0;
              } catch (err) {
                console.warn(`Error getting price for ${region} at ${timeInterval}:`, err);
                dataPoint[region] = 0;
              }
            });
          }
        } else { // types
          // Compare different types for selected profile and region
          if (selectedProfile === 'storage') {
            // For storage, we'll show different durations from your CSV: 0.5, 1, 2, 4
            const storageDurations = ['0.5', '1', '2', '4'];
            storageDurations.forEach(duration => {
              try {
                const price = getMerchantPrice('storage', duration, selectedRegion, timeInterval);
                dataPoint[`${duration}h`] = price || 0;
              } catch (err) {
                console.warn(`Error getting storage price for ${duration}h at ${timeInterval}:`, err);
                dataPoint[`${duration}h`] = 0;
              }
            });
          } else {
            availableTypes.forEach(type => {
              try {
                const price = getMerchantPrice(selectedProfile, type, selectedRegion, timeInterval);
                dataPoint[type] = price || 0;
              } catch (err) {
                console.warn(`Error getting price for ${type} at ${timeInterval}:`, err);
                dataPoint[type] = 0;
              }
            });
          }
        }
        
        chartData.push(dataPoint);
      });
      
      console.log(`Generated ${chartData.length} data points`);
      setPriceData(chartData);
      setError('');
    } catch (err) {
      console.error('Error processing price data:', err);
      setError(`Failed to process price data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load data when parameters change
  useEffect(() => {
    fetchPriceData();
  }, [viewMode, selectedRegion, selectedProfile, selectedType, timeRange, aggregationLevel, getMerchantPrice]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (priceData.length === 0) return { avgPrice: 0, minPrice: 0, maxPrice: 0, dataPoints: 0 };
    
    const allPrices = [];
    priceData.forEach(point => {
      Object.keys(point).forEach(key => {
        if (key !== 'time' && typeof point[key] === 'number') {
          allPrices.push(point[key]);
        }
      });
    });
    
    if (allPrices.length === 0) return { avgPrice: 0, minPrice: 0, maxPrice: 0, dataPoints: 0 };
    
    return {
      avgPrice: allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length,
      minPrice: Math.min(...allPrices),
      maxPrice: Math.max(...allPrices),
      dataPoints: priceData.length
    };
  }, [priceData]);

  // Get line configuration for chart
  const getLineConfig = () => {
    if (viewMode === 'profiles') {
      if (selectedType === 'ALL') {
        return [
          { key: 'solar', color: '#F59E0B', name: 'Solar' },
          { key: 'wind', color: '#3B82F6', name: 'Wind' },
          { key: 'baseload', color: '#000000', name: 'Baseload' },
          { key: 'green', color: '#22C55E', name: 'Green' },
          { key: '2hr_storage', color: '#8B5CF6', name: '2HR Storage' }
        ];
      } else if (selectedType === 'green') {
        return [
          { key: 'solar', color: '#F59E0B', name: 'Solar Green' },
          { key: 'wind', color: '#3B82F6', name: 'Wind Green' },
          { key: 'baseload', color: '#10B981', name: 'Baseload Green' }
        ];
      } else {
        return availableProfiles.map(profile => ({
          key: profile,
          color: profileColors[profile] || '#6B7280',
          name: profile === 'storage' ? '2HR Storage' : profile.charAt(0).toUpperCase() + profile.slice(1)
        }));
      }
    } else if (viewMode === 'regions') {
      if (selectedType === 'ALL' && selectedProfile === 'baseload') {
        // For baseload with ALL type, show Energy for each region plus one Green line
        const config = availableRegions.map(region => ({
          key: `${region}_Energy`,
          color: regionColors[region] || '#6B7280',
          name: `${region} Energy`
        }));
        config.push({
          key: 'Green',
          color: '#22C55E',
          name: 'Green (All Regions)'
        });
        return config;
      } else {
        return availableRegions.map(region => ({
          key: region,
          color: regionColors[region] || '#6B7280',
          name: region
        }));
      }
    } else {
      // For types view, check if we're looking at storage
      if (selectedProfile === 'storage') {
        const storageDurations = ['0.5h', '1h', '2h', '4h'];
        const storageColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
        return storageDurations.map((duration, index) => ({
          key: duration,
          color: storageColors[index] || '#6B7280',
          name: `${duration} Duration`
        }));
      } else {
        return availableTypes.filter(type => type !== 'ALL').map(type => ({
          key: type,
          color: typeColors[type] || '#6B7280',
          name: type === 'green' ? 'Green Certificates' : 'Energy'
        }));
      }
    }
  };

  // Handle file upload for price data
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target.result;
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        const data = [];
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = lines[i].split(',');
            const row = {};
            headers.forEach((header, index) => {
              if (header === 'price') {
                row[header] = parseFloat(values[index]) || 0;
              } else if (header === 'time' && values[index]) {
                // Handle D/MM/YYYY format to match your CSV exactly
                const timeValue = values[index].trim();
                if (timeValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                  // Keep the format as-is if it's already D/MM/YYYY or DD/MM/YYYY
                  row[header] = timeValue;
                } else {
                  row[header] = timeValue;
                }
              } else {
                row[header] = values[index]?.trim() || '';
              }
            });
            data.push(row);
          }
        }
        
        setMerchantPrices(data);
        setPriceSource('imported');
        fetchPriceData(); // Refresh with new data
        
      } catch (err) {
        setError(`Failed to parse CSV file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Export current data
  const exportData = () => {
    const timeDescription = timeRange === 'all' ? '2025_2050' : timeRange;
    const csvData = ['Time,' + getLineConfig().map(config => config.name).join(',')];
    
    priceData.forEach(point => {
      const row = [point.time];
      getLineConfig().forEach(config => {
        row.push(point[config.key]?.toFixed(2) || '0.00');
      });
      csvData.push(row.join(','));
    });
    
    const blob = new Blob([csvData.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `price_curves_${viewMode}_${timeDescription}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const lineConfig = getLineConfig();

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Curves</h1>
          <p className="text-gray-600">Market electricity price analysis and visualization</p>
          <p className="text-sm text-gray-500">Data source: {priceSource}</p>
        </div>
        <div className="flex space-x-3">
          <label className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-50 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <button 
            onClick={exportData}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Chart Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">View Mode</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="profiles">Compare Profiles</option>
              <option value="regions">Compare Regions</option>
              <option value="types">Compare Types</option>
            </select>
          </div>
          
          {viewMode !== 'regions' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Region</label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                {availableRegions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
          )}
          
          {viewMode !== 'profiles' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile</label>
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                {availableProfiles.map(profile => (
                  <option key={profile} value={profile}>
                    {profile.charAt(0).toUpperCase() + profile.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {viewMode !== 'types' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contract Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                {selectedProfile === 'storage' ? (
                  // For storage, show duration options that match your CSV
                  <>
                    <option value="0.5">0.5 Hour Duration</option>
                    <option value="1">1 Hour Duration</option>
                    <option value="2">2 Hour Duration</option>
                    <option value="4">4 Hour Duration</option>
                  </>
                ) : viewMode === 'profiles' ? (
                  // For profiles comparison, show ALL option
                  <>
                    <option value="ALL">ALL (Solar/Wind/Baseload/Green/2HR Storage)</option>
                    <option value="Energy">Energy Only</option>
                    <option value="green">Green Certificates Only</option>
                  </>
                ) : (
                  // For regions comparison, show standard options
                  availableTypes.filter(type => type !== 'ALL').map(type => (
                    <option key={type} value={type}>
                      {type === 'green' ? 'Green Certificates' : 'Energy'}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>
                  {year === 'all' ? 'All Years (2025-2050)' : year}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Aggregation</label>
            <select
              value={aggregationLevel}
              onChange={(e) => setAggregationLevel(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <div className="text-red-800">
              <strong>Error:</strong> {error}
            </div>
          </div>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Price</p>
              <p className="text-2xl font-bold text-gray-900">${summaryStats.avgPrice.toFixed(2)}</p>
              <p className="text-sm text-gray-500">per MWh</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Min Price</p>
              <p className="text-2xl font-bold text-gray-900">${summaryStats.minPrice.toFixed(2)}</p>
              <p className="text-sm text-gray-500">per MWh</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Max Price</p>
              <p className="text-2xl font-bold text-gray-900">${summaryStats.maxPrice.toFixed(2)}</p>
              <p className="text-sm text-gray-500">per MWh</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <Zap className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Data Points</p>
              <p className="text-2xl font-bold text-gray-900">{summaryStats.dataPoints}</p>
              <p className="text-sm text-gray-500">periods</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Chart Summary */}
      {priceData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Chart Configuration Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center">
              <div className="text-gray-600">View Mode</div>
              <div className="font-semibold capitalize">{viewMode}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">
                {viewMode === 'profiles' ? 'Region' : viewMode === 'regions' ? 'Profile' : 'Profile'}
              </div>
              <div className="font-semibold">
                {viewMode === 'profiles' ? selectedRegion : 
                 viewMode === 'regions' ? selectedProfile.charAt(0).toUpperCase() + selectedProfile.slice(1) : 
                 selectedProfile.charAt(0).toUpperCase() + selectedProfile.slice(1)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">
                {viewMode === 'types' ? 'Region' : 'Type/Duration'}
              </div>
              <div className="font-semibold">
                {viewMode === 'types' ? selectedRegion : 
                 selectedProfile === 'storage' ? `${selectedType} Duration` :
                 selectedType === 'green' ? 'Green Certificates' : 'Energy'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Period</div>
              <div className="font-semibold">
                {timeRange === 'all' ? '2025-2050' : timeRange}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Aggregation</div>
              <div className="font-semibold capitalize">{aggregationLevel}</div>
            </div>
          </div>
        </div>
      )}

      {/* Price Curves Chart */}
      {priceData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Price Curves - {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Comparison
          </h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  label={{ value: 'Price ($/MWh)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value, name) => [`$${value?.toFixed(2) || 0}/MWh`, name]}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Legend />
                
                {lineConfig.map(({ key, color, name }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, strokeWidth: 2, r: 4 }}
                    name={name}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Price Statistics */}
      {priceData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Price Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {lineConfig.map(({ key, color, name }) => {
              const prices = priceData
                .map(d => d[key])
                .filter(p => typeof p === 'number' && p > 0);
              
              if (prices.length === 0) return null;
              
              const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
              const min = Math.min(...prices);
              const max = Math.max(...prices);
              const variance = prices.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / prices.length;
              const stdDev = Math.sqrt(variance);
              
              return (
                <div key={key} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color }}
                    ></div>
                    <h3 className="font-semibold">{name}</h3>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average:</span>
                      <span className="font-medium">${avg.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Min:</span>
                      <span className="font-medium">${min.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Max:</span>
                      <span className="font-medium">${max.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Std Dev:</span>
                      <span className="font-medium">${stdDev.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Range:</span>
                      <span className="font-medium">${(max - min).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw Data Table */}
      {priceData.length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Raw Price Data</h2>
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              <FileText className="w-4 h-4" />
              {showRawData ? 'Hide Data' : 'Show Data'}
            </button>
          </div>
          
          {showRawData && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left">Time Period</th>
                    {lineConfig.map(({ key, name }) => (
                      <th key={key} className="px-3 py-2 text-left">
                        {name} ($/MWh)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {priceData.map((row, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-medium">{row.time}</td>
                      {lineConfig.map(({ key }) => (
                        <td key={key} className="px-3 py-2">
                          {typeof row[key] === 'number' 
                            ? `$${row[key].toFixed(2)}`
                            : '-'
                          }
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Data Source Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3 text-blue-900 flex items-center">
          <Database className="w-5 h-5 mr-2" />
          Data Source Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-blue-700 font-medium">Current Source:</div>
            <div className="text-blue-600">{priceSource}</div>
          </div>
          <div>
            <div className="text-blue-700 font-medium">Data Points:</div>
            <div className="text-blue-600">{priceData.length} time periods</div>
          </div>
          <div>
            <div className="text-blue-700 font-medium">Coverage:</div>
            <div className="text-blue-600">
              {viewMode === 'profiles' ? `${availableProfiles.length} profiles` :
               viewMode === 'regions' ? `${availableRegions.length} regions` :
               `${availableTypes.length} contract types`}
            </div>
          </div>
        </div>
        <div className="mt-3 text-blue-700 text-sm">
          Price data is sourced from the merchant price context which aggregates multiple data sources including 
          default CSV files and imported data. Use the import feature to upload your own price curves.
        </div>
      </div>

      {/* Status Display */}
      {priceData.length > 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-800 font-medium">
                Price data loaded successfully - {priceData.length} data points across {lineConfig.length} series
              </span>
            </div>
            <div className="text-green-600 text-sm">
              Last updated: {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      ) : !loading && !error && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">📈</div>
          <div className="text-gray-600">
            Configure your view settings to display price curves
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceCurvesPage;