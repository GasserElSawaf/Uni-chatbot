# app.py
import os
import re
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from pymongo import MongoClient
from dotenv import load_dotenv
from langchain.chat_models import AzureChatOpenAI
from langchain import PromptTemplate, LLMChain
from docx import Document
from langchain_openai import AzureOpenAIEmbeddings
from langchain.text_splitter import CharacterTextSplitter
from langchain.vectorstores import FAISS
from langchain.chains import RetrievalQA

# ---------------------------------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
load_dotenv()

app = Flask(__name__)

# -------------------------------
# Configuration
# -------------------------------
OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
OPENAI_API_BASE = os.getenv("AZURE_OPENAI_ENDPOINT")
OPENAI_API_TYPE = "Azure"
deployment_name = 'GPT-4O-50-1'
api_version = '2023-12-01-preview'
API_KEY = os.environ.get("EMBED_AZURE_OPENAI_API_KEY")
AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")

os.environ["AZURE_OPENAI_API_KEY"] = OPENAI_API_KEY
os.environ["AZURE_OPENAI_ENDPOINT"] = OPENAI_API_BASE
os.environ["OPENAI_API_TYPE"] = OPENAI_API_TYPE

llm = AzureChatOpenAI(
    openai_api_version=api_version,
    azure_deployment=deployment_name,
)

embeddings = AzureOpenAIEmbeddings(
    azure_endpoint=AZURE_ENDPOINT,
    openai_api_key=API_KEY,
)

# MongoDB Setup
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "userDatabase"
REG_COLLECTION_NAME = "registrations"

mongo_client = MongoClient(MONGO_URI)
db = mongo_client[DB_NAME]
registrations_collection = db[REG_COLLECTION_NAME]

# Load external information
INFORMATION_FILE = "information.docx"  # Changed to .docx
REGISTRATION_INFO_FILE = "registration_fields_info_with_national_id.txt"

if os.path.exists(INFORMATION_FILE):
    try:
        doc = Document(INFORMATION_FILE)
        university_information = '\n'.join([para.text for para in doc.paragraphs])
        logging.info(f"Loaded university information from {INFORMATION_FILE}.")
    except Exception as e:
        logging.error(f"Error reading {INFORMATION_FILE}: {e}")
        university_information = ""
else:
    logging.warning(f"{INFORMATION_FILE} does not exist.")
    university_information = ""

if os.path.exists(REGISTRATION_INFO_FILE):
    with open(REGISTRATION_INFO_FILE, 'r', encoding='utf-8') as f:
        registration_info = f.read()
        logging.info(f"Loaded registration info from {REGISTRATION_INFO_FILE}.")
else:
    logging.warning(f"{REGISTRATION_INFO_FILE} does not exist.")
    registration_info = ""

#######################
# Initialize RAG-based QA
#######################

# Split the university information into chunks
text_splitter = CharacterTextSplitter(
    separator="\n",
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len
)
docs = text_splitter.split_text(university_information)

# Create a vectorstore from the documents
vectorstore = FAISS.from_texts(docs, embeddings)

# Create a retriever
retriever = vectorstore.as_retriever(search_kwargs={"k": 3})

# Define a prompt template similar to your original instructions
template = """
You are an intelligent assistant. Answer the following question using only the information provided from the retrieved content.
Before answering, clean the text from any grammar mistakes or random words. If the retrieved information does not contain an answer, respond with "The provided information does not contain an answer to this question."

Retrieved Information:
{context}

Question: {question}

Answer:
"""

PROMPT = PromptTemplate(
    template=template,
    input_variables=["context", "question"],
)

# Create a RetrievalQA chain that uses the LLM, retriever, and the custom prompt
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=retriever,
    chain_type_kwargs={"prompt": PROMPT}
)

#######################
# GLOBAL STATE TRACKING
#######################
sessions = {}
# Field name mapping from synonyms to canonical field names
FIELD_NAME_MAPPING = {
    'student full name': 'Student Full Name',
    'full name': 'Student Full Name',
    'dob': 'Date of Birth',
    'date of birth': 'Date of Birth',
    'gender': 'Gender',
    'nationality': 'Nationality',
    'national id': 'National ID',
    'id number': 'National ID',
    'id': 'National ID',
    'mobile': 'Mobile Number',
    'mobile number': 'Mobile Number',
    'email': 'Email Address',
    'parent name': 'Parent/Guardian Name',
    'guardian name': 'Parent/Guardian Name',
    'parent/guardian name': 'Parent/Guardian Name',
    'parent contact': 'Parent/Guardian Contact Number',
    'guardian contact': 'Parent/Guardian Contact Number',
    'parent/guardian contact': 'Parent/Guardian Contact Number',
    'parent email': 'Parent/Guardian Email Address',
    'guardian email': 'Parent/Guardian Email Address',
    'parent/guardian email': 'Parent/Guardian Email Address',
    'high school': 'High School Name',
    'graduation year': 'Graduation Year',
    'gpa': 'GPA',
    'preferred major': 'Preferred Major/Program',
    'preferred program': 'Preferred Major/Program',
}

GENDER_MAP = {
    'male': 'Male',
    'm': 'Male',
    'female': 'Female',
    'f': 'Female',
}

PREFERRED_MAJOR_MAP = {
    'cs': 'Computer Science',
    'computer science': 'Computer Science',
    'electrical engineering': 'Electrical Engineering',
    'ee': 'Electrical Engineering',
    'mechanical engineering': 'Mechanical Engineering',
    'me': 'Mechanical Engineering',
    'civil engineering': 'Civil Engineering',
    'ce': 'Civil Engineering',
    'aerospace engineering': 'Aerospace Engineering',
    'ae': 'Aerospace Engineering',
    'biomedical engineering': 'Biomedical Engineering',
    'be': 'Biomedical Engineering',
    'software engineering': 'Software Engineering',
    'se': 'Software Engineering',
    'environmental engineering': 'Environmental Engineering',
    'enve': 'Environmental Engineering',
    'robotics and automation': 'Robotics and Automation',
    'ra': 'Robotics and Automation',
    'data science': 'Data Science',
    'ds': 'Data Science',
}

VALID_COUNTRIES = {
    'Egypt': ['egypt', 'egyptian'],
    'United States': ['united states', 'usa', 'us', 'america', 'american'],
    'Canada': ['canada', 'canadian'],
    'United Kingdom': ['united kingdom', 'uk', 'britain', 'british'],
    'France': ['france', 'french'],
    'Germany': ['germany', 'german'],
    'India': ['india', 'indian'],
    'China': ['china', 'chinese'],
}

data_fields_list = [
    ("Student Full Name", lambda x: (len(x.strip().split()) >= 3, "Full name must contain at least three names.")),
    ("Date of Birth", lambda x: validate_date_of_birth(x)),
    ("Gender", lambda x: validate_gender(x)),
    ("Nationality", lambda x: validate_nationality(x)),
    ("National ID", lambda x: validate_national_id(x)),
    ("Mobile Number", lambda x: validate_mobile_number(x)),
    ("Email Address", lambda x: validate_email(x)),
    ("Parent/Guardian Name", lambda x: (len(x.strip().split()) >= 3, "Full name must contain at least three names.")),
    ("Parent/Guardian Contact Number", lambda x: validate_mobile_number(x)),
    ("Parent/Guardian Email Address", lambda x: validate_email(x)),
    ("High School Name", lambda x: (True, "")),
    ("Graduation Year", lambda x: validate_graduation_year(x)),
    ("GPA", lambda x: validate_gpa(x)),
    ("Preferred Major/Program", lambda x: validate_preferred_major(x))
]

# Make a dict for easy lookup
data_fields = {f[0]: f[1] for f in data_fields_list}

##############
# Validations
##############
def validate_date_of_birth(dob):
    for fmt in ("%d-%m-%Y", "%d/%m/%Y"):
        try:
            datetime.strptime(dob, fmt)
            return True, ""
        except ValueError:
            continue
    return False, "Date of Birth must be in the format DD-MM-YYYY or DD/MM/YYYY."

def validate_gender(gender):
    g = gender.lower()
    if g in GENDER_MAP:
        return True, ""
    return False, "Gender must be Male or Female (M/F accepted)."

def validate_nationality(nationality):
    if nationality in VALID_COUNTRIES:
        return True, ""
    return False, f"Nationality '{nationality}' is not recognized."

def validate_national_id(national_id):
    if re.fullmatch(r"\d{14}", national_id):
        return True, ""
    return False, "National ID must be exactly 14 digits."

def validate_mobile_number(mobile):
    pattern = re.compile(r'^\+?\d{10,15}$')
    if pattern.match(mobile):
        return True, ""
    return False, "Mobile number should be 10 to 15 digits (with optional +)."

def validate_email(email):
    pattern = re.compile(r'^[\w\.-]+@[\w\.-]+\.\w+$')
    if pattern.match(email):
        return True, ""
    return False, "Email address not valid."

def validate_graduation_year(year):
    if re.fullmatch(r"\d{4}", year):
        y = int(year)
        if 1900 <= y <= 2100:
            return True, ""
    return False, "Graduation year must be between 1900 and 2100."

def validate_gpa(gpa):
    try:
        val = float(gpa)
        if 0.0 <= val <= 4.0:
            return True, ""
    except:
        pass
    return False, "GPA must be 0.0 to 4.0."

def validate_preferred_major(major):
    if major in PREFERRED_MAJOR_MAP.values():
        return True, ""
    return False, f"Preferred Major not recognized."

##############
# Cleaning
##############
def map_gender(g):
    return GENDER_MAP.get(g.lower(), g)

def map_nationality_to_country(nat):
    nat_lower = nat.lower()
    for country, variations in VALID_COUNTRIES.items():
        if nat_lower in variations:
            return country
    return nat.capitalize()

def map_preferred_major(m):
    m_lower = m.lower()
    return PREFERRED_MAJOR_MAP.get(m_lower, m.title())

def clean_field(field_name, value):
    if field_name == "Gender":
        return map_gender(value)
    if field_name == "Nationality":
        return map_nationality_to_country(value)
    if field_name == "Preferred Major/Program":
        return map_preferred_major(value)
    if field_name == "National ID":
        digits = re.findall(r"\d+", value)
        return digits[0] if digits else value
    return value

###########################
# LLM-based Data Extraction
###########################
def extract_clean_value(field_name, user_input):
    template = f"""
You are a helpful assistant. The user is being asked to provide their {field_name} for a registration form.
They may include additional text, but you must extract only the {field_name} from their message.
If you cannot find a clear {field_name}, respond with "No data".

Field: {field_name}
User Input: {user_input}

Please return only the exact {field_name} with no additional text, no explanations, and no formatting other than the value itself.
"""
    prompt = PromptTemplate(input_variables=[], template=template)
    llm_chain_extraction = LLMChain(prompt=prompt, llm=llm)
    extracted = llm_chain_extraction.run({})
    return extracted.strip()

###########################
# Q&A Logic (Question Mode)
###########################
def answer_university_question(question):
    if not question.strip():
        return "Please provide a valid question."
    try:
        answer = qa_chain.run(question)
        if not answer or answer.strip() == "":
            return "The provided information does not contain an answer to this question."
        return answer.strip()
    except Exception as e:
        logging.error(f"Error in RAG-based Q&A: {e}")
        return "An error occurred while processing your question."

##################################
# Registration Logic (Registration Mode)
##################################
def init_registration_session(session_id):
    sessions[session_id] = {
        "current_field_index": 0,
        "data": {},
        "completed": False,
        "editing_field": None,  # Track if user is currently editing a field
        "awaiting_finalization": False  # Track if awaiting user to finalize or edit
    }
    logging.info(f"Initialized new registration session: {session_id}")

def registration_ask_next_field(session_data):
    if session_data["current_field_index"] >= len(data_fields_list):
        # All fields filled, display summary and ask for confirmation
        summary = summarize_registration(session_data["data"])
        session_data["awaiting_finalization"] = True
        return f"Registration completed!\n\nSummary:\n{summary}\n\nDo you want to edit anything on the data or finalize the registration? (Type 'edit' to make changes or 'finalize' to complete)"
    else:
        current_index = session_data["current_field_index"]
        field_name = data_fields_list[current_index][0]
        # Check if there is a previously saved field
        if current_index > 0:
            previous_field_name = data_fields_list[current_index - 1][0]
            previous_value = session_data["data"].get(previous_field_name, "No value saved")
            response = f"{previous_field_name}: {previous_value},\nPlease provide your {field_name}."
        else:
            # First field in the registration process
            response = f"Please provide your {field_name}."
        return response

def summarize_registration(data):
    collected_info = "\n".join([f"**{k}:** {v}" for k,v in data.items()])
    summary = f"Here is a summary of the registration details for the student:\n{collected_info}"
    return summary

def answer_registration_question(user_question, current_field_name):
    template = f"""
You are a helpful assistant that can answer questions about the registration process.
The following information might help:

{registration_info}

Current Field: {current_field_name}

User's question: {user_question}

If you have enough info, answer. If not, respond "I'm sorry, I don't have the information to answer that."
"""
    prompt = PromptTemplate(input_variables=[], template=template)
    llm_chain_question = LLMChain(prompt=prompt, llm=llm)
    answer = llm_chain_question.run({})
    return answer.strip()

##################################
# Intent & Edit Handling
##################################
def determine_intent(user_input, current_field):
    template = f"""You are a helpful assistant assisting with student registration. The user is currently being prompted to enter the field: "{current_field}" (if any).

Determine whether the following user input is:
1. A registration field value to be stored.
2. A question that needs to be answered.
3. An edit command to change a previously entered field.

User Input: "{user_input}"

Respond with "field" if it's a registration field value, "question" if it's a question, or "edit" if it's an edit command.
"""
    prompt = PromptTemplate(input_variables=[], template=template)
    llm_chain_intent = LLMChain(prompt=prompt, llm=llm)
    response = llm_chain_intent.run({})
    intent = response.strip().lower()
    logging.info(f"Determine Intent Response: {intent}")
    if "edit" in intent:
        return "edit"
    elif "question" in intent:
        return "question"
    elif "field" in intent:
        return "field"
    else:
        # Default if unclear
        return "field"

def extract_field_to_edit(user_input):
    template = """
You are a helpful assistant assisting with student registration. Your task is to determine which registration field the user wants to edit based on their input.

Here are the available fields:
- "Student Full Name"
- "Date of Birth"
- "Gender"
- "Nationality"
- "National ID"
- "Mobile Number"
- "Email Address"
- "Parent/Guardian Name"
- "Parent/Guardian Contact Number"
- "Parent/Guardian Email Address"
- "High School Name"
- "Graduation Year"
- "GPA"
- "Preferred Major/Program"

The user might refer to these fields in various ways, including using abbreviations or partial terms.

User Input: "{user_input}"

Please respond with the exact field name from the list above that the user intends to edit. If the field cannot be determined, respond with "unknown".
"""
    prompt = PromptTemplate(input_variables=["user_input"], template=template)
    llm_chain_extract_field = LLMChain(prompt=prompt, llm=llm)
    response = llm_chain_extract_field.run({"user_input": user_input})
    field = response.strip()
    logging.info(f"Extract Field to Edit Response: {field}")

    # Normalize field name if needed
    for key in data_fields.keys():
        if key.lower() == field.lower():
            return key

    mapped_field = FIELD_NAME_MAPPING.get(field.lower())
    if mapped_field and mapped_field in data_fields:
        return mapped_field

    return "unknown"

def count_words(text):
    return len(text.strip().split())

@app.route("/chat", methods=["POST"])
def chat_endpoint():
    data = request.get_json()
    question = data.get("question", "")
    mode = data.get("mode", "question")
    session_id = data.get("session_id")

    if not session_id:
        logging.warning("No session_id provided in the request.")
        return jsonify({"error": "No session_id provided."}), 400

    # Word Count Validation
    word_count = count_words(question)
    if word_count > 250:
        return jsonify({"error": "Input exceeds the 250-word limit."}), 400

    if mode == "question":
        # One-turn Q&A
        answer = answer_university_question(question)
        return jsonify({"answer": answer})

    elif mode == "registration":
        # Handle registration steps
        if session_id not in sessions:
            init_registration_session(session_id)

        session_data = sessions[session_id]
        logging.info(f"Session {session_id} - Current Data: {session_data['data']}")

        if session_data["completed"]:
            # Already completed
            return jsonify({"answer": "Your registration is already completed."})

        if session_data["awaiting_finalization"]:
            # User is responding to finalization prompt
            user_input = question.strip().lower()
            if user_input in ["edit", "yes", "i want to edit", "change", "modify"]:
                return jsonify({"answer": "Please specify which field you would like to edit."})
            elif user_input in ["finalize", "no", "no thanks", "finish", "complete"]:
                try:
                    # Include session_id in the data for unique identification
                    session_data["data"]["session_id"] = session_id

                    registrations_collection.update_one(
                        {"session_id": session_id},
                        {"$set": session_data["data"]},
                        upsert=True
                    )
                    session_data["completed"] = True
                    session_data["awaiting_finalization"] = False
                    logging.info(f"Session {session_id} - Data saved: {session_data['data']}")
                    return jsonify({"answer": "Thank you for your registration! Your details have been saved."})
                except Exception as e:
                    logging.error(f"DB Insert error for session {session_id}: {e}")
                    return jsonify({"answer": "Error saving registration. Please try again."})
            else:
                # Determine if user wants to edit a specific field
                intent = determine_intent(question, "")
                if intent == "edit":
                    field_to_edit = extract_field_to_edit(question)
                    if field_to_edit == "unknown":
                        return jsonify({"answer": "I'm sorry, I couldn't identify which field you want to edit."})
                    # Check if field was previously filled
                    if field_to_edit in session_data["data"]:
                        # Prompt user for new value
                        session_data["editing_field"] = field_to_edit
                        return jsonify({"answer": f"You want to edit {field_to_edit}. Please provide the new value."})
                    else:
                        return jsonify({"answer": f"The field '{field_to_edit}' has not been filled yet. You can only edit fields that have been provided."})
                else:
                    return jsonify({"answer": "Please respond with 'edit' to make changes or 'finalize' to complete your registration."})

        # If we are editing a field
        if session_data["editing_field"]:
            # The current user_input is the new value for that field
            field_to_edit = session_data["editing_field"]
            # Extract clean value before validation
            extracted_value = extract_clean_value(field_to_edit, question)
            cleaned_value = clean_field(field_to_edit, extracted_value)
            is_valid, error_msg = data_fields[field_to_edit](cleaned_value)
            if is_valid:
                session_data["data"][field_to_edit] = cleaned_value
                logging.info(f"Session {session_id} - Updated {field_to_edit} to {cleaned_value}")
                session_data["editing_field"] = None
                return jsonify({"answer": f"{registration_ask_next_field(session_data)}"})
            else:
                return jsonify({"answer": f"Invalid input for {field_to_edit}: {error_msg} Please try again."})

        # Normal flow
        current_index = session_data["current_field_index"]
        if current_index < len(data_fields_list):
            current_field_name = data_fields_list[current_index][0]
        else:
            # All fields filled, ask for confirmation
            summary = summarize_registration(session_data["data"])
            session_data["awaiting_finalization"] = True
            return jsonify({"answer": f"Registration completed!\n\nSummary:\n{summary}\n\nDo you want to edit anything on the data or finalize the registration? (Type 'edit' to make changes or 'finalize' to complete)"})

        # Determine intent
        intent = determine_intent(question, current_field_name)

        if intent == "question":
            # Answer a question about the registration process
            ans = answer_registration_question(question, current_field_name)
            return jsonify({"answer": ans})

        elif intent == "edit":
            # User wants to edit a previously entered field
            field_to_edit = extract_field_to_edit(question)
            if field_to_edit == "unknown":
                return jsonify({"answer": "I'm sorry, I couldn't identify which field you want to edit."})
            # Check if field was previously filled
            if field_to_edit in session_data["data"]:
                # Prompt user for new value
                session_data["editing_field"] = field_to_edit
                return jsonify({"answer": f"You want to edit {field_to_edit}. Please provide the new value."})
            else:
                return jsonify({"answer": f"The field '{field_to_edit}' has not been filled yet. You can only edit fields that have been provided."})

        else:
            # Handle user input for the current field
            if not question.strip():
                # If no input is provided, simply ask the user for the current field
                return jsonify({"answer": f"Please provide your {current_field_name}."})

            # Extract clean value before validation
            extracted_value = extract_clean_value(current_field_name, question)
            cleaned_value = clean_field(current_field_name, extracted_value)
            is_valid, error_msg = data_fields[current_field_name](cleaned_value)
            if is_valid:
                session_data["data"][current_field_name] = cleaned_value
                logging.info(f"Session {session_id} - Set {current_field_name} to {cleaned_value}")
                session_data["current_field_index"] += 1
                next_msg = registration_ask_next_field(session_data)
                return jsonify({"answer": next_msg})
            else:
                return jsonify({"answer": f"Invalid input for {current_field_name}: {error_msg} Please try again."})
    else:
        logging.warning(f"Unknown mode received: {mode}")
        return jsonify({"answer": "Unknown mode."}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
