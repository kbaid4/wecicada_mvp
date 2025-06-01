import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import UserProfile from './UserProfile';

// Helper to get user context from localStorage (reuse from MessagesPage)
function getUserContext() {
  const isSupplier = localStorage.getItem('isSupplier') === 'true';
  const name = isSupplier
    ? localStorage.getItem('supplierName') || 'Supplier'
    : localStorage.getItem('signupName') || 'Admin';
  return { isSupplier, name };
}

const MyTeam = () => {
  const navigate = useNavigate();
  const user = getUserContext();
  const [planners, setPlanners] = useState([]);
  const [newPlanner, setNewPlanner] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [activeNav, setActiveNav] = useState('My Team');

  // Nav bar items (reuse from MessagesPage)
  const mainNavItems = [
    { name: 'Home', path: '/SuppliersPage' },
    { name: 'Events', path: '/Events' },
    { name: 'Messages', path: '/MessagesPage' }
  ];
  const userNavItems = [
    { name: 'My Work', path: '/my-work' },
    { name: 'My Team', path: '/my-team' }
  ];

  useEffect(() => {
    // Load planners from localStorage
    const stored = JSON.parse(localStorage.getItem("myTeamPlanners")) || [];
    setPlanners(stored);
  }, []);

  const addPlanner = () => {
    if (
      newPlanner.trim() &&
      newEmail.trim() &&
      !planners.some(
        (p) => p && typeof p === 'object' && p.name === newPlanner.trim() && p.email === newEmail.trim()
      )
    ) {
      const updated = [...planners, { name: newPlanner.trim(), email: newEmail.trim() }];
      setPlanners(updated);
      localStorage.setItem("myTeamPlanners", JSON.stringify(updated));
      setNewPlanner("");
      setNewEmail("");
    }
  };

  const removePlanner = (name, email) => {
    const updated = planners.filter(
      (p) => !(p && typeof p === 'object' && p.name === name && p.email === email)
    );
    setPlanners(updated);
    localStorage.setItem("myTeamPlanners", JSON.stringify(updated));
  };

  return (
    <div className="app-container">
      <nav className="top-nav">
        <div className="nav-section left">
          <img 
            src={`${process.env.PUBLIC_URL}/images/landingpage/logo.png`} 
            alt="CITADA Logo"
            className="nav-logo"
          />
          {mainNavItems.map(item => (
            <button
              key={item.name}
              className={`nav-btn${activeNav === item.name ? ' active' : ''}`}
              onClick={() => {
                setActiveNav(item.name);
                navigate(item.path);
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="nav-section right">
          {userNavItems.map(item => (
            <button
              key={item.name}
              className="nav-btn"
              onClick={() => {
                setActiveNav(item.name);
                navigate(item.path);
              }}
            >
              {item.name}
            </button>
          ))}
          <UserProfile showName={false} />
        </div>
      </nav>
      <div className="myteam-content">
        <h1>My Team</h1>
        <div className="liaison-inputs">
          <input
            type="text"
            value={newPlanner}
            onChange={e => setNewPlanner(e.target.value)}
            placeholder="Planner name"
            className="styled-input"
          />
          <input
            type="email"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            placeholder="Email"
            className="styled-input"
          />
          <button
            className="styled-btn"
            onClick={addPlanner}
            disabled={!newPlanner.trim() || !newEmail.trim()}
          >
            Add Planner
          </button>
        </div>
        <h2>Planners</h2>
        {planners.length === 0 ? (
          <p>No planners added yet.</p>
        ) : (
          <ul className="liaison-list">
            {planners.map((planner, idx) => {
              if (!planner || typeof planner !== 'object' || !planner.name || !planner.email) return null;
              return (
                <li className="liaison-list-item" key={idx + '-' + String(planner.name) + '-' + String(planner.email)}>
                  <span className="liaison-name">{typeof planner.name === 'string' ? planner.name : ''}</span>
                  <span className="liaison-email">{typeof planner.email === 'string' ? planner.email : ''}</span>
                  <button
                    className="remove-btn"
                    onClick={() => removePlanner(planner.name, planner.email)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <style jsx>{`
        :root {
          --primary-blue: #441752;
          --hover-blue: #441752;
          --light-bg: #A888B5;
          --text-dark: #1A1F36;
          --text-light: #441752;
          --border-color: #441752;
        }

        .app-container {
          min-height: 100vh;
          background-color: var(--light-bg);
          font-family: 'Inter', sans-serif;
        }
        .app-container h1, .app-container h2 {
          color: #441752;
        }
        .myteam-content {
          margin-left: 30px;
        }

        /* Responsive Styles */
        @media (max-width: 900px) {
          .myteam-content {
            margin-left: 10px;
          }
        }
        @media (max-width: 600px) {
          .top-nav {
            flex-direction: column;
            height: auto;
            padding: 8px 6px;
            gap: 8px;
          }
          .nav-section {
            gap: 8px;
          }
          .myteam-content {
            margin-left: 0;
            padding: 10px 2vw;
          }
          .liaison-inputs {
            max-width: 100%;
            gap: 0.5rem;
          }
          .styled-input {
            font-size: 0.95rem;
            padding: 0.5rem 0.7rem;
          }
          .styled-btn {
            font-size: 0.95rem;
            padding: 0.5rem 0.7rem;
          }
          .remove-btn {
            font-size: 0.85rem;
            padding: 0.3rem 0.8rem;
            margin-left: 0.5rem;
          }
          .liaison-list-item {
            gap: 0.7rem;
            flex-wrap: wrap;
          }
          .liaison-name, .liaison-email {
            min-width: 80px;
            font-size: 0.95rem;
          }
          h1 {
            font-size: 22px;
          }
          h2 {
            font-size: 17px;
          }
        }
        .styled-input {
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          background: #fff;
          color: #441752;
          box-shadow: 0 1px 4px rgba(68,23,82,0.06);
          outline: none;
        }
        .styled-input::placeholder {
          color: #441752;
          opacity: 1;
        }
        .styled-btn {
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: bold;
          background: #441752;
          color: #A888B5;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(68,23,82,0.06);
          transition: background 0.2s;
        }
        .styled-btn:disabled {
          background: #441752;
          color: #A888B5;
          cursor: not-allowed;
        }
        .remove-btn {
          background: #441752;
          color: #A888B5;
          border: none;
          border-radius: 6px;
          padding: 0.5rem 1rem;
          font-size: 0.95rem;
          font-weight: bold;
          cursor: pointer;
          margin-left: 2rem;
          transition: background 0.2s;
        }
        .remove-btn:hover {
          background: #2D113A;
        }
        .liaison-list {
          list-style: disc inside;
          padding-left: 0;
          margin-top: 1rem;
          margin-bottom: 1rem;
        }
        .liaison-list-item {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 1rem;
        }
        .liaison-name, .liaison-email {
          min-width: 120px;
        }
        .liaison-inputs {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-width: 400px;
        }
        .top-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 32px;
          height: 64px;
          background: #441752;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .nav-section {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .nav-logo {
          height: 28px;
          margin-right: 16px;
        }
        .nav-btn {
          padding: 8px 16px;
          border: none;
          background: none;
          color: #A888B5;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        .nav-btn:hover {
          background: #A888B5;
          color: #441752;
        }
        .nav-btn.active {
          color: #A888B5;
          background: #441752;
        }
        .user-profile {
          width: 32px;
          height: 32px;
          background: #A888B5;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 500;
        }
        :root {
          --primary-blue: #441752;
          --hover-blue: #441752;
          --light-bg: #A888B5;
          --text-dark: #1A1F36;
          --text-light: #441752;
          --border-color: #441752;
        }

        .app-container {
          min-height: 100vh;
          background-color: var(--light-bg);
          font-family: 'Inter', sans-serif;
        }
        .app-container h1, .app-container h2 {
          color: #441752;
        }

        .top-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 32px;
          height: 64px;
          background: #441752;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-section {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .nav-logo {
          height: 28px;
          margin-right: 16px;
        }

        .nav-btn {
          padding: 8px 16px;
          border: none;
          background: none;
          color: #A888B5;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .nav-btn:hover {
          background: #A888B5;
          color: #441752;
        }

        .nav-btn.active {
          color: #A888B5;
          background: #441752;
        }

        .user-profile {
          width: 32px;
          height: 32px;
          background: #A888B5;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

export default MyTeam;
