// hooks/useAssetTemplates.js
import { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { processAssetData } from '@/utils/assetUtils';

export const useAssetTemplates = () => {
  const [renewablesData, setRenewablesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load renewables data from CSV
  useEffect(() => {
    const loadRenewablesData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/renewables_registration_data.csv');
        const csvText = await response.text();
        const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        setRenewablesData(processAssetData(result.data));
      } catch (error) {
        console.error('Error loading renewables data:', error);
        setError('Failed to load renewables data');
      } finally {
        setLoading(false);
      }
    };

    loadRenewablesData();
  }, []);

  // Get template by ID
  const getTemplate = useCallback((templateId) => {
    return renewablesData.find(r => r.id === templateId);
  }, [renewablesData]);

  // Get sorted templates for display
  const getSortedTemplates = useCallback(() => {
    return renewablesData.sort((a, b) => a.name.localeCompare(b.name));
  }, [renewablesData]);

  // Filter templates by criteria
  const filterTemplates = useCallback((filters = {}) => {
    const { state, type, minCapacity, maxCapacity } = filters;
    
    return renewablesData.filter(template => {
      if (state && template.state !== state) return false;
      if (type && template.type !== type) return false;
      if (minCapacity && template.capacity < minCapacity) return false;
      if (maxCapacity && template.capacity > maxCapacity) return false;
      return true;
    });
  }, [renewablesData]);

  // Check if asset values are out of sync with template
  const checkTemplateSync = useCallback((asset, templateId) => {
    const template = getTemplate(templateId);
    if (!template || !asset) return {};

    return {
      name: asset.name !== template.name,
      state: asset.state !== template.state,
      capacity: asset.capacity !== template.capacity,
      type: asset.type !== template.type,
      volumeLossAdjustment: template.mlf && 
        String(asset.volumeLossAdjustment) !== String(template.mlf.toFixed(2)),
      assetStartDate: template.startDate && 
        asset.assetStartDate !== template.startDate,
    };
  }, [getTemplate]);

  // Apply template to asset
  const applyTemplate = useCallback((templateId) => {
    const template = getTemplate(templateId);
    if (!template) return null;

    return {
      name: template.name,
      state: template.state,
      capacity: template.capacity,
      type: template.type,
      volumeLossAdjustment: template.mlf ? template.mlf.toFixed(2) : undefined,
      assetStartDate: template.startDate || undefined
    };
  }, [getTemplate]);

  // Get unique states from templates
  const getAvailableStates = useCallback(() => {
    const states = new Set(renewablesData.map(t => t.state));
    return Array.from(states).sort();
  }, [renewablesData]);

  // Get unique types from templates
  const getAvailableTypes = useCallback(() => {
    const types = new Set(renewablesData.map(t => t.type));
    return Array.from(types).sort();
  }, [renewablesData]);

  // Get capacity range from templates
  const getCapacityRange = useCallback(() => {
    if (renewablesData.length === 0) return { min: 0, max: 1000 };
    
    const capacities = renewablesData.map(t => t.capacity);
    return {
      min: Math.min(...capacities),
      max: Math.max(...capacities)
    };
  }, [renewablesData]);

  return {
    // Data
    renewablesData,
    loading,
    error,
    
    // Template operations
    getTemplate,
    getSortedTemplates,
    filterTemplates,
    applyTemplate,
    
    // Sync checking
    checkTemplateSync,
    
    // Metadata
    getAvailableStates,
    getAvailableTypes,
    getCapacityRange,
  };
};