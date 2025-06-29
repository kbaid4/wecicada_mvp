import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminId } from '../hooks/useAdminId';
import { useNavigate } from 'react-router-dom';
import UserProfile from './UserProfile';
import { supabase } from '../supabaseClient';

// Helper to get user context from localStorage (simple demo)
function getUserContext() {
  // You may want to use a better structure for real apps
  // For demo: if 'isSupplier' is true, user is supplier; else admin
  const isSupplier = localStorage.getItem('isSupplier') === 'true';
  const name = isSupplier
    ? localStorage.getItem('supplierName') || 'Supplier'
    : localStorage.getItem('signupName') || 'Admin';
  return { isSupplier, name };
}


const MessagesPage = () => {
  const { adminId } = useAdminId();
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('Home');
  const [allMessages, setAllMessages] = useState([]);
  const [eventSupplierPairs, setEventSupplierPairs] = useState([]); // [{eventId, eventName, supplierName}]
  const [selectedPair, setSelectedPair] = useState(null); // {eventId, eventName, supplierName}
  const [inputValue, setInputValue] = useState('');
  const user = getUserContext();


  // Updated navigation items
  const mainNavItems = [
    { name: 'Home', path: '/SuppliersPage' },
    { name: 'Events', path: '/Events' },
    { name: 'Messages', path: '/MessagesPage' }
  ];

  // Updated user nav items with correct paths
  const userNavItems = [
    { name: 'My Work', path: '/my-work' },
    { name: 'My Team', path: '/my-team' }
  ];
  
  // State
  
  
  
   // [{eventId, eventName, supplierName}]
   // {eventId, eventName, supplierName}
  
  

  // Fetch events and suppliers for sidebar
  useEffect(() => {
    const fetchEventsAndSuppliers = async () => {
      try {
        let events = [];
        
        // For admin, fetch events from the database
        if (!user.isSupplier) {
          const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('admin_id', adminId);
          
          if (error) throw error;
          events = data || [];
          // Save to localStorage for offline use
          localStorage.setItem('events', JSON.stringify(events));
        } else {
          // For suppliers, use localStorage or fetch their events
          events = JSON.parse(localStorage.getItem('events') || '[]');
        }
        
        let pairs = [];
        if (user.isSupplier) {
          // Supplier: find all events where they are invited
          const { data: invites } = await supabase
            .from('invites')
            .select('*')
            .eq('supplier_email', user.name);
            
          const supplierEvents = invites?.map(invite => 
            events.find(ev => ev.id === invite.event_id)
          ).filter(Boolean);
          
          pairs = supplierEvents.map(ev => ({
            eventId: ev.id,
            eventName: ev.name,
            supplierName: user.name,
            supplierEmail: user.name // For suppliers, their email is their identifier
          }));
        } else {
          // Admin: show all events with their suppliers
          for (const event of events) {
            const { data: invites } = await supabase
              .from('invites')
              .select('*')
              .eq('event_id', event.id);
              
            if (invites && invites.length > 0) {
              const eventPairs = invites.map(invite => ({
                eventId: event.id,
                eventName: event.name,
                supplierName: invite.supplier_name || invite.supplier_email,
                supplierEmail: invite.supplier_email
              }));
              pairs = [...pairs, ...eventPairs];
            }
          }
        }
        
        setEventSupplierPairs(pairs);
        
        // Auto-select first conversation if none is selected
        if (pairs.length > 0 && !selectedPair) {
          setSelectedPair(pairs[0]);
        } else if (pairs.length === 0) {
          setSelectedPair(null);
        }
        
      } catch (error) {
        console.error('Error fetching events and suppliers:', error);
        // Fallback to localStorage if there's an error
        const events = JSON.parse(localStorage.getItem('events') || '[]');
        let pairs = [];
        if (user.isSupplier) {
          pairs = events
            .filter(ev => Array.isArray(ev.invitedSuppliers) && ev.invitedSuppliers.includes(user.name))
            .map(ev => ({ 
              eventId: ev.id, 
              eventName: ev.name, 
              supplierName: user.name,
              supplierEmail: user.name
            }));
        } else {
          pairs = events
            .filter(ev => ev.admin_id === adminId)
            .flatMap(ev => {
              if (!ev.invitedSuppliers || ev.invitedSuppliers.length === 0) {
                return [];
              }
              return (ev.invitedSuppliers || []).map(supplier => ({ 
                eventId: ev.id, 
                eventName: ev.name, 
                supplierName: supplier,
                supplierEmail: supplier
              }));
            });
        }
        setEventSupplierPairs(pairs);
        if (pairs.length > 0 && !selectedPair) {
          setSelectedPair(pairs[0]);
        }
      }
    };
    
    fetchEventsAndSuppliers();
  }, [user.isSupplier, user.name, adminId]);

  // Auto-select the first conversation when eventSupplierPairs changes
  useEffect(() => {
    if (eventSupplierPairs.length > 0) {
      // Find the most recent conversation
      const mostRecent = [...eventSupplierPairs].sort((a, b) => {
        const aMessages = allMessages.filter(m => 
          m.event_id === a.eventId && 
          (m.supplier_email === (a.supplierEmail || a.supplierName) ||
           m.sender === (a.supplierEmail || a.supplierName) ||
           m.receiver === (a.supplierEmail || a.supplierName))
        );
        
        const bMessages = allMessages.filter(m => 
          m.event_id === b.eventId && 
          (m.supplier_email === (b.supplierEmail || b.supplierName) ||
           m.sender === (b.supplierEmail || b.supplierName) ||
           m.receiver === (b.supplierEmail || b.supplierName))
        );
        
        const aLatest = aMessages[aMessages.length - 1]?.timestamp || 0;
        const bLatest = bMessages[bMessages.length - 1]?.timestamp || 0;
        return new Date(bLatest) - new Date(aLatest);
      });
      
      // Only update if the selected pair is not in the current pairs or if none is selected
      if (!selectedPair || !eventSupplierPairs.some(pair => 
        pair.eventId === selectedPair.eventId && 
        (pair.supplierEmail === selectedPair.supplierEmail || 
         pair.supplierName === selectedPair.supplierName)
      )) {
        setSelectedPair(mostRecent[0]);
      }
    } else if (eventSupplierPairs.length === 0 && selectedPair) {
      setSelectedPair(null);
    }
  }, [eventSupplierPairs, allMessages, selectedPair]);

  // Fetch messages from Supabase
  const fetchMessages = useCallback(async () => {
    try {
      // Bail early if we don't have what we need
      if (!selectedPair?.eventId) {
        console.log('No event selected, skipping message fetch');
        return;
      }

      let query = supabase
        .from('messages')
        .select('*')
        .eq('event_id', selectedPair.eventId)
        .order('timestamp', { ascending: true });

      if (user.isSupplier) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.email) {
          // For supplier, filter by their own email
          query = query.or(`supplier_email.eq.${authUser.email},sender.eq.${authUser.email},receiver.eq.${authUser.email}`);
        }
      } else if (adminId) {
        if (selectedPair?.supplierEmail || selectedPair?.supplierName) {
          // For admin, when a supplier is selected, get messages for that supplier and event
          const supplierEmail = selectedPair.supplierEmail || selectedPair.supplierName;
          query = query.or(`supplier_email.eq.${supplierEmail},sender.eq.${supplierEmail},receiver.eq.${supplierEmail}`);
        } else {
          // When no supplier is selected, get all messages for admin
          query = query.eq('admin_id', adminId);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error in fetchMessages query:', error);
        throw error;
      }
      
      console.log('Fetched messages:', data);
      if (data) {
        // Deduplicate messages
        const uniqueMessages = data.reduce((acc, current) => {
          const x = acc.find(item => item.id === current.id);
          if (!x) {
            return acc.concat([current]);
          } else {
            return acc;
          }
        }, []);
        setAllMessages(uniqueMessages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      // Fallback to local storage if available
      const localMessages = JSON.parse(localStorage.getItem('messages') || '[]');
      setAllMessages(localMessages);
    }
  }, [adminId, user.isSupplier, selectedPair?.eventId, selectedPair?.supplierEmail, selectedPair?.supplierName]);

  // Set up real-time subscription for new messages
  // Enhanced polling fallback with better error handling
  useEffect(() => {
    if (!selectedPair?.eventId) {
      console.log('Skipping polling - no event selected');
      return;
    }
    
    console.log('🔄 Setting up polling for event:', selectedPair.eventId);
    
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 3000; // 3 seconds
    
    const fetchWithRetry = async () => {
      if (!isMounted) return;
      
      try {
        console.log(`🔍 Polling messages (attempt ${retryCount + 1}/${maxRetries})...`);
        await fetchMessages();
        retryCount = 0; // Reset retry count on success
      } catch (error) {
        console.error('❌ Polling error:', error);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          console.error('Max retries reached, giving up');
          return;
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`⏳ Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        fetchWithRetry();
      }
    };
    
    // Initial fetch
    fetchWithRetry();
    
    // Set up polling
    const pollInterval = setInterval(fetchWithRetry, baseDelay);
    
    return () => {
      console.log('🧹 Cleaning up polling');
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [selectedPair?.eventId, fetchMessages]);
    
  // Real-time subscription (kept for when WebSocket works)
  useEffect(() => {
    if (!selectedPair?.eventId) return;
    
    console.log('Setting up real-time subscription for event:', selectedPair.eventId);
    
    const channelName = `messages:${selectedPair.eventId}:${adminId || 'admin'}`;
    console.log('Using channel name:', channelName);
    
    // Handle new incoming messages with detailed logging
    const handleNewMessage = async (payload) => {
      console.log('New message payload received:', payload);
      
      if (payload.eventType !== 'INSERT') {
        console.log('Ignoring non-INSERT event');
        return;
      }
      
      const newMessage = payload.new;
      console.log('Processing new message:', newMessage);
      
      // Check if this message is relevant to the current conversation
      let isRelevant = false;
      
      if (user.isSupplier) {
        // Supplier should receive messages where they are the recipient
        isRelevant = (
          newMessage.sender_type === 'admin' && 
          newMessage.receiver === user.email
        );
        console.log('Supplier message relevance check:', { 
          isRelevant, 
          senderType: newMessage.sender_type,
          receiver: newMessage.receiver,
          userEmail: user.email
        });
      } else {
        // Admin should receive messages where they are the recipient or it's a broadcast
        isRelevant = (
          (newMessage.sender_type === 'supplier' && 
           newMessage.supplier_email === selectedPair.supplierEmail) ||
          newMessage.receiver === adminId
        );
        console.log('Admin message relevance check:', { 
          isRelevant, 
          senderType: newMessage.sender_type,
          supplierEmail: newMessage.supplier_email,
          selectedSupplier: selectedPair.supplierEmail,
          receiver: newMessage.receiver,
          adminId
        });
      }
      
      if (!isRelevant) {
        console.log('Message not relevant to current context, ignoring');
        return;
      }
      
      console.log('Adding new message to UI:', newMessage);
      
      // Update the UI with the new message
      setAllMessages(prev => {
        // Check for duplicates using both ID and timestamp
        const exists = prev.some(msg => 
          msg.id === newMessage.id || 
          (msg.timestamp === newMessage.timestamp && 
           msg.sender === newMessage.sender)
        );
        
        if (exists) {
          console.log('Duplicate message detected, ignoring');
          return prev;
        }
        
        console.log('Adding new message to state');
        return [...prev, newMessage];
      });
      
      // Mark as read if we're the recipient
      const isRecipient = newMessage.receiver === (user.isSupplier ? user.email : adminId);
      if (isRecipient) {
        console.log('Marking message as read:', newMessage.id);
        try {
          await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('id', newMessage.id);
          console.log('Message marked as read');
        } catch (error) {
          console.error('Error marking message as read:', error);
        }
      }
    };
    
    // Set up the subscription with simplified filter
    console.log('Setting up subscription for event:', selectedPair.eventId);
    if (user.isSupplier) {
      console.log('Supplier mode - will receive admin_to_supplier messages');
    } else {
      console.log('Admin mode - will receive supplier_to_admin messages for supplier:', selectedPair.supplierEmail);
    }
    
    let channel;
    try {
      channel = supabase.channel(channelName, {
        config: {
          broadcast: { ack: true, self: true },
          presence: { key: user.isSupplier ? `supplier:${user.email}` : `admin:${adminId}` }
        }
      });
      
      // Subscribe to all message inserts for this event
      channel = channel
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `event_id=eq.${selectedPair.eventId}`
        }, handleNewMessage)
        .on('system', { event: 'disconnect' }, () => {
          console.log('Disconnected from real-time updates');
        })
        .on('system', { event: 'reconnect' }, () => {
          console.log('Reconnected to real-time updates');
        })
        .subscribe((status) => {
          console.log('Subscription status:', status);
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('Subscription error, attempting to resubscribe...');
            // The Supabase client will automatically attempt to reconnect
          } else if (status === 'SUBSCRIBED') {
            console.log('Successfully subscribed to real-time updates');
          }
        });
        
      console.log('Subscription set up successfully');
    } catch (error) {
      console.error('Error setting up subscription:', error);
      return; // Exit if we can't set up the subscription
    }
    
    // Initial fetch
    fetchMessages().catch(console.error);
    
    // Cleanup function
    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [selectedPair?.eventId, selectedPair?.supplierEmail, adminId, user.isSupplier, user.email, fetchMessages]);

  // Filter messages for selected event/supplier pair
  const filteredMessages = useMemo(() => {
    if (!selectedPair || !allMessages || allMessages.length === 0) return [];
    
    console.log('Filtering messages:', allMessages.length, 'total messages');
    console.log('Selected pair:', selectedPair);
    
    // Create a Set of seen message IDs to prevent duplicates
    const seenIds = new Set();
    
    const filtered = allMessages.filter(msg => {
      // Skip if we've already included this message
      if (seenIds.has(msg.id)) return false;
      seenIds.add(msg.id);
      
      // Always match by event ID first
      const matchesEvent = msg.event_id === selectedPair.eventId;
      if (!matchesEvent) return false;
      
      // For suppliers, match if they are the sender or receiver
      if (user.isSupplier) {
        const supplierEmail = localStorage.getItem('supplierEmail') || user.email || '';
        return (
          msg.sender === supplierEmail || 
          msg.receiver === supplierEmail || 
          msg.supplier_email === supplierEmail
        );
      } else {
        // For admin, if a specific supplier is selected, only show messages with that supplier
        if (selectedPair.supplierEmail || selectedPair.supplierName) {
          const supplierIdentifier = selectedPair.supplierEmail || selectedPair.supplierName;
          return (
            msg.sender === supplierIdentifier || 
            msg.receiver === supplierIdentifier || 
            msg.supplier_email === supplierIdentifier
          );
        } else {
          // If no specific supplier is selected, show all messages for this event where admin is involved
          return msg.admin_id === adminId;
        }
      }
    });
    
    console.log('Filtered messages:', filtered.length);
    return filtered;
  }, [allMessages, selectedPair, user.isSupplier, user.email, adminId]);

  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedPair) return;

    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) throw new Error('Not authenticated');

      // Determine sender and receiver based on user type
      const sender = user.isSupplier ? authUser.email : adminId;
      const receiver = user.isSupplier ? adminId : (selectedPair.supplierEmail || selectedPair.supplierName);
      const supplierEmail = selectedPair.supplierEmail || selectedPair.supplierName;

      // Create the message object with all required fields and message_type
      const newMessage = {
        event_id: selectedPair.eventId,
        supplier_email: supplierEmail,
        sender: sender,
        receiver: receiver,
        content: inputValue.trim(),
        admin_id: user.isSupplier ? adminId : authUser.id,
        timestamp: new Date().toISOString(),
        sender_type: user.isSupplier ? 'supplier' : 'admin',
        message_type: user.isSupplier ? 'supplier_to_admin' : 'admin_to_supplier',
        is_read: false,
        metadata: JSON.stringify({
          sent_from: 'messages_page',
          event_name: selectedPair.eventName,
          timestamp: new Date().toISOString()
        })
      };

      // Insert the message
      const { data, error } = await supabase
        .from('messages')
        .insert([newMessage])
        .select();

      if (error) throw error;
      
      // Update local state immediately for better UX
      if (data && data[0]) {
        setAllMessages(prev => [...prev, data[0]]);
      }
      
      setInputValue('');
      
      // Create a notification for the receiver
      try {
        await supabase.from('notifications').insert([{
          user_id: user.isSupplier ? adminId : null,
          supplier_email: user.isSupplier ? null : supplierEmail,
          event_id: selectedPair.eventId,
          type: 'new_message',
          content: `New message from ${user.isSupplier ? 'supplier' : 'admin'}: ${inputValue.trim().substring(0, 50)}${inputValue.trim().length > 50 ? '...' : ''}`,
          admin_user_id: user.isSupplier ? adminId : authUser.id
        }]);
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
        // Don't fail the message send if notification fails
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  // Check if user is authenticated before rendering
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      if (!session) {
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate]);

  if (!isAuthenticated) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

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
              className={`nav-btn ${activeNav === item.name ? 'active' : ''}`}
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

      <main className="content-area">
        <header className="content-header">
          <div className="header-left">
            <div className="welcome-section">
              <h1 className="welcome-text">Welcome,</h1>
              <UserProfile showName={true} />
            </div>

          </div>
        </header>
      </main>

      <h2 className="section-title">My Messages</h2>
      <div className="container">
        {/* Sidebar for Event/Supplier Pairs */}
        <div className="sidebar">
          {eventSupplierPairs.length === 0 && (
            <div className="event" style={{color:'#999'}}>No conversations</div>
          )}
          {eventSupplierPairs.map((pair, idx) => (
            <div
              key={pair.eventId + pair.supplierName}
              className={`event${selectedPair && pair.eventId === selectedPair.eventId && pair.supplierName === selectedPair.supplierName ? ' active' : ''}`}
              style={{cursor:'pointer', background: selectedPair && pair.eventId === selectedPair.eventId && pair.supplierName === selectedPair.supplierName ? '#fff' : undefined, color: '#441752'}}
              onClick={() => setSelectedPair(pair)}
            >
              <div style={{fontWeight:'bold'}}>{pair.eventName}</div>
              <div style={{fontSize:'14px', color:'#441752'}}>{pair.supplierName}</div>
            </div>
          ))}
        </div>

        {/* Chat Container */}
        <div className="chat-box">
          {/* Supplier Name */}
          <div className="supplier-name">
            {selectedPair ? (
              <>
                <span style={{fontWeight:600}}>{selectedPair.eventName}</span>
                <span style={{fontWeight:400, marginLeft:8}}>/ {selectedPair.supplierName}</span>
              </>
            ) : 'Select a conversation'}
          </div>
          {/* Chat Messages */}
          <div className="chat-messages" style={{overflowY:'auto', flex: 1, minHeight: 0}}>
            {filteredMessages.length === 0 && (
              <div style={{color:'#999', textAlign:'center', marginTop:'40px'}}>No messages yet. Start the conversation!</div>
            )}
            {filteredMessages.map(msg => {
              // Determine if the current user is the sender
              const isCurrentUser = user.name === msg.sender || 
                                 (user.isSupplier && msg.sender === msg.supplier_email) ||
                                 (!user.isSupplier && msg.sender === adminId);
              
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: isCurrentUser ? 'row-reverse' : 'row',
                    marginBottom: '10px',
                    alignItems: 'flex-end'
                  }}
                >
                  {!isCurrentUser && (
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#f0e6f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '8px',
                      color: '#441752',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}>
                      {msg.sender ? msg.sender.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <div
                    style={{
                      background: isCurrentUser ? '#441752' : '#fff',
                      color: isCurrentUser ? '#fff' : '#441752',
                      borderRadius: '16px',
                      padding: '10px 16px',
                      maxWidth: '60%',
                      fontSize: '15px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                      marginLeft: isCurrentUser ? 0 : '8px',
                      marginRight: isCurrentUser ? '8px' : 0,
                    }}
                  >
                    {!isCurrentUser && (
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        marginBottom: '4px',
                        color: isCurrentUser ? '#ddd' : '#A888B5'
                      }}>
                        {msg.sender === adminId ? 'Admin' : msg.sender}
                      </div>
                    )}
                    {msg.content}
                    <div style={{
                      fontSize: '11px', 
                      color: isCurrentUser ? 'rgba(255,255,255,0.7)' : '#A888B5', 
                      marginTop: '4px', 
                      textAlign: 'right',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>
                        {msg.is_read && isCurrentUser && (
                          <span style={{ marginRight: '4px' }}>✓✓</span>
                        )}
                      </span>
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                  {isCurrentUser && (
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#f0e6f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: '8px',
                      color: '#441752',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}>
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Message Input (sticks to bottom) */}
          <div className="message-input" style={{marginTop: 0}}>
            <input
              type="text"
              placeholder="Message"
              className="message-field"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }}
              disabled={!selectedPair}
            />
            <button className="send-button" onClick={handleSendMessage} disabled={!selectedPair || !inputValue.trim()}>Send</button>
          </div>
        </div>
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

        /* Top Navigation Styles */
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

        /* User profile styles now handled by UserProfile component */
        .user-avatar {
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 500;
        }

        /* Main Content Styles */
        .content-area {
          padding: 32px 40px;
          margin-top: 64px;
        }

        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
        }

        .header-left {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .welcome-section {
          margin-bottom: 16px;
        }

        .welcome-text {
          font-size: 32px;
          color: #441752;
          margin: 0;
        }

        /* User name styles now handled by UserProfile */

        .action-btns {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .primary-btn {
          padding: 10px 24px;
          background: var(--primary-blue);
          color: #A888B5;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .primary-btn:hover {
          background: var(--hover-blue);
          transform: translateY(-1px);
        }

        .section-title {
          font-size: 24px;
          color: #441752;
          margin-left: 40px;
        }
        
        .container {
          display: flex;
          height: 100vh;
          background-color: #A888B5;
          font-family: 'Inter', sans-serif;
        }

        .sidebar {
          width: 20%;
          display: flex;
          flex-direction: column;
          border-right: 2px solid #441752;
          background-color: #A888B5;
          padding: 8px;
        }

        /* Responsive Styles */
        @media (max-width: 900px) {
          .content-area {
            padding: 24px 10px;
          }
          .content-header {
            flex-direction: column;
            gap: 16px;
          }
          .header-left {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }
        }

        @media (max-width: 700px) {
          .container {
            flex-direction: column;
            height: auto;
          }
          .sidebar {
            width: 100%;
            min-width: 0;
            border-right: none;
            border-bottom: 2px solid #441752;
            flex-direction: row;
            overflow-x: auto;
            padding: 0 4px;
          }
          .event {
            min-width: 120px;
            padding: 12px 8px;
            font-size: 14px;
            border-bottom: none;
            border-right: 2px solid #441752;
          }
          .chat-box {
            width: 100%;
            min-width: 0;
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
          .content-area {
            padding: 12px 2vw;
            margin-top: 0;
          }
          .section-title {
            font-size: 17px;
            margin-left: 12px;
          }
          .welcome-text {
            font-size: 22px;
          }
          .primary-btn {
            padding: 8px 14px;
            font-size: 12px;
          }
          .sidebar {
            font-size: 13px;
          }
          .supplier-name {
            padding: 8px;
            font-size: 15px;
          }
          .chat-messages {
            font-size: 13px;
          }
          .message-input {
            flex-direction: column;
            gap: 6px;
          }
          .message-field {
            font-size: 13px;
          }
          .send-button {
            font-size: 13px;
            padding: 6px 10px;
          }
        }

        .sidebar {
          width: 20%;
          display: flex;
          flex-direction: column;
          border-right: 2px solid #441752;
          background-color: #A888B5;
          padding: 8px;
        }

        .event {
          padding: 16px;
          font-weight: bold;
          border-bottom: 2px solid  #441752;
          background-color: #A888B5;
          color:  #441752;
        }

        .chat-box {
          display: flex;
          flex-direction: column;
          width: 80%;
          background-color: #A888B5;
        }

        .supplier-name {
          padding: 12px;
          font-weight: bold;
          border-bottom: 2px solid  #441752;
          background-color: #A888B5;
          color:  #441752;
        }

        .chat-messages {
          flex-grow: 1;
          padding: 16px;
        }

        .message-input {
          display: flex;
          border-top: 2px solid  #441752;
          padding: 8px;
          background-color: #A888B5;
        }

        .message-field {
          flex-grow: 1;
          padding: 8px;
          border: 2px solid  #441752;
          background-color: #A888B5;
        }

        .send-button {
          background-color:  #441752;
          color: #A888B5;
          padding: 8px 16px;
          margin-left: 8px;
          border: none;
          cursor: pointer;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default MessagesPage;
