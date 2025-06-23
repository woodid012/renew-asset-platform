'use client'

import { useState, useEffect } from 'react';
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
  Calendar
} from 'lucide-react';

const AssetDefinition = () => {
  const [assets, setAssets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'solar',
    capacity: '',
    location: '',
    
    // Contract Details
    contractType: 'ppa',
    contractDuration: '',
    ppaPrice: '',
    escalation: '',
    
    // CAPEX
    totalCapex: '',
    capexPerMW: '',
    developmentCosts: '',
    constructionCosts: '',
    
    // Finance Assumptions
    debtRatio: '',
    equityRatio: '',
    debtRate: '',
    equityReturn: '',
    projectLife: '',
    
    // Operations
    operatingCosts: '',
    maintenanceCosts: '',
    degradation: '',
    availabilityFactor: '',
    
    status: 'planning'
  });

  // Mock data - replace with API call
  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      // TODO: Get these from user context/auth
      const userId = '6853b044dd2ecce8ba519ba5'; // Your user ID
      const portfolioId = 'zebre'; // Your portfolio ID
      
      const response = await fetch(`/api/assets?userId=${userId}&portfolioId=${portfolioId}`);
      if (response.ok) {
        const assetsData = await response.json();
        setAssets(assetsData);
      } else {
        console.error('Failed to fetch assets');
        // Fall back to mock data if API fails
        setAssets([
          {
            id: 1,
            name: 'Solar Farm Alpha',
            type: 'solar',
            capacity: 100,
            location: 'Queensland',
            contractType: 'ppa',
            contractDuration: 20,
            ppaPrice: 45,
            totalCapex: 120,
            status: 'operational'
          },
          {
            id: 2,
            name: 'Wind Farm Beta',
            type: 'wind',
            capacity: 120,
            location: 'South Australia',
            contractType: 'merchant',
            totalCapex: 180,
            status: 'construction'
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // TODO: Get these from user context/auth
      const userId = '6853b044dd2ecce8ba519ba5';
      const portfolioId = 'zebre';
      
      const assetData = {
        ...formData,
        userId,
        portfolioId
      };
      
      if (editingAsset) {
        // Update existing asset
        const response = await fetch(`/api/assets?id=${editingAsset.id}&userId=${userId}&portfolioId=${portfolioId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
        
        if (response.ok) {
          const updatedAsset = await response.json();
          setAssets(prev => prev.map(asset => 
            asset.id === editingAsset.id ? updatedAsset : asset
          ));
        } else {
          console.error('Failed to update asset');
        }
      } else {
        // Create new asset
        const response = await fetch('/api/assets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(assetData),
        });
        
        if (response.ok) {
          const newAsset = await response.json();
          setAssets(prev => [...prev, newAsset]);
        } else {
          console.error('Failed to create asset');
        }
      }
      
      resetForm();
    } catch (error) {
      console.error('Error saving asset:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', type: 'solar', capacity: '', location: '',
      contractType: 'ppa', contractDuration: '', ppaPrice: '', escalation: '',
      totalCapex: '', capexPerMW: '', developmentCosts: '', constructionCosts: '',
      debtRatio: '', equityRatio: '', debtRate: '', equityReturn: '', projectLife: '',
      operatingCosts: '', maintenanceCosts: '', degradation: '', availabilityFactor: '',
      status: 'planning'
    });
    setShowForm(false);
    setEditingAsset(null);
  };

  const handleEdit = (asset) => {
    setFormData(asset);
    setEditingAsset(asset);
    setShowForm(true);
  };

  const handleDelete = async (assetId) => {
    if (window.confirm('Are you sure you want to delete this asset?')) {
      try {
        // TODO: Get these from user context/auth
        const userId = '6853b044dd2ecce8ba519ba5';
        const portfolioId = 'zebre';
        
        const response = await fetch(`/api/assets?id=${assetId}&userId=${userId}&portfolioId=${portfolioId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          setAssets(prev => prev.filter(asset => asset.id !== assetId));
        } else {
          console.error('Failed to delete asset');
        }
      } catch (error) {
        console.error('Error deleting asset:', error);
      }
    }
  };

  const getAssetIcon = (type) => {
    switch (type) {
      case 'solar': return <Sun className="w-5 h-5 text-yellow-500" />;
      case 'wind': return <Wind className="w-5 h-5 text-blue-500" />;
      case 'battery': return <Battery className="w-5 h-5 text-green-500" />;
      default: return <Zap className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Definition</h1>
          <p className="text-gray-600">Define contracts, CAPEX, and finance assumptions</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-green-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Asset</span>
        </button>
      </div>

      {/* Asset List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {assets.map((asset) => (
          <div key={asset.id} className="bg-white rounded-lg shadow border hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getAssetIcon(asset.type)}
                  <div>
                    <h3 className="font-semibold text-gray-900">{asset.name}</h3>
                    <p className="text-sm text-gray-500">{asset.location}</p>
                  </div>
                </div>
                <div className="flex space-x-1">
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
                <div className="flex justify-between">
                  <span className="text-gray-600">Contract:</span>
                  <span className="font-medium capitalize">{asset.contractType}</span>
                </div>
                {asset.ppaPrice && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">PPA Price:</span>
                    <span className="font-medium">${asset.ppaPrice}/MWh</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">CAPEX:</span>
                  <span className="font-medium">${asset.totalCapex}M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    asset.status === 'operational' ? 'bg-green-100 text-green-800' :
                    asset.status === 'construction' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {asset.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Asset Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
            <form onSubmit={handleSubmit}>
              {/* Form Header */}
              <div className="flex justify-between items-center p-6 border-b">
                <h2 className="text-xl font-semibold">
                  {editingAsset ? 'Edit Asset' : 'Add New Asset'}
                </h2>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-8">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Asset Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Asset Type
                      </label>
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="solar">Solar</option>
                        <option value="wind">Wind</option>
                        <option value="battery">Battery Storage</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Capacity (MW)
                      </label>
                      <input
                        type="number"
                        name="capacity"
                        value={formData.capacity}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        step="0.1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Contract Details */}
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Contract Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contract Type
                      </label>
                      <select
                        name="contractType"
                        value={formData.contractType}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="ppa">Power Purchase Agreement</option>
                        <option value="merchant">Merchant</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contract Duration (years)
                      </label>
                      <input
                        type="number"
                        name="contractDuration"
                        value={formData.contractDuration}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        PPA Price ($/MWh)
                      </label>
                      <input
                        type="number"
                        name="ppaPrice"
                        value={formData.ppaPrice}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Escalation (%/year)
                      </label>
                      <input
                        type="number"
                        name="escalation"
                        value={formData.escalation}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        step="0.1"
                      />
                    </div>
                  </div>
                </div>

                {/* CAPEX */}
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2" />
                    CAPEX
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total CAPEX ($M)
                      </label>
                      <input
                        type="number"
                        name="totalCapex"
                        value={formData.totalCapex}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        step="0.1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CAPEX per MW ($M/MW)
                      </label>
                      <input
                        type="number"
                        name="capexPerMW"
                        value={formData.capexPerMW}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Development Costs ($M)
                      </label>
                      <input
                        type="number"
                        name="developmentCosts"
                        value={formData.developmentCosts}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Construction Costs ($M)
                      </label>
                      <input
                        type="number"
                        name="constructionCosts"
                        value={formData.constructionCosts}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        step="0.1"
                      />
                    </div>
                  </div>
                </div>

                {/* Finance Assumptions */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Finance Assumptions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Debt Ratio (%)
                      </label>
                      <input
                        type="number"
                        name="debtRatio"
                        value={formData.debtRatio}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Equity Ratio (%)
                      </label>
                      <input
                        type="number"
                        name="equityRatio"
                        value={formData.equityRatio}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Debt Rate (%)
                      </label>
                      <input
                        type="number"
                        name="debtRate"
                        value={formData.debtRate}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Equity Return (%)
                      </label>
                      <input
                        type="number"
                        name="equityReturn"
                        value={formData.equityReturn}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        step="0.1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Project Life (years)
                      </label>
                      <input
                        type="number"
                        name="projectLife"
                        value={formData.projectLife}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 p-6 border-t">
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
                  <span>{editingAsset ? 'Update' : 'Save'} Asset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetDefinition;