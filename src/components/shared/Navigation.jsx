'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut, Building2, TrendingUp, BarChart3, AlertTriangle, GitBranch, Download, Settings, Calculator } from 'lucide-react';

// Navigation tabs configuration
export const navigationTabs = [
  { id: "landingpage", label: "Overview", icon: Building2, href: "/" },
  { id: "inputs", label: "Inputs", icon: TrendingUp, href: "/inputs" },
  { id: "dashboard", label: "Assets", icon: BarChart3, href: "/dashboard" },
  { id: "revenue", label: "Revenue", icon: TrendingUp, href: "/revenue" },
  { id: "risk", label: "Risk", icon: AlertTriangle, href: "/risk" },
  { id: "scenario", label: "Scenarios", icon: GitBranch, href: "/scenarios" },
  { id: "ppa", label: "Export", icon: Download, href: "/export" },
  { id: "threeway", label: "Forecast", icon: Calculator, href: "/forecast" },
  { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
];

const Navigation = ({ 
  children, 
  disabled = false, 
  formattedDate, 
  currentUser, 
  onLogout 
}) => {
  const pathname = usePathname();
  
  // Get current tab based on pathname
  const getCurrentTab = () => {
    const currentTab = navigationTabs.find(tab => tab.href === pathname);
    return currentTab?.id || "landingpage";
  };

  const activeTab = getCurrentTab();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-900">Portfolio Manager</h1>
            {formattedDate && (
              <span className="text-sm text-gray-500">{formattedDate}</span>
            )}
          </div>
          
          {currentUser && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {currentUser}</span>
              {onLogout && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLogout}
                  className="flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200 px-6">
        <Tabs value={activeTab} className="w-full">
          <TabsList className="grid w-full grid-cols-9 h-12">
            {navigationTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link key={tab.id} href={tab.href} passHref>
                  <TabsTrigger
                    value={tab.id}
                    disabled={disabled}
                    className={`
                      flex items-center gap-2 w-full h-10 
                      data-[state=active]:bg-blue-500 data-[state=active]:text-white
                      hover:bg-blue-50 transition-colors
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                </Link>
              );
            })}
          </TabsList>
        </Tabs>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default Navigation;