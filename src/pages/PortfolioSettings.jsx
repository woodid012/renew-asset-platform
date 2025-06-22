import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DEFAULT_CAPEX_RATES,
  DEFAULT_OPEX_RATES,
  DEFAULT_PROJECT_FINANCE,
  DEFAULT_PLATFORM_COSTS,
  DEFAULT_TAX_DEPRECIATION,
  DEFAULT_DISCOUNT_RATES,
  DEFAULT_RISK_PARAMETERS,
  DEFAULT_PRICE_SETTINGS,
  formatPercent,
  formatCurrency,
  formatRate,
  formatMultiplier,
  formatYears,
  UI_CONSTANTS
} from '@/lib/default_constants';

const PortfolioSettings = () => {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Portfolio Settings & Defaults</h1>
        <p className="text-gray-600 mt-2">
          Default values used throughout the portfolio analysis application. All values are applied when creating new assets or when user-defined values are not provided.
        </p>
      </div>

      {/* Asset Economics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Asset Economics
              <Badge variant="outline">Per MW</Badge>
            </CardTitle>
            <CardDescription>Default capital and operating cost assumptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="font-medium text-sm text-gray-500">Technology</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-sm text-gray-500">CAPEX</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-sm text-gray-500">OPEX</div>
              </div>
              
              {/* Solar */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <span className="font-medium">Solar</span>
              </div>
              <div className="text-center font-mono">{formatRate(DEFAULT_CAPEX_RATES.solar)}</div>
              <div className="text-center font-mono">{formatRate(DEFAULT_OPEX_RATES.solar)}</div>
              
              {/* Wind */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                <span className="font-medium">Wind</span>
              </div>
              <div className="text-center font-mono">{formatRate(DEFAULT_CAPEX_RATES.wind)}</div>
              <div className="text-center font-mono">{formatRate(DEFAULT_OPEX_RATES.wind)}</div>
              
              {/* Storage */}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                <span className="font-medium">Storage</span>
              </div>
              <div className="text-center font-mono">{formatRate(DEFAULT_CAPEX_RATES.storage)}</div>
              <div className="text-center font-mono">{formatRate(DEFAULT_OPEX_RATES.storage)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Finance</CardTitle>
            <CardDescription>Default debt and financing parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Maximum Gearing</span>
                <span className="font-mono">{formatPercent(DEFAULT_PROJECT_FINANCE.maxGearing)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Interest Rate</span>
                <span className="font-mono">{formatPercent(DEFAULT_PROJECT_FINANCE.interestRate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">DSCR (Contracted)</span>
                <span className="font-mono">{formatMultiplier(DEFAULT_PROJECT_FINANCE.targetDSCRContract)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">DSCR (Merchant)</span>
                <span className="font-mono">{formatMultiplier(DEFAULT_PROJECT_FINANCE.targetDSCRMerchant)}</span>
              </div>
              <div className="border-t pt-3">
                <div className="text-sm font-medium text-gray-700 mb-2">Loan Tenor by Technology</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>Solar: {DEFAULT_PROJECT_FINANCE.tenorYears.solar}y</div>
                  <div>Wind: {DEFAULT_PROJECT_FINANCE.tenorYears.wind}y</div>
                  <div>Storage: {DEFAULT_PROJECT_FINANCE.tenorYears.storage}y</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform & Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Platform Management</CardTitle>
            <CardDescription>Corporate-level costs and policies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Platform OPEX</span>
                <span className="font-mono">{formatCurrency(DEFAULT_PLATFORM_COSTS.platformOpex)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Other OPEX</span>
                <span className="font-mono">{formatCurrency(DEFAULT_PLATFORM_COSTS.otherOpex)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cost Escalation</span>
                <span className="font-mono">{formatPercent(DEFAULT_PLATFORM_COSTS.platformOpexEscalation)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Dividend Payout</span>
                <span className="font-mono">{formatPercent(DEFAULT_PLATFORM_COSTS.dividendPolicy)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Min Cash Balance</span>
                <span className="font-mono">{formatCurrency(DEFAULT_PLATFORM_COSTS.minimumCashBalance)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax & Pricing</CardTitle>
            <CardDescription>Tax rates and price escalation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Corporate Tax Rate</span>
                <span className="font-mono">{formatPercent(DEFAULT_TAX_DEPRECIATION.corporateTaxRate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Price Escalation</span>
                <span className="font-mono">{formatPercent(DEFAULT_PRICE_SETTINGS.escalation)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reference Year</span>
                <span className="font-mono">{DEFAULT_PRICE_SETTINGS.referenceYear}</span>
              </div>
              <div className="border-t pt-3">
                <div className="text-sm font-medium text-gray-700 mb-2">Depreciation Periods</div>
                <div className="grid grid-cols-1 gap-1 text-sm">
                  <div>Solar: {DEFAULT_TAX_DEPRECIATION.deprecationPeriods.solar}y</div>
                  <div>Wind: {DEFAULT_TAX_DEPRECIATION.deprecationPeriods.wind}y</div>
                  <div>Storage: {DEFAULT_TAX_DEPRECIATION.deprecationPeriods.storage}y</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk & Valuation</CardTitle>
            <CardDescription>Analysis parameters and discount rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">Risk Analysis (±%)</div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Volume Variation</span>
                <span className="font-mono">±{DEFAULT_RISK_PARAMETERS.volumeVariation}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Energy Price</span>
                <span className="font-mono">±{DEFAULT_RISK_PARAMETERS.EnergyPriceVariation}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Green Price</span>
                <span className="font-mono">±{DEFAULT_RISK_PARAMETERS.greenPriceVariation}%</span>
              </div>
              
              <div className="border-t pt-3">
                <div className="text-sm font-medium text-gray-700 mb-2">Discount Rates</div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Contracted</span>
                  <span className="font-mono">{formatPercent(DEFAULT_DISCOUNT_RATES.contract)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Merchant</span>
                  <span className="font-mono">{formatPercent(DEFAULT_DISCOUNT_RATES.merchant)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Color Coding Legend */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded"></div>
              <span className="text-sm">Default Value</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-black rounded"></div>
              <span className="text-sm">User Modified</span>
            </div>
            <div className="text-sm text-blue-700 ml-4">
              Throughout the application, blue text indicates default values while black text shows user-modified values.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortfolioSettings;