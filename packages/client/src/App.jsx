import React from 'react';
import { Route, Routes } from 'react-router-dom';
import SignIn from './components/SignIn';
import Chat from './components/Chat';
import ProtectedRoute from './components/ProtectedRoute';

const App = (props) => {
    return (
        <Routes>
            <Route path='/' element={<SignIn />} />
            <Route path="/site" element={
                <ProtectedRoute>
                    <Chat />
                </ProtectedRoute>
            } />
        </Routes>   
    );
};

export default App;