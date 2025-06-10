import { supabase } from '../supabaseClient';

/**
 * Update the event_suppliers table to add supplier_user_id for any entries that match the supplier's email
 * This ensures that suppliers can see their events after email verification or subsequent logins
 * 
 * @param {string} userId - The user ID of the supplier
 * @param {string} userEmail - The email of the supplier
 * @returns {Promise<{success: boolean, message: string}>} - Result of the operation
 */
export async function updateEventSuppliersWithUserId(userId, userEmail) {
  if (!userId || !userEmail) {
    console.error('updateEventSuppliersWithUserId: Missing userId or userEmail');
    return { success: false, message: 'Missing userId or userEmail' };
  }

  try {
    console.log(`Updating event_suppliers entries for email ${userEmail} with user ID ${userId}`);
    
    // First, find all event_suppliers entries for this email that don't have a user ID
    const { data: entries, error: fetchError } = await supabase
      .from('event_suppliers')
      .select('*')
      .eq('supplier_email', userEmail)
      .is('supplier_user_id', null);
    
    if (fetchError) {
      console.error('Error fetching event_suppliers entries:', fetchError);
      return { success: false, message: 'Error fetching entries', error: fetchError };
    }

    console.log(`Found ${entries?.length || 0} event_suppliers entries to update`);
    
    if (!entries || entries.length === 0) {
      // No entries to update, but this isn't an error
      return { success: true, message: 'No entries needed updating' };
    }
    
    // Update all entries with the user ID
    const { error: updateError } = await supabase
      .from('event_suppliers')
      .update({ supplier_user_id: userId })
      .eq('supplier_email', userEmail)
      .is('supplier_user_id', null);
    
    if (updateError) {
      console.error('Error updating event_suppliers entries:', updateError);
      return { success: false, message: 'Error updating entries', error: updateError };
    }
    
    console.log(`Successfully updated ${entries.length} event_suppliers entries`);
    return { success: true, message: `Updated ${entries.length} entries` };
  } catch (err) {
    console.error('Unexpected error updating event_suppliers:', err);
    return { success: false, message: 'Unexpected error', error: err };
  }
}
