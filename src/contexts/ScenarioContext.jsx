// src/contexts/ScenarioContext.jsx - Enhanced with Global Integration
import React, { createContext, useContext, useState, useCallback } from 'react';

const ScenarioContext = createContext();

export function useScenarios() {
  const context = useContext(ScenarioContext);
  if (!context) {
    throw new Error('useScenarios must be used within a ScenarioProvider');
  }
  return context;
}

export function ScenarioProvider({ children }) {
  const [scenarios, setScenarios] = useState([
    {
      id: 'base',
      name: 'Base',
      description: 'Current portfolio inputs',
      values: {}
    }
  ]);
  
  const [activeScenario, setActiveScenario] = useState('base');

  // Create new scenario
  const createScenario = useCallback((name, description = '') => {
    const newScenario = {
      id: `scenario_${Date.now()}`,
      name: name.trim(),
      description: description || `Alternative scenario: ${name.trim()}`,
      values: {}
    };

    setScenarios(prev => [...prev, newScenario]);
    return newScenario.id;
  }, []);

  // Delete scenario
  const deleteScenario = useCallback((scenarioId) => {
    if (scenarioId === 'base') return false;
    
    setScenarios(prev => prev.filter(s => s.id !== scenarioId));
    
    // If we're deleting the active scenario, switch to base
    if (activeScenario === scenarioId) {
      setActiveScenario('base');
    }
    
    return true;
  }, [activeScenario]);

  // Update scenario value
  const updateScenarioValue = useCallback((scenarioId, parameterKey, value) => {
    setScenarios(prev => prev.map(scenario => {
      if (scenario.id === scenarioId) {
        return {
          ...scenario,
          values: {
            ...scenario.values,
            [parameterKey]: value
          }
        };
      }
      return scenario;
    }));
  }, []);

  // Get scenario by ID
  const getScenario = useCallback((scenarioId) => {
    return scenarios.find(s => s.id === scenarioId);
  }, [scenarios]);

  // Get active scenario
  const getActiveScenario = useCallback(() => {
    return scenarios.find(s => s.id === activeScenario);
  }, [scenarios, activeScenario]);

  // Check if scenario has any modifications
  const hasModifications = useCallback((scenarioId) => {
    const scenario = getScenario(scenarioId);
    return scenario && Object.keys(scenario.values).length > 0;
  }, [getScenario]);

  // NEW: Get scenario-modified constants
  const getScenarioConstants = useCallback((baseConstants, scenarioId = null) => {
    const targetScenarioId = scenarioId || activeScenario;
    const scenario = getScenario(targetScenarioId);
    
    if (!scenario || scenario.id === 'base' || !scenario.values) {
      return baseConstants;
    }

    // Deep clone base constants
    const modifiedConstants = JSON.parse(JSON.stringify(baseConstants));
    
    // Apply scenario modifications
    Object.entries(scenario.values).forEach(([key, value]) => {
      setNestedValue(modifiedConstants, key, value);
    });

    return modifiedConstants;
  }, [activeScenario, getScenario]);

  // NEW: Get scenario-modified assets
  const getScenarioAssets = useCallback((baseAssets, scenarioId = null) => {
    const targetScenarioId = scenarioId || activeScenario;
    const scenario = getScenario(targetScenarioId);
    
    if (!scenario || scenario.id === 'base' || !scenario.values) {
      return baseAssets;
    }

    // Deep clone base assets
    const modifiedAssets = JSON.parse(JSON.stringify(baseAssets));
    
    // Apply scenario modifications to assets
    Object.entries(scenario.values).forEach(([key, value]) => {
      if (key.startsWith('assets.')) {
        const assetPath = key.replace('assets.', '');
        const [assetName, ...propertyPath] = assetPath.split('.');
        
        if (modifiedAssets[assetName] || Object.values(modifiedAssets).find(a => a.name === assetName)) {
          // Find asset by name since keys might be IDs
          const assetKey = Object.keys(modifiedAssets).find(id => 
            modifiedAssets[id].name === assetName
          );
          
          if (assetKey && propertyPath.length > 0) {
            setNestedValue(modifiedAssets[assetKey], propertyPath.join('.'), value);
          }
        }
      }
    });

    return modifiedAssets;
  }, [activeScenario, getScenario]);

  // Helper function to set nested object values
  const setNestedValue = (obj, path, value) => {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  };

  const value = {
    scenarios,
    setScenarios,
    activeScenario,
    setActiveScenario,
    createScenario,
    deleteScenario,
    updateScenarioValue,
    getScenario,
    getActiveScenario,
    hasModifications,
    
    // NEW: Global integration functions
    getScenarioConstants,
    getScenarioAssets
  };

  return (
    <ScenarioContext.Provider value={value}>
      {children}
    </ScenarioContext.Provider>
  );
}

export default ScenarioProvider;