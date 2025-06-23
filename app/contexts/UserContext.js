'use client'

import { createContext, useContext, useState, useMemo, useEffect } from 'react';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPortfolio, setCurrentPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);

  // Default values
  const defaultUserId = '6853b044dd2ecce8ba519ba5';
  const defaultPortfolioId = 'zebre';

  // Fetch all users on initial load
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          setUsers(data);

          // Try to restore from localStorage first
          const savedUserId = localStorage.getItem('selectedUserId');
          const savedPortfolioId = localStorage.getItem('selectedPortfolioId');

          let targetUserId = savedUserId || defaultUserId;
          let targetPortfolioId = savedPortfolioId || defaultPortfolioId;

          // Find the target user
          const targetUser = data.find(user => user.id === targetUserId);
          
          if (targetUser) {
            // Refresh user data to get current portfolio info
            await selectUser(targetUserId, targetPortfolioId);
          } else if (data.length > 0) {
            // Fallback to the first user if target not found
            await selectUser(data[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Function to select a user by ID and optionally a specific portfolio
  const selectUser = async (userId, preferredPortfolioId = null) => {
    try {
      const response = await fetch(`/api/users?userId=${userId}`);
      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData);
        
        // Update users list with fresh data
        setUsers(prev => prev.map(user => 
          user.id === userId ? userData : user
        ));
        
        // Save to localStorage
        localStorage.setItem('selectedUserId', userId);
        
        // Select portfolio
        if (userData.portfolios && userData.portfolios.length > 0) {
          let portfolioToSelect = null;
          
          if (preferredPortfolioId) {
            portfolioToSelect = userData.portfolios.find(p => p.portfolioId === preferredPortfolioId);
          }
          
          if (!portfolioToSelect) {
            // Fallback to default or first portfolio
            portfolioToSelect = userData.portfolios.find(p => p.portfolioId === defaultPortfolioId) || userData.portfolios[0];
          }
          
          setCurrentPortfolio(portfolioToSelect);
          if (portfolioToSelect) {
            localStorage.setItem('selectedPortfolioId', portfolioToSelect.portfolioId);
          }
        } else {
          setCurrentPortfolio(null);
          localStorage.removeItem('selectedPortfolioId');
        }
      }
    } catch (error) {
      console.error('Failed to select user:', error);
    }
  };

  // Function to select a portfolio by ID
  const selectPortfolio = (portfolioId) => {
    if (currentUser && currentUser.portfolios) {
      const portfolio = currentUser.portfolios.find(p => p.portfolioId === portfolioId);
      if (portfolio) {
        setCurrentPortfolio(portfolio);
        localStorage.setItem('selectedPortfolioId', portfolioId);
      }
    }
  };

  // Function to refresh current user's portfolio data
  const refreshUserPortfolios = async () => {
    if (currentUser) {
      await selectUser(currentUser.id, currentPortfolio?.portfolioId);
    }
  };

  // Function to create a new user
  const createUser = async (userData) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        const newUser = await response.json();
        setUsers(prev => [...prev, newUser]);
        setCurrentUser(newUser);
        
        // Set the default portfolio if created
        if (newUser.portfolios && newUser.portfolios.length > 0) {
          setCurrentPortfolio(newUser.portfolios[0]);
          localStorage.setItem('selectedUserId', newUser.id);
          localStorage.setItem('selectedPortfolioId', newUser.portfolios[0].portfolioId);
        }
        
        return newUser;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  };

  // Function to create a new portfolio
  const createPortfolio = async (portfolioData) => {
    if (!currentUser) {
      throw new Error('No user selected');
    }

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
      };

      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(portfolioPayload),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Refresh user data to get updated portfolios list
        await refreshUserPortfolios();
        
        return result;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create portfolio');
      }
    } catch (error) {
      console.error('Failed to create portfolio:', error);
      throw error;
    }
  };

  // Memoize the context value
  const value = useMemo(() => ({
    users,
    currentUser,
    setCurrentUser,
    currentPortfolio,
    setCurrentPortfolio,
    selectUser,
    selectPortfolio,
    createUser,
    createPortfolio,
    refreshUserPortfolios,
    loading
  }), [users, currentUser, currentPortfolio, loading]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};