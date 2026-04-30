import React, { useState } from 'react';
import './ModuleCard.css';

const PRIORITY_CLASS = {
  HIGH: 'priority-high',
  MEDIUM: 'priority-medium',
  LOW: 'priority-low',
};

const TYPE_CLASS = {
  functional: 'type-functional',
  'non-functional': 'type-nonfunctional',
};

const MODULE_ICONS = {
  Authentication: '🔐',
  Security: '🛡️',
  Notification: '🔔',
  Notifications: '🔔',
  Dashboard: '📊',
  Payment: '💳',
  Performance: '⚡',
  'User Management': '👥',
  'Data Management': '🗄️',
  'UI & Compatibility': '🖥️',
  Scheduling: '📅',
  Reporting: '📈',
  Integration: '🔗',
};

export default function ModuleCard({ module }) {
  const [expandedId, setExpandedId] = useState(null);

  const toggle = (id) => setExpandedId(expandedId === id ? null : id);

  const icon = MODULE_ICONS[module.module] || '📋';

  return (
    <div className="module-card">
      <div className="module-card-header">
        <div className="module-title">
          <div className="module-icon-wrap">{icon}</div>
          <h2>{module.module}</h2>
        </div>
        <span className="module-count-badge">{module.count} req{module.count !== 1 ? 's' : ''}</span>
      </div>

      <div className="req-list">
        {module.items.map((item) => (
          <div key={item.id} className={`req-item ${expandedId === item.id ? 'expanded' : ''}`}>
            <div className="req-row" onClick={() => toggle(item.id)}>
              <div className="req-left">
                <div className="req-meta">
                  <span className="req-id">{item.id}</span>
                  <span className={`badge ${PRIORITY_CLASS[item.priority]}`}>{item.priority}</span>
                  <span className={`badge ${TYPE_CLASS[item.type] || 'type-functional'}`}>{item.type}</span>
                </div>
                <p className="req-text">{item.requirement}</p>
              </div>
              <span className="expand-arrow">{expandedId === item.id ? '▲' : '▼'}</span>
            </div>

            {expandedId === item.id && (
              <div className="test-cases">
                <div className="test-cases-header">
                  <h4>Test Cases</h4>
                  <span className="tc-count">{item.testCases.length}</span>
                </div>
                <table className="tc-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Title</th>
                      <th>Steps</th>
                      <th>Expected Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.testCases.map((tc, i) => (
                      <tr key={i}>
                        <td className="tc-num">{i + 1}</td>
                        <td className="tc-title">{tc.title}</td>
                        <td className="tc-steps">
                          <ol>
                            {Array.isArray(tc.steps)
                              ? tc.steps.map((step, j) => <li key={j}>{step}</li>)
                              : <li>{tc.steps}</li>
                            }
                          </ol>
                        </td>
                        <td className="tc-expected">{tc.expected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
