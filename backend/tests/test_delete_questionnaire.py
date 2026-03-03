"""
Backend tests for DELETE /api/questionnaires/{id} endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://doc-to-response.preview.emergentagent.com').rstrip('/')

TEST_EMAIL = "testdelete_iq@example.com"
TEST_PASSWORD = "Test1234!"


@pytest.fixture(scope="module")
def auth_token():
    # Try login first
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if res.status_code == 200:
        return res.json().get("token")
    # Register
    res = requests.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "Test Delete User"
    })
    assert res.status_code in [200, 201], f"Register failed: {res.text}"
    return res.json().get("token")


@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


@pytest.fixture
def questionnaire_id(headers):
    """Upload a test questionnaire and return its ID"""
    txt_content = b"What is your data encryption policy?\nDo you have SOC 2 compliance?\nHow do you handle data breaches?\n"
    files = {"file": ("test_q.txt", txt_content, "text/plain")}
    auth_header = {"Authorization": headers["Authorization"]}
    res = requests.post(f"{BASE_URL}/api/questionnaires", files=files, headers=auth_header)
    assert res.status_code == 200, f"Upload failed: {res.text}"
    q_id = res.json()["id"]
    yield q_id
    # Cleanup if not deleted
    requests.delete(f"{BASE_URL}/api/questionnaires/{q_id}", headers=headers)


class TestDeleteQuestionnaire:
    """Tests for DELETE /api/questionnaires/{id}"""

    def test_delete_questionnaire_success(self, headers, questionnaire_id):
        """DELETE returns 200 with {success: true}"""
        res = requests.delete(f"{BASE_URL}/api/questionnaires/{questionnaire_id}", headers=headers)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        data = res.json()
        assert data.get("success") is True

    def test_delete_questionnaire_not_found(self, headers):
        """DELETE returns 404 for non-existent ID"""
        fake_id = "507f1f77bcf86cd799439011"  # valid ObjectId format but doesn't exist
        res = requests.delete(f"{BASE_URL}/api/questionnaires/{fake_id}", headers=headers)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}: {res.text}"

    def test_delete_questionnaire_invalid_id(self, headers):
        """DELETE returns 400 for invalid ID format"""
        res = requests.delete(f"{BASE_URL}/api/questionnaires/invalid-id", headers=headers)
        assert res.status_code == 400, f"Expected 400, got {res.status_code}: {res.text}"

    def test_deleted_questionnaire_no_longer_in_list(self, headers):
        """After delete, questionnaire should not appear in list"""
        # Upload a new one
        txt_content = b"What is your security policy?\nHow do you store passwords?\n"
        files = {"file": ("test_q2.txt", txt_content, "text/plain")}
        auth_header = {"Authorization": headers["Authorization"]}
        create_res = requests.post(f"{BASE_URL}/api/questionnaires", files=files, headers=auth_header)
        assert create_res.status_code == 200
        q_id = create_res.json()["id"]

        # Delete it
        del_res = requests.delete(f"{BASE_URL}/api/questionnaires/{q_id}", headers=headers)
        assert del_res.status_code == 200

        # Verify not in list
        list_res = requests.get(f"{BASE_URL}/api/questionnaires", headers=headers)
        assert list_res.status_code == 200
        ids = [q["id"] for q in list_res.json()]
        assert q_id not in ids, "Deleted questionnaire still appears in list"

    def test_delete_requires_auth(self):
        """DELETE without auth should return 401/403"""
        fake_id = "507f1f77bcf86cd799439011"
        res = requests.delete(f"{BASE_URL}/api/questionnaires/{fake_id}")
        assert res.status_code in [401, 403], f"Expected 401/403, got {res.status_code}"
