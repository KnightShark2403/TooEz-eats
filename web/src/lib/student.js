import { getUser } from "./auth.js";

export function getStudentName() {
  return getUser()?.name || "";
}
