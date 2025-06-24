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
      console.log('Fetching supplier events - ensuring all events are shown regardless of status');
      
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
            .eq('supplier_email', userEmail.toLowerCase().trim());
            
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
        
        // Batch fetch all events in one query
        let allEvents = [];
        let missingEventIds = [];
        
        if (eventIdsList.length > 0) {
          console.log('Batch fetching events for IDs:', eventIdsList, eventIdsList.map(id => typeof id));
          
          // First try to fetch real events from events table
          const { data: realEvents, error: realEventsError } = await supabase
            .from('events')
            .select('*')
            .in('id', eventIdsList);
            
          console.log('Real events found:', realEvents);
          
          if (realEventsError) {
            console.error('Error fetching real events:', realEventsError);
          }
          
          // Process real events
          const foundEventIds = new Set();
          if (realEvents && realEvents.length > 0) {
            allEvents = realEvents.map(event => {
              foundEventIds.add(event.id);
              return {
                ...event,
                name: event.name || 'Untitled Event',
                type: event.type || 'event',
                subType: event.sub_type || '',
                location: event.location || 'Location TBD',
                startDate: event.start_date || '',
                endDate: event.end_date || '',
                budget: event.budget || 0,
                imageUrl: '',
                isPlaceholder: false
              };
            });
          }
          
          // Find missing event IDs that need placeholders
          missingEventIds = eventIdsList.filter(id => !foundEventIds.has(id));
          console.log('Missing event IDs needing placeholders:', missingEventIds);
          
          // Create meaningful placeholders for missing events
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
                  console.log(`Creating event from invite data for event ID: ${missingId}`);
                  
                  // Get admin name for more meaningful display
                  let adminName = 'Event Organizer';
                  try {
                    const { data: adminData } = await supabase
                      .from('users')
                      .select('company_name, email')
                      .eq('id', invite.invited_by_admin_id)
                      .maybeSingle();
                      
                    if (adminData) {
                      adminName = adminData.company_name || adminData.email || 'Event Organizer';
                    }
                  } catch (adminErr) {
                    console.log('Could not fetch admin info:', adminErr);
                  }
                  
                  // Create cleaner, more unique placeholder names using short event ID and creation date
                  const eventFromInvite = {
                    id: missingId,
                    name: `${adminName}'s Event #${missingId.toString().slice(-4)}`,
                    description: `You have been invited to this event. Status: ${invite.status}`,
                    start_date: invite.created_at || new Date().toISOString(),
                    end_date: invite.created_at || new Date().toISOString(),
                    location: 'Location will be announced',
                    admin_id: invite.invited_by_admin_id,
                    created_at: invite.created_at || new Date().toISOString(),
                    type: 'Event',
                    sub_type: `Invitation ${invite.status}`,
                    budget: 0,
                    visibility: 'public',
                    status: invite.status === 'accepted' ? 'active' : 'pending',
                    invitation_status: invite.status,
                    is_placeholder: true
                  };
                  
                  console.log('Created meaningful event from invite:', eventFromInvite.name);
                  allEvents.push(eventFromInvite);
                } else {
                  console.log(`No invite found for missing event ${missingId}`);
                }
              } catch (inviteErr) {
                console.error(`Error handling missing event ${missingId}:`, inviteErr);
              }
            }
          }
          
          console.log(`Successfully fetched ${allEvents.length} events:`, allEvents);
          
          // Sort events by most recent start date first
          const sortedEvents = allEvents.sort((a, b) => {
            // If both have start dates, sort by those
            if (a.start_date && b.start_date) {
              return new Date(b.start_date) - new Date(a.start_date);
            }
            // If only one has a start date, prioritize it
            if (a.start_date) return -1;
            if (b.start_date) return 1;
            // Otherwise sort by created date if available
            if (a.created_at && b.created_at) {
              return new Date(b.created_at) - new Date(a.created_at);
            }
            return 0;
          });
          
          // Map all events to camelCase for UI consistency
          function mapEventToCamelCase(event) {
            return {
              ...event,
              name: event.name,
              type: event.type,
              subType: event.sub_type || event.subType || '',
              location: event.location,
              startDate: event.start_date || event.startDate || '',
              endDate: event.end_date || event.endDate || '',
              visibility: event.visibility,
              budget: event.budget,
              status: event.status,
              imageUrl: '', // Removed image_url
              isPlaceholder: event.is_placeholder || event.isPlaceholder || false,
              // Add any other mappings as needed
            };
          }
          const camelEvents = sortedEvents.map(mapEventToCamelCase);
          try {
            localStorage.setItem('supplierEvents', JSON.stringify(camelEvents));
            console.log('Saved events to localStorage, total:', camelEvents.length);
          } catch (storageErr) {
            console.warn('Failed to save events to localStorage:', storageErr);
          }
          setEvents(camelEvents);
        } else {
          console.log('No events found for this supplier');
          setEvents([]);
        }
      } catch (error) {
        console.error('Error fetching supplier events:', error);
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
                <h3 style={{ color: '#441752', marginBottom: '12px', fontSize: '20px', borderBottom: '2px solid #A888B5', paddingBottom: '8px' }}>
                  {event.name}
                </h3>
                
                {/* Event Details Section - Admin entered fields */}
                <div style={{ fontSize: '14px', color: '#444', marginBottom: '15px', backgroundColor: '#f9f5fc', padding: '10px', borderRadius: '6px' }}>
                  {/* Type and Sub-type - Admin entered */}
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{ color: '#A888B5', fontWeight: 'bold', fontSize: '16px', marginRight: '2px' }}>🏷️</span>
                    <div>
                      <strong>Type:</strong> {event.type}
                      {event.subType && (
                        <span> - {event.subType}</span>
                      )} 
                    </div>
                  </div>

                  {/* Location - Admin entered */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{ color: '#A888B5', fontWeight: 'bold', fontSize: '16px', marginRight: '2px' }}>📍</span>
                    <div>
                      <strong>Location:</strong> {event.location}
                    </div>
                  </div>

                  {/* Budget - Admin entered */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{ color: '#A888B5', fontWeight: 'bold', fontSize: '16px', marginRight: '2px' }}>💰</span>
                    <div>
                      <strong>Budget:</strong> {typeof event.budget === 'number' 
                         ? `$${event.budget.toLocaleString()}` 
                         : event.budget} 
                    </div>
                  </div>

                  {/* Date information - Admin entered */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{ color: '#A888B5', fontWeight: 'bold', fontSize: '16px', marginRight: '2px' }}>📅</span>
                    <div>
                      <strong>Date:</strong> {event.startDate 
                        ? new Date(event.startDate).toLocaleDateString() 
                        : 'Not specified'}
                      {event.endDate && event.endDate !== event.startDate && 
                        <div style={{ marginTop: '2px' }}>
                          <strong>End Date:</strong> {new Date(event.endDate).toLocaleDateString()}
                        </div>}
                    </div>
                  </div>
                </div>
                
                {/* Footer with status */}
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  
                  
                  <span style={{ fontSize: '13px', color: '#777', fontStyle: 'italic' }}>
                    Click to view details
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}      
      </div>
      <style jsx="true">{`
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
