// 
// SearchManager.ts
// Sundance project, client side
//
// Created by: Oleg Kleiman on 30/07/2025
// 

import React, { useRef, useEffect, useState } from 'react';
import config from '../config/config.js';

import './SearchManager.css';

const SearchManager = ({ searchText }) => {

    const [data, setData] = useState([]);

    const fetchData = async () => {
        if (!searchText) return;

        try {

            console.log(`Fetching from ${config.ENDPOINTS.SEARCH}`);

            const response = await fetch(config.ENDPOINTS.SEARCH, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: searchText
                })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
        
            setData(await response.json());
            
        } catch (error) {
            console.error(error);
        }

    }

    useEffect( () => { 

        fetchData();    

    }, [searchText])

    return (
        <div className="searchContainer">
            <h2 className="searchTitle">תוצאות חיפוש</h2>
            {searchText && <p className="searchQuery">הנושא: {searchText}</p>}
            {data.length > 0 ? (
                    data.map((doc, index) => (
                        <React.Fragment key={index}>
                            <div className="mx-auto flex max-w-sm items-center gap-x-4 rounded-xl bg-white p-5 shadow-lg outline outline-black/5 dark:bg-slate-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10">
                                <div>
                                    <div className="text-xl font-medium text-black dark:text-white">{doc.text}</div>
                                    <p className="text-gray-500 dark:text-gray-400">{doc.score}</p>
                                    {doc.url && (
                                    <div>
                                        <a href={doc.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer">
                                            {doc.url}
                                        </a>
                                    </div>
                                )}                                    
                                </div>
                            </div>                              
                            {index < data.length - 1 && <div className="dividerStyle" />}
                        </React.Fragment>
                    ))
                ) : (
                    <div className="noResults">לא נמצאו תוצאות</div>
                )}
        </div>
    );
}

export default React.memo(SearchManager);