// Document type constants
const DOCUMENT_TYPES = {
  SYLLABUS: 'syllabus',
  TRANSCRIPT: 'transcript',
  GRADES: 'grades',
  OTHER: 'other'
};

/**
 * Helper function to normalize document type
 * @param {string} type - Document type to normalize
 * @returns {string} Normalized document type
 */
function normalizeDocumentType(type) {
  if (!type) return DOCUMENT_TYPES.OTHER;
  
  const normalizedType = type.toLowerCase();
  return Object.values(DOCUMENT_TYPES).includes(normalizedType) 
    ? normalizedType 
    : DOCUMENT_TYPES.OTHER;
}

module.exports = {
  DOCUMENT_TYPES,
  normalizeDocumentType
};
