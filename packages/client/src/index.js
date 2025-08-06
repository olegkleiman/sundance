import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// import './index.css';

import App from './App.jsx';

const container = document.getElementById('root');
const root = createRoot(container);
import { AuthProvider } from './context/AuthContext';

root.render(
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
                <App />
            </AuthProvider>
        </BrowserRouter>
);
