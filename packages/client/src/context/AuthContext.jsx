import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [token, setToken] = useState(null)

    const login = (token) => {
        setIsAuthenticated(true);
        setToken(token);
    }
    const logout = () => setIsAuthenticated(false);
    const getToken = () => token;

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout, getToken}}>
            {children}
        </AuthContext.Provider>
    );
};
