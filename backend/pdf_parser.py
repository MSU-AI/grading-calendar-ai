import fitz  # PyMuPDF
import os
import openai
from dotenv import load_dotenv


load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")
client = openai.OpenAI(api_key=API_KEY)

def extract_text_from_pdf(pdf_path):
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"File not found: {os.path.abspath(pdf_path)}")

    doc = fitz.open(pdf_path)
    text = "\n".join([page.get_text("text") for page in doc])
    
    if not text.strip():
        raise ValueError("No text extracted from the PDF. Check if the file is scanned or empty.")
    return text

def process_text_with_openai(text):
    response = client.chat.completions.create(
        model="gpt-4",  # or "gpt-3.5-turbo"
        messages=[
            {"role": "system", "content": "Extract grades and weights from this text."},
            {"role": "user", "content": text}
        ]
    )
    return response.choices[0].message.content

if __name__ == "__main__":
    
    pdf_path = "P_Cubed_Syllabus_SPRING2025.pdf"

    try:
        pdf_text = extract_text_from_pdf(pdf_path)
        print("PDF Text Extraction Successful!")
        structured_data = process_text_with_openai(pdf_text)
        print("\nExtracted Data from OpenAI:\n", structured_data)
    except FileNotFoundError as e:
        print(e)
    except ValueError as e:
        print(e)
    except Exception as e:
        print(f"Unexpected Error: {e}")
