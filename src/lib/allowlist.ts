export const ALLOWED_APPLICATION_EMAIL = "santigs211@gmail.com";

export function isAllowedApplicationEmail(email: string | null | undefined) {
  return email?.toLowerCase() === ALLOWED_APPLICATION_EMAIL;
}

export function validateUserInfo(userInfo: { email?: string | null }) {
  return isAllowedApplicationEmail(userInfo.email);
}
