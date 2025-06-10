'use client';

import { useState } from 'react';
import { Contract, SettingsData, TimeSeriesDataPoint, PriceCurve } from '@/app/types';

export interface ContractRequirement {
  id: string;
  label: string;
  details: string;
  dueDate: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
}

interface ContractRequirementsEditorProps {
  formData: Omit<Contract, '_id'>;
  errors: Record<string, string>;
  settings: SettingsData;
  onInputChange: (field: keyof Omit<Contract, '_id'>, value: any) => void;
  onClose: () => void;
}

const defaultCategories = [
  'Legal & Compliance',
  'Financial',
  'Technical',
  'Operational',
  'Environmental',
  'Other'
];

const priorityColors = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200'
};

export default function ContractRequirementsEditor({
  formData,
  errors,
  settings,
  onInputChange,
  onClose,
}: ContractRequirementsEditorProps) {
  const [newRequirement, setNewRequirement] = useState<Omit<ContractRequirement, 'id'>>({
    label: '',
    details: '',
    dueDate: '',
    completed: false,
    priority: 'medium',
    category: 'Legal & Compliance'
  });

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'category'>('dueDate');

  // Get current requirements from form data
  const currentRequirements: ContractRequirement[] = formData.contractRequirements || [];

  // Add new requirement
  const addRequirement = () => {
    if (!newRequirement.label.trim() || !newRequirement.dueDate) {
      alert('Please enter a label and due date for the requirement');
      return;
    }

    const requirement: ContractRequirement = {
      ...newRequirement,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    };

    const updatedRequirements = [...currentRequirements, requirement];
    onInputChange('contractRequirements', updatedRequirements);
    
    // Reset form
    setNewRequirement({
      label: '',
      details: '',
      dueDate: '',
      completed: false,
      priority: 'medium',
      category: 'Legal & Compliance'
    });
  };

  // Remove requirement
  const removeRequirement = (requirementId: string) => {
    const updatedRequirements = currentRequirements.filter(req => req.id !== requirementId);
    onInputChange('contractRequirements', updatedRequirements);
  };

  // Update requirement
  const updateRequirement = (requirementId: string, updates: Partial<ContractRequirement>) => {
    const updatedRequirements = currentRequirements.map(req => 
      req.id === requirementId ? { ...req, ...updates } : req
    );
    onInputChange('contractRequirements', updatedRequirements);
  };

  // Filter and sort requirements
  const getFilteredRequirements = () => {
    let filtered = currentRequirements;

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter(req => req.category === filterCategory);
    }

    // Filter by status
    if (filterStatus === 'pending') {
      filtered = filtered.filter(req => !req.completed);
    } else if (filterStatus === 'completed') {
      filtered = filtered.filter(req => req.completed);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });

    return filtered;
  };

  // Get requirement statistics
  const getStats = () => {
    const total = currentRequirements.length;
    const completed = currentRequirements.filter(req => req.completed).length;
    const pending = total - completed;
    const overdue = currentRequirements.filter(req => 
      !req.completed && new Date(req.dueDate) < new Date()
    ).length;

    return { total, completed, pending, overdue };
  };

  // Check if requirement is overdue
  const isOverdue = (requirement: ContractRequirement) => {
    return !requirement.completed && new Date(requirement.dueDate) < new Date();
  };

  // Get unique categories
  const availableCategories = [...new Set([
    ...defaultCategories,
    ...currentRequirements.map(req => req.category)
  ])];

  const stats = getStats();
  const filteredRequirements = getFilteredRequirements();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              📋 Contract Requirements
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Statistics Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Requirements</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
              <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
              <div className="text-sm text-gray-600">Overdue</div>
            </div>
          </div>

          {/* Add New Requirement */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Add New Requirement</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requirement Label *
                </label>
                <input
                  type="text"
                  value={newRequirement.label}
                  onChange={(e) => setNewRequirement(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Submit environmental impact assessment"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date *
                </label>
                <input
                  type="date"
                  value={newRequirement.dueDate}
                  onChange={(e) => setNewRequirement(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={newRequirement.category}
                  onChange={(e) => setNewRequirement(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {defaultCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={newRequirement.priority}
                  onChange={(e) => setNewRequirement(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Details */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Details
              </label>
              <textarea
                value={newRequirement.details}
                onChange={(e) => setNewRequirement(prev => ({ ...prev, details: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Additional details about this requirement..."
              />
            </div>

            <button
              onClick={addRequirement}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              Add Requirement
            </button>
          </div>

          {/* Filters and Sorting */}
          {currentRequirements.length > 0 && (
            <div className="bg-white rounded-lg p-4 mb-6 border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Categories</option>
                    {availableCategories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'completed')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort by</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'priority' | 'category')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="dueDate">Due Date</option>
                    <option value="priority">Priority</option>
                    <option value="category">Category</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <div className="text-sm text-gray-600">
                    Showing {filteredRequirements.length} of {currentRequirements.length} requirements
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Requirements List */}
          <div className="space-y-4">
            {filteredRequirements.length === 0 ? (
              <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-lg mb-2">
                  {currentRequirements.length === 0 ? 'No requirements added yet' : 'No requirements match your filters'}
                </p>
                <p className="text-sm">
                  {currentRequirements.length === 0 
                    ? 'Add your first requirement above to get started' 
                    : 'Try adjusting your filter criteria'
                  }
                </p>
              </div>
            ) : (
              filteredRequirements.map((requirement) => (
                <div 
                  key={requirement.id} 
                  className={`bg-white border rounded-lg p-4 transition-all hover:shadow-md ${
                    isOverdue(requirement) ? 'border-red-300 bg-red-50' : 
                    requirement.completed ? 'border-green-300 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={requirement.completed}
                        onChange={(e) => updateRequirement(requirement.id, { completed: e.target.checked })}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div>
                        <h4 className={`font-semibold ${requirement.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                          {requirement.label}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${priorityColors[requirement.priority]}`}>
                            {requirement.priority.toUpperCase()}
                          </span>
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            {requirement.category}
                          </span>
                          <span className={`text-xs font-medium ${
                            isOverdue(requirement) ? 'text-red-600' : 
                            requirement.completed ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            Due: {new Date(requirement.dueDate).toLocaleDateString()}
                            {isOverdue(requirement) && ' (OVERDUE)'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeRequirement(requirement.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  
                  {requirement.details && (
                    <div className={`text-sm pl-8 ${requirement.completed ? 'text-gray-500' : 'text-gray-700'}`}>
                      {requirement.details}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200 mt-8">
            <button
              onClick={onClose}
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