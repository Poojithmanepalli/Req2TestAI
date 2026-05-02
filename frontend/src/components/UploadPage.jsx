import React, { useState, useRef } from 'react';
import './UploadPage.css';

export default function UploadPage({ onResult }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [agentStep, setAgentStep] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') { setFile(dropped); setError(''); }
    else setError('Only PDF files are allowed.');
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected?.type === 'application/pdf') { setFile(selected); setError(''); }
    else setError('Only PDF files are allowed.');
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(0);
    setProgressMessage('Uploading PDF...');
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const res = await fetch(`${API}/upload`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');

      const { jobId } = json;

      await new Promise((resolve, reject) => {
        const eventSource = new EventSource(`${API}/events/${jobId}`);

        eventSource.onmessage = (e) => {
          const data = JSON.parse(e.data);
          if (data.type === 'progress') {
            setProgress(data.percent);
            setProgressMessage(data.message);
            if (data.step) setAgentStep(data.step);
          } else if (data.type === 'complete') {
            setProgress(100);
            setProgressMessage('Done!');
            eventSource.close();
            onResult(data.result);
            resolve();
          } else if (data.type === 'error') {
            eventSource.close();
            reject(new Error(data.message));
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          reject(new Error('Connection lost. Please try again.'));
        };
      });

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="upload-page">
      <div className="upload-card">
        <div className="upload-header">
          <div className="upload-logo-mark">R2T</div>
          <h1>Req<span>2</span>TestAI</h1>
          <p>Upload your SRS document and get AI-generated test cases in seconds</p>
        </div>

        <div
          className={`drop-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''} ${loading ? 'disabled' : ''}`}
          onDragOver={(e) => { if (!loading) { e.preventDefault(); setDragging(true); } }}
          onDragLeave={() => setDragging(false)}
          onDrop={!loading ? handleDrop : undefined}
          onClick={() => !loading && inputRef.current.click()}
        >
          <input ref={inputRef} type="file" accept=".pdf" hidden onChange={handleFileChange} />
          <div className="drop-icon">{file ? '✅' : '📄'}</div>
          {file ? (
            <div className="file-info">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{(file.size / 1024).toFixed(1)} KB · Ready to process</span>
            </div>
          ) : (
            <>
              <p className="drop-text">Drag & drop your SRS PDF here</p>
              <p className="drop-sub">or click to browse files</p>
            </>
          )}
        </div>

        {error && <div className="error-msg">⚠ {error}</div>}

        {loading ? (
          <div className="progress-container">
            <div className="progress-header">
              <span className="progress-label">{progressMessage}</span>
              <span className="progress-percent">{progress}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>

            {/* Agent Activity Panel */}
            {agentStep && (
              <div className="agent-activity-panel">
                <span className="agent-pulse" />
                <span className="agent-activity-label">
                  🤖 Agent →&nbsp;
                  {agentStep === 'extract'   && 'Extracting & deduplicating requirements'}
                  {agentStep === 'reextract' && 'Re-extracting with finer chunks (low coverage detected)'}
                  {agentStep === 'coverage'  && 'Analyzing coverage and identifying gaps'}
                  {agentStep === 'generate'  && 'Generating RAG-enhanced test cases'}
                  {agentStep === 'retry'     && 'Retrying weak test cases for better quality'}
                  {agentStep === 'compile'   && 'Compiling final report'}
                </span>
              </div>
            )}

            <div className="progress-steps">
              <div className={`progress-step ${progress >= 25 ? 'step-done' : progress >= 10 ? 'step-active' : ''}`}>
                <span className="step-icon">📄</span> Parsing document
              </div>
              <div className={`progress-step ${agentStep === 'coverage' || agentStep === 'generate' || agentStep === 'compile' || progress >= 55 ? 'step-done' : agentStep === 'extract' || progress >= 25 ? 'step-active' : ''}`}>
                <span className="step-icon">🧠</span> Extracting requirements
              </div>
              <div className={`progress-step ${agentStep === 'generate' || agentStep === 'compile' || progress >= 65 ? 'step-done' : agentStep === 'coverage' || progress >= 55 ? 'step-active' : ''}`}>
                <span className="step-icon">📊</span> Analyzing coverage
              </div>
              <div className={`progress-step ${agentStep === 'compile' || progress >= 90 ? 'step-done' : agentStep === 'generate' || progress >= 65 ? 'step-active' : ''}`}>
                <span className="step-icon">⚙️</span> Generating test cases
              </div>
            </div>
          </div>
        ) : (
          <button className="upload-btn" onClick={handleUpload} disabled={!file}>
            Generate Test Cases
          </button>
        )}

        {!loading && (
          <div className="report-includes">
            <p className="report-includes-title">Report includes:</p>
            <div className="report-includes-grid">
              <span className="report-chip">✔ Requirements</span>
              <span className="report-chip">✔ Test Cases</span>
              <span className="report-chip">✔ Coverage Score</span>
              <span className="report-chip">✔ Missing Requirements</span>
            </div>
          </div>
        )}

        <div className="upload-features">
          <span className="feature-chip"><span>🤖</span> GPT-4o-mini</span>
          <span className="feature-chip"><span>📋</span> Auto Classification</span>
          <span className="feature-chip"><span>⬇</span> Excel Export</span>
          <span className="feature-chip"><span>⚡</span> Real-time Progress</span>
        </div>
      </div>
    </div>
  );
}
