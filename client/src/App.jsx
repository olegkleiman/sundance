import React from 'react';
import { Route, Routes } from 'react-router-dom';
import SignIn from './components/SignIn';
import Site from './components/Site';
import ProtectedRoute from './components/ProtectedRoute';

const App = (props) => {
    return (
        <Routes>
            <Route path='/' element={<SignIn />} />
            <Route path="/site" element={
                <ProtectedRoute>
                    <Site />
                </ProtectedRoute>
            } />
        </Routes>   
    );
};

export default App;