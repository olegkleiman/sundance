import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import config from '../config/config';
import { useAuth } from '../context/AuthContext';

const SignIn = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [phoneNumber, setPhoneNumber] = useState('313069486');
    const [otp, setOtp] = useState('');   
    const [phoneTouched, setPhoneTouched] = useState(false);
    const [otpTouched, setOtpTouched] = useState(false);
    const [phoneError, setPhoneError] = useState('');
    const [otpError, setOtpError] = useState('');

    const handleLogin = async () => {
        setPhoneTouched(true);
        setOtpTouched(true);
        let hasError = false;
        if (!phoneNumber.trim()) {
            setPhoneError('ID Number is required');
            hasError = true;
        } else {
            setPhoneError('');
        }
        if (!otp.trim()) {
            setOtpError('OTP is required');
            hasError = true;
        } else {
            setOtpError('');
        }
        if (hasError) return;
        try {
            const response = await fetch(config.ENDPOINTS.LOGIN, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phoneNumber,
                    otp,
                }),
            });
            const data = await response.json();
            if (response.ok) {
                // Handle successful login: set auth and redirect to Site
                console.log('Login succeeded.', data);
                login(data.access_token);
                navigate('/chat');
            } else {
                // Handle login error
                console.error('Login failed', data);
                alert(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Network error', error);
            alert('Network error');
        }
    };


    return (
        <div className="signin-container">
            <div className="signin-title">SunDance</div>
            <label htmlFor="phoneNumber" className="signin-label">ID Number: <span style={{color: 'red'}}>*</span></label>
            <input
                id="phoneNumber"
                className={`signin-input${phoneTouched && !phoneNumber.trim() ? ' signin-input-error' : ''}`}
                type="text"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                onBlur={() => setPhoneTouched(true)}
                placeholder="ID Number"
                required
                aria-required="true"
                aria-invalid={phoneTouched && !phoneNumber.trim()}
            />
            {phoneTouched && !phoneNumber.trim() && (
                <div style={{ color: 'red', fontSize: '0.95em', marginBottom: 10 }}>{phoneError || 'ID Number is required'}</div>
            )}
            <label htmlFor="otp" className="signin-label">OTP: <span style={{color: 'red'}}>*</span></label>
            <input
                id="otp"
                className={`signin-input${otpTouched && !otp.trim() ? ' signin-input-error' : ''}`}
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                onBlur={() => setOtpTouched(true)}
                placeholder="OTP"
                autoComplete="one-time-code"
                required
                aria-required="true"
                aria-invalid={otpTouched && !otp.trim()}
            />
            {otpTouched && !otp.trim() && (
                <div style={{ color: 'red', fontSize: '0.95em', marginBottom: 10 }}>{otpError || 'OTP is required'}</div>
            )}
            <button className="signin-button" onClick={handleLogin}>Log In</button>
        </div>
    );
};

export default SignIn;