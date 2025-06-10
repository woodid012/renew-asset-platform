'use client';

import { useState, useMemo } from 'react';

// Generic time series data point
export interface TimeSeriesPoint<T = number> {
  timestamp: string; // ISO string or custom format
  value: T;
  metadata?: Record<string, any>; // Additional data preservation
}

// Aggregation functions
export type AggregationMethod = 'sum' | 'average' | 'min' | 'max' | 'first' | 'last' | 'count';

// Time intervals
export type TimeInterval = 
  | '5min' | '15min' | '30min' | 'hourly' 
  | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

// Generic configuration
export interface TimeSeriesConfig<T = number> {
  label: string;
  unit: string;
  valueType: 'number' | 'currency' | 'percentage' | 'custom';
  precision?: number;
  defaultValue?: T;
  aggregationMethod: AggregationMethod;
  allowedIntervals: TimeInterval[];
  customFormatter?: (value: T) => string;
  customParser?: (input: string) => T;
}

interface TimeSeriesEditorProps<T = number> {
  data: TimeSeriesPoint<T>[];
  config: TimeSeriesConfig<T>;
  onDataChange: (data: TimeSeriesPoint<T>[]) => void;
  onClose: () => void;
  startDate?: string;
  endDate?: string;
}

// Time series utilities
class TimeSeriesUtils {
  // Parse various timestamp formats
  static parseTimestamp(timestamp: string): Date {
    // Handle various formats: ISO, YYYY-MM-DD, YYYY-MM-DD HH:mm, etc.
    const patterns = [
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO format
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/, // YYYY-MM-DD HH:mm
      /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
      /^\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}/ // M/D/YYYY H:mm
    ];
    
    return new Date(timestamp);
  }

  // Generate time buckets for aggregation
  static generateTimeBuckets(start: Date, end: Date, interval: TimeInterval): Date[] {
    const buckets: Date[] = [];
    const current = new Date(start);
    
    while (current <= end) {
      buckets.push(new Date(current));
      
      switch (interval) {
        case '5min':
          current.setMinutes(current.getMinutes() + 5);
          break;
        case '15min':
          current.setMinutes(current.getMinutes() + 15);
          break;
        case '30min':
          current.setMinutes(current.getMinutes() + 30);
          break;
        case 'hourly':
          current.setHours(current.getHours() + 1);
          break;
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
        case 'quarterly':
          current.setMonth(current.getMonth() + 3);
          break;
        case 'yearly':
          current.setFullYear(current.getFullYear() + 1);
          break;
      }
    }
    
    return buckets;
  }

  // Aggregate data points
  static aggregateData<T>(
    data: TimeSeriesPoint<T>[], 
    interval: TimeInterval, 
    method: AggregationMethod,
    startDate?: Date,
    endDate?: Date
  ): TimeSeriesPoint<T>[] {
    if (data.length === 0) return [];

    // Determine date range
    const start = startDate || TimeSeriesUtils.parseTimestamp(data[0].timestamp);
    const end = endDate || TimeSeriesUtils.parseTimestamp(data[data.length - 1].timestamp);
    
    const buckets = TimeSeriesUtils.generateTimeBuckets(start, end, interval);
    const aggregated: TimeSeriesPoint<T>[] = [];

    buckets.forEach((bucketStart, index) => {
      const bucketEnd = buckets[index + 1] || end;
      
      // Find data points in this bucket
      const pointsInBucket = data.filter(point => {
        const pointTime = TimeSeriesUtils.parseTimestamp(point.timestamp);
        return pointTime >= bucketStart && pointTime < bucketEnd;
      });

      if (pointsInBucket.length === 0) return;

      let aggregatedValue: T;
      const numericValues = pointsInBucket.map(p => Number(p.value)).filter(v => !isNaN(v));

      switch (method) {
        case 'sum':
          aggregatedValue = numericValues.reduce((a, b) => a + b, 0) as T;
          break;
        case 'average':
          aggregatedValue = (numericValues.reduce((a, b) => a + b, 0) / numericValues.length) as T;
          break;
        case 'min':
          aggregatedValue = Math.min(...numericValues) as T;
          break;
        case 'max':
          aggregatedValue = Math.max(...numericValues) as T;
          break;
        case 'first':
          aggregatedValue = pointsInBucket[0].value;
          break;
        case 'last':
          aggregatedValue = pointsInBucket[pointsInBucket.length - 1].value;
          break;
        case 'count':
          aggregatedValue = pointsInBucket.length as T;
          break;
        default:
          aggregatedValue = pointsInBucket[0].value;
      }

      // Preserve metadata from all points in bucket
      const combinedMetadata = pointsInBucket.reduce((acc, point) => ({
        ...acc,
        ...point.metadata,
        originalCount: pointsInBucket.length,
        bucketStart: bucketStart.toISOString(),
        bucketEnd: bucketEnd.toISOString()
      }), {});

      aggregated.push({
        timestamp: bucketStart.toISOString(),
        value: aggregatedValue,
        metadata: combinedMetadata
      });
    });

    return aggregated;
  }

  // Detect data frequency
  static detectDataFrequency<T>(data: TimeSeriesPoint<T>[]): TimeInterval {
    if (data.length < 2) return 'daily';

    const intervals: number[] = [];
    for (let i = 1; i < Math.min(data.length, 100); i++) {
      const prev = TimeSeriesUtils.parseTimestamp(data[i-1].timestamp);
      const curr = TimeSeriesUtils.parseTimestamp(data[i].timestamp);
      intervals.push(curr.getTime() - prev.getTime());
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const minutes = avgInterval / (1000 * 60);

    if (minutes <= 5) return '5min';
    if (minutes <= 15) return '15min';
    if (minutes <= 30) return '30min';
    if (minutes <= 60) return 'hourly';
    if (minutes <= 1440) return 'daily';
    if (minutes <= 10080) return 'weekly';
    if (minutes <= 44640) return 'monthly';
    if (minutes <= 133920) return 'quarterly';
    return 'yearly';
  }

  // Format timestamp for display
  static formatTimestamp(timestamp: string, interval: TimeInterval): string {
    const date = TimeSeriesUtils.parseTimestamp(timestamp);
    
    switch (interval) {
      case '5min':
      case '15min':
      case '30min':
      case 'hourly':
        return date.toLocaleString();
      case 'daily':
        return date.toLocaleDateString();
      case 'weekly':
        return `Week of ${date.toLocaleDateString()}`;
      case 'monthly':
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      case 'quarterly':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter} ${date.getFullYear()}`;
      case 'yearly':
        return date.getFullYear().toString();
      default:
        return date.toLocaleDateString();
    }
  }
}

export default function TimeSeriesEditor<T = number>({
  data,
  config,
  onDataChange,
  onClose,
  startDate,
  endDate
}: TimeSeriesEditorProps<T>) {
  // State management
  const [selectedInterval, setSelectedInterval] = useState<TimeInterval>(() => 
    TimeSeriesUtils.detectDataFrequency(data)
  );
  const [selectedAggregation, setSelectedAggregation] = useState<AggregationMethod>(config.aggregationMethod);
  const [showRawData, setShowRawData] = useState(false);
  const [editMode, setEditMode] = useState<'view' | 'edit' | 'bulk'>('view');
  const [bulkValue, setBulkValue] = useState<string>('');

  // Memoized aggregated data
  const aggregatedData = useMemo(() => {
    if (data.length === 0) return [];
    
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return TimeSeriesUtils.aggregateData(data, selectedInterval, selectedAggregation, start, end);
  }, [data, selectedInterval, selectedAggregation, startDate, endDate]);

  // Data statistics
  const stats = useMemo(() => {
    const values = aggregatedData.map(d => Number(d.value)).filter(v => !isNaN(v));
    if (values.length === 0) return null;

    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      average: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      originalCount: data.length
    };
  }, [aggregatedData, data.length]);

  // Format value for display
  const formatValue = (value: T): string => {
    if (config.customFormatter) {
      return config.customFormatter(value);
    }

    const numValue = Number(value);
    if (isNaN(numValue)) return String(value);

    const precision = config.precision ?? 2;

    switch (config.valueType) {
      case 'currency':
        return `$${numValue.toLocaleString(undefined, { 
          minimumFractionDigits: precision,
          maximumFractionDigits: precision 
        })}`;
      case 'percentage':
        return `${numValue.toFixed(precision)}%`;
      case 'number':
      default:
        return `${numValue.toLocaleString(undefined, { 
          minimumFractionDigits: precision,
          maximumFractionDigits: precision 
        })} ${config.unit}`;
    }
  };

  // Parse input value
  const parseValue = (input: string): T => {
    if (config.customParser) {
      return config.customParser(input);
    }
    return Number(input) as T;
  };

  // Update aggregated value
  const updateValue = (index: number, newValue: string) => {
    try {
      const parsedValue = parseValue(newValue);
      const updatedData = [...aggregatedData];
      updatedData[index] = { ...updatedData[index], value: parsedValue };
      
      // For now, we update the aggregated view
      // In a full implementation, you'd need to distribute this back to raw data
      onDataChange(updatedData);
    } catch (error) {
      console.error('Error parsing value:', error);
    }
  };

  // Apply bulk edit
  const applyBulkEdit = () => {
    if (!bulkValue.trim()) return;

    try {
      const parsedValue = parseValue(bulkValue);
      const updatedData = aggregatedData.map(point => ({
        ...point,
        value: parsedValue
      }));
      
      onDataChange(updatedData);
      setBulkValue('');
      setEditMode('view');
    } catch (error) {
      console.error('Error in bulk edit:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              📊 {config.label} Time Series Editor
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Data Overview */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">Data Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-600">Original Points:</span>
                <div className="font-medium">{data.length.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-blue-600">Aggregated Points:</span>
                <div className="font-medium">{aggregatedData.length.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-blue-600">Detected Frequency:</span>
                <div className="font-medium capitalize">{TimeSeriesUtils.detectDataFrequency(data)}</div>
              </div>
              <div>
                <span className="text-blue-600">Current View:</span>
                <div className="font-medium capitalize">{selectedInterval}</div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              {/* Interval Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Interval
                </label>
                <select
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(e.target.value as TimeInterval)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {config.allowedIntervals.map(interval => (
                    <option key={interval} value={interval}>
                      {interval.charAt(0).toUpperCase() + interval.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aggregation Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aggregation
                </label>
                <select
                  value={selectedAggregation}
                  onChange={(e) => setSelectedAggregation(e.target.value as AggregationMethod)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sum">Sum</option>
                  <option value="average">Average</option>
                  <option value="min">Minimum</option>
                  <option value="max">Maximum</option>
                  <option value="first">First</option>
                  <option value="last">Last</option>
                  <option value="count">Count</option>
                </select>
              </div>

              {/* Edit Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Edit Mode
                </label>
                <select
                  value={editMode}
                  onChange={(e) => setEditMode(e.target.value as 'view' | 'edit' | 'bulk')}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="view">View Only</option>
                  <option value="edit">Edit Individual</option>
                  <option value="bulk">Bulk Edit</option>
                </select>
              </div>

              {/* Raw Data Toggle */}
              <div className="flex items-end">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={showRawData}
                    onChange={(e) => setShowRawData(e.target.checked)}
                    className="mr-2"
                  />
                  Show Raw Data
                </label>
              </div>
            </div>

            {/* Bulk Edit Controls */}
            {editMode === 'bulk' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Bulk Edit All Values</h4>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    placeholder={`Enter ${config.label.toLowerCase()} value`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <button
                    onClick={applyBulkEdit}
                    className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition-colors"
                  >
                    Apply to All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Statistics */}
          {stats && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Count:</span>
                  <div className="font-medium">{stats.count}</div>
                </div>
                <div>
                  <span className="text-gray-600">Sum:</span>
                  <div className="font-medium">{formatValue(stats.sum as T)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Average:</span>
                  <div className="font-medium">{formatValue(stats.average as T)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Min:</span>
                  <div className="font-medium">{formatValue(stats.min as T)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Max:</span>
                  <div className="font-medium">{formatValue(stats.max as T)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Data Grid */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700">Time Period</th>
                    <th className="text-left p-3 font-semibold text-gray-700">{config.label}</th>
                    {showRawData && <th className="text-left p-3 font-semibold text-gray-700">Original Count</th>}
                  </tr>
                </thead>
                <tbody>
                  {aggregatedData.map((point, index) => (
                    <tr key={point.timestamp} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 font-medium">
                        {TimeSeriesUtils.formatTimestamp(point.timestamp, selectedInterval)}
                      </td>
                      <td className="p-3">
                        {editMode === 'edit' ? (
                          <input
                            type="text"
                            value={String(point.value)}
                            onChange={(e) => updateValue(index, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="font-medium">{formatValue(point.value)}</span>
                        )}
                      </td>
                      {showRawData && (
                        <td className="p-3 text-gray-600">
                          {point.metadata?.originalCount || 1}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200 mt-6">
            <button
              onClick={() => onDataChange(aggregatedData)}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              Apply Changes
            </button>
            <button
              onClick={onClose}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}