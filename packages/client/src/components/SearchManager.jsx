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
            <h2 className="searchTitle">Search Results</h2>
            {searchText && <p className="searchQuery">Search for: {searchText}</p>}
            <ul className="searchList">
                {data.length > 0 ? (
                    data.map((doc, index) => (
                        <React.Fragment key={index}>
                            <li className="listItemStyle">
                                <p>{doc.text}</p>
                                {doc.url && (
                                    <p>
                                        <a 
                                            href={doc.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                        >
                                            {doc.url}
                                        </a>
                                    </p>
                                )}
                            </li>
                            {index < data.length - 1 && <div className="dividerStyle" />}
                        </React.Fragment>
                    ))
                ) : (
                    <p className="noResults">No results found</p>
                )}
            </ul>
        </div>
    );
}

export default SearchManager;