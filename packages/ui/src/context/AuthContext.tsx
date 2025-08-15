import { createContext, useContext, useState, ReactNode } from 'react';
import { jwtDecode, JwtPayload } from "jwt-decode";

interface CustomJwtPayload extends JwtPayload {
  name?: string;
  // Add other custom claims here if needed
}

interface AuthContextType {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  getToken: () => string | null;
  userName: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [token, setToken] = useState<string | null>(null)

    const login = (token: string) => {
        setIsAuthenticated(true);
        setToken(token);
    }
    const logout = () => {
        setIsAuthenticated(false);
        setToken(null);
    }
    
    const getToken = (): string | null => token;

    const userName = (): string | null => {
        if (!token) return null;

        const decodedJwt = jwtDecode<CustomJwtPayload>(token);
        return decodedJwt.name || null;
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout, getToken, userName }}>
            {children}
        </AuthContext.Provider>
    );
};
