// hooks/useAssetForm.js
import { useState, useEffect, useCallback } from 'react';
import { useAssetManagement } from './useAssetManagement';
import { useAssetTemplates } from './useAssetTemplates';
import { getDefaultValue, UI_CONSTANTS } from '@/lib/default_constants';

export const useAssetForm = (asset) => {
  const {
    updateAsset,
    handleFieldUpdate,
    handleDateFieldUpdate,
    handleConstructionDurationUpdate,
    initializeAssetCosts,
    updateAssetCost,
    getAssetCosts,
    getAssetCostDefault,
    updateCapacityFactors,
    getYear1Volume,
    constants
  } = useAssetManagement();

  const {
    checkTemplateSync,
    applyTemplate,
    getTemplate
  } = useAssetTemplates();

  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [outOfSync, setOutOfSync] = useState({});
  const [previousName, setPreviousName] = useState(asset?.name || '');

  // Get asset costs for this asset
  const assetCosts = getAssetCosts(asset?.name || '');
  
  // Calculate year 1 volume
  const year1Volume = getYear1Volume(asset?.id);

  // Helper function to determine if a value is default (blue) or user-defined (black)
  const getValueStyle = useCallback((currentValue, defaultValue) => {
    const isDefault = currentValue === undefined || currentValue === null || currentValue === defaultValue;
    return isDefault ? UI_CONSTANTS.colors.defaultValue : UI_CONSTANTS.colors.userValue;
  }, []);

  // Initialize asset costs when asset changes
  useEffect(() => {
    if (asset?.name && asset?.type && asset?.capacity) {
      initializeAssetCosts(asset.name, asset.type, asset.capacity);
    }
  }, [asset?.name, asset?.type, asset?.capacity, initializeAssetCosts]);

  // Update capacity factors when state/type changes
  useEffect(() => {
    if (asset?.id && asset?.state && asset?.type) {
      updateCapacityFactors(asset.id);
    }
  }, [asset?.state, asset?.type, asset?.id, updateCapacityFactors]);

  // Set default values for new assets
  useEffect(() => {
    if (!asset) return;

    // Set default degradation
    if (asset.type && !asset.annualDegradation) {
      const defaultDegradation = getDefaultValue('performance', 'annualDegradation', asset.type);
      if (defaultDegradation !== undefined) {
        updateAsset(asset.id, 'annualDegradation', defaultDegradation);
      }
    }
    
    // Set default construction duration
    if (!asset.constructionDuration) {
      const defaultDuration = getDefaultValue('performance', 'constructionDuration', asset.type);
      if (defaultDuration !== undefined) {
        updateAsset(asset.id, 'constructionDuration', defaultDuration);
      }
    }
  }, [asset?.type, asset?.annualDegradation, asset?.constructionDuration, updateAsset]);

  // Handle asset name updates
  useEffect(() => {
    if (asset?.name && previousName !== asset.name && previousName !== "") {
      setPreviousName(asset.name);
    }
  }, [asset?.name, previousName]);

  // Check for out of sync values with template
  useEffect(() => {
    if (selectedTemplate && asset) {
      const syncStatus = checkTemplateSync(asset, selectedTemplate.id);
      setOutOfSync(syncStatus);
    } else {
      setOutOfSync({});
    }
  }, [asset, selectedTemplate, checkTemplateSync]);

  // Handle template selection
  const handleTemplateSelection = useCallback((templateId) => {
    const template = getTemplate(templateId);
    if (!template || !asset) return;

    setSelectedTemplate(template);
    setPreviousName(asset.name);

    // Apply template values
    const templateValues = applyTemplate(templateId);
    if (templateValues) {
      Object.entries(templateValues).forEach(([field, value]) => {
        if (value !== undefined) {
          updateAsset(asset.id, field, value);
        }
      });
    }
  }, [getTemplate, asset, applyTemplate, updateAsset]);

  // Enhanced field update wrapper
  const handleAssetFieldUpdate = useCallback((field, value, options = {}) => {
    if (!asset) return;

    if (field === 'name') {
      setPreviousName(asset.name);
    }

    handleFieldUpdate(asset.id, field, value, options);
  }, [asset, handleFieldUpdate]);

  // Enhanced date field update wrapper
  const handleAssetDateUpdate = useCallback((field, value) => {
    if (!asset) return;
    handleDateFieldUpdate(asset.id, field, value);
  }, [asset, handleDateFieldUpdate]);

  // Enhanced construction duration update wrapper
  const handleAssetConstructionDurationUpdate = useCallback((value) => {
    if (!asset) return;
    handleConstructionDurationUpdate(asset.id, value);
  }, [asset, handleConstructionDurationUpdate]);

  // Handle cost field updates
  const handleAssetCostUpdate = useCallback((field, value) => {
    if (!asset?.name) return;
    updateAssetCost(asset.name, field, value);
  }, [asset?.name, updateAssetCost]);

  // Validation helpers
  const isOpsStartValid = useCallback(() => {
    if (!asset?.constructionStartDate || !asset?.constructionDuration || !asset?.assetStartDate) {
      return true;
    }
    
    const consStart = new Date(asset.constructionStartDate);
    const opsStart = new Date(asset.assetStartDate);
    const duration = parseInt(asset.constructionDuration) || 0;
    
    const expectedOpsStart = new Date(consStart);
    expectedOpsStart.setMonth(expectedOpsStart.getMonth() + duration);
    
    const expectedDateStr = expectedOpsStart.toISOString().split('T')[0];
    const actualDateStr = opsStart.toISOString().split('T')[0];
    
    return expectedDateStr === actualDateStr;
  }, [asset]);

  // Get default value for a specific field
  const getFieldDefault = useCallback((field) => {
    if (!asset?.type) return null;

    switch (field) {
      case 'annualDegradation':
        return getDefaultValue('performance', 'annualDegradation', asset.type);
      case 'constructionDuration':
        return getDefaultValue('performance', 'constructionDuration', asset.type);
      default:
        return null;
    }
  }, [asset?.type]);

  // Get quarterly capacity factor defaults
  const getQuarterlyDefaults = useCallback(() => {
    if (!asset?.state || !asset?.type || asset.type === 'storage') {
      return {};
    }

    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const defaults = {};
    
    quarters.forEach(quarter => {
      const defaultValue = constants.capacityFactors_qtr?.[asset.type]?.[asset.state]?.[quarter];
      defaults[quarter.toLowerCase()] = defaultValue ? String(Math.round(defaultValue * 100)) : '';
    });

    return defaults;
  }, [asset?.state, asset?.type, constants.capacityFactors_qtr]);

  return {
    // Asset data
    asset,
    assetCosts,
    year1Volume,
    
    // Template state
    selectedTemplate,
    outOfSync,
    
    // Update handlers
    handleAssetFieldUpdate,
    handleAssetDateUpdate,
    handleAssetConstructionDurationUpdate,
    handleAssetCostUpdate,
    handleTemplateSelection,
    
    // Validation
    isOpsStartValid,
    
    // Helpers
    getValueStyle,
    getFieldDefault,
    getQuarterlyDefaults,
    getAssetCostDefault,
  };
};