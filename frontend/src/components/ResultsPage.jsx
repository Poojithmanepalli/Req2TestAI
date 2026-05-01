import React, { useState } from 'react';
import ModuleCard from './ModuleCard';
import { exportToExcel } from '../utils/exportToExcel';
import './ResultsPage.css';

const StatCard = ({ icon, value, label, colorClass }) => (
  <div className="stat-card">
    <div className={`stat-icon-wrap ${colorClass}`}>{icon}</div>
    <div className="stat-card-body">
      <span className="stat-card-value">{value}</span>
      <span className="stat-card-label">{label}</span>
    </div>
  </div>
);

export default function ResultsPage({ data, onBack }) {
  const { stats, modules, processingTime, coverageScore, missingRequirements, similarRequirements = [], rtm = [] } = data;
  const [showMissing, setShowMissing] = useState(false);
  const [showSimilar, setShowSimilar] = useState(true);
  const [showRTM, setShowRTM] = useState(false);

  const rawScore = String(coverageScore || '0');
  const match = rawScore.match(/\d+/);
  const score = match ? Math.min(100, Math.max(0, parseInt(match[0]))) : 0;
  const scoreColor = score >= 75 ? '#059669' : score >= 55 ? '#D97706' : '#DC2626';
  const scoreLabel = score >= 75 ? 'Good Coverage' : score >= 55 ? 'Moderate Coverage' : 'Low Coverage';

  const totalTestCases = modules.reduce(
    (sum, m) => sum + m.items.reduce((s, i) => s + i.testCases.length, 0),
    0
  );

  return (
    <div className="results-page">

      {/* ── Top Navbar ── */}
      <div className="dash-navbar">
        <div className="dash-nav-left">
          <div className="dash-logo">
            <span className="dash-logo-mark">R2T</span>
            <span className="dash-logo-text">Req<b>2</b>TestAI</span>
          </div>
          <span className="dash-divider" />
          <span className="dash-nav-title">Analysis Report</span>
        </div>
        <div className="dash-nav-right">
          <span className="ai-badge">🤖 AI-Powered QA System</span>
          <button className="back-btn" onClick={onBack}>← New Upload</button>
          <button className="download-btn" onClick={() => exportToExcel(data)}>
            ⬇ Export Excel
          </button>
        </div>
      </div>

      <div className="dash-body">

        {/* ── Stat Cards ── */}
        <div className="stats-grid">
          <StatCard icon="📋" value={stats.total}       label="Requirements"      colorClass="ic-indigo" />
          <StatCard icon="⚙️" value={stats.functional}  label="Functional"        colorClass="ic-blue"   />
          <StatCard icon="🔒" value={stats.nonFunctional} label="Non-Functional"  colorClass="ic-purple" />
          <StatCard icon="🗂️" value={modules.length}    label="Modules"           colorClass="ic-teal"   />
          <StatCard icon="🧪" value={totalTestCases}    label="Test Cases"        colorClass="ic-green"  />
          <StatCard icon="⏱️" value={processingTime}    label="Processing Time"   colorClass="ic-gray"   />
        </div>

        {/* ── Coverage + Missing ── */}
        <div className="analysis-row">

          {/* Coverage Card */}
          <div className="coverage-card">
            <div className="coverage-card-top">
              <div>
                <p className="card-section-label">Requirement Coverage</p>
                <h3 className="coverage-score-big" style={{ color: scoreColor }}>{score}%</h3>
                <span className="coverage-badge" style={{ background: scoreColor + '1A', color: scoreColor }}>
                  {scoreLabel}
                </span>
              </div>
              <div className="coverage-donut-wrap">
                <svg viewBox="0 0 80 80" className="coverage-donut">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#E2E8F0" strokeWidth="10" />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke={scoreColor} strokeWidth="10"
                    strokeDasharray={`${score * 2.01} 201`}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                  />
                  <text x="40" y="45" textAnchor="middle" fontSize="16" fontWeight="800" fill={scoreColor}>{score}</text>
                </svg>
              </div>
            </div>
            <div className="coverage-bar-bg">
              <div className="coverage-bar-fill" style={{ width: `${score}%`, background: scoreColor }} />
            </div>
            <p className="system-analysis-text" style={{ color: scoreColor }}>
              {score > 80
                ? '✔ Well-defined SRS with strong requirement coverage.'
                : score > 50
                ? '⚠ Moderate coverage. Some requirements may be missing.'
                : '✘ Low coverage. SRS may be incomplete or unclear.'}
            </p>
            <p className="coverage-hint">AI estimate based on extracted requirements</p>
          </div>

          {/* Missing Requirements Card */}
          {missingRequirements && missingRequirements.length > 0 ? (
            <div className="missing-card">
              <div className="missing-card-header" onClick={() => setShowMissing(p => !p)}>
                <div className="missing-header-left">
                  <div className="missing-icon-wrap">⚠</div>
                  <div>
                    <p className="card-section-label">AI-Suggested Missing</p>
                    <h3 className="missing-count-text">{missingRequirements.length} Potential Gaps</h3>
                    <p className="missing-hint">Review before finalising your SRS</p>
                  </div>
                </div>
                <span className="missing-toggle-btn">{showMissing ? '▲ Hide' : '▼ Show'}</span>
              </div>

              {showMissing && (
                <div className="missing-list">
                  {missingRequirements.map((r, i) => (
                    <div key={i} className="missing-item">
                      <span className="missing-index">{i + 1}</span>
                      <span className="missing-text">{r.text || r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="coverage-card no-gaps-card">
              <div className="no-gaps-inner">
                <span className="no-gaps-icon">✅</span>
                <p className="card-section-label">Missing Requirements</p>
                <h3 className="no-gaps-title">No Gaps Detected</h3>
                <p className="coverage-hint">Your requirements appear comprehensive</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Similarity Warning ── */}
        {similarRequirements.length > 0 && (
          <div className="similarity-warning-card">
            <div className="similarity-header" onClick={() => setShowSimilar(p => !p)}>
              <div className="similarity-header-left">
                <span className="similarity-icon">⚠</span>
                <div>
                  <p className="card-section-label">Near-Duplicate Requirements Detected</p>
                  <h3 className="similarity-count-text">{similarRequirements.length} Similar Pair{similarRequirements.length !== 1 ? 's' : ''}</h3>
                  <p className="similarity-hint">These requirements overlap significantly — consider merging or clarifying them</p>
                </div>
              </div>
              <span className="missing-toggle-btn">{showSimilar ? '▲ Hide' : '▼ Show'}</span>
            </div>
            {showSimilar && (
              <div className="similarity-list">
                {similarRequirements.map((pair, i) => (
                  <div key={i} className="similarity-pair">
                    <div className="similarity-badge">{pair.similarity}% similar</div>
                    <div className="similarity-reqs">
                      <div className="sim-req"><span className="sim-req-id">{pair.req1Id}</span> {pair.text1}</div>
                      <div className="sim-divider">vs</div>
                      <div className="sim-req"><span className="sim-req-id">{pair.req2Id}</span> {pair.text2}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Modules ── */}
        <div className="modules-section">
          <div className="modules-section-header">
            <h2 className="modules-section-title">Module Breakdown</h2>
            <span className="modules-section-sub">{modules.length} modules · {stats.total} requirements</span>
          </div>
          <div className="modules-grid">
            {modules.map((mod) => (
              <ModuleCard key={mod.module} module={mod} />
            ))}
          </div>
        </div>

        {/* ── RTM ── */}
        {rtm.length > 0 && (
          <div className="rtm-section">
            <div className="rtm-section-header" onClick={() => setShowRTM(p => !p)}>
              <div>
                <h2 className="modules-section-title">Requirement Traceability Matrix</h2>
                <span className="modules-section-sub">{rtm.length} requirements · {rtm.reduce((s, r) => s + r.testCaseCount, 0)} total test cases</span>
              </div>
              <button className="rtm-toggle-btn">{showRTM ? '▲ Collapse' : '▼ Expand RTM'}</button>
            </div>
            {showRTM && (
              <div className="rtm-table-wrap">
                <table className="rtm-table">
                  <thead>
                    <tr>
                      <th>REQ ID</th>
                      <th>Module</th>
                      <th>Priority</th>
                      <th>Type</th>
                      <th>Requirement</th>
                      <th>TC Count</th>
                      <th>Test Case IDs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rtm.map((row) => (
                      <tr key={row.reqId}>
                        <td className="rtm-req-id">{row.reqId}</td>
                        <td>{row.module}</td>
                        <td>
                          <span className={`rtm-priority-badge priority-${row.priority?.toLowerCase()}`}>
                            {row.priority}
                          </span>
                        </td>
                        <td className="rtm-type">{row.type}</td>
                        <td className="rtm-req-text">{row.requirement}</td>
                        <td className="rtm-tc-count">{row.testCaseCount}</td>
                        <td className="rtm-tc-ids">{row.tcIds.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
