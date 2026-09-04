import sys
import json
import os

def main():
    try:
        input_data = json.loads(sys.stdin.read())
        transcript_path = input_data.get("transcriptPath")
        if not transcript_path or not os.path.exists(transcript_path):
            print(json.dumps({"decision": "allow"}))
            return
            
        last_user_msg = ""
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip(): continue
                try:
                    event = json.loads(line)
                    if event.get("source") == "USER_EXPLICIT" and event.get("type") == "USER_INPUT":
                        last_user_msg = event.get("content", "")
                except:
                    pass
        
        text = last_user_msg.lower()
        if "כן" in text or "מאשר" in text or "אושר" in text:
            print(json.dumps({"decision": "allow"}))
        else:
            print(json.dumps({
                "decision": "deny",
                "reason": "STRICT APPROVAL HOOK: נחסמת! עליך לבקש מהמשתמש לרשום במפורש 'כן' או 'מאשר' לפני הרצת פקודות או שינוי קוד."
            }))
    except Exception as e:
        print(json.dumps({"decision": "allow", "reason": f"Hook error: {str(e)}"}))

if __name__ == "__main__":
    main()
