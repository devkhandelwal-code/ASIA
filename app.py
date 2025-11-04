from flask import Flask, request, jsonify
from flask_cors import CORS
import wikipedia
import re, math, random, requests
from duckduckgo_search import DDGS  # ✅ DOGS import

app = Flask(__name__)
CORS(app)

# --------------- GREETINGS & BASIC INFO ----------------
def basic_reply(msg):
    msg = msg.lower()
    if "who are you" in msg or "your name" in msg:
        return "I'm A.S.I.A 🤖 — your intelligent assistant developed by Pixel Studio. I can answer almost anything!"
    if "how are you" in msg:
        return "I'm doing great 😄 and ready to help you. What do you want to know?"
    if msg in ["hi", "hey", "hello", "hola"]:
        return random.choice(["Hey 👋", "Hi there!", "Hello!", "Hey, how can I help?"])
    return None


# --------------- DUCKDUCKGO + WIKIPEDIA ----------------
def fetch_from_duckduckgo(query):
    """Fetches best short info using DDGS and DuckDuckGo Instant Answer API."""
    try:
        # 1️⃣ Try Instant Answer API
        res = requests.get(
            f"https://api.duckduckgo.com/?q={query}&format=json&no_redirect=1&no_html=1",
            timeout=6
        )
        data = res.json()
        if data.get("AbstractText"):
            return data["AbstractText"]
        if data.get("Answer"):
            return data["Answer"]
        if data.get("RelatedTopics"):
            for t in data["RelatedTopics"]:
                if isinstance(t, dict) and t.get("Text"):
                    return t["Text"]

        # 2️⃣ DOGS text search
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
            for r in results:
                if "body" in r and r["body"]:
                    return r["body"]
                if "title" in r and r["title"]:
                    return r["title"]

    except Exception as e:
        print("DuckDuckGo error:", e)
    return None


def fetch_from_wiki(query):
    """Fetch summary from Wikipedia"""
    try:
        return wikipedia.summary(query, sentences=3, auto_suggest=True)
    except Exception as e:
        print("Wiki error:", e)
        return None


# --------------- LOGIC FOR COMPANIES, LEADERS, ETC ----------------
def detect_topic(msg):
    msg_low = msg.lower()
    # Country leaders
    if "prime minister" in msg_low or "president" in msg_low or "chief minister" in msg_low:
        return msg_low
    # Companies
    if "ceo" in msg_low or "founder" in msg_low or "owner" in msg_low:
        return msg_low
    return None


# --------------- STUDY & MATH ----------------
def math_solver(msg):
    try:
        q = msg.lower()
        if re.match(r"^[\d\s\+\-\*\/\%\.\(\)]+$", q):
            return f"The answer is {eval(q)}"
        if "square root" in q:
            n = float(re.findall(r"\d+", q)[0])
            return f"The square root of {n} is {math.sqrt(n):.4f}"
        if "cube root" in q:
            n = float(re.findall(r"\d+", q)[0])
            return f"The cube root of {n} is {n ** (1/3):.4f}"
    except:
        pass
    return None


# --------------- MAIN AI LOGIC ----------------
def get_best_answer(user_query):
    print(f"🧠 Processing query: {user_query}")
    msg = user_query.strip()

    # 1️⃣ Basic responses
    base = basic_reply(msg)
    if base:
        return base

    # 2️⃣ Math / Study logic
    math_res = math_solver(msg)
    if math_res:
        return math_res

    # 3️⃣ Smart search
    ddg_ans = fetch_from_duckduckgo(msg)
    if ddg_ans and len(ddg_ans) > 15:
        return ddg_ans

    # 4️⃣ Wikipedia fallback
    wiki_ans = fetch_from_wiki(msg)
    if wiki_ans:
        return wiki_ans

    # 5️⃣ Try one more deep search if all else fails
    deeper = fetch_from_duckduckgo(f"explain {msg}")
    if deeper:
        return deeper

    return "I tried searching everywhere 🕵️‍♂️ but couldn’t find a solid answer. Try rephrasing or asking something else!"


# --------------- FLASK ENDPOINT ----------------
@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"response": "Please type a question so I can reply!"})

    reply = get_best_answer(message)
    return jsonify({"response": reply})


# --------------- RUN APP ----------------
if __name__ == "__main__":
    app.run(port=5001, debug=True)
