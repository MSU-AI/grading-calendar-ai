from firebase_functions import https_fn
from firebase_admin import initialize_app
from auth import (
    create_user_profile,
    delete_user_data,
    get_user_profile,
    update_user_profile
)
from ocr import (
    extract_text_from_pdf,
    process_syllabus,
    process_transcript
)
from openai_api import (
    analyze_grades,
    predict_final_grade,
    extract_assignments
)

# Initialize Firebase app
initialize_app()

# Re-export all functions
__all__ = [
    # Auth functions
    'create_user_profile',
    'delete_user_data',
    'get_user_profile',
    'update_user_profile',
    # OCR functions
    'extract_text_from_pdf',
    'process_syllabus',
    'process_transcript',
    # OpenAI API functions
    'analyze_grades',
    'predict_final_grade',
    'extract_assignments'
]
