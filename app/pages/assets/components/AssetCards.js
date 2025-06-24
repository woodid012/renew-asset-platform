'use client'

import { useState } from 'react';
import { 
  Edit, 
  Trash2, 
  Copy,
  Sun,
  Wind,
  Battery,
  Zap,
  Plus
} from 'lucide-react';

const AssetCards = ({ 
  assets, 
  constants,
  onEdit, 
  onDelete, 
  onDuplicate,
  onAddNew
}) => {
  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-5 h-5 text-yellow-500" />;
      case 'wind': return <Wind className="w-5 h-5 text-blue-500" />;
      case 'storage': return <Battery className="w-5 h-5 text-green-500" />;
      default: return <Zap className="w-5 h-5 text-gray-500" />;
    }
  };

  const calculateTotalCapacity = () => {
    return Object.values(assets).reduce((sum, asset) => sum + (parseFloat(asset.capacity) || 0), 0);
  };

  const calculateTotalValue = () => {
    return Object.values(constants.assetCosts || {}).reduce((sum, costs) => sum + (costs.capex || 0), 0);
  };

  if (Object.keys(assets).length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <Zap className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No assets defined yet</h3>
        <p className="text-gray-600 mb-4">
          Start building your renewable energy portfolio by adding your first asset
        </p>
        <button
          onClick={onAddNew}
          className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center space-x-2 mx-auto hover:bg-green-700"
        >
          <Plus className="w-5 h-5" />
          <span>Add Your First Asset</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
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

      {/* Asset Cards Grid */}
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
                    onClick={() => onDuplicate(asset)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="Duplicate Asset"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEdit(asset)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(asset.id)}
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
                        <span>
                          ${asset.contracts[0].strikePrice}
                          {asset.type === 'storage' ? '/MW/hr' : '/MWh'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssetCards;