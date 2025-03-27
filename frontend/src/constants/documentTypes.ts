// Define the document type values
export const DOCUMENT_TYPES = {
  SYLLABUS: 'syllabus',
  TRANSCRIPT: 'transcript',
  GRADES: 'grades',
  OTHER: 'other'
} as const;

// Extract the type from the values
export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];

// Export both the constant and its type
export default DOCUMENT_TYPES;
