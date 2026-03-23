'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks';

export default function TestAuthPage() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '600px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h1 style={{ margin: 0 }}>Test Auth Hook</h1>
        <Link href="/" style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '6px 10px', textDecoration: 'none', color: '#111' }}>
          Inicio
        </Link>
      </div>
      
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
