'use client';

import { useAuth } from '@/hooks';

export default function TestAuthPage() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '600px' }}>
      <h1>Test Auth Hook</h1>
      
      <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <p><strong>Loading:</strong> {String(loading)}</p>
        <p><strong>Is Authenticated:</strong> {String(isAuthenticated)}</p>
      </div>

      <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <p><strong>User Data:</strong></p>
        <pre style={{ backgroundColor: '#fff', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>

      <button 
        onClick={logout}
        style={{
          padding: '10px 20px',
          backgroundColor: '#ff4444',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Logout
      </button>
    </div>
  );
}
