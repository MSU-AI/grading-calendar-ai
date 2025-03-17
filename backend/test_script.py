from grade_processing import extract_and_process_pdf

# Open a sample PDF file
with open("P_Cubed_Syllabus_SPRING2025.pdf", "rb") as file:
    structured_data = extract_and_process_pdf(file)

print("\n🔹 Extracted Data:", structured_data)

