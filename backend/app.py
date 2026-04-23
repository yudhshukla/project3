from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3

app = Flask(__name__)
# This allows your frontend to send requests to this backend without security errors
CORS(app) 

def get_db():
    # Connects to a local SQLite file (creates it if it doesn't exist)
    conn = sqlite3.connect('city_data.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS cities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                population INTEGER,
                money INTEGER
            )
        ''')

# Run database initialization
init_db()

# --- ROUTES ---

@app.route('/save', methods=['POST'])
def save_city():
    data = request.json
    city_id = data.get('id') # This will be None on the first save
    name = data.get('name', 'Unknown City')
    pop = data.get('population', 0)
    money = data.get('money', 0)
    
    with get_db() as conn:
        if city_id:
            # We have an ID! Overwrite the existing data.
            conn.execute('UPDATE cities SET name = ?, population = ?, money = ? WHERE id = ?', 
                         (name, pop, money, city_id))
        else:
            # No ID yet. Create a brand new row.
            cursor = conn.execute('INSERT INTO cities (name, population, money) VALUES (?, ?, ?)', 
                                 (name, pop, money))
            city_id = cursor.lastrowid # Grab the new ID that SQLite just generated
            
    # Send the ID back to the game so it remembers it for next time
    return jsonify({"status": "success", "message": f"{name} saved!", "id": city_id})

@app.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    with get_db() as conn:
        # Get the top 5 cities by population
        cities = conn.execute('SELECT name, population, money FROM cities ORDER BY population DESC LIMIT 5').fetchall()
        return jsonify([dict(city) for city in cities])

if __name__ == '__main__':
    app.run(debug=True, port=5000)