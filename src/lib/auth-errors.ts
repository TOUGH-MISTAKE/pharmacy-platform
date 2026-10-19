/**
 * Turns technical Supabase error messages into friendly sentences for patients.
 */
export function friendlyAuthError(message: string): string {
  const text = message.toLowerCase();

  if (text.includes("invalid login credentials")) {
    return "Incorrect email or password. Please try again.";
  }
  if (text.includes("email not confirmed")) {
    return "Please confirm your email address first. Check your inbox for the link we sent you.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (text.includes("different from the old password") || text.includes("same password")) {
    return "Your new password must be different from your old one.";
  }
  if (text.includes("password") && (text.includes("characters") || text.includes("weak"))) {
    return "That password is too weak. Use at least 8 characters with letters and numbers.";
  }
  if (text.includes("fetch") || text.includes("network")) {
    return "We could not reach the server. Check your internet connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
