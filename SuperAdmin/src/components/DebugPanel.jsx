import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { checkAuthToken, setAuthToken, TEST_TOKEN } from '../utils/setAuthToken';

const DebugPanel = () => {
  const [debugInfo, setDebugInfo] = useState({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const token = localStorage.getItem('founder_token');
      const hasToken = checkAuthToken();
      
      let apiStatus = 'Not tested';
      try {
        const response = await api.get('/api/v1/superadmin/users');
        apiStatus = `✅ Working (${response.data?.users?.length || 0} users)`;
      } catch (error) {
        apiStatus = `❌ Error: ${error.response?.status || error.message}`;
      }

      setDebugInfo({
        token: token ? 'Present' : 'Missing',
        hasToken,
        apiStatus,
        timestamp: new Date().toLocaleTimeString()
      });
    };

    checkStatus();
  }, []);

  const handleSetToken = () => {
    setAuthToken(TEST_TOKEN);
    window.location.reload();
  };

  const handleClearToken = () => {
    localStorage.removeItem('founder_token');
    window.location.reload();
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          zIndex: 9999,
          background: '#ff6b6b',
          color: 'white',
          border: 'none',
          padding: '8px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        zIndex: 9999,
        background: 'white',
        border: '2px solid #333',
        borderRadius: '8px',
        padding: '16px',
        maxWidth: '400px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        fontSize: '14px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: '#333' }}>🐛 Debug Panel</h3>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            background: '#ff6b6b',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer'
          }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Token Status:</strong> {debugInfo.token}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <strong>API Status:</strong> {debugInfo.apiStatus}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <strong>Last Check:</strong> {debugInfo.timestamp}
      </div>
      
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          onClick={handleSetToken}
          style={{
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Set Token
        </button>
        <button
          onClick={handleClearToken}
          style={{
            background: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Clear Token
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default DebugPanel;
