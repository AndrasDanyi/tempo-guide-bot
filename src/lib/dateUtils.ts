/**
 * Utility functions for consistent date formatting across the application
 */

/**
 * Safely formats a date string to a readable format
 * @param dateString - Date string in various formats
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date string or fallback text
 */
export const formatDate = (
  dateString: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
): string => {
  if (!dateString) return 'Not specified';
  
  try {
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Error formatting date:', error, 'Input:', dateString);
    return 'Invalid date';
  }
};

/**
 * Formats a date to show day of week and date
 * @param dateString - Date string
 * @returns Formatted string like "Monday, Dec 20"
 */
export const formatDateWithDay = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return 'Not specified';
  
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    
    return `${dayOfWeek}, ${formattedDate}`;
  } catch (error) {
    console.error('Error formatting date with day:', error, 'Input:', dateString);
    return 'Invalid date';
  }
};

/**
 * Formats a date to ISO string (YYYY-MM-DD) for database operations
 * @param dateString - Date string
 * @returns ISO date string or null if invalid
 */
export const formatDateToISO = (dateString: string | Date | null | undefined): string | null => {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting date to ISO:', error, 'Input:', dateString);
    return null;
  }
};

/**
 * Parses a date string from training plan format (YYYY-MM-DD)
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object or null if invalid
 */
export const parseTrainingPlanDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  
  try {
    // Handle YYYY-MM-DD format specifically
    const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) return null;
    
    const [, year, month, day] = dateMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch (error) {
    console.error('Error parsing training plan date:', error, 'Input:', dateString);
    return null;
  }
};

