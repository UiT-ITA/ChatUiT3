import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Profile.css';

const Profile: React.FC = () => {
  const { account, isAuthenticated, isAdmin, roles } = useAuth();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenClaims, setTokenClaims] = useState<Record<string, any>>({});

  // Function to parse a JWT token and extract claims
  const parseJwt = (token: string) => {
    try {
      // Split the token and get the payload part (second part)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT token:', error);
      return {};
    }
  };

  useEffect(() => {
    const fetchToken = async () => {
      try {
        // Get the access token from auth service
        const token = await useAuth().getAccessToken();
        setAccessToken(token);
        
        // Parse the token to get claims
        if (token) {
          const claims = parseJwt(token);
          setTokenClaims(claims);
        }
      } catch (error) {
        console.error('Error fetching token:', error);
      }
    };

    if (isAuthenticated) {
      fetchToken();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="profile-page">
        <h2>User Profile</h2>
        <p>Please sign in to view your profile information.</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <h2>User Profile</h2>
      
      <div className="profile-section">
        <h3>Basic Information</h3>
        <div className="info-grid">
          <div>
            <strong>Name:</strong> {account?.name || 'Not available'}
          </div>
          <div>
            <strong>Username:</strong> {account?.username || account?.localAccountId || 'Not available'}
          </div>
          <div>
            <strong>Account ID:</strong> {account?.localAccountId || account?.homeAccountId || 'Not available'}
          </div>
          <div>
            <strong>Environment:</strong> {account?.environment || 'Not available'}
          </div>
          <div>
            <strong>Is Admin:</strong> {isAdmin ? 'Yes' : 'No'}
          </div>
        </div>
      </div>
      
      <div className="profile-section">
        <h3>Roles</h3>
        {roles.length > 0 ? (
          <ul className="roles-list">
            {roles.map((role, index) => (
              <li key={index}>{role}</li>
            ))}
          </ul>
        ) : (
          <p>No roles assigned</p>
        )}
      </div>
      
      <div className="profile-section">
        <h3>ID Token Claims</h3>
        {account?.idTokenClaims ? (
          <div className="claims-table">
            <table>
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(account.idTokenClaims).map(([key, value]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>
                      {typeof value === 'object' 
                        ? JSON.stringify(value, null, 2) 
                        : String(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No ID token claims available</p>
        )}
      </div>
      
      <div className="profile-section">
        <h3>Access Token Claims</h3>
        {Object.keys(tokenClaims).length > 0 ? (
          <div className="claims-table">
            <table>
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(tokenClaims).map(([key, value]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>
                      {typeof value === 'object' 
                        ? JSON.stringify(value, null, 2) 
                        : String(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No access token claims available</p>
        )}
      </div>
      
      <div className="profile-section">
        <h3>Raw Account Object</h3>
        <pre className="raw-data">
          {JSON.stringify(account, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default Profile;
