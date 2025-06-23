'use client'

import './globals.css'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserProvider } from './contexts/UserContext'
import { MerchantPriceProvider } from './contexts/MerchantPriceProvider' // Fixed import path
import UserSelector from './components/UserSelector'
import { 
  Building2, 
  Home, 
  TrendingUp, 
  Calculator,
  Settings,
  Menu,
  X
} from 'lucide-react'

// Navigation items
const navigationItems = [
  {
    name: 'Dashboard',
    href: '/',
    icon: Home
  },
  {
    name: 'Asset Definition',
    href: '/assets',
    icon: Building2
  },
  {
    name: 'Revenue Analysis',
    href: '/revenue',
    icon: TrendingUp
  },
  {
    name: 'Project Finance',
    href: '/finance',
    icon: Calculator
  }
]

function LayoutContent({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  // Fix hydration mismatch by only showing dynamic content after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:relative
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">
              RenewableAssets
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200
                    ${isActive
                      ? 'bg-green-100 text-green-900 border-r-2 border-green-600'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className={`
                    mr-3 h-5 w-5 transition-colors duration-200
                    ${isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-500'}
                  `} />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 w-full p-4 border-t border-gray-200">
          <button className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-200">
            <Settings className="mr-3 h-5 w-5 text-gray-400" />
            Settings
          </button>
          
          {/* Status indicator */}
          <div className="mt-3 px-3 py-2 bg-green-50 rounded-md">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="ml-2 text-xs text-green-700 font-medium">
                System Online
              </span>
            </div>
            {mounted && (
              <p className="text-xs text-green-600 mt-1">
                Last sync: {new Date().toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Top navigation bar */}
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <Menu className="w-6 h-6" />
              </button>

              {/* Page title */}
              <div className="ml-4 lg:ml-0">
                <h1 className="text-lg font-semibold text-gray-900">
                  {navigationItems.find(item => item.href === pathname)?.name || 'Dashboard'}
                </h1>
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-4">
              {/* User and Portfolio Selector */}
              <UserSelector />

              {/* Current date */}
              {mounted && (
                <div className="hidden sm:block text-sm text-gray-500">
                  {new Date().toLocaleDateString('en-AU', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Renewable Asset Platform</title>
        <meta name="description" content="Renewable energy asset performance analysis platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-gray-50">
        <UserProvider>
          <MerchantPriceProvider>
            <LayoutContent>
              {children}
            </LayoutContent>
          </MerchantPriceProvider>
        </UserProvider>
      </body>
    </html>
  )
}