import React, { useRef, useEffect, useState } from 'react';
import { Routes, Route, useMatch, useNavigate } from 'react-router-dom';
import { Button } from "react-bootstrap";   
import AudioEngine from "../audioEngine.js";
import { useAuth } from "../context/AuthContext.jsx";
import config from '../config/config.js';

import './VoiceChat.css';

const VoiceChat = () => {

    const [content, setContent] = useState('');
    const [responseContent, setResponseContent] = useState('התשובות תופענה כאן');
    const [transcript, setTranscript] = useState('');
    const [utterance, setUtterance] = useState('');
    const [finishedUtterance, setFinishedUtterance] = useState('');
    const [conversationHistory, setConversationHistory] = useState([]);

    const { getToken } = useAuth();

    const recognitionRef = useRef(null);
    const tickerRef = useRef(null);

    function recogniztion_started() {
    }

    function recognition_ended() {
        recognitionRef.current.startRecognition();
    }

    const recornition_result = async (transcript) => {
        setTranscript(transcript);
        // setHasRecognitionResult(true);
    }

    useEffect( () => {
        recognitionRef.current = new AudioEngine('he-IL', 
            recogniztion_started, 
            recognition_ended, 
            recornition_result);
    }, []); // called once after the initial render 

    const fetchData = async () => {
        if (!transcript) return;

        try {
            const data = await initConversation(transcript);
            console.log(data);

            completeConversation();

            return () => {
                console.log('cleaning up');
            }
            
        } catch (error) {
            console.error(error);
        }

    }

    useEffect( () => { 

        fetchData();    

    }, [transcript])

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && utterance.trim()) {
            handleSendMessage();
        }
    };

    const handleSendMessage = () => {
        if (!utterance.trim()) return;
        
        // const newMessage = {
        //     id: Date.now(),
        //     text: utterance,
        //     sender: 'user',
        //     timestamp: new Date().toLocaleTimeString()
        // };
        
        // setConversationHistory(prev => [...prev, newMessage]);
        // setFinishedUtterance(utterance);
        setTranscript(utterance);
    };      

    const initConversation = async (transcript) => {

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
    
        return await response.json();
    }

    const completeConversation = async () => { 

        let position = window.innerWidth;

        const eventSource = new EventSource(config.ENDPOINTS.COMPLETION, {
            withCredentials: true
        });
        
        eventSource.onmessage = (event) => {
            setContent(content + event.data);
        };
        
        eventSource.addEventListener('end', () => {
            eventSource.close();
        });

        function animate() {
            position -= 1; // speed (px/frame)
            tickerRef.current.style.left = position + 'px';
  
            // Reset position when completely out of view
            if (tickerRef.current.getBoundingClientRect().right < 0) {
                position = window.innerWidth;
            }
  
            requestAnimationFrame(animate);
        }      
  
        animate()
    }
    
    return (
        <div className="chat-container">
            <button 
                onClick={() => recognitionRef.current.startRecognition()}
                id="startBtn" 
                className="button circle-btn"
                aria-label="Start Speaking"
                style={{ backgroundColor: 'white' }}
            >
                <svg 
                    className="mic-icon"
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24"
                    fill="none">
                    <path 
                        d="M12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2C10.34 2 9 3.34 9 5V11C9 12.66 10.34 14 12 14Z" 
                        fill="#4285F4"
                    />
                    <path 
                        d="M17 11C17 13.76 14.76 16 12 16C9.24 16 7 13.76 7 11H5C5 14.53 7.61 17.43 11 17.92V22H13V17.92C16.39 17.43 19 14.53 19 11H17Z" 
                        fill="#34A853"
                    />
                    <path 
                        d="M12 16C14.76 16 17 13.76 17 11H19C19 14.53 16.39 17.43 13 17.92V22H11V17.92C7.61 17.43 5 14.53 5 11H7C7 13.76 9.24 16 12 16Z" 
                        fill="#FBBC05"
                    />
                </svg>
            </button>

            <div className="input-container">
                <input
                    type="text"
                    id="utterance"
                    placeholder="איך אפשר לעזור לך?"
                    className="utterance-input"
                    value={utterance}
                    onChange={(e) => setUtterance(e.target.value)}
                    onKeyUp={handleKeyPress}
                />
                <button 
                    className="sendButtonStyle"
                    onClick={handleSendMessage}
                    disabled={!utterance.trim()}
                    aria-label="Send message"
                />
            </div>
            <div className="ticker-container">
                <div className="ticker" ref={tickerRef}>{responseContent}</div>
            </div>
        </div>
    );
};

export default VoiceChat;
