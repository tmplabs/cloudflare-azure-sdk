#!/bin/bash

# Cloudflare Azure Email Worker Setup Script
# This script helps you set up and deploy your email worker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Main setup function
main() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "  Cloudflare Azure Email Worker Setup    "
    echo "=========================================="
    echo -e "${NC}"

    # Check prerequisites
    check_prerequisites

    # Setup options
    echo ""
    echo "What would you like to do?"
    echo "1) Initial setup (install dependencies and configure)"
    echo "2) Set up Azure secrets"
    echo "3) Deploy to Cloudflare Workers"
    echo "4) Run tests"
    echo "5) Start local development"
    echo "6) Complete setup (all of the above)"
    echo ""
    read -p "Enter your choice (1-6): " choice

    case $choice in
        1) initial_setup ;;
        2) setup_secrets ;;
        3) deploy_worker ;;
        4) run_tests ;;
        5) start_dev ;;
        6) complete_setup ;;
        *) log_error "Invalid choice. Exiting." && exit 1 ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command_exists node; then
        log_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi

    if ! command_exists npm; then
        log_error "npm is not installed. Please install npm first."
        exit 1
    fi

    if ! command_exists wrangler; then
        log_warning "Wrangler CLI not found. Installing..."
        npm install -g wrangler
    fi

    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Initial setup
initial_setup() {
    log_info "Starting initial setup..."

    # Install dependencies
    log_info "Installing dependencies..."
    npm install

    # Check if wrangler is authenticated
    if ! wrangler whoami >/dev/null 2>&1; then
        log_warning "Wrangler is not authenticated."
        read -p "Do you want to authenticate now? (y/n): " auth_choice
        if [ "$auth_choice" = "y" ] || [ "$auth_choice" = "Y" ]; then
            wrangler login
        else
            log_warning "You'll need to run 'wrangler login' before deploying."
        fi
    fi

    # Create .env.example if it doesn't exist
    if [ ! -f ".env.example" ]; then
        log_info "Creating .env.example file..."
        cat > .env.example << EOF
# Azure Communication Services Configuration
# Use either connection string OR service principal authentication

# Method 1: Connection String (Recommended)
AZURE_COMMUNICATION_CONNECTION_STRING=endpoint=https://your-acs-resource.communication.azure.com/;accesskey=your-access-key

# Method 2: Service Principal Authentication
# AZURE_CLIENT_ID=your-client-id
# AZURE_CLIENT_SECRET=your-client-secret
# AZURE_TENANT_ID=your-tenant-id
# AZURE_COMMUNICATION_ENDPOINT=https://your-acs-resource.communication.azure.com

# Optional Configuration
ALLOWED_ORIGINS=*
MAX_EMAILS_PER_HOUR=100
LOG_LEVEL=info
EOF
    fi

    log_success "Initial setup completed!"
    log_info "Next steps:"
    log_info "1. Set up your Azure Communication Services resource"
    log_info "2. Run the script again and choose option 2 to set secrets"
    log_info "3. Deploy your worker with option 3"
}

# Setup Azure secrets
setup_secrets() {
    log_info "Setting up Azure Communication Services secrets..."

    echo ""
    echo "Choose your authentication method:"
    echo "1) Connection String (Recommended)"
    echo "2) Service Principal"
    echo ""
    read -p "Enter your choice (1-2): " auth_method

    case $auth_method in
        1) setup_connection_string ;;
        2) setup_service_principal ;;
        *) log_error "Invalid choice." && exit 1 ;;
    esac

    # Set optional configuration
    echo ""
    read -p "Set allowed origins (default: *): " origins
    origins=${origins:-"*"}
    wrangler secret put ALLOWED_ORIGINS --env production <<< "$origins"

    read -p "Set max emails per hour (default: 100): " max_emails
    max_emails=${max_emails:-"100"}
    wrangler secret put MAX_EMAILS_PER_HOUR --env production <<< "$max_emails"

    read -p "Set log level (error/warn/info/debug, default: info): " log_level
    log_level=${log_level:-"info"}
    wrangler secret put LOG_LEVEL --env production <<< "$log_level"

    log_success "Secrets configured successfully!"
}

# Setup connection string authentication
setup_connection_string() {
    log_info "Setting up connection string authentication..."
    echo ""
    echo "To get your connection string:"
    echo "1. Go to Azure Portal"
    echo "2. Navigate to your Communication Services resource"
    echo "3. Go to Settings > Keys"
    echo "4. Copy the connection string"
    echo ""
    
    read -p "Enter your Azure Communication Services connection string: " connection_string
    
    if [ -z "$connection_string" ]; then
        log_error "Connection string cannot be empty"
        exit 1
    fi
    
    echo "$connection_string" | wrangler secret put AZURE_COMMUNICATION_CONNECTION_STRING
    log_success "Connection string configured!"
}

# Setup service principal authentication
setup_service_principal() {
    log_info "Setting up service principal authentication..."
    echo ""
    echo "To set up service principal authentication:"
    echo "1. Create an Azure AD application"
    echo "2. Create a service principal"
    echo "3. Assign appropriate roles to the service principal"
    echo "4. Get the client ID, client secret, tenant ID, and endpoint"
    echo ""
    
    read -p "Enter your Azure Client ID: " client_id
    read -p "Enter your Azure Client Secret: " client_secret
    read -p "Enter your Azure Tenant ID: " tenant_id
    read -p "Enter your Azure Communication Services endpoint: " endpoint
    
    if [ -z "$client_id" ] || [ -z "$client_secret" ] || [ -z "$tenant_id" ] || [ -z "$endpoint" ]; then
        log_error "All service principal fields are required"
        exit 1
    fi
    
    echo "$client_id" | wrangler secret put AZURE_CLIENT_ID
    echo "$client_secret" | wrangler secret put AZURE_CLIENT_SECRET
    echo "$tenant_id" | wrangler secret put AZURE_TENANT_ID
    echo "$endpoint" | wrangler secret put AZURE_COMMUNICATION_ENDPOINT
    
    log_success "Service principal configured!"
}

# Deploy worker
deploy_worker() {
    log_info "Deploying worker to Cloudflare..."

    # Build first
    log_info "Building project..."
    npm run build

    # Deploy
    log_info "Deploying to Cloudflare Workers..."
    wrangler deploy

    log_success "Worker deployed successfully!"
    
    # Get worker URL
    WORKER_URL=$(wrangler subdomain get 2>/dev/null | grep -o 'https://[^[:space:]]*' || echo "Unable to get worker URL")
    
    if [ "$WORKER_URL" != "Unable to get worker URL" ]; then
        log_success "Your worker is available at: $WORKER_URL"
        
        # Test the deployment
        echo ""
        read -p "Would you like to test the deployment? (y/n): " test_choice
        if [ "$test_choice" = "y" ] || [ "$test_choice" = "Y" ]; then
            test_deployment "$WORKER_URL"
        fi
    fi
}

# Test deployment
test_deployment() {
    local worker_url="$1"
    log_info "Testing deployment..."

    read -p "Enter a test email address: " test_email
    
    if [ -z "$test_email" ]; then
        log_warning "No email provided, skipping test"
        return
    fi

    # Create test payload
    TEST_PAYLOAD=$(cat << EOF
{
  "to": "$test_email",
  "subject": "Test Email from Cloudflare Worker",
  "textContent": "This is a test email sent from your Cloudflare Worker using Azure Communication Services.",
  "htmlContent": "<h1>Test Email</h1><p>This is a test email sent from your Cloudflare Worker using Azure Communication Services.</p>",
  "from": "test@your-domain.com"
}
EOF
)

    # Send test request
    log_info "Sending test email..."
    RESPONSE=$(curl -s -X POST "$worker_url" \
        -H "Content-Type: application/json" \
        -d "$TEST_PAYLOAD" \
        -w "HTTPSTATUS:%{http_code}")

    HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$RESPONSE" | sed -E 's/HTTPSTATUS:[0-9]*$//')

    if [ "$HTTP_STATUS" = "200" ]; then
        log_success "Test email sent successfully!"
        echo "Response: $RESPONSE_BODY"
    else
        log_error "Test failed with status $HTTP_STATUS"
        echo "Response: $RESPONSE_BODY"
    fi
}

# Run tests
run_tests() {
    log_info "Running tests..."

    # Check if test dependencies are installed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies first..."
        npm install
    fi

    # Run type checking
    log_info "Running type checks..."
    npm run type-check

    # Run unit tests
    log_info "Running unit tests..."
    npm test

    # Run linting
    log_info "Running linter..."
    npm run lint

    log_success "All tests passed!"
}

# Start local development
start_dev() {
    log_info "Starting local development server..."

    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies first..."
        npm install
    fi

    log_info "Starting Wrangler dev server..."
    log_info "Your worker will be available at http://localhost:8787"
    log_info "Press Ctrl+C to stop the server"
    
    npm run dev
}

# Complete setup
complete_setup() {
    log_info "Starting complete setup..."
    
    initial_setup
    echo ""
    
    read -p "Do you want to set up Azure secrets now? (y/n): " setup_secrets_choice
    if [ "$setup_secrets_choice" = "y" ] || [ "$setup_secrets_choice" = "Y" ]; then
        setup_secrets
    fi
    
    echo ""
    read -p "Do you want to run tests? (y/n): " run_tests_choice
    if [ "$run_tests_choice" = "y" ] || [ "$run_tests_choice" = "Y" ]; then
        run_tests
    fi
    
    echo ""
    read -p "Do you want to deploy the worker? (y/n): " deploy_choice
    if [ "$deploy_choice" = "y" ] || [ "$deploy_choice" = "Y" ]; then
        deploy_worker
    fi
    
    log_success "Complete setup finished!"
    
    echo ""
    echo -e "${GREEN}🎉 Congratulations! Your Cloudflare Azure Email Worker is set up!${NC}"
    echo ""
    echo "Next steps:"
    echo "• Use 'npm run dev' to start local development"
    echo "• Use 'npm run deploy' to deploy updates"
    echo "• Check the examples/ folder for usage examples"
    echo "• Read the README.md for detailed documentation"
}

# Show help
show_help() {
    echo "Cloudflare Azure Email Worker Setup Script"
    echo ""
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  setup         Run interactive setup"
    echo "  install       Install dependencies only"
    echo "  secrets       Configure Azure secrets"
    echo "  deploy        Deploy to Cloudflare Workers"
    echo "  test          Run tests"
    echo "  dev           Start local development"
    echo "  help          Show this help message"
    echo ""
    echo "If no option is provided, interactive setup will start."
}

# Handle command line arguments
case "${1:-}" in
    "setup"|"")
        main
        ;;
    "install")
        check_prerequisites
        npm install
        log_success "Dependencies installed!"
        ;;
    "secrets")
        check_prerequisites
        setup_secrets
        ;;
    "deploy")
        check_prerequisites
        deploy_worker
        ;;
    "test")
        check_prerequisites
        run_tests
        ;;
    "dev")
        check_prerequisites
        start_dev
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        log_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac