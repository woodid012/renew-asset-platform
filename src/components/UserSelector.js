'use client'

import { useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { 
  User, 
  Users, 
  Plus, 
  Check, 
  ChevronDown,
  Building2,
  Mail,
  Briefcase,
  X
} from 'lucide-react'

export default function UserSelector() {
  const { 
    currentUser, 
    currentPortfolio, 
    users, 
    selectUser, 
    selectPortfolio, 
    createUser,
    createPortfolio 
  } = useUser()
  
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showPortfolioDropdown, setShowPortfolioDropdown] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [showPortfolioForm, setShowPortfolioForm] = useState(false)
  
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    company: '',
    role: 'user',
    defaultPortfolio: 'main'
  })
  
  const [portfolioForm, setPortfolioForm] = useState({
    portfolioId: '',
    portfolioName: ''
  })

  const handleUserSubmit = async (e) => {
    e.preventDefault()
    try {
      await createUser(userForm)
      setShowUserForm(false)
      setUserForm({ name: '', email: '', company: '', role: 'user', defaultPortfolio: 'main' })
    } catch (error) {
      alert(`Error creating user: ${error.message}`)
    }
  }

  const handlePortfolioSubmit = async (e) => {
    e.preventDefault()
    try {
      await createPortfolio(portfolioForm)
      setShowPortfolioForm(false)
      setPortfolioForm({ portfolioId: '', portfolioName: '' })
    } catch (error) {
      alert(`Error creating portfolio: ${error.message}`)
    }
  }

  if (!currentUser) {
    return (
      <div className="flex items-center space-x-2 text-gray-500">
        <User className="w-4 h-4" />
        <span>Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-4">
      {/* User Selector */}
      <div className="relative">
        <button
          onClick={() => setShowUserDropdown(!showUserDropdown)}
          className="flex items-center space-x-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-gray-700">{currentUser.name}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {showUserDropdown && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setShowUserDropdown(false)}
            />
            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-20">
              <div className="p-2">
                <div className="text-xs font-medium text-gray-500 mb-2">SELECT USER</div>
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      selectUser(user.id)
                      setShowUserDropdown(false)
                    }}
                    className={`w-full flex items-center justify-between p-2 text-left rounded hover:bg-gray-50 ${
                      currentUser.id === user.id ? 'bg-green-50 text-green-700' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4" />
                      <div>
                        <div className="text-sm font-medium">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </div>
                    {currentUser.id === user.id && (
                      <Check className="w-4 h-4 text-green-600" />
                    )}
                  </button>
                ))}
                
                <div className="border-t border-gray-200 mt-2 pt-2">
                  <button
                    onClick={() => {
                      setShowUserForm(true)
                      setShowUserDropdown(false)
                    }}
                    className="w-full flex items-center space-x-2 p-2 text-sm text-green-600 hover:bg-green-50 rounded"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New User</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Portfolio Selector */}
      {currentUser.portfolios && currentUser.portfolios.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowPortfolioDropdown(!showPortfolioDropdown)}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <Building2 className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700">
              {currentPortfolio?.portfolioName || 'Select Portfolio'}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {showPortfolioDropdown && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowPortfolioDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 mb-2">SELECT PORTFOLIO</div>
                  {currentUser.portfolios.map((portfolio) => (
                    <button
                      key={portfolio.portfolioId}
                      onClick={() => {
                        selectPortfolio(portfolio.portfolioId)
                        setShowPortfolioDropdown(false)
                      }}
                      className={`w-full flex items-center justify-between p-2 text-left rounded hover:bg-gray-50 ${
                        currentPortfolio?.portfolioId === portfolio.portfolioId ? 'bg-green-50 text-green-700' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4" />
                        <div>
                          <div className="text-sm font-medium">{portfolio.portfolioName}</div>
                          <div className="text-xs text-gray-500">
                            {portfolio.assetCount} assets
                          </div>
                        </div>
                      </div>
                      {currentPortfolio?.portfolioId === portfolio.portfolioId && (
                        <Check className="w-4 h-4 text-green-600" />
                      )}
                    </button>
                  ))}
                  
                  <div className="border-t border-gray-200 mt-2 pt-2">
                    <button
                      onClick={() => {
                        setShowPortfolioForm(true)
                        setShowPortfolioDropdown(false)
                      }}
                      className="w-full flex items-center space-x-2 p-2 text-sm text-green-600 hover:bg-green-50 rounded"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Portfolio</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* User Creation Form */}
      {showUserForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New User</h3>
              <button
                onClick={() => setShowUserForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={userForm.company}
                  onChange={(e) => setUserForm({...userForm, company: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="analyst">Analyst</option>
                </select>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUserForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Portfolio Creation Form */}
      {showPortfolioForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Portfolio</h3>
              <button
                onClick={() => setShowPortfolioForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handlePortfolioSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio ID</label>
                <input
                  type="text"
                  value={portfolioForm.portfolioId}
                  onChange={(e) => setPortfolioForm({...portfolioForm, portfolioId: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="e.g. renewable-2025"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio Name</label>
                <input
                  type="text"
                  value={portfolioForm.portfolioName}
                  onChange={(e) => setPortfolioForm({...portfolioForm, portfolioName: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="e.g. Renewable Energy Portfolio 2025"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPortfolioForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Create Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}