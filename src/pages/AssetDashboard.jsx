// pages/AssetDashboard.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, ChevronLeft, ChevronRight, Download, Upload } from 'lucide-react';
import { usePortfolio } from '@/contexts/PortfolioContext';
import { useAssetManagement } from '@/hooks/useAssetManagement';
import AssetForm from '@/components/AssetForm';
import AssetSummaryInputs from '@/components/AssetSummaryInputs';
import {
  DEFAULT_PLATFORM_COSTS,
  DEFAULT_TAX_DEPRECIATION,
  UI_CONSTANTS
} from '@/lib/default_constants';

const AssetDashboard = () => {
  const { 
    portfolioName, 
    setPortfolioName, 
    exportPortfolioData,
    importPortfolioData,
    constants,
    updateConstants
  } = usePortfolio();
  
  const { assets, addNewAsset } = useAssetManagement();
  
  const [activeTab, setActiveTab] = useState('platform');
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const tabsListRef = useRef(null);
  const fileInputRef = useRef(null);

  // Platform management parameters
  const platformOpex = constants.platformOpex ?? DEFAULT_PLATFORM_COSTS.platformOpex;
  const platformOpexEscalation = constants.platformOpexEscalation ?? DEFAULT_PLATFORM_COSTS.platformOpexEscalation;
  const otherOpex = constants.otherOpex ?? DEFAULT_PLATFORM_COSTS.otherOpex;
  
  // Cash management parameters
  const dividendPolicy = constants.dividendPolicy ?? DEFAULT_PLATFORM_COSTS.dividendPolicy;
  const minimumCashBalance = constants.minimumCashBalance ?? DEFAULT_PLATFORM_COSTS.minimumCashBalance;
  
  // Tax parameters
  const corporateTaxRate = constants.corporateTaxRate ?? DEFAULT_TAX_DEPRECIATION.corporateTaxRate;
  const deprecationPeriods = constants.deprecationPeriods ?? DEFAULT_TAX_DEPRECIATION.deprecationPeriods;

  // Helper function to determine if a value is default (blue) or user-defined (black)
  const getValueStyle = (currentValue, defaultValue) => {
    const isDefault = currentValue === undefined || currentValue === null || currentValue === defaultValue;
    return isDefault ? UI_CONSTANTS.colors.defaultValue : UI_CONSTANTS.colors.userValue;
  };

  // Handle depreciation period changes
  const handleDepreciationChange = (assetType, value) => {
    const updatedPeriods = {
      ...deprecationPeriods,
      [assetType]: parseInt(value) || 0
    };
    updateConstants('deprecationPeriods', updatedPeriods);
  };

  // Import functionality
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          importPortfolioData(importedData);
          alert('Asset data imported successfully');
        } catch (error) {
          alert('Error importing asset data: Invalid format');
          console.error('Import error:', error);
        }
      };
      reader.readAsText(file);
    }
    // Reset file input
    event.target.value = '';
  };

  // Export functionality
  const exportPortfolio = () => {
    const exportData = exportPortfolioData();
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileName = `${portfolioName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  };

  // Check if tabs overflow and show scroll buttons
  useEffect(() => {
    const checkOverflow = () => {
      if (tabsListRef.current) {
        const { scrollWidth, clientWidth } = tabsListRef.current;
        setShowScrollButtons(scrollWidth > clientWidth);
      }
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [assets]);

  // Scroll tabs left or right
  const scroll = (direction) => {
    if (tabsListRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      tabsListRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Add new asset and switch to its tab
  const handleAddNewAsset = () => {
    const newAssetId = addNewAsset();
    setActiveTab(newAssetId);
  };

  return (
    <div className="w-full p-4 space-y-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span>Asset & Contracts Definitions</span>
              <Input 
                className="w-64 border-2 px-3 py-1 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Portfolio Name"
                value={portfolioName}
                onChange={(e) => setPortfolioName(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".json"
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Load Inputs
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportPortfolio}
              >
                <Download className="w-4 h-4 mr-2" />
                Save Inputs
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center space-x-2">
              {showScrollButtons && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={() => scroll('left')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              
              <div className="flex-grow overflow-hidden">
                <TabsList 
                  ref={tabsListRef} 
                  className="flex overflow-x-hidden scroll-smooth justify-start"
                >
                  <TabsTrigger
                    value="platform"
                    className="flex-shrink-0 relative group w-auto data-[state=active]:bg-green-600 data-[state=active]:text-white hover:bg-green-100"
                  >
                    <span className="flex items-center justify-center w-full">
                      Platform Inputs
                    </span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="summary"
                    className="flex-shrink-0 relative group w-auto data-[state=active]:bg-blue-500 data-[state=active]:text-white hover:bg-blue-100"
                  >
                    <span className="flex items-center justify-center w-full">
                      Assets Summary
                    </span>
                  </TabsTrigger>
                  {Object.values(assets).map((asset) => (
                    <TabsTrigger
                      key={asset.id}
                      value={asset.id}
                      className="flex-shrink-0 relative group w-auto"
                    >
                      <span className="flex items-center justify-center w-full">
                        {asset.name}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {showScrollButtons && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={() => scroll('right')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}

              <Button onClick={handleAddNewAsset} className="flex-shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Platform Management & Tax Settings */}
            <TabsContent value="platform" className="space-y-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-green-700 mb-2">Platform Inputs</h2>
                <p className="text-gray-600">Portfolio-wide settings that apply across all assets</p>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Platform Management Costs</CardTitle>
                  <CardDescription>Corporate-level operational costs and cash management policies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Platform Management OpEx ($M/year)</Label>
                        <Input 
                          type="number"
                          value={platformOpex}
                          onChange={(e) => updateConstants('platformOpex', parseFloat(e.target.value) || 0)}
                          placeholder="Annual cost in $M"
                          className={getValueStyle(platformOpex, DEFAULT_PLATFORM_COSTS.platformOpex)}
                        />
                        <p className="text-sm text-gray-500">Annual platform management cost</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Platform OpEx Escalation (%/year)</Label>
                        <Input 
                          type="number"
                          value={platformOpexEscalation}
                          onChange={(e) => updateConstants('platformOpexEscalation', parseFloat(e.target.value) || 0)}
                          placeholder="Annual escalation %"
                          className={getValueStyle(platformOpexEscalation, DEFAULT_PLATFORM_COSTS.platformOpexEscalation)}
                        />
                        <p className="text-sm text-gray-500">Annual increase in platform costs</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Other OpEx ($M/year)</Label>
                        <Input 
                          type="number"
                          value={otherOpex}
                          onChange={(e) => updateConstants('otherOpex', parseFloat(e.target.value) || 0)}
                          placeholder="Other annual costs in $M"
                          className={getValueStyle(otherOpex, DEFAULT_PLATFORM_COSTS.otherOpex)}
                        />
                        <p className="text-sm text-gray-500">Other annual operational costs</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Dividend Payout Ratio (%)</Label>
                        <Input 
                          type="number"
                          value={dividendPolicy}
                          onChange={(e) => updateConstants('dividendPolicy', parseFloat(e.target.value) || 0)}
                          placeholder="Dividend payout ratio %"
                          className={getValueStyle(dividendPolicy, DEFAULT_PLATFORM_COSTS.dividendPolicy)}
                        />
                        <p className="text-sm text-gray-500">Percentage of NPAT distributed as dividends</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Minimum Cash Balance ($M)</Label>
                        <Input 
                          type="number"
                          value={minimumCashBalance}
                          onChange={(e) => updateConstants('minimumCashBalance', parseFloat(e.target.value) || 0)}
                          placeholder="Minimum cash balance ($M)"
                          className={getValueStyle(minimumCashBalance, DEFAULT_PLATFORM_COSTS.minimumCashBalance)}
                        />
                        <p className="text-sm text-gray-500">Minimum cash balance before paying dividends</p>
                      </div>

                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-medium text-green-800 mb-2">Platform Notes</h4>
                        <ul className="text-sm text-green-700 space-y-1">
                          <li>• Platform costs apply across entire portfolio</li>
                          <li>• Cash management affects dividend distributions</li>
                          <li>• OpEx escalation compounds annually</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tax & Depreciation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Corporate Tax Rate</CardTitle>
                    <CardDescription>Tax settings applied to portfolio income</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Corporate Tax Rate (%)</Label>
                        <Input 
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={corporateTaxRate}
                          onChange={(e) => updateConstants('corporateTaxRate', parseFloat(e.target.value) || 0)}
                          className="max-w-xs"
                        />
                        <p className="text-sm text-gray-500">
                          Corporate tax rate applied to taxable income
                        </p>
                      </div>

                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="font-medium text-blue-800 mb-2">Tax Notes</h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                          <li>• Applied to EBITDA less depreciation</li>
                          <li>• Tax losses can be carried forward</li>
                          <li>• Portfolio-level consolidation</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Asset Depreciation Periods</CardTitle>
                    <CardDescription>Tax depreciation schedules by technology</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label>Solar (Years)</Label>
                          <Input 
                            type="number"
                            min="1"
                            max="40"
                            value={deprecationPeriods.solar}
                            onChange={(e) => handleDepreciationChange('solar', e.target.value)}
                            className="max-w-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Wind (Years)</Label>
                          <Input 
                            type="number"
                            min="1"
                            max="40"
                            value={deprecationPeriods.wind}
                            onChange={(e) => handleDepreciationChange('wind', e.target.value)}
                            className="max-w-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Storage (Years)</Label>
                          <Input 
                            type="number"
                            min="1"
                            max="40"
                            value={deprecationPeriods.storage}
                            onChange={(e) => handleDepreciationChange('storage', e.target.value)}
                            className="max-w-xs"
                          />
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        Asset depreciation periods for tax and accounting purposes
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="summary">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-blue-700 mb-2">Assets</h2>
                <p className="text-gray-600">Individual asset configuration and summary view</p>
              </div>
              <AssetSummaryInputs />
            </TabsContent>
            
            {Object.values(assets).map((asset) => (
              <TabsContent key={asset.id} value={asset.id}>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-blue-700 mb-2">Assets</h2>
                  <p className="text-gray-600">Configure individual asset: {asset.name}</p>
                </div>
                <AssetForm assetId={asset.id} />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssetDashboard;