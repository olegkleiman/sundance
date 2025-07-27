import React from 'react';
import { Route, Routes } from 'react-router-dom';
import SignIn from './components/SignIn';
import VoiceChat from './components/VoiceChat';
import ProtectedRoute from './components/ProtectedRoute';

const App = (props) => {
    return (
        <Routes>
            <Route path='/' element={<SignIn />} />
            <Route path="/chat" element={
                <ProtectedRoute>
                    <VoiceChat />
                </ProtectedRoute>
            } />
        </Routes>   
    );
};

export default App;