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
API_ENDPOINT="$BACKEND_URL/api/founder"

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
    if curl -s "$BACKEND_URL/api/founder/login" > /dev/null 2>&1; then
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
    
    local response=$(curl -s -X POST "$API_ENDPOINT/create" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    
    echo -e "${BLUE}API Response: $response${NC}"
    
    # Check if the response contains success indicators
    if echo "$response" | grep -q "SuperAdmin created successfully\|token\|success"; then
        echo -e "${GREEN}✅ SuperAdmin account created successfully!${NC}"
        
        # Extract token for testing
        local token=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        if [[ -n "$token" ]]; then
            echo -e "${GREEN}🔑 Authentication token generated${NC}"
            echo -e "${BLUE}Token: ${token:0:20}...${NC}"
        fi
        
        return 0
    else
        echo -e "${RED}❌ Failed to create SuperAdmin account${NC}"
        echo -e "${RED}Response: $response${NC}"
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