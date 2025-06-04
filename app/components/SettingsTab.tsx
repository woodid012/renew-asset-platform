'use client';

import { useState, useEffect } from 'react';

interface SettingsData {
  contractTypes: {
    retail: string[];
    wholesale: string[];
    offtake: string[];
  };
  volumeShapes: {
    [key: string]: number[];
  };
  states: string[];
  indexationTypes: string[];
  unitTypes: string[];
}

interface SettingsTabProps {
  settings: SettingsData;
  updateSettings: (newSettings: SettingsData) => void;
}

const defaultSettings: SettingsData = {
  contractTypes: {
    retail: [
      'Retail Customer',
      'Industrial Customer',
      'Government Customer',
      'Small Business',
      'Residential'
    ],
    wholesale: [
      'Swap',
      'Cap',
      'Floor',
      'Forward',
      'Option'
    ],
    offtake: [
      'Solar Farm',
      'Wind Farm',
      'Battery Storage',
      'Hydro',
      'Gas Peaker'
    ]
  },
  volumeShapes: {
    flat: [8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33, 8.33],
    solar: [6.5, 7.2, 8.8, 9.5, 10.2, 8.9, 9.1, 9.8, 8.6, 7.4, 6.8, 7.2],
    wind: [11.2, 10.8, 9.2, 7.8, 6.5, 5.9, 6.2, 7.1, 8.4, 9.6, 10.8, 11.5],
    custom: [5.0, 6.0, 7.5, 9.0, 11.0, 12.5, 13.0, 12.0, 10.5, 8.5, 7.0, 6.0]
  },
  states: ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'],
  indexationTypes: [
    'Fixed',
    'CPI',
    'CPI + 1%',
    'CPI + 0.5%',
    'CPI + 2%',
    'Escalation 2%',
    'Escalation 3%'
  ],
  unitTypes: ['Energy', 'Green']
};

export default function SettingsTab({
  settings = defaultSettings,
  updateSettings,
}: SettingsTabProps) {
  const [localSettings, setLocalSettings] = useState<SettingsData>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeSection, setActiveSection] = useState('contract-types');
  const [newCategory, setNewCategory] = useState('');
  const [selectedContractType, setSelectedContractType] = useState<'retail' | 'wholesale' | 'offtake'>('retail');
  const [newVolumeShape, setNewVolumeShape] = useState('');
  const [newVolumeShapeData, setNewVolumeShapeData] = useState<number[]>(Array(12).fill(8.33));
  const [newItem, setNewItem] = useState('');

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const contractTypeLabels = {
    retail: 'Retail',
    wholesale: 'Wholesale',
    offtake: 'Offtake'
  };

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    setHasChanges(JSON.stringify(localSettings) !== JSON.stringify(settings));
  }, [localSettings, settings]);

  const handleSaveSettings = () => {
    updateSettings(localSettings);
    setHasChanges(false);
  };

  const handleResetSettings = () => {
    setLocalSettings(settings);
    setHasChanges(false);
  };

  const addCategory = () => {
    if (newCategory.trim() && !localSettings.contractTypes[selectedContractType].includes(newCategory.trim())) {
      setLocalSettings(prev => ({
        ...prev,
        contractTypes: {
          ...prev.contractTypes,
          [selectedContractType]: [...prev.contractTypes[selectedContractType], newCategory.trim()]
        }
      }));
      setNewCategory('');
    }
  };

  const removeCategory = (contractType: 'retail' | 'wholesale' | 'offtake', category: string) => {
    setLocalSettings(prev => ({
      ...prev,
      contractTypes: {
        ...prev.contractTypes,
        [contractType]: prev.contractTypes[contractType].filter(c => c !== category)
      }
    }));
  };

  const addVolumeShape = () => {
    if (newVolumeShape.trim() && !localSettings.volumeShapes[newVolumeShape.trim()]) {
      // Ensure percentages add up to 100%
      const total = newVolumeShapeData.reduce((sum, val) => sum + val, 0);
      const normalizedData = newVolumeShapeData.map(val => (val / total) * 100);
      
      setLocalSettings(prev => ({
        ...prev,
        volumeShapes: {
          ...prev.volumeShapes,
          [newVolumeShape.trim()]: normalizedData
        }
      }));
      setNewVolumeShape('');
      setNewVolumeShapeData(Array(12).fill(8.33));
    }
  };

  const removeVolumeShape = (shapeName: string) => {
    // Don't allow removing default shapes
    if (['flat', 'solar', 'wind', 'custom'].includes(shapeName)) {
      alert('Cannot remove default volume shapes');
      return;
    }
    
    const { [shapeName]: removed, ...rest } = localSettings.volumeShapes;
    setLocalSettings(prev => ({
      ...prev,
      volumeShapes: rest
    }));
  };

  const updateVolumeShapeValue = (index: number, value: number) => {
    const newData = [...newVolumeShapeData];
    newData[index] = value;
    setNewVolumeShapeData(newData);
  };

  const addListItem = (listType: 'states' | 'indexationTypes' | 'unitTypes') => {
    if (newItem.trim() && !localSettings[listType].includes(newItem.trim())) {
      setLocalSettings(prev => ({
        ...prev,
        [listType]: [...prev[listType], newItem.trim()]
      }));
      setNewItem('');
    }
  };

  const removeListItem = (listType: 'states' | 'indexationTypes' | 'unitTypes', item: string) => {
    setLocalSettings(prev => ({
      ...prev,
      [listType]: prev[listType].filter(i => i !== item)
    }));
  };

  const sections = [
    { id: 'contract-types', label: 'Contract Types & Categories', icon: '📝' },
    { id: 'volume-shapes', label: 'Volume Shapes', icon: '📊' },
    { id: 'general', label: 'General Settings', icon: '⚙️' }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              ⚙️ System Settings
            </h2>
            <p className="text-gray-600 mt-2">Configure contract types, categories, and system defaults</p>
          </div>
          
          {hasChanges && (
            <div className="flex gap-3">
              <button 
                onClick={handleResetSettings}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Reset Changes
              </button>
              <button 
                onClick={handleSaveSettings}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
              >
                Save Settings
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Settings Sections</h3>
            <nav className="space-y-2">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{section.icon}</span>
                  <span className="font-medium">{section.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
            
            {/* Contract Types & Categories */}
            {activeSection === 'contract-types' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Contract Types & Categories</h3>
                  <p className="text-gray-600">Manage the categories available for each contract type</p>
                </div>

                {/* Add New Category */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Add New Category</h4>
                  <div className="flex gap-3">
                    <select
                      value={selectedContractType}
                      onChange={(e) => setSelectedContractType(e.target.value as 'retail' | 'wholesale' | 'offtake')}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(contractTypeLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Enter category name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                    />
                    <button
                      onClick={addCategory}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Contract Type Categories */}
                <div className="space-y-6">
                  {Object.entries(localSettings.contractTypes).map(([contractType, categories]) => (
                    <div key={contractType} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${
                          contractType === 'retail' ? 'bg-orange-100 text-orange-800' :
                          contractType === 'wholesale' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {contractTypeLabels[contractType as keyof typeof contractTypeLabels]}
                        </span>
                        <span>({categories.length} categories)</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {categories.map(category => (
                          <div
                            key={category}
                            className="flex items-center justify-between bg-gray-50 p-2 rounded border"
                          >
                            <span className="text-sm text-gray-700">{category}</span>
                            <button
                              onClick={() => removeCategory(contractType as 'retail' | 'wholesale' | 'offtake', category)}
                              className="text-red-500 hover:text-red-700 text-sm ml-2"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Volume Shapes */}
            {activeSection === 'volume-shapes' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Volume Shapes</h3>
                  <p className="text-gray-600">Configure monthly volume distribution profiles</p>
                </div>

                {/* Add New Volume Shape */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Add New Volume Shape</h4>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={newVolumeShape}
                      onChange={(e) => setNewVolumeShape(e.target.value)}
                      placeholder="Enter volume shape name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Monthly Percentages (must total 100%)
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                        {months.map((month, index) => (
                          <div key={month} className="text-center">
                            <label className="block text-xs text-gray-600 mb-1">{month}</label>
                            <input
                              type="number"
                              value={newVolumeShapeData[index]}
                              onChange={(e) => updateVolumeShapeValue(index, parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                              step="0.1"
                              min="0"
                              max="100"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        Total: {newVolumeShapeData.reduce((sum, val) => sum + val, 0).toFixed(1)}%
                      </div>
                    </div>
                    
                    <button
                      onClick={addVolumeShape}
                      disabled={!newVolumeShape.trim()}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Add Volume Shape
                    </button>
                  </div>
                </div>

                {/* Existing Volume Shapes */}
                <div className="space-y-4">
                  {Object.entries(localSettings.volumeShapes).map(([shapeName, percentages]) => (
                    <div key={shapeName} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-800 capitalize">{shapeName}</h4>
                        {!['flat', 'solar', 'wind', 'custom'].includes(shapeName) && (
                          <button
                            onClick={() => removeVolumeShape(shapeName)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                        {months.map((month, index) => (
                          <div key={month} className="text-center bg-gray-50 p-2 rounded">
                            <div className="text-xs text-gray-600">{month}</div>
                            <div className="font-medium text-sm">{percentages[index].toFixed(1)}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* General Settings */}
            {activeSection === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">General Settings</h3>
                  <p className="text-gray-600">Configure states, indexation types, and unit types</p>
                </div>

                {/* States */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Australian States & Territories</h4>
                  <div className="flex gap-3 mb-3">
                    <input
                      type="text"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="Enter state/territory code"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addListItem('states')}
                    />
                    <button
                      onClick={() => addListItem('states')}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {localSettings.states.map(state => (
                      <div key={state} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm text-gray-700">{state}</span>
                        <button
                          onClick={() => removeListItem('states', state)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Indexation Types */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Indexation Types</h4>
                  <div className="flex gap-3 mb-3">
                    <input
                      type="text"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="Enter indexation type"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addListItem('indexationTypes')}
                    />
                    <button
                      onClick={() => addListItem('indexationTypes')}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {localSettings.indexationTypes.map(indexType => (
                      <div key={indexType} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm text-gray-700">{indexType}</span>
                        <button
                          onClick={() => removeListItem('indexationTypes', indexType)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unit Types */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Unit Types</h4>
                  <div className="flex gap-3 mb-3">
                    <input
                      type="text"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="Enter unit type"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addListItem('unitTypes')}
                    />
                    <button
                      onClick={() => addListItem('unitTypes')}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {localSettings.unitTypes.map(unitType => (
                      <div key={unitType} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm text-gray-700">{unitType}</span>
                        <button
                          onClick={() => removeListItem('unitTypes', unitType)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}