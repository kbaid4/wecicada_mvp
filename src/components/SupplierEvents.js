import React from 'react';

const SupplierEvents = () => {
  return (
    <div className="supplier-events-root" style={{ backgroundColor: '#A888B5', minHeight: '100vh', padding: '40px 20px', fontFamily: 'Arial, sans-serif', color: '#441752' }}>
      <h1 className="supplier-events-title" style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '24px' }}>Supplier Events</h1>
      <p className="supplier-events-desc" style={{ fontSize: '18px' }}>(Supplier events feature coming soon!)</p>
      <style>{`
        @media (max-width: 600px) {
          .supplier-events-root {
            padding: 16px 4px !important;
          }
          .supplier-events-title {
            font-size: 20px !important;
            margin-bottom: 12px !important;
          }
          .supplier-events-desc {
            font-size: 14px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SupplierEvents;
