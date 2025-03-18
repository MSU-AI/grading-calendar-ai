import json
import openai
import os

def load_data(json_file_path):
    """Load course/student data from a JSON file."""
    with open(json_file_path, 'r') as f:
        data = json.load(f)
    return data

def construct_prompt(course_data):
    """
    Construct a concise prompt using the new JSON format:
      course_name, instructor, grade_weights, assignments,
      gpa, final_grade, due_dates, credit_hours.
    The prompt instructs ChatGPT to output a JSON object
    with two keys: "grade" and "reasoning".
    """
    prompt_lines = []
    
    # Basic information
    prompt_lines.append(f"Course Name: {course_data['course_name']}")
    prompt_lines.append(f"Instructor: {course_data['instructor']}")
    
    # Grade weights
    prompt_lines.append("Grade Weights:")
    for gw in course_data["grade_weights"]:
        prompt_lines.append(f"  - {gw['name']}: {gw['weight']}")
    
    # Assignments
    assignments_str = ", ".join(course_data["assignments"])
    prompt_lines.append(f"Assignments: {assignments_str}")
    
    # GPA, final grade, and credit hours
    prompt_lines.append(f"GPA: {course_data['gpa']}")
    prompt_lines.append(f"Current/Previous Final Grade: {course_data['final_grade']}")
    prompt_lines.append(f"Credit Hours: {course_data['credit_hours']}")
    
    # Due dates
    prompt_lines.append("Due Dates:")
    for dd in course_data["due_dates"]:
        prompt_lines.append(f"  - {dd['assignment']} due on {dd['due_date']}")
    
    # Final instruction
    prompt_lines.append(
        "Based on these details, predict the student's final grade. "
        "Output exactly in JSON format with two keys: 'grade' (a numeric value) "
        "and 'reasoning' (a short explanation). Do not include extra text."
    )
    
    return "\n".join(prompt_lines)

def get_chatgpt_prediction(prompt):
    """Call the OpenAI API to get a prediction."""
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a concise academic advisor."},
            {"role": "user", "content": prompt}
        ]
    )
    return response["choices"][0]["message"]["content"]

def main():
    # Set your OpenAI API key from environment variable
    openai.api_key = os.getenv("OPENAI_API_KEY")
    if not openai.api_key:
        raise ValueError("Please set your OPENAI_API_KEY environment variable.")
    
    # Load the JSON data. Adjust path if needed.
    data = load_data("sample_data.json")
    
    # Construct the prompt using the new format.
    prompt = construct_prompt(data)
    
    # Get the prediction from ChatGPT.
    prediction = get_chatgpt_prediction(prompt)
    
    print("ChatGPT's Output:")
    try:
        # Attempt to parse the JSON output to confirm format consistency.
        output = json.loads(prediction)
        print(json.dumps(output, indent=2))
    except json.JSONDecodeError:
        # In case the output is not valid JSON.
        print("Failed to parse JSON. Raw output:")
        print(prediction)

if __name__ == "__main__":
    main()  