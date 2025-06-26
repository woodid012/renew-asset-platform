'use client'

import { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import AssetCards from './components/AssetCards';
import BulkEdit from './components/BulkEdit';
import ImportExport from './components/ImportExport';
import AssetForm from './components/AssetForm';
import { 
  Plus, 
  Save, 
  X,
  Zap,
  AlertCircle,
  CheckCircle,
  Grid3X3,
  Table,
  Download
} from 'lucide-react';

const EnhancedAssetManagement = () => {
  const { currentUser, currentPortfolio } = useUser();
  
  // Original data from database
  const [originalAssets, setOriginalAssets] = useState({});
  const [originalConstants, setOriginalConstants] = useState({});
  const [originalPortfolioName, setOriginalPortfolioName] = useState('Portfolio Name');
  
  // Local working state
  const [assets, setAssets] = useState({});
  const [constants, setConstants] = useState({});
  const [portfolioName, setPortfolioName] = useState('Portfolio Name');
  
  // UI state
  const [currentView, setCurrentView] = useState('cards'); // 'cards', 'bulk', 'import'
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
    qtrCapacityFactor_q1: '',
    qtrCapacityFactor_q2: '',
    qtrCapacityFactor_q3: '',
    qtrCapacityFactor_q4: '',
    volume: '',
    contracts: []
  });

  // Helper function to safely get string values
  const safeValue = (value) => {
    if (value === null || value === undefined) return '';
    return String(value);
  };

  // Load portfolio data when user or portfolio changes
  useEffect(() => {
    if (currentUser && currentPortfolio) {
      loadPortfolioData();
    }
  }, [currentUser, currentPortfolio]);

  // Check for changes when local state updates
  useEffect(() => {
    const assetsChanged = JSON.stringify(assets) !== JSON.stringify(originalAssets);
    const constantsChanged = JSON.stringify(constants) !== JSON.stringify(originalConstants);
    const nameChanged = portfolioName !== originalPortfolioName;
    
    setHasUnsavedChanges(assetsChanged || constantsChanged || nameChanged);
  }, [assets, constants, portfolioName, originalAssets, originalConstants, originalPortfolioName]);

  const loadPortfolioData = async () => {
    if (!currentUser || !currentPortfolio) return;
    
    setLoading(true);
    try {
      console.log(`Loading portfolio: userId=${currentUser.id}, portfolioId=${currentPortfolio.portfolioId}`);
      
      const response = await fetch(`/api/portfolio?userId=${currentUser.id}&portfolioId=${currentPortfolio.portfolioId}`);
      
      if (response.ok) {
        const portfolioData = await response.json();
        console.log('Portfolio data loaded:', {
          assetsCount: Object.keys(portfolioData.assets || {}).length,
          portfolioName: portfolioData.portfolioName,
          version: portfolioData.version
        });
        
        // Set original data
        setOriginalAssets(portfolioData.assets || {});
        setOriginalConstants(portfolioData.constants || {});
        setOriginalPortfolioName(portfolioData.portfolioName || 'Portfolio Name');
        
        // Set working data (copies)
        setAssets(JSON.parse(JSON.stringify(portfolioData.assets || {})));
        setConstants(JSON.parse(JSON.stringify(portfolioData.constants || {})));
        setPortfolioName(portfolioData.portfolioName || 'Portfolio Name');
        
        // Reset unsaved changes flag
        setHasUnsavedChanges(false);
        
      } else if (response.status === 404) {
        console.log('Portfolio not found, starting fresh');
        const emptyState = {};
        setOriginalAssets(emptyState);
        setOriginalConstants(emptyState);
        setOriginalPortfolioName('Portfolio Name');
        setAssets(emptyState);
        setConstants(emptyState);
        setPortfolioName('Portfolio Name');
        setHasUnsavedChanges(false);
      } else {
        console.error('Failed to load portfolio, status:', response.status);
      }
    } catch (error) {
      console.error('Error loading portfolio:', error);
      const emptyState = {};
      setOriginalAssets(emptyState);
      setOriginalConstants(emptyState);
      setOriginalPortfolioName('Portfolio Name');
      setAssets(emptyState);
      setConstants(emptyState);
      setPortfolioName('Portfolio Name');
      setHasUnsavedChanges(false);
    } finally {
      setLoading(false);
    }
  };

  const savePortfolioData = async () => {
    if (!currentUser || !currentPortfolio) return false;
    
    setSaving(true);
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

      console.log('Saving portfolio:', {
        userId: portfolioData.userId,
        portfolioId: portfolioData.portfolioId,
        assetsCount: Object.keys(portfolioData.assets || {}).length,
        portfolioName: portfolioData.portfolioName
      });

      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(portfolioData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Portfolio saved successfully:', result);
        
        // Update original data to match current state
        setOriginalAssets(JSON.parse(JSON.stringify(assets)));
        setOriginalConstants(JSON.parse(JSON.stringify(constants)));
        setOriginalPortfolioName(portfolioName);
        setHasUnsavedChanges(false);
        
        return true;
      } else {
        const errorData = await response.json();
        console.error('Failed to save portfolio:', errorData);
        alert('Failed to save portfolio: ' + (errorData.error || 'Unknown error'));
        return false;
      }
    } catch (error) {
      console.error('Error saving portfolio:', error);
      alert('Error saving portfolio: ' + error.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const revertChanges = () => {
    if (window.confirm('Are you sure you want to revert all unsaved changes?')) {
      setAssets(JSON.parse(JSON.stringify(originalAssets)));
      setConstants(JSON.parse(JSON.stringify(originalConstants)));
      setPortfolioName(originalPortfolioName);
      setHasUnsavedChanges(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let assetId;
      let updatedAssets;

      if (editingAsset) {
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

      // Update local state
      setAssets(updatedAssets);
      
      // Update constants if needed
      if (!constants.assetCosts) {
        setConstants(prev => ({ ...prev, assetCosts: {} }));
      }
      
      if (!constants.assetCosts || !constants.assetCosts[formData.name]) {
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
    } catch (error) {
      console.error('Error saving asset:', error);
      alert('Error saving asset: ' + error.message);
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
  };

  const handleEdit = (asset) => {
    // Ensure all values are strings and handle null/undefined
    const cleanedAsset = {
      name: safeValue(asset.name),
      state: safeValue(asset.state) || 'NSW',
      type: safeValue(asset.type) || 'solar',
      capacity: safeValue(asset.capacity),
      assetLife: asset.assetLife || 25,
      volumeLossAdjustment: asset.volumeLossAdjustment || 95,
      annualDegradation: asset.annualDegradation || 0.5,
      constructionStartDate: safeValue(asset.constructionStartDate),
      constructionDuration: asset.constructionDuration || 18,
      assetStartDate: safeValue(asset.assetStartDate),
      qtrCapacityFactor_q1: safeValue(asset.qtrCapacityFactor_q1),
      qtrCapacityFactor_q2: safeValue(asset.qtrCapacityFactor_q2),
      qtrCapacityFactor_q3: safeValue(asset.qtrCapacityFactor_q3),
      qtrCapacityFactor_q4: safeValue(asset.qtrCapacityFactor_q4),
      volume: safeValue(asset.volume),
      contracts: asset.contracts ? asset.contracts.map(contract => ({
        id: safeValue(contract.id) || Date.now().toString(),
        counterparty: safeValue(contract.counterparty),
        type: safeValue(contract.type) || 'bundled',
        buyersPercentage: contract.buyersPercentage || 100,
        strikePrice: safeValue(contract.strikePrice),
        indexation: contract.indexation || 2.5,
        indexationReferenceYear: contract.indexationReferenceYear || new Date().getFullYear(),
        startDate: safeValue(contract.startDate),
        endDate: safeValue(contract.endDate),
        hasFloor: contract.hasFloor || false,
        floorValue: safeValue(contract.floorValue),
        EnergyPrice: safeValue(contract.EnergyPrice),
        greenPrice: safeValue(contract.greenPrice)
      })) : []
    };
    
    setFormData(cleanedAsset);
    setEditingAsset(asset);
    setShowForm(true);
  };

  const handleDelete = async (assetId) => {
    if (window.confirm('Are you sure you want to delete this asset?')) {
      const updatedAssets = { ...assets };
      delete updatedAssets[assetId];
      setAssets(updatedAssets);
      
      if (constants.assetCosts && assets[assetId]) {
        const updatedConstants = { ...constants };
        if (updatedConstants.assetCosts) {
          delete updatedConstants.assetCosts[assets[assetId].name];
          setConstants(updatedConstants);
        }
      }
    }
  };

  const handleDuplicate = (asset) => {
    const newAsset = {
      name: `${safeValue(asset.name)} (Copy)`,
      state: safeValue(asset.state) || 'NSW',
      type: safeValue(asset.type) || 'solar',
      capacity: safeValue(asset.capacity),
      assetLife: asset.assetLife || 25,
      volumeLossAdjustment: asset.volumeLossAdjustment || 95,
      annualDegradation: asset.annualDegradation || 0.5,
      constructionStartDate: safeValue(asset.constructionStartDate),
      constructionDuration: asset.constructionDuration || 18,
      assetStartDate: safeValue(asset.assetStartDate),
      qtrCapacityFactor_q1: safeValue(asset.qtrCapacityFactor_q1),
      qtrCapacityFactor_q2: safeValue(asset.qtrCapacityFactor_q2),
      qtrCapacityFactor_q3: safeValue(asset.qtrCapacityFactor_q3),
      qtrCapacityFactor_q4: safeValue(asset.qtrCapacityFactor_q4),
      volume: safeValue(asset.volume),
      contracts: asset.contracts ? asset.contracts.map(contract => ({
        id: Date.now().toString() + Math.random(),
        counterparty: safeValue(contract.counterparty),
        type: safeValue(contract.type) || 'bundled',
        buyersPercentage: contract.buyersPercentage || 100,
        strikePrice: safeValue(contract.strikePrice),
        indexation: contract.indexation || 2.5,
        indexationReferenceYear: contract.indexationReferenceYear || new Date().getFullYear(),
        startDate: safeValue(contract.startDate),
        endDate: safeValue(contract.endDate),
        hasFloor: contract.hasFloor || false,
        floorValue: safeValue(contract.floorValue),
        EnergyPrice: safeValue(contract.EnergyPrice),
        greenPrice: safeValue(contract.greenPrice)
      })) : []
    };
    setFormData(newAsset);
    setEditingAsset(null);
    setShowForm(true);
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
      {/* Header with Save/Revert Controls */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-4 mb-2">
            <input
              type="text"
              value={portfolioName}
              onChange={(e) => setPortfolioName(e.target.value)}
              className="text-2xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-2"
            />
            {hasUnsavedChanges && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                <AlertCircle className="w-3 h-3 mr-1" />
                Unsaved Changes
              </span>
            )}
          </div>
          <p className="text-gray-600">
            {Object.keys(assets).length} assets • {calculateTotalCapacity().toFixed(1)} MW • 
            ${calculateTotalValue().toFixed(1)}M CAPEX
          </p>
          <p className="text-sm text-gray-500">
            User: {currentUser.name} • Portfolio: {currentPortfolio.portfolioId}
          </p>
        </div>
        <div className="flex space-x-3">
          {hasUnsavedChanges && (
            <button
              onClick={revertChanges}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-gray-200"
            >
              <X className="w-4 h-4" />
              <span>Revert</span>
            </button>
          )}
          <button
            onClick={savePortfolioData}
            disabled={saving || !hasUnsavedChanges}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
              hasUnsavedChanges 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
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

      {/* View Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'cards', label: 'Asset Cards', icon: Grid3X3 },
            { id: 'bulk', label: 'Bulk Edit', icon: Table },
            { id: 'import', label: 'Import/Export', icon: Download }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id)}
                className={`py-4 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  currentView === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content - Conditional View */}
      {currentView === 'cards' && (
        <AssetCards
          assets={assets}
          constants={constants}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onAddNew={() => setShowForm(true)}
        />
      )}

      {currentView === 'bulk' && (
        <BulkEdit
          assets={assets}
          setAssets={setAssets}
          constants={constants}
          setConstants={setConstants}
          setHasUnsavedChanges={setHasUnsavedChanges}
        />
      )}

      {currentView === 'import' && (
        <ImportExport
          assets={assets}
          setAssets={setAssets}
          constants={constants}
          setConstants={setConstants}
          portfolioName={portfolioName}
          setPortfolioName={setPortfolioName}
          setHasUnsavedChanges={setHasUnsavedChanges}
        />
      )}

      {/* Asset Form Component */}
      <AssetForm
        showForm={showForm}
        editingAsset={editingAsset}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        onCancel={resetForm}
        getDefaultAssetCosts={getDefaultAssetCosts}
      />

      {/* Status Information */}
      <div className={`border rounded-lg p-4 ${
        hasUnsavedChanges 
          ? 'bg-orange-50 border-orange-200' 
          : 'bg-green-50 border-green-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {hasUnsavedChanges ? (
              <AlertCircle className="w-5 h-5 text-orange-500" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            <span className={`font-medium ${
              hasUnsavedChanges ? 'text-orange-800' : 'text-green-800'
            }`}>
              {hasUnsavedChanges 
                ? 'You have unsaved changes - remember to save your work'
                : 'All changes saved to database'
              }
            </span>
          </div>
          <div className={`text-sm ${
            hasUnsavedChanges ? 'text-orange-600' : 'text-green-600'
          }`}>
            Current View: {currentView === 'cards' ? 'Asset Cards' : currentView === 'bulk' ? 'Bulk Edit' : 'Import/Export'}
          </div>
        </div>
        {hasUnsavedChanges && (
          <div className="mt-2 text-sm text-orange-700">
            Changes are kept locally until you save. Use the "Save Changes" button to persist your updates to the database.
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedAssetManagement;