'use strict';

// Deletes every file an instructor has stored in the private
// instructor-documents bucket, under <uid>/ (see the payout-proof v2
// migration and POST /api/instructor/payout-proof). Storage objects are
// NOT covered by any table's ON DELETE CASCADE — deleting the profiles row
// removes instructor_payout_proofs' *database* row, but leaves the actual
// file sitting in storage forever unless something explicitly removes it.
// Every account-deletion path in this project (POST /api/delete-account,
// scripts/backfill-pro-source.js, scripts/seed-test-learners.js) must call
// this alongside its row deletions.
//
// `storage` is the object supabaseAdmin.storage.from('instructor-documents')
// itself returns — { list(prefix), remove(paths) } — injected so this is
// testable with a stub rather than a real Supabase Storage call. A user
// who never uploaded a proof has nothing to list; that's not an error.
async function deleteInstructorDocuments(storage, userId) {
  const { data: files, error: listError } = await storage.list(userId);
  if (listError) {
    return { error: listError, deletedCount: 0 };
  }
  if (!files || files.length === 0) {
    return { error: null, deletedCount: 0 };
  }

  const paths = files.map((f) => `${userId}/${f.name}`);
  const { error: removeError } = await storage.remove(paths);
  if (removeError) {
    return { error: removeError, deletedCount: 0 };
  }

  return { error: null, deletedCount: paths.length };
}

module.exports = { deleteInstructorDocuments };
