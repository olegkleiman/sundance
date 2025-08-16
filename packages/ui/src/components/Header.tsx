import React, { useState, useRef, useEffect, useCallback } from "react";
import { BookOpen, Home } from "lucide-react";
import { RiLoginCircleFill } from "react-icons/ri";
import { FaGithub } from "react-icons/fa";
import { useAuth } from "../context/AuthContext.jsx";
import Cookies from "js-cookie";

const Header = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const homeButtonRef = useRef<HTMLAnchorElement>(null);

  // Safely get auth context
  const auth = useAuth();

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd/Ctrl + H for Home
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      homeButtonRef.current?.click(); 
    }
  }, []);

  useEffect(() => {
    // Add keyboard event listener
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

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
    console.log('Access token read from cookies:', accessToken);

    if( accessToken) {
      // TODO: Validate stored JWT
      // const validationUrl = 'https://apimtlvppr.tel-aviv.gov.il/sso/validate_token'
      // const response = await fetch(validationUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${accessToken}`
      //   }
      // });
      auth.login(accessToken);
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

      auth.login(result.access_token);
      setShowLogin(false);
      setShowUserMenu(false);

    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = (e: React.FormEvent) => {
    e.preventDefault();
    Cookies.remove('access_token');
    auth.logout();
  };

  console.log('Rendering form, showLogin:', showLogin);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-6 bg-none">
      {/* Login Section */}
      <div className="flex items-center relative" ref={loginRef}>
        {!auth.isAuthenticated && <div 
            onClick={() => setShowLogin(!showLogin)}
            className="p-2 bg-[#468BFF] rounded-lg transition-colors cursor-pointer shadow-md relative group"
          >
            <RiLoginCircleFill className="text-white h-6 w-6" />
            <span className={`invisible ${!showLogin && 'group-hover:visible opacity-0 group-hover:opacity-100'} transition-opacity absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 text-sm bg-white rounded whitespace-nowrap border border-gray-200`}>
              Log In
            </span>
          </div>
        }
        { auth.isAuthenticated && (
          <div 
            className="relative"
            onMouseEnter={() => setShowUserMenu(true)}
            onMouseLeave={() => setShowUserMenu(false)}
          >
            <div className="p-2 bg-[#468BFF] rounded-lg hover:bg-[#8FBCFA] transition-colors cursor-pointer shadow-md">
              <div className="text-white h-6 underline-offset-2 hover:underline">Hello {auth.userName()}</div>
            </div>
            {showUserMenu && (
              <div className="absolute left-0 mt-1 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                <a
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={(e) => {
                    e.preventDefault();
                    // Handle profile click
                  }}
                >
                  Profile
                </a>
                <a
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={handleLogout}
                >
                  Log Out
                </a>
              </div>
            )}
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
          ref={homeButtonRef}
          href={`${import.meta.env.VITE_BACKEND_URL.replace('api', '')}`}
          rel="noopener noreferrer"
          aria-label="Home (⌘H or Ctrl+H)"
          className="relative group"
          title="⌘H or Ctrl+H"
        >
          <div className="p-2 bg-[#468BFF] rounded-lg transition-colors cursor-pointer shadow-md">
            <Home className="text-white h-6 w-6" />
            <span className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 text-sm bg-white text-gray-800 rounded whitespace-nowrap border border-gray-200">
Home (⌘H or Ctrl+H)
            </span>
          </div>
        </a>
        <a
          href="https://github.com/olegkleiman/sundance"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub Repository"
          className="relative group"
        >
          <div className="p-2 bg-black rounded-lg transition-colors cursor-pointer shadow-md">
            <FaGithub className="text-white h-6 w-6" />
            <span className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 text-sm bg-white text-gray-800 rounded whitespace-nowrap border border-gray-200">
              GitHub Repository
            </span>
          </div>
        </a>
        <a
          href={`${import.meta.env.VITE_BACKEND_URL.replace('api', 'api-docs')}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="API Documentation"
          className="relative group"
        >
          <div className="p-2 bg-[#FDBB11] rounded-lg transition-colors cursor-pointer shadow-md">
            <BookOpen className="text-white h-6 w-6" />
            <span className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 text-sm bg-white text-gray-800 rounded whitespace-nowrap border border-gray-200">
              API Documentation
            </span>
          </div>
        </a>
      </div>
    </div>
  );
};

export default Header;