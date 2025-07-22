import React, { useRef, useEffect, useState } from 'react';
import { Routes, Route, useMatch, useNavigate } from 'react-router-dom';
import { Button } from "react-bootstrap";   
import AudioEngine from "../audioEngine.js";
import { useAuth } from "../context/AuthContext";

const Site = () => {

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

            const response = await fetch('http://localhost:8099/init', {
                method: 'POST',
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

        console.log('Fetching from Sundace server');

        fetchData();    

    }, [hasRecognitionResult])

    function completeConversation() { 

        let position = window.innerWidth;

        const eventSource = new EventSource("http://localhost:8099/completion");
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

    return (<>
        <div>{state}</div>
        <button onClick={() => recognitionRef.current.startRecognition()}
            id="startBtn" className="start-button circle-btn" aria-label="Start Speaking">
        <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" fill="none"/>
          <rect x="9" y="4" width="6" height="10" rx="3" fill="#fff"/>
          <rect x="11" y="16" width="2" height="3" rx="1" fill="#fff"/>
          <path d="M7 11v1a5 5 0 0 0 10 0v-1" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      <div id="ticker-container">
        <div id="ticker">{responseContent}</div>
      </div>
    </>);
};

export default Site;
