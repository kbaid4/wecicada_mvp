import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { updateEventSuppliersWithUserId } from '../utils/updateSupplierEvents';

// UserAvatar component
const UserAvatar = () => {
  const [initial, setInitial] = useState('S');
  React.useEffect(() => {
    async function fetchInitial() {
      let name = localStorage.getItem('supplierName') || localStorage.getItem('signupName') || 'Supplier';
      try {
        const { data: { user } } = await import('../supabaseClient').then(m => m.supabase.auth.getUser());
        if (user) {
          const { data: profile } = await import('../supabaseClient').then(m => m.supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single());
          if (profile && profile.full_name) {
            name = profile.full_name;
          }
        }
      } catch {}
      setInitial(name.charAt(0).toUpperCase());
    }
    fetchInitial();
  }, []);
  return (
    <div
      className="user-avatar"
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: '#A888B5',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '16px',
        flexShrink: 0,
        cursor: 'pointer',
        marginRight: '4px'
      }}
      title={initial}
    >
      {initial}
    </div>
  );
};

const mainNavItems = [
  { name: 'Home', path: '/SupplierHomepage' },
  { name: 'My Events', path: '/SupplierEvents' },
  { name: 'Messages', path: '/SupplierMessagesPage' }
];
const userNavItems = [
  { name: 'My Work', path: '/SupplierWork' },
  { name: 'My Team', path: '/SupplierTeam' }
];

const SupplierEvents = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('My Events');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);

  // Fetch the current user ID and ensure event_suppliers table is updated
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      if (session?.user) {
        setUserId(session.user.id);
        
        // Update event_suppliers table with user ID when auth state changes
        // This handles both initial login and email verification
        if (session.user.id && session.user.email) {
          updateEventSuppliersWithUserId(session.user.id, session.user.email)
            .then(result => {
              console.log('Event suppliers update result:', result);
            })
            .catch(err => {
              console.error('Failed to update event_suppliers table:', err);
            });
        }
      }
    });

    // Initial check for current user
    async function fetchCurrentUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          
          // Also attempt to update event_suppliers on component mount
          if (user.email) {
            updateEventSuppliersWithUserId(user.id, user.email)
              .then(result => {
                console.log('Initial event suppliers update result:', result);
              })
              .catch(err => {
                console.error('Failed to update event_suppliers table:', err);
              });
          }
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    }
    fetchCurrentUser();

    // Cleanup subscription
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Fetch events for this supplier using multiple sources to ensure persistence across logins
  useEffect(() => {
    async function fetchSupplierEvents() {
      setLoading(true);
      setError(null);
      
      try {
        // Step 1: Get current user details (ID and email)
        let userEmail = null;
        let currentUserId = userId;
        
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            userEmail = user.email;
            currentUserId = user.id;
            console.log(`Current user details - ID: ${currentUserId}, Email: ${userEmail}`);
          }
        } catch (authErr) {
          console.error('Error getting authenticated user:', authErr);
        }
        
        // Step 2: Get email from profile if not from auth
        if (!userEmail && currentUserId) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', currentUserId)
              .maybeSingle();
              
            if (profile?.email) {
              userEmail = profile.email;
              console.log(`Retrieved email from profile: ${userEmail}`);
            }
          } catch (profileErr) {
            console.error('Error getting profile:', profileErr);
          }
        }
        
        // Step 3: If we still don't have user info, try from localStorage as fallback
        if (!userEmail) {
          const storedEmail = localStorage.getItem('supplierEmail');
          if (storedEmail) {
            userEmail = storedEmail;
            console.log(`Using email from localStorage: ${userEmail}`);
          } else {
            console.error('Cannot fetch events: No user email available from any source');
            setEvents([]);
            setLoading(false);
            return;
          }
        }
        
        // Remember this email for future sessions
        localStorage.setItem('supplierEmail', userEmail);
        
        // We'll collect event IDs from multiple sources
        const eventIdsSet = new Set();
        
        // Source 1: Get event IDs from invites table
        try {
          const { data: invites } = await supabase
            .from('invites')
            .select('event_id')
            .eq('supplier_email', userEmail);
            
          if (invites?.length > 0) {
            console.log(`Found ${invites.length} invites for ${userEmail}`);
            invites.forEach(invite => eventIdsSet.add(invite.event_id));
          }
        } catch (invitesErr) {
          console.error('Error fetching invites:', invitesErr);
        }
        
        // Source 2: Get event IDs from event_suppliers table by email
        try {
          const { data: eventSuppliersByEmail } = await supabase
            .from('event_suppliers')
            .select('event_id')
            .eq('supplier_email', userEmail);
            
          if (eventSuppliersByEmail?.length > 0) {
            console.log(`Found ${eventSuppliersByEmail.length} event_suppliers by email`);
            eventSuppliersByEmail.forEach(es => eventIdsSet.add(es.event_id));
          }
        } catch (esEmailErr) {
          console.error('Error fetching event_suppliers by email:', esEmailErr);
        }
        
        // Source 3: Get event IDs from event_suppliers table by user ID
        if (currentUserId) {
          try {
            const { data: eventSuppliersByUserId } = await supabase
              .from('event_suppliers')
              .select('event_id')
              .eq('supplier_user_id', currentUserId);
              
            if (eventSuppliersByUserId?.length > 0) {
              console.log(`Found ${eventSuppliersByUserId.length} event_suppliers by user ID`);
              eventSuppliersByUserId.forEach(es => eventIdsSet.add(es.event_id));
            }
          } catch (esUserIdErr) {
            console.error('Error fetching event_suppliers by user ID:', esUserIdErr);
          }
        }
        
        // Now we have all possible event IDs
        const eventIdsList = Array.from(eventIdsSet);
        console.log(`Combined unique event IDs: ${eventIdsList.length}`, eventIdsList);
        
        if (eventIdsList.length === 0) {
          console.log('No events found for this supplier');
          setEvents([]);
          setLoading(false);
          return;
        }
        
        // Fetch details for each event one by one (more reliable than using IN)
        const allEvents = [];
        const missingEventIds = [];
        
        for (const eventId of eventIdsList) {
          try {
            if (!eventId) continue; // Skip null/undefined IDs
            
            const { data: event } = await supabase
              .from('events')
              .select('*')
              .eq('id', eventId)
              .maybeSingle();
              
            if (event) {
              console.log(`Found event: ${event.name} (${eventId})`);
              allEvents.push(event);
            } else {
              console.log(`Could not find details for event ID: ${eventId}`);
              missingEventIds.push(eventId);
            }
          } catch (eventErr) {
            console.error(`Error fetching event ${eventId}:`, eventErr);
          }
        }
        
        // Handle missing events - create placeholder events from invites
        if (missingEventIds.length > 0) {
          console.log(`Attempting to create placeholders for ${missingEventIds.length} missing events`);
          
          for (const missingId of missingEventIds) {
            try {
              // Try to get invite details for this event
              const { data: invite } = await supabase
                .from('invites')
                .select('*')
                .eq('event_id', missingId)
                .eq('supplier_email', userEmail)
                .maybeSingle();
                
              if (invite) {
                console.log(`Creating placeholder from invite for event ID: ${missingId}`);
                
                // Create a complete placeholder event from invitation data
                const placeholderEvent = {
                  id: missingId,
                  name: invite.event_name || 'Invited Event',
                  description: invite.event_description || 'You were invited to this event',
                  start_date: invite.event_date || new Date().toISOString(),
                  end_date: invite.event_end_date || invite.event_date || new Date().toISOString(),
                  location: invite.event_location || 'TBD',
                  image_url: invite.event_image_url || null,
                  admin_id: invite.admin_id,
                  created_at: invite.created_at,
                  status: invite.status || 'invited',
                  type: invite.event_type || null,
                  sub_type: invite.event_sub_type || null,
                  budget: invite.event_budget || null,
                  is_placeholder: true // Mark as placeholder
                };
                
                console.log('Created placeholder event:', placeholderEvent);
                allEvents.push(placeholderEvent);
                
                // Let's get the events table schema first to see which columns exist
                try {
                  // Skip database insertion and just use the local placeholder
                  console.log('Using local placeholder for event display');
                  
                  // If we want to try saving placeholder to the database in the future, 
                  // we should first check the database schema with:
                  // 1. Get event table definition from PostgreSQL information_schema
                  // 2. Only include fields that match the schema
                  // 3. For now, it's safer to just use the local placeholder
                } catch (insertErr) {
                  console.error('Error handling placeholder:', insertErr);
                }
              } else {
                console.log(`No invite found for missing event ${missingId}`);
              }
            } catch (inviteErr) {
              console.error(`Error handling missing event ${missingId}:`, inviteErr);
            }
          }
        }
        
        console.log(`Successfully fetched ${allEvents.length} events:`, allEvents);
        
        // Store the events for this user persistently
        try {
          localStorage.setItem('supplierEvents', JSON.stringify(allEvents));
        } catch (storageErr) {
          console.error('Error storing events in localStorage:', storageErr);
        }
        
        setEvents(allEvents);
      } catch (err) {
        console.error('Error in event fetching process:', err);
        setError('Failed to load events. Please try again later.');
        
        // Try to load from localStorage as fallback if we have error
        try {
          const savedEvents = localStorage.getItem('supplierEvents');
          if (savedEvents) {
            const parsedEvents = JSON.parse(savedEvents);
            console.log('Loading events from localStorage fallback:', parsedEvents);
            setEvents(parsedEvents);
          }
        } catch (fallbackErr) {
          console.error('Error loading events from localStorage:', fallbackErr);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchSupplierEvents();
    
    // Refresh events whenever userId changes OR after 2 seconds (to handle post-confirmation load)
    const postLoginRefresh = setTimeout(() => {
      fetchSupplierEvents();
    }, 2000);
    
    return () => clearTimeout(postLoginRefresh);
  }, [userId, supabase]);

  return (
    <div className="supplier-events-root" style={{ backgroundColor: '#A888B5', minHeight: '100vh', fontFamily: 'Arial, sans-serif', color: '#441752' }}>
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
        <div className="nav-section right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
          <UserAvatar />
        </div>
      </nav>
      <h1 className="supplier-events-title" style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '24px', padding: '10px' }}>My Events</h1>
      
      <div className="events-container" style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>Loading events...</div>
        ) : error ? (
          <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: '8px' }}>
            <p style={{ fontSize: '18px', color: '#441752' }}>You don't have any events yet.</p>
            <p style={{ fontSize: '14px', color: '#666' }}>Events will appear here when you're invited by an organizer.</p>
          </div>
        ) : (
          <div className="events-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {events.map(event => (
              <div 
                key={event.id} 
                className="event-card" 
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onClick={() => navigate(`/SupplierEventDetail/${event.id}`)}
              >
                <h3 style={{ color: '#441752', marginBottom: '10px', fontSize: '20px' }}>
                  {event.name || 'Untitled Event'}
                </h3>
                
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                  {/* Type and Sub-type */}
                  {event.type && <div><strong>Type:</strong> {event.type}</div>}
                  {event.sub_type && <div><strong>Sub-type:</strong> {event.sub_type}</div>}
                  
                  {/* Location with icon */}
                  {event.location && (
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
                      <span style={{ marginRight: '5px' }}>📍</span>
                      <strong>Location:</strong> {event.location}
                    </div>
                  )}
                  
                  {/* Budget information */}
                  {event.budget && (
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
                      <span style={{ marginRight: '5px' }}>💰</span>
                      <strong>Budget:</strong> {typeof event.budget === 'number' 
                        ? `$${event.budget.toLocaleString()}` 
                        : event.budget}
                    </div>
                  )}
                </div>
                
                {/* Date information with calendar icon */}
                <div style={{ fontSize: '14px', marginTop: '15px', color: '#441752', display: 'flex', alignItems: 'center' }}>
                  {event.start_date && (
                    <>
                      <span style={{ marginRight: '5px' }}>📅</span>
                      <div>
                        <strong>Date:</strong> {new Date(event.start_date).toLocaleDateString()}
                        {event.end_date && event.end_date !== event.start_date && 
                          ` - ${new Date(event.end_date).toLocaleDateString()}`}
                      </div>
                    </>
                  )}
                </div>
                
                {/* Status badge */}
                <div style={{ marginTop: '15px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    backgroundColor: event.is_placeholder ? '#FFEBCD' : '#E6F7FF',
                    color: event.is_placeholder ? '#CD853F' : '#0073CF'
                  }}>
                    {event.status || (event.is_placeholder ? 'Invited' : 'Active')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}      
      </div>
      <style jsx>{`
        body {
          margin: 0;
          padding: 0;
        }
        .top-nav {
          margin-top: 0;
          margin-bottom: 0;
          padding-top: 0;
          padding-bottom: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-left: 32px;
          padding-right: 32px;
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
        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: #A888B5;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 16px;
          flex-shrink: 0;
          cursor: pointer;
          margin-right: 4px;
        }
        @media (max-width: 900px) {
          .supplier-events-root {
            padding: 1rem;
          }
        }
        @media (max-width: 600px) {
          .top-nav {
            flex-direction: column;
            height: auto;
            padding: 8px 4px;
            gap: 8px;
          }
          .nav-section {
            gap: 8px;
          }
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
