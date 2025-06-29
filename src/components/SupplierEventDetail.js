import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { realtimeService } from '../services/realtimeService';
import { updateEventSuppliersWithUserId } from '../utils/updateSupplierEvents';

// UserAvatar component (same as in SupplierEvents)
const UserAvatar = () => {
  const [initial, setInitial] = useState('S');
  React.useEffect(() => {
    async function fetchInitial() {
      let name = localStorage.getItem('supplierName') || localStorage.getItem('signupName') || 'Supplier';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
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

const SupplierEventDetail = () => {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [activeNav, setActiveNav] = useState('My Events');
  const [eventDetails, setEventDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAcceptButton, setShowAcceptButton] = useState(() => {
    return localStorage.getItem(`invite_accepted_${eventId}`) !== 'true';
  });

  const handleAcceptInvite = () => {
    setShowAcceptButton(false);
    localStorage.setItem(`invite_accepted_${eventId}`, 'true');
  };

  useEffect(() => {
    let isMounted = true;
    let unsubscribe = () => {};

    // Update event_suppliers table with user ID when component mounts
    const ensureUserIdInEventSuppliers = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id && user?.email && eventId) {
          console.log(`Ensuring user ${user.id} is properly linked to event ${eventId}`);
          await updateEventSuppliersWithUserId(user.id, user.email);

          // Also directly ensure this specific event is linked to the user
          const { error: linkError } = await supabase
            .from('event_suppliers')
            .upsert(
              {
                event_id: eventId,
                supplier_user_id: user.id,
                supplier_email: user.email
              },
              { onConflict: ['event_id', 'supplier_email'] }
            );

          if (linkError) {
            console.error('Error ensuring event-supplier link:', linkError);
          } else {
            console.log(`Successfully ensured link between supplier ${user.id} and event ${eventId}`);
          }
        }
      } catch (err) {
        console.error('Error updating event_suppliers table:', err);
      }
    };

    const fetchEvent = async () => {
      try {
        // First try to get the event directly
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();

        if (error) throw error;
        
        if (isMounted) {
          // Set event details with admin name
          const eventWithAdmin = await getEventWithAdmin(data);
          setEventDetails(eventWithAdmin);
          
          // Subscribe to real-time updates for this event
          unsubscribe = realtimeService.subscribeToTable(
            'events',
            `id=eq.${eventId}`,
            async (payload) => {
              if (payload.eventType === 'UPDATE' && isMounted) {
                const updatedEvent = await getEventWithAdmin(payload.new);
                setEventDetails(prev => ({
                  ...prev,
                  ...updatedEvent,
                  isPlaceholder: prev?.isPlaceholder || false
                }));
              }
            }
          );
        }
      } catch (error) {
        console.error('Error fetching event:', error);
        
        // If event not found, try to get invite information
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            const { data: invite } = await supabase
              .from('invites')
              .select('*')
              .eq('event_id', eventId)
              .eq('supplier_email', user.email)
              .maybeSingle();
              
            if (invite) {
              console.log('Created event details from invite:', invite);
              const placeholderEvent = await createPlaceholderEvent(invite);
              
              if (isMounted) {
                setEventDetails(placeholderEvent);
                
                // Subscribe to updates for this invite
                unsubscribe = realtimeService.subscribeToTable(
                  'invites',
                  `event_id=eq.${eventId},supplier_email=eq.${user.email}`,
                  async (payload) => {
                    if (isMounted && payload.new) {
                      const updatedEvent = await createPlaceholderEvent(payload.new);
                      setEventDetails(prev => ({
                        ...prev,
                        ...updatedEvent
                      }));
                    }
                  }
                );
              }
              return;
            }
          }
        } catch (inviteError) {
          console.error('Error fetching invite:', inviteError);
        }
        
        if (isMounted) {
          setError('Event not found');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Helper function to get event with admin details
    const getEventWithAdmin = async (event) => {
      if (!event) return event;
      
      try {
        let adminName = 'Event Organizer';
        if (event.admin_id) {
          const { data: adminData } = await supabase
            .from('profiles')
            .select('full_name, companyname')
            .eq('id', event.admin_id)
            .single();
            
          if (adminData) {
            adminName = adminData.full_name || adminData.companyname || 'Event Organizer';
          }
        }
        
        return { ...event, adminName };
      } catch (err) {
        console.error('Error fetching admin details:', err);
        return { ...event, adminName: 'Event Organizer' };
      }
    };

    // Helper function to create a placeholder event from invite
    const createPlaceholderEvent = async (invite) => {
      const placeholder = {
        id: eventId,
        name: invite.event_name || 'Invited Event',
        description: invite.event_description || 'You were invited to this event',
        start_date: invite.event_date || invite.start_date || new Date().toISOString(),
        end_date: invite.event_end_date || invite.end_date || new Date().toISOString(),
        location: invite.event_location || invite.location || 'TBD',
        image_url: invite.event_image_url || invite.image_url || null,
        admin_id: invite.admin_id,
        created_at: invite.created_at || new Date().toISOString(),
        status: 'Active',
        type: invite.event_type || invite.type || null,
        sub_type: invite.event_sub_type || invite.sub_type || null,
        budget: invite.event_budget || invite.budget || null,
        is_placeholder: true,
        adminName: 'Event Organizer'
      };
      
      // If we have an admin_id, try to get their name
      if (invite.admin_id) {
        try {
          const { data: adminData } = await supabase
            .from('profiles')
            .select('full_name, companyname')
            .eq('id', invite.admin_id)
            .single();
            
          if (adminData) {
            placeholder.adminName = adminData.full_name || adminData.companyname || 'Event Organizer';
          }
        } catch (err) {
          console.error('Error fetching admin details for invite:', err);
        }
      }
      
      return placeholder;
    };

    // Initialize
    ensureUserIdInEventSuppliers();
    fetchEvent();

    // Cleanup
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [eventId]);

  // Rest of your component...
  if (loading) {
    return <div>Loading event details...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!eventDetails) {
    return <div>Event not found</div>;
  }

  return (
    <div className="supplier-event-detail">
      <div className="event-header">
        <h1>{eventDetails.name}</h1>
        <p>Hosted by: {eventDetails.adminName}</p>
        {eventDetails.is_placeholder && (
          <div className="placeholder-notice">
            This is a placeholder event. The organizer will provide more details soon.
          </div>
        )}
      </div>
      
      <div className="event-details">
        <div className="detail-row">
          <span className="label">Date:</span>
          <span>{new Date(eventDetails.start_date).toLocaleDateString()}</span>
        </div>
        
        <div className="detail-row">
          <span className="label">Location:</span>
          <span>{eventDetails.location || 'To be announced'}</span>
        </div>
        
        {eventDetails.description && (
          <div className="event-description">
            <h3>Description</h3>
            <p>{eventDetails.description}</p>
          </div>
        )}
        
        {showAcceptButton && (
          <button 
            onClick={handleAcceptInvite}
            className="accept-button"
          >
            Accept Invitation
          </button>
        )}
      </div>
    </div>
  );
};

export default SupplierEventDetail;
