import React from 'react';

interface LoginMessageProps {
  error?: string | null;
  success?: string | null;
  info?: string | null;
}

const LoginMessage: React.FC<LoginMessageProps> = ({ error, success, info }) => {
  if (!error && !success && !info) {
    return null;
  }

  const getMessageStyle = (type: 'error' | 'success' | 'info') => {
    const styles = {
      error: {
        padding: '10px',
        background: '#f8d7da',
        border: '1px solid #f5c6cb',
        borderRadius: '4px',
        color: '#721c24',
        marginBottom: '20px',
        fontSize: '14px'
      },
      success: {
        padding: '10px',
        background: '#d4edda',
        border: '1px solid #c3e6cb',
        borderRadius: '4px',
        color: '#155724',
        marginBottom: '20px',
        fontSize: '14px'
      },
      info: {
        padding: '10px',
        background: '#d1ecf1',
        border: '1px solid #bee5eb',
        borderRadius: '4px',
        color: '#0c5460',
        marginBottom: '20px',
        fontSize: '14px'
      }
    };
    return styles[type];
  };

  const getIcon = (type: 'error' | 'success' | 'info') => {
    const icons = {
      error: '❌',
      success: '✅',
      info: '💡'
    };
    return icons[type];
  };

  return (
    <>
      {error && (
        <div style={getMessageStyle('error')}>
          {getIcon('error')} {error}
        </div>
      )}
      {success && (
        <div style={getMessageStyle('success')}>
          {getIcon('success')} {success}
        </div>
      )}
      {info && (
        <div style={getMessageStyle('info')}>
          {getIcon('info')} {info}
        </div>
      )}
    </>
  );
};

export default LoginMessage;