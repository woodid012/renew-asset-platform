'use client'

import { createContext, useContext, useState, useEffect } from 'react'

const UserContext = createContext()

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentPortfolio, setCurrentPortfolio] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  // Load users on mount
  useEffect(() => {
    loadUsers()
  }, [])

  // Load saved user from localStorage on mount
  useEffect(() => {
    const savedUserId = localStorage.getItem('selectedUserId')
    const savedPortfolioId = localStorage.getItem('selectedPortfolioId')
    
    if (savedUserId && users.length > 0) {
      const user = users.find(u => u.id === savedUserId)
      if (user) {
        setCurrentUser(user)
        
        if (savedPortfolioId && user.portfolios) {
          const portfolio = user.portfolios.find(p => p.portfolioId === savedPortfolioId)
          if (portfolio) {
            setCurrentPortfolio(portfolio)
          } else if (user.portfolios.length > 0) {
            setCurrentPortfolio(user.portfolios[0])
          }
        } else if (user.portfolios && user.portfolios.length > 0) {
          setCurrentPortfolio(user.portfolios[0])
        }
      }
    }
  }, [users])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (response.ok) {
        const userData = await response.json()
        setUsers(userData)
        
        // If no current user and we have users, select first one
        if (!currentUser && userData.length > 0) {
          await selectUser(userData[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectUser = async (userId) => {
    try {
      const response = await fetch(`/api/users?userId=${userId}`)
      if (response.ok) {
        const userData = await response.json()
        setCurrentUser(userData)
        
        // Save to localStorage
        localStorage.setItem('selectedUserId', userId)
        
        // Select default portfolio
        if (userData.portfolios && userData.portfolios.length > 0) {
          const defaultPortfolio = userData.portfolios.find(p => p.portfolioId === userData.defaultPortfolio) 
                                  || userData.portfolios[0]
          setCurrentPortfolio(defaultPortfolio)
          localStorage.setItem('selectedPortfolioId', defaultPortfolio.portfolioId)
        }
        
        // Update users list with fresh data
        await loadUsers()
      }
    } catch (error) {
      console.error('Error selecting user:', error)
    }
  }

  const selectPortfolio = (portfolioId) => {
    if (currentUser && currentUser.portfolios) {
      const portfolio = currentUser.portfolios.find(p => p.portfolioId === portfolioId)
      if (portfolio) {
        setCurrentPortfolio(portfolio)
        localStorage.setItem('selectedPortfolioId', portfolioId)
      }
    }
  }

  const createUser = async (userData) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })
      
      if (response.ok) {
        const newUser = await response.json()
        await loadUsers() // Refresh users list
        await selectUser(newUser.id) // Select the new user
        return newUser
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create user')
      }
    } catch (error) {
      console.error('Error creating user:', error)
      throw error
    }
  }

  const createPortfolio = async (portfolioData) => {
    try {
      const portfolioPayload = {
        userId: currentUser.id,
        portfolioId: portfolioData.portfolioId,
        portfolioName: portfolioData.portfolioName,
        version: '2.0',
        assets: {},
        constants: {},
        analysisMode: 'simple',
        priceSource: 'merchant_price_monthly.csv'
      }

      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(portfolioPayload),
      })
      
      if (response.ok) {
        // Refresh current user data to get updated portfolios
        await selectUser(currentUser.id)
        return true
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create portfolio')
      }
    } catch (error) {
      console.error('Error creating portfolio:', error)
      throw error
    }
  }

  const value = {
    currentUser,
    currentPortfolio,
    users,
    loading,
    selectUser,
    selectPortfolio,
    createUser,
    createPortfolio,
    loadUsers
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}