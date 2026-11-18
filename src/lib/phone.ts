// Phone numbers are stored and texted in international form without "+"
// (233241234567), the form SMSOnlineGH expects. Local Ghana numbers
// (024 123 4567) are converted; other countries need a leading "+".
export function smsNumber(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  const plain = digits.replace(/^\+/, "");
  if (/^0\d{9}$/.test(plain)) return `233${plain.slice(1)}`;
  if (/^233\d{9}$/.test(plain)) return plain;
  if (/^[2-5]\d{8}$/.test(plain)) return `233${plain}`;
  if (digits.startsWith("+") && /^\d{10,15}$/.test(plain)) return plain;
  return null;
}
// Shown to people: 233241234567 → +233 24 123 4567.
export function displayPhone(phone: string) {
  return /^233\d{9}$/.test(phone)
    ? `+233 ${phone.slice(3, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`
    : `+${phone}`;
}
