import fitz  # PyMuPDF
import openai
import os
from dotenv import load_dotenv

# Load API Key
load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")
client = openai.OpenAI(api_key=API_KEY)

def extract_and_process_pdf(pdf_file):
    """Extracts text from an uploaded PDF and processes it using OpenAI."""
    
    # Read the PDF file
    doc = fitz.open(stream=pdf_file.read(), filetype="pdf")  
    text = "\n".join([page.get_text("text") for page in doc])

    if not text.strip():
        raise ValueError("No text extracted from the PDF.")

    # Process extracted text with OpenAI
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": 
             """Extract and format the following information from this document into JSON:
             - Course Name
             - Instructor Name
             - Grade Weight
             - Assignment Names
             - GPA (if applicable)
             - Final Grade
             - Due Dates
             - Credit Hours
             
             Return the data in this JSON format:
             {
                "course_name": "...",
                "instructor": "...",
                "grade_weights": [{"name": "...", "weight": "..."}],
                "assignments": ["...", "..."],
                "gpa": "...",
                "final_grade": "...",
                "due_dates": [{"assignment": "...", "due_date": "..."}],
                "credit_hours": "..."
             }
             """},
            {"role": "user", "content": text}
        ]
    )

    structured_data = response.choices[0].message.content
    return structured_data  # JSON-like extracted data

