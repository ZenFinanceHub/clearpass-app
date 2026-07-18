export function generateInstructorCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function generateReferralCode(username: string): string {
  const prefix = username.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  const digits = Math.floor(100 + Math.random() * 900).toString();
  return prefix + digits;
}
