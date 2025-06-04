'use client';

import { useState } from 'react';

interface Contract {
  _id?: string;
  id?: number;
  name: string;
  type: 'retail' | 'wholesale' | 'offtake';
  category: string;
  state: string;
  counterparty: string;
  startDate: string;
  endDate: string;
  annualVolume: number;
  strikePrice: number;
  unit: string;
  volumeShape: 'flat' | 'solar' | 'wind' | 'custom';
  status: 'active' | 'pending';
  indexation: string;
  referenceDate: string;
}

interface ContractInputTabProps {
  contracts: Contract[];
  selectedContract: Contract | null;
  setSelectedContract: (contract: Contract | null) => void;
  addContract: (contract: Omit<Contract, '_id'>) => Promise<Contract>;
  updateContract: (contract: Contract) => Promise<Contract>;
  deleteContract: (contractId: string) => Promise<void>;
}

const defaultContract: Omit<Contract, '_id'> = {
  name: '',
  type: 'offtake',
  category: '',
  state: 'NSW',
  counterparty: '',
  startDate: '',
  endDate: '',
  annualVolume: 0,
  strikePrice: 0,
  unit: 'Energy',
  volumeShape: 'flat',
  status: 'active',
  indexation: 'Fixed',
  referenceDate: '',
};

export default function ContractInputTab({
  contracts,
  selectedContract,
  setSelectedContract,
  addContract,
  updateContract,
  deleteContract,
}: ContractInputTabProps) {
  const [formData, setFormData] = useState<Omit<Contract, '_id'>>(defaultContract);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const states = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
  const contractTypes = [
    { value: 'retail', label: 'Retail' },
    { value: 'wholesale', label: 'Wholesale' },
    { value: 'offtake', label: 'Offtake' }
  ];
  const volumeShapes = [
    { value: 'flat', label: 'Flat' },
    { value: 'solar', label: 'Solar' },
    { value: 'wind', label: 'Wind' },
    { value: 'custom', label: 'Custom' }
  ];
  const statuses = [
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' }
  ];
  const indexationTypes = [
    'Fixed',
    'CPI',
    'CPI + 1%',
    'CPI + 0.5%',
    'CPI + 2%',
    'Escalation 2%',
    'Escalation 3%'
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Contract name is required';
    if (!formData.category.trim()) newErrors.category = 'Category is required';
    if (!formData.counterparty.trim()) newErrors.counterparty = 'Counterparty is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';
    if (formData.annualVolume <= 0) newErrors.annualVolume = 'Annual volume must be greater than 0';
    if (formData.strikePrice <= 0) newErrors.strikePrice = 'Strike price must be greater than 0';
    
    if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
      newErrors.endDate = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleEditContract = (contract: Contract) => {
    const { _id, ...contractData } = contract;
    setFormData(contractData);
    setIsEditing(true);
    setSelectedContract(contract);
    setErrors({});
  };

  const handleSaveContract = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      if (isEditing && selectedContract) {
        await updateContract({ ...formData, _id: selectedContract._id, id: selectedContract.id });
      } else {
        await addContract(formData);
      }
      handleCancelEdit();
    } catch (error) {
      console.error('Error saving contract:', error);
      // You might want to show a toast notification here
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteContract = async (contract: Contract) => {
    if (!contract._id && !contract.id) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete "${contract.name}"?`);
    if (!confirmed) return;

    try {
      await deleteContract(contract._id || contract.id!.toString());
      if (selectedContract && (selectedContract._id === contract._id || selectedContract.id === contract.id)) {
        setSelectedContract(null);
      }
      if (isEditing && selectedContract && (selectedContract._id === contract._id || selectedContract.id === contract.id)) {
        handleCancelEdit();
      }
    } catch (error) {
      console.error('Error deleting contract:', error);
    }
  };

  const handleCancelEdit = () => {
    setFormData(defaultContract);
    setIsEditing(false);
    setSelectedContract(null);
    setErrors({});
  };

  return (
    <div className="contract-input-container">
      <div className="input-grid">
        {/* Contract Form */}
        <div className="card contract-form">
          <h2>
            {isEditing ? '✏️ Edit Contract' : '➕ Add New Contract'}
          </h2>
          
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name">Contract Name *</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'error' : ''}
                placeholder="Enter contract name"
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="type">Contract Type *</label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
              >
                {contractTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <input
                id="category"
                type="text"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className={errors.category ? 'error' : ''}
                placeholder="e.g., Solar Farm, Wind Farm, Retail Customer"
              />
              {errors.category && <span className="error-text">{errors.category}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="state">State *</label>
              <select
                id="state"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
              >
                {states.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="counterparty">Counterparty *</label>
              <input
                id="counterparty"
                type="text"
                value={formData.counterparty}
                onChange={(e) => handleInputChange('counterparty', e.target.value)}
                className={errors.counterparty ? 'error' : ''}
                placeholder="Enter counterparty name"
              />
              {errors.counterparty && <span className="error-text">{errors.counterparty}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="startDate">Start Date *</label>
              <input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                className={errors.startDate ? 'error' : ''}
              />
              {errors.startDate && <span className="error-text">{errors.startDate}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="endDate">End Date *</label>
              <input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                className={errors.endDate ? 'error' : ''}
              />
              {errors.endDate && <span className="error-text">{errors.endDate}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="annualVolume">Annual Volume (MWh) *</label>
              <input
                id="annualVolume"
                type="number"
                value={formData.annualVolume || ''}
                onChange={(e) => handleInputChange('annualVolume', parseFloat(e.target.value) || 0)}
                className={errors.annualVolume ? 'error' : ''}
                placeholder="Enter annual volume"
                min="0"
                step="1000"
              />
              {errors.annualVolume && <span className="error-text">{errors.annualVolume}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="strikePrice">Strike Price ($/MWh) *</label>
              <input
                id="strikePrice"
                type="number"
                value={formData.strikePrice || ''}
                onChange={(e) => handleInputChange('strikePrice', parseFloat(e.target.value) || 0)}
                className={errors.strikePrice ? 'error' : ''}
                placeholder="Enter strike price"
                min="0"
                step="0.01"
              />
              {errors.strikePrice && <span className="error-text">{errors.strikePrice}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="volumeShape">Volume Shape</label>
              <select
                id="volumeShape"
                value={formData.volumeShape}
                onChange={(e) => handleInputChange('volumeShape', e.target.value)}
              >
                {volumeShapes.map(shape => (
                  <option key={shape.value} value={shape.value}>{shape.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
              >
                {statuses.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="indexation">Indexation</label>
              <select
                id="indexation"
                value={formData.indexation}
                onChange={(e) => handleInputChange('indexation', e.target.value)}
              >
                {indexationTypes.map(indexation => (
                  <option key={indexation} value={indexation}>{indexation}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="referenceDate">Reference Date</label>
              <input
                id="referenceDate"
                type="date"
                value={formData.referenceDate}
                onChange={(e) => handleInputChange('referenceDate', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="unit">Unit</label>
              <input
                id="unit"
                type="text"
                value={formData.unit}
                onChange={(e) => handleInputChange('unit', e.target.value)}
                placeholder="Energy"
              />
            </div>
          </div>

          <div className="form-actions">
            <button 
              className="btn btn-primary" 
              onClick={handleSaveContract}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : (isEditing ? 'Update Contract' : 'Add Contract')}
            </button>
            {isEditing && (
              <button 
                className="btn btn-secondary" 
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Contract List */}
        <div className="card contract-list-panel">
          <h2>📋 Existing Contracts</h2>
          <div className="contract-list">
            {contracts.length === 0 ? (
              <p style={{ color: '#718096', textAlign: 'center', padding: '40px 0' }}>
                No contracts found. Add your first contract using the form.
              </p>
            ) : (
              contracts.map((contract, index) => (
                <div 
                  key={contract._id || contract.id || index}
                  className={`contract-item ${selectedContract && (selectedContract._id === contract._id || selectedContract.id === contract.id) ? 'selected' : ''}`}
                >
                  <div className="contract-header">
                    <div className="contract-name">
                      <span className={`status-indicator status-${contract.status}`}></span>
                      {contract.name}
                    </div>
                    <div className={`contract-type ${contract.type}`}>{contract.type.toUpperCase()}</div>
                  </div>
                  <div className="contract-details">
                    <div className="detail-item">
                      <div className="detail-label">Counterparty</div>
                      <div>{contract.counterparty}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">State</div>
                      <div>{contract.state}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Volume</div>
                      <div>{contract.annualVolume.toLocaleString()} MWh</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Strike Price</div>
                      <div>${contract.strikePrice}/MWh</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Period</div>
                      <div>{contract.startDate} to {contract.endDate}</div>
                    </div>
                    <div className="detail-item">
                      <div className="detail-label">Volume Shape</div>
                      <div>{contract.volumeShape.charAt(0).toUpperCase() + contract.volumeShape.slice(1)}</div>
                    </div>
                  </div>
                  <div className="contract-actions">
                    <button 
                      className="btn-small btn-edit"
                      onClick={() => handleEditContract(contract)}
                    >
                      Edit
                    </button>
                    <button 
                      className="btn-small btn-delete"
                      onClick={() => handleDeleteContract(contract)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}