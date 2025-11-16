# Database Migrations Guide

This project uses `migrate-mongo` for database migrations.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Ensure MongoDB is running and `MONGODB_URI` is set in `environment.env`

## Running Migrations

### Check migration status
```bash
npm run migrate:status
```

### Run all pending migrations
```bash
npm run migrate
```

### Rollback last migration
```bash
npm run migrate:down
```

### Create a new migration
```bash
npm run migrate:create <migration-name>
```

## Migration Files

Migrations are stored in `backend/migrations/` directory.

Each migration file exports:
- `up()`: Function to apply the migration
- `down()`: Function to rollback the migration

## Example Migration

```javascript
module.exports = {
  async up(db) {
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
  },
  async down(db) {
    await db.collection('users').dropIndex('email_1');
  },
};
```

