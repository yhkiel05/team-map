import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { io } from 'socket.io-client';
import axios from 'axios';
import L from 'leaflet';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Textarea } from './components/ui/textarea';
import { Separator } from './components/ui/separator';
import { MapPin, Users, Vote, Target, Plus, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import './App.css';

// Fix for default Leaflet marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create custom pin icon
const createPinIcon = (color = '#3b82f6', votes = 0) => {
    const svgIcon = `
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" 
                  fill="${color}" stroke="#ffffff" stroke-width="2"/>
            ${votes > 0 ? `<circle cx="12" cy="9" r="3" fill="#ffffff"/>
                          <text x="12" y="13" text-anchor="middle" fill="${color}" font-size="8" font-weight="bold">${votes}</text>` 
                      : ''}
        </svg>
    `;
    
    return new L.divIcon({
        html: svgIcon,
        className: 'custom-pin-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
};

// Map click handler component
function MapClickHandler({ onMapClick }) {
    useMapEvents({
        click: (e) => {
            onMapClick(e.latlng);
        }
    });
    return null;
}

// Main App Component
function App() {
    return (
        <div className="App">
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/room/:roomId" element={<MapView />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </div>
    );
}

// Landing Page Component
function LandingPage() {
    const [userName, setUserName] = useState('');
    const [roomName, setRoomName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const response = await axios.get(`${API}/rooms`);
            setRooms(response.data.slice(0, 10)); // Show latest 10 rooms
        } catch (error) {
            console.error('Error fetching rooms:', error);
        }
    };

    const createRoom = async () => {
        if (!userName.trim() || !roomName.trim()) {
            toast.error('Please enter your name and room name');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${API}/rooms`, {
                name: roomName,
                description: `Created by ${userName}`,
                created_by: userName
            });

            const room = response.data;
            
            // Store user info in localStorage
            localStorage.setItem('userName', userName);
            localStorage.setItem('userId', userName); // Using name as ID for simplicity
            
            // Redirect to room
            window.location.href = `/room/${room.id}`;
        } catch (error) {
            console.error('Error creating room:', error);
            toast.error('Failed to create room');
        } finally {
            setLoading(false);
        }
    };

    const joinRoom = (roomIdToJoin) => {
        if (!userName.trim()) {
            toast.error('Please enter your name first');
            return;
        }

        // Store user info in localStorage
        localStorage.setItem('userName', userName);
        localStorage.setItem('userId', userName);
        
        // Redirect to room
        window.location.href = `/room/${roomIdToJoin}`;
    };

    const joinRoomById = () => {
        if (!userName.trim()) {
            toast.error('Please enter your name first');
            return;
        }
        
        if (!roomId.trim()) {
            toast.error('Please enter a room ID');
            return;
        }

        joinRoom(roomId);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            <div className="container mx-auto px-4 py-16">
                {/* Hero Section */}
                <div className="text-center mb-16">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-blue-100 rounded-full">
                            <MapPin className="h-12 w-12 text-blue-600" />
                        </div>
                    </div>
                    <h1 className="text-5xl font-bold text-gray-900 mb-6">
                        Plan Events Together
                    </h1>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                        Collaborate in real-time on interactive maps. Drop pins, vote on locations, 
                        and find the perfect meeting spots for your group events.
                    </p>
                    
                    <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto mt-12 mb-16">
                        <div className="text-center">
                            <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-4">
                                <Users className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Real-time Collaboration</h3>
                            <p className="text-gray-600">Work together with your team in real-time</p>
                        </div>
                        <div className="text-center">
                            <div className="p-3 bg-purple-100 rounded-full w-fit mx-auto mb-4">
                                <Vote className="h-8 w-8 text-purple-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Smart Voting</h3>
                            <p className="text-gray-600">Vote on locations and find consensus</p>
                        </div>
                        <div className="text-center">
                            <div className="p-3 bg-orange-100 rounded-full w-fit mx-auto mb-4">
                                <Target className="h-8 w-8 text-orange-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Optimal Locations</h3>
                            <p className="text-gray-600">AI-powered meeting point suggestions</p>
                        </div>
                    </div>
                </div>

                {/* Main Action Section */}
                <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                    {/* Create/Join Room */}
                    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl text-gray-800">Get Started</CardTitle>
                            <CardDescription>Create a new room or join an existing one</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="userName">Your Name</Label>
                                <Input
                                    id="userName"
                                    placeholder="Enter your name"
                                    value={userName}
                                    onChange={(e) => setUserName(e.target.value)}
                                    className="bg-white border-gray-200"
                                />
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h4 className="font-medium text-gray-800">Create New Room</h4>
                                <div className="space-y-2">
                                    <Label htmlFor="roomName">Room Name</Label>
                                    <Input
                                        id="roomName"
                                        placeholder="e.g., Weekend Trip Planning"
                                        value={roomName}
                                        onChange={(e) => setRoomName(e.target.value)}
                                        className="bg-white border-gray-200"
                                    />
                                </div>
                                <Button 
                                    onClick={createRoom} 
                                    disabled={loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {loading ? 'Creating...' : 'Create Room'}
                                    <Plus className="ml-2 h-4 w-4" />
                                </Button>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h4 className="font-medium text-gray-800">Join with Room ID</h4>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Enter room ID"
                                        value={roomId}
                                        onChange={(e) => setRoomId(e.target.value)}
                                        className="bg-white border-gray-200"
                                    />
                                    <Button 
                                        onClick={joinRoomById}
                                        disabled={!roomId.trim() || !userName.trim()}
                                        variant="outline"
                                        className="whitespace-nowrap"
                                    >
                                        Join
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Rooms */}
                    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
                        <CardHeader>
                            <CardTitle className="text-2xl text-gray-800">Recent Rooms</CardTitle>
                            <CardDescription>Join an active planning session</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {rooms.length > 0 ? (
                                    rooms.map((room) => (
                                        <div key={room.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-gray-900">{room.name}</h4>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        By {room.created_by} • {room.members?.length || 0} members
                                                    </p>
                                                </div>
                                                <Button 
                                                    size="sm"
                                                    onClick={() => joinRoom(room.id)}
                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                >
                                                    Join
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                        <p>No active rooms found.</p>
                                        <p className="text-sm">Create the first one!</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

// Map View Component
function MapView() {
    const roomId = window.location.pathname.split('/').pop();
    const [userName] = useState(localStorage.getItem('userName') || 'Anonymous');
    const [userId] = useState(localStorage.getItem('userId') || 'anonymous');
    const [pins, setPins] = useState([]);
    const [selectedPin, setSelectedPin] = useState(null);
    const [showPinDialog, setShowPinDialog] = useState(false);
    const [newPin, setNewPin] = useState({ title: '', description: '', latitude: 0, longitude: 0 });
    const [room, setRoom] = useState(null);
    const [optimalLocation, setOptimalLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const socketRef = useRef(null);
    const mapRef = useRef(null);

    useEffect(() => {
        // Initialize Socket.IO connection
        socketRef.current = io(BACKEND_URL);

        socketRef.current.on('connect', () => {
            console.log('Connected to server');
            // Join the room
            socketRef.current.emit('join_room', {
                room_id: roomId,
                user_name: userName
            });
        });

        socketRef.current.on('pins_update', (data) => {
            setPins(data.pins || []);
        });

        socketRef.current.on('pin_added', (pin) => {
            setPins(prev => [...prev.filter(p => p.id !== pin.id), pin]);
            toast.success(`New pin added: ${pin.title}`);
        });

        socketRef.current.on('pin_modified', (pin) => {
            setPins(prev => prev.map(p => p.id === pin.id ? pin : p));
        });

        socketRef.current.on('pin_removed', (data) => {
            setPins(prev => prev.filter(p => p.id !== data.pin_id));
            toast.info(`Pin removed: ${data.title}`);
        });

        socketRef.current.on('user_joined', (data) => {
            toast.success(data.message);
        });

        socketRef.current.on('user_left', (data) => {
            toast.info(data.message);
        });

        // Fetch initial data
        fetchRoomData();
        fetchPins();

        return () => {
            if (socketRef.current) {
                socketRef.current.emit('leave_room', {
                    room_id: roomId,
                    user_name: userName
                });
                socketRef.current.disconnect();
            }
        };
    }, [roomId, userName]);

    const fetchRoomData = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API}/rooms/${roomId}`);
            setRoom(response.data);
            setError(null);
        } catch (error) {
            console.error('Error fetching room:', error);
            setError('Room not found or failed to load');
            toast.error('Room not found');
        } finally {
            setLoading(false);
        }
    };

    const fetchPins = async () => {
        try {
            const response = await axios.get(`${API}/pins/room/${roomId}`);
            setPins(response.data);
        } catch (error) {
            console.error('Error fetching pins:', error);
        }
    };

    const fetchOptimalLocation = async () => {
        try {
            const response = await axios.get(`${API}/rooms/${roomId}/optimal-location`);
            setOptimalLocation(response.data.optimal_location);
            toast.success('Optimal location calculated!');
        } catch (error) {
            console.error('Error fetching optimal location:', error);
            toast.error('No pins found to calculate optimal location');
        }
    };

    const handleMapClick = (latlng) => {
        setNewPin({
            ...newPin,
            latitude: latlng.lat,
            longitude: latlng.lng
        });
        setShowPinDialog(true);
    };

    const createPin = async () => {
        if (!newPin.title.trim()) {
            toast.error('Please enter a pin title');
            return;
        }

        try {
            const response = await axios.post(`${API}/pins`, {
                room_id: roomId,
                title: newPin.title,
                description: newPin.description,
                latitude: newPin.latitude,
                longitude: newPin.longitude,
                created_by: userId
            });

            setShowPinDialog(false);
            setNewPin({ title: '', description: '', latitude: 0, longitude: 0 });
            
            // The real-time update will handle adding the pin to the UI
        } catch (error) {
            console.error('Error creating pin:', error);
            toast.error('Failed to create pin');
        }
    };

    const votePin = async (pinId) => {
        try {
            await axios.post(`${API}/pins/${pinId}/vote?user_id=${userId}`);
            // The real-time update will handle the vote update
        } catch (error) {
            console.error('Error voting on pin:', error);
            toast.error('Failed to vote on pin');
        }
    };

    const shareRoom = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        toast.success('Room link copied to clipboard!');
    };

    return (
        <div className="h-screen flex flex-col bg-gray-100">
            {/* Header */}
            <div className="bg-white shadow-sm border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <MapPin className="h-6 w-6 text-blue-600" />
                            <h1 className="text-xl font-semibold text-gray-900">
                                {room?.name || 'Event Planning Map'}
                            </h1>
                        </div>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            {pins.length} pins
                        </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={fetchOptimalLocation}
                            className="text-purple-600 border-purple-200 hover:bg-purple-50"
                        >
                            <Target className="h-4 w-4 mr-2" />
                            Find Optimal Location
                        </Button>
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={shareRoom}
                            className="text-green-600 border-green-200 hover:bg-green-50"
                        >
                            <Share2 className="h-4 w-4 mr-2" />
                            Share Room
                        </Button>
                        <Badge className="bg-gray-100 text-gray-800">
                            {userName}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Map */}
            <div className="flex-1 relative">
                <MapContainer
                    center={[40.7128, -74.0060]} // Default to NYC
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    ref={mapRef}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    <MapClickHandler onMapClick={handleMapClick} />
                    
                    {/* Regular pins */}
                    {pins.map((pin) => (
                        <Marker
                            key={pin.id}
                            position={[pin.location.coordinates[1], pin.location.coordinates[0]]}
                            icon={createPinIcon('#3b82f6', pin.votes)}
                        >
                            <Popup className="custom-popup">
                                <div className="p-2 min-w-[200px]">
                                    <h3 className="font-semibold text-gray-900 mb-1">{pin.title}</h3>
                                    {pin.description && (
                                        <p className="text-sm text-gray-600 mb-2">{pin.description}</p>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">
                                            By {pin.created_by}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant={pin.voted_by?.includes(userId) ? "default" : "outline"}
                                            onClick={() => votePin(pin.id)}
                                            className="h-7 px-2 text-xs"
                                        >
                                            <Vote className="h-3 w-3 mr-1" />
                                            {pin.votes}
                                        </Button>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                    
                    {/* Optimal location marker */}
                    {optimalLocation && (
                        <Marker
                            position={[optimalLocation.latitude, optimalLocation.longitude]}
                            icon={createPinIcon('#10b981', 0)}
                        >
                            <Popup>
                                <div className="p-2">
                                    <h3 className="font-semibold text-green-700 mb-1">
                                        <Target className="inline h-4 w-4 mr-1" />
                                        Optimal Meeting Point
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Geographic center of all pins
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    )}
                </MapContainer>

                {/* Instructions Overlay */}
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-3 max-w-xs">
                    <h3 className="font-medium text-gray-900 mb-2">How to use:</h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Click anywhere on the map to add a pin</li>
                        <li>• Vote on pins by clicking the vote button</li>
                        <li>• Find optimal meeting points with the button above</li>
                        <li>• Share the room link to invite others</li>
                    </ul>
                </div>
            </div>

            {/* Pin Creation Dialog */}
            <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Pin</DialogTitle>
                        <DialogDescription>
                            Create a new location marker at the selected point
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="pinTitle">Title</Label>
                            <Input
                                id="pinTitle"
                                placeholder="e.g., Meeting Point, Restaurant, etc."
                                value={newPin.title}
                                onChange={(e) => setNewPin({...newPin, title: e.target.value})}
                            />
                        </div>
                        <div>
                            <Label htmlFor="pinDescription">Description (Optional)</Label>
                            <Textarea
                                id="pinDescription"
                                placeholder="Additional details about this location..."
                                value={newPin.description}
                                onChange={(e) => setNewPin({...newPin, description: e.target.value})}
                            />
                        </div>
                        <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setShowPinDialog(false)}>
                                Cancel
                            </Button>
                            <Button onClick={createPin}>
                                Add Pin
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default App;