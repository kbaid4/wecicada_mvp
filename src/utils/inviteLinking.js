// Utility to link supplier to invited events and update invite status
// Usage: await linkSupplierInvites(supplierId, supplierEmail, supabase)

export async function linkSupplierInvites(arg1, arg2, arg3) {
  // Support both: (supplierId, supplierEmail, supabase) and ({ supplierId, supplierEmail }, optionalSupabase)
  let supplierId, supplierEmail, supabaseInstance;
  if (typeof arg1 === 'object' && arg1 !== null && !Array.isArray(arg1)) {
    // Called as ({ supplierId, supplierEmail }, supabase?)
    supplierId = arg1.supplierId;
    supplierEmail = arg1.supplierEmail;
    supabaseInstance = arg2 || (typeof window !== 'undefined' ? window.supabase : undefined);
  } else {
    // Called as (supplierId, supplierEmail, supabase)
    supplierId = arg1;
    supplierEmail = arg2;
    supabaseInstance = arg3 || (typeof window !== 'undefined' ? window.supabase : undefined);
  }
  if (!supplierId || !supplierEmail) {
    console.warn('linkSupplierInvites: Missing supplierId or supplierEmail');
    return;
  }
  const supabase = supabaseInstance || (await import('../supabaseClient')).supabase;
  // 1. Find pending invites for this supplier (by email)
  const { data: invites, error: inviteError } = await supabase
    .from('invites')
    .select('*')
    .eq('supplier_email', supplierEmail)
    .eq('status', 'pending');
  if (inviteError) {
    console.error('Error fetching pending invites:', inviteError);
    throw inviteError;
  }
  if (!invites || invites.length === 0) {
    console.log('No pending invites found for supplier:', supplierEmail);
    return;
  }

  for (const invite of invites) {
    // 2. Check if the event exists (FK constraint) in the new 'events' table
    const { data: eventRows, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('id', invite.event_id);
    if (eventError) {
      console.error('Error checking event existence:', eventError);
      throw eventError;
    }
    if (!eventRows || eventRows.length === 0) {
      console.warn('Event not found for invite:', invite.event_id);
      continue;
    }
    let skipInsert = false;
    let existingLink = null;
    let linkFetchError = null;
    try {
      const res = await supabase
        .from('event_suppliers')
        .select('id')
        .eq('event_id', invite.event_id)
        .eq('supplier_user_id', supplierId)
        .maybeSingle();
      existingLink = res.data;
      linkFetchError = res.error;
    } catch (err) {
      linkFetchError = err;
    }
    if (existingLink) {
      console.log('Supplier already linked to event:', invite.event_id);
      skipInsert = true;
    } else if (linkFetchError && linkFetchError.code !== 'PGRST116' && linkFetchError.code !== 'PGRST123' && linkFetchError.code !== 'PGRST116: No rows found') {
      // Only skip insert if the error is NOT 'no rows found' (Supabase returns PGRST116 for no rows)
      console.error('Error checking existing link:', linkFetchError);
      skipInsert = true;
    }
    if (!skipInsert) {
      const { error: linkInsertError } = await supabase
        .from('event_suppliers')
        .insert([
          {
            event_id: invite.event_id,
            supplier_user_id: supplierId,
            supplier_email: supplierEmail
          }
        ]);
      if (linkInsertError) {
        console.error('Error linking supplier to event:', linkInsertError);
        continue;
      } else {
        console.log('Linked supplier', supplierId, 'to event', invite.event_id);
      }
    }
    // 3. Update invite status to 'accepted' only if supplier was linked
    if (!skipInsert) {
      const { error: updateError } = await supabase
        .from('invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id);
      if (updateError) {
        console.error('Error updating invite status:', updateError);
      } else {
        console.log('Updated invite status to accepted for invite', invite.id);
      }
    } else {
      // If already linked, you may still want to update status if needed (optional)
      // Uncomment below if you want to always update status
      // await supabase.from('invites').update({ status: 'accepted' }).eq('id', invite.id);
    }
  }
}

