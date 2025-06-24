'use client'

import { useState } from 'react';
import { 
  Save, 
  Check,
  X,
  Sun,
  Wind,
  Battery,
  Zap,
  Plus,
  Trash2
} from 'lucide-react';

const BulkEdit = ({ 
  assets, 
  setAssets, 
  constants, 
  setConstants,
  setHasUnsavedChanges
}) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Safe helper to get string values
  const safeValue = (value) => {
    if (value === null || value === undefined) return '';
    return String(value);
  };

  // Auto-calculate operations start date
  const calculateOperationsStart = (constructionStart, duration) => {
    if (!constructionStart || !duration) return '';
    
    const startDate = new Date(constructionStart);
    startDate.setMonth(startDate.getMonth() + parseInt(duration));
    
    // Round to nearest month start (1st of month)
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const operationsStart = new Date(year, month, 1);
    
    return operationsStart.toISOString().split('T')[0];
  };

  // Get asset icon
  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-4 h-4 text-yellow-500" />;
      case 'wind': return <Wind className="w-4 h-4 text-blue-500" />;
      case 'storage': return <Battery className="w-4 h-4 text-green-500" />;
      default: return <Zap className="w-4 h-4 text-gray-500" />;
    }
  };

  // Handle cell edit start
  const startEdit = (assetId, field, currentValue) => {
    setEditingCell({ assetId, field });
    setEditValue(safeValue(currentValue));
  };

  // Handle cell edit save
  const saveEdit = () => {
    if (!editingCell) return;
    
    const { assetId, field } = editingCell;
    
    setAssets(prev => {
      const updatedAssets = {
        ...prev,
        [assetId]: {
          ...prev[assetId],
          [field]: editValue,
          lastUpdated: new Date().toISOString()
        }
      };

      // Auto-calculate operations start if construction fields change
      if (field === 'constructionStartDate' || field === 'constructionDuration') {
        const asset = updatedAssets[assetId];
        const constructionStart = field === 'constructionStartDate' ? editValue : asset.constructionStartDate;
        const duration = field === 'constructionDuration' ? editValue : asset.constructionDuration;
        
        if (constructionStart && duration) {
          updatedAssets[assetId].assetStartDate = calculateOperationsStart(constructionStart, duration);
        }
      }

      return updatedAssets;
    });
    
    setHasUnsavedChanges(true);
    setEditingCell(null);
    setEditValue('');
  };

  // Handle cell edit cancel
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Handle contract edit
  const updateContract = (assetId, contractIndex, field, value) => {
    setAssets(prev => {
      const asset = prev[assetId];
      const updatedContracts = [...(asset.contracts || [])];
      
      if (!updatedContracts[contractIndex]) {
        updatedContracts[contractIndex] = {};
      }
      
      updatedContracts[contractIndex] = {
        ...updatedContracts[contractIndex],
        [field]: value
      };
      
      return {
        ...prev,
        [assetId]: {
          ...asset,
          contracts: updatedContracts,
          lastUpdated: new Date().toISOString()
        }
      };
    });
    
    setHasUnsavedChanges(true);
  };

  // Add contract to asset
  const addContract = (assetId) => {
    setAssets(prev => {
      const asset = prev[assetId];
      const newContract = {
        id: Date.now().toString(),
        counterparty: '',
        type: asset.type === 'storage' ? 'tolling' : 'bundled',
        buyersPercentage: 100,
        strikePrice: '',
        indexation: 2.5,
        indexationReferenceYear: new Date().getFullYear(),
        startDate: asset.assetStartDate || '',
        endDate: '',
        hasFloor: false,
        floorValue: ''
      };
      
      return {
        ...prev,
        [assetId]: {
          ...asset,
          contracts: [...(asset.contracts || []), newContract],
          lastUpdated: new Date().toISOString()
        }
      };
    });
    
    setHasUnsavedChanges(true);
  };

  // Remove contract from asset
  const removeContract = (assetId, contractIndex) => {
    setAssets(prev => {
      const asset = prev[assetId];
      const updatedContracts = (asset.contracts || []).filter((_, index) => index !== contractIndex);
      
      return {
        ...prev,
        [assetId]: {
          ...asset,
          contracts: updatedContracts,
          lastUpdated: new Date().toISOString()
        }
      };
    });
    
    setHasUnsavedChanges(true);
  };

  // Update asset costs
  const updateAssetCost = (assetName, field, value) => {
    setConstants(prev => ({
      ...prev,
      assetCosts: {
        ...prev.assetCosts,
        [assetName]: {
          ...prev.assetCosts?.[assetName],
          [field]: parseFloat(value) || 0
        }
      }
    }));
    
    setHasUnsavedChanges(true);
  };

  // Render editable cell
  const renderEditableCell = (assetId, field, value, type = 'text') => {
    const isEditing = editingCell?.assetId === assetId && editingCell?.field === field;
    
    if (isEditing) {
      return (
        <div className="flex items-center space-x-1">
          <input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="w-full px-1 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button onClick={saveEdit} className="text-green-600 hover:text-green-800">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={cancelEdit} className="text-red-600 hover:text-red-800">
            <X className="w-3 h-3" />
          </button>
        </div>
      );
    }
    
    return (
      <div 
        className="cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded text-xs"
        onClick={() => startEdit(assetId, field, value)}
        title="Click to edit"
      >
        {safeValue(value) || '-'}
      </div>
    );
  };

  // Field definitions
  const basicFields = [
    { key: 'name', label: 'Asset Name', type: 'text' },
    { key: 'state', label: 'State', type: 'select', options: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS'] },
    { key: 'type', label: 'Type', type: 'select', options: ['solar', 'wind', 'storage'] },
    { key: 'capacity', label: 'Capacity (MW)', type: 'number' },
    { key: 'volume', label: 'Storage (MWh)', type: 'number' },
    { key: 'assetLife', label: 'Asset Life (years)', type: 'number' }
  ];

  const performanceFields = [
    { key: 'volumeLossAdjustment', label: 'Volume Loss Adj. (%)', type: 'number' },
    { key: 'annualDegradation', label: 'Annual Degradation (%)', type: 'number' },
    { key: 'qtrCapacityFactor_q1', label: 'Q1 Capacity Factor (%)', type: 'number' },
    { key: 'qtrCapacityFactor_q2', label: 'Q2 Capacity Factor (%)', type: 'number' },
    { key: 'qtrCapacityFactor_q3', label: 'Q3 Capacity Factor (%)', type: 'number' },
    { key: 'qtrCapacityFactor_q4', label: 'Q4 Capacity Factor (%)', type: 'number' }
  ];

  const timelineFields = [
    { key: 'constructionStartDate', label: 'Construction Start', type: 'date' },
    { key: 'constructionDuration', label: 'Construction Duration (months)', type: 'number' },
    { key: 'assetStartDate', label: 'Operations Start (Auto-calc)', type: 'date', readonly: true }
  ];

  const costFields = [
    { key: 'capex', label: 'CAPEX ($M)', type: 'number' },
    { key: 'operatingCosts', label: 'Annual OPEX ($M)', type: 'number' },
    { key: 'operatingCostEscalation', label: 'OPEX Escalation (%)', type: 'number' },
    { key: 'terminalValue', label: 'Terminal Value ($M)', type: 'number' },
    { key: 'maxGearing', label: 'Max Gearing (%)', type: 'number' },
    { key: 'targetDSCRContract', label: 'Target DSCR (Contract)', type: 'number' },
    { key: 'targetDSCRMerchant', label: 'Target DSCR (Merchant)', type: 'number' },
    { key: 'interestRate', label: 'Interest Rate (%)', type: 'number' },
    { key: 'tenorYears', label: 'Loan Tenor (years)', type: 'number' }
  ];

  const assetArray = Object.values(assets);

  if (assetArray.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border p-8">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Assets to Edit</h3>
          <p className="text-gray-600">Add assets to your portfolio first to use bulk editing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'basic', label: 'Basic Details' },
            { id: 'performance', label: 'Performance' },
            { id: 'timeline', label: 'Timeline' },
            { id: 'contracts', label: 'Contracts' },
            { id: 'costs', label: 'Costs' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Basic Details Tab */}
      {activeTab === 'basic' && (
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Asset</th>
                  {basicFields.map(field => (
                    <th key={field.key} className="px-3 py-2 text-left font-medium min-w-[120px]">
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assetArray.map(asset => (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-2">
                        {getAssetIcon(asset.type)}
                        <span className="font-medium">{asset.name}</span>
                      </div>
                    </td>
                    {basicFields.map(field => (
                      <td key={field.key} className="px-3 py-2">
                        {field.type === 'select' ? (
                          <select
                            value={safeValue(asset[field.key])}
                            onChange={(e) => {
                              setAssets(prev => ({
                                ...prev,
                                [asset.id]: {
                                  ...prev[asset.id],
                                  [field.key]: e.target.value,
                                  lastUpdated: new Date().toISOString()
                                }
                              }));
                              setHasUnsavedChanges(true);
                            }}
                            className="w-full text-xs border border-gray-300 rounded px-1 py-0.5"
                          >
                            {field.options.map(option => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        ) : (
                          // Skip volume field for non-storage assets
                          field.key === 'volume' && asset.type !== 'storage' ? (
                            <span className="text-gray-400">N/A</span>
                          ) : (
                            renderEditableCell(asset.id, field.key, asset[field.key], field.type)
                          )
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Asset</th>
                  {performanceFields.map(field => (
                    <th key={field.key} className="px-3 py-2 text-left font-medium min-w-[120px]">
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assetArray.map(asset => (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-2">
                        {getAssetIcon(asset.type)}
                        <span className="font-medium">{asset.name}</span>
                      </div>
                    </td>
                    {performanceFields.map(field => (
                      <td key={field.key} className="px-3 py-2">
                        {/* Skip capacity factor fields for storage assets */}
                        {field.key.includes('qtrCapacityFactor') && asset.type === 'storage' ? (
                          <span className="text-gray-400">N/A</span>
                        ) : (
                          renderEditableCell(asset.id, field.key, asset[field.key], field.type)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Asset</th>
                  {timelineFields.map(field => (
                    <th key={field.key} className="px-3 py-2 text-left font-medium min-w-[140px]">
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assetArray.map(asset => (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-2">
                        {getAssetIcon(asset.type)}
                        <span className="font-medium">{asset.name}</span>
                      </div>
                    </td>
                    {timelineFields.map(field => (
                      <td key={field.key} className="px-3 py-2">
                        {field.readonly ? (
                          <div className="px-1 py-0.5 text-xs bg-gray-100 rounded">
                            {safeValue(asset[field.key]) || 'Auto-calculated'}
                          </div>
                        ) : (
                          renderEditableCell(asset.id, field.key, asset[field.key], field.type)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contracts Tab */}
      {activeTab === 'contracts' && (
        <div className="space-y-4">
          {assetArray.map(asset => (
            <div key={asset.id} className="bg-white rounded-lg shadow border">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getAssetIcon(asset.type)}
                    <h3 className="font-semibold text-gray-900">{asset.name}</h3>
                    <span className="text-sm text-gray-500">
                      {asset.contracts?.length || 0} contracts
                    </span>
                  </div>
                  <button
                    onClick={() => addContract(asset.id)}
                    className="flex items-center space-x-1 text-sm text-green-600 hover:text-green-800"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Contract</span>
                  </button>
                </div>
              </div>
              
              {asset.contracts && asset.contracts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Counterparty</th>
                        <th className="px-3 py-2 text-left font-medium">Type</th>
                        <th className="px-3 py-2 text-left font-medium">
                          Strike Price ({asset.type === 'storage' ? '$/MW/hr' : '$/MWh'})
                        </th>
                        <th className="px-3 py-2 text-left font-medium">Coverage (%)</th>
                        <th className="px-3 py-2 text-left font-medium">Start Date</th>
                        <th className="px-3 py-2 text-left font-medium">End Date</th>
                        <th className="px-3 py-2 text-left font-medium">Indexation (%)</th>
                        <th className="px-3 py-2 text-left font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {asset.contracts.map((contract, contractIndex) => (
                        <tr key={contractIndex} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={safeValue(contract.counterparty)}
                              onChange={(e) => updateContract(asset.id, contractIndex, 'counterparty', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-1 py-0.5"
                              placeholder="Counterparty"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={safeValue(contract.type)}
                              onChange={(e) => updateContract(asset.id, contractIndex, 'type', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-1 py-0.5"
                            >
                              {asset.type === 'storage' ? (
                                <>
                                  <option value="tolling">Tolling</option>
                                  <option value="cfd">CFD</option>
                                  <option value="fixed">Fixed</option>
                                </>
                              ) : (
                                <>
                                  <option value="bundled">Bundled</option>
                                  <option value="green">Green</option>
                                  <option value="Energy">Energy</option>
                                  <option value="fixed">Fixed</option>
                                </>
                              )}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={safeValue(contract.strikePrice)}
                              onChange={(e) => updateContract(asset.id, contractIndex, 'strikePrice', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-1 py-0.5"
                              placeholder="Price"
                              step="0.01"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={safeValue(contract.buyersPercentage)}
                              onChange={(e) => updateContract(asset.id, contractIndex, 'buyersPercentage', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-1 py-0.5"
                              min="0"
                              max="100"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={safeValue(contract.startDate)}
                              onChange={(e) => updateContract(asset.id, contractIndex, 'startDate', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={safeValue(contract.endDate)}
                              onChange={(e) => updateContract(asset.id, contractIndex, 'endDate', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={safeValue(contract.indexation)}
                              onChange={(e) => updateContract(asset.id, contractIndex, 'indexation', e.target.value)}
                              className="w-full text-xs border border-gray-300 rounded px-1 py-0.5"
                              step="0.1"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => removeContract(asset.id, contractIndex)}
                              className="text-red-600 hover:text-red-800"
                              title="Remove contract"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <p>No contracts defined for this asset</p>
                  <p className="text-xs">Click "Add Contract" to create one</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Costs Tab */}
      {activeTab === 'costs' && (
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Asset</th>
                  {costFields.map(field => (
                    <th key={field.key} className="px-3 py-2 text-left font-medium min-w-[120px]">
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assetArray.map(asset => {
                  const assetCosts = constants.assetCosts?.[asset.name] || {};
                  return (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="flex items-center space-x-2">
                          {getAssetIcon(asset.type)}
                          <span className="font-medium">{asset.name}</span>
                        </div>
                      </td>
                      {costFields.map(field => (
                        <td key={field.key} className="px-3 py-2">
                          <input
                            type={field.type}
                            value={safeValue(assetCosts[field.key])}
                            onChange={(e) => updateAssetCost(asset.name, field.key, e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded px-1 py-0.5"
                            step={field.type === 'number' ? '0.1' : undefined}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkEdit;