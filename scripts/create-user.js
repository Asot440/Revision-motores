const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database(path.join(__dirname, '..', 'database.db'));
const BCRYPT_ROUNDS = 12;

const ROLE_PERMISSIONS = {
    admin: [
        'users:create',
        'users:read',
        'motors:read',
        'inspections:create',
        'reports:read'
    ],
    supervisor: [
        'users:read',
        'motors:read',
        'inspections:create',
        'reports:read'
    ],
    technician: [
        'motors:read',
        'inspections:create'
    ],
    viewer: [
        'motors:read',
        'reports:read'
    ]
};

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
                return;
            }

            resolve(this);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(rows);
        });
    });
}

function getArg(name) {
    const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
    return arg ? arg.split('=').slice(1).join('=') : null;
}

function normalizeRole(role) {
    return ROLE_PERMISSIONS[role] ? role : 'viewer';
}

async function ensureColumn(table, column, definition) {
    const columns = await dbAll(`PRAGMA table_info(${table})`);
    const exists = columns.some((item) => item.name === column);

    if (!exists) {
        await dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

async function ensureUsersTable() {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            password_hash TEXT,
            role TEXT DEFAULT 'viewer',
            permissions TEXT DEFAULT '[]'
        )
    `);

    await ensureColumn('users', 'password_hash', 'TEXT');
    await ensureColumn('users', 'role', `TEXT DEFAULT 'viewer'`);
    await ensureColumn('users', 'permissions', `TEXT DEFAULT '[]'`);
}

async function createUser() {
    const username = getArg('username');
    const password = getArg('password');
    const role = normalizeRole(getArg('role') || 'viewer');
    const permissionsArg = getArg('permissions');
    const permissions = permissionsArg
        ? permissionsArg.split(',').map((item) => item.trim()).filter(Boolean)
        : ROLE_PERMISSIONS[role];

    if (!username || !password) {
        console.error('Uso: npm run create-user -- --username=juan --password=Secreta123 --role=technician');
        process.exitCode = 1;
        return;
    }

    await ensureUsersTable();

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await dbRun(
        `INSERT INTO users(username, password_hash, role, permissions) VALUES (?, ?, ?, ?)`,
        [username, passwordHash, role, JSON.stringify(permissions)]
    );

    console.log(`Usuario creado: ${username}`);
    console.log(`Rol: ${role}`);
    console.log(`Permisos: ${permissions.join(', ')}`);
}

createUser()
    .catch((err) => {
        if (err.code === 'SQLITE_CONSTRAINT') {
            console.error('Ese usuario ya existe.');
        } else {
            console.error('No se pudo crear el usuario:', err.message);
        }

        process.exitCode = 1;
    })
    .finally(() => {
        db.close();
    });
