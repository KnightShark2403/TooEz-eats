const KEY = "tooez_student_name";

export function getStudentName() {
  return localStorage.getItem(KEY) || "";
}

export function setStudentName(name) {
  localStorage.setItem(KEY, name.trim());
}
