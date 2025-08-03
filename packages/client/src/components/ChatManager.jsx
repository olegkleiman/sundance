// 
// ChatManager.ts
// Sundance project, client side
//
// Created by: Oleg Kleiman on 30/07/2025
// 

import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from "../context/AuthContext.jsx";
import config from '../config/config.js';

const ChatManager = ({ lastMessage }) => {
    const tickerRef = useRef(null);
    const [error, setError] = useState(null);
    const [responseContent, setResponseContent] = useState('');

    // Safely get auth context
    const auth = useAuth();
    
    if (!auth) {
        return <div>Authentication not available. Please check your setup.</div>;
    }

    const { getToken } = auth;

    const initConversation = async (transcript) => {
        try {
            const access_token = getToken();
            if (!access_token) {
                throw new Error('No access token available');
            }        

            console.log(`Fetching from ${config.ENDPOINTS.INIT}`);

            const response = await fetch(config.ENDPOINTS.INIT, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${access_token}`
                },
                body: JSON.stringify({
                    data: transcript
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
        
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error initializing conversation:', error);
            setError(error.message);
            throw error; // Re-throw to be caught by the caller
        }
    }

    const completeConversation = async () => { 
        try {
            let position = window.innerWidth;
            let animationId = null;

            const eventSource = new EventSource(config.ENDPOINTS.COMPLETION, {
                withCredentials: true
            });
            
            eventSource.onmessage = (event) => {
                setResponseContent(prev => prev + event.data);
            };
            
            eventSource.onerror = (error) => {
                console.error('EventSource error:', error);
                eventSource.close();
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
                setError('Error receiving streaming response');
            };
            
            eventSource.addEventListener('end', () => {
                eventSource.close();
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            });

            const animate = () => {
                if (!tickerRef.current) return;
                
                position -= 1; // speed (px/frame)
                tickerRef.current.style.left = position + 'px';
      
                // Reset position when completely out of view
                if (tickerRef.current.getBoundingClientRect().right < 0) {
                    position = window.innerWidth;
                }
      
                animationId = requestAnimationFrame(animate);
            };      
      
            animate();

            // Cleanup function
            return () => {
                eventSource.close();
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            };
        } catch (error) {
            console.error('Error in completeConversation:', error);
            setError(error.message);
        }
    }

    const fetchData = async () => {
        if (!lastMessage) return;
        
        setError(null);
        setResponseContent('');
        
        try {
            const data = await initConversation(lastMessage);
            console.log('Conversation initialized:', data);
            
            // Start the completion stream
            const cleanup = await completeConversation();
            
            // Return cleanup function
            return cleanup;
        } catch (error) {
            console.error('Error in fetchData:', error);
            setError(error.message || 'An error occurred while processing your request');
        }
    }

    useEffect( () => { 

        fetchData();    

    }, [lastMessage])

    if (error) {
        return (
            <div className="error-message">
                <p>Error: {error}</p>
                <button onClick={() => setError(null)}>Dismiss</button>
            </div>
        );
    }

    return (
        <div className="chat-manager">
            {lastMessage && (
                <div className="user-message">
                    <strong>You:</strong> {lastMessage}
                </div>
            )}
            <div className="ticker-container">
                <div className="ticker" ref={tickerRef}>
                    {responseContent || 'Waiting for your input...'}
                </div>
            </div>
        </div>
    );
};

export default ChatManager;
