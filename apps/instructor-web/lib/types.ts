// Deliberately duplicated rather than imported from packages/core — see
// apps/mobile/server/README.md. This app imports nothing from outside its
// own directory, so a small local copy of the shape this table already has
// (apps/mobile/supabase/schema.sql) costs a few lines and avoids a
// deployment boundary that has already caused two production incidents.
export type InstructorSeat = {
  id: string;
  stripe_checkout_session_id: string;
  invite_token: string;
  redeemed_by: string | null;
  redeemed_at: string | null;
  pro_expires_at: string | null;
  created_at: string;
};

export function seatInviteLink(token: string): string {
  return `https://instructors.getclearpass.co.uk/redeem/${token}`;
}
