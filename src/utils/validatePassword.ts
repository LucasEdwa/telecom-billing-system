export const validatePassword = (password: string): boolean => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d[^A-Za-z\d]]{8,}$/;
  return passwordRegex.test(password);
}
