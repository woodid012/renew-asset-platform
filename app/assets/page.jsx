'use client'

import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X,
  Sun,
  Wind,
  Battery,
  Zap,
  FileText,
  DollarSign,
  Calendar,
  Settings,
  TrendingUp,
  Copy,
  Upload,
  Download
} from 'lucide-react';

const EnhancedAssetManagement = () => {
  const { currentUser, currentPortfolio } = useUser();
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio Name');
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    state: 'NSW',
    type: 'solar',
    capacity: '',
    assetLife: 25,
    volumeLossAdjustment: 95,
    annualDegradation: 0.5,
    constructionStartDate: '',
    constructionDuration: 18,
    assetStartDate: '',
    
    // Performance factors
    qtrCapacityFactor_q1: '',
    qtrCapacityFactor_q2: '',
    qtrCapacityFactor_q3: '',
    qtrCapacityFactor_q4: '',
    
    // Storage specific
    volume: '',
    
    // Contracts array
    contracts: []
  });

  // Load portfolio data when user or portfolio changes
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadPortfolioData();
    }
  }, [currentUser, currentPortfolio]);

  const loadPortfolioData = async () => {
    if (!currentUser || !currentPortfolio) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`);
      if (response.ok) {
        const portfolioData = await response.json();
        setAssets(portfolioData.assets || {});
        setConstants(portfolioData.constants || {});
        setPortfolioName(portfolioData.portfolioName || 'Portfolio Name');
      } else if (response.status === 404) {
        // Portfolio doesn't exist, start fresh
        console.log('Creating new portfolio');
        setAssets({});
        setConstants({});
        setPortfolioName(currentPortfolio.portfolioName || 'Portfolio Name');
      } else {
        console.error('Failed to load portfolio');
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePortfolioData = async () => {
    if (!currentUser || !currentPortfolio) return;
    
    try {
      const portfolioData = {
        userId: currentUser.id,
        portfolioId: currentPortfolio.portfolioId,
        version: '2.0',
        portfolioName,
        assets,
        constants,
        analysisMode: 'simple',
        priceSource: 'merchant_price_monthly.csv',
        exportDate: new Date().toISOString()
      };

      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(portfolioData),
      });

      if (response.ok) {
        console.log('Portfolio saved successfully');
      } else {
        console.error('Failed to save portfolio');
      }
    } catch (error) {
      console.error('Error saving portfolio:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleContractChange = (contractIndex, field, value) => {
    setFormData(prev => ({
      ...prev,
      contracts: prev.contracts.map((contract, index) => 
        index === contractIndex ? { ...contract, [field]: value } : contract
      )
    }));
  };

  const addContract = () => {
    const newContract = {
      id: Date.now().toString(),
      counterparty: '',
      type: formData.type === 'storage' ? 'tolling' : 'bundled',
      buyersPercentage: 100,
      strikePrice: '',
      indexation: 2.5,
      indexationReferenceYear: new Date().getFullYear(),
      startDate: formData.assetStartDate || '',
      endDate: '',
      hasFloor: false,
      floorValue: ''
    };

    setFormData(prev => ({
      ...prev,
      contracts: [...prev.contracts, newContract]
    }));
  };

  const removeContract = (contractIndex) => {
    setFormData(prev => ({
      ...prev,
      contracts: prev.contracts.filter((_, index) => index !== contractIndex)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let assetId;
      let updatedAssets;

      if (editingAsset) {
        // Update existing asset
        assetId = editingAsset.id;
        updatedAssets = {
          ...assets,
          [assetId]: {
            ...formData,
            id: assetId,
            lastUpdated: new Date().toISOString()
          }
        };
      } else {
        // Create new asset - find next available ID
        const existingIds = Object.keys(assets).map(id => parseInt(id)).filter(id => !isNaN(id));
        assetId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        
        updatedAssets = {
          ...assets,
          [assetId]: {
            ...formData,
            id: assetId.toString(),
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          }
        };
      }

      setAssets(updatedAssets);
      
      // Initialize asset costs if needed
      if (!constants.assetCosts) {
        setConstants(prev => ({ ...prev, assetCosts: {} }));
      }
      
      if (!constants.assetCosts[formData.name]) {
        const defaultCosts = getDefaultAssetCosts(formData.type, formData.capacity);
        setConstants(prev => ({
          ...prev,
          assetCosts: {
            ...prev.assetCosts,
            [formData.name]: defaultCosts
          }
        }));
      }

      resetForm();
      await savePortfolioData();
    } catch (error) {
      console.error('Error saving asset:', error);
    }
  };

  const getDefaultAssetCosts = (type, capacity) => {
    const capexRates = { solar: 0.9, wind: 1.5, storage: 2.0 };
    const opexRates = { solar: 0.01, wind: 0.02, storage: 0.03 };
    
    const capex = (capexRates[type] || 1.0) * (capacity || 100);
    const operatingCosts = (opexRates[type] || 0.02) * (capacity || 100);
    
    return {
      capex: Math.round(capex * 10) / 10,
      operatingCosts: Math.round(operatingCosts * 100) / 100,
      operatingCostEscalation: 2.5,
      terminalValue: type === 'storage' ? Math.round(capacity * 0.5) : 0,
      maxGearing: type === 'solar' ? 0.7 : 0.65,
      targetDSCRContract: 1.4,
      targetDSCRMerchant: 1.8,
      interestRate: 0.06,
      tenorYears: 20,
      debtStructure: 'sculpting'
    };
  };

  const resetForm = () => {
    setFormData({
      name: '', state: 'NSW', type: 'solar', capacity: '', assetLife: 25,
      volumeLossAdjustment: 95, annualDegradation: 0.5, constructionStartDate: '',
      constructionDuration: 18, assetStartDate: '', qtrCapacityFactor_q1: '',
      qtrCapacityFactor_q2: '', qtrCapacityFactor_q3: '', qtrCapacityFactor_q4: '',
      volume: '', contracts: []
    });
    setShowForm(false);
    setEditingAsset(null);
    setActiveTab('basic');
  };

  const handleEdit = (asset) => {
    setFormData(asset);
    setEditingAsset(asset);
    setShowForm(true);
  };

  const handleDelete = async (assetId) => {
    if (window.confirm('Are you sure you want to delete this asset?')) {
      const updatedAssets = { ...assets };
      delete updatedAssets[assetId];
      setAssets(updatedAssets);
      
      // Also remove from asset costs
      if (constants.assetCosts && assets[assetId]) {
        const updatedConstants = { ...constants };
        delete updatedConstants.assetCosts[assets[assetId].name];
        setConstants(updatedConstants);
      }
      
      await savePortfolioData();
    }
  };

  const handleDuplicate = (asset) => {
    const newAsset = {
      ...asset,
      name: `${asset.name} (Copy)`,
      contracts: asset.contracts.map(contract => ({
        ...contract,
        id: Date.now().toString() + Math.random()
      }))
    };
    setFormData(newAsset);
    setEditingAsset(null);
    setShowForm(true);
  };

  const exportPortfolio = () => {
    const exportData = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      portfolioName,
      assets,
      constants,
      analysisMode: 'simple',
      activePortfolio: currentPortfolio?.portfolioId,
      priceSource: 'merchant_price_monthly.csv'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${portfolioName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      
      // Validate the import data structure
      if (!importData.assets || !importData.version) {
        throw new Error('Invalid portfolio file format');
      }

      // Update local state
      setAssets(importData.assets || {});
      setConstants(importData.constants || {});
      setPortfolioName(importData.portfolioName || 'Imported Portfolio');

      // Save to MongoDB using correct API structure
      const portfolioData = {
        userId: currentUser.id,
        portfolioId: currentPortfolio.portfolioId,
        version: importData.version || '2.0',
        portfolioName: importData.portfolioName || 'Imported Portfolio',
        assets: importData.assets || {},
        constants: importData.constants || {},
        analysisMode: importData.analysisMode || 'simple',
        activePortfolio: importData.activePortfolio || currentPortfolio.portfolioId,
        portfolioSource: file.name,
        priceSource: importData.priceSource || 'merchant_price_monthly.csv',
        exportDate: importData.exportDate || new Date().toISOString()
      };

      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(portfolioData),
      });

      if (response.ok) {
        alert(`Portfolio imported successfully!\n\n` +
              `• ${Object.keys(importData.assets || {}).length} assets loaded\n` +
              `• Portfolio name: ${importData.portfolioName || 'Imported Portfolio'}\n` +
              `• Data saved to MongoDB`);
      } else {
        throw new Error('Failed to save portfolio to database');
      }

    } catch (error) {
      console.error('Import error:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const triggerImport = () => {
    document.getElementById('import-file-input').click();
  };

  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-5 h-5 text-yellow-500" />;
      case 'wind': return <Wind className="w-5 h-5 text-blue-500" />;
      case 'storage': return <Battery className="w-5 h-5 text-green-500" />;
      default: return <Zap className="w-5 h-5 text-gray-500" />;
    }
  };

  const getContractTypeOptions = (assetType) => {
    if (assetType === 'storage') {
      return ['tolling', 'cfd', 'fixed'];
    }
    return ['bundled', 'green', 'Energy', 'fixed'];
  };

  const calculateTotalCapacity = () => {
    return Object.values(assets).reduce((sum, asset) => sum + (parseFloat(asset.capacity) || 0), 0);
  };

  const calculateTotalValue = () => {
    return Object.values(constants.assetCosts || {}).reduce((sum, costs) => sum + (costs.capex || 0), 0);
  };

  // Show loading state if user/portfolio not selected
  if (!currentUser || !currentPortfolio) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Portfolio Selected</h3>
          <p className="text-gray-600">Please select a user and portfolio to manage assets</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading portfolio data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-4 mb-2">
            <input
              type="text"
              value={portfolioName}
              onChange={(e) => setPortfolioName(e.target.value)}
              onBlur={savePortfolioData}
              className="text-2xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-2"
            />
          </div>
          <p className="text-gray-600">
            {Object.keys(assets).length} assets • {calculateTotalCapacity().toFixed(1)} MW • 
            ${calculateTotalValue().toFixed(1)}M CAPEX
          </p>
          <p className="text-sm text-gray-500">
            User: {currentUser.name} • Portfolio: {currentPortfolio.portfolioName}
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={triggerImport}
            disabled={importing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{importing ? 'Importing...' : 'Import'}</span>
          </button>
          <button
            onClick={exportPortfolio}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-700"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        id="import-file-input"
        type="file"
        accept=".json"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />

      {/* Asset Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.values(assets).map((asset) => (
          <div key={asset.id} className="bg-white rounded-lg shadow border hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getAssetIcon(asset.type)}
                  <div>
                    <h3 className="font-semibold text-gray-900">{asset.name}</h3>
                    <p className="text-sm text-gray-500">{asset.state}</p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleDuplicate(asset)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="Duplicate Asset"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(asset)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Capacity:</span>
                  <span className="font-medium">{asset.capacity} MW</span>
                </div>
                {asset.type === 'storage' && asset.volume && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Storage:</span>
                    <span className="font-medium">{asset.volume} MWh</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Operations:</span>
                  <span className="font-medium">
                    {asset.assetStartDate ? new Date(asset.assetStartDate).getFullYear() : 'TBD'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Contracts:</span>
                  <span className="font-medium">{asset.contracts?.length || 0}</span>
                </div>
                {constants.assetCosts?.[asset.name] && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">CAPEX:</span>
                    <span className="font-medium">${constants.assetCosts[asset.name].capex}M</span>
                  </div>
                )}
              </div>

              {/* Contract summary */}
              {asset.contracts?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-500 mb-1">Primary Contract:</div>
                  <div className="text-sm">
                    <span className="font-medium">{asset.contracts[0].counterparty || 'TBD'}</span>
                    <span className="text-gray-500"> • </span>
                    <span className="capitalize">{asset.contracts[0].type}</span>
                    {asset.contracts[0].strikePrice && (
                      <>
                        <span className="text-gray-500"> • </span>
                        <span>${asset.contracts[0].strikePrice}/MWh</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Asset Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-screen overflow-y-auto">
            <form onSubmit={handleSubmit}>
              {/* Form Header */}
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-xl font-semibold">
                  {editingAsset ? 'Edit Asset' : 'Add New Asset'}
                </h2>
                <button type="button" onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'basic', label: 'Basic Details', icon: FileText },
                    { id: 'performance', label: 'Performance', icon: TrendingUp },
                    { id: 'timeline', label: 'Timeline', icon: Calendar },
                    { id: 'contracts', label: 'Contracts', icon: DollarSign },
                    { id: 'costs', label: 'Costs', icon: Settings }
                  ].map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-4 border-b-2 font-medium text-sm ${
                          activeTab === tab.id
                            ? 'border-green-500 text-green-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Icon className="w-4 h-4 inline mr-2" />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="p-6">
                {/* Basic Details Tab */}
                {activeTab === 'basic' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <select
                          value={formData.state}
                          onChange={(e) => handleInputChange('state', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        >
                          {['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS'].map(state => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Technology Type</label>
                        <select
                          value={formData.type}
                          onChange={(e) => handleInputChange('type', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        >
                          <option value="solar">Solar</option>
                          <option value="wind">Wind</option>
                          <option value="storage">Battery Storage</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (MW)</label>
                        <input
                          type="number"
                          value={formData.capacity}
                          onChange={(e) => handleInputChange('capacity', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          step="0.1"
                          required
                        />
                      </div>
                      {formData.type === 'storage' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Storage Volume (MWh)</label>
                          <input
                            type="number"
                            value={formData.volume}
                            onChange={(e) => handleInputChange('volume', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            step="0.1"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Asset Life (years)</label>
                        <input
                          type="number"
                          value={formData.assetLife}
                          onChange={(e) => handleInputChange('assetLife', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Performance Tab */}
                {activeTab === 'performance' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Volume Loss Adjustment (%)</label>
                        <input
                          type="number"
                          value={formData.volumeLossAdjustment}
                          onChange={(e) => handleInputChange('volumeLossAdjustment', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          min="0"
                          max="100"
                          step="0.1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Annual Degradation (%)</label>
                        <input
                          type="number"
                          value={formData.annualDegradation}
                          onChange={(e) => handleInputChange('annualDegradation', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          step="0.1"
                        />
                      </div>
                    </div>

                    {formData.type !== 'storage' && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Quarterly Capacity Factors (%)</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {['q1', 'q2', 'q3', 'q4'].map(quarter => (
                            <div key={quarter}>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {quarter.toUpperCase()}
                              </label>
                              <input
                                type="number"
                                value={formData[`qtrCapacityFactor_${quarter}`]}
                                onChange={(e) => handleInputChange(`qtrCapacityFactor_${quarter}`, e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md"
                                min="0"
                                max="100"
                                step="0.1"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline Tab */}
                {activeTab === 'timeline' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Construction Start</label>
                        <input
                          type="date"
                          value={formData.constructionStartDate}
                          onChange={(e) => handleInputChange('constructionStartDate', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Construction Duration (months)</label>
                        <input
                          type="number"
                          value={formData.constructionDuration}
                          onChange={(e) => handleInputChange('constructionDuration', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Operations Start</label>
                        <input
                          type="date"
                          value={formData.assetStartDate}
                          onChange={(e) => handleInputChange('assetStartDate', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Contracts Tab */}
                {activeTab === 'contracts' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Revenue Contracts</h3>
                      <button
                        type="button"
                        onClick={addContract}
                        className="bg-green-600 text-white px-3 py-1 rounded flex items-center space-x-1 text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Contract</span>
                      </button>
                    </div>

                    {formData.contracts.map((contract, index) => (
                      <div key={contract.id} className="border border-gray-200 rounded-lg p-4 relative">
                        <button
                          type="button"
                          onClick={() => removeContract(index)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-8">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Counterparty</label>
                            <input
                              type="text"
                              value={contract.counterparty}
                              onChange={(e) => handleContractChange(index, 'counterparty', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contract Type</label>
                            <select
                              value={contract.type}
                              onChange={(e) => handleContractChange(index, 'type', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            >
                              {getContractTypeOptions(formData.type).map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Strike Price ($/MWh)</label>
                            <input
                              type="number"
                              value={contract.strikePrice}
                              onChange={(e) => handleContractChange(index, 'strikePrice', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Buyer's Percentage (%)</label>
                            <input
                              type="number"
                              value={contract.buyersPercentage}
                              onChange={(e) => handleContractChange(index, 'buyersPercentage', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                              min="0"
                              max="100"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <input
                              type="date"
                              value={contract.startDate}
                              onChange={(e) => handleContractChange(index, 'startDate', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                            <input
                              type="date"
                              value={contract.endDate}
                              onChange={(e) => handleContractChange(index, 'endDate', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Indexation (%/year)</label>
                            <input
                              type="number"
                              value={contract.indexation}
                              onChange={(e) => handleContractChange(index, 'indexation', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                              step="0.1"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Reference Year</label>
                            <input
                              type="number"
                              value={contract.indexationReferenceYear}
                              onChange={(e) => handleContractChange(index, 'indexationReferenceYear', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                              min="2020"
                              max="2030"
                            />
                          </div>

                          {/* Contract type specific fields */}
                          {contract.type === 'bundled' && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Energy Price ($/MWh)</label>
                                <input
                                  type="number"
                                  value={contract.EnergyPrice || ''}
                                  onChange={(e) => handleContractChange(index, 'EnergyPrice', e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded-md"
                                  step="0.01"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Green Price ($/MWh)</label>
                                <input
                                  type="number"
                                  value={contract.greenPrice || ''}
                                  onChange={(e) => handleContractChange(index, 'greenPrice', e.target.value)}
                                  className="w-full p-2 border border-gray-300 rounded-md"
                                  step="0.01"
                                />
                              </div>
                            </>
                          )}

                          {/* Floor options */}
                          <div className="col-span-2">
                            <div className="flex items-center space-x-2 mb-2">
                              <input
                                type="checkbox"
                                id={`hasFloor-${index}`}
                                checked={contract.hasFloor || false}
                                onChange={(e) => handleContractChange(index, 'hasFloor', e.target.checked)}
                                className="w-4 h-4 text-green-600 border-gray-300 rounded"
                              />
                              <label htmlFor={`hasFloor-${index}`} className="text-sm font-medium text-gray-700">
                                Has Floor Price
                              </label>
                            </div>
                            {contract.hasFloor && (
                              <input
                                type="number"
                                placeholder="Floor Value"
                                value={contract.floorValue || ''}
                                onChange={(e) => handleContractChange(index, 'floorValue', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md"
                                step="0.01"
                              />
                            )}
                          </div>
                        </div>

                        {/* Contract Summary */}
                        <div className="mt-4 p-3 bg-gray-50 rounded">
                          <div className="text-sm text-gray-600">
                            <strong>Contract Summary:</strong> {contract.counterparty || 'TBD'} • 
                            {contract.type} • {contract.buyersPercentage}% • 
                            ${contract.strikePrice || '0'}/MWh
                            {contract.startDate && contract.endDate && (
                              <span> • {Math.round((new Date(contract.endDate) - new Date(contract.startDate)) / (365.25 * 24 * 60 * 60 * 1000))} years</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {formData.contracts.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p>No contracts added yet</p>
                        <p className="text-sm">Add contracts to define revenue arrangements</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Costs Tab */}
                {activeTab === 'costs' && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Cost Configuration</h4>
                      <p className="text-sm text-blue-700">
                        Asset costs are automatically calculated based on capacity and technology type. 
                        You can adjust these in the Portfolio Configuration after saving the asset.
                      </p>
                    </div>

                    {formData.capacity && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <h4 className="font-medium text-gray-900">Estimated Costs</h4>
                          {(() => {
                            const defaultCosts = getDefaultAssetCosts(formData.type, parseFloat(formData.capacity) || 0);
                            return (
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">CAPEX:</span>
                                  <span className="font-medium">${defaultCosts.capex}M</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Annual OPEX:</span>
                                  <span className="font-medium">${defaultCosts.operatingCosts}M</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Terminal Value:</span>
                                  <span className="font-medium">${defaultCosts.terminalValue}M</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-medium text-gray-900">Finance Assumptions</h4>
                          {(() => {
                            const defaultCosts = getDefaultAssetCosts(formData.type, parseFloat(formData.capacity) || 0);
                            return (
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Max Gearing:</span>
                                  <span className="font-medium">{(defaultCosts.maxGearing * 100).toFixed(0)}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Target DSCR:</span>
                                  <span className="font-medium">{defaultCosts.targetDSCRContract}x</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Interest Rate:</span>
                                  <span className="font-medium">{(defaultCosts.interestRate * 100).toFixed(1)}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Loan Tenor:</span>
                                  <span className="font-medium">{defaultCosts.tenorYears} years</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingAsset ? 'Update' : 'Create'} Asset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      {Object.keys(assets).length > 0 && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-semibold mb-4">Portfolio Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <div className="text-2xl font-bold text-green-600">{Object.keys(assets).length}</div>
              <div className="text-sm text-gray-600">Total Assets</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{calculateTotalCapacity().toFixed(1)} MW</div>
              <div className="text-sm text-gray-600">Total Capacity</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {Object.values(assets).reduce((sum, asset) => sum + (asset.contracts?.length || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">Total Contracts</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">${calculateTotalValue().toFixed(1)}M</div>
              <div className="text-sm text-gray-600">Total CAPEX</div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {Object.keys(assets).length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Zap className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assets defined yet</h3>
          <p className="text-gray-600 mb-4">
            Start building your renewable energy portfolio by adding your first asset
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 mx-auto hover:bg-green-700"
          >
            <Plus className="w-5 h-5" />
            <span>Add Your First Asset</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default EnhancedAssetManagement;