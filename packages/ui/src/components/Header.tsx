import React, { useState, useRef, useEffect } from "react";
import { BookOpen, Home } from "lucide-react";
import { RiLoginCircleFill } from "react-icons/ri";
import { FaGithub } from "react-icons/fa";

const Header = () => {
  const [showLogin, setShowLogin] = useState(false);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login submitted');
    
    // Get form data
    const formData = new FormData(formRef.current || undefined);
    const data = {
      userId: formData.get('citizenId'),
      phoneNumber: formData.get('phoneNumber'),
      clientId: "83f54a45-6065-4a91-975b-447a3afc570e",
    };

    try {
      const response = await fetch('https://apimtlvppr.tel-aviv.gov.il/sso/request_otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include' // Important for cookies if using session-based auth
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const result = await response.json();
      console.log('Login successful:', result);
      setShowLogin(false);
      
      // Store the token if using JWT
      if (result.token) {
        localStorage.setItem('token', result.token);
      }

    } catch (error) {
      console.error('Login error:', error);
    }
  };

  console.log('Rendering form, showLogin:', showLogin);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-6 bg-none">
      {/* Login Section */}
      <div className="flex items-center relative" ref={loginRef}>
        <div 
          onClick={() => setShowLogin(!showLogin)}
          className="p-2 bg-[#468BFF] rounded-lg hover:bg-[#8FBCFA] transition-colors cursor-pointer shadow-md"
        >
          <RiLoginCircleFill className="text-white h-6 w-6" />
        </div>

        {showLogin && (
          <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl overflow-hidden z-50">
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Sign in (2FA)</h3>
              <form 
                ref={formRef}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <input 
                  name="citizenId"
                  type="text" 
                  placeholder="Citizen ID"
                  defaultValue="313069486"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  required
                />
                <input 
                  name="phoneNumber"
                  type="tel" 
                  placeholder="Phone Number"
                  defaultValue="0543307026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  required
                />
                <button 
                  type="submit"
                  className="w-full bg-[#468BFF] text-white py-2 px-4 rounded-md hover:bg-[#8FBCFA] transition-colors"
                >
                  Send OTP
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