import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const NotificationBell = ({ userType, userId, supplierEmail }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  console.log('NotificationBell rendered with:', { userType, userId, supplierEmail });

  // Fetch notifications based on user type
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        let query;
        
        if (userType === 'admin' && userId) {
          // For admin users - get notifications where they are the target
          query = supabase
            .from('notifications')
            .select(`
              *,
              events:event_id (name)
            `)
            .eq('admin_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);
        } else if (userType === 'supplier' && supplierEmail) {
          // For suppliers - get notifications addressed to their email
          const normalizedEmail = supplierEmail.toLowerCase().trim();
          
          query = supabase
            .from('notifications')
            .select(`
              *
            `)
            .eq('supplier_email', normalizedEmail)
            .in('type', ['invitation', 'application_accepted']) // Get both notification types
            .order('created_at', { ascending: false })
            .limit(10);
        }

        if (query) {
          console.log(`Executing notification query for ${userType}:`, 
            userType === 'supplier' ? `supplier_email = ${supplierEmail.toLowerCase().trim()}` : `admin_user_id = ${userId}`);
          
          const { data, error } = await query;
          if (error) {
            console.error('Error fetching notifications:', error);
            throw error;
          }
          
          console.log('Raw notification data for', userType, ':', data);
          
          // Process notifications without fetching missing event details
          // since events table is empty and causes 406 errors
          const processedData = data || [];
          
          setNotifications(processedData);
          setUnreadCount((processedData || []).filter(n => n.status === 'unread').length);
          
          // DEBUG ONLY: If this is a supplier and they have no notifications, try direct DB access
          if (userType === 'supplier' && (!processedData || processedData.length === 0)) {
            console.log('No notifications found for supplier. Checking RLS permissions...');
            // Check if there are actually any notifications in the table for this email
            try {
              // Check currently logged-in user
              const { data: userData, error: userError } = await supabase.auth.getUser();
              console.log('Current authenticated user:', userData?.user?.email || 'No user found');
              console.log('User metadata:', userData?.user?.user_metadata);
              console.log('Comparing with supplierEmail prop:', supplierEmail);
              
              // Check auth email matches query email
              if (userData?.user?.email?.toLowerCase() !== supplierEmail?.toLowerCase().trim()) {
                console.error('AUTH MISMATCH: The authenticated user email does not match the supplied email in the component');
                console.log(`Auth email: ${userData?.user?.email?.toLowerCase() || 'none'}, Component email: ${supplierEmail?.toLowerCase().trim() || 'none'}`);
                console.log('This will cause RLS policy failure since auth.email() != supplier_email');
              }
              
              // Try to directly count notifications
              const { count, error: countError } = await supabase
                .from('notifications')
                .select('*', { count: 'exact' })
                .eq('supplier_email', supplierEmail.toLowerCase().trim());
              
              if (countError) {
                console.error('Error checking notification count:', countError);
              } else {
                console.log(`Database has ${count || 0} notifications for email ${supplierEmail.toLowerCase().trim()}`);
                
                // Try to list all notifications regardless of email to check permissions
                console.log('Attempting to query ALL notifications to test permissions...');
                const { data: allNotifications, error: allError } = await supabase
                  .from('notifications')
                  .select('*');
                  
                if (allError) {
                  console.error('Error querying all notifications:', allError);
                  console.log('This confirms RLS policy is active and blocking access');
                } else {
                  console.log(`Found ${allNotifications?.length || 0} total notifications with unrestricted query`);
                  if (allNotifications && allNotifications.length > 0) {
                    // Find any that match this supplier
                    const matching = allNotifications.filter(n => 
                      n.supplier_email?.toLowerCase() === supplierEmail?.toLowerCase().trim());
                    console.log(`Found ${matching.length} notifications matching this supplier email`);
                    if (matching.length > 0) {
                      console.log('First matching notification:', matching[0]);
                    }
                  }
                }
                
                // Create test notification if none exist
                if (count === 0) {
                  console.log('Attempting to create a test notification');
                  const testNotification = {
                    supplier_email: supplierEmail.toLowerCase().trim(),
                    type: 'invitation',
                    status: 'unread',
                    created_at: new Date().toISOString()
                    // NOTE: 'message' field removed - not in actual schema
                  };
                  
                  const { error: insertError } = await supabase
                    .from('notifications')
                    .insert([testNotification]);
                    
                  if (insertError) {
                    console.error('Failed to insert test notification:', insertError);
                    console.log('This suggests an RLS policy issue - supplier does not have INSERT permission');
                  } else {
                    console.log('Test notification created successfully. Refresh to see it.');
                  }
                } else {
                  console.log('Notifications exist in the database but are not being returned to the client.');
                  console.log('This suggests an RLS policy issue - supplier does not have SELECT permission');
                }
              }
            } catch (err) {
              console.error('Error in notification debug code:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    };

    // Only setup if we have the required parameters
    if ((userType === 'admin' && userId) || (userType === 'supplier' && supplierEmail)) {
      fetchNotifications();
    }
  }, [userType, userId, supplierEmail]);
  
  // Create a separate effect for the subscription to better control its lifecycle
  useEffect(() => {
    let subscription = null;
    
    // Generate a unique channel name to avoid conflicts
    const channelName = `notification-changes-${userType}-${userId || supplierEmail}`;
    
    if ((userType === 'admin' && userId) || (userType === 'supplier' && supplierEmail)) {
      // Set up real-time subscription
      const filter = userType === 'admin' 
        ? `admin_user_id=eq.${userId}` 
        : `supplier_email=eq.${supplierEmail}`;
      
      try {
        subscription = supabase
          .channel(channelName)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: filter
          }, async (payload) => {
            // Refresh notifications when we get an event
            try {
              let query;
              
              if (userType === 'admin' && userId) {
                query = supabase
                  .from('notifications')
                  .select(`
                    *,
                    events:event_id (name)
                  `)
                  .eq('admin_user_id', userId)
                  .order('created_at', { ascending: false })
                  .limit(10);
              } else if (userType === 'supplier' && supplierEmail) {
                const normalizedEmail = supplierEmail.toLowerCase().trim();
                
                query = supabase
                  .from('notifications')
                  .select(`
                    *
                  `)
                  .eq('supplier_email', normalizedEmail)
                  .in('type', ['invitation', 'application_accepted'])
                  .order('created_at', { ascending: false })
                  .limit(10);
              }

              if (query) {
                const { data, error } = await query;
                if (error) throw error;
                
                console.log('Raw notification data for', userType, ':', data);
                
                // Process notifications without fetching missing event details
                // since events table is empty and causes 406 errors
                const processedData = data || [];
                
                setNotifications(processedData);
                setUnreadCount((processedData || []).filter(n => n.status === 'unread').length);
              }
            } catch (err) {
              console.error('Error refreshing notifications:', err);
            }
          })
          .subscribe();
      } catch (err) {
        console.error('Error setting up notification subscription:', err);
      }
    }
        
    return () => {
      // Clean up subscription when component unmounts or dependencies change
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [userType, userId, supplierEmail]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Mark notifications as read
  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('id', notificationId);
        
      if (error) throw error;
      
      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, status: 'read' } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      let matchClause = {};
      if (userType === 'admin' && userId) {
        matchClause = { admin_user_id: userId };
      } else if (userType === 'supplier' && supplierEmail) {
        const normalizedEmail = supplierEmail.toLowerCase().trim();
        matchClause = { supplier_email: normalizedEmail };
      }
      
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .match(matchClause)
        .eq('status', 'unread');
        
      if (error) throw error;
      
      // Update local state
      setNotifications(notifications.map(n => ({ ...n, status: 'read' })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  // Format the notification message based on type
  const formatNotificationMessage = (notification) => {
    // Get event name with priority order: events join data, event_id fallback
    const eventName = notification.events?.name || 
                     (notification.event_id ? `Event ID: ${notification.event_id}` : 'Unknown event');
    
    if (userType === 'admin' && notification.type === 'application') {
      return `A supplier (${notification.supplier_email}) has applied to your event "${eventName}"`;
    } else if (userType === 'supplier' && notification.type === 'invitation') {
      return `You've been invited to the event "${eventName}"`;
    } else if (userType === 'supplier' && notification.type === 'application_accepted') {
      return `Your application to the event "${eventName}" has been accepted!`;
    }
    
    // More detailed fallback with notification type info
    return `${notification.type || 'New'} notification for event "${eventName}"`;
  };

  // Format timestamp to relative time
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notification-bell-container" style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="notification-bell-button"
        style={{
          background: 'none',
          border: 'none',
          color: '#fff',
          fontSize: '18px',
          cursor: 'pointer',
          position: 'relative',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 8px'
        }}
        aria-label="Notifications"
      >
        {/* Bell Icon */}
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        
        {/* Notification Badge */}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0',
            right: '0',
            backgroundColor: '#ff4757',
            color: 'white',
            borderRadius: '50%',
            width: '16px',
            height: '16px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          ref={dropdownRef}
          className="notification-dropdown"
          style={{
            position: 'absolute',
            top: '40px',
            right: '0',
            width: '320px',
            maxHeight: '400px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: '1000',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #eee',
            backgroundColor: '#f8f9fa'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#441752', fontWeight: '600' }}>
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  color: '#441752',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontWeight: '500'
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={{ 
            overflowY: 'auto',
            flex: '1',
            maxHeight: '320px'
          }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#666' }}>
                No notifications yet
              </div>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id}
                  onClick={() => notification.status === 'unread' && markAsRead(notification.id)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #eee',
                    backgroundColor: notification.status === 'unread' ? '#f0f4ff' : 'white',
                    cursor: notification.status === 'unread' ? 'pointer' : 'default',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <div style={{ fontSize: '14px', color: '#333', marginBottom: '4px' }}>
                    {formatNotificationMessage(notification)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {formatRelativeTime(notification.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
