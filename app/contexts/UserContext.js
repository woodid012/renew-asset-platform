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


  // Memoize the context value
  const value = useMemo(() => ({
    users,
    currentUser,
    setCurrentUser,
    currentPortfolio,
    setCurrentPortfolio
  }), [users, currentUser, currentPortfolio]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};