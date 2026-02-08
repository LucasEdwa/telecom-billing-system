// Enhanced password validation with security requirements
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/(?=.*\d)/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Common password patterns
  const commonPatterns = [
    /123456/, /password/, /qwerty/, /abc123/, /admin/, /letmein/,
    /welcome/, /monkey/, /dragon/, /master/, /login/, /pass/
  ];
  
  if (commonPatterns.some(pattern => pattern.test(password.toLowerCase()))) {
    errors.push('Password contains common patterns and is not secure');
  }
  
  // Sequential characters
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password)) {
    errors.push('Password cannot contain sequential characters');
  }
  
  // Repetitive characters
  if (/(..).*\1/.test(password)) {
    errors.push('Password cannot contain repetitive patterns');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
