import React, { useRef, useEffect, useState } from 'react';

const ChatManager = ({ lastMessage }) => {

    
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

    const fetchData = async () => {
        if (!lastMessage) return;

        try {
            const data = await initConversation(lastMessage);
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

    }, [lastMessage])

    return (
        <div>
            <h1>ChatManager</h1>
            <div>{lastMessage}</div>
        </div>
    );
};

export default ChatManager;
