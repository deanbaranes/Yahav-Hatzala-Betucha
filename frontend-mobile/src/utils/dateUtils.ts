/**
 * Utility functions for handling and formatting dates safely to avoid timezone-related shifts,
 * particularly for YYYY-MM-DD string formats when working in negative UTC offset regions like the USA.
 */

/**
 * Formats a Date or a YYYY-MM-DD string into a local he-IL formatted date string (DD.MM.YYYY)
 * ignoring timezone shifts that would alter the literal date.
 */
export const formatLocalDate = (dateInput: string | Date | undefined | null): string => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
     const [year, month, day] = dateInput.trim().split('-');
     return `${day}.${month}.${year}`;
  }
  // Fallback for timestamps or Date objects
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return d.toLocaleDateString('he-IL');
};

/**
 * Returns today's date in YYYY-MM-DD format according to the actual local time of the user,
 * preventing forms from defaulting to "yesterday" when in negative UTC timezones.
 */
export const getLocalTodayISOString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Safely extracts a sorting key (YYYY-MM) and a localized Hebrew display month 
 * without risk of timezone shift modifying the month for day-1 edge cases.
 */
export const getSafeMonthYear = (dateInput: string | undefined | null): { sortKey: string, displayMonth: string } => {
  if (!dateInput) return { sortKey: '0000-00', displayMonth: '' };
  
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [year, month] = dateInput.trim().split('-');
    const m = parseInt(month, 10) - 1;
    const y = parseInt(year, 10);
    const d = new Date(y, m, 1); // 1st of the month locally! (Safe)
    return {
      sortKey: `${year}-${month}`,
      displayMonth: d.toLocaleString('he-IL', { month: 'long', year: 'numeric' })
    };
  }
  
  // Fallback
  const d = typeof dateInput === 'string' ? new Date(dateInput) : (dateInput || new Date());
  return {
    sortKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    displayMonth: d.toLocaleString('he-IL', { month: 'long', year: 'numeric' })
  };
};

/**
 * Safely extracts the date portion (DD.MM.YYYY) from an ISO datetime string (e.g. 2026-09-15T09:00:00) 
 * without Date parsing shifts.
 */
export const extractDateFromISO = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  const onlyDate = dateStr.split('T')[0];
  return formatLocalDate(onlyDate);
};

/**
 * Safely extracts the time portion (HH:mm) from an ISO datetime string 
 * without Date parsing shifts.
 */
export const extractTimeFromISO = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('T');
  if (parts.length < 2) return '';
  return parts[1].substring(0, 5);
};

/**
 * Safely converts a datetime-local string (YYYY-MM-DDTHH:mm) into a trailing-second format
 * expected by the backend without passing it through Date parsing (which alters the time based on user timezone).
 */
export const toSafeBackendDateTime = (localStr: string): string => {
  if (!localStr) return '';
  if (localStr.includes('Z')) {
      return localStr.split('Z')[0].substring(0, 19);
  }
  if (localStr.length === 16) return `${localStr}:00`;
  return localStr.substring(0, 19);
};
