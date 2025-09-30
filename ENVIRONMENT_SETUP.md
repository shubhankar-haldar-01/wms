# Environment Setup Guide

## Required Environment Variables

Create a `.env` file in the `server/` directory with the following variables:

### Database Configuration

```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_database_password
DB_NAME=wms_db
DB_PORT=3306
DB_MAX_CONNECTIONS=20
DB_CONNECTION_TIMEOUT=10000
```

### Server Configuration

```bash
NODE_ENV=development
PORT=5001
CLIENT_URL=http://localhost:3000
VPS_DOMAIN=https://your-vps-domain.com
```

### JWT Secret

```bash
JWT_SECRET=your_jwt_secret_key_here
```

### Printer Configuration

```bash
PRINTER_CONNECTION_TYPE=auto
PRINTER_IP=192.168.1.100
PRINTER_PORT=9100
PRINTER_VENDOR_ID=0x04f9
PRINTER_PRODUCT_ID=0x2042
PRINTER_USB_PATH=/dev/usb/lp0
```

### Redis Cache (Optional)

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_CACHE_TTL=3600
```

## Setup Instructions

1. Copy the environment variables above into `server/.env`
2. Replace placeholder values with your actual configuration
3. Ensure your database is running and accessible
4. Start the application with `npm run dev`

## Security Notes

- Never commit `.env` files to version control
- Use strong, unique passwords for production
- Rotate JWT secrets regularly
- Keep database credentials secure
