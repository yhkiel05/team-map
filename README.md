Features

Live collaboration — pins, annotations, and routes sync instantly across all users.

Smart meeting point — suggests central or fastest-to-reach locations.

Group workspaces — create rooms for teams, trips, or events.

Authentication — sign in with Google to save and manage maps.

Scalable backend — WebSocket-based real-time updates with caching and persistence.

Tech Stack

Frontend: React, Leaflet.js (OpenStreetMap)

Backend: Node.js, Express, Socket.IO

Database: MongoDB (with 2dsphere geospatial indexes)

Auth: Google OAuth 2.0 (JWT-based sessions)

Deployment: Docker, Kubernetes, AWS/GCP

Installation

Clone the repo:

git clone https://github.com/yourusername/collab-map.git
cd collab-map


Install dependencies:

npm install


Set up environment variables in .env:

MONGO_URI=<your-mongodb-uri>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
SESSION_SECRET=<random-secret>


Run the server:

npm start


Open http://localhost:3000 to view the app.
