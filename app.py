from flask import Flask, request, jsonify, send_from_directory
from llama_cpp import Llama

app = Flask(__name__)

# Load Mistral model
llm = Llama(
    model_path="models/mistral.gguf",
    n_ctx=1024,     
    n_threads=4,    
    n_batch=128,   
    f16_kv=True     
)


def generate_reply(user_message):
    prompt = f"""
You are a smart, polite, and helpful AI assistant.

Rules:
- Always answer in 3–5 bullet points.
- Do NOT write long paragraphs.
- Keep each point short and clear.
- Use simple English.
- Be direct and useful.
- If user asks simple question, still answer in points.

Now answer the user:
User: {user_message}
Assistant:
"""

    try:
        output = llm(
            prompt,
            max_tokens=80,
            temperature=0.7,
            top_p=0.9,
            stop=["User:"]
        )

        if "choices" in output and len(output["choices"]) > 0:
            return output["choices"][0]["text"].strip()
        else:
            return "Can you ask again?"

    except Exception as e:
        print("Error:", e)
        return "Some error happened."



@app.route("/")
def home():
    return send_from_directory("frontend", "index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "")
    # print("USER SAID:", user_message)  

    bot_reply = generate_reply(user_message)
    # print("BOT REPLY:", bot_reply) 

    return jsonify({"reply": bot_reply})



@app.route("/frontend/<path:filename>")
def frontend_files(filename):
    return send_from_directory("frontend", filename)


if __name__ == "__main__":
    app.run(debug=True)
