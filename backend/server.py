from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins="*",
    logger=True
)

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class GeoPoint(BaseModel):
    type: str = "Point"
    coordinates: List[float]  # [longitude, latitude]

class Pin(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    title: str
    description: Optional[str] = ""
    location: GeoPoint
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    votes: int = 0
    voted_by: List[str] = Field(default_factory=list)

class PinCreate(BaseModel):
    room_id: str
    title: str
    description: Optional[str] = ""
    latitude: float
    longitude: float
    created_by: str

class Room(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = ""
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    members: List[str] = Field(default_factory=list)
    is_active: bool = True

class RoomCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    created_by: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: Optional[str] = ""
    avatar: Optional[str] = ""
    current_room: Optional[str] = None

class UserCreate(BaseModel):
    name: str
    email: Optional[str] = ""
    avatar: Optional[str] = ""

# GeoStore interface for future PostGIS migration
class GeoStore:
    def __init__(self, database):
        self.db = database
        
    async def create_spatial_indexes(self):
        """Create 2dsphere indexes for MongoDB spatial queries"""
        await self.db.pins.create_index([("location", "2dsphere")])
        
    async def find_pins_in_room(self, room_id: str) -> List[Dict]:
        """Find all pins in a specific room"""
        pins = await self.db.pins.find({"room_id": room_id}).to_list(None)
        return pins
        
    async def find_nearest_pins(self, longitude: float, latitude: float, max_distance: int = 10000) -> List[Dict]:
        """Find pins within max_distance meters from point"""
        query = {
            "location": {
                "$near": {
                    "$geometry": {"type": "Point", "coordinates": [longitude, latitude]},
                    "$maxDistance": max_distance
                }
            }
        }
        pins = await self.db.pins.find(query).to_list(None)
        return pins
        
    async def calculate_centroid(self, room_id: str) -> Optional[Dict]:
        """Calculate the centroid of all pins in a room"""
        pipeline = [
            {"$match": {"room_id": room_id}},
            {"$group": {
                "_id": None,
                "avgLng": {"$avg": {"$arrayElemAt": ["$location.coordinates", 0]}},
                "avgLat": {"$avg": {"$arrayElemAt": ["$location.coordinates", 1]}},
                "count": {"$sum": 1}
            }}
        ]
        result = await self.db.pins.aggregate(pipeline).to_list(None)
        if result and result[0]["count"] > 0:
            return {
                "longitude": result[0]["avgLng"],
                "latitude": result[0]["avgLat"],
                "type": "centroid"
            }
        return None

# Initialize GeoStore
geo_store = GeoStore(db)

# Socket.IO event handlers
@sio.event
async def connect(sid, environ):
    print(f"Client {sid} connected")
    
@sio.event
async def disconnect(sid):
    print(f"Client {sid} disconnected")
    
@sio.event
async def join_room(sid, data):
    """User joins a room"""
    room_id = data.get('room_id')
    user_name = data.get('user_name', 'Anonymous')
    
    await sio.enter_room(sid, room_id)
    await sio.emit('user_joined', {
        'user_name': user_name,
        'message': f'{user_name} joined the room'
    }, room=room_id)
    
    # Send existing pins to the newly joined user
    pins = await geo_store.find_pins_in_room(room_id)
    await sio.emit('pins_update', {'pins': pins}, room=sid)

@sio.event
async def leave_room(sid, data):
    """User leaves a room"""
    room_id = data.get('room_id')
    user_name = data.get('user_name', 'Anonymous')
    
    await sio.leave_room(sid, room_id)
    await sio.emit('user_left', {
        'user_name': user_name,
        'message': f'{user_name} left the room'
    }, room=room_id)

@sio.event
async def pin_created(sid, data):
    """Handle real-time pin creation"""
    room_id = data.get('room_id')
    
    # Broadcast to all users in the room
    await sio.emit('pin_added', data, room=room_id)

@sio.event
async def pin_updated(sid, data):
    """Handle real-time pin updates"""
    room_id = data.get('room_id')
    
    # Broadcast to all users in the room
    await sio.emit('pin_modified', data, room=room_id)

@sio.event
async def pin_deleted(sid, data):
    """Handle real-time pin deletion"""
    room_id = data.get('room_id')
    
    # Broadcast to all users in the room
    await sio.emit('pin_removed', data, room=room_id)

# REST API Endpoints
@api_router.get("/")
async def root():
    return {"message": "Event Planning Map API", "status": "active"}

# Room endpoints
@api_router.post("/rooms", response_model=Room)
async def create_room(room_data: RoomCreate):
    room = Room(**room_data.dict())
    room.members = [room.created_by]  # Creator is first member
    
    await db.rooms.insert_one(room.dict())
    return room

@api_router.get("/rooms", response_model=List[Room])
async def get_rooms():
    rooms = await db.rooms.find({"is_active": True}).to_list(None)
    return [Room(**room) for room in rooms]

@api_router.get("/rooms/{room_id}", response_model=Room)
async def get_room(room_id: str):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return Room(**room)

@api_router.post("/rooms/{room_id}/join")
async def join_room_api(room_id: str, user_id: str):
    room = await db.rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Add user to room members if not already present
    if user_id not in room.get("members", []):
        await db.rooms.update_one(
            {"id": room_id},
            {"$push": {"members": user_id}}
        )
    
    return {"message": "Successfully joined room"}

# Pin endpoints
@api_router.post("/pins", response_model=Pin)
async def create_pin(pin_data: PinCreate):
    pin = Pin(
        room_id=pin_data.room_id,
        title=pin_data.title,
        description=pin_data.description,
        location=GeoPoint(
            type="Point",
            coordinates=[pin_data.longitude, pin_data.latitude]
        ),
        created_by=pin_data.created_by
    )
    
    # Insert to database
    await db.pins.insert_one(pin.dict())
    
    # Emit real-time update
    await sio.emit('pin_added', pin.dict(), room=pin.room_id)
    
    return pin

@api_router.get("/pins/room/{room_id}", response_model=List[Pin])
async def get_room_pins(room_id: str):
    pins = await geo_store.find_pins_in_room(room_id)
    return [Pin(**pin) for pin in pins]

@api_router.post("/pins/{pin_id}/vote")
async def vote_pin(pin_id: str, user_id: str):
    pin = await db.pins.find_one({"id": pin_id})
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")
    
    voted_by = pin.get("voted_by", [])
    
    if user_id in voted_by:
        # Remove vote
        await db.pins.update_one(
            {"id": pin_id},
            {
                "$pull": {"voted_by": user_id},
                "$inc": {"votes": -1}
            }
        )
        action = "removed"
    else:
        # Add vote
        await db.pins.update_one(
            {"id": pin_id},
            {
                "$push": {"voted_by": user_id},
                "$inc": {"votes": 1}
            }
        )
        action = "added"
    
    # Get updated pin and emit real-time update
    updated_pin = await db.pins.find_one({"id": pin_id})
    await sio.emit('pin_modified', updated_pin, room=pin["room_id"])
    
    return {"message": f"Vote {action}", "votes": updated_pin["votes"]}

# Smart location endpoints
@api_router.get("/rooms/{room_id}/optimal-location")
async def get_optimal_location(room_id: str):
    """Calculate optimal meeting point for all pins in room"""
    centroid = await geo_store.calculate_centroid(room_id)
    
    if not centroid:
        raise HTTPException(status_code=404, detail="No pins found in room")
    
    return {
        "optimal_location": centroid,
        "algorithm": "centroid",
        "description": "Geographic center of all pins"
    }

@api_router.get("/pins/nearby")
async def find_nearby_pins(longitude: float, latitude: float, max_distance: int = 5000):
    """Find pins within specified distance"""
    pins = await geo_store.find_nearest_pins(longitude, latitude, max_distance)
    return {"pins": [Pin(**pin) for pin in pins], "count": len(pins)}

# User endpoints
@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate):
    user = User(**user_data.dict())
    await db.users.insert_one(user.dict())
    return user

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

# Initialize database indexes on startup
@app.on_event("startup")
async def startup_event():
    await geo_store.create_spatial_indexes()
    print("Spatial indexes created successfully")

@app.on_event("shutdown")
async def shutdown_event():
    client.close()

# Include API router
app.include_router(api_router)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Socket.IO
socket_app = socketio.ASGIApp(sio, app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(socket_app, host="0.0.0.0", port=8001)