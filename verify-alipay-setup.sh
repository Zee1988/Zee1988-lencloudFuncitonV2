#!/bin/bash

echo "=========================================="
echo "Alipay Payment Function Verification"
echo "=========================================="
echo ""

# 1. Check dependencies
echo "1. Checking dependencies..."
if [ -d "node_modules/axios" ]; then
    echo "✓ axios installed"
else
    echo "✗ axios not installed, run: npm install"
    exit 1
fi

# 2. Check key files
echo ""
echo "2. Checking key files..."
for file in cloud.js server.js package.json PAYMENT_DEPLOYMENT.md ALIPAY_IMPLEMENTATION_SUMMARY.md; do
    if [ -f "$file" ]; then
        echo "✓ $file exists"
    else
        echo "✗ $file not found"
        exit 1
    fi
done

# 3. Check cloud.js configuration
echo ""
echo "3. Checking cloud.js configuration..."

if grep -q "YUNGOU_ALIPAY_APP_PAY_URL" cloud.js; then
    echo "✓ Alipay API endpoint configured"
else
    echo "✗ Alipay API endpoint not configured"
    exit 1
fi

if grep -q "payMethod', 'alipay'" cloud.js; then
    echo "✓ Payment method set to alipay"
else
    echo "✗ Payment method incorrect"
    exit 1
fi

if grep -q "orderInfo: orderInfo" cloud.js; then
    echo "✓ Return parameters include orderInfo"
else
    echo "✗ Return parameters incorrect"
    exit 1
fi

# 4. Check server.js configuration
echo ""
echo "4. Checking server.js configuration..."

if grep -q "handlePaymentCallback" server.js; then
    echo "✓ Payment callback route registered"
else
    echo "✗ Payment callback route not registered"
    exit 1
fi

if grep -q "YUNGOU_MCH_ID" server.js; then
    echo "✓ Environment variable checks added"
else
    echo "✗ Environment variable checks not added"
    exit 1
fi

# 5. Check package.json dependencies
echo ""
echo "5. Checking package.json dependencies..."

if grep -q '"axios"' package.json; then
    echo "✓ axios added to dependencies"
else
    echo "✗ axios not in dependencies"
    exit 1
fi

# 6. Syntax check
echo ""
echo "6. Syntax check..."

if node -c cloud.js 2>/dev/null; then
    echo "✓ cloud.js syntax correct"
else
    echo "✗ cloud.js syntax error"
    exit 1
fi

if node -c server.js 2>/dev/null; then
    echo "✓ server.js syntax correct"
else
    echo "✗ server.js syntax error"
    exit 1
fi

# 7. Summary
echo ""
echo "=========================================="
echo "✓ All verifications passed!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Configure environment variables in LeanCloud console:"
echo "   - YUNGOU_MCH_ID"
echo "   - YUNGOU_API_KEY"
echo "   - YUNGOU_ALIPAY_APP_ID (optional, required for multi-app scenarios)"
echo "   - PAYMENT_NOTIFY_URL"
echo ""
echo "2. Deploy to LeanCloud:"
echo "   lean deploy"
echo ""
echo "3. Test cloud functions:"
echo "   See PAYMENT_DEPLOYMENT.md for test commands"
echo ""
