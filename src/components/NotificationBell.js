import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { FaBell, FaCheck, FaCheckDouble, FaTimes } from 'react-icons/fa';
import styled from 'styled-components';

// Styled components for better organization and theming
const NotificationContainer = styled.div`
  position: relative;
  margin: 0 8px;
`;

const BellButton = styled.button`
  background: none;
  border: none;
  color: #fff;
  font-size: 1.2rem;
  cursor: pointer;
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
    font-size: 1.1rem;
  }
`;

const Badge = styled.span`
  position: absolute;
  top: 2px;
  right: 2px;
  background-color: #ff4757;
  color: white;
  border-radius: 10px;
  min-width: 18px;
  height: 18px;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  padding: 0 4px;
  
  @media (max-width: 768px) {
    min-width: 16px;
    height: 16px;
    font-size: 0.6rem;
  }
`;

const Dropdown = styled.div`
  position: fixed;
  top: 60px;
  right: 20px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: ${({ isOpen }) => (isOpen ? 'translateY(0)' : 'translateY(-10px)')};
  opacity: ${({ isOpen }) => (isOpen ? '1' : '0')};
  visibility: ${({ isOpen }) => (isOpen ? 'visible' : 'hidden')};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  @media (min-width: 768px) {
    position: absolute;
    top: 50px;
    right: 0;
    width: 380px;
  }
  
  @media (max-width: 480px) {
    right: 10px;
    width: calc(100% - 20px);
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  color: #333;
  font-weight: 600;
`;

const MarkAllButton = styled.button`
  background: none;
  border: none;
  font-size: 0.8rem;
  color: #4a6cf7;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: rgba(74, 108, 247, 0.1);
  }
`;

const NotificationList = styled.div`
  overflow-y: auto;
  flex: 1;
  max-height: 400px;
  -webkit-overflow-scrolling: touch;
`;

const EmptyState = styled.div`
  padding: 32px 16px;
  text-align: center;
  color: #666;
  font-size: 0.9rem;
`;

const NotificationItem = styled.div`
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  background-color: ${({ unread }) => (unread ? '#f8f9ff' : 'white')};
  cursor: ${({ unread }) => (unread ? 'pointer' : 'default')};
  transition: background-color 0.2s, transform 0.1s;
  display: flex;
  flex-direction: column;
  gap: 4px;
  
  &:active {
    transform: scale(0.99);
  }
  
  &:hover {
    background-color: ${({ unread }) => (unread ? '#f0f4ff' : '#f9f9f9')};
  }
`;

const Message = styled.div`
  font-size: 0.9rem;
  color: #333;
  line-height: 1.4;
`;

const Time = styled.div`
  font-size: 0.75rem;
  color: #888;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const ReadIndicator = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #4a6cf7;
  margin-right: 4px;
`;

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
    // If content exists, check if it's an admin message and skip it
    if (notification.content) {
      // Check if the content matches the admin message pattern
      if (typeof notification.content === 'string' && notification.content.startsWith('New message from admin:')) {
        return null; // Skip admin messages
      }
      return notification.content;
    }
    
    // Skip message notifications from admin
    if (notification.type === 'message' && notification.sender_type === 'admin') {
      return null; // This will be filtered out in the render
    }
    
    // Fallback to generating a message based on type
    const eventName = notification.events?.name || 
                     (notification.event_id ? `Event ID: ${notification.event_id}` : 'Unknown event');
    
    if (userType === 'admin' && notification.type === 'application') {
      return `A supplier (${notification.supplier_email}) has applied to your event "${eventName}"`;
    } else if (userType === 'supplier' && notification.type === 'invitation') {
      return `You've been invited to the event "${eventName}"`;
    } else if (userType === 'supplier' && notification.type === 'application_accepted') {
      return `Your application to the event "${eventName}" has been accepted!`;
    } else if (notification.message) {
      // Fallback to message field if content is not available
      return notification.message;
    }
    
    // Default fallback
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

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <NotificationContainer>
      <BellButton 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <FaBell />
        {unreadCount > 0 && (
          <Badge>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </BellButton>

      <Dropdown 
        ref={dropdownRef}
        isOpen={isOpen}
        aria-hidden={!isOpen}
      >
        <Header>
          <Title>Notifications</Title>
          {unreadCount > 0 ? (
            <MarkAllButton onClick={markAllAsRead}>
              <FaCheckDouble size={12} />
              <span>Mark all as read</span>
            </MarkAllButton>
          ) : (
            <MarkAllButton onClick={() => setIsOpen(false)}>
              <FaTimes size={14} />
            </MarkAllButton>
          )}
        </Header>

        <NotificationList>
          {notifications.length === 0 ? (
            <EmptyState>No notifications yet</EmptyState>
          ) : (
            notifications
              .map(notification => {
                const message = formatNotificationMessage(notification);
                if (message === null) return null;
                
                const isUnread = notification.status === 'unread';
                
                return (
                  <NotificationItem
                    key={notification.id}
                    unread={isUnread}
                    onClick={() => isUnread && markAsRead(notification.id)}
                  >
                    <Message>
                      {isUnread && <ReadIndicator aria-hidden="true" />}
                      {message}
                    </Message>
                    <Time>
                      {isUnread && <FaCheck size={10} />}
                      {formatRelativeTime(notification.created_at)}
                    </Time>
                  </NotificationItem>
                );
              })
              .filter(Boolean)
          )}
        </NotificationList>
      </Dropdown>
    </NotificationContainer>
  );
};

export default NotificationBell;
