import React, { useRef, useEffect, useState } from 'react';
import { Routes, Route, useMatch, useNavigate } from 'react-router-dom';
import { Button } from "react-bootstrap";   
import AudioEngine from "../audioEngine.js";
import { useAuth } from "../context/AuthContext.jsx";
import config from '../config/config.js';

import './VoiceChat.css';

const VoiceChat = () => {

    const [state, setState] = useState('What can I help you with?');
    const [hasRecognitionResult, setHasRecognitionResult] = useState(false);
    const [content, setContent] = useState('');
    const [responseContent, setResponseContent] = useState('התשובות תופענה כאן');
    const [transcript, setTranscript] = useState('');

    const { getToken } = useAuth();

    const recognitionRef = useRef(null);

    function recogniztion_started() {
        setState("I'm listening...");
    }

    function recognition_ended() {
        setState("What can I help you with?");
    }

    const recornition_result = async (transcript) => {
        setTranscript(transcript);
        setHasRecognitionResult(true);
    }


    async function startConversationTurn(transcript, access_token) {
    }

    useEffect(() => {
        recognitionRef.current = new AudioEngine('he-IL', 
            recogniztion_started, 
            recognition_ended, 
            recornition_result);
    }, []); // called once after the initial render 

    useEffect( () => { 
        
        async function fetchData() {

            const access_token = getToken();

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
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
    
            completeConversation();

            setHasRecognitionResult(false);
        }

        console.log('Fetching from Sundance server');

        fetchData();    

    }, [hasRecognitionResult])

    function completeConversation() { 

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
            ticker.style.left = position + 'px';
  
            // Reset position when completely out of view
            if (ticker.getBoundingClientRect().right < 0) {
                position = window.innerWidth;
            }
  
            requestAnimationFrame(animate);
        }      
  
        animate()
    }
    
    return (
        <div className="chat-container">
            <div className="status">{state}</div>
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

            <div className="ticker-container">
                <div className="ticker" id="ticker">{responseContent}</div>
            </div>
        </div>
    );
};

export default VoiceChat;
