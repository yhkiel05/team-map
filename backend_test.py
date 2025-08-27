import requests
import sys
import json
from datetime import datetime
import time

class EventPlanningMapTester:
    def __init__(self, base_url="https://map-planner-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_room_id = None
        self.created_pin_id = None
        self.test_user = f"test_user_{datetime.now().strftime('%H%M%S')}"

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_api_root(self):
        """Test API root endpoint"""
        return self.run_test("API Root", "GET", "", 200)

    def test_create_room(self):
        """Test room creation"""
        room_data = {
            "name": f"Test Room {datetime.now().strftime('%H:%M:%S')}",
            "description": "Test room for API testing",
            "created_by": self.test_user
        }
        
        success, response = self.run_test("Create Room", "POST", "rooms", 200, data=room_data)
        if success and 'id' in response:
            self.created_room_id = response['id']
            print(f"   Created room ID: {self.created_room_id}")
        return success

    def test_get_rooms(self):
        """Test getting all rooms"""
        return self.run_test("Get All Rooms", "GET", "rooms", 200)

    def test_get_room_by_id(self):
        """Test getting specific room"""
        if not self.created_room_id:
            print("❌ No room ID available for testing")
            return False
        
        return self.run_test("Get Room by ID", "GET", f"rooms/{self.created_room_id}", 200)

    def test_join_room(self):
        """Test joining a room"""
        if not self.created_room_id:
            print("❌ No room ID available for testing")
            return False
        
        return self.run_test("Join Room", "POST", f"rooms/{self.created_room_id}/join", 200, 
                           params={"user_id": self.test_user})

    def test_create_pin(self):
        """Test pin creation"""
        if not self.created_room_id:
            print("❌ No room ID available for testing")
            return False
        
        pin_data = {
            "room_id": self.created_room_id,
            "title": "Test Pin Location",
            "description": "This is a test pin for API testing",
            "latitude": 40.7128,  # NYC coordinates
            "longitude": -74.0060,
            "created_by": self.test_user
        }
        
        success, response = self.run_test("Create Pin", "POST", "pins", 200, data=pin_data)
        if success and 'id' in response:
            self.created_pin_id = response['id']
            print(f"   Created pin ID: {self.created_pin_id}")
        return success

    def test_get_room_pins(self):
        """Test getting pins for a room"""
        if not self.created_room_id:
            print("❌ No room ID available for testing")
            return False
        
        return self.run_test("Get Room Pins", "GET", f"pins/room/{self.created_room_id}", 200)

    def test_vote_pin(self):
        """Test voting on a pin"""
        if not self.created_pin_id:
            print("❌ No pin ID available for testing")
            return False
        
        return self.run_test("Vote on Pin", "POST", f"pins/{self.created_pin_id}/vote", 200,
                           params={"user_id": self.test_user})

    def test_vote_pin_again(self):
        """Test voting on same pin again (should remove vote)"""
        if not self.created_pin_id:
            print("❌ No pin ID available for testing")
            return False
        
        return self.run_test("Vote on Pin Again (Remove)", "POST", f"pins/{self.created_pin_id}/vote", 200,
                           params={"user_id": self.test_user})

    def test_optimal_location(self):
        """Test optimal location calculation"""
        if not self.created_room_id:
            print("❌ No room ID available for testing")
            return False
        
        # Create a second pin to have multiple points for centroid calculation
        pin_data = {
            "room_id": self.created_room_id,
            "title": "Second Test Pin",
            "description": "Second pin for optimal location testing",
            "latitude": 40.7589,  # Different NYC coordinates
            "longitude": -73.9851,
            "created_by": self.test_user
        }
        
        print("\n🔍 Creating second pin for optimal location test...")
        success, _ = self.run_test("Create Second Pin", "POST", "pins", 200, data=pin_data)
        
        if success:
            # Wait a moment for the pin to be saved
            time.sleep(1)
            return self.run_test("Get Optimal Location", "GET", f"rooms/{self.created_room_id}/optimal-location", 200)
        return False

    def test_nearby_pins(self):
        """Test finding nearby pins"""
        return self.run_test("Find Nearby Pins", "GET", "pins/nearby", 200,
                           params={"longitude": -74.0060, "latitude": 40.7128, "max_distance": 10000})

    def test_create_user(self):
        """Test user creation"""
        user_data = {
            "name": self.test_user,
            "email": f"{self.test_user}@test.com",
            "avatar": ""
        }
        
        success, response = self.run_test("Create User", "POST", "users", 200, data=user_data)
        if success and 'id' in response:
            self.created_user_id = response['id']
            print(f"   Created user ID: {self.created_user_id}")
        return success

    def test_get_user(self):
        """Test getting user by ID"""
        if not hasattr(self, 'created_user_id'):
            print("❌ No user ID available for testing")
            return False
        
        return self.run_test("Get User by ID", "GET", f"users/{self.created_user_id}", 200)

    def test_socket_io_endpoint(self):
        """Test Socket.IO endpoint accessibility"""
        try:
            # Test if Socket.IO endpoint is accessible
            response = requests.get(f"{self.base_url}/socket.io/")
            if response.status_code in [200, 400]:  # 400 is expected for GET on Socket.IO
                print("✅ Socket.IO endpoint is accessible")
                return True
            else:
                print(f"❌ Socket.IO endpoint returned: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Socket.IO endpoint test failed: {str(e)}")
            return False

def main():
    print("🚀 Starting Event Planning Map API Tests")
    print("=" * 50)
    
    tester = EventPlanningMapTester()
    
    # Test sequence
    test_methods = [
        tester.test_api_root,
        tester.test_socket_io_endpoint,
        tester.test_create_room,
        tester.test_get_rooms,
        tester.test_get_room_by_id,
        tester.test_join_room,
        tester.test_create_user,
        tester.test_get_user,
        tester.test_create_pin,
        tester.test_get_room_pins,
        tester.test_vote_pin,
        tester.test_vote_pin_again,
        tester.test_optimal_location,
        tester.test_nearby_pins,
    ]
    
    # Run all tests
    for test_method in test_methods:
        try:
            test_method()
        except Exception as e:
            print(f"❌ Test {test_method.__name__} failed with exception: {str(e)}")
        
        # Small delay between tests
        time.sleep(0.5)
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        failed_tests = tester.tests_run - tester.tests_passed
        print(f"⚠️  {failed_tests} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())