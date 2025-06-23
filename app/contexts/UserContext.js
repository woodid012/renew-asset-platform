'use client'

import { createContext, useContext, useState, useMemo, useEffect } from 'react';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPortfolio, setCurrentPortfolio] = useState(null);

  // Default values
  const defaultUserId = '6853b044dd2ecce8ba519ba5';
  const defaultPortfolioId = 'zebre';

  // Fetch all users on initial load
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          setUsers(data);

          // Set the default user and portfolio
          const defaultUser = data.find(user => user.id === defaultUserId);
          if (defaultUser) {
            setCurrentUser(defaultUser);
            const defaultPortfolio = defaultUser.portfolios.find(p => p.portfolioId === defaultPortfolioId);
            if (defaultPortfolio) {
              setCurrentPortfolio(defaultPortfolio);
            } else if (defaultUser.portfolios.length > 0) {
              // Fallback to the first portfolio if the default is not found
              setCurrentPortfolio(defaultUser.portfolios[0]);
            }
          } else if (data.length > 0) {
            // Fallback to the first user if the default is not found
            setCurrentUser(data[0]);
            if (data[0].portfolios.length > 0) {
              setCurrentPortfolio(data[0].portfolios[0]);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    fetchUsers();
  }, []);

  // Update portfolio when user changes
  useEffect(() => {
    if (currentUser && currentUser.portfolios.length > 0) {
        // If the current portfolio doesn't belong to the new user, update it
        if (!currentUser.portfolios.some(p => p.portfolioId === currentPortfolio?.portfolioId)) {
            setCurrentPortfolio(currentUser.portfolios[0]);
        }
    } else {
      setCurrentPortfolio(null);
    }
  }, [currentUser, currentPortfolio]);

  // Function to select a user by ID
  const selectUser = async (userId) => {
    try {
      const response = await fetch(`/api/users?userId=${userId}`);
      if (response.ok) {
        const userData = await response.json();
        setCurrentUser(userData);
        
        // Update users list
        setUsers(prev => prev.map(user => 
          user.id === userId ? userData : user
        ));
        
        // Set first portfolio as default
        if (userData.portfolios && userData.portfolios.length > 0) {
          setCurrentPortfolio(userData.portfolios[0]);
        } else {
          setCurrentPortfolio(null);
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
      }
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
        
        // Update current user's portfolios
        const newPortfolio = {
          portfolioId: portfolioData.portfolioId,
          portfolioName: portfolioData.portfolioName,
          lastUpdated: new Date().toISOString(),
          assetCount: 0
        };
        
        const updatedUser = {
          ...currentUser,
          portfolios: [...currentUser.portfolios, newPortfolio]
        };
        
        setCurrentUser(updatedUser);
        setCurrentPortfolio(newPortfolio);
        
        // Update users list
        setUsers(prev => prev.map(user => 
          user.id === currentUser.id ? updatedUser : user
        ));
        
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
    createPortfolio
  }), [users, currentUser, currentPortfolio]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};