#!/bin/bash

# TeamTaatom SuperAdmin Security Setup Script
# This script creates SuperAdmin credentials and saves them to the database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:3000"
API_ENDPOINT="$BACKEND_URL/api/v1/superadmin"

echo -e "${BLUE}🔐 TeamTaatom SuperAdmin Security Setup${NC}"
echo -e "${YELLOW}=====================================${NC}"
echo ""

# Function to validate email
validate_email() {
    local email="$1"
    if [[ $email =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to validate password strength
validate_password() {
    local password="$1"
    local min_length=8
    
    if [[ ${#password} -lt $min_length ]]; then
        echo -e "${RED}❌ Password must be at least $min_length characters long${NC}"
        return 1
    fi
    
    if [[ ! $password =~ [A-Z] ]]; then
        echo -e "${RED}❌ Password must contain at least one uppercase letter${NC}"
        return 1
    fi
    
    if [[ ! $password =~ [a-z] ]]; then
        echo -e "${RED}❌ Password must contain at least one lowercase letter${NC}"
        return 1
    fi
    
    if [[ ! $password =~ [0-9] ]]; then
        echo -e "${RED}❌ Password must contain at least one number${NC}"
        return 1
    fi
    
    if [[ ! $password =~ [^a-zA-Z0-9] ]]; then
        echo -e "${RED}❌ Password must contain at least one special character${NC}"
        return 1
    fi
    
    return 0
}

# Function to check if backend is running
check_backend() {
    echo -e "${YELLOW}🔍 Checking backend server...${NC}"
    if curl -s "$BACKEND_URL/api/v1/superadmin/csrf-token" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend server is running${NC}"
        return 0
    else
        echo -e "${RED}❌ Backend server is not running${NC}"
        echo -e "${YELLOW}Please start your backend server first:${NC}"
        echo -e "${BLUE}cd ../backend && npm start${NC}"
        return 1
    fi
}

# Function to check if SuperAdmin already exists
check_existing_admin() {
    echo -e "${YELLOW}🔍 Checking for existing SuperAdmin...${NC}"
    echo -e "${YELLOW}⚠️  Note: This will create a new SuperAdmin account${NC}"
    echo -e "${YELLOW}If one already exists, you may need to delete it from the database first.${NC}"
    echo ""
}

# Function to create SuperAdmin via API
create_superadmin() {
    local email="$1"
    local password="$2"
    
    echo -e "${YELLOW}🔐 Creating SuperAdmin account...${NC}"
    
    # First, get CSRF token (optional, but helps with some setups)
    local csrf_response=$(curl -s -c /tmp/cookies.txt "$BACKEND_URL/api/v1/superadmin/csrf-token")
    local csrf_token=$(echo "$csrf_response" | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
    
    # Build curl command with cookies and CSRF token if available
    local headers=(-H "Content-Type: application/json" -b /tmp/cookies.txt)
    if [[ -n "$csrf_token" ]]; then
        headers+=(-H "X-CSRF-Token: $csrf_token")
    fi
    
    # Make the request and capture both response and HTTP code
    local http_code response
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_ENDPOINT/create" \
        "${headers[@]}" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    
    # Extract HTTP code (last line) and response body (everything else)
    http_code=$(echo "$response" | tail -n1)
    response=$(echo "$response" | sed '$d')
    
    echo -e "${BLUE}API Response: $response${NC}"
    echo -e "${BLUE}HTTP Status Code: $http_code${NC}"
    
    # Clean up cookies file
    rm -f /tmp/cookies.txt 2>/dev/null
    
    # Check for errors first
    if echo "$response" | grep -qi "\"error\"" || echo "$response" | grep -qi "CSRF\|Forbidden\|Unauthorized"; then
        echo -e "${RED}❌ Failed to create SuperAdmin account${NC}"
        echo -e "${RED}Error: $response${NC}"
        return 1
    fi
    
    # Check if the response contains success indicators
    if [[ "$http_code" == "201" ]] || echo "$response" | grep -qi "SuperAdmin created successfully\|message.*success"; then
        echo -e "${GREEN}✅ SuperAdmin account created successfully!${NC}"
        
        # Extract user info if available
        local user_id=$(echo "$response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
        if [[ -n "$user_id" ]]; then
            echo -e "${GREEN}📝 SuperAdmin ID: $user_id${NC}"
        fi
        
        return 0
    else
        echo -e "${RED}❌ Failed to create SuperAdmin account${NC}"
        echo -e "${RED}Response: $response${NC}"
        echo -e "${RED}HTTP Code: $http_code${NC}"
        return 1
    fi
}

# Main setup process
main() {
    echo -e "${BLUE}This script will create a SuperAdmin account in the database.${NC}"
    echo -e "${YELLOW}Make sure your backend server is running on port 3000.${NC}"
    echo ""
    
    # Check backend
    if ! check_backend; then
        exit 1
    fi
    
    # Check existing admin
    check_existing_admin
    
    echo ""
    echo -e "${BLUE}📧 Enter SuperAdmin Email:${NC}"
    read -r email
    
    # Validate email
    while ! validate_email "$email"; do
        echo -e "${RED}❌ Invalid email format. Please enter a valid email address:${NC}"
        read -r email
    done
    
    echo ""
    echo -e "${BLUE}🔑 Enter SuperAdmin Password:${NC}"
    echo -e "${YELLOW}(Must be at least 8 characters with uppercase, lowercase, number, and special character)${NC}"
    read -s password
    echo ""
    
    # Validate password strength
    while ! validate_password "$password"; do
        echo ""
        echo -e "${BLUE}🔑 Please enter a stronger password:${NC}"
        read -s password
        echo ""
    done
    
    echo ""
    echo -e "${BLUE}🔑 Confirm SuperAdmin Password:${NC}"
    read -s confirm_password
    echo ""
    
    # Verify password match
    while [[ "$password" != "$confirm_password" ]]; do
        echo -e "${RED}❌ Passwords do not match. Please try again.${NC}"
        echo ""
        echo -e "${BLUE}🔑 Enter SuperAdmin Password:${NC}"
        read -s password
        echo ""
        echo -e "${BLUE}🔑 Confirm SuperAdmin Password:${NC}"
        read -s confirm_password
        echo ""
    done
    
    echo ""
    echo -e "${BLUE}🏢 Organization (optional):${NC}"
    read -r organization
    
    # Create SuperAdmin in database
    if create_superadmin "$email" "$password"; then
        echo ""
        echo -e "${GREEN}🎉 SuperAdmin setup completed successfully!${NC}"
        echo ""
        echo -e "${BLUE}📋 Next Steps:${NC}"
        echo -e "${BLUE}1. Access the SuperAdmin dashboard: http://localhost:5001${NC}"
        echo -e "${BLUE}2. Login with your credentials:${NC}"
        echo -e "${BLUE}   Email: $email${NC}"
        echo -e "${BLUE}   Password: [your password]${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  Security Reminders:${NC}"
        echo -e "${YELLOW}- Keep your credentials secure${NC}"
        echo -e "${YELLOW}- Change password regularly${NC}"
        echo -e "${YELLOW}- Monitor access logs${NC}"
        echo ""
        echo -e "${GREEN}✅ SuperAdmin is now ready to use!${NC}"
    else
        echo -e "${RED}❌ Setup failed. Please check your backend server and try again.${NC}"
        exit 1
    fi
}

# Run main function
main "$@"