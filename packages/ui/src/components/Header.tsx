import React, { useState, useRef, useEffect } from "react";
import { BookOpen, Home } from "lucide-react";
import { RiLoginCircleFill } from "react-icons/ri";
import { FaGithub } from "react-icons/fa";
import Cookies from "js-cookie";
import { jwtDecode, JwtPayload } from "jwt-decode";

interface CustomJwtPayload extends JwtPayload {
  name?: string;
  // Add other custom claims here if needed
}

const Header = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userName, setUserName] = useState<string | undefined>(undefined);

  const loginRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Close the login popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (loginRef.current && !loginRef.current.contains(event.target as Node)) {
        setShowLogin(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const accessToken = Cookies.get('access_token');
    console.log('Access token:', accessToken);
    if( accessToken) {
      const decodedJwt = jwtDecode<CustomJwtPayload>(accessToken);
      console.log('Decoded JWT:', decodedJwt);

      // Parse claims
      const userName = decodedJwt.name;
      setUserName(userName);
      console.log('User name:', userName);

      // TODO: Validate stored JWT

      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Get form data
    const formData = new FormData(formRef.current || undefined);
    const data = {
      otp: formData.get('otp'),
      phoneNumber: formData.get('phoneNumber'),
    };

    try {
      const login_url = `${import.meta.env.VITE_BACKEND_URL}/auth/login`
      console.log('Login URL:', login_url);
      const response = await fetch(login_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include' // Important for cookies if using session-based auth
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Login failed');
      }

      const result = await response.json();
      console.log('Login successful:', result);

      setShowLogin(false);

    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  console.log('Rendering form, showLogin:', showLogin);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-6 bg-none">
      {/* Login Section */}
      <div className="flex items-center relative" ref={loginRef}>
        {!isAuthenticated && <div 
            onClick={() => setShowLogin(!showLogin)}
            className="p-2 bg-[#468BFF] rounded-lg hover:bg-[#8FBCFA] transition-colors cursor-pointer shadow-md"
          >
            <RiLoginCircleFill className="text-white h-6 w-6" />
          </div>
        }
        { isAuthenticated && (
          <div className="p-2 bg-[#468BFF] rounded-lg hover:bg-[#8FBCFA] transition-colors cursor-pointer shadow-md">
            <div className="text-white h-6">Hello {userName}</div>
          </div>
        )}

        {showLogin && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl overflow-hidden z-50">
            <div className="p-4">
            {error && (
              <div className="mb-4 p-2 bg-red-100 text-red-700 text-sm rounded">
                {error}
              </div>
            )}              
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Sign in (2FA)</h3>
              <form 
                ref={formRef}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <input 
                  name="otp"
                  type="text" 
                  placeholder="OTP"
                  defaultValue="777"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  required
                  disabled={isLoading}
                />
                <input 
                  name="phoneNumber"
                  type="tel" 
                  placeholder="Phone Number"
                  defaultValue="0543307026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  required
                  disabled={isLoading}
                />
                <button 
                  type="submit"
                  disabled={isLoading}
                  className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                    isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                  }`}                >
                  {isLoading ? 'Logging in...' : 'Send OTP'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Rest of your header */}
      <div className="flex space-x-4">
        {/* Your existing icons */}
        <a
          href="https://app.tavily.com/home"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Home"
        >
          <div className="p-2 bg-[#468BFF] rounded-lg hover:bg-[#8FBCFA] transition-colors cursor-pointer shadow-md">
            <Home className="text-white h-6 w-6" />
          </div>
        </a>
        <a
          href="https://github.com/olegkleiman/sundance"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub Repository"
        >
          <div className="p-2 bg-[#FE363B] rounded-lg hover:bg-[#FF9A9D] transition-colors cursor-pointer shadow-md">
            <FaGithub className="text-white h-6 w-6" />
          </div>
        </a>
        <a
          href="https://docs.tavily.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Documentation"
        >
          <div className="p-2 bg-[#FDBB11] rounded-lg hover:bg-[#F6D785] transition-colors cursor-pointer shadow-md">
            <BookOpen className="text-white h-6 w-6" />
          </div>
        </a>
      </div>
    </div>
  );
};

export default Header;