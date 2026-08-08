import os
import re
import sys
try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    print("Installing pypdf...")
    os.system(f"{sys.executable} -m pip install pypdf")
    from pypdf import PdfReader, PdfWriter

def find_employer_ids(pdf_path):
    """
    Find 9-digit numbers that appear on ALL pages.
    These are usually the Employer ID (ח.פ) or Employer Deduction File (תיק ניכויים).
    We want to ignore these when looking for Employee IDs.
    """
    reader = PdfReader(pdf_path)
    all_pages_ids = []
    
    for page in reader.pages:
        text = page.extract_text() or ""
        clean_text = text.replace("-", "")
        # Find all 9-digit numbers
        page_ids = set(re.findall(r'\b\d{9}\b', clean_text))
        all_pages_ids.append(page_ids)
    
    # Intersection of all sets will give us the numbers that appear on EVERY page
    if not all_pages_ids:
        return set()
    
    employer_ids = set.intersection(*all_pages_ids)
    return employer_ids

def split_payslips(pdf_path, output_dir="Payslips_Output"):
    if not os.path.exists(pdf_path):
        print(f"❌ שגיאה: הקובץ {pdf_path} לא נמצא.")
        return

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print("🔍 סורק את הקובץ לזיהוי ח.פ של החברה (כדי להתעלם ממנו)...")
    employer_ids = find_employer_ids(pdf_path)
    print(f"🏢 זוהו מספרי חברה שיופיעו בכל דף: {employer_ids}")

    reader = PdfReader(pdf_path)
    success_count = 0
    unknown_count = 0

    print("✂️ מתחיל בפיצול ושמירת העמודים...")
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        clean_text = text.replace("-", "")
        
        # Find all 9-digit numbers on this specific page
        page_ids = set(re.findall(r'\b\d{9}\b', clean_text))
        
        # Remove the employer IDs from the found numbers
        employee_ids = page_ids - employer_ids
        
        writer = PdfWriter()
        writer.add_page(page)
        
        # If we found exactly one unique 9-digit number, it's highly likely the employee's ID.
        if len(employee_ids) >= 1:
            employee_id = list(employee_ids)[0]
            
            # Look up name in CSV if exists
            employee_name = ""
            if os.path.exists("employees.csv"):
                try:
                    with open("employees.csv", "r", encoding="utf-8") as csvfile:
                        for line in csvfile:
                            parts = line.strip().split(",")
                            if len(parts) >= 2 and parts[0] == employee_id:
                                employee_name = f"_{parts[1]}"
                                break
                except:
                    pass
            
            output_filename = os.path.join(output_dir, f"{employee_id}{employee_name}.pdf")
            success_count += 1
        else:
            # Couldn't find a unique 9-digit number, save as unknown
            output_filename = os.path.join(output_dir, f"unknown_page_{i+1}.pdf")
            unknown_count += 1
            
        with open(output_filename, "wb") as f:
            writer.write(f)
            
        print(f"✅ נשמר: {output_filename}")

    print("\n--- סיכום ---")
    print(f"סה\"כ תלושים שפוצלו בהצלחה (לפי ת.ז): {success_count}")
    if unknown_count > 0:
        print(f"סה\"כ תלושים שלא זוהו אוטומטית (נשמרו כ-unknown): {unknown_count}")
    print(f"📂 כל התלושים המפוצלים מחכים לך בתיקייה: {os.path.abspath(output_dir)}")

if __name__ == "__main__":
    print("="*50)
    print("רובוט פיצול תלושי שכר אוטומטי - יהב הצלה בטוחה")
    print("="*50)
    
    # Check if a file was dragged and dropped onto the script
    if len(sys.argv) > 1:
        input_pdf = sys.argv[1]
    else:
        input_pdf = input("אנא גרור לכאן את קובץ ה-PDF של תלושי השכר (או הקלד את הנתיב שלו) ולחץ Enter:\n> ").strip()
        # Remove quotes if user dragged and dropped in terminal
        if input_pdf.startswith('"') and input_pdf.endswith('"'):
            input_pdf = input_pdf[1:-1]

    split_payslips(input_pdf)
    input("\nלחץ Enter כדי לסיים...")
