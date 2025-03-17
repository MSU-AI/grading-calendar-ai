from grade_processing import extract_and_process_pdf
import json

# Open a sample PDF file
with open("P_Cubed_Syllabus_SPRING2025.pdf", "rb") as file:
    structured_data = extract_and_process_pdf(file)

# Print formatted JSON output
print("\n🔹 Extracted Data (JSON Format):")
print(json.dumps(structured_data, indent=4))


