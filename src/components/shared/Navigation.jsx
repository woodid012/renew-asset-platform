// src/components/shared/Navigation.jsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2,
  BarChart3,
  AlertTriangle,
  Sliders,
  FileCheck,
  Settings,
  HelpCircle,
  Calculator,
  LogOut,
  User,
  Layers
} from 'lucide-react';
import { useScenarios } from '@/contexts/ScenarioContext';

// Navigation tabs configuration that can be shared between App and LoginScreen
// This can be imported in both App.jsx and LoginScreen.jsx
export const navigationTabs = [
  {
    id: "landingpage",
    label: "Summary",
    icon: BarChart3,
    colors: "hover:bg-blue-100 data-[state=active]:bg-blue-500 data-[state=active]:text-white",
  },
  {
    id: "threeway",
    label: "3-Way Forecast",
    icon: Calculator,
    colors: "hover:bg-indigo-100 data-[state=active]:bg-indigo-500 data-[state=active]:text-white",
  },
  {
    id: "inputs",
    label: "Price Inputs",
    icon: Sliders,
    colors: "hover:bg-green-100 data-[state=active]:bg-green-500 data-[state=active]:text-white",
  },
  {
    id: "dashboard",
    label: "Asset Definition",
    icon: Building2,
    colors: "hover:bg-purple-100 data-[state=active]:bg-purple-500 data-[state=active]:text-white",
  },
  {
    id: "revenue",
    label: "Revenue Charts",
    icon: BarChart3,
    colors: "hover:bg-orange-100 data-[state=active]:bg-orange-500 data-[state=active]:text-white",
  },
  {
    id: "risk",
    label: "Risk Analysis",
    icon: AlertTriangle,
    colors: "hover:bg-red-100 data-[state=active]:bg-red-500 data-[state=active]:text-white",
  },
  {
    id: "scenario",
    label: "Scenario Manager", // Updated label
    icon: Layers, // Updated icon to better represent scenarios
    colors: "hover:bg-teal-100 data-[state=active]:bg-teal-500 data-[state=active]:text-white", // Updated colors
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    colors: "hover:bg-gray-100 data-[state=active]:bg-gray-500 data-[state=active]:text-white",
  },
];

const Navigation = ({ 
  activeTab, 
  onTabChange, 
  children, 
  disabled = false,
  title = "Portfolio Earnings and Risk Analysis",
  formattedDate,
  currentUser = null,
  onLogout = null
}) => {
  const { scenarios, activeScenario, setActiveScenario, hasModifications } = useScenarios();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Card className="mx-auto max-w-screen-2xl">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{title}</h1>
            
            <div className="flex items-center gap-4">
              {/* Scenario Selector */}
              {currentUser && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Scenario:</span>
                  <Select value={activeScenario} onValueChange={setActiveScenario}>
                    <SelectTrigger className="w-40 h-8 text-sm">
                      <SelectValue placeholder="Select scenario" />
                    </SelectTrigger>
                    <SelectContent>
                      {scenarios.map(scenario => (
                        <SelectItem key={scenario.id} value={scenario.id}>
                          <div className="flex items-center gap-2">
                            <span>{scenario.name}</span>
                            {hasModifications(scenario.id) && (
                              <div className="w-2 h-2 bg-orange-400 rounded-full" title="Modified" />
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Current User Display */}
              {currentUser && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-md border">
                  <User className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">{currentUser}</span>
                </div>
              )}
              
              {/* Date Display */}
              <div className="text-sm text-muted-foreground">
                Last Updated: {formattedDate}
              </div>
              
              {/* Logout Button */}
              {currentUser && onLogout && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLogout}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              )}
            </div>
          </div>

          <Tabs 
            value={activeTab} 
            onValueChange={disabled ? undefined : onTabChange} 
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-8 p-1 bg-gray-100">
              {navigationTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={`flex items-center justify-center gap-1 px-1 py-1 text-xs rounded-md transition-colors duration-200 
                    ${tab.colors} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={disabled}
                >
                  <tab.icon className="h-3 w-3" />
                  <span className="hidden sm:inline truncate">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {children}
          </Tabs>
        </div>
      </Card>

      <footer className="mt-4 text-center text-xs text-muted-foreground">
        <p>Portfolio Management Dashboard © {new Date().getFullYear()}</p>
        {currentUser && (
          <p className="mt-1">Logged in as: <span className="font-medium">{currentUser}</span></p>
        )}
      </footer>
    </div>
  );
};

export default Navigation;