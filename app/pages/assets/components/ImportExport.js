'use client'

import { useState } from 'react';
import { 
  Upload, 
  Download, 
  FileText,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

const ImportExport = ({ 
  assets,
  setAssets,
  constants,
  setConstants,
  portfolioName,
  setPortfolioName,
  setHasUnsavedChanges
}) => {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Handle file import
  const handleImportFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('Please select a JSON file');
      return;
    }

    setImporting(true);
    
    try {
      const fileContent = await file.text();
      const importData = JSON.parse(fileContent);
      
      if (!importData.assets || !importData.version) {
        throw new Error('Invalid portfolio file format');
      }

      console.log('Importing data:', {
        assetsCount: Object.keys(importData.assets || {}).length,
        portfolioName: importData.portfolioName,
        version: importData.version
      });

      // Update local state
      setAssets(importData.assets || {});
      setConstants(importData.constants || {});
      setPortfolioName(importData.portfolioName || 'Imported Portfolio');
      setHasUnsavedChanges(true);

      alert(`Portfolio imported successfully!\n\n` +
            `• ${Object.keys(importData.assets || {}).length} assets loaded\n` +
            `• Portfolio name: ${importData.portfolioName || 'Imported Portfolio'}\n` +
            `• Remember to save your changes`);

    } catch (error) {
      console.error('Import error:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  // Export portfolio as JSON
  const exportPortfolio = () => {
    setExporting(true);
    
    try {
      const exportData = {
        version: '2.0',
        portfolioName,
        assets,
        constants,
        exportDate: new Date().toISOString(),
        metadata: {
          assetCount: Object.keys(assets).length,
          totalCapacity: Object.values(assets).reduce((sum, asset) => sum + (parseFloat(asset.capacity) || 0), 0),
          totalContracts: Object.values(assets).reduce((sum, asset) => sum + (asset.contracts?.length || 0), 0)
        }
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${portfolioName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('Portfolio exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Export assets as CSV
  const exportCSV = () => {
    setExporting(true);
    
    try {
      const headers = [
        'Name',
        'State', 
        'Type',
        'Capacity (MW)',
        'Storage (MWh)',
        'Asset Life',
        'Volume Loss Adj (%)',
        'Annual Degradation (%)',
        'Q1 CF (%)',
        'Q2 CF (%)',
        'Q3 CF (%)',
        'Q4 CF (%)',
        'Construction Start',
        'Construction Duration (months)',
        'Operations Start',
        'Contracts Count',
        'CAPEX ($M)',
        'Annual OPEX ($M)'
      ];

      const rows = Object.values(assets).map(asset => {
        const costs = constants.assetCosts?.[asset.name] || {};
        return [
          asset.name || '',
          asset.state || '',
          asset.type || '',
          asset.capacity || '',
          asset.volume || '',
          asset.assetLife || '',
          asset.volumeLossAdjustment || '',
          asset.annualDegradation || '',
          asset.qtrCapacityFactor_q1 || '',
          asset.qtrCapacityFactor_q2 || '',
          asset.qtrCapacityFactor_q3 || '',
          asset.qtrCapacityFactor_q4 || '',
          asset.constructionStartDate || '',
          asset.constructionDuration || '',
          asset.assetStartDate || '',
          asset.contracts?.length || 0,
          costs.capex || '',
          costs.operatingCosts || ''
        ].map(value => {
          // Escape commas and quotes in CSV
          const strValue = String(value);
          if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
            return `"${strValue.replace(/"/g, '""')}"`;
          }
          return strValue;
        });
      });

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      
      const dataBlob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${portfolioName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_assets_${new Date().toISOString().split('T')[0]}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('Assets CSV exported successfully');
    } catch (error) {
      console.error('CSV export error:', error);
      alert(`CSV export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  // Export contracts as CSV
  const exportContractsCSV = () => {
    setExporting(true);
    
    try {
      const headers = [
        'Asset Name',
        'Asset Type',
        'Counterparty',
        'Contract Type',
        'Strike Price',
        'Unit',
        'Coverage (%)',
        'Start Date',
        'End Date',
        'Duration (years)',
        'Indexation (%)',
        'Reference Year',
        'Has Floor',
        'Floor Value'
      ];

      const rows = [];
      Object.values(assets).forEach(asset => {
        if (asset.contracts && asset.contracts.length > 0) {
          asset.contracts.forEach(contract => {
            const duration = contract.startDate && contract.endDate 
              ? Math.round((new Date(contract.endDate) - new Date(contract.startDate)) / (365.25 * 24 * 60 * 60 * 1000))
              : '';
            
            const unit = asset.type === 'storage' ? '$/MW/hr' : '$/MWh';
            
            rows.push([
              asset.name || '',
              asset.type || '',
              contract.counterparty || '',
              contract.type || '',
              contract.strikePrice || '',
              unit,
              contract.buyersPercentage || '',
              contract.startDate || '',
              contract.endDate || '',
              duration,
              contract.indexation || '',
              contract.indexationReferenceYear || '',
              contract.hasFloor ? 'Yes' : 'No',
              contract.floorValue || ''
            ].map(value => {
              const strValue = String(value);
              if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                return `"${strValue.replace(/"/g, '""')}"`;
              }
              return strValue;
            }));
          });
        }
      });

      if (rows.length === 0) {
        alert('No contracts to export');
        setExporting(false);
        return;
      }

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      
      const dataBlob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${portfolioName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_contracts_${new Date().toISOString().split('T')[0]}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('Contracts CSV exported successfully');
    } catch (error) {
      console.error('Contracts CSV export error:', error);
      alert(`Contracts CSV export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const triggerImport = () => {
    document.getElementById('import-file-input').click();
  };

  const calculateStats = () => {
    const assetCount = Object.keys(assets).length;
    const totalCapacity = Object.values(assets).reduce((sum, asset) => sum + (parseFloat(asset.capacity) || 0), 0);
    const totalContracts = Object.values(assets).reduce((sum, asset) => sum + (asset.contracts?.length || 0), 0);
    const totalCapex = Object.values(constants.assetCosts || {}).reduce((sum, costs) => sum + (costs.capex || 0), 0);
    
    return { assetCount, totalCapacity, totalContracts, totalCapex };
  };

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Portfolio Stats */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4">Portfolio Export Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.assetCount}</div>
            <div className="text-sm text-gray-600">Assets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalCapacity.toFixed(1)} MW</div>
            <div className="text-sm text-gray-600">Total Capacity</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.totalContracts}</div>
            <div className="text-sm text-gray-600">Contracts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">${stats.totalCapex.toFixed(1)}M</div>
            <div className="text-sm text-gray-600">Total CAPEX</div>
          </div>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2 text-blue-600" />
          Import Portfolio
        </h3>
        <p className="text-gray-600 mb-4">
          Import a complete portfolio from a JSON file. This will replace all current assets and settings.
        </p>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={triggerImport}
            disabled={importing}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
            <span>{importing ? 'Importing...' : 'Import JSON File'}</span>
          </button>
          
          <div className="text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <FileText className="w-4 h-4" />
              <span>Accepts: .json files only</span>
            </div>
          </div>
        </div>

        <input
          id="import-file-input"
          type="file"
          accept=".json"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />

        {importing && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-blue-800">Processing import file...</span>
            </div>
          </div>
        )}
      </div>

      {/* Export Section */}
      <div className="bg-white rounded-lg shadow border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Download className="w-5 h-5 mr-2 text-green-600" />
          Export Portfolio
        </h3>
        <p className="text-gray-600 mb-6">
          Export your portfolio data in different formats for backup, analysis, or sharing.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* JSON Export */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Complete Portfolio (JSON)</h4>
            <p className="text-sm text-gray-600 mb-4">
              Full portfolio backup including all assets, contracts, and settings. Can be re-imported later.
            </p>
            <button
              onClick={exportPortfolio}
              disabled={exporting || stats.assetCount === 0}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 hover:bg-green-700 disabled:opacity-50"
            >
              {exporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Export JSON</span>
            </button>
          </div>

          {/* Assets CSV Export */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Assets Summary (CSV)</h4>
            <p className="text-sm text-gray-600 mb-4">
              Asset details and parameters in spreadsheet format for analysis and reporting.
            </p>
            <button
              onClick={exportCSV}
              disabled={exporting || stats.assetCount === 0}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {exporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Export Assets CSV</span>
            </button>
          </div>

          {/* Contracts CSV Export */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Contracts Details (CSV)</h4>
            <p className="text-sm text-gray-600 mb-4">
              All contract details including pricing, dates, and terms for contract management.
            </p>
            <button
              onClick={exportContractsCSV}
              disabled={exporting || stats.totalContracts === 0}
              className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2 hover:bg-purple-700 disabled:opacity-50"
            >
              {exporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Export Contracts CSV</span>
            </button>
          </div>
        </div>

        {stats.assetCount === 0 && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">No assets to export. Add assets to enable export functionality.</span>
            </div>
          </div>
        )}
      </div>

      {/* Export Format Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-medium text-blue-900 mb-3">Export Format Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-blue-800 mb-2">JSON Format:</h4>
            <ul className="text-blue-700 space-y-1">
              <li>• Complete portfolio backup</li>
              <li>• All assets and contracts</li>
              <li>• Financial parameters</li>
              <li>• Can be re-imported</li>
              <li>• Includes metadata</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 mb-2">Assets CSV:</h4>
            <ul className="text-blue-700 space-y-1">
              <li>• Asset technical details</li>
              <li>• Capacity and performance</li>
              <li>• Timeline information</li>
              <li>• Cost parameters</li>
              <li>• Excel/spreadsheet ready</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 mb-2">Contracts CSV:</h4>
            <ul className="text-blue-700 space-y-1">
              <li>• Contract pricing details</li>
              <li>• Terms and coverage</li>
              <li>• Dates and duration</li>
              <li>• Counterparty information</li>
              <li>• Correct units ($/MW/hr for storage)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportExport;