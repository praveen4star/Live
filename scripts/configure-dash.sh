#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the profile name
PROFILE=$1

# Function to apply the default profile
apply_default() {
    cat > /tmp/dash_config.txt << 'EOF'
    dash {
        enabled         on;
        dash_path       ./objs/nginx/html;
        dash_fragment   1;
        dash_window     4;
        dash_mpd_file   [app]/[stream].mpd;
    }
EOF
    apply_config "default" "/tmp/dash_config.txt"
}

# Function to apply the explicit profile
apply_explicit() {
    cat > /tmp/dash_config.txt << 'EOF'
    dash {
        enabled             on;
        dash_path           ./objs/nginx/html;
        dash_fragment       1;
        dash_window         4;
        dash_mpd_file       [app]/[stream].mpd;
        dash_cleanup        on;
        dash_timeshift      600;
        dash_update_period  5000;
    }
EOF
    apply_config "explicit" "/tmp/dash_config.txt"
}

# Function to apply the number_mode profile
apply_number_mode() {
    cat > /tmp/dash_config.txt << 'EOF'
    dash {
        enabled             on;
        dash_path           ./objs/nginx/html;
        dash_segment_type   numbered;
        dash_fragment       1;
        dash_window         4;
        dash_mpd_file       [app]/[stream].mpd;
        dash_cleanup        on;
        dash_timeshift      600;
        dash_update_period  5000;
    }
EOF
    apply_config "number_mode" "/tmp/dash_config.txt"
}

# Function to apply the minimal profile
apply_minimal() {
    cat > /tmp/dash_config.txt << 'EOF'
    dash {
        enabled         on;
        dash_path       ./objs/nginx/html;
        dash_mpd_file   [app]/[stream].mpd;
    }
EOF
    apply_config "minimal" "/tmp/dash_config.txt"
}

# Function to apply a configuration
apply_config() {
    local profile=$1
    local config_file=$2
    
    echo -e "${YELLOW}Applying DASH configuration profile: $profile${NC}"
    
    # Create backup of current configuration
    cp config/srs.conf config/srs.conf.bak
    
    # Update the configuration file using sed
    sed -n '1,/# DASH configurations/p' config/srs.conf.bak > config/srs.conf
    cat $config_file >> config/srs.conf
    echo "    }" >> config/srs.conf
    sed -n '/# DASH configurations/,/}/!p' config/srs.conf.bak | tail -n +2 >> config/srs.conf
    
    echo -e "${GREEN}Configuration updated successfully.${NC}"
    echo "New DASH configuration:"
    echo "-----------------------"
    grep -A 20 "# DASH configurations" config/srs.conf
    echo "-----------------------"
    
    # Start the containers
    echo -e "${YELLOW}Starting containers...${NC}"
    docker-compose up -d
    
    echo -e "${GREEN}DASH configuration updated and containers started.${NC}"
    echo "Run the test script to check if DASH is working:"
    echo "./scripts/run-dash-test.sh"
}

# Print usage information
usage() {
    echo -e "${YELLOW}SRS DASH Configuration Utility${NC}"
    echo "------------------------"
    echo "Usage: $0 [profile]"
    echo ""
    echo "Available profiles:"
    echo "  - default     # Default DASH configuration"
    echo "  - explicit    # Configuration with explicit parameters"
    echo "  - number_mode # Use numbered segment type"
    echo "  - minimal     # Minimal configuration"
    echo ""
    echo "Examples:"
    echo "  $0 default     # Apply default DASH configuration"
    echo "  $0 explicit    # Apply configuration with explicit parameters"
    echo "  $0 number_mode # Use numbered segment type"
    echo "  $0 minimal     # Minimal configuration"
    echo ""
}

# Main script execution
if [ $# -eq 0 ]; then
    usage
    exit 0
fi

# Apply the selected profile
case "$PROFILE" in
    "default")
        apply_default
        ;;
    "explicit")
        apply_explicit
        ;;
    "number_mode")
        apply_number_mode
        ;;
    "minimal")
        apply_minimal
        ;;
    *)
        echo -e "${RED}Error: Profile '$PROFILE' not found${NC}"
        usage
        exit 1
        ;;
esac 