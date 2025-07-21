
import React from 'react';
import { useOutletContext } from 'react-router-dom';
import Pyramid from './Pyramid';

function HomePage() {
    const { words, setWords, loading } = useOutletContext();

    return (
        <div className="home-page">
            <Pyramid words={words} setWords={setWords} loading={loading} />
        </div>
    );
}

export default HomePage;
