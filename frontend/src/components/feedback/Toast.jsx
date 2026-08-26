import React from 'react';

export default function Toast({ toast }) {
  if (!toast || !toast.message) return null;

  return (
    <div className={`toast-box ${toast.isError ? 'toast-error' : 'toast-success'}`}>
      {toast.message}
    </div>
  );
}
