"""AnswerIQ Backend API Tests"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@answeriq.com"
TEST_PASSWORD = "testpass123"
TEST_NAME = "Test User"
NEW_EMAIL = f"TEST_new_{int(time.time())}@answeriq.com"

SAMPLE_TXT_CONTENT = b"This is a reference document about company policies.\nThe vacation policy allows 15 days per year.\nThe company was founded in 2020."
SAMPLE_QUESTIONNAIRE_CONTENT = b"1. What is the vacation policy?\n2. When was the company founded?\n3. What is the sick leave policy?"


@pytest.fixture(scope="module")
def auth_token():
    """Login and get token"""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if resp.status_code == 200:
        return resp.json()["token"]
    # Try registering
    resp2 = requests.post(f"{BASE_URL}/api/auth/register", json={"name": TEST_NAME, "email": TEST_EMAIL, "password": TEST_PASSWORD})
    if resp2.status_code == 200:
        return resp2.json()["token"]
    pytest.skip("Could not authenticate")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


class TestHealthAndRoot:
    """Health and root endpoint tests"""

    def test_root_returns_message(self):
        resp = requests.get(f"{BASE_URL}/api/")
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data


class TestAuth:
    """Auth endpoint tests"""

    def test_register_new_user(self):
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": "New User", "email": NEW_EMAIL, "password": "pass12345"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == NEW_EMAIL

    def test_register_duplicate_email(self):
        resp = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": TEST_NAME, "email": TEST_EMAIL, "password": TEST_PASSWORD
        })
        assert resp.status_code == 400

    def test_login_success(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "user" in data

    def test_login_invalid_credentials(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": "wrongpassword"})
        assert resp.status_code == 401

    def test_get_me(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "email" in data
        assert data["email"] == TEST_EMAIL


class TestDocuments:
    """Document CRUD tests"""

    def test_list_documents(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/documents", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_upload_txt_document(self, auth_headers):
        files = {"file": ("test_doc.txt", SAMPLE_TXT_CONTENT, "text/plain")}
        resp = requests.post(f"{BASE_URL}/api/documents", headers=auth_headers, files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert data["name"] == "test_doc.txt"
        return data["id"]

    def test_upload_and_delete_document(self, auth_headers):
        # Upload
        files = {"file": ("to_delete.txt", b"Delete me content here for testing.", "text/plain")}
        resp = requests.post(f"{BASE_URL}/api/documents", headers=auth_headers, files=files)
        assert resp.status_code == 200
        doc_id = resp.json()["id"]

        # Delete
        del_resp = requests.delete(f"{BASE_URL}/api/documents/{doc_id}", headers=auth_headers)
        assert del_resp.status_code == 200
        assert del_resp.json()["success"] is True

    def test_upload_unsupported_file_type(self, auth_headers):
        files = {"file": ("test.docx", b"some content", "application/octet-stream")}
        resp = requests.post(f"{BASE_URL}/api/documents", headers=auth_headers, files=files)
        assert resp.status_code == 400


class TestQuestionnaires:
    """Questionnaire tests"""

    @pytest.fixture(scope="class")
    def doc_id(self, auth_headers):
        files = {"file": ("ref_doc.txt", SAMPLE_TXT_CONTENT, "text/plain")}
        resp = requests.post(f"{BASE_URL}/api/documents", headers=auth_headers, files=files)
        assert resp.status_code == 200
        return resp.json()["id"]

    def test_list_questionnaires(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/questionnaires", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_upload_questionnaire(self, auth_headers):
        files = {"file": ("questionnaire.txt", SAMPLE_QUESTIONNAIRE_CONTENT, "text/plain")}
        resp = requests.post(f"{BASE_URL}/api/questionnaires", headers=auth_headers, files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert "questions" in data
        assert len(data["questions"]) > 0

    def test_get_questionnaire(self, auth_headers):
        # Upload first
        files = {"file": ("questionnaire2.txt", SAMPLE_QUESTIONNAIRE_CONTENT, "text/plain")}
        resp = requests.post(f"{BASE_URL}/api/questionnaires", headers=auth_headers, files=files)
        assert resp.status_code == 200
        q_id = resp.json()["id"]

        # Get
        get_resp = requests.get(f"{BASE_URL}/api/questionnaires/{q_id}", headers=auth_headers)
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert data["id"] == q_id
        assert "status" in data

    def test_process_questionnaire(self, auth_headers, doc_id):
        # Upload questionnaire
        files = {"file": ("process_q.txt", SAMPLE_QUESTIONNAIRE_CONTENT, "text/plain")}
        resp = requests.post(f"{BASE_URL}/api/questionnaires", headers=auth_headers, files=files)
        assert resp.status_code == 200
        q_id = resp.json()["id"]

        # Process
        proc_resp = requests.post(
            f"{BASE_URL}/api/questionnaires/{q_id}/process",
            headers=auth_headers,
            json={"document_ids": [doc_id]}
        )
        assert proc_resp.status_code == 200
        data = proc_resp.json()
        assert data["status"] == "processing"

    def test_process_no_docs_fails(self, auth_headers):
        """Test that processing without any docs fails gracefully"""
        # Upload questionnaire
        files = {"file": ("nodoc_q.txt", SAMPLE_QUESTIONNAIRE_CONTENT, "text/plain")}
        resp = requests.post(f"{BASE_URL}/api/questionnaires", headers=auth_headers, files=files)
        q_id = resp.json()["id"]

        # Process with non-existent doc id
        proc_resp = requests.post(
            f"{BASE_URL}/api/questionnaires/{q_id}/process",
            headers=auth_headers,
            json={"document_ids": ["000000000000000000000000"]}
        )
        # Should succeed in starting processing (400 only if no docs at all for user)
        assert proc_resp.status_code in [200, 400]
