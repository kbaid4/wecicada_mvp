import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const VerifyEmail = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Optionally, you can check window.location.search for verification params
    // For now, just redirect to SignInPage and reload the page
    navigate('/SignInPage', { replace: true });
    window.location.reload();
  }, [navigate]);

  return (
    <div style={{ padding: '60px', textAlign: 'center' }}>
      <h2>Verifying your email...</h2>
      <p>If you are not redirected, <a href="/SignInPage">click here to sign in</a>.</p>
    </div>
  );
};

export default VerifyEmail;
