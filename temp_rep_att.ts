export function replaceAllAttendancesFromCloud(attendances: AttendanceRecord[]): void {
  initializeStorage();
  attendanceCache = [...attendances];
  localStorage.setItem(STORAGE_KEYS.ATTENDANCES, JSON.stringify(attendanceCache));
  attendanceListeners.forEach((fn) => fn([...attendanceCache]));
}
