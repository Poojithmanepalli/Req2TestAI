import React, { useState } from 'react';
import UploadPage from './components/UploadPage';
import ResultsPage from './components/ResultsPage';
import './App.css';

export default function App() {
  const [data, setData] = useState(null);

  return (
    <div className="app">
      {data ? (
        <ResultsPage data={data} onBack={() => setData(null)} />
      ) : (
        <UploadPage onResult={setData} />
      )}
    </div>
  );
}
